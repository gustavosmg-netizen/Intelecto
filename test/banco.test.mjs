// Banco de horas (antigo "Capacidade × apontado") e biblioteca de gráficos da casca clássica.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = readFileSync(join(root, "src/index.ts"), "utf8");
const html = readFileSync(join(root, "public/index.html"), "utf8");
const css = readFileSync(join(root, "public/design.css"), "utf8");

// Extrai a função TS e tira as anotações de tipo para executar em JS puro.
function funcao(nome) {
  const i = ts.indexOf("function " + nome + "(");
  const j = ts.indexOf("\n}\n", i);
  const src = ts.slice(i, j + 2).replace(/\(ym: string, ateIso: string\): number/, "(ym, ateIso)");
  return new Function(src + "; return " + nome + ";")();
}

test("diasUteisAte: conta só seg–sex até a data (inclusive)", () => {
  const f = funcao("diasUteisAte");
  assert.equal(f("2026-10", "2026-10-30"), 22); // out/26: 1 = qui; 30 = sex
  assert.equal(f("2026-10", "2026-10-02"), 2);
  assert.equal(f("2026-10", "2026-10-04"), 2); // sáb/dom não contam
  assert.equal(f("2026-10", "2026-09-30"), 0);
  assert.equal(f("lixo", "2026-10-30"), 0);
});

test("capacidadeApontado: sem custo, meses em ordem, futuro fora, mês corrente parcial, banco acumulado", () => {
  const i = ts.indexOf("async function capacidadeApontado(");
  const b = ts.slice(i, ts.indexOf("\n}\n", i));
  assert.doesNotMatch(b, /custohora|custo_hora|tCusto|valorExtra/i);
  assert.match(b, /ORDER BY slug, ym/);
  assert.match(b, /if \(ym > mesAtual\) continue;/);
  assert.match(b, /ym === mesAtual \? diasUteisAte\(ym, hojeIso\) : diasUteisMes\(ym\)/);
  assert.match(b, /const banco = arred2\(o\.tSaldo \+ saldo\);/);
  assert.match(b, /o\.tSaldo = banco;/);
  assert.match(b, /parcial: ym === mesAtual \? 1 : 0/);
});

test("UI: aba Banco de horas sem R$, com dois gráficos e tabela alternativa", () => {
  assert.match(html, /data-tab="fin-tab-cap" type="button">Banco de horas</);
  const i = html.indexOf("function _finCapacidade(){");
  const b = html.slice(i, html.indexOf("\nfunction _finConciliacao(", i));
  assert.doesNotMatch(b, /R\$|fmtBRL|custo\/h/);
  assert.match(b, /_vzBarras\(/);
  assert.match(b, /_vzColunas\(/);
  assert.match(b, /Sem custo: horas, não reais\./);
});

test("biblioteca de gráficos: paleta validada própria, tabela e tooltip; viewBox largo o bastante", () => {
  for (const f of ["_vzCard", "_vzColunas", "_vzBarras", "_vzLinha", "_vzTabela", "_vzLegenda", "_vzTipInit"]) assert.match(html, new RegExp("function " + f + "\\("), f);
  assert.match(html, /ver tabela/);
  for (const t of ["--vz-1", "--vz-6", "--vz-pos", "--vz-neg"]) assert.match(css, new RegExp(t + ":"), t);
  assert.match(css, /#vz-tip/);
  // viewBox estreito fazia o texto inflar nos cartões largos
  assert.match(html, /var W0=560,/);
  assert.doesNotMatch(html, /W=Math\.max\(300,cats\.length\*gw\+40\)/);
});
