# Onda 3 · Sub-projeto A — Contrato abre projeto · Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando um contrato vira `confirmado`, o portal propõe sozinho o projeto (PROPOSTO) e as parcelas a partir do contrato, sem redigitação; e lançar hora em projeto encerrado passa a bloquear com exceção auditada da Coordenação.

**Architecture:** Tudo síncrono em D1 dentro das ações existentes (`contratoSet`, `add`/`edit` de horas, `consistencia`), sem Queues/outbox (boring-by-default). A lógica decisória sai para helpers **puros** (sem D1) para caber na suíte estática `node --test`; as ações só montam args e rodam os statements. Idempotência por `ON CONFLICT(cc) DO NOTHING` (proj/projx) e por checagem de existência (parcela).

**Tech Stack:** Cloudflare Workers + Hono + D1 (SQLite), TypeScript (`src/index.ts`), testes `node --test` em `test/foundation.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-27-onda3-a-contrato-abre-projeto-design.md`

## Global Constraints

- Checkout **compartilhado** (worktree em C:\pideploy-arq): **commitar sempre por path**, NUNCA `git add -A`/`git commit -a`.
- Flag `contrato_abre_projeto` nasce **OFF** (def:false). Flag ausente = OFF → **sem bump de SCHEMA_VER** (não há seed).
- **Sem mudança do contrato de /api** (só parâmetro opcional novo `forcar` em add/edit, retrocompatível) → **não** bumpar `API_VER`.
- `proj.registro` da proposta = `'PROPOSTO'`; valores válidos de registro no código: `PROPOSTO | ATIVO | REJEITADO`.
- "Contrato assinado" no código = `cc_contrato.status = 'confirmado'`.
- O **valor** é do contrato (via `valorContratadoMap`); `projx.contratado` é fallback de migração — **não** regravar no gatilho.
- Capability da aprovação e da exceção: `projetos.aprovar` (`temCapSet(caps, "projetos.aprovar")`).

## Review Focus

- **Contrato confirmado com `cc` já tendo projeto ATIVO** → o gatilho NÃO pode duplicar nem rebaixar o ATIVO (test no Task 1: ON CONFLICT DO NOTHING; plano retorna stmts, DB ignora o insert).
- **`forcar=true` enviado por quem não tem `projetos.aprovar`** → continua bloqueado (test no Task 2).
- **Contrato confirmado sem `cc` ou `valor<=0`** → gatilho não dispara (test no Task 1: `planoProporProjeto` devolve []).
- **Parcela já existe para o contrato** → não criar uma segunda (test no Task 1: stmt de parcela sai do plano quando `temParcela=true`).
- **Flag desligada depois de propostas criadas** → nada é limpo; PROPOSTO existentes seguem para aprovação manual (test no Task 1: flag off ⇒ plano vazio; sem efeito retroativo — nota de verificação em staging).

---

### Task 1: Gatilho — contrato confirmado propõe projeto (PROPOSTO)

**Files:**
- Modify: `src/index.ts` — registro `FLAGS` (~314); helper puro novo `planoProporProjeto` (perto de `valorContratadoMap`, ~1728); fiação no fim de `contratoSet` (~3609, após o `audit`).
- Test: `test/foundation.test.mjs`

**Interfaces:**
- Produces: `planoProporProjeto(c: { cc: string; valor: number; status: string; titulo: string; id: string }, flagOn: boolean, temParcela: boolean): Array<{ sql: string; args: any[] }>` — devolve `[]` quando não deve disparar; senão os statements (proj PROPOSTO, projx vazio, parcela inicial se `!temParcela`).

