# Onda 3 · Sub-projeto C — Conciliação assistida por IA · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na fila de conciliação, o Financeiro pede uma sugestão de centro de custo por IA para um movimento de caixa sem CC; a IA sugere um CC de projeto ativo (ou "incerto") e o humano confirma gravando pelo fluxo existente — a IA nunca grava.

**Architecture:** Lógica pura em `src/onda3c.mjs` (monta o prompt; faz o parse e **valida o cc contra a lista de candidatos**), testada por comportamento. Uma ação **read-only** `conciliaSugerir` consulta candidatos/histórico no D1 e chama `ENV.AI.run` (padrão do `triagemIA`); a escrita do cc continua só no `fluxoSet` existente, por clique humano. Atrás da flag `conciliacao_ia` (OFF).

**Tech Stack:** Cloudflare Workers + Hono + D1 + Workers AI (`env.AI`, `@cf/meta/llama-3.1-8b-instruct`), TypeScript (`src/index.ts`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-29-onda3-c-conciliacao-ia-design.md`

## Global Constraints
- Worktree `C:\pideploy-onda3c`, branch `arquitetura/onda3-c` (cortado de `main`). **Commit por path**, nunca `-a`.
- **Sem tabela nova ⇒ NÃO bumpar `SCHEMA_VER`.** `API_VER` inalterado (ação aditiva).
- Flag `conciliacao_ia` nasce **OFF** (`def:false`); OFF ou sem `ENV.AI` → sugestão vazia `{cc:"", motivo:"IA indisponível"}`.
- **A IA nunca grava.** `conciliaSugerir` é read-only — nenhum INSERT/UPDATE e não chama `fluxoSet`. Só o `fluxoSet` existente (gate `financeiro.editar`) grava o cc, por clique humano.
- `cc` sugerido DEVE ser um dos projetos `registro='ATIVO'`; alucinação → "incerto" (`cc=""`).
- Precedente: `src/onda3a.mjs`/`onda3b.mjs` (helpers puros + `.d.mts`) e `triagemIA` (ENV.AI.run com `messages:[system,user]`, resposta em `r.response ?? r.result.response`, parse por `txt.match(/\{[\s\S]*\}/)`).

## Review Focus
- **IA devolve um cc fora da lista** (alucinação) → `parseSugestaoCC` força "incerto" (Task 1).
- **`ENV.AI` ausente ou flag OFF** → `conciliaSugerir` devolve `{cc:""}` sem lançar (Task 2).
- **`conciliaSugerir` é read-only** → nenhum `INSERT/UPDATE fluxo` nem `fluxoSet` dentro dela (Task 2, assert de fonte).
- **Resposta da IA não-JSON/ruído** → `parseSugestaoCC` tolerante, não lança (Task 1).
- **Movimento já tem cc** → `conciliaSugerir` devolve vazio (não sugere por cima de um cc já atribuído) (Task 2).

---

### Task 1: Helpers puros `src/onda3c.mjs`

**Files:**
- Create: `src/onda3c.mjs`, `src/onda3c.d.mts`
- Test: `test/onda3c.test.mjs`

**Interfaces — Produces:**
- `montaPromptSugestaoCC(mov: {descricao,valor,data}, candidatos: Array<{cc,cliente,projeto}>, historico: Array<{descricao,cc}>): {system:string, user:string}`
- `parseSugestaoCC(textoIA: string, ccsValidos: string[]): {cc:string, confianca:number|"", motivo:string}`

- [ ] **Step 1: Teste que falha** (`test/onda3c.test.mjs`, importa `../src/onda3c.mjs`):
```js
test("parseSugestaoCC: cc fora da lista vira incerto, motivo preservado", () => {
  const r = parseSugestaoCC('{"cc":"9.9.9.9","confianca":0.8,"motivo":"parece X"}', ["1.2.3.4"]);
  assert.equal(r.cc, "");                 // alucinou → incerto
  assert.match(r.motivo, /parece X/);
});
test("parseSugestaoCC: cc válido passa com confiança", () => {
  const r = parseSugestaoCC('ruído {"cc":"1.2.3.4","confianca":0.9,"motivo":"ok"} fim', ["1.2.3.4","1.2.3.5"]);
  assert.equal(r.cc, "1.2.3.4");
  assert.equal(r.confianca, 0.9);
});
test("parseSugestaoCC: resposta sem JSON → incerto, não lança", () => {
  const r = parseSugestaoCC("não sei dizer", ["1.2.3.4"]);
  assert.equal(r.cc, "");
});
test("montaPromptSugestaoCC: inclui descrição, candidatos e a restrição", () => {
  const p = montaPromptSugestaoCC({descricao:"PIX FORNECEDOR ACME",valor:1200,data:"2026-10-20"}, [{cc:"1.2.3.4",cliente:"ACME",projeto:"ETE"}], [{descricao:"ACME parcela",cc:"1.2.3.4"}]);
  assert.match(p.user + p.system, /PIX FORNECEDOR ACME/);
  assert.match(p.user + p.system, /1\.2\.3\.4/);
  assert.match(p.system, /um dos|da lista|incerto|vazi/i); // instrução de restrição
});
```
- [ ] **Step 2: Rodar e ver falhar** — `node --test test/onda3c.test.mjs` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** `montaPromptSugestaoCC` e `parseSugestaoCC` em `src/onda3c.mjs` (+`.d.mts`). `parseSugestaoCC`: `txt.match(/\{[\s\S]*\}/)`; `JSON.parse` em try/catch (falha → `{cc:"",confianca:"",motivo:""}`); normaliza `confianca` a número 0–1 (ou ""); se `cc` não ∈ `ccsValidos` → `cc=""`. `montaPromptSugestaoCC`: `system` com a regra "responda só JSON {cc,confianca,motivo}; cc DEVE ser um dos CCs da lista ou vazio se incerto; não invente cc"; `user` com o movimento + a lista de candidatos (cc·cliente·projeto) + exemplos do histórico.
- [ ] **Step 4: Rodar e ver passar** — PASS.
- [ ] **Step 5: Commit** — `git -C C:/pideploy-onda3c add src/onda3c.mjs src/onda3c.d.mts test/onda3c.test.mjs && git -C C:/pideploy-onda3c commit -m "feat(onda3-C): helpers puros da sugestao de CC por IA"`

---

### Task 2: Ação read-only `conciliaSugerir` + flag

**Files:**
- Modify: `src/index.ts` — `FLAGS.conciliacao_ia`; import de `./onda3c.mjs`; ação `conciliaSugerir`; registrar no mapa de ações/capability.
- Test: `test/foundation.test.mjs`

**Interfaces — Consumes (Task 1):** `montaPromptSugestaoCC`, `parseSugestaoCC`. **Produces:** ação `conciliaSugerir({id})` → `{ok, cc, confianca, motivo}`.

- [ ] **Step 1: Teste que falha** (source asserts):
```js
test("Onda 3-C: acao conciliaSugerir read-only, atras da flag, reusa env.AI", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /from "\.\/onda3c\.mjs"/);
  assert.match(ts, /action === "conciliaSugerir"/);
  assert.match(ts, /conciliacao_ia/);
  // read-only: o corpo da acao nao grava fluxo nem chama fluxoSet
  const corpo = ts.slice(ts.indexOf('action === "conciliaSugerir"'), ts.indexOf('action === "conciliaSugerir"') + 1600);
  assert.doesNotMatch(corpo, /UPDATE fluxo|INSERT INTO fluxo|"fluxoSet"/);
});
```
- [ ] **Step 2: Rodar e ver falhar** → FAIL.
- [ ] **Step 3: Implementar** `FLAGS.conciliacao_ia = {desc:"...", def:false}`. Ação `conciliaSugerir`: `auth`; gate `isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.ver")`; carrega o `fluxo` por `id` (tenant) — se não achar ou já tiver `cc`, devolve `{ok:true, cc:"", motivo:"já tem CC ou inexistente"}`; checa `(await flagsAtivas(u.tenant_id)).conciliacao_ia` e `ENV.AI` — se OFF/ausente `{ok:true, cc:"", motivo:"IA indisponível"}`; monta candidatos (`SELECT cc, cliente, projeto FROM proj WHERE tenant_id=? AND registro='ATIVO'`) e histórico (`SELECT descricao, cc FROM fluxo WHERE tenant_id=? AND COALESCE(cc,'')<>'' ORDER BY criado DESC LIMIT 60`); `const {system,user} = montaPromptSugestaoCC(mov, candidatos, historico)`; `const r = await ENV.AI.run("@cf/meta/llama-3.1-8b-instruct", {messages:[{role:"system",content:system},{role:"user",content:user}], max_tokens:300, temperature:0.1})`; `const txt = String(r?.response ?? r?.result?.response ?? "")`; `const sug = parseSugestaoCC(txt, candidatos.map(c=>c.cc))`; `audit("conciliacao_ia", u.slug, id+" -> "+(sug.cc||"incerto"), ip)`; devolve `{ok:true, ...sug}`. **Nenhuma escrita em fluxo.**
- [ ] **Step 4: Rodar e ver passar** → `node --test` (suíte toda) + `npm run build:check`.
- [ ] **Step 5: Commit** — por path (`src/index.ts`, `test/foundation.test.mjs`).

