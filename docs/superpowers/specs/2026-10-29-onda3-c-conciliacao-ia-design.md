# Onda 3 · Sub-projeto C — Conciliação de caixa assistida por IA

- **Data:** 2026-10-29
- **Branch/worktree:** `arquitetura/onda3-c` (C:\pideploy-onda3c), cortado de `main` (independente do PR #3/onda0).
- **Processo:** superpowers:brainstorming (arquitetural) → esta spec → writing-plans → executing-plans.
- **Disciplinas:** backend-design:boring-by-default, idempotency-and-side-effects; IA sempre sugere, humano confirma.
- **Status:** nada implementado; só esta spec.

## 1. Propósito e resultado
Reduzir o caixa órfão (movimentos de `fluxo` sem centro de custo) oferecendo, **sob demanda**, uma **sugestão de CC por IA** a partir da descrição do movimento e do histórico. O Financeiro **sempre confirma** — a IA nunca grava um CC. Sucesso: menos digitação na conciliação, **zero** CC gravado sem um humano aceitar, e nenhuma sugestão de CC que não exista.

**Não-objetivos (fora do C):** sugestão em lote ou por cron (evolução futura); classificar movimento como "custo geral/não-projeto" (a IA só propõe CC de projeto **ou** "incerto"); baixa de parcela por IA (entradas seguem no `parcelaBaixar` manual); qualquer escrita automática.

## 2. Decisões (brainstorming)
| # | Decisão |
|---|---|
| Quando | **Sob demanda, por linha**: o Financeiro clica "Sugerir CC (IA)" numa linha da fila. Sem cron, sem sugestão guardada. |
| Espaço da resposta | **CC de projeto ATIVO ou "incerto"**. A IA nunca inventa cc; se nada casar, devolve "incerto". |
| Gate | A IA **nunca grava**. A ação de sugerir é **read-only**; só o `fluxoSet` existente (gate financeiro) grava o cc, por clique humano em "Aceitar". |
| Motor | Reusa `ENV.AI.run("@cf/meta/llama-3.1-8b-instruct", …)` — mesmo precedente do `triagemIA` (Daily Brief). |
| Flag | `conciliacao_ia` (E-06, default **OFF**). OFF ou sem binding → devolve sugestão vazia ("IA indisponível"). |

## 3. Estado atual (aterrado no código)
- `fluxo`: `id, tipo, categoria, descricao, cc, valor, data_prev, data_real, status, origem`. A fila de conciliação (`action === "conciliacao"`) já lista os `fluxo` sem cc, paginado; `fluxoSet` faz upsert e grava `cc` (gate `financeiro.editar`); `parcelaBaixar` concilia entradas com parcela/contrato.
- `proj`: `cc, projeto, cliente, status, registro`. Projetos candidatos = `registro='ATIVO'`.
- IA: `triagemIA` (src/index.ts ~186) chama `ENV.AI.run(BRIEF_MODELO, {messages/prompt})`, trata `!ENV.AI` como indisponível e devolve `null`. É o padrão a seguir.
- FLAGS (E-06) + `flagsAtivas(tenant)` já existem.

## 4. Projeto da solução

### 4.1 Helpers puros (`src/onda3c.mjs` + `.d.mts`)
Testáveis por comportamento (sem D1, sem rede), precedente `onda3a.mjs`/`onda3b.mjs`:
- `montaPromptSugestaoCC(mov, candidatos, historico): string` — `mov` = {descricao, valor, data}; `candidatos` = [{cc, cliente, projeto}] (projetos ativos); `historico` = [{descricao, cc}] (exemplos). Produz o prompt com a **instrução de restrição**: "responda em JSON {cc, confianca, motivo}; `cc` DEVE ser um dos CCs da lista, ou a string vazia se incerto; não invente cc".
- `parseSugestaoCC(textoIA, ccsValidos): {cc, confianca, motivo}` — faz o parse tolerante da resposta; **valida `cc` contra `ccsValidos`**; se o cc não estiver na lista (alucinação) → `cc=""` (incerto), preservando `motivo`. `confianca` normalizada a 0–1 (ou "" ). É o **guard anti-invenção** e o ponto mais testado.

### 4.2 Ação `conciliaSugerir` (read-only)
`auth` + gate financeiro (mesma capability de `conciliacao`/`fluxoList`: `financeiro.ver`). Recebe `{id}` de um `fluxo`. Passos: carrega o movimento; se já tem cc, devolve vazio; monta `candidatos` (`SELECT cc, cliente, projeto FROM proj WHERE tenant_id=? AND registro='ATIVO'`) e `historico` (`SELECT descricao, cc FROM fluxo WHERE tenant_id=? AND COALESCE(cc,'')<>'' ORDER BY criado DESC LIMIT 60`); checa a flag `conciliacao_ia` e `ENV.AI` — se OFF/ausente devolve `{cc:"", confianca:"", motivo:"IA indisponível"}`; senão `ENV.AI.run(...)` → `parseSugestaoCC(resp, candidatos.map(cc))`. Devolve `{cc, confianca, motivo}`. **Não escreve nada.** `audit("conciliacao_ia", slug, id+" -> "+cc)` para rastro.

### 4.3 Confirmação (gate humano)
Na fila de conciliação (casca clássica `public/index.html`): cada linha ganha "Sugerir CC (IA)" → chama `conciliaSugerir`, mostra `cc` sugerido + confiança + motivo (ou "incerto"/"IA indisponível"). Um botão **"Aceitar"** chama o `fluxoSet` existente com aquele `cc` (clique humano). Sem aceitar, nada muda. Rótulo deixa claro que é sugestão de IA a conferir.

### 4.4 Segurança / privacidade
- A IA é **read-only por construção**: `conciliaSugerir` não tem nenhum INSERT/UPDATE; a escrita é só pelo `fluxoSet` já auditado. Não há caminho de auto-aplicação.
- Descrição + valor do movimento vão ao **Workers AI (Cloudflare)** — mesmo precedente interno do Daily Brief/AutoRAG, não um terceiro externo novo. Registrado aqui por transparência (sem PII de pessoa; é dado financeiro interno).

### 4.5 Flag (E-06)
`conciliacao_ia` no registro FLAGS, `def:false`. Sem tabela nova ⇒ **sem bump de SCHEMA_VER**. `API_VER` não muda (ação aditiva).

## 5. Testes (node --test, estáticos)
1. `parseSugestaoCC`: cc fora de `ccsValidos` → `cc=""` (incerto), motivo preservado; cc válido → devolvido com confiança; resposta não-JSON → incerto sem lançar.
2. `montaPromptSugestaoCC`: inclui a descrição do movimento, a lista de CCs candidatos e a instrução de restrição ("um dos CCs da lista ou vazio").
3. Fiação (source asserts em foundation.test.mjs): `action === "conciliaSugerir"`, importa `./onda3c.mjs`, flag `conciliacao_ia`, botão/rotina no `public/index.html`; e um assert de que `conciliaSugerir` **não** contém `fluxoSet`/`UPDATE fluxo`/`INSERT INTO fluxo` (prova read-only).

## 6. Premissas a confirmar no plano
- Forma exata do `ENV.AI.run` (messages vs prompt) a partir do `triagemIA`.
- Capability exata da fila de conciliação (reusar a de `conciliacao`).
- Formato da resposta do modelo (pedir JSON; `parseSugestaoCC` tolerante a texto ao redor).
- Ponto de inserção do botão na fila da casca clássica.

## 7. Fora de escopo / evolução
Sugestão em lote/cron; classe "custo geral" (não-projeto); baixa de parcela assistida; aprendizado a partir das aceitações. A implementação roda em sessão (local ou nuvem) a partir deste branch, abrindo PR próprio para `main`.
