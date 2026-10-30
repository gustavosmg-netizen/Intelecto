// Importação da planilha "Calendário Engenharia" (aba "Dados Estruturados") — lógica PURA,
// importada pelo Worker (src/index.ts) e testada em test/importa.test.mjs. O navegador lê o .xlsx
// e manda as linhas {d, nome, cc, h}; aqui normalizamos e calculamos o que é NOVO comparando com o
// que o portal já tem, por multiconjunto da chave pessoa|dia|CC|horas (duas linhas iguais na
// planilha = duas no portal). Reimportar a mesma planilha não duplica nada.

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Slug de um nome da planilha ("Léo" -> "leo", "Héctor" -> "hector"), contra o roster do portal. */
export function slugDoNome(nome, roster) {
  const n = semAcento(nome).replace(/\s+/g, " ");
  if (!n) return "";
  for (const [slug, nm] of Object.entries(roster || {})) {
    if (semAcento(slug) === n || semAcento(nm) === n) return slug;
  }
  const primeiro = n.split(" ")[0];
  const porPrimeiro = Object.entries(roster || {}).filter(([slug, nm]) => semAcento(slug) === primeiro || semAcento(nm).split(" ")[0] === primeiro);
  return porPrimeiro.length === 1 ? porPrimeiro[0][0] : "";
}

/** Código do CC a partir do texto "1.2.3.18 - Máquina de ..." (ou só o código). Inválido = "". */
export function ccDoTexto(txt) {
  const m = String(txt || "").trim().match(/^(\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3})(\s|$|-)/);
  return m ? m[1] : "";
}

const DT = /^\d{4}-\d{2}-\d{2}$/;
/** Chave de comparação de um lançamento (horas com 1 casa, como o portal grava). */
export function chave(slug, d, cc, h) {
  return slug + "|" + d + "|" + cc + "|" + (Math.round((Number(h) || 0) * 10) / 10).toFixed(1);
}

/**
 * Normaliza as linhas vindas do navegador e separa as que não dá para importar.
 * @param {Array<{d:string, nome:string, cc:string, h:number}>} linhas
 * @param {Record<string,string>} roster slug -> nome
 * @param {Set<string>|string[]} ccsConhecidos CCs cadastrados no portal
 * @param {string} hoje AAAA-MM-DD (lançamento futuro não entra)
 */
export function normalizaLinhas(linhas, roster, ccsConhecidos, hoje) {
  const ccs = ccsConhecidos instanceof Set ? ccsConhecidos : new Set(ccsConhecidos || []);
  const validas = [], semPessoa = {}, semProjeto = {}, invalidas = { data: 0, horas: 0, cc: 0, futuro: 0 };
  for (const l of linhas || []) {
    const d = String((l && l.d) || "").slice(0, 10);
    const h = Math.round((Number(l && l.h) || 0) * 10) / 10;
    const cc = ccDoTexto(l && l.cc);
    if (!DT.test(d)) { invalidas.data++; continue; }
    if (!(h > 0 && h <= 24)) { invalidas.horas++; continue; }
    if (!cc) { invalidas.cc++; continue; }
    if (hoje && d > hoje) { invalidas.futuro++; continue; }
    const slug = slugDoNome(l.nome, roster);
    if (!slug) { const k = String(l.nome || "(vazio)"); semPessoa[k] = (semPessoa[k] || 0) + 1; continue; }
    if (!ccs.has(cc)) { semProjeto[cc] = (semProjeto[cc] || 0) + 1; continue; }
    validas.push({ slug, d, cc, h });
  }
  return { validas, semPessoa, semProjeto, invalidas };
}

/**
 * O que é novo: para cada chave, (ocorrências na planilha − ocorrências no portal), se positivo.
 * @param {Array<{slug:string,d:string,cc:string,h:number}>} planilha  linhas válidas
 * @param {Array<{slug:string,d:string,cc:string,h:number}>} portal    lançamentos existentes
 * @returns {{novos: Array<{slug:string,d:string,cc:string,h:number}>, jaNoPortal: number}}
 */
export function diffLancamentos(planilha, portal) {
  const cont = new Map();
  for (const x of portal || []) { const k = chave(x.slug, x.d, x.cc, x.h); cont.set(k, (cont.get(k) || 0) + 1); }
  const novos = [];
  let jaNoPortal = 0;
  for (const x of planilha || []) {
    const k = chave(x.slug, x.d, x.cc, x.h);
    const n = cont.get(k) || 0;
    if (n > 0) { cont.set(k, n - 1); jaNoPortal++; } else novos.push(x);
  }
  return { novos, jaNoPortal };
}

/** Resumo por mês (AAAA-MM) e por pessoa das linhas novas, para a prévia. */
export function resumoNovos(novos) {
  const porMes = {}, porPessoa = {};
  let horas = 0;
  for (const x of novos || []) {
    const m = x.d.slice(0, 7);
    porMes[m] = porMes[m] || { n: 0, h: 0 }; porMes[m].n++; porMes[m].h += x.h;
    porPessoa[x.slug] = porPessoa[x.slug] || { n: 0, h: 0 }; porPessoa[x.slug].n++; porPessoa[x.slug].h += x.h;
    horas += x.h;
  }
  const r1 = (o) => { for (const k in o) o[k].h = Math.round(o[k].h * 10) / 10; return o; };
  return { n: (novos || []).length, horas: Math.round(horas * 10) / 10, porMes: r1(porMes), porPessoa: r1(porPessoa) };
}
