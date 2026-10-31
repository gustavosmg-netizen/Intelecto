// Financeiro — testes de COMPORTAMENTO da lógica pura do quadro de contas (node --test, sem rede/D1).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  situacaoFluxo, transicaoFin, validaLote, planoLote, normalizaFiltroFin, filtroFinVazio, aplicaFiltroFin,
} from "../src/fin.mjs";

const HOJE = "2026-10-29";

test("situacaoFluxo: vencido, vence em 7 dias, previsto; realizado/cancelado mandam", () => {
  assert.equal(situacaoFluxo({ status: "previsto", data_prev: "2026-10-28" }, HOJE), "vencido");
  assert.equal(situacaoFluxo({ status: "previsto", data_prev: "2026-10-29" }, HOJE), "avencer");
  assert.equal(situacaoFluxo({ status: "previsto", data_prev: "2026-11-05" }, HOJE), "avencer");
  assert.equal(situacaoFluxo({ status: "previsto", data_prev: "2026-11-06" }, HOJE), "previsto");
  assert.equal(situacaoFluxo({ status: "previsto", data_prev: "" }, HOJE), "previsto");
  assert.equal(situacaoFluxo({ status: "realizado", data_prev: "2020-01-01" }, HOJE), "realizado");
  assert.equal(situacaoFluxo({ status: "cancelado" }, HOJE), "cancelado");
});

test("transicaoFin: arrastar baixa, cancela ou reabre; entre colunas em aberto não muda nada", () => {
  assert.equal(transicaoFin("vencido", "realizado"), "baixar");
  assert.equal(transicaoFin("previsto", "cancelado"), "cancelar");
  assert.equal(transicaoFin("realizado", "previsto"), "reabrir");
  assert.equal(transicaoFin("cancelado", "vencido"), "reabrir");
  assert.equal(transicaoFin("vencido", "previsto"), null);
  assert.equal(transicaoFin("cancelado", "realizado"), null); // reabrir antes de baixar
  assert.equal(transicaoFin("realizado", "realizado"), null);
});

test("validaLote: operação fechada, ids únicos, teto de 500, categoria obrigatória", () => {
  assert.deepEqual(validaLote({ op: "baixar", ids: ["A", "A", " B ", ""] }), { op: "baixar", ids: ["A", "B"], categoria: "" });
  assert.throws(() => validaLote({ op: "apagar", ids: ["A"] }), /inválida/);
  assert.throws(() => validaLote({ op: "baixar", ids: [] }), /ao menos/);
  assert.throws(() => validaLote({ op: "baixar", ids: Array.from({ length: 501 }, (_, i) => "X" + i) }), /500/);
  assert.throws(() => validaLote({ op: "categoria", ids: ["A"] }), /categoria/);
});

test("planoLote: escopo de tenant, baixa preserva data real e não baixa cancelado", () => {
  const c = { tenant: "intelecto", slug: "viviane", now: "2026-10-29T12:00:00Z", hoje: HOJE };
  const [b] = planoLote({ op: "baixar", ids: ["A", "B"], categoria: "" }, c);
  assert.match(b.sql, /status = 'realizado'/);
  assert.match(b.sql, /CASE WHEN COALESCE\(data_real,''\) = '' THEN \? ELSE data_real END/);
  assert.match(b.sql, /tenant_id = \? AND status <> 'cancelado' AND id IN \(\?,\?\)/);
  assert.deepEqual(b.args, [HOJE, "viviane", c.now, "intelecto", "A", "B"]);
  // a contagem de ? bate com os args em todas as operações
  for (const op of ["baixar", "reabrir", "cancelar", "categoria"])
    for (const s of planoLote({ op, ids: ["A", "B", "C"], categoria: "Impostos" }, c))
      assert.equal((s.sql.match(/\?/g) || []).length, s.args.length, op + ": " + s.sql);
});

test("planoLote: reabrir/cancelar desfazem a baixa da parcela de contrato ligada", () => {
  const c = { tenant: "intelecto", slug: "v", now: "n", hoje: HOJE };
  for (const op of ["reabrir", "cancelar"]) {
    const st = planoLote({ op, ids: ["A"], categoria: "" }, c);
    assert.equal(st.length, 2);
    assert.match(st[1].sql, /UPDATE contrato_parcela SET status = 'prevista', recebido_em = '', fluxo_id = '' WHERE tenant_id = \? AND fluxo_id IN/);
  }
  assert.equal(planoLote({ op: "baixar", ids: ["A"], categoria: "" }, c).length, 1);
});

test("normalizaFiltroFin: descarta valores fora do domínio", () => {
  const n = normalizaFiltroFin({ tipo: "x", situacoes: ["vencido", "zz"], ccs: ["1.25.2.3", "drop table", "(sem CC)"], de: "2026-13", ate: "2026-12-31", hack: 1 });
  assert.deepEqual(n, { q: "", tipo: "", situacoes: ["vencido"], ccs: ["1.25.2.3", "(sem CC)"], categorias: [], tags: [], de: "", ate: "2026-12-31" });
  assert.equal(filtroFinVazio({}), true);
  assert.equal(filtroFinVazio({ tipo: "saida" }), false);
});