- [ ] **Step 1: Escrever o teste que falha** em `test/foundation.test.mjs`:
```js
test("planoProporProjeto: flag off => vazio", () => {
  assert.deepEqual(planoProporProjeto({cc:"1.2.3.4",valor:1000,status:"confirmado",titulo:"X",id:"CT1"}, false, false), []);
});
test("planoProporProjeto: status rascunho ou valor<=0 => vazio", () => {
  assert.equal(planoProporProjeto({cc:"1.2.3.4",valor:1000,status:"rascunho",titulo:"X",id:"CT1"}, true, false).length, 0);
  assert.equal(planoProporProjeto({cc:"1.2.3.4",valor:0,status:"confirmado",titulo:"X",id:"CT1"}, true, false).length, 0);
});
test("planoProporProjeto: confirmado+flag => proj PROPOSTO idempotente + projx sem contratado + parcela", () => {
  const s = planoProporProjeto({cc:"1.2.3.4",valor:1000,status:"confirmado",titulo:"ETE X",id:"CT1"}, true, false);
  const proj = s.find(x => /INSERT INTO proj\b/.test(x.sql));
  assert.match(proj.sql, /ON CONFLICT\(cc\) DO NOTHING/);
  assert.ok(proj.args.includes("PROPOSTO"));
  const projx = s.find(x => /INSERT INTO projx\b/.test(x.sql));
  assert.ok(projx && !/contratado/.test(projx.sql));      // valor é do contrato, não se duplica
  assert.ok(s.some(x => /INSERT INTO contrato_parcela/.test(x.sql)));
});
test("planoProporProjeto: parcela já existe => não recria parcela", () => {
  const s = planoProporProjeto({cc:"1.2.3.4",valor:1000,status:"confirmado",titulo:"X",id:"CT1"}, true, true);
  assert.ok(!s.some(x => /contrato_parcela/.test(x.sql)));
});
```

- [ ] **Step 2: Rodar e ver falhar** — `node --test test/foundation.test.mjs` → FAIL (`planoProporProjeto is not defined`). O runner precisa enxergar o helper (exportar como os demais helpers testados, seguindo o padrão atual do arquivo de teste).

- [ ] **Step 3: Implementar `planoProporProjeto`** em `src/index.ts`. Guard inicial: retorna `[]` se `!flagOn || c.status!=="confirmado" || !c.cc || c.valor<=0`. Senão monta: `INSERT INTO proj (cc,projeto,status,registro,alterado_por,alterado_em,tenant_id) VALUES (?,?, 'A INICIAR','PROPOSTO','contrato',?,?) ON CONFLICT(cc) DO NOTHING` (tenant/now vêm do chamador via args); `INSERT INTO projx (cc,u) VALUES (?, 'contrato') ON CONFLICT(cc) DO NOTHING`; e, se `!temParcela`, `INSERT INTO contrato_parcela (id,tenant_id,contrato_id,cc,numero,valor,venc_prev,status,obs,criado,u) VALUES (?,?,?,?,1,?, '', 'prevista','', ?, 'contrato')`. O chamador preenche tenant_id/now/ids. (Mantém `projx` sem `contratado` — Global Constraints.)

- [ ] **Step 4: Rodar e ver passar** — `node --test test/foundation.test.mjs` → PASS.

- [ ] **Step 5: Adicionar a flag e fiar no `contratoSet`.** Em `FLAGS` (~314) acrescentar `contrato_abre_projeto: { desc: "Contrato confirmado abre o projeto (PROPOSTO) e as parcelas automaticamente.", def: false }`. No fim de `contratoSet` (após o `audit` da linha ~3609, antes do `return`): checar `temParcela` (`SELECT 1 FROM contrato_parcela WHERE contrato_id=? AND tenant_id=?`), chamar `planoProporProjeto({cc,valor,status,titulo,id}, (await flagsAtivas(u.tenant_id)).contrato_abre_projeto, temParcela)`, rodar cada stmt com os args completados (tenant_id, now, ids via `crypto.randomUUID()`/padrão do arquivo), e, se o plano não for vazio, `await audit("projeto_proposto_de_contrato", u.slug, cc + " <- " + id, ip)`. Tudo dentro do try da ação (o `ON CONFLICT` garante idempotência).

- [ ] **Step 6: Build check** — `npm run build:check` (dry-run do wrangler) → sem erro de tipo.

- [ ] **Step 7: Commit** (por path):
```bash
git -C /c/pideploy-arq add src/index.ts test/foundation.test.mjs
git -C /c/pideploy-arq commit -m "feat(onda3-A): contrato confirmado propoe projeto PROPOSTO (flag contrato_abre_projeto, idempotente)"
```

---

### Task 2: Guard de horas — exceção auditada da Coordenação + sugestão de CC

