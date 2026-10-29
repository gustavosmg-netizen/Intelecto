// CRM — testes de COMPORTAMENTO da lógica pura (node --test, sem rede/D1).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  faseDeSt, rotuloSt, destinoMovimento, validaTag, normalizaFiltro, filtroVazio, aplicaFiltro,
  validaAtividade, proximosPassos,
} from "../src/crm.mjs";

test("faseDeSt/rotuloSt: 21 subetapas em 6 fases; 0 fica fora do funil", () => {
  assert.equal(faseDeSt(0), null);
  assert.equal(faseDeSt(1), "prosp");
  assert.equal(faseDeSt(12), "prop");
  assert.equal(faseDeSt(21), "pos");
  assert.equal(faseDeSt(22), null);
  assert.equal(rotuloSt(10), "Proposta · 2/4");
  assert.equal(rotuloSt(0), "Fora do funil");
});

test("destinoMovimento: soltar na fase mantém a subetapa se já está nela; senão vai à 1ª", () => {
  assert.equal(destinoMovimento(10, "fase:prop"), 10);
  assert.equal(destinoMovimento(3, "fase:prop"), 9);
  assert.equal(destinoMovimento(15, "fase:prosp"), 1); // regressão explícita é permitida
  assert.equal(destinoMovimento(3, "st:7"), 7);
  assert.equal(destinoMovimento(3, "st:99"), 3); // inválido não move
  assert.equal(destinoMovimento(3, "fase:xx"), 3);
  assert.equal(destinoMovimento(3, "lixo"), 3);
});

test("validaTag: nome obrigatório e curto; cor fora da paleta vira cinza", () => {
  assert.deepEqual(validaTag("  Vale   urgente ", "vermelho"), { nome: "Vale urgente", cor: "vermelho" });
  assert.equal(validaTag("x", "red;background:url(x)").cor, "cinza");
  assert.throws(() => validaTag("   ", "verde"), /nome/);
  assert.throws(() => validaTag("a".repeat(31), "verde"), /30/);
});

test("normalizaFiltro: descarta chave desconhecida, fase inválida e prazo inválido", () => {
  const n = normalizaFiltro({ q: " ete ", fases: ["prop", "xx"], prazo: "ontem", hack: 1, tags: ["T1", "", null] });
  assert.deepEqual(n, { q: "ete", owners: [], fases: ["prop"], tags: ["T1"], temp: [], pri: [], prazo: "" });
  assert.equal(filtroVazio({}), true);
  assert.equal(filtroVazio({ q: "x" }), false);
  assert.equal(normalizaFiltro(null).q, "");
});

const DEALS = [
  { id: "A", st: 2, co: "Mineração São João", owner: "marcelo", temp: "Quente", pri: "Alta", city: "Itabira" },
  { id: "B", st: 10, co: "Prefeitura de Mariana", owner: "gustavo", temp: "Morno", pri: "Média", city: "Mariana" },
  { id: "C", st: 11, co: "Vale ETE Brucutu", owner: "marcelo", temp: "Quente", pri: "Baixa", city: "São Gonçalo" },
];
const CTX = {
  hoje: "2026-10-29",
  dealTags: { A: ["T1"], C: ["T1", "T2"] },
  prox: { A: { prazo: "2026-10-20" }, B: { prazo: "2026-11-03" } },
};
const ids = (r) => r.map((d) => d.id).join(",");

test("aplicaFiltro: busca sem acento e por várias palavras", () => {
  assert.equal(ids(aplicaFiltro(DEALS, { q: "sao joao" }, CTX)), "A");
  assert.equal(ids(aplicaFiltro(DEALS, { q: "ete vale" }, CTX)), "C");
  assert.equal(ids(aplicaFiltro(DEALS, {}, CTX)), "A,B,C");
});

test("aplicaFiltro: E entre campos, OU dentro do campo, tags exigem todas", () => {
  assert.equal(ids(aplicaFiltro(DEALS, { owners: ["marcelo"], fases: ["prop"] }, CTX)), "C");
  assert.equal(ids(aplicaFiltro(DEALS, { fases: ["prosp", "prop"] }, CTX)), "A,B,C");
  assert.equal(ids(aplicaFiltro(DEALS, { tags: ["T1"] }, CTX)), "A,C");
  assert.equal(ids(aplicaFiltro(DEALS, { tags: ["T1", "T2"] }, CTX)), "C");
  assert.equal(ids(aplicaFiltro(DEALS, { temp: ["Quente"], pri: ["Alta"] }, CTX)), "A");
});

test("aplicaFiltro: prazo do próximo passo (atrasado, 7 dias, sem próximo passo)", () => {
  assert.equal(ids(aplicaFiltro(DEALS, { prazo: "atrasado" }, CTX)), "A");
  assert.equal(ids(aplicaFiltro(DEALS, { prazo: "semana" }, CTX)), "B");
  assert.equal(ids(aplicaFiltro(DEALS, { prazo: "sem" }, CTX)), "C");
});

