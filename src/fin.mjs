// Financeiro — lógica PURA do quadro de contas a pagar e a receber (sem D1, sem relógio: "hoje" é
// injetado), compartilhada pelo Worker (src/index.ts), pela casca nova (app/src/fincontas.tsx) e
// pelos testes (test/fin.test.mjs). Base: a tabela `fluxo` (entrada = a receber, saída = a pagar).

/** Colunas do quadro. As três primeiras são "em aberto" (status previsto), separadas pela data. */
export const COLUNAS_FIN = [
  { id: "vencido", label: "Vencidas" },
  { id: "avencer", label: "Vencem em 7 dias" },
  { id: "previsto", label: "Previstas" },
  { id: "realizado", label: "Pagas / recebidas" },
  { id: "cancelado", label: "Canceladas" },
];
const ABERTAS = ["vencido", "avencer", "previsto"];

function somaDias(iso, n) {
  const t = Date.parse(iso + "T00:00:00Z");
  return Number.isFinite(t) ? new Date(t + n * 86400000).toISOString().slice(0, 10) : iso;
}

/**
 * Situação de um lançamento no quadro.
 * @param {{status?:string, data_prev?:string}} f
 * @param {string} hoje AAAA-MM-DD
 * @returns {"vencido"|"avencer"|"previsto"|"realizado"|"cancelado"}
 */
export function situacaoFluxo(f, hoje) {
  const st = String((f && f.status) || "previsto");
  if (st === "realizado" || st === "cancelado") return st;
  const d = String((f && f.data_prev) || "").slice(0, 10);
  if (!d) return "previsto";
  if (d < hoje) return "vencido";
  if (d <= somaDias(hoje, 7)) return "avencer";
  return "previsto";
}

/**
 * O que acontece ao soltar um cartão numa coluna. Entre colunas "em aberto" não há transição (a
 * coluna vem da data; para mudar, edita-se o vencimento) — devolve null. Para "realizado" = baixa
 * (data real = a já informada ou hoje); "cancelado" = cancela; de realizado/cancelado para qualquer
 * coluna em aberto = reabre (status previsto, sem data real).
 * @param {string} de situação atual
 * @param {string} para coluna de destino
 * @returns {"baixar"|"cancelar"|"reabrir"|null}
 */
export function transicaoFin(de, para) {
  if (de === para) return null;
  if (para === "realizado") return de === "cancelado" ? null : "baixar";
  if (para === "cancelado") return "cancelar";
  if (ABERTAS.includes(para)) return ABERTAS.includes(de) ? null : "reabrir";
  return null;
}

export const OPS_LOTE = ["baixar", "reabrir", "cancelar", "categoria"];
const CC_RE = /^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/;

/**
 * Valida um pedido de operação em lote. Até 500 ids, sem repetição.
 * @param {any} p
 * @returns {{op:string, ids:string[], categoria:string}}
 */