**Files:**
- Modify: `src/index.ts` — `bloqueiaSeFechado` (~1699) e os 2 call sites no `add` (~5205) e `edit` (~5229).
- Test: `test/foundation.test.mjs`

**Interfaces:**
- Produces: `decideBloqueioHoras(status: string, opts: { forcar: boolean; podeAprovar: boolean }): { bloqueia: boolean }` — pura.
- Consumes (Task 1): nada.

- [ ] **Step 1: Teste que falha**:
```js
test("decideBloqueioHoras: encerrado bloqueia sem forcar", () => {
  assert.equal(decideBloqueioHoras("CONCLUÍDO", {forcar:false,podeAprovar:true}).bloqueia, true);
});
test("decideBloqueioHoras: encerrado + forcar + podeAprovar libera", () => {
  assert.equal(decideBloqueioHoras("CANCELADO", {forcar:true,podeAprovar:true}).bloqueia, false);
});
test("decideBloqueioHoras: forcar sem capability NAO libera", () => {
  assert.equal(decideBloqueioHoras("CONCLUÍDO", {forcar:true,podeAprovar:false}).bloqueia, true);
});
test("decideBloqueioHoras: projeto ativo nunca bloqueia", () => {
  assert.equal(decideBloqueioHoras("EM ANDAMENTO", {forcar:false,podeAprovar:false}).bloqueia, false);
});
```

- [ ] **Step 2: Rodar e ver falhar** — FAIL (`decideBloqueioHoras is not defined`).

- [ ] **Step 3: Implementar `decideBloqueioHoras`** (pura): `const enc = /CONCLU|CANCEL/.test(status.toUpperCase()); return { bloqueia: enc && !(opts.forcar && opts.podeAprovar) };`

- [ ] **Step 4: Rodar e ver passar** — PASS.

- [ ] **Step 5: Religar `bloqueiaSeFechado`** para usar o helper. Nova assinatura `bloqueiaSeFechado(cc, tenant, opts: { forcar?: boolean; podeAprovar?: boolean } = {})`. Lê o status (como hoje); se `decideBloqueioHoras(st, {forcar:!!opts.forcar, podeAprovar:!!opts.podeAprovar}).bloqueia`, monta a mensagem **com sugestão**: consulta `SELECT cc, projeto FROM proj WHERE tenant_id=? AND registro='ATIVO' AND cliente = (SELECT cliente FROM proj WHERE cc=? AND tenant_id=?)` (ou o join de cliente usado no arquivo), e `throw new Error("Projeto " + st.toLowerCase() + " não recebe horas. CCs ativos do mesmo cliente: " + lista + ". A Coordenação pode lançar retroativo com 'forçar'.")`. Quando não bloqueia por exceção, **não** lança.

- [ ] **Step 6: Call sites (`add` ~5205, `edit` ~5229)** — calcular `const caps = await capsDe({slug:u.slug,papel:u.papel}); const podeAprovar = temCapSet(caps,"projetos.aprovar");` e chamar `await bloqueiaSeFechado(e.cc, u.tenant_id, { forcar: p.forcar===true, podeAprovar });`. Se passou por exceção (encerrado + forcar + podeAprovar), `await audit("hora_retroativa_forcada", u.slug, e.cc, ip)`. (Checar se `caps` já existe no escopo para não recomputar.)

- [ ] **Step 7: Build check** — `npm run build:check` → ok.

- [ ] **Step 8: Commit**:
```bash
git -C /c/pideploy-arq add src/index.ts test/foundation.test.mjs
git -C /c/pideploy-arq commit -m "feat(onda3-A): guard de hora em projeto encerrado com excecao auditada da coordenacao + sugestao de CC"
```

---

### Task 3: Painel de Consistência — contrato sem projeto + PROPOSTO parado

**Files:**
- Modify: `src/index.ts` — extrair o array `regras` da ação `consistencia` (~5441) para a função `regrasConsistencia(T)` e acrescentar C17/C18.
- Test: `test/foundation.test.mjs`

**Interfaces:**
- Produces: `regrasConsistencia(T: string): Array<{ rule: string; titulo: string; sev: string; dono: string; atalho: string; sql: string; args: any[] }>`.

