# Onda 3 · Sub-projeto B (núcleo) — Regras agendadas + notificações · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O portal passa a avisar sozinho (sino in-portal) sobre projetos parados, estouro de horas e apontamento em atraso, e fecha o resumo executivo todo mês — por regras agendadas num cron diário, atrás de uma flag OFF.

**Architecture:** Lógica pura em `src/onda3b.mjs` (decidir se a regra roda, calcular nível, montar statements idempotentes), testada por comportamento como `src/onda3a.mjs`. O `scheduled()` faz as consultas D1 e chama os helpers; nenhuma chamada externa. Notificações numa tabela `notificacao` com dedup por `UNIQUE(tenant,tipo,ref,periodo)` + `INSERT OR IGNORE`.

**Tech Stack:** Cloudflare Workers + Hono + D1, TypeScript (`src/index.ts`), `node --test` em `test/`.

**Spec:** `docs/superpowers/specs/2026-10-27-onda3-b-regras-agendadas-design.md`

## Global Constraints
- Checkout **compartilhado** (worktree onda0): **commit por path**, nunca `git add -A`/`-a`.
- Nova tabela `notificacao` ⇒ **bump de `SCHEMA_VER`** (senão não nasce) + `CREATE TABLE IF NOT EXISTS` no ensureSchema + migração versionada.
- Flag `regras_agendadas` nasce **OFF** (`def:false`); ausente = OFF.
- Sem mudança do contrato de `/api` fora das 2 ações novas (não bumpar `API_VER`).
- Dedup **sempre** por `INSERT OR IGNORE` contra `UNIQUE(tenant_id,tipo,ref,periodo)`.
- `@coordenacao` = destino de grupo; coordenação = `temCapSet(caps,'projetos.aprovar')`.
- Precedente a seguir: `src/onda3a.mjs` + `test/onda3a.test.mjs` (mesmo estilo).

## Review Focus
- **Re-rodar o cron no mesmo período** não pode duplicar notificação (Task 1: `notifStatements` usa `INSERT OR IGNORE`; Task 3 roda 2×).
- **Dia errado**: R3 (sem_apontamento) só sexta; R4 (snapshot) só dia 1 — `deveRodar` falso nos outros dias (Task 1).
- **Não-coordenador** não pode ver notificações `@coordenacao` (Task 2: filtro de `notificacoes`).
- **Flag OFF**: o cron não gera nada (Task 3).
- **Entradas vazias** (nenhum projeto parado / todos apontaram): `notifStatements([])` → `[]`, nenhum INSERT (Task 1).

---

### Task 1: Helpers puros `src/onda3b.mjs`

**Files:**
- Create: `src/onda3b.mjs`, `src/onda3b.d.mts`
- Test: `test/onda3b.test.mjs`

**Interfaces — Produces:**
- `deveRodar(regra: "parado"|"estouro"|"sem_apontamento"|"snapshot", data: Date): boolean`
- `nivelEstouro(consumido: number, previsto: number): ""|"80"|"100"|"120"`
- `periodoSemanaISO(data: Date): string` (ex.: `"2026-W44"`)
- `notifStatements(itens: Array<{id,tenant,destino,tipo,ref,periodo,titulo,texto,now}>): Array<{sql,args}>` — um `INSERT OR IGNORE INTO notificacao (...)` por item; `[]` se vazio.

- [ ] **Step 1: Teste que falha** (`test/onda3b.test.mjs`, importando `../src/onda3b.mjs`):
```js
test("deveRodar: sem_apontamento só sexta; snapshot só dia 1; parado/estouro sempre", () => {
  const sexta = new Date("2026-10-30T12:00:00Z");   // sexta
  const dia1  = new Date("2026-11-01T12:00:00Z");
  const outro = new Date("2026-10-28T12:00:00Z");   // quarta, não-dia-1
  assert.equal(deveRodar("sem_apontamento", sexta), true);
  assert.equal(deveRodar("sem_apontamento", outro), false);
  assert.equal(deveRodar("snapshot", dia1), true);
  assert.equal(deveRodar("snapshot", outro), false);
  assert.equal(deveRodar("parado", outro), true);
  assert.equal(deveRodar("estouro", outro), true);
});
test("nivelEstouro: faixas 80/100/120", () => {
  assert.equal(nivelEstouro(70,100), "");
  assert.equal(nivelEstouro(80,100), "80");
  assert.equal(nivelEstouro(100,100), "100");
  assert.equal(nivelEstouro(130,100), "120");
  assert.equal(nivelEstouro(10,0), ""); // previsto 0 → sem nível
});
test("periodoSemanaISO estável por semana", () => {
  assert.equal(periodoSemanaISO(new Date("2026-10-26T00:00:00Z")), periodoSemanaISO(new Date("2026-10-27T00:00:00Z")));
  assert.notEqual(periodoSemanaISO(new Date("2026-10-26")), periodoSemanaISO(new Date("2026-11-03")));
});
test("notifStatements: INSERT OR IGNORE por item; vazio→[]", () => {
  assert.deepEqual(notifStatements([]), []);
  const s = notifStatements([{id:"N1",tenant:"intelecto",destino:"@coordenacao",tipo:"proj_parado",ref:"1.2.3.4",periodo:"2026-W44",titulo:"x",texto:"y",now:"2026-10-27T00:00:00Z"}]);
  assert.equal(s.length,1);
  assert.match(s[0].sql, /INSERT OR IGNORE INTO notificacao/);
  assert.ok(s[0].args.includes("@coordenacao") && s[0].args.includes("proj_parado"));
});
```
- [ ] **Step 2: Rodar e ver falhar** — `node --test test/onda3b.test.mjs` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** os 4 helpers em `src/onda3b.mjs` (ESM puro) + `src/onda3b.d.mts`. `deveRodar`: `sem_apontamento`→`data.getUTCDay()===5`; `snapshot`→`data.getUTCDate()===1`; senão `true`. `nivelEstouro`: `previsto<=0`→`""`; pct=100*cons/prev; `>=120`→"120", `>=100`→"100", `>=80`→"80", senão "". `periodoSemanaISO`: algoritmo ISO-week padrão. `notifStatements`: mapeia cada item para `{sql:"INSERT OR IGNORE INTO notificacao (id,tenant_id,destino,tipo,ref,periodo,titulo,texto,criado,lido) VALUES (?,?,?,?,?,?,?,?,?,0)", args:[...]}`.
- [ ] **Step 4: Rodar e ver passar** — `node --test test/onda3b.test.mjs` → PASS.
- [ ] **Step 5: Commit** — `git -C /c/pideploy-arq add src/onda3b.mjs src/onda3b.d.mts test/onda3b.test.mjs && git -C /c/pideploy-arq commit -m "feat(onda3-B): helpers puros das regras agendadas"`

