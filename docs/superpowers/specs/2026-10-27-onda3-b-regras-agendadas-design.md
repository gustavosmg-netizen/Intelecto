# Onda 3 · Sub-projeto B (núcleo) — Regras agendadas + notificações in-portal

- **Data:** 2026-10-27
- **Branch/worktree:** `arquitetura/onda0` (C:\pideploy-arq) — PR #2 (onda3-A) já mergeado em main.
- **Processo:** superpowers:brainstorming (arquitetural) → esta spec → writing-plans → executing-plans (na nuvem).
- **Disciplinas:** backend-design:boring-by-default, idempotency-and-side-effects, observability-by-default.
- **Status:** nada implementado; só esta spec.

## 1. Propósito e resultado
Fazer o portal **avisar sozinho** quando algo precisa de atenção, sem depender de alguém abrir cada tela — e sem e-mail (não há binding). Sucesso: a Coordenação e cada colaborador veem, num "sino" in-portal, alertas úteis e **não repetidos**, gerados por regras agendadas; e o resumo executivo é fechado automaticamente todo mês.

**Não-objetivos (ficam fora do B-núcleo):** cadência de **pós-venda** (R5 — tabela e marcos próprios, sub-projeto à parte); **e-mail** (upgrade quando houver binding); campo "responsável" por projeto (os alertas de projeto vão para a Coordenação).

## 2. Decisões (brainstorming)
| # | Decisão |
|---|---|
| Mecanismo | **Notificação in-portal**: tabela `notificacao` + ação de listar/marcar-lido + "sino" na casca clássica. Sem e-mail. |
| Alvo | R1/R2 → **Coordenação** (token `@coordenacao`); R3 → **o colaborador** (slug). `proj` não tem campo responsável, e não se cria um agora. |
| Ciclo | **Dedup por janela**: `UNIQUE(tenant_id,tipo,ref,periodo)` + `INSERT OR IGNORE`. Reaparece no período seguinte se a condição persistir. "Lido" vale dentro da janela. |
| Flag | `regras_agendadas` (E-06, default **OFF**). Ligar só passa a gerar alertas; nada retroativo. |

## 3. Dados
Nova tabela (migração + `CREATE TABLE IF NOT EXISTS` idempotente no ensureSchema; bump de SCHEMA_VER):
```
notificacao(
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto',
  destino TEXT NOT NULL,         -- slug do colaborador OU '@coordenacao'
  tipo TEXT NOT NULL,            -- proj_parado | estouro | sem_apontamento | snapshot
  ref TEXT DEFAULT '',           -- cc, slug, etc.
  periodo TEXT DEFAULT '',       -- semana ISO, nível (80/100/120), mês — chave de dedup
  titulo TEXT DEFAULT '', texto TEXT DEFAULT '',
  criado TEXT DEFAULT '', lido INTEGER DEFAULT 0)
```
Índice/único: `UNIQUE(tenant_id, tipo, ref, periodo)` (dedup) + índice por `(tenant_id, destino, lido)` (listagem).

## 4. Superfície (ações + UI)
- `notificacoes`: retorna as notificações do usuário — `destino = u.slug` **OU** (`destino='@coordenacao'` **E** o usuário é coordenação, i.e., `temCapSet(caps,'projetos.aprovar')`), ordenadas por `criado desc`, com contador de não-lidas.
- `notifLida`: marca uma (ou todas as minhas) como lida (`lido=1`), por id. Só o destinatário (ou coord, para as `@coordenacao`).
- UI clássica: um "sino" com o contador de não-lidas, lista simples, botão marcar-lido. (Na casca nova entra depois; fora do escopo mínimo.)

## 5. Regras (um cron diário; cada regra se autolimita pela data)
Novo trigger cron (ex.: `0 11 * * *`) com um branch em `scheduled()`, gated por `flag:regras_agendadas` e com `logEvent` (observabilidade). Cada regra escreve com `INSERT OR IGNORE` (idempotente):
- **R1 — projeto parado 30d:** `proj.status='EM ANDAMENTO'` sem `lanc` nos últimos 30 dias → `tipo=proj_parado`, `destino='@coordenacao'`, `ref=cc`, `periodo=<semana ISO>`.
- **R2 — estouro de horas (por CC):** soma `lanc.h` do CC ÷ soma `prevf.h` do CC; ao cruzar 80/100/120% → `tipo=estouro`, `destino='@coordenacao'`, `ref=cc`, `periodo=<nível>` (cada nível uma vez). *Refinamento futuro: por função (mapear `lanc.slug`→função via cargo); fica como melhoria, confirmado como fora do núcleo.*
- **R3 — sexta sem apontamento:** só quando a data é sexta; para cada `membro.ativo=1` sem `lanc` na semana ISO corrente → `tipo=sem_apontamento`, `destino=<slug>`, `ref=<slug>`, `periodo=<semana ISO>`.
- **R4 — snapshot mensal:** só quando é dia 1; chama o fluxo existente `resumoExecFechar` (materializa `fin_snapshot`). Sem notificação (ou uma de confirmação a `@coordenacao`, `tipo=snapshot`, `periodo=<mês>`).

## 6. Arquitetura testável
Helpers **puros** em `src/onda3b.mjs` (ESM, como `onda3a.mjs`), importados pelo Worker e testados por comportamento em `test/onda3b.test.mjs`:
- `deveRodar(regra, data)` → boolean (R3 só sexta; R4 só dia 1; R1/R2 todo dia). Recebe a data (injetável), não lê relógio.
- `notifStatements(regra, linhas, periodoInfo)` → `Array<{sql,args}>` com `INSERT OR IGNORE`, destino/tipo/ref/periodo corretos. Puro: recebe as linhas já consultadas.
- `periodoSemanaISO(data)`, `nivelEstouro(consumido, previsto)` → helpers puros.
O `scheduled()` faz as **consultas** D1 e chama os helpers; nenhuma chamada externa.

## 7. Testes (node --test, estáticos)
1. `deveRodar`: R3 verdadeiro só em sexta; R4 só em dia 1; R1/R2 sempre.
2. `nivelEstouro`: <80→nenhum; 80–99→'80'; 100–119→'100'; ≥120→'120'.
3. `notifStatements`: usa `INSERT OR IGNORE`; destino/tipo/ref/periodo esperados; vazio quando não há linhas.
4. `periodoSemanaISO`: mesma semana → mesma chave; semanas diferentes → chaves diferentes.
5. Fiação (source asserts em foundation.test.mjs): cron novo em wrangler.toml; branch em scheduled() gated por `flag:regras_agendadas`; ações `notificacoes`/`notifLida`; tabela no ensureSchema + SCHEMA_VER bumpado.

## 8. Premissas a confirmar no plano
- Nome/forma exatos do seed de `membro`/`ativo` e de `prevf`/`lanc` por CC.
- Ponto de inserção do branch no `scheduled()` e o padrão de `logEvent`.
- Como `resumoExecFechar` é invocável internamente (hoje é ação por `/api`): extrair a função interna ou chamar o mesmo helper.
- Capability de `notificacoes` (qualquer logado vê as suas; `@coordenacao` por `projetos.aprovar`).

## 9. Implementação na nuvem
A pedido do dono, a fase de implementação (`executing-plans`) roda numa **sessão na nuvem** a partir do branch publicado, abrindo seu próprio PR — para poupar tokens locais. O design/spec/plano ficam na sessão local.