- [ ] **Step 1: Teste que falha**:
```js
test("regrasConsistencia: inclui C17 (contrato sem projeto) e C18 (PROPOSTO parado)", () => {
  const rs = regrasConsistencia("intelecto");
  const c17 = rs.find(r => r.rule === "C17"); const c18 = rs.find(r => r.rule === "C18");
  assert.ok(c17 && /projeto/i.test(c17.titulo) && /cc_contrato/.test(c17.sql) && c17.sql.includes("NOT EXISTS"));
  assert.ok(c18 && /PROPOSTO/.test(c18.sql));
  assert.ok(rs.find(r => r.rule === "C1")); // regras antigas preservadas
});
```

- [ ] **Step 2: Rodar e ver falhar** — FAIL (`regrasConsistencia is not defined`).

- [ ] **Step 3: Extrair e acrescentar.** Mover o array literal para `function regrasConsistencia(T){ return [ ...as atuais... , C17, C18 ]; }`; a ação `consistencia` passa a `const regras = regrasConsistencia(T);`. C17 = `{ rule:"C17", titulo:"Contrato confirmado sem projeto", sev:"alto", dono:"Coordenação", atalho:"Projeto 360 › Visão", sql:"SELECT COUNT(*) n FROM (SELECT DISTINCT cc,tenant_id FROM cc_contrato WHERE status='confirmado') c WHERE c.tenant_id=? AND NOT EXISTS (SELECT 1 FROM proj p WHERE p.cc=c.cc AND p.tenant_id=c.tenant_id)", args:[T] }`. C18 = `{ rule:"C18", titulo:"Projeto PROPOSTO aguardando aprovação há >7 dias", sev:"medio", dono:"Coordenação", atalho:"Projetos › Propostas", sql:"SELECT COUNT(*) n FROM proj WHERE tenant_id=? AND registro='PROPOSTO' AND alterado_em < datetime('now','-7 day')", args:[T] }`.

- [ ] **Step 4: Rodar e ver passar** — PASS (inclui o check de que C1 segue presente).

- [ ] **Step 5: Build check** — `npm run build:check` → ok.

- [ ] **Step 6: Commit**:
```bash
git -C /c/pideploy-arq add src/index.ts test/foundation.test.mjs
git -C /c/pideploy-arq commit -m "feat(onda3-A): regras C17/C18 do Painel (contrato sem projeto; PROPOSTO parado)"
```

---

### Task 4: Afordância na UI clássica (mínima)

**Files:**
- Modify: o arquivo da UI clássica (bundle único de front servido pelo Worker — localizar o formulário de lançamento de horas e o aviso de bloqueio).
- Test: manual em staging (a UI clássica não tem suíte estática).

**Interfaces:**
- Consumes (Task 2): a ação `add`/`edit` aceita `forcar:true`; o erro de bloqueio traz a sugestão de CC no texto.

- [ ] **Step 1:** Ao receber erro de bloqueio no lançamento, mostrar a mensagem (já traz os CCs sugeridos) e, **se o usuário tem `projetos.aprovar`**, exibir um checkbox "Forçar (lançamento retroativo da Coordenação)" que reenvia a ação com `forcar:true`.
- [ ] **Step 2:** No menu de projetos, garantir que a fila `projpropostas` (projetos PROPOSTO) esteja acessível a quem aprova (link/aba) — reusar a ação existente; só expor se ainda não exposta.
- [ ] **Step 3: Verificação em staging** — deploy `--env staging`, popular com `popula_staging.py`, logar como coordenação de teste: confirmar um contrato com a flag ON cria PROPOSTO; aprovar vira ATIVO; lançar hora em CC concluído bloqueia e o "forçar" libera com auditoria.
- [ ] **Step 4: Commit** (por path, só os arquivos de front tocados).

---

## Notas de verificação (fora dos testes estáticos)
- Idempotência real (confirmar 2×, duplo-clique) e o `ON CONFLICT` só se provam contra D1 — validar em staging (Task 4 Step 3).
- Flag fica **OFF em produção** até a validação logada; ligar depois pela Administração › Feature flags (dono + reauth), reversível.
- Nada de deploy em produção neste plano; a frente onda0 entra por PR como as demais.
