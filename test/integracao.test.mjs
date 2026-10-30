// Integração da casca clássica: abas que recarregam, painéis vivos no Início, metas do CRM,
// vínculo negócio → projeto e livro legado marcado. (node --test, asserts de fiação + função pura.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = readFileSync(join(root, "src/index.ts"), "utf8");
const html = readFileSync(join(root, "public/index.html"), "utf8");
const trecho = (src, ini, fim) => { const i = src.indexOf(ini); assert.ok(i >= 0, ini); return src.slice(i, src.indexOf(fim, i + ini.length)); };

test("ultimosMeses: n meses terminando no mês dado, atravessando o ano", () => {
  const src = trecho(ts, "function ultimosMeses(", "\n}\n") + "\n}";
  const f = new Function(src.replace("(n: number, ateYm: string): string[]", "(n, ateYm)").replace("const out: string[] = []", "const out = []") + "; return ultimosMeses;")();
  assert.deepEqual(f(3, "2026-02"), ["2025-12", "2026-01", "2026-02"]);
  assert.equal(f(12, "2026-10").length, 12);
  assert.equal(f(12, "2026-10")[0], "2025-11");
});

test("abas com dados vivos recarregam ao abrir (Financeiro, Comercial, Início)", () => {
  const ouvinte = trecho(html, 'closest(".subnav-btn[data-tab]")', "\n});");
  assert.match(ouvinte, /var ld=TAB_LOAD\[alvo\]; if\(typeof ld==="function"\)/);
  const reg = trecho(html, "var TAB_LOAD={", "\n};");
  for (const t of ["fin-tab-res", "fin-tab-contas", "fin-tab-cart", "fin-tab-ch", "fin-tab-cf", "fin-tab-cap", "fin-tab-conc", "fin-tab-fx", "com-painel", "com-crm", "com-leads", "area-com", "area-fin"])
    assert.match(reg, new RegExp('"' + t + '":function'), t);
});

test("Início executivo: Comercial e Financeiro com dados reais, sem cartões estáticos", () => {
  assert.doesNotMatch(html, /function _areaCard\(/);
  const exec = trecho(html, "function viewInicioExec(){", "\nfunction ");
  assert.match(exec, /id="exec-crm"/);
  assert.match(exec, /id="fin-res"/);
  const crm = trecho(html, "function _execCrm(){", "\n}\n");
  assert.match(crm, /api\("crm"\)/);
  assert.match(crm, /_crmGraficos\(deals\)/);
  // fora do Financeiro não há valor em R$
  assert.doesNotMatch(crm + trecho(html, "function _crmGraficos(", "\n}\n"), /fmtBRL|"brl"|R\$/);
});

test("Resumo financeiro: séries mensais do servidor viram gráficos de caixa e horas", () => {
  const fn = trecho(ts, "async function resumoExecutivo(", "\n}\n");
  assert.match(fn, /const serie = meses\.map/);
  assert.match(fn, /status <> 'cancelado'/);
  assert.match(fn, /return \{\n    serie,/);
  const ui = trecho(html, "function _finResumo(){", "\n}\n");
  assert.match(ui, /_vzCard\("Caixa por mês"/);
  assert.match(ui, /_vzCard\("Horas apontadas por mês"/);
});

test("CRM: metas editáveis por empresa; negócio vincula projeto existente", () => {
  assert.match(ts, /crmMetasSet: "equipe"/);
  const metas = trecho(ts, 'if (action === "crmMetasSet")', "\n  }\n");
  assert.match(metas, /comercial\.gerir/);
  assert.match(metas, /cfgSet\("crm_metas", JSON\.stringify\(m\), u\.tenant_id\)/);
  assert.match(trecho(ts, 'if (action === "crm")', "\n  }\n"), /prox, metas \}/);
  const set = trecho(ts, 'if (action === "crmDealSet")', "\n  }\n");
  assert.match(set, /if \(p\.cc !== undefined\)/);
  assert.match(set, /SELECT 1 FROM proj WHERE tenant_id = \? AND cc = \?/);
  assert.match(html, /id="cf-cc"/);
  assert.match(html, /cc:gv\("cf-cc"\)/);
  assert.match(html, /api\("crmMetasSet",pay\)/);
  assert.match(html, /if\(j&&j\.metas\)Object\.keys\(CRM_METAS\)/);
});

test("Horas comerciais: livro legado marcado como histórico, só leitura", () => {
  assert.match(html, /Horas comerciais \(histórico\)/);
  assert.match(html, /Livro antigo, só leitura\./);
});
