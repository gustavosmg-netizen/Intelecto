// CRM — lógica PURA (sem D1, sem relógio: "hoje" é injetado), compartilhada pelo Worker
// (src/index.ts), pela casca nova (app/src/crm.tsx, via Vite) e pelos testes (test/crm.test.mjs).
// Uma só fonte para fases, movimento entre etapas, tags, filtros salvos e próximo passo.

/** As 6 macro-fases das 21 subetapas do POP-ENG-001 (st 1..21; st 0 = lead fora do funil). */
export const FASES = [
  { id: "prosp", label: "Prospecção & Qualificação", base: 1, lo: 1, hi: 4 },
  { id: "diag", label: "Diagnóstico Técnico", base: 5, lo: 5, hi: 8 },
  { id: "prop", label: "Proposta", base: 9, lo: 9, hi: 12 },
  { id: "neg", label: "Negociação & Contrato", base: 13, lo: 13, hi: 16 },
  { id: "exec", label: "Execução", base: 17, lo: 17, hi: 20 },
  { id: "pos", label: "Pós-venda & Expansão", base: 21, lo: 21, hi: 21 },
];

/** Fase de uma subetapa (null para st fora de 1..21). */
export function faseDeSt(st) {
  const s = Math.floor(Number(st) || 0);
  if (s <= 0) return null;
  const f = FASES.find((x) => s >= x.lo && s <= x.hi);
  return f ? f.id : null;
}

/** Rótulo curto da subetapa: "Proposta · 10" (posição dentro da fase). */
export function rotuloSt(st) {
  const s = Math.floor(Number(st) || 0);
  const f = FASES.find((x) => s >= x.lo && s <= x.hi);
  if (!f) return "Fora do funil";
  return f.label + " · " + (s - f.lo + 1) + "/" + (f.hi - f.lo + 1);
}

/**
 * Para onde vai o negócio ao soltar o cartão. Alvo "fase:<id>" mantém a subetapa se o negócio já
 * está naquela fase (arrastar dentro da mesma coluna não regride) e, senão, cai na 1ª subetapa da
 * fase. Alvo "st:<n>" vai direto à subetapa. Alvo inválido devolve o st atual (não move).
 * @param {number} stAtual
 * @param {string} alvo
 * @returns {number}
 */
export function destinoMovimento(stAtual, alvo) {
  const atual = Math.floor(Number(stAtual) || 0);
  const a = String(alvo || "");
  if (a.startsWith("st:")) {
    const n = Math.floor(Number(a.slice(3)));
    return Number.isFinite(n) && n >= 1 && n <= 21 ? n : atual;
  }
  if (a.startsWith("fase:")) {
    const f = FASES.find((x) => x.id === a.slice(5));
    if (!f) return atual;
    return atual >= f.lo && atual <= f.hi ? atual : f.base;
  }
  return atual;
}

/** Paleta fechada das tags: o servidor só aceita estas chaves (nada de CSS livre vindo do usuário). */
export const CORES_TAG = ["verde", "azul", "ambar", "vermelho", "roxo", "cinza"];

/**
 * Valida e normaliza uma tag. Lança com mensagem legível quando o nome é inválido.
 * @param {unknown} nome
 * @param {unknown} cor
 * @returns {{nome:string, cor:string}}
 */
export function validaTag(nome, cor) {
  const n = String(nome == null ? "" : nome).replace(/\s+/g, " ").trim();
  if (n.length < 1) throw new Error("Dê um nome à tag.");
  if (n.length > 30) throw new Error("Nome de tag com no máximo 30 caracteres.");
  const c = CORES_TAG.includes(String(cor)) ? String(cor) : "cinza";
  return { nome: n, cor: c };
}

const ARR_MAX = 30;
const arr = (v) => (Array.isArray(v) ? v : []).map((x) => String(x == null ? "" : x).trim().slice(0, 80)).filter(Boolean).slice(0, ARR_MAX);
const PRAZOS = ["", "atrasado", "semana", "sem"];

/**
 * Filtro do CRM normalizado: só chaves conhecidas, tamanhos limitados (vai para o banco como JSON).
 * @param {any} f
 * @returns {{q:string, owners:string[], fases:string[], tags:string[], temp:string[], pri:string[], prazo:string}}
 */
export function normalizaFiltro(f) {
  const o = f && typeof f === "object" ? f : {};
  const prazo = PRAZOS.includes(String(o.prazo || "")) ? String(o.prazo || "") : "";
  const fases = arr(o.fases).filter((id) => FASES.some((x) => x.id === id));
  return { q: String(o.q || "").trim().slice(0, 120), owners: arr(o.owners), fases, tags: arr(o.tags), temp: arr(o.temp), pri: arr(o.pri), prazo };
}

