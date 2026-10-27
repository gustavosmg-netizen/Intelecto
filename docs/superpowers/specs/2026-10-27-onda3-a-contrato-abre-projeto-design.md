# Onda 3 · Sub-projeto A — Contrato confirmado abre o projeto (regras reativas)

- **Data:** 2026-10-27
- **Branch/worktree:** `arquitetura/onda0` (C:\pideploy-arq)
- **Processo:** superpowers:brainstorming (caminho arquitetural) → esta spec → writing-plans
- **Disciplinas aplicadas:** backend-design:boring-by-default, backend-design:idempotency-and-side-effects
- **Status de implementação:** nada implementado; só esta spec.

## 1. Propósito e resultado

Matar a **redigitação** entre contrato e projeto: quando um contrato vira `confirmado`, o projeto/centro de custo e o plano de parcelas nascem **do contrato** (o valor flui do contrato, dono único), sem ninguém recadastrar; e lançar hora em projeto encerrado passa a ser **bloqueado com explicação**, com uma exceção controlada para a Coordenação.

**Sucesso:** contrato confirmado produz um projeto rastreável ao contrato, com gate humano de aprovação, e nenhum caixa/hora órfão novo. Rodar o gatilho duas vezes não cria dois projetos.

**Não-objetivos (vão para B/E):** agendar kickoff (tabela `evento` vazia), e-mail de notificação, e o barramento de eventos (outbox/Queues/Workflows) — adiados até haver um efeito **externo** que os justifique.

## 2. Decisões (brainstorming)

| # | Decisão |
|---|---|
| Gate | Contrato confirmado **PROPÕE** o projeto em estado PROPOSTO; Coordenação aprova → ATIVO. Nada efetivo sem o gate. |
| Hora em encerrado | **Bloqueia, com exceção da Coordenação** (lançamento retroativo legítimo), auditado — sem reabrir o projeto. |
| Notificação | **No portal** (fila PROPOSTO + regra no Painel de Consistência). Sem e-mail, sem binding novo. |
| Mecanismo | **Síncrono + idempotente, tudo em D1.** Sem Queues/Workflows/outbox (boring-by-default): o efeito colateral é 100% D1, logo cabe numa transação. |

## 3. Estado atual (aterrado no código)

- `proj` (PK `cc`): `projeto, subtipo, status, inicio, previsto, fim, registro`. `status ∈ {A INICIAR, EM ANDAMENTO, EM ESPERA, CONCLUÍDO, CANCELADO}` (`STATUSES`). O ciclo **PROPOSTO↔ATIVO é o campo `registro`** (consultas "ativas" filtram `registro='ATIVO'`), não o `status`.
- `projx`: extensão financeira do projeto (tem `contratado`).
- `cc_contrato`: `id, cc, titulo, valor, assinado, status, tipo, deal_id, obs, …`. "Contrato assinado" = **`status='confirmado'`** (margem e regra C2 já usam isso); `assinado` é só a data. Upsert por `contratoSet` (capability `coordenacao`).
- `contrato_parcela`: `id, contrato_id, cc, numero, valor, venc_prev, recebido_em, fluxo_id, status('prevista'|'recebida'), obs`. Criada por `parcelaSet`; conciliação por `parcelaBaixar`.
- **Guard já existe:** `regraStatus` (Onda 1) bloqueia hora em `proj.status` CONCLUÍDO/CANCELADO no `add`.
- E-06: flags (`flag:<nome>`, default OFF) + API versionada já em produção.

## 4. Projeto da solução

### 4.1 Gatilho (em `contratoSet`)
Após o upsert do contrato, **no mesmo handler/batch**, se e somente se:
1. a flag **`contrato_abre_projeto`** estiver ligada para o `tenant_id`;
2. o contrato resultante tem `status='confirmado'`, um `cc` não vazio e `valor>0`;

então cria a proposta de forma **idempotente**:
- `INSERT INTO proj (cc, projeto, status, registro, …) VALUES (…, 'A INICIAR', 'PROPOSTO', …) ON CONFLICT(cc) DO NOTHING` — a chave idempotente é o `cc` (PK). Confirmar de novo, editar um contrato já confirmado ou duplo-clique viram no-op.
- `INSERT INTO projx (cc, contratado, …) … ON CONFLICT(cc) DO NOTHING`, com `contratado = cc_contrato.valor` — o valor **flui do contrato** (dono único; `projx.contratado` deixa de ser redigitado).
- Uma `contrato_parcela` inicial `status='prevista'`, `numero=1`, `valor=valor`, `venc_prev=''`, ligada ao `contrato_id` — ponto de partida que a Coordenação ajusta. Criada só se o contrato ainda não tem parcelas (idempotente por existência).
- `audit()` registrando a criação da proposta (quem/quando/cc/contrato_id).

