// Importação da planilha — testes de COMPORTAMENTO da lógica pura (node --test, sem rede/D1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugDoNome, ccDoTexto, chave, normalizaLinhas, diffLancamentos, resumoNovos } from "../src/importa.mjs";

const ROSTER = { leo: "Léo", hector: "Héctor", gabriel: "Gabriel", gabriela: "Gabriela", cecilia: "Cecília", gustavo: "Gustavo" };

test("slugDoNome: sem acento, nome completo e primeiro nome único", () => {
  assert.equal(slugDoNome("Léo", ROSTER), "leo");
  assert.equal(slugDoNome("HÉCTOR", ROSTER), "hector");
  assert.equal(slugDoNome("Gabriela", ROSTER), "gabriela"); // não confunde com Gabriel
  assert.equal(slugDoNome("Gustavo Martins", ROSTER), "gustavo");
  assert.equal(slugDoNome("Fulano", ROSTER), "");
  assert.equal(slugDoNome("", ROSTER), "");
});

test("ccDoTexto: pega o código antes do nome; rejeita texto sem código", () => {
  assert.equal(ccDoTexto("1.2.3.18 - Máquina de Termodecomposição"), "1.2.3.18");
  assert.equal(ccDoTexto("1.1.4.6"), "1.1.4.6");
  assert.equal(ccDoTexto("Reuniões"), "");
  assert.equal(ccDoTexto("1.2.9.1 - tipo 9 não existe"), "");
});

test("normalizaLinhas: separa inválidas, futuras, pessoa e projeto desconhecidos", () => {
  const r = normalizaLinhas([
    { d: "2026-10-20", nome: "Léo", cc: "1.2.3.18 - X", h: 4 },
    { d: "2026-10-20", nome: "Léo", cc: "", h: 0 },               // calendário em branco
    { d: "2026-12-24", nome: "Gustavo", cc: "1.2.3.18 - X", h: 2 }, // futuro
    { d: "2026-10-21", nome: "Fulano", cc: "1.2.3.18 - X", h: 1 },
    { d: "2026-10-21", nome: "Gustavo", cc: "9.9.2.9 - Novo", h: 3 },
    { d: "21/10/2026", nome: "Gustavo", cc: "1.2.3.18", h: 3 },
  ], ROSTER, ["1.2.3.18"], "2026-10-30");
  assert.deepEqual(r.validas, [{ slug: "leo", d: "2026-10-20", cc: "1.2.3.18", h: 4 }]);
  assert.deepEqual(r.semPessoa, { Fulano: 1 });
  assert.deepEqual(r.semProjeto, { "9.9.2.9": 1 });
  assert.deepEqual(r.invalidas, { data: 1, horas: 1, cc: 0, futuro: 1 });
});

test("diffLancamentos: multiconjunto — repetição legítima conta; reimportar não duplica", () => {
  const L = (h) => ({ slug: "leo", d: "2026-10-20", cc: "1.2.3.18", h });
  const planilha = [L(2), L(2), L(4)];
  assert.equal(diffLancamentos(planilha, []).novos.length, 3);
  const um = diffLancamentos(planilha, [L(2)]);
  assert.deepEqual(um.novos, [L(2), L(4)]);
  assert.equal(um.jaNoPortal, 1);
  assert.equal(diffLancamentos(planilha, planilha).novos.length, 0); // idempotente
  assert.equal(chave("leo", "2026-10-20", "1.2.3.18", 2.04), "leo|2026-10-20|1.2.3.18|2.0");
});

test("resumoNovos: por mês e por pessoa", () => {
  const r = resumoNovos([{ slug: "leo", d: "2026-10-20", cc: "x", h: 4 }, { slug: "leo", d: "2026-10-21", cc: "x", h: 2.5 }, { slug: "gustavo", d: "2026-09-30", cc: "x", h: 1 }]);
  assert.equal(r.n, 3);
  assert.equal(r.horas, 7.5);
  assert.deepEqual(r.porMes, { "2026-10": { n: 2, h: 6.5 }, "2026-09": { n: 1, h: 1 } });
  assert.deepEqual(r.porPessoa.leo, { n: 2, h: 6.5 });
});

// ---------- Fiação no Worker e na tela (asserts de fonte) ----------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = readFileSync(join(root, "src/index.ts"), "utf8");
const html = readFileSync(join(root, "public/index.html"), "utf8");

test("Worker: prévia não grava; importar recalcula o diff, grava LANÇADO/planilha, coordenação + reauth", () => {
  const i = ts.indexOf('if (action === "planilhaPrevia" || action === "planilhaImportar")');
  const b = ts.slice(i, ts.indexOf("/* ===== FINANCEIRO na casca nova", i));
  assert.match(b, /if \(!u\.coord\) throw new Error/);
  assert.match(b, /diffLancamentos\(n\.validas/);
  assert.ok(b.indexOf('if (action === "planilhaPrevia") return') < b.indexOf("INSERT INTO lanc"), "a prévia retorna antes de qualquer INSERT");
  assert.match(b, /'LANÇADO', '', \?, \?, \?, \?, 'planilha'\)/);
  assert.match(ts, /planilhaPrevia: "coordenacao", planilhaImportar: "coordenacao"/);
  assert.match(ts.slice(ts.indexOf("const SENSIVEIS"), ts.indexOf("]);", ts.indexOf("const SENSIVEIS"))), /"planilhaImportar"/);
});

test("Tela: aba Importar planilha lê a aba Dados Estruturados no navegador e só grava no clique", () => {
  assert.match(html, /data-tab="cad-tab-planilha"/);
  assert.match(html, /new DecompressionStream\("deflate-raw"\)/);
  assert.match(html, /name="Dados Estruturados"/);
  assert.match(html, /api\("planilhaPrevia",\{linhas:linhas\}\)/);
  assert.match(html, /api\("planilhaImportar",\{linhas:linhas\}\)/);
});
