// RH — lógica PURA do RCF (Responsabilidades, Cargos e Funções) e dos contratos/acordos de
// colaboradores (sem valores monetários). Importada pelo Worker (src/index.ts) e testada em
// test/rh.test.mjs. "hoje" é injetado; nada aqui toca banco ou relógio.

const txt = (v, n) => String(v == null ? "" : v).replace(/\r/g, "").trim().slice(0, n);
const lista = (v, n, max) => (Array.isArray(v) ? v : String(v || "").split("\n")).map((x) => txt(x, n)).filter(Boolean).slice(0, max);
const nivel = (v) => { const s = String(v == null ? "" : v).trim(); return ["-", "1", "2", "3"].includes(s) ? s : "-"; };
const DT = /^\d{4}-\d{2}-\d{2}$/;
const data = (v) => { const s = String(v || "").slice(0, 10); return DT.test(s) ? s : ""; };

/** Escala das matrizes do RCF da casa. */
export const ESCALA_RCF = { "-": "Não se aplica", "1": "Iniciante (necessita supervisão)", "2": "Autonomia (sem supervisão)", "3": "Domínio (treina outras pessoas)" };

/**
 * Normaliza o RCF de um cargo (formato do modelo da casa). Tudo texto; níveis 1–3 por Jr/Pl/Sr.
 * @param {any} r
 */
export function normalizaRcf(r) {
  const o = r && typeof r === "object" ? r : {};
  const niv = o.niveis && typeof o.niveis === "object" ? o.niveis : {};
  const matriz = (v) => (Array.isArray(v) ? v : []).map((x) => ({ item: txt(x && x.item, 200), jr: nivel(x && x.jr), pl: nivel(x && x.pl), sr: nivel(x && x.sr) })).filter((x) => x.item).slice(0, 60);
  const ex = o.exigencias && typeof o.exigencias === "object" ? o.exigencias : {};
  return {
    status: o.status === "aprovado" ? "aprovado" : "rascunho",
    revisao: data(o.revisao),
    subordinacao: txt(o.subordinacao, 160),
    missao: txt(o.missao, 2000),
    indicadores: lista(o.indicadores, 300, 20),
    niveis: { jr: lista(niv.jr, 300, 40), pl: lista(niv.pl, 300, 40), sr: lista(niv.sr, 300, 40) },
    conhecimentos: matriz(o.conhecimentos),
    soft: matriz(o.soft),
    exigencias: { educacao: txt(ex.educacao, 400), experiencia: txt(ex.experiencia, 400), treinamento: txt(ex.treinamento, 400), habilidade: txt(ex.habilidade, 400) },
  };
}

/** RCF vazio? (nada além do status/revisão) */
export function rcfVazio(r) {
  const n = normalizaRcf(r);
  return !n.missao && !n.indicadores.length && !n.niveis.jr.length && !n.niveis.pl.length && !n.niveis.sr.length && !n.conhecimentos.length && !n.soft.length;
}

/**
 * Ciência em dia? A pessoa precisa dar ciência na revisão vigente do RCF do cargo dela.
 * @param {{revisao:string}} rcf
 * @param {Array<{revisao:string}>} ciencias  ciências dessa pessoa nesse cargo
 */
export function cienciaEmDia(rcf, ciencias) {
  const rev = normalizaRcf(rcf).revisao || "";
  return (ciencias || []).some((c) => String(c.revisao || "") === rev);
}

export const TIPOS_CONTRATO = ["CLT", "PJ", "Estágio", "Sócio", "Temporário", "Outro"];
export const TIPOS_ACORDO = ["Banco de horas", "Home office", "Jornada reduzida", "Ajuda de custo", "Bônus / PLR", "Confidencialidade (NDA)", "Outro"];

/**
 * Valida um contrato de colaborador (sem valores). Carga semanal em horas (0–60).
 * @param {any} c
 */