---

### Task 3: Botão na fila de conciliação (casca clássica)

**Files:**
- Modify: `public/index.html` (na fila de conciliação: por linha, "Sugerir CC (IA)" → `conciliaSugerir`, mostra cc/confiança/motivo; "Aceitar" → `fluxoSet` com o cc).
- Test: `test/foundation.test.mjs` (source assert) + verificação manual em staging.

**Interfaces — Consumes (Task 2):** `conciliaSugerir({id})`; `fluxoSet` (já existe) para gravar o cc aceito.

- [ ] **Step 1: Teste que falha**:
```js
test("Onda 3-C: casca clássica tem sugerir+aceitar na conciliação", () => {
  const html = read("public/index.html");
  assert.match(html, /conciliaSugerir/);
  assert.match(html, /Sugerir CC/);
});
```
- [ ] **Step 2: Rodar e ver falhar** → FAIL.
- [ ] **Step 3: Implementar** na tela de conciliação: botão por linha chama `api("conciliaSugerir",{id})`; renderiza `cc` + `confianca` + `motivo` (ou "incerto"/"IA indisponível"); botão "Aceitar" chama `api("fluxoSet",{id, cc})` (o fluxoSet exige os campos próprios — reusar o caminho de edição já existente da linha, preenchendo só o cc) e recarrega a fila. Seguir os padrões `api()`/`toast()` do arquivo. Sem aceitar, nada muda.
- [ ] **Step 4: Rodar e ver passar** → `node --test`.
- [ ] **Step 5: Verificação em staging** (pós-deploy staging, logado): ligar `conciliacao_ia`, abrir a conciliação, pedir sugestão num movimento real; conferir que a sugestão só aparece (não grava) e que "Aceitar" grava o cc; conferir que um cc inventado nunca aparece (vem "incerto"); com a flag OFF, o botão some/retorna indisponível.
- [ ] **Step 6: Commit** — por path (`public/index.html`, `test/foundation.test.mjs`).

---

## Notas de verificação (fora dos testes estáticos)
- A qualidade da sugestão e o comportamento do `ENV.AI` só se veem com o Worker no ar — validar em staging (Task 3 Step 5); os testes estáticos provam o guard anti-invenção e o read-only, não a acurácia do modelo.
- Flag **OFF em produção** até a validação logada; ligar depois em Administração › Feature flags.
- Ao fim das tasks: revisão fresca do branch (executing-plans), corrigir Crítico/Importante, abrir **PR de `arquitetura/onda3-c` para `main`**; não mergear nem ligar flag (do dono).