/** true se o filtro não restringe nada. */
export function filtroVazio(f) {
  const n = normalizaFiltro(f);
  return !n.q && !n.owners.length && !n.fases.length && !n.tags.length && !n.temp.length && !n.pri.length && !n.prazo;
}

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Soma dias a uma data ISO (AAAA-MM-DD), em UTC. */
function somaDias(iso, n) {
  const t = Date.parse(iso + "T00:00:00Z");
  return Number.isFinite(t) ? new Date(t + n * 86400000).toISOString().slice(0, 10) : iso;
}

/**
 * Aplica o filtro à lista de negócios. Todas as condições se somam (E); dentro de uma lista (ex.:
 * duas fases), qualquer uma vale (OU). Tags: o negócio precisa ter TODAS as tags pedidas.
 * @param {Array<any>} deals
 * @param {any} filtro
 * @param {{dealTags?: Record<string,string[]>, prox?: Record<string,{prazo?:string}>, hoje: string}} ctx
 * @returns {Array<any>}
 */
export function aplicaFiltro(deals, filtro, ctx) {
  const f = normalizaFiltro(filtro);
  const dealTags = (ctx && ctx.dealTags) || {};
  const prox = (ctx && ctx.prox) || {};
  const hoje = String((ctx && ctx.hoje) || "").slice(0, 10);
  const q = semAcento(f.q);
  return (deals || []).filter((d) => {
    if (q) {
      const alvo = semAcento([d.co, d.contact, d.city, d.seg, d.prod, d.owner, d.id, d.cc].join(" "));
      if (!q.split(/\s+/).every((p) => alvo.includes(p))) return false;
    }
    if (f.owners.length && !f.owners.includes(String(d.owner || ""))) return false;
    if (f.fases.length && !f.fases.includes(String(faseDeSt(d.st)))) return false;
    if (f.temp.length && !f.temp.includes(String(d.temp || ""))) return false;
    if (f.pri.length && !f.pri.includes(String(d.pri || ""))) return false;
    if (f.tags.length) {
      const t = dealTags[d.id] || [];
      if (!f.tags.every((x) => t.includes(x))) return false;
    }
    if (f.prazo) {
      const p = prox[d.id] && prox[d.id].prazo ? String(prox[d.id].prazo).slice(0, 10) : "";
      if (f.prazo === "sem") { if (p) return false; }
      else if (!p) return false;
      else if (f.prazo === "atrasado" && !(hoje && p < hoje)) return false;
      else if (f.prazo === "semana" && !(hoje && p >= hoje && p <= somaDias(hoje, 7))) return false;
    }
    return true;
  });
}

/** Tipos de atividade que a pessoa registra; "etapa" é só do sistema (movimento no funil). */
export const TIPOS_ATIVIDADE = ["nota", "ligacao", "reuniao", "email", "tarefa"];

/**
 * Valida uma atividade vinda do formulário. Tarefa exige prazo; data/prazo em AAAA-MM-DD.
 * @param {any} a
 * @returns {{tipo:string, texto:string, data:string, prazo:string, resp:string}}
 */
export function validaAtividade(a) {
  const o = a && typeof a === "object" ? a : {};
  const tipo = TIPOS_ATIVIDADE.includes(String(o.tipo)) ? String(o.tipo) : "";
  if (!tipo) throw new Error("Tipo de atividade inválido.");
  const texto = String(o.texto || "").trim().slice(0, 2000);
  if (texto.length < 2) throw new Error("Descreva a atividade.");
  const dt = (v) => { const s = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; };
  const prazo = dt(o.prazo);
  if (tipo === "tarefa" && !prazo) throw new Error("Próximo passo precisa de prazo.");
  return { tipo, texto, data: dt(o.data), prazo: tipo === "tarefa" ? prazo : "", resp: String(o.resp || "").trim().slice(0, 60) };
}

/**
 * Próximo passo de cada negócio: a tarefa ABERTA de prazo mais cedo.
 * @param {Array<{deal_id:string, tipo:string, feito:any, prazo:string, texto:string, resp?:string, id:string}>} atividades
 * @returns {Record<string, {id:string, prazo:string, texto:string, resp:string}>}
 */
export function proximosPassos(atividades) {
  const out = {};
  for (const a of atividades || []) {
    if (a.tipo !== "tarefa" || Number(a.feito) || !a.prazo) continue;
    const cur = out[a.deal_id];
    if (!cur || String(a.prazo) < cur.prazo) out[a.deal_id] = { id: String(a.id), prazo: String(a.prazo), texto: String(a.texto || ""), resp: String(a.resp || "") };
  }
  return out;
}