export function validaContrato(c) {
  const o = c && typeof c === "object" ? c : {};
  const tipo = TIPOS_CONTRATO.includes(String(o.tipo)) ? String(o.tipo) : "";
  if (!tipo) throw new Error("Tipo de contrato inválido.");
  const inicio = data(o.inicio);
  if (!inicio) throw new Error("Informe o início do contrato.");
  const fim = data(o.fim);
  if (fim && fim < inicio) throw new Error("O fim do contrato não pode ser antes do início.");
  const carga = Math.round((Number(o.carga_semanal) || 0) * 10) / 10;
  if (!(carga >= 0 && carga <= 60)) throw new Error("Carga semanal deve ficar entre 0 e 60 h.");
  const doc = txt(o.doc_url, 500);
  if (doc && !/^https:\/\//.test(doc)) throw new Error("O link do documento deve começar com https://");
  return { tipo, inicio, fim, renovacao_auto: o.renovacao_auto ? 1 : 0, carga_semanal: carga, doc_url: doc, obs: txt(o.obs, 1000) };
}

/** Valida um acordo (banco de horas, home office, ajuda de custo etc.), sem valores. */
export function validaAcordo(a) {
  const o = a && typeof a === "object" ? a : {};
  const tipo = TIPOS_ACORDO.includes(String(o.tipo)) ? String(o.tipo) : "";
  if (!tipo) throw new Error("Tipo de acordo inválido.");
  const descricao = txt(o.descricao, 1000);
  if (descricao.length < 3) throw new Error("Descreva o acordo.");
  const inicio = data(o.inicio), fim = data(o.fim);
  if (!inicio) throw new Error("Informe o início do acordo.");
  if (fim && fim < inicio) throw new Error("O fim do acordo não pode ser antes do início.");
  const doc = txt(o.doc_url, 500);
  if (doc && !/^https:\/\//.test(doc)) throw new Error("O link do documento deve começar com https://");
  return { tipo, descricao, inicio, fim, doc_url: doc };
}

function dias(de, ate) { return Math.round((Date.parse(ate + "T00:00:00Z") - Date.parse(de + "T00:00:00Z")) / 86400000); }

/**
 * Contrato vigente de uma pessoa na data: o de início mais recente que já começou e não terminou.
 * @param {Array<{inicio:string, fim?:string}>} contratos
 * @param {string} hoje
 */
export function contratoVigente(contratos, hoje) {
  const v = (contratos || []).filter((c) => c.inicio && c.inicio <= hoje && (!c.fim || c.fim >= hoje));
  return v.sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)))[0] || null;
}

/**
 * Alertas de vencimento: vencido (fim < hoje, sem renovação automática), vence em ≤15 dias
 * (crítico) ou ≤30 dias (atenção). Estágio também alerta perto de 2 anos (limite da Lei 11.788).
 * @param {Array<any>} contratos  {id, slug, tipo, inicio, fim, renovacao_auto}
 * @param {Array<any>} acordos    {id, slug, tipo, inicio, fim}
 * @param {string} hoje
 */
export function alertasRh(contratos, acordos, hoje) {
  const out = [];
  const avalia = (x, origem) => {
    if (!x.fim || (origem === "contrato" && Number(x.renovacao_auto))) return;
    const d = dias(hoje, x.fim);
    if (d < 0) out.push({ origem, id: x.id, slug: x.slug, tipo: x.tipo, fim: x.fim, dias: d, nivel: "vencido" });
    else if (d <= 15) out.push({ origem, id: x.id, slug: x.slug, tipo: x.tipo, fim: x.fim, dias: d, nivel: "critico" });
    else if (d <= 30) out.push({ origem, id: x.id, slug: x.slug, tipo: x.tipo, fim: x.fim, dias: d, nivel: "atencao" });
  };
  for (const c of contratos || []) {
    avalia(c, "contrato");
    if (c.tipo === "Estágio" && c.inicio && (!c.fim || c.fim >= hoje)) {
      const limite = new Date(Date.parse(c.inicio + "T00:00:00Z") + 730 * 86400000).toISOString().slice(0, 10);
      const d = dias(hoje, limite);
      if (d <= 60) out.push({ origem: "contrato", id: c.id, slug: c.slug, tipo: "Estágio (limite de 2 anos)", fim: limite, dias: d, nivel: d < 0 ? "vencido" : d <= 15 ? "critico" : "atencao" });
    }
  }
  for (const a of acordos || []) avalia(a, "acordo");
  const ordem = { vencido: 0, critico: 1, atencao: 2 };
  return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel] || a.dias - b.dias);
}