export function validaLote(p) {
  const o = p && typeof p === "object" ? p : {};
  const op = OPS_LOTE.includes(String(o.op)) ? String(o.op) : "";
  if (!op) throw new Error("Operação em lote inválida.");
  const ids = Array.from(new Set((Array.isArray(o.ids) ? o.ids : []).map((x) => String(x == null ? "" : x).trim()).filter(Boolean)));
  if (!ids.length) throw new Error("Selecione ao menos um lançamento.");
  if (ids.length > 500) throw new Error("No máximo 500 lançamentos por vez.");
  const categoria = String(o.categoria || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (op === "categoria" && !categoria) throw new Error("Informe a categoria.");
  return { op, ids, categoria };
}

/**
 * Statements de uma operação em lote sobre `fluxo` (escopo do tenant; cancelado não é baixado).
 * Reabrir ou cancelar uma entrada que baixou parcela de contrato desfaz a baixa da parcela, para o
 * contrato não ficar "recebido" com o caixa em aberto.
 * @param {{op:string, ids:string[], categoria:string}} l
 * @param {{tenant:string, slug:string, now:string, hoje:string}} c
 * @returns {Array<{sql:string, args:any[]}>}
 */
export function planoLote(l, c) {
  const inIds = "(" + l.ids.map(() => "?").join(",") + ")";
  const base = [c.slug, c.now, c.tenant, ...l.ids];
  const desfazParcela = { sql: "UPDATE contrato_parcela SET status = 'prevista', recebido_em = '', fluxo_id = '' WHERE tenant_id = ? AND fluxo_id IN " + inIds, args: [c.tenant, ...l.ids] };
  if (l.op === "baixar") return [{
    sql: "UPDATE fluxo SET status = 'realizado', data_real = CASE WHEN COALESCE(data_real,'') = '' THEN ? ELSE data_real END, u = ?, atualizado = ? WHERE tenant_id = ? AND status <> 'cancelado' AND id IN " + inIds,
    args: [c.hoje, ...base],
  }];
  if (l.op === "reabrir") return [
    { sql: "UPDATE fluxo SET status = 'previsto', data_real = '', u = ?, atualizado = ? WHERE tenant_id = ? AND id IN " + inIds, args: base },
    desfazParcela,
  ];
  if (l.op === "cancelar") return [
    { sql: "UPDATE fluxo SET status = 'cancelado', u = ?, atualizado = ? WHERE tenant_id = ? AND id IN " + inIds, args: base },
    desfazParcela,
  ];
  return [{ sql: "UPDATE fluxo SET categoria = ?, u = ?, atualizado = ? WHERE tenant_id = ? AND id IN " + inIds, args: [l.categoria, ...base] }];
}

const ARR_MAX = 30;
const arr = (v) => (Array.isArray(v) ? v : []).map((x) => String(x == null ? "" : x).trim().slice(0, 80)).filter(Boolean).slice(0, ARR_MAX);
const dt = (v) => { const s = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; };

/**
 * Filtro do quadro financeiro normalizado (vai para `filtro_salvo` como JSON).
 * @param {any} f
 */
export function normalizaFiltroFin(f) {
  const o = f && typeof f === "object" ? f : {};
  const tipo = ["entrada", "saida"].includes(String(o.tipo)) ? String(o.tipo) : "";
  return {
    q: String(o.q || "").trim().slice(0, 120),
    tipo,
    situacoes: arr(o.situacoes).filter((s) => COLUNAS_FIN.some((c) => c.id === s)),
    ccs: arr(o.ccs).filter((c) => c === "(sem CC)" || CC_RE.test(c)),
    categorias: arr(o.categorias),
    tags: arr(o.tags),
    de: dt(o.de),
    ate: dt(o.ate),
  };
}

export function filtroFinVazio(f) {
  const n = normalizaFiltroFin(f);
  return !n.q && !n.tipo && !n.situacoes.length && !n.ccs.length && !n.categorias.length && !n.tags.length && !n.de && !n.ate;
}

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Aplica o filtro. Campos se somam (E); dentro de uma lista vale qualquer um (OU); tags exigem
 * todas. Período usa a data de referência: a real (se houver) ou a prevista.
 * @param {Array<any>} rows
 * @param {any} filtro
 * @param {{itemTags?: Record<string,string[]>, hoje: string}} ctx
 */
export function aplicaFiltroFin(rows, filtro, ctx) {
  const f = normalizaFiltroFin(filtro);
  const tags = (ctx && ctx.itemTags) || {};
  const hoje = String((ctx && ctx.hoje) || "").slice(0, 10);
  const q = semAcento(f.q);
  return (rows || []).filter((r) => {
    if (q) {
      const alvo = semAcento([r.descricao, r.categoria, r.cc, r.id, r.origem].join(" "));
      if (!q.split(/\s+/).every((p) => alvo.includes(p))) return false;
    }
    if (f.tipo && String(r.tipo) !== f.tipo) return false;
    if (f.situacoes.length && !f.situacoes.includes(situacaoFluxo(r, hoje))) return false;
    if (f.ccs.length && !f.ccs.includes(String(r.cc || "") || "(sem CC)")) return false;
    if (f.categorias.length && !f.categorias.includes(String(r.categoria || ""))) return false;
    if (f.tags.length) { const t = tags[r.id] || []; if (!f.tags.every((x) => t.includes(x))) return false; }
    if (f.de || f.ate) {
      const d = String(r.data_real || r.data_prev || "").slice(0, 10);
      if (!d) return false;
      if (f.de && d < f.de) return false;
      if (f.ate && d > f.ate) return false;
    }
    return true;
  });
}

// ---------- Visão geral das finanças (faturamento × gastos por mês) ----------
// Decisão do dono (2026-10-30): faturamento = só RECEITAS; retirada de sócios, empréstimos e
// investimentos ficam em linhas próprias; transferência entre contas, saldo e saque não são
// movimento (ficam fora). O resto das saídas é gasto operacional.

/** Grupos da visão, na ordem de exibição. */
export const GRUPOS_FIN = [
  { id: "faturamento", label: "Faturamento", tipo: "entrada" },
  { id: "outras_entradas", label: "Outras entradas", tipo: "entrada" },
  { id: "emprestimos_in", label: "Empréstimos recebidos", tipo: "entrada" },
  { id: "gastos", label: "Gastos operacionais", tipo: "saida" },
  { id: "socios", label: "Retirada de sócios", tipo: "saida" },
  { id: "emprestimos_out", label: "Empréstimos pagos", tipo: "saida" },
  { id: "investimentos", label: "Investimentos", tipo: "saida" },
];

function chaveCat(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

/**
 * Grupo de um lançamento pela categoria do plano de contas.
 * @returns {"faturamento"|"outras_entradas"|"emprestimos_in"|"gastos"|"socios"|"emprestimos_out"|"investimentos"|"fora"}
 */
export function grupoFin(tipo, categoria) {
  const c = chaveCat(categoria);
  if (/^TRANSF|^SALDO|^SAQUE/.test(c)) return "fora";
  if (tipo === "entrada") {
    if (c === "RECEITAS" || c === "RECEITA") return "faturamento";
    if (/^EMPRESTIMO/.test(c)) return "emprestimos_in";
    return "outras_entradas";
  }
  if (/^RETIRADA/.test(c)) return "socios";
  if (/^EMPRESTIMO/.test(c)) return "emprestimos_out";
  if (/^INVESTIMENTO/.test(c)) return "investimentos";
  return "gastos";
}

function mesesEntre(de, ate) {
  const out = []; let [y, m] = de.split("-").map(Number); const [y2, m2] = ate.split("-").map(Number);
  if (!y || !m || !y2 || !m2) return out;
  while ((y < y2 || (y === y2 && m <= m2)) && out.length < 120) { out.push(y + "-" + String(m).padStart(2, "0")); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * Agrega as linhas do caixa (já somadas por mês/tipo/categoria/status) na visão mensal.
 * @param {{ym:string,tipo:string,categoria:string,status:string,v:number}[]} linhas
 * @param {{de:string, ate:string, situacao?:"realizado"|"previsto"|"tudo", categorias?:string[]}} f
 */
export function visaoFinanceira(linhas, f) {
  const meses = mesesEntre(String(f.de || ""), String(f.ate || ""));
  const sit = f.situacao === "previsto" || f.situacao === "tudo" ? f.situacao : "realizado";
  const cats = (f.categorias || []).map(chaveCat).filter(Boolean);
  const vazio = () => Object.fromEntries(GRUPOS_FIN.map((g) => [g.id, 0]));
  const porMes = Object.fromEntries(meses.map((ym) => [ym, vazio()]));
  const porCat = {}, porMesCat = {}, categoriasExistentes = {};
  const tipoFiltrado = {};
  for (const l of linhas || []) if (cats.indexOf(chaveCat(l.categoria)) >= 0) tipoFiltrado[String(l.tipo)] = true;
  for (const l of linhas || []) {
    const st = String(l.status);
    if (st === "cancelado") continue;
    const g = grupoFin(String(l.tipo), l.categoria);
    if (g === "fora") continue;
    categoriasExistentes[String(l.categoria || "(sem categoria)")] = String(l.tipo);
    if (sit !== "tudo" && st !== sit) continue;
    // o filtro de categoria só recorta o lado (entradas/saídas) em que há categoria escolhida:
    // filtrar um gasto não zera o faturamento.
    const ym = String(l.ym); if (!porMes[ym]) continue;
    const v = Number(l.v) || 0;
    // por categoria SEM o filtro de categoria: o gráfico mostra todas (as fora do filtro apagadas)
    if (g === "gastos" || g === "faturamento") {
      const k = String(l.categoria || "(sem categoria)"), chave = g + "|" + k;
      porCat[chave] = (porCat[chave] || 0) + v;
      (porMesCat[ym] = porMesCat[ym] || {})[chave] = ((porMesCat[ym] || {})[chave] || 0) + v;
    }
    if (tipoFiltrado[String(l.tipo)] && cats.indexOf(chaveCat(l.categoria)) < 0) continue;
    porMes[ym][g] += v;
  }
  const tot = vazio();
  const serie = meses.map((ym) => {
    const x = porMes[ym]; for (const k in x) { x[k] = r2(x[k]); tot[k] += x[k]; }
    return { ym, ...x, resultado: r2(x.faturamento - x.gastos) };
  });
  for (const k in tot) tot[k] = r2(tot[k]);
  const resultado = r2(tot.faturamento - tot.gastos);
  const lista = (obj, grupo) => Object.entries(obj).filter(([k]) => k.startsWith(grupo + "|"))
    .map(([k, v]) => ({ categoria: k.slice(grupo.length + 1), v: r2(v) })).sort((a, b) => b.v - a.v);
  return {
    meses: serie, tot, resultado,
    margemPct: tot.faturamento > 0 ? Math.round((resultado / tot.faturamento) * 1000) / 10 : null,
    gastosPorCategoria: lista(porCat, "gastos"), faturamentoPorCategoria: lista(porCat, "faturamento"),
    porMes: Object.fromEntries(Object.entries(porMesCat).map(([ym, o]) => [ym, { gastos: lista(o, "gastos"), faturamento: lista(o, "faturamento") }])),
    categorias: Object.entries(categoriasExistentes).map(([nome, tipo]) => ({ nome, tipo })).sort((a, b) => a.nome.localeCompare(b.nome)),
  };
}
