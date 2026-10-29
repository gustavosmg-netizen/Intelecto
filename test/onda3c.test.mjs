// Onda 3 · Sub-projeto C — testes de COMPORTAMENTO dos helpers puros da sugestão de CC por IA
// (node --test, sem rede/D1). Os helpers vivem em src/onda3c.mjs, importados pelo Worker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { montaPromptSugestaoCC, parseSugestaoCC } from "../src/onda3c.mjs";

// ---------- Task 1: parseSugestaoCC ----------
test("parseSugestaoCC: cc fora da lista vira incerto, motivo preservado", () => {
  const r = parseSugestaoCC('{"cc":"9.9.9.9","confianca":0.8,"motivo":"parece X"}', ["1.2.3.4"]);
  assert.equal(r.cc, ""); // alucinou → incerto
  assert.match(r.motivo, /parece X/);
});

test("parseSugestaoCC: cc válido passa com confiança", () => {
  const r = parseSugestaoCC('ruído {"cc":"1.2.3.4","confianca":0.9,"motivo":"ok"} fim', ["1.2.3.4", "1.2.3.5"]);
  assert.equal(r.cc, "1.2.3.4");
  assert.equal(r.confianca, 0.9);
});

test("parseSugestaoCC: resposta sem JSON → incerto, não lança", () => {
  const r = parseSugestaoCC("não sei dizer", ["1.2.3.4"]);
  assert.equal(r.cc, "");
});

test("parseSugestaoCC: JSON quebrado, vazio e tipos estranhos → incerto, não lança", () => {
  assert.equal(parseSugestaoCC("{cc: oops", ["1.2.3.4"]).cc, "");
  assert.equal(parseSugestaoCC("", ["1.2.3.4"]).cc, "");
  assert.equal(parseSugestaoCC(null, ["1.2.3.4"]).cc, "");
  assert.equal(parseSugestaoCC('{"cc":123}', ["123"]).cc, "123"); // número vira string antes de validar
  assert.equal(parseSugestaoCC('{"cc":["1.2.3.4"]}', ["1.2.3.4"]).cc, ""); // tipo inválido não casa
  assert.equal(parseSugestaoCC('{"cc":"1.2.3.4"}', undefined).cc, ""); // sem candidatos → nada é válido
});

test("parseSugestaoCC: confiança normalizada a 0–1 ou vazia", () => {
  const ok = (c) => parseSugestaoCC(JSON.stringify({ cc: "1.2.3.4", confianca: c, motivo: "" }), ["1.2.3.4"]).confianca;
  assert.equal(ok(150), 1);
  assert.equal(ok(-3), 0);
  assert.equal(ok("0.5"), 0.5);
  assert.equal(ok(85), 0.85); // modelo respondeu em %
  assert.equal(ok("alta"), "");
  assert.equal(ok(null), "");
});

test("parseSugestaoCC: cc com espaços é aparado; motivo é limitado", () => {
  const r = parseSugestaoCC(JSON.stringify({ cc: " 1.2.3.4 ", confianca: 0.5, motivo: "x".repeat(900) }), ["1.2.3.4"]);
  assert.equal(r.cc, "1.2.3.4");
  assert.ok(r.motivo.length <= 300);
});

test("parseSugestaoCC: incerto deliberado (cc vazio) devolve cc vazio e motivo", () => {
  const r = parseSugestaoCC('{"cc":"","confianca":0.1,"motivo":"nada casa"}', ["1.2.3.4"]);
  assert.equal(r.cc, "");
  assert.match(r.motivo, /nada casa/);
});

// ---------- Task 1: montaPromptSugestaoCC ----------
test("montaPromptSugestaoCC: inclui descrição, candidatos e a restrição", () => {
  const p = montaPromptSugestaoCC(
    { descricao: "PIX FORNECEDOR ACME", valor: 1200, data: "2026-10-20" },
    [{ cc: "1.2.3.4", cliente: "ACME", projeto: "ETE" }],
    [{ descricao: "ACME parcela", cc: "1.2.3.4" }]
  );
  assert.match(p.user + p.system, /PIX FORNECEDOR ACME/);
  assert.match(p.user + p.system, /1\.2\.3\.4/);
  assert.match(p.system, /um dos|da lista|incerto|vazi/i); // instrução de restrição
});

test("montaPromptSugestaoCC: sem histórico/candidatos não lança e ainda manda a restrição", () => {
  const p = montaPromptSugestaoCC({ descricao: "TARIFA", valor: 5, data: "" }, [], []);
  assert.equal(typeof p.system, "string");
  assert.equal(typeof p.user, "string");
  assert.match(p.user, /TARIFA/);
  assert.match(p.system, /JSON/);
});