const ROWS = [
  { id: "F1", tipo: "saida", status: "previsto", data_prev: "2026-10-20", descricao: "Aluguel sala", categoria: "Administrativo", cc: "" },
  { id: "F2", tipo: "entrada", status: "previsto", data_prev: "2026-11-02", descricao: "Parcela 2 Vale", categoria: "Contrato", cc: "1.25.2.3" },
  { id: "F3", tipo: "entrada", status: "realizado", data_prev: "2026-09-10", data_real: "2026-09-12", descricao: "Parcela 1 Vale", categoria: "Contrato", cc: "1.25.2.3" },
];
const ids = (r) => r.map((x) => x.id).join(",");

test("aplicaFiltroFin: tipo, situação, CC (inclusive sem CC), categoria, tags e período", () => {
  const ctx = { hoje: HOJE, itemTags: { F2: ["T1"], F3: ["T1", "T2"] } };
  assert.equal(ids(aplicaFiltroFin(ROWS, { tipo: "entrada" }, ctx)), "F2,F3");
  assert.equal(ids(aplicaFiltroFin(ROWS, { situacoes: ["vencido", "avencer"] }, ctx)), "F1,F2");
  assert.equal(ids(aplicaFiltroFin(ROWS, { ccs: ["(sem CC)"] }, ctx)), "F1");
  assert.equal(ids(aplicaFiltroFin(ROWS, { categorias: ["Contrato"], tags: ["T1", "T2"] }, ctx)), "F3");
  assert.equal(ids(aplicaFiltroFin(ROWS, { de: "2026-09-11", ate: "2026-10-31" }, ctx)), "F1,F3"); // F3 usa a data real
  assert.equal(ids(aplicaFiltroFin(ROWS, { q: "parcela vale" }, ctx)), "F2,F3");
});

// ---------- Fiação no Worker (asserts de fonte) ----------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = readFileSync(join(root, "src/index.ts"), "utf8");
const bloco = (ini, fim) => ts.slice(ts.indexOf(ini), ts.indexOf(fim, ts.indexOf(ini) + 1));

test("Worker: ações do quadro têm piso de coordenação; o lote pede reauth", () => {
  for (const a of ["finQuadro", "finTagSet", "finTagDel", "fluxoTag", "fluxoLote"]) assert.match(ts, new RegExp("\\b" + a + ': "coordenacao"'), a);
  const sens = bloco("const SENSIVEIS = new Set<string>([", "]);");
  assert.match(sens, /"fluxoLote"/);
});

