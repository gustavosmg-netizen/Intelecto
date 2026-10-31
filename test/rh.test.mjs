// RH — testes de COMPORTAMENTO do RCF e dos contratos/acordos (node --test, sem rede/D1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizaRcf, rcfVazio, cienciaEmDia, validaContrato, validaAcordo, contratoVigente, alertasRh } from "../src/rh.mjs";

test("normalizaRcf: estrutura do modelo da casa, níveis 1–3 e listas por linha", () => {
  const r = normalizaRcf({ status: "aprovado", revisao: "2026-04-27", missao: " Gestão de projetos ", indicadores: "Produtividade\n\nSLA",
    niveis: { jr: ["Ensaios", ""], pl: "Supervisionar\nCoordenar", sr: [] },
    conhecimentos: [{ item: "Excel", jr: 1, pl: "2", sr: 3 }, { item: "", jr: 1 }, { item: "CNH", jr: "-", pl: "9", sr: "2" }],
    exigencias: { educacao: "Engenharia" }, hack: 1 });
  assert.equal(r.status, "aprovado");
  assert.equal(r.missao, "Gestão de projetos");
  assert.deepEqual(r.indicadores, ["Produtividade", "SLA"]);
  assert.deepEqual(r.niveis, { jr: ["Ensaios"], pl: ["Supervisionar", "Coordenar"], sr: [] });
  assert.deepEqual(r.conhecimentos, [{ item: "Excel", jr: "1", pl: "2", sr: "3" }, { item: "CNH", jr: "-", pl: "-", sr: "2" }]);
  assert.equal(r.exigencias.educacao, "Engenharia");
  assert.equal(normalizaRcf({ status: "x" }).status, "rascunho");
  assert.equal(rcfVazio({ status: "aprovado", revisao: "2026-01-01" }), true);
  assert.equal(rcfVazio({ missao: "x" }), false);
});

test("cienciaEmDia: vale só para a revisão vigente do RCF", () => {
  assert.equal(cienciaEmDia({ revisao: "2026-04-27" }, [{ revisao: "2026-04-27" }]), true);
  assert.equal(cienciaEmDia({ revisao: "2026-10-30" }, [{ revisao: "2026-04-27" }]), false);
  assert.equal(cienciaEmDia({ revisao: "2026-10-30" }, []), false);
});

test("validaContrato: tipo fechado, datas coerentes, carga 0–60 h, link https, sem valor", () => {
  const c = validaContrato({ tipo: "PJ", inicio: "2026-11-01", carga_semanal: "40", doc_url: "https://drive.google.com/x", salario: 9999 });
  assert.deepEqual(c, { tipo: "PJ", inicio: "2026-11-01", fim: "", renovacao_auto: 0, carga_semanal: 40, doc_url: "https://drive.google.com/x", obs: "" });
  assert.equal("salario" in c, false);
  assert.throws(() => validaContrato({ tipo: "Freela", inicio: "2026-01-01" }), /Tipo/);
  assert.throws(() => validaContrato({ tipo: "CLT" }), /início/);
  assert.throws(() => validaContrato({ tipo: "CLT", inicio: "2026-05-01", fim: "2026-04-01" }), /antes/);
  assert.throws(() => validaContrato({ tipo: "CLT", inicio: "2026-05-01", carga_semanal: 70 }), /60/);
  assert.throws(() => validaContrato({ tipo: "CLT", inicio: "2026-05-01", doc_url: "javascript:alert(1)" }), /https/);
});

test("validaAcordo: tipo, descrição e vigência", () => {
  assert.equal(validaAcordo({ tipo: "Home office", descricao: "Sextas em casa", inicio: "2026-11-01" }).tipo, "Home office");
  assert.throws(() => validaAcordo({ tipo: "Home office", descricao: "", inicio: "2026-11-01" }), /Descreva/);
  assert.throws(() => validaAcordo({ tipo: "X", descricao: "abc", inicio: "2026-11-01" }), /Tipo/);
});

test("contratoVigente: o mais recente que já começou e não terminou", () => {
  const cs = [{ id: "a", inicio: "2025-01-01", fim: "2026-10-31" }, { id: "b", inicio: "2026-11-01" }];
  assert.equal(contratoVigente(cs, "2026-10-30").id, "a");
  assert.equal(contratoVigente(cs, "2026-11-02").id, "b");
  assert.equal(contratoVigente(cs, "2024-12-01"), null);
});

