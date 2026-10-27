// Onda 3 · Sub-projeto B (núcleo) — testes de COMPORTAMENTO dos helpers puros das regras
// agendadas (node --test, sem rede/D1). Os helpers vivem em src/onda3b.mjs (ESM puro),
// importados pelo Worker (src/index.ts) e por aqui. Mesmo estilo de onda3a.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deveRodar, nivelEstouro, periodoSemanaISO, notifStatements } from "../src/onda3b.mjs";

// ---------- deveRodar: cada regra se autolimita pela data ----------
test("deveRodar: sem_apontamento só sexta; snapshot só dia 1; parado/estouro sempre", () => {
  const sexta = new Date("2026-10-30T12:00:00Z"); // sexta
  const dia1 = new Date("2026-11-01T12:00:00Z"); // domingo, dia 1
  const outro = new Date("2026-10-28T12:00:00Z"); // quarta, não-dia-1
  assert.equal(deveRodar("sem_apontamento", sexta), true);
  assert.equal(deveRodar("sem_apontamento", outro), false);
  assert.equal(deveRodar("sem_apontamento", dia1), false, "dia 1 que não é sexta não dispara R3");
  assert.equal(deveRodar("snapshot", dia1), true);
  assert.equal(deveRodar("snapshot", outro), false);
  assert.equal(deveRodar("snapshot", sexta), false, "sexta que não é dia 1 não dispara R4");
  assert.equal(deveRodar("parado", outro), true);
  assert.equal(deveRodar("estouro", outro), true);
});

test("deveRodar: regra desconhecida não roda (fail-closed)", () => {
  assert.equal(deveRodar("inventada", new Date("2026-10-28T12:00:00Z")), false);
});

// ---------- nivelEstouro: faixas 80/100/120 ----------
test("nivelEstouro: faixas 80/100/120", () => {
  assert.equal(nivelEstouro(70, 100), "");
  assert.equal(nivelEstouro(79.9, 100), "");
  assert.equal(nivelEstouro(80, 100), "80");
  assert.equal(nivelEstouro(99, 100), "80");
  assert.equal(nivelEstouro(100, 100), "100");
  assert.equal(nivelEstouro(119, 100), "100");
  assert.equal(nivelEstouro(120, 100), "120");
  assert.equal(nivelEstouro(130, 100), "120");
});

test("nivelEstouro: previsto <= 0 ou entradas inválidas => sem nível", () => {
  assert.equal(nivelEstouro(10, 0), "", "previsto 0 => sem nível (não divide por zero)");
  assert.equal(nivelEstouro(10, -5), "");
  assert.equal(nivelEstouro(null, 100), "");
  assert.equal(nivelEstouro(80, null), "");
});

// ---------- periodoSemanaISO: chave de dedup semanal ----------
test("periodoSemanaISO estável por semana e diferente entre semanas", () => {
  assert.equal(
    periodoSemanaISO(new Date("2026-10-26T00:00:00Z")),
    periodoSemanaISO(new Date("2026-10-27T00:00:00Z")),
  );
  assert.notEqual(periodoSemanaISO(new Date("2026-10-26")), periodoSemanaISO(new Date("2026-11-03")));
});

test("periodoSemanaISO: valor ISO correto (segunda a domingo) e virada de ano", () => {
  assert.equal(periodoSemanaISO(new Date("2026-10-26T00:00:00Z")), "2026-W44"); // segunda
  assert.equal(periodoSemanaISO(new Date("2026-11-01T23:00:00Z")), "2026-W44"); // domingo da mesma semana
  assert.equal(periodoSemanaISO(new Date("2026-11-02T00:00:00Z")), "2026-W45"); // segunda seguinte
  // 2027-01-01 é sexta => pertence à semana 53 de 2026 (ISO-8601).
  assert.equal(periodoSemanaISO(new Date("2027-01-01T00:00:00Z")), "2026-W53");
  // 2026-01-01 é quinta => semana 1 de 2026.
  assert.equal(periodoSemanaISO(new Date("2026-01-01T00:00:00Z")), "2026-W01");
});

// ---------- notifStatements: INSERT OR IGNORE (dedup por UNIQUE) ----------
const item = {
  id: "N1", tenant: "intelecto", destino: "@coordenacao", tipo: "proj_parado",
  ref: "1.2.3.4", periodo: "2026-W44", titulo: "x", texto: "y", now: "2026-10-27T00:00:00Z",
};

test("notifStatements: INSERT OR IGNORE por item; vazio => []", () => {
  assert.deepEqual(notifStatements([]), []);
  assert.deepEqual(notifStatements(null), [], "entrada ausente não quebra o cron");
  const s = notifStatements([item]);
  assert.equal(s.length, 1);
  assert.match(s[0].sql, /INSERT OR IGNORE INTO notificacao/);
  assert.ok(s[0].args.includes("@coordenacao") && s[0].args.includes("proj_parado"));
});

test("notifStatements: args na ordem das colunas do INSERT, lido=0 fixo no SQL", () => {
  const s = notifStatements([item]);
  const cols = s[0].sql.match(/notificacao \(([^)]+)\)/)[1].split(",").map((x) => x.trim());
  assert.deepEqual(cols, ["id", "tenant_id", "destino", "tipo", "ref", "periodo", "titulo", "texto", "criado", "lido"]);
  // 10 colunas, 9 placeholders + o literal 0 de `lido` => 9 args na ordem das colunas.
  assert.deepEqual(s[0].args, ["N1", "intelecto", "@coordenacao", "proj_parado", "1.2.3.4", "2026-W44", "x", "y", "2026-10-27T00:00:00Z"]);
});

test("notifStatements: um statement por item, preservando a ordem", () => {
  const s = notifStatements([item, { ...item, id: "N2", destino: "gustavo", tipo: "sem_apontamento", ref: "gustavo" }]);
  assert.equal(s.length, 2);
  assert.equal(s[0].args[0], "N1");
  assert.equal(s[1].args[0], "N2");
  assert.ok(s[1].args.includes("gustavo") && s[1].args.includes("sem_apontamento"));
});

test("notifStatements: campos ausentes viram string vazia (nunca undefined no bind do D1)", () => {
  const s = notifStatements([{ id: "N3", tenant: "intelecto", destino: "ana", tipo: "snapshot" }]);
  assert.equal(s.length, 1);
  for (const a of s[0].args) assert.notEqual(a, undefined, "nenhum arg undefined");
  assert.deepEqual(s[0].args, ["N3", "intelecto", "ana", "snapshot", "", "", "", "", ""]);
});

test("notifStatements: item sem destino ou sem tipo é descartado (não grava lixo)", () => {
  assert.deepEqual(notifStatements([{ id: "N4", tenant: "intelecto", destino: "", tipo: "estouro" }]), []);
  assert.deepEqual(notifStatements([{ id: "N5", tenant: "intelecto", destino: "ana", tipo: "" }]), []);
});