test("validaAtividade: tipo fechado, texto obrigatório, tarefa exige prazo", () => {
  assert.deepEqual(validaAtividade({ tipo: "ligacao", texto: "Falei com o gerente", data: "2026-10-29" }),
    { tipo: "ligacao", texto: "Falei com o gerente", data: "2026-10-29", prazo: "", resp: "" });
  assert.throws(() => validaAtividade({ tipo: "etapa", texto: "forjado" }), /Tipo/);
  assert.throws(() => validaAtividade({ tipo: "nota", texto: " " }), /Descreva/);
  assert.throws(() => validaAtividade({ tipo: "tarefa", texto: "Enviar proposta" }), /prazo/);
  assert.equal(validaAtividade({ tipo: "tarefa", texto: "Enviar proposta", prazo: "2026-11-02", resp: "marcelo" }).prazo, "2026-11-02");
});

test("proximosPassos: tarefa aberta de prazo mais cedo por negócio; feita não conta", () => {
  const p = proximosPassos([
    { id: "1", deal_id: "A", tipo: "tarefa", feito: 0, prazo: "2026-11-05", texto: "b" },
    { id: "2", deal_id: "A", tipo: "tarefa", feito: 0, prazo: "2026-11-01", texto: "a", resp: "marcelo" },
    { id: "3", deal_id: "A", tipo: "tarefa", feito: 1, prazo: "2026-10-01", texto: "feita" },
    { id: "4", deal_id: "B", tipo: "nota", feito: 0, prazo: "", texto: "nota" },
  ]);
  assert.deepEqual(p, { A: { id: "2", prazo: "2026-11-01", texto: "a", resp: "marcelo" } });
});

// ---------- Fiação no Worker (asserts de fonte) ----------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = readFileSync(join(root, "src/index.ts"), "utf8");
const bloco = (ini, fim) => ts.slice(ts.indexOf(ini), ts.indexOf(fim, ts.indexOf(ini) + 1));

test("Worker: ações novas do CRM têm piso no MIN (negar por omissão)", () => {
  for (const a of ["crmTagSet", "crmTagDel", "crmDealTag", "crmAtividades", "crmAtividadeSet", "crmAtividadeFeita", "crmAtividadeDel", "filtroList", "filtroSet", "filtroDel"])
    assert.match(ts, new RegExp("\\b" + a + ': "equipe"'), a);
});

test("Worker: tags e filtros são POR PESSOA (toda query filtra o slug de quem chama)", () => {
  const crm = bloco('if (action === "crmTagSet")', 'if (action === "crmAtividades")');
  for (const q of crm.match(/"(SELECT|UPDATE|DELETE|INSERT)[^"]*crm_(deal_)?tag[^"]*"/g) || [])
    assert.match(q, /slug/, q);
  const fil = bloco('if (action === "filtroList" || action === "filtroSet"', 'const now = new Date().toISOString();');
  for (const q of fil.match(/"(SELECT|UPDATE|DELETE)[^"]*filtro_salvo[^"]*"/g) || []) assert.match(q, /slug = \?/, q);
  // a resposta do `crm` traz só as tags/marcações de quem consulta
  assert.match(ts, /FROM crm_tag WHERE tenant_id = \? AND slug = \? ORDER BY nome/);
  assert.match(ts, /FROM crm_deal_tag WHERE tenant_id = \? AND slug = \?"/);
});

test("Worker: filtro salvo só para módulo conhecido que a pessoa enxerga", () => {
  const f = bloco("async function podeFiltroModulo", "\n}\n");
  assert.match(f, /modulo === "crm"/);
  assert.match(f, /modulo === "financeiro"/);
  assert.match(f, /return false;/);
});

test("Worker: mover etapa deixa rastro no histórico e usa a mesma regra pura da UI", () => {
  const b = bloco('if (action === "crmDealStage")', 'if (action === "crmLeadAprovar")');
  assert.match(b, /destinoMovimento\(stAntes/);
  assert.match(b, /INSERT INTO crm_atividade[^"]*'etapa'/);
  // o wrapper sqlite devolve rowsAffected; `r.meta` é sempre undefined (o rastro nunca gravaria)
  assert.doesNotMatch(b, /r\.meta/);
  assert.match(b, /if \(!r\.rowsAffected\)/);
});

test("Worker: nenhuma ação nova checa linhas afetadas por `r.meta` (sempre undefined no wrapper)", () => {
  const novas = bloco("/* ===== CRM na casca nova", "const now = new Date().toISOString();");
  assert.ok(novas.length > 1000);
  assert.doesNotMatch(novas, /\.meta\b/);
});

test("Worker: schema novo com bump de SCHEMA_VER e migração própria", () => {
  assert.match(ts, /const SCHEMA_VER = "2026-10-29b";/);
  const mig = readFileSync(join(root, "migrations/0013_crm_tags_atividades_filtros.sql"), "utf8");
  for (const t of ["crm_tag", "crm_deal_tag", "crm_atividade", "filtro_salvo"]) {
    assert.match(mig, new RegExp("CREATE TABLE IF NOT EXISTS " + t + " "));
    assert.match(ts, new RegExp("CREATE TABLE IF NOT EXISTS " + t + " "));
  }
});
