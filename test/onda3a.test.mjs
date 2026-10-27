// Onda 3 · Sub-projeto A — testes de COMPORTAMENTO dos helpers puros (node --test, sem rede/D1).
// Os helpers vivem em src/onda3a.mjs (ESM puro), importados pelo Worker (src/index.ts) e por aqui.
import { test } from "node:test";
import assert from "node:assert/strict";
import { planoProporProjeto, decideBloqueioHoras, regrasExtra } from "../src/onda3a.mjs";

const base = {
  cc: "1.2.3.4", valor: 1000, status: "confirmado", titulo: "ETE X",
  contratoId: "CT1", tenant: "intelecto", now: "2026-10-27T00:00:00Z", parcelaId: "P1",
};

// ---------- Task 1: planoProporProjeto ----------
test("planoProporProjeto: flag off => vazio", () => {
  assert.deepEqual(planoProporProjeto(base, { flagOn: false, temParcela: false }), []);
});

test("planoProporProjeto: status != confirmado ou valor<=0 => vazio", () => {
  assert.equal(planoProporProjeto({ ...base, status: "rascunho" }, { flagOn: true, temParcela: false }).length, 0);
  assert.equal(planoProporProjeto({ ...base, valor: 0 }, { flagOn: true, temParcela: false }).length, 0);
});

test("planoProporProjeto: confirmado+flag => proj PROPOSTO idempotente, projx sem contratado, parcela", () => {
  const s = planoProporProjeto(base, { flagOn: true, temParcela: false });
  const proj = s.find((x) => /INSERT INTO proj\b/.test(x.sql));
  assert.ok(proj, "deve ter INSERT proj");
  assert.match(proj.sql, /ON CONFLICT\(cc\) DO NOTHING/);
  assert.match(proj.sql, /PROPOSTO/);
  assert.ok(proj.args.includes("1.2.3.4"));
  const projx = s.find((x) => /INSERT INTO projx\b/.test(x.sql));
  assert.ok(projx && !/contratado/.test(projx.sql), "projx NAO regrava contratado (valor e do contrato)");
  assert.ok(s.some((x) => /INSERT INTO contrato_parcela/.test(x.sql)), "cria parcela inicial");
});

test("planoProporProjeto: parcela ja existe => sem parcela nova", () => {
  const s = planoProporProjeto(base, { flagOn: true, temParcela: true });
  assert.ok(!s.some((x) => /contrato_parcela/.test(x.sql)), "nao recria parcela");
});

// ---------- Task 2: decideBloqueioHoras ----------
test("decideBloqueioHoras: encerrado bloqueia sem forcar", () => {
  assert.equal(decideBloqueioHoras("CONCLUÍDO", { forcar: false, podeAprovar: true }).bloqueia, true);
});
test("decideBloqueioHoras: encerrado + forcar + podeAprovar libera", () => {
  assert.equal(decideBloqueioHoras("CANCELADO", { forcar: true, podeAprovar: true }).bloqueia, false);
});
test("decideBloqueioHoras: forcar sem capability NAO libera", () => {
  assert.equal(decideBloqueioHoras("CONCLUÍDO", { forcar: true, podeAprovar: false }).bloqueia, true);
});
test("decideBloqueioHoras: projeto ativo nunca bloqueia", () => {
  assert.equal(decideBloqueioHoras("EM ANDAMENTO", { forcar: false, podeAprovar: false }).bloqueia, false);
});

// ---------- Task 3: regrasExtra (novas regras do Painel; C1 preservada é assert de fonte) ----------
test("regrasExtra: C17 (contrato sem projeto) e C18 (PROPOSTO parado), parametrizadas por tenant", () => {
  const rs = regrasExtra("intelecto");
  const c17 = rs.find((r) => r.rule === "C17");
  const c18 = rs.find((r) => r.rule === "C18");
  assert.ok(c17 && /projeto/i.test(c17.titulo) && /cc_contrato/.test(c17.sql) && c17.sql.includes("NOT EXISTS"));
  assert.ok(c18 && /PROPOSTO/.test(c18.sql));
  assert.ok(c17.args.includes("intelecto") && c18.args.includes("intelecto"));
});
