// Apropriação de receita e custo indireto por projeto — lógica PURA (sem D1, sem relógio),
// importada pelo Worker (src/index.ts) e testada em test/apropriacao.test.mjs.
//
// Decisões do dono (2026-10-30):
//  - Horas lançadas seguem como custo DIRETO (horas × custo/hora vigente).
//  - Custos fixos são MENSAIS com vigência (desde/ate em AAAA-MM). O pool de cada mês é rateado
//    entre os projetos FATURÁVEIS pela participação nas horas daquele mês (tipo 4 = não faturável
//    fica fora da base). Mês sem horas faturáveis: o pool fica "não absorvido" (reportado).
//  - Contrato RECORRENTE (ex.: IQR): valor mensal com vigência, distribuído entre os projetos do
//    cliente pela participação nas horas do mês. Só meses até o mês de referência (sem receita
//    futura). Mês sem horas do cliente: valor "não apropriado" (reportado, não some).
//  - Projeto sem valor nem horas contratadas = "sem contrato", nunca estouro.

const arred2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Tipo do centro de custo E.C.T.P (3º segmento). */
export function tipoCc(cc) {
  const p = String(cc || "").split(".");
  return p.length === 4 ? Number(p[2]) || 0 : 0;
}
/** Faturável = tipos 1..3 (o tipo 4 é não faturável: apoio, reuniões internas, ausências). */
export function ccFaturavel(cc) {
  const t = tipoCc(cc);
  return t >= 1 && t <= 3;
}

/** Normaliza AAAA-MM (aceita AAAA-MM-DD). Vazio/ inválido = "". */
export function ym(v) {
  const s = String(v || "").slice(0, 7);
  return YM.test(s) ? s : "";
}

/** O item com vigência (desde/ate em AAAA-MM, vazios = aberto) vale no mês m? */
export function vigenteEm(item, m) {
  const de = ym(item && item.desde), ate = ym(item && item.ate);
  if (de && m < de) return false;
  if (ate && m > ate) return false;
  return true;
}

/**
 * Horas por mês e CC a partir das linhas agregadas do banco.
 * @param {Array<{cc:string, mes:string, h:number}>} rows
 * @returns {Record<string, Record<string, number>>} mes -> cc -> horas
 */
export function horasPorMes(rows) {
  const out = {};
  for (const r of rows || []) {
    const m = ym(r.mes), cc = String(r.cc || ""), h = Number(r.h) || 0;
    if (!m || !cc || h <= 0) continue;
    (out[m] = out[m] || {})[cc] = (out[m][cc] || 0) + h;
  }
  return out;
}

/**
 * Rateio mensal dos custos fixos pelas horas faturáveis de cada mês.
 * @param {Array<{valor:number, desde?:string, ate?:string}>} fixos  valores MENSAIS
 * @param {Record<string, Record<string, number>>} hpm  mes -> cc -> horas
 * @param {string} ateMes  último mês considerado (AAAA-MM), inclusive
 * @returns {{byCc: Record<string, number>, absorvido: number, naoAbsorvido: number, meses: Record<string, {pool:number, horas:number}>}}
 */
export function rateioFixosMensal(fixos, hpm, ateMes) {
  const byCc = {}, meses = {};
  let absorvido = 0, naoAbsorvido = 0;
  const limite = ym(ateMes);
  for (const m of Object.keys(hpm || {}).sort()) {
    if (limite && m > limite) continue;
    const pool = (fixos || []).filter((f) => vigenteEm(f, m)).reduce((s, f) => s + (Number(f.valor) || 0), 0);
    if (pool <= 0) continue;
    const base = Object.entries(hpm[m]).filter(([cc]) => ccFaturavel(cc));
    const horas = base.reduce((s, [, h]) => s + h, 0);
    meses[m] = { pool: arred2(pool), horas: arred2(horas) };
    if (horas <= 0) { naoAbsorvido += pool; continue; }
    for (const [cc, h] of base) byCc[cc] = (byCc[cc] || 0) + pool * (h / horas);
    absorvido += pool;
  }
  for (const cc in byCc) byCc[cc] = arred2(byCc[cc]);
  return { byCc, absorvido: arred2(absorvido), naoAbsorvido: arred2(naoAbsorvido), meses };
}

/**
 * Receita de contratos RECORRENTES apropriada por projeto, pelas horas do mês no cliente.
 * @param {Array<{id:string, cliente:string, valor_mensal:number, desde?:string, ate?:string}>} recs
 * @param {Record<string, Record<string, number>>} hpm  mes -> cc -> horas
 * @param {Record<string, string>} clienteDoCc  cc -> cliente
 * @param {string} ateMes  mês de referência (AAAA-MM), inclusive — nada de receita futura
 * @returns {{byCc: Record<string, number>, porContrato: Record<string, {apropriado:number, naoApropriado:number, meses:number}>}}
 */
export function receitaRecorrente(recs, hpm, clienteDoCc, ateMes) {
  const byCc = {}, porContrato = {};
  const limite = ym(ateMes);
  for (const c of recs || []) {
    const vm = Number(c.valor_mensal) || 0;
    const cli = String(c.cliente || "").trim().toUpperCase();
    const de = ym(c.desde);
    const res = { apropriado: 0, naoApropriado: 0, meses: 0 };
    porContrato[c.id] = res;
    if (vm <= 0 || !cli || !de || !limite) continue;
    const ate = ym(c.ate) && ym(c.ate) < limite ? ym(c.ate) : limite;
    for (let m = de; m <= ate; m = proxMes(m)) {
      res.meses++;
      const doCliente = Object.entries((hpm || {})[m] || {}).filter(([cc]) => String(clienteDoCc[cc] || "").trim().toUpperCase() === cli && ccFaturavel(cc));
      const horas = doCliente.reduce((s, [, h]) => s + h, 0);
      if (horas <= 0) { res.naoApropriado += vm; continue; }
      for (const [cc, h] of doCliente) byCc[cc] = (byCc[cc] || 0) + vm * (h / horas);
      res.apropriado += vm;
    }
    res.apropriado = arred2(res.apropriado); res.naoApropriado = arred2(res.naoApropriado);
  }
  for (const cc in byCc) byCc[cc] = arred2(byCc[cc]);
  return { byCc, porContrato };
}

/** Mês seguinte (AAAA-MM). */
export function proxMes(m) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? (y + 1) + "-01" : y + "-" + String(mo + 1).padStart(2, "0");
}

/**
 * Situação de horas de um projeto para o painel: sem contrato nunca vira estouro.
 * @param {number} gastas
 * @param {number} previstas
 * @returns {{situacao: "sem_contrato"|"ok"|"atencao"|"estouro", pct: number|null}}
 */
export function situacaoHoras(gastas, previstas) {
  const g = Number(gastas) || 0, p = Number(previstas) || 0;
  if (p <= 0) return { situacao: "sem_contrato", pct: null };
  const pct = Math.round((g / p) * 1000) / 10;
  return { situacao: g > p ? "estouro" : pct >= 85 ? "atencao" : "ok", pct };
}