---

### Task 2: Tabela `notificacao` + ações `notificacoes` / `notifLida`

**Files:**
- Create: `migrations/0010_notificacao.sql`
- Modify: `src/index.ts` — `CREATE TABLE IF NOT EXISTS notificacao (...)` no bloco do ensureSchema; `UNIQUE`/índice; **bump `SCHEMA_VER`**; duas ações novas; registrar `notificacoes`/`notifLida` no mapa de ações e capability.
- Test: `test/foundation.test.mjs`

**Interfaces — Produces:** ação `notificacoes` → `{ok, notificacoes:[...], naoLidas:n}`; ação `notifLida` (`{id?}` ou todas) → `{ok}`.

- [ ] **Step 1: Teste que falha** (source asserts):
```js
test("Onda 3-B: tabela notificacao + ações + SCHEMA_VER bump", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /CREATE TABLE IF NOT EXISTS notificacao/);
  assert.match(ts, /UNIQUE\(tenant_id, ?tipo, ?ref, ?periodo\)/);
  assert.match(ts, /action === "notificacoes"/);
  assert.match(ts, /action === "notifLida"/);
  assert.match(read("migrations/0010_notificacao.sql"), /CREATE TABLE IF NOT EXISTS notificacao/);
});
```
- [ ] **Step 2: Rodar e ver falhar** — `node --test test/foundation.test.mjs` → FAIL.
- [ ] **Step 3: Implementar.** Adicionar o CREATE (colunas da spec §3) ao array de schema do ensureSchema; criar `migrations/0010_notificacao.sql` com o mesmo CREATE + índices; **bumpar `SCHEMA_VER`** para a data de hoje. Ação `notificacoes`: `auth`; `caps`; `coord = temCapSet(caps,"projetos.aprovar")`; `SELECT ... FROM notificacao WHERE tenant_id=? AND (destino=? OR (destino='@coordenacao' AND <coord>)) ORDER BY criado DESC LIMIT 100` (passar `u.slug`; quando não-coord, a condição `@coordenacao` é desligada por parâmetro), devolver linhas + contagem `lido=0`. Ação `notifLida`: `UPDATE notificacao SET lido=1 WHERE tenant_id=? AND (id=? OR ? ='all') AND (destino=? OR (destino='@coordenacao' AND <coord>))`. Registrar as 2 ações no mapa de capability (piso: logado).
- [ ] **Step 4: Rodar e ver passar** — `node --test test/foundation.test.mjs` → PASS; `npm run build:check`.
- [ ] **Step 5: Commit** — por path (`src/index.ts`, `migrations/0010_notificacao.sql`, `test/foundation.test.mjs`).

---

### Task 3: Cron + `rodarRegrasAgendadas(env)` (R1–R4) atrás da flag

**Files:**
- Modify: `wrangler.toml` (crons += `"0 11 * * *"`); `src/index.ts` — `FLAGS.regras_agendadas`; função `rodarRegrasAgendadas(env)`; branch no `scheduled()` (6901–6916).
- Test: `test/foundation.test.mjs`

**Interfaces — Consumes:** Task 1 (`deveRodar`, `nivelEstouro`, `periodoSemanaISO`, `notifStatements`); Task 2 (tabela `notificacao`). `resumoExecutivo(tenant)` (já existe) para R4.