Nenhuma chamada externa dentro da transação (disciplina). Notificação = o projeto PROPOSTO aparecer na fila; sem linha extra.

### 4.2 Aprovação (gate, reusa PROPOSTO→ATIVO)
A Coordenação (`projetos.aprovar`) revê o código E.C.T.P (o `cc`), o título e a equipe, ajusta o que for preciso e **aprova**, levando `proj.registro` de `PROPOSTO` para `ATIVO`. Enquanto PROPOSTO, o projeto fica **fora** das consultas `registro='ATIVO'` (não contamina margem, carteira, rateio). Premissa a confirmar na implementação: o caminho de aprovação PROPOSTO→ATIVO existente (ver comentário index.ts:1956 e `projSet`/cadastro em ~3362) é reaproveitado; se não houver ação dedicada, criar `projAprovar` (capability `projetos.aprovar`).

### 4.3 Guard de horas (estende `regraStatus`)
No `add` (e no `edit` de lançamento):
- **Bloqueio** (já existe) quando o projeto está CONCLUÍDO/CANCELADO.
- **Exceção da Coordenação:** se o autor tem a capability de aprovação e envia `forcar=true` explícito, o lançamento é aceito e **auditado** como lançamento retroativo em projeto encerrado. Sem `forcar`, segue bloqueado.
- **Sugestão:** a mensagem de bloqueio passa a listar os `cc` ATIVOS do mesmo cliente do projeto, para o autor corrigir o destino.

### 4.4 Flag (E-06)
`contrato_abre_projeto` entra no registro de FLAGS com **default OFF** (opt-in, padrão da casa). Ligar/desligar pela Administração › Feature flags (dono + reauth). Com OFF, `contratoSet` se comporta como hoje (nada é criado). SCHEMA_VER é bumpado se a flag precisar de seed (não precisa: ausente = OFF).

### 4.5 Painel de Consistência
- Nova regra **"contrato confirmado sem projeto"** (sev alto, dono Coordenação): contratos `status='confirmado'` cujo `cc` não tem `proj`. Deve tender a zero com a flag ligada.
- Nova regra **"projeto PROPOSTO aguardando aprovação há > 7 dias"** (sev médio, dono Coordenação).
- C2 ("deal assinado sem contrato confirmado") já existe e permanece.

## 5. Idempotência & efeitos colaterais (resumo da disciplina)
- Pergunta-chave "e se rodar duas vezes?": resposta = **mesmo resultado** (ON CONFLICT DO NOTHING por `cc`).
- Nenhum efeito externo (e-mail/HTTP/broker) — logo **sem outbox** (o outbox protege escrita-no-DB-mais-efeito-externo, que aqui não há).
- Tudo numa transação D1 (`batch()`); se o upsert do contrato falha, a proposta não nasce.

## 6. Testes (`node --test`, estáticos como o restante da suíte)
1. Contrato `confirmado` com flag ON cria **um** projeto PROPOSTO + projx.contratado = valor; rodar 2× não duplica.
2. Flag OFF: `contratoSet confirmado` **não cria nada**.
3. `projx.contratado` reflete o valor do contrato, não um valor redigitado.
4. Guard: hora em projeto CONCLUÍDO bloqueia; com `forcar=true` de quem tem capability, passa e gera linha de auditoria; sem capability, bloqueia mesmo com `forcar`.
5. Regras novas do Painel retornam contagem coerente num D1 de fixture.

## 7. Premissas a confirmar no plano (não são lacunas de requisito)
- Nome/assinatura exatos de `regraStatus` e o ponto de inserção no `add`/`edit`.
- Existência de uma ação de aprovação PROPOSTO→ATIVO reaproveitável; senão, `projAprovar`.
- Colunas mínimas obrigatórias de `projx` no INSERT (defaults).
- Capability usada para a exceção do guard (`projetos.aprovar` vs `horas.aprovar`) — decisão no plano, default `projetos.aprovar`.

## 8. Fora de escopo / próximos sub-projetos
B (regras agendadas), C (conciliação assistida por IA), D (Pergunte ao portal), E (MCP escopo de escrita). O `evento_outbox` nasce em B/E, quando chegar o primeiro efeito externo.