test("Worker: gates financeiro.ver/editar e tags por pessoa", () => {
  const b = bloco('if (action === "finQuadro")', '/* ===== CRM na casca nova');
  assert.match(b, /finPodeVer\(u\)/);
  assert.match(bloco('if (action === "fluxoLote")', '/* ===== CRM na casca nova'), /finPodeEditar\(u\)/);
  for (const q of b.match(/"(SELECT|UPDATE|DELETE|INSERT)[^"]*(fin_tag|fluxo_tag)[^"]*"/g) || []) assert.match(q, /slug/, q);
  // o lote usa o plano puro (escopo de tenant e desfazer parcela testados acima) num batch atômico
  assert.match(b, /planoLote\(l, \{ tenant: u\.tenant_id/);
  assert.match(b, /sqlite\.batch\(plano\)/);
  assert.doesNotMatch(b, /r\.meta\b/);
});

test("Worker: filtro salvo do Financeiro é normalizado e o schema tem migração própria", () => {
  assert.match(ts, /modulo === "crm" \? normalizaFiltro\(p\.filtro\) : normalizaFiltroFin\(p\.filtro\)/);
  const ver = (ts.match(/const SCHEMA_VER = "([^"]+)";/) || [])[1] || "";
  assert.ok(ver >= "2026-10-29c", "SCHEMA_VER " + ver);
  const mig = readFileSync(join(root, "migrations/0014_fin_tags.sql"), "utf8");
  for (const t of ["fin_tag", "fluxo_tag"]) {
    assert.match(mig, new RegExp("CREATE TABLE IF NOT EXISTS " + t + " "));
    assert.match(ts, new RegExp("CREATE TABLE IF NOT EXISTS " + t + " "));
  }
});

// ---------- Visão geral das finanças ----------
import { grupoFin, visaoFinanceira } from "../src/fin.mjs";

test("grupoFin: faturamento só RECEITAS; sócios, empréstimos e investimentos à parte; transferência fora", () => {
  assert.equal(grupoFin("entrada", "RECEITAS"), "faturamento");
  assert.equal(grupoFin("entrada", "INVESTIMENTOS"), "outras_entradas");
  assert.equal(grupoFin("entrada", "OUTRAS ENTRADAS"), "outras_entradas");
  assert.equal(grupoFin("entrada", "EMPRÉSTIMOS"), "emprestimos_in");
  assert.equal(grupoFin("entrada", "SALDO"), "fora");
  assert.equal(grupoFin("entrada", "TRANSF. ENTRE CONTAS BANCÁRIAS"), "fora");
  assert.equal(grupoFin("saida", "TRANSF. ENTRE CONTAS BANCÁRIAS"), "fora");
  assert.equal(grupoFin("saida", "SAQUE"), "fora");
  assert.equal(grupoFin("saida", "RETIRADA DE SÓCIOS"), "socios");
  assert.equal(grupoFin("saida", "EMPRÉSTIMOS"), "emprestimos_out");
  assert.equal(grupoFin("saida", "INVESTIMENTOS"), "investimentos");
  for (const c of ["CUSTOS FIXOS", "CUSTOS VARIÁVEIS", "IMPOSTOS S/VENDAS", "DESPESAS BANCÁRIAS", ""]) assert.equal(grupoFin("saida", c), "gastos", c);
});

test("visaoFinanceira: meses preenchidos, situação, resultado, margem e filtro por lado", () => {
  const L = [
    { ym: "2026-09", tipo: "entrada", categoria: "RECEITAS", status: "realizado", v: 1000 },
    { ym: "2026-09", tipo: "entrada", categoria: "TRANSF. ENTRE CONTAS BANCÁRIAS", status: "realizado", v: 9999 },
    { ym: "2026-09", tipo: "saida", categoria: "CUSTOS FIXOS", status: "realizado", v: 300 },
    { ym: "2026-09", tipo: "saida", categoria: "CUSTOS VARIÁVEIS", status: "realizado", v: 100 },
    { ym: "2026-09", tipo: "saida", categoria: "RETIRADA DE SÓCIOS", status: "realizado", v: 200 },
    { ym: "2026-10", tipo: "entrada", categoria: "RECEITAS", status: "previsto", v: 500 },
    { ym: "2026-10", tipo: "saida", categoria: "CUSTOS FIXOS", status: "cancelado", v: 777 },
    { ym: "2025-01", tipo: "entrada", categoria: "RECEITAS", status: "realizado", v: 5 },
  ];
  const v = visaoFinanceira(L, { de: "2026-08", ate: "2026-10" });
  assert.deepEqual(v.meses.map((m) => m.ym), ["2026-08", "2026-09", "2026-10"]);
  assert.equal(v.tot.faturamento, 1000); // previsto e fora do período não entram; transferência fora
  assert.equal(v.tot.gastos, 400);
  assert.equal(v.tot.socios, 200);
  assert.equal(v.resultado, 600);
  assert.equal(v.margemPct, 60);
  assert.equal(v.meses[1].resultado, 600);
  assert.deepEqual(v.gastosPorCategoria.map((x) => x.categoria), ["CUSTOS FIXOS", "CUSTOS VARIÁVEIS"]);
  assert.equal(v.porMes["2026-09"].gastos[0].v, 300);
  assert.equal(visaoFinanceira(L, { de: "2026-08", ate: "2026-10", situacao: "previsto" }).tot.faturamento, 500);
  assert.equal(visaoFinanceira(L, { de: "2026-08", ate: "2026-10", situacao: "tudo" }).tot.faturamento, 1500);
  // filtrar um gasto recorta só as saídas: faturamento segue; o gráfico por categoria mantém todas
  const f = visaoFinanceira(L, { de: "2026-08", ate: "2026-10", categorias: ["custos fixos"] });
  assert.equal(f.tot.faturamento, 1000);
  assert.equal(f.tot.gastos, 300);
  assert.equal(f.tot.socios, 0);
  assert.equal(f.gastosPorCategoria.length, 2);
  assert.equal(visaoFinanceira([], { de: "2026-10", ate: "2026-09" }).meses.length, 0);
  assert.equal(visaoFinanceira([], { de: "2026-01", ate: "2026-03" }).margemPct, null);
});

test("Worker/UI: finVisao restrito ao financeiro; aba Visão geral abre o Financeiro", async () => {
  const { readFileSync } = await import("node:fs");
  const ts = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const i = ts.indexOf('if (action === "finVisao")'); const b = ts.slice(i, ts.indexOf("\n  }\n", i));
  assert.match(b, /financeiro\.ver/);
  assert.match(b, /visaoFinanceira\(/);
  assert.match(ts, /finVisao: "coordenacao"/);
  assert.match(html, /class="subnav-btn is-active" data-tab="fin-tab-vg" type="button">Visão geral</);
  assert.match(html, /api\("finVisao",\{de:pr\.de,ate:pr\.ate,situacao:FINVG\.sit,categorias:FINVG\.cats\}\)/);
  assert.match(html, /data-ci="'\+ci\+'"/); // colunas clicáveis
  assert.match(html, /data-bi="'\+i\+'"/); // barras clicáveis
});