- [ ] **Step 1: Teste que falha** (source asserts):
```js
test("Onda 3-B: cron diário + regras agendadas atrás da flag", () => {
  assert.match(read("wrangler.toml"), /"0 11 \* \* \*"/);
  const ts = read("src/index.ts");
  assert.match(ts, /regras_agendadas/);
  assert.match(ts, /function rodarRegrasAgendadas/);
  assert.match(ts, /run\("regras_agendadas"/);
  assert.match(ts, /from "\.\/onda3b\.mjs"/);
});
```
- [ ] **Step 2: Rodar e ver falhar** → FAIL.
- [ ] **Step 3: Implementar.** `FLAGS.regras_agendadas = { desc:"...", def:false }`. `rodarRegrasAgendadas(env)`: `if (!(await flagsAtivas(TENANT_INTELECTO)).regras_agendadas) return;` `const hoje = new Date();` então:
  - **R1** `deveRodar("parado",hoje)`: `SELECT cc, projeto FROM proj WHERE tenant_id=? AND status='EM ANDAMENTO' AND NOT EXISTS (SELECT 1 FROM lanc l WHERE l.cc=proj.cc AND l.tenant_id=proj.tenant_id AND l.d>=date('now','-30 day'))`; monta itens `{destino:'@coordenacao',tipo:'proj_parado',ref:cc,periodo:periodoSemanaISO(hoje),...}` → `notifStatements` → executa.
  - **R2** `deveRodar("estouro",hoje)`: previsto por CC `SELECT cc, SUM(h) p FROM prevf WHERE tenant_id=? GROUP BY cc`; consumido `SELECT cc, SUM(h) c FROM lanc WHERE tenant_id=? AND s IN ('APROVADO','LANÇADO') GROUP BY cc`; para cada cc com `nivelEstouro(c,p)` não-vazio → item `{tipo:'estouro',destino:'@coordenacao',ref:cc,periodo:nivel,...}`.
  - **R3** `deveRodar("sem_apontamento",hoje)` (só sexta): `desde` = segunda da semana (derive de `hoje`); `SELECT slug FROM membro WHERE tenant_id=? AND ativo=1` menos quem tem `lanc` com `d>=desde`; item por slug `{tipo:'sem_apontamento',destino:slug,ref:slug,periodo:periodoSemanaISO(hoje)}`.
  - **R4** `deveRodar("snapshot",hoje)` (só dia 1): `const resumo = await resumoExecutivo(TENANT_INTELECTO);` INSERT em `fin_snapshot` (id `FS-...`, como em index.ts:3761–3762); opcional: 1 notificação `{tipo:'snapshot',destino:'@coordenacao',periodo:<AAAA-MM>}`.
  - Tudo `try/catch` best-effort (cron robusto), com `logEvent` pelo wrapper `run`.
  Branch no `scheduled()`: `else if (event && event.cron === "0 11 * * *") ctx.waitUntil(run("regras_agendadas", rodarRegrasAgendadas(env)));` (antes do `else` keep-alive). Importar os helpers de `./onda3b.mjs`.
- [ ] **Step 4: Rodar e ver passar** → `node --test` (suíte toda) + `npm run build:check`.
- [ ] **Step 5: Commit** — por path (`wrangler.toml`, `src/index.ts`, `test/foundation.test.mjs`).

---

### Task 4: Sino na casca clássica (mínimo)

**Files:**
- Modify: `public/index.html` (um indicador "🔔" com contagem de não-lidas + lista simples via `notificacoes`, botão marcar-lido via `notifLida`).
- Test: `test/foundation.test.mjs` (source assert) + verificação manual em staging.

- [ ] **Step 1: Teste que falha**:
```js
test("Onda 3-B: casca clássica tem o sino de notificações", () => {
  const html = read("public/index.html");
  assert.match(html, /notificacoes/);
  assert.match(html, /notifLida/);
});
```
- [ ] **Step 2: Rodar e ver falhar** → FAIL.
- [ ] **Step 3: Implementar** o sino: no boot/estado, chamar `api("notificacoes")`, mostrar contagem de `naoLidas`; ao abrir, listar; botão chama `api("notifLida",{id})` ou `{id:"all"}` e re-busca. Seguir os padrões de `api()`/`toast()`/render já existentes no arquivo.
- [ ] **Step 4: Rodar e ver passar** → `node --test`.
- [ ] **Step 5: Verificação em staging** (sessão na nuvem, pós-deploy staging): ligar a flag `regras_agendadas` em staging, popular dados, disparar o cron (ou chamar as regras por um gatilho de teste) e conferir que as notificações aparecem no sino e o marcar-lido funciona; conferir dedup (rodar 2×).
- [ ] **Step 6: Commit** — por path (`public/index.html`, `test/foundation.test.mjs`).

---

## Notas de verificação (fora dos testes estáticos)
- Dedup real e visibilidade por destino só se provam contra D1 — validar em staging (Task 4 Step 5).
- Flag **OFF em produção** até validação logada; ligar depois em Administração › Feature flags.
- O cron `0 11 * * *` **não roda em staging** (crons=[] lá) — a verificação em staging dispara as regras por chamada direta/gatilho de teste, não pelo cron.