test("alertasRh: vencido, ≤15 crítico, ≤30 atenção; renovação automática não alerta; estágio perto de 2 anos", () => {
  const hoje = "2026-10-30";
  const a = alertasRh([
    { id: "c1", slug: "x", tipo: "PJ", inicio: "2026-01-01", fim: "2026-10-20" },
    { id: "c2", slug: "y", tipo: "CLT", inicio: "2026-01-01", fim: "2026-11-10" },
    { id: "c3", slug: "z", tipo: "PJ", inicio: "2026-01-01", fim: "2026-11-25" },
    { id: "c4", slug: "w", tipo: "PJ", inicio: "2026-01-01", fim: "2026-11-05", renovacao_auto: 1 },
    { id: "c5", slug: "e", tipo: "Estágio", inicio: "2024-12-01", fim: "" },
  ], [{ id: "a1", slug: "x", tipo: "Home office", inicio: "2026-01-01", fim: "2026-11-01" }], hoje);
  const r = a.map((x) => x.id + ":" + x.nivel);
  assert.deepEqual(r, ["c1:vencido", "a1:critico", "c2:critico", "c3:atencao", "c5:atencao"]); // por nível, depois pelos dias que faltam
  assert.equal(a.find((x) => x.id === "c5").tipo, "Estágio (limite de 2 anos)");
});

// ---------- Conteúdo inicial e fiação (asserts) ----------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { RCF_SEED } from "../src/rcf_seed.mjs";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = readFileSync(join(root, "src/index.ts"), "utf8");

test("RCF_SEED: os 3 da casa aprovados com a revisão do documento; demais em rascunho; tudo válido", () => {
  assert.equal(normalizaRcf(RCF_SEED.engenheiro_jr).status, "aprovado");
  assert.equal(normalizaRcf(RCF_SEED.engenheiro_jr).revisao, "2025-02-21");
  assert.equal(normalizaRcf(RCF_SEED.analista).revisao, "2026-04-27");
  assert.equal(normalizaRcf(RCF_SEED.estagiario).revisao, "2026-04-27");
  for (const cid of ["tecnico_lab", "eletricista", "montagem", "coord_tecnica", "coord_comercial", "coord_financeira", "coord_adm_rh", "coord_juridica", "socios"])
    assert.equal(normalizaRcf(RCF_SEED[cid]).status, "rascunho", cid);
  for (const [cid, r] of Object.entries(RCF_SEED)) {
    const n = normalizaRcf(r);
    assert.ok(n.missao.length > 40, cid + " sem missão");
    assert.ok(n.soft.length >= 10, cid + " sem soft skills");
    assert.ok(n.niveis.pl.length > 0 || n.niveis.jr.length > 0, cid + " sem responsabilidades");
    assert.equal(JSON.stringify(normalizaRcf(n)), JSON.stringify(n), cid + " não é estável na normalização");
  }
  // RCF não carrega valor monetário
  assert.doesNotMatch(JSON.stringify(RCF_SEED), /R\$\s*\d/);
});

test("Worker: seed só preenche cargo sem RCF; ciência só de ocupante em RCF aprovado; contratos sem valor alimentam a capacidade", () => {
  assert.match(ts, /UPDATE rh_cargo SET rcf = \? WHERE tenant_id = \? AND cid = \? AND COALESCE\(rcf,''\) = ''/);
  assert.match(ts, /Este RCF ainda está em rascunho; a ciência abre quando o RH aprovar\./);
  assert.match(ts, /Você não ocupa este cargo\./);
  assert.match(ts, /Só o RH ou a Coordenação editam o RCF\./);
  assert.match(ts, /INSERT INTO capacidade_vig \(tenant_id, slug, desde, horas_semana, u, criado\) VALUES \(\?,\?,\?,\?,\?,\?\) ON CONFLICT\(tenant_id, slug, desde\)/);
  assert.doesNotMatch(ts.slice(ts.indexOf("CREATE TABLE IF NOT EXISTS rh_contrato"), ts.indexOf("CREATE TABLE IF NOT EXISTS rh_acordo")), /valor|salario/);
  for (const a of ["rcfGet", "rcfMeu", "rcfCiencia", "rcfSet", "rhContratos", "rhContratoSet", "rhContratoDel", "rhAcordoSet", "rhAcordoDel"]) assert.match(ts, new RegExp("\\b" + a + ': "equipe"'), a);
});
