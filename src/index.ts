/**
 * Portal Intelecto & CSTR — Calendário Engenharia + áreas da empresa + documentos.
 * HTTP val: serve o app (index.html), documentos (/d/:slug) e a API em POST /api.
 * Autenticação: senha (hash+salt) → token de sessão. Sem valores monetários — esforço em horas.
 */
import { Hono } from "hono";
import { marked } from "marked";

/* Adaptacao Val Town -> Cloudflare Workers (Rev00 2026-09-10).
   ENV preenchido por middleware app.use("*"). Bindings (wrangler.toml): DB (D1), ASSETS (./public), BLOB (R2, opcional).
   Secrets/vars: RESEND_API_KEY, MAIL_FROM, MAIL_TO, REPO_URL.
   Prover os assets reais do front-end em ./public (index.html, cursos.js, seed.js) recuperados/reconstruidos; ha placeholders para o /api e /mcp ja funcionarem. */
let ENV: any = null;
/* Origem real da requisicao (derivada no SERVIDOR, nunca do cliente), usada para montar
 * o link de recuperacao de senha (T5). Preenchida no middleware app.use("*"). */
let REQ_ORIGIN = "";
const sqlite = {
  async execute(q: any) {
    const sql = typeof q === "string" ? q : q.sql;
    const args = typeof q === "string" ? [] : (q.args || []);
    const st = ENV.DB.prepare(sql);
    const r = await (args.length ? st.bind(...args) : st).all();
    const rows = r.results || [];
    return { rows, columns: rows[0] ? Object.keys(rows[0]) : [], rowsAffected: (r.meta && r.meta.changes) || 0, lastInsertRowid: r.meta ? r.meta.last_row_id : null };
  },
  async batch(list: any[]) {
    const stmts = list.map((q: any) => {
      const sql = typeof q === "string" ? q : q.sql;
      const args = typeof q === "string" ? [] : (q.args || []);
      const st = ENV.DB.prepare(sql);
      return args.length ? st.bind(...args) : st;
    });
    return ENV.DB.batch(stmts);
  },
};
const blob = {
  async get(key: string) { if (!ENV.BLOB) return null; const o = await ENV.BLOB.get(key); return o ? { body: o.body } : null; },
  async set(key: string, val: any) { if (ENV.BLOB) await ENV.BLOB.put(key, val); },
  async delete(key: string) { if (ENV.BLOB) await ENV.BLOB.delete(key); },
};
async function readFile(path: string, _base?: any): Promise<string> {
  const res = await ENV.ASSETS.fetch(new URL("https://assets" + path));
  if (!res.ok) throw new Error("asset nao encontrado: " + path);
  return await res.text();
}
async function email(opts: any) {
  if (!ENV || !ENV.RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + ENV.RESEND_API_KEY, "content-type": "application/json" }, body: JSON.stringify({ from: ENV.MAIL_FROM || "portal@intelecto.local", to: opts.to || ENV.MAIL_TO || "", subject: opts.subject, text: opts.text }) });
}
/** Base de URL do portal para links de e-mail (recuperacao de senha, T5). Ordem: var de
 *  ambiente PORTAL_URL/BASE_URL -> origem real da requisicao (derivada no servidor) ->
 *  dominio dedicado do portal. Nunca usa valor vindo do cliente (evita link de phishing). */
function portalBase(): string {
  const env = ENV && (ENV.PORTAL_URL || ENV.BASE_URL);
  const b = String(env || REQ_ORIGIN || "https://portal.intelecto-eng.com.br").trim();
  return b.replace(/\/+$/, "");
}

const COLABS = ["angelo","bruno","caio","cecilia","david","gabriel","gabriela","gustavo","hector","lucas","leo","nilson","pedro","rafaela","raphael","marcelo","rodrigo","viviane","ananda"];
const NOMES: Record<string, string> = { angelo:"Angelo", bruno:"Bruno", caio:"Caio", cecilia:"Cecília", david:"David", gabriel:"Gabriel", gabriela:"Gabriela", gustavo:"Gustavo", hector:"Héctor", lucas:"Lucas", leo:"Léo", nilson:"Nilson", pedro:"Pedro", rafaela:"Rafaela", raphael:"Raphael", marcelo:"Marcelo", rodrigo:"Rodrigo", viviane:"Viviane", ananda:"Ananda" };
/** Pessoas das áreas de apoio: lançam horas e cuidam da própria área, sem o painel técnico. */
const AREA_DE: Record<string, string> = { marcelo: "comercial", rodrigo: "juridico", viviane: "financeiro" };
/** Centro de custo de rateio de cada área de apoio (não faturável, empresa/cliente INTELECTO). */
const CC_AREA: Record<string, string> = { comercial: "1.1.4.9", juridico: "1.1.4.10", financeiro: "1.1.4.11" };
const COORDS = ["gustavo", "bruno", "caio", "ananda"];
/** Dono do portal: unico que ve a aba Permissoes e concede acessos confidenciais. */
const OWNER = ["gustavo"];
function isOwner(slug: string): boolean { return OWNER.includes(slug); }

/* ---------- Multi-tenant e papel formal (T1 — espinha dorsal) ----------
 * O isolamento entre empresas e o tenant_id no SERVIDOR (filtro em toda query, T2),
 * nunca a UI. Hoje so o tenant Intelecto esta ativo: todo legado e dele. */
const TENANT_INTELECTO = "intelecto";
/** Papeis: 4 aninhados (admin > coordenacao > equipe > cliente) + fornecedor LATERAL. */
type Papel = "admin" | "coordenacao" | "equipe" | "cliente" | "fornecedor";
const PAPEIS: Papel[] = ["admin", "coordenacao", "equipe", "cliente", "fornecedor"];
/** Posto na cadeia aninhada. Fornecedor fica fora (sentinela -1): nao herda nada de cima. */
const PAPEL_RANK: Record<string, number> = { cliente: 0, equipe: 1, coordenacao: 2, admin: 3 };
function papelRank(papel: string): number { return papel in PAPEL_RANK ? PAPEL_RANK[papel] : -1; }
/** Rotulo legivel do papel para a casca (Hub/Perfil). So apresentacao — a autorizacao e MIN. */
const PAPEL_LABEL: Record<string, string> = { admin: "Administração", coordenacao: "Coordenação", equipe: "Equipe", cliente: "Cliente", fornecedor: "Fornecedor" };
/** Contrato de autorizacao para T2: "papel tem pelo menos o papel minimo exigido pela acao".
 *  Aninhados comparam por posto; fornecedor so satisfaz uma exigencia de fornecedor (lateral). */
function temPapelMinimo(papel: string, minimo: Papel): boolean {
  if (papel === "fornecedor" || minimo === "fornecedor") return papel === minimo;
  return papelRank(papel) >= papelRank(minimo);
}
/** Papel inferido dos antigos conjuntos de slug — semente do backfill de `membro` e
 *  fallback seguro de auth() caso a linha de membro ainda nao exista. Mapa dos 3 perfis:
 *  OWNER->admin; COORDS->coordenacao; demais (tecnicos + apoio) -> equipe. */
function papelInferido(slug: string): Papel {
  if (OWNER.includes(slug)) return "admin";
  if (COORDS.includes(slug)) return "coordenacao";
  return "equipe";
}
/** Areas confidenciais controladas pelo dono na aba Permissoes (allow list em config perm:<area>). */
const AREAS_PROT: [string, string][] = [
  ["escritorio", "Escritorio de IA"],
  ["financeiro_conf", "Financeiro (confidencial)"],
  ["propostas", "Propostas comerciais"],
  ["contratos", "Contratos"],
];
const AREAS_PROT_COD = AREAS_PROT.map((a) => a[0]);
/** Ferramentas do MCP que leem o acervo/biblioteca confidencial (aulas, normas, estudos, cursos).
 *  portfolio e agenda entram aqui por devolverem dado interno da casa (centros de custo, responsaveis,
 *  locais e observacoes de eventos); sem isso qualquer token MCP valido os lia sem checagem de permissao. */
const ACERVO_TOOLS = ["acervo_search","buscar_norma","buscar_referencia","buscar_precedente","ficha","parametro","conhecimento","portfolio","agenda"];

/* ---------- DAILY BRIEF — radar com triagem por IA (inteligencia INTERNA) ----------
 * Modelo de texto do Workers AI (binding env.AI). A chave/binding vive SO no servidor;
 * o front nunca fala com a IA. Troca de modelo = trocar esta constante. */
const BRIEF_MODELO = "@cf/meta/llama-3.1-8b-instruct";
/** As 4 areas-foco da triagem. Codigo curto -> rotulo (o rotulo e so apresentacao). */
const BRIEF_AREAS: Record<string, string> = {
  san: "Saneamento / Meio Ambiente",
  min: "Mineracao",
  pd: "P&D / Fomento",
  bio: "Biogas / Bioeconomia",
};
const BRIEF_AREA_COD = Object.keys(BRIEF_AREAS);
/** Categorias do radar (tabela `brief_fonte` e coluna `brief.categoria`). Codigo -> rotulo. O
 *  `tipo` (coluna legada, CHECK edital|noticia) deriva da categoria: so 'edital' vira 'edital',
 *  o resto vira 'noticia'. Assim o feed mais rico (artigos, licenciamento, outros) convive com
 *  a restricao antiga sem migracao destrutiva. */
const BRIEF_CATEGORIAS: Record<string, string> = {
  noticia: "Notícia do setor",
  edital: "Edital",
  artigo: "Artigo científico",
  licenciamento: "Licenciamento ambiental",
  outro: "Outros",
};
const BRIEF_CAT_COD = Object.keys(BRIEF_CATEGORIAS);
/** Normaliza uma categoria livre ao conjunto fechado; default 'noticia'. */
function briefCat(raw: any): string { const c = String(raw || "").trim().toLowerCase(); return BRIEF_CAT_COD.includes(c) ? c : "noticia"; }
/** Mapeia categoria -> `tipo` legado (satisfaz o CHECK da tabela `brief`). */
function catToTipo(cat: string): "edital" | "noticia" { return briefCat(cat) === "edital" ? "edital" : "noticia"; }
/** Cadencias de coleta e o intervalo (ms) a partir do qual uma fonte volta a ser "devida". Folga
 *  embutida (ex.: "diaria" reexecuta apos ~20h) para o tick diario do cron pegar a fonte sem pular dia. */
const BRIEF_CADENCIAS: Record<string, number> = {
  diaria: 20 * 3600e3,
  semanal: 6.5 * 86400e3,
  mensal: 29 * 86400e3,
};
function briefCadencia(raw: any): string { const c = String(raw || "").trim().toLowerCase(); return BRIEF_CADENCIAS[c] ? c : "semanal"; }
/** Tipos de parse de fonte: rss/atom, json (feed) ou html (pagina inteira como 1 item). */
const BRIEF_FONTE_TIPOS = ["rss", "json", "html"];
function briefFonteTipo(raw: any): string { const t = String(raw || "").trim().toLowerCase(); return BRIEF_FONTE_TIPOS.includes(t) ? t : "rss"; }
/** CATALOGO-SEMENTE das fontes do radar: nasce DESLIGADO (ativo=0) e SEM URL. Nada e buscado ate
 *  a Coordenacao preencher a URL e ativar na aba Fontes. Nao inventamos endpoints: a casa cola a
 *  fonte oficial/feed que confia. Preferir feeds/APIs oficiais (RSS) ao scraping de HTML. */
const BRIEF_FONTES_SEED = [
  { id: "noticias-setor", nome: "Notícias do setor (saneamento/ambiente)", url: "", categoria: "noticia", tipo_fonte: "rss", cadencia: "semanal", area: "san" },
  { id: "editais-fomento", nome: "Editais de fomento (Finep/CNPq/FAPEMIG)", url: "", categoria: "edital", tipo_fonte: "rss", cadencia: "semanal", area: "pd" },
  { id: "licenciamento-mg", nome: "Licenciamento ambiental (SEMAD/COPAM-MG)", url: "", categoria: "licenciamento", tipo_fonte: "html", cadencia: "semanal", area: "san" },
  { id: "artigos-cientificos", nome: "Artigos científicos (água/efluentes/biogás)", url: "", categoria: "artigo", tipo_fonte: "rss", cadencia: "mensal", area: "bio" },
  { id: "mineracao", nome: "Notícias de mineração (Vale/Samarco/rejeito)", url: "", categoria: "noticia", tipo_fonte: "rss", cadencia: "semanal", area: "min" },
];
/** Normaliza as areas devolvidas pela IA para o conjunto fechado san|min|pd|bio (sem duplicar). */
function normBriefAreas(raw: any): string {
  const arr = Array.isArray(raw) ? raw : String(raw || "").split(/[\s,;|]+/);
  const out: string[] = [];
  for (const a of arr) { const c = String(a || "").trim().toLowerCase(); if (BRIEF_AREA_COD.includes(c) && !out.includes(c)) out.push(c); }
  return out.join(",");
}
/** Baixa o conteudo textual de uma URL (server-side; CSP do browser nao se aplica aqui).
 *  Resiliente: qualquer falha devolve "" e o fluxo exige o texto colado — nunca derruba a req. */
async function briefFetch(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; IntelectoBrief/1.0)" }, redirect: "follow" });
    if (!res.ok) return "";
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!/text|html|json|xml|application\/xhtml/.test(ct)) return "";
    let t = await res.text();
    t = t.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
         .replace(/<\/(p|div|br|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, " ")
         .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
         .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return t.slice(0, 7000);
  } catch (_) { return ""; }
}
/** Triagem por IA: a partir do conteudo, devolve resumo curto, Impact Score 0-100, tags e
 *  area(s). Toda falha (binding ausente em dev, timeout, JSON invalido) cai em null — o
 *  chamador grava o item marcado "A_TRIAR", sem score/resumo, SEM derrubar a requisicao. */
async function triagemIA(conteudo: string, tipo: string): Promise<{ titulo: string; resumo: string; score: number; tags: string; area: string } | null> {
  try {
    if (!ENV || !ENV.AI || typeof ENV.AI.run !== "function") return null;
    const sys = "Voce e o analista de radar da Intelecto & CSTR, engenharia ambiental e mineroindustrial. " +
      "Avalie a relevancia de um " + (tipo === "edital" ? "edital/chamada" : "noticia") + " para 4 focos: " +
      "(1) san = saneamento/meio ambiente (ETE/ETA, efluentes, licenciamento, recursos hidricos); " +
      "(2) min = mineracao (Vale, Samarco, rejeito); (3) pd = P&D/fomento (Finep, inovacao); " +
      "(4) bio = biogas/bioeconomia (CSTR). Responda SOMENTE um objeto JSON, sem texto fora dele, com as chaves: " +
      "titulo (string curta), resumo (1-2 frases factuais em portugues), score (inteiro 0-100 de relevancia para os focos), " +
      "tags (array de 2-5 palavras-chave), area (array com os codigos aplicaveis dentre san,min,pd,bio). " +
      "Sem nenhum valor monetario no resumo ou nas tags.";
    const usr = "Conteudo a triar:\n\n" + conteudo.slice(0, 6000);
    const r: any = await ENV.AI.run(BRIEF_MODELO, {
      messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
      max_tokens: 600, temperature: 0.2,
    });
    const txt = String((r && (r.response ?? (r.result && r.result.response))) || "");
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    let score = Math.round(Number(j.score));
    if (!Number.isFinite(score)) score = 0;
    score = Math.max(0, Math.min(100, score));
    const tags = (Array.isArray(j.tags) ? j.tags : String(j.tags || "").split(/[,;]+/))
      .map((x: any) => String(x || "").trim()).filter(Boolean).slice(0, 6).join(", ");
    return {
      titulo: String(j.titulo || "").trim().slice(0, 240),
      resumo: String(j.resumo || "").trim().slice(0, 1200),
      score, tags: tags.slice(0, 300), area: normBriefAreas(j.area),
    };
  } catch (_) { return null; }
}
/** Concessao de acervo (config acgrant:<slug>): "" sem acesso | "PERM" permanente | AAAA-MM-DD temporaria ate a data (inclusive). */
function grantValid(v: string | null): boolean {
  if (!v) return false;
  if (v === "PERM") return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const hoje = new Date().toISOString().slice(0, 10); return hoje <= v; }
  return false;
}
const ESCRITORIO_B64 = "PCFkb2N0eXBlIGh0bWw+PGh0bWwgbGFuZz0icHQtYnIiPjxoZWFkPjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij48bWV0YSBuYW1lPSJ2aWV3cG9ydCIgY29udGVudD0id2lkdGg9ZGV2aWNlLXdpZHRoLGluaXRpYWwtc2NhbGU9MSI+PHRpdGxlPkVzY3JpdMOzcmlvIGRlIElBPC90aXRsZT4KPGxpbmsgcmVsPSJwcmVjb25uZWN0IiBocmVmPSJodHRwczovL2ZvbnRzLmdvb2dsZWFwaXMuY29tIj48bGluayByZWw9InByZWNvbm5lY3QiIGhyZWY9Imh0dHBzOi8vZm9udHMuZ3N0YXRpYy5jb20iIGNyb3Nzb3JpZ2luPgo8bGluayByZWw9InN0eWxlc2hlZXQiIGhyZWY9Imh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzMj9mYW1pbHk9SUJNK1BsZXgrU2Fuczp3Z2h0QDQwMDs1MDA7NjAwOzcwMCZmYW1pbHk9SUJNK1BsZXgrTW9ubzp3Z2h0QDQwMDs1MDAmZGlzcGxheT1zd2FwIj4KPHN0eWxlPgo6cm9vdHsKICAtLWJnOiNlNmVjZTc7LS1wYW5lbDojZjZmYWY2Oy0tc3VyZmFjZTojZmZmZmZmOy0taW5rOiMxMjIzMWE7LS1tdXRlZDojNWM2YjYxOy0tbGluZTojZDNkZGQzOwogIC0tYWNjZW50OiMxZjdhM2Q7LS1hY2NlbnQtZGFyazojMTU1YzJjOy0tYWNjZW50LXNvZnQ6I2UzZjBlODstLW9rOiMxZjkwNDg7LS13YWl0OiMwYTZlOGE7LS13YXJuOiNjMDc4MDA7CiAgLS1tb25vOiJJQk0gUGxleCBNb25vIix1aS1tb25vc3BhY2UsTWVubG8sbW9ub3NwYWNlOy0tc2FuczoiSUJNIFBsZXggU2FucyIsc3lzdGVtLXVpLC1hcHBsZS1zeXN0ZW0sU2Vnb2UgVUksUm9ib3RvLHNhbnMtc2VyaWY7Cn0KQG1lZGlhIChwcmVmZXJzLWNvbG9yLXNjaGVtZTpkYXJrKXs6cm9vdDpub3QoW2RhdGEtdGhlbWU9ImxpZ2h0Il0pewogIC0tYmc6IzBiMTEwZTstLXBhbmVsOiMxMDE5MTU7LS1zdXJmYWNlOiMxNjIxMWI7LS1pbms6I2U3ZWZlOTstLW11dGVkOiM5Y2FkYTM7LS1saW5lOiMyMjMwMmE7CiAgLS1hY2NlbnQ6IzQwYTg2NTstLWFjY2VudC1kYXJrOiMyYzhmNTA7LS1hY2NlbnQtc29mdDojMTYyODFkOy0tb2s6IzQwYTg2NTstLXdhaXQ6IzNhYTdjNDstLXdhcm46I2Q3OTIzNjsKfX0KOnJvb3RbZGF0YS10aGVtZT0iZGFyayJdewogIC0tYmc6IzBiMTEwZTstLXBhbmVsOiMxMDE5MTU7LS1zdXJmYWNlOiMxNjIxMWI7LS1pbms6I2U3ZWZlOTstLW11dGVkOiM5Y2FkYTM7LS1saW5lOiMyMjMwMmE7CiAgLS1hY2NlbnQ6IzQwYTg2NTstLWFjY2VudC1kYXJrOiMyYzhmNTA7LS1hY2NlbnQtc29mdDojMTYyODFkOy0tb2s6IzQwYTg2NTstLXdhaXQ6IzNhYTdjNDstLXdhcm46I2Q3OTIzNjsKfQoqe2JveC1zaXppbmc6Ym9yZGVyLWJveH0KYm9keXttYXJnaW46MDtiYWNrZ3JvdW5kOnZhcigtLWJnKTtjb2xvcjp2YXIoLS1pbmspO2ZvbnQtZmFtaWx5OnZhcigtLXNhbnMpO2xpbmUtaGVpZ2h0OjEuNTstd2Via2l0LWZvbnQtc21vb3RoaW5nOmFudGlhbGlhc2VkfQoud3JhcHttYXgtd2lkdGg6MTEyMHB4O21hcmdpbjowIGF1dG87cGFkZGluZzoyMnB4IDE2cHggNjBweH0KaGVhZGVyLmhke21hcmdpbi1ib3R0b206MTRweH0KLmhkIGgxe2ZvbnQtc2l6ZToxLjVyZW07bWFyZ2luOjAgMCA0cHg7bGV0dGVyLXNwYWNpbmc6LS4wMWVtfQouaGQgcHttYXJnaW46MDtjb2xvcjp2YXIoLS1tdXRlZCk7bWF4LXdpZHRoOjcwY2h9Ci5ub3Rle21hcmdpbjoxMnB4IDAgMDtwYWRkaW5nOjEwcHggMTJweDtiYWNrZ3JvdW5kOnZhcigtLWFjY2VudC1zb2Z0KTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6MTBweDtmb250LXNpemU6LjlyZW19Ci5ub3RlIGJ7Y29sb3I6dmFyKC0tYWNjZW50LWRhcmspfQoudG9vbHN7cG9zaXRpb246c3RpY2t5O3RvcDowO2JhY2tncm91bmQ6dmFyKC0tYmcpO3BhZGRpbmc6MTJweCAwO3otaW5kZXg6NTtkaXNwbGF5OmZsZXg7Z2FwOjhweDtmbGV4LXdyYXA6d3JhcDthbGlnbi1pdGVtczpjZW50ZXJ9CiNxe2ZsZXg6MTttaW4td2lkdGg6MjAwcHg7cGFkZGluZzoxMHB4IDEycHg7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOjEwcHg7YmFja2dyb3VuZDp2YXIoLS1zdXJmYWNlKTtjb2xvcjp2YXIoLS1pbmspO2ZvbnQ6aW5oZXJpdH0KLmNoaXB7cGFkZGluZzo3cHggMTJweDtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6OTk5cHg7YmFja2dyb3VuZDp2YXIoLS1zdXJmYWNlKTtjb2xvcjp2YXIoLS1tdXRlZCk7Y3Vyc29yOnBvaW50ZXI7Zm9udC1zaXplOi44NXJlbTt1c2VyLXNlbGVjdDpub25lfQouY2hpcC5vbntiYWNrZ3JvdW5kOnZhcigtLWFjY2VudCk7Ym9yZGVyLWNvbG9yOnZhcigtLWFjY2VudCk7Y29sb3I6I2ZmZn0KLmNvdW50e2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6Ljg1cmVtO21hcmdpbi1sZWZ0OmF1dG99CnNlY3Rpb24uZ3Jwe21hcmdpbjoxOHB4IDAgMH0Kc2VjdGlvbi5ncnA+aDJ7Zm9udC1zaXplOjFyZW07bWFyZ2luOjAgMCAycHg7Y29sb3I6dmFyKC0tYWNjZW50LWRhcmspO2Rpc3BsYXk6ZmxleDtnYXA6OHB4O2FsaWduLWl0ZW1zOmJhc2VsaW5lfQpzZWN0aW9uLmdycD5oMiBzbWFsbHtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC13ZWlnaHQ6NTAwO2ZvbnQtc2l6ZTouOHJlbX0Kc2VjdGlvbi5ncnA+LmdkZXNje2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6Ljg2cmVtO21hcmdpbjowIDAgMTBweH0KLmdyaWR7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoYXV0by1maWxsLG1pbm1heCgzMDBweCwxZnIpKTtnYXA6MTBweH0KLmNhcmR7YmFja2dyb3VuZDp2YXIoLS1zdXJmYWNlKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6MTJweDtwYWRkaW5nOjEzcHggMTRweDtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDo3cHh9Ci5jYXJkIGgze21hcmdpbjowO2ZvbnQtc2l6ZTouOThyZW07ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6N3B4fQouY2FyZCAudGFne2ZvbnQtZmFtaWx5OnZhcigtLW1vbm8pO2ZvbnQtc2l6ZTouN3JlbTtwYWRkaW5nOjJweCA3cHg7Ym9yZGVyLXJhZGl1czo5OTlweDtiYWNrZ3JvdW5kOnZhcigtLWFjY2VudC1zb2Z0KTtjb2xvcjp2YXIoLS1hY2NlbnQtZGFyayk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTt3aGl0ZS1zcGFjZTpub3dyYXB9Ci5jYXJkIC50YWcucm97YmFja2dyb3VuZDp0cmFuc3BhcmVudDtjb2xvcjp2YXIoLS13YWl0KX0KLmNhcmQgLmt7Zm9udC1mYW1pbHk6dmFyKC0tbW9ubyk7Zm9udC1zaXplOi43OHJlbTtjb2xvcjp2YXIoLS1tdXRlZCk7d29yZC1icmVhazpicmVhay1hbGx9Ci5jYXJkIC5ke2ZvbnQtc2l6ZTouOXJlbX0KLmNhcmQgLnVzZXtmb250LXNpemU6Ljg0cmVtO2NvbG9yOnZhcigtLW11dGVkKX0KLmNhcmQgLnVzZSBie2NvbG9yOnZhcigtLWluayk7Zm9udC13ZWlnaHQ6NjAwfQouaGlkZGVue2Rpc3BsYXk6bm9uZSAhaW1wb3J0YW50fQouZW1wdHl7Y29sb3I6dmFyKC0tbXV0ZWQpO3BhZGRpbmc6MzBweDt0ZXh0LWFsaWduOmNlbnRlcn0KZm9vdGVye21hcmdpbi10b3A6MjhweDtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOi44cmVtO2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWxpbmUpO3BhZGRpbmctdG9wOjEycHh9Cjwvc3R5bGU+PC9oZWFkPgo8Ym9keT48ZGl2IGNsYXNzPSJ3cmFwIj4KPGhlYWRlciBjbGFzcz0iaGQiPgogIDxoMT5Fc2NyaXTDs3JpbyBkZSBJQTwvaDE+CiAgPHA+Q2F0w6Fsb2dvIHZpdm8gZG9zIGFnZW50ZXMgZSBza2lsbHMgZGEgY2FzYTogbyBxdWUgY2FkYSB1bSBmYXosIHF1YW5kbyB1c2FyIGUgY29tbyBkaXNwYXJhci4gVXNlIGEgYnVzY2Egb3Ugb3MgZmlsdHJvcyBwYXJhIGFjaGFyIGEgZmVycmFtZW50YSBjZXJ0YSBwYXJhIG8gdHJhYmFsaG8uPC9wPgogIDxkaXYgY2xhc3M9Im5vdGUiPjxiPkNvbW8gZnVuY2lvbmE6PC9iPiBlc3RlcyBhZ2VudGVzIGUgc2tpbGxzIHJvZGFtIG5vIDxiPkNsYXVkZSBDb2RlPC9iPiAoZSBubyBwbHVnaW4gPHNwYW4gY2xhc3M9ImsiPmludGVsZWN0by1lbmdlbmhhcmlhPC9zcGFuPiksIG7Do28gZGVudHJvIGRvIHBvcnRhbC4gUGFyYSBkaXNwYXJhciwgbm8gQ2xhdWRlIENvZGUgcGXDp2EgcGVsbyBub21lIChleC46IDxpPiJ1c2UgbyBhZ2VudGUgaW50ZWxlY3RvLW1lbW9yaWFsaXN0YSI8L2k+KSBvdSBkZWl4ZSBvIDxiPk9ycXVlc3RyYWRvcjwvYj4gcm90ZWFyLiBBcyB0b29scyBkbyBNQ1AgPHNwYW4gY2xhc3M9ImsiPmludGVsZWN0by1ub3JtYXM8L3NwYW4+IHJlc3BvbmRlbSBkaXJldG8gbmEgY29udmVyc2EgcXVhbmRvIG8gY29uZWN0b3IgZXN0w6EgYXRpdm8uPC9kaXY+CjwvaGVhZGVyPgo8ZGl2IGNsYXNzPSJ0b29scyI+CiAgPGlucHV0IGlkPSJxIiB0eXBlPSJzZWFyY2giIHBsYWNlaG9sZGVyPSJCdXNjYXIgYWdlbnRlLCBza2lsbCwgbm9ybWEsIGRvbcOtbmlvLi4uIiBhdXRvY29tcGxldGU9Im9mZiI+CiAgPHNwYW4gY2xhc3M9ImNoaXAgb24iIGRhdGEtZj0iYWxsIj5UdWRvPC9zcGFuPgogIDxzcGFuIGNsYXNzPSJjaGlwIiBkYXRhLWY9ImFnZW50ZSI+QWdlbnRlczwvc3Bhbj4KICA8c3BhbiBjbGFzcz0iY2hpcCIgZGF0YS1mPSJ2ZXJpZmljYWRvciI+VmVyaWZpY2HDp8Ojbzwvc3Bhbj4KICA8c3BhbiBjbGFzcz0iY2hpcCIgZGF0YS1mPSJza2lsbCI+U2tpbGxzPC9zcGFuPgogIDxzcGFuIGNsYXNzPSJjaGlwIiBkYXRhLWY9ImNhZCI+Q0FEL1AmYW1wO0lEPC9zcGFuPgogIDxzcGFuIGNsYXNzPSJjaGlwIiBkYXRhLWY9Im1jcCI+TUNQPC9zcGFuPgogIDxzcGFuIGNsYXNzPSJjb3VudCIgaWQ9ImNvdW50Ij48L3NwYW4+CjwvZGl2Pgo8ZGl2IGlkPSJsaXN0Ij48L2Rpdj4KPGZvb3Rlcj5DYXTDoWxvZ28gZ2VyYWRvIGRvIGludmVudMOhcmlvIGRvIHBsdWdpbiA8c3BhbiBjbGFzcz0iayI+aW50ZWxlY3RvLWVuZ2VuaGFyaWE8L3NwYW4+LiBGb250ZSBkYSB2ZXJkYWRlIGRvcyBjb21wb3J0YW1lbnRvczogYXMgZGVmaW5pw6fDtWVzIGRlIGNhZGEgYWdlbnRlIGUgc2tpbGwuIEF0dWFsaXplIGVzdGUgY2F0w6Fsb2dvIHF1YW5kbyBhZ2VudGVzL3NraWxscyBmb3JlbSBhZGljaW9uYWRvcyBvdSBtdWRhcmVtIGRlIGVzY29wby48L2Zvb3Rlcj4KPC9kaXY+CjxzY3JpcHQ+CmNvbnN0IERBVEE9Wwp7ZzoiT3JxdWVzdHJhw6fDo28iLGY6ImFnZW50ZSIsaXRlbXM6Wwoge246ImludGVsZWN0by1vcnF1ZXN0cmFkb3IiLGs6ImFnZW50ZSIsZDoiUmVjZWJlIHF1YWxxdWVyIHBlZGlkbyBkZSB0cmFiYWxobyBlIHJvdGVpYSBwYXJhIG8gY29tYm8gY2VydG8gZGUgc2tpbGxzIGUgYWdlbnRlcywgbmEgb3JkZW0gY2VydGEsIGdhcmFudGluZG8gbyBQT1AtRU5HLTAwMSBlIG8gQ3Jpdm8gQS1GLiIsdToiTm8gaW7DrWNpbyBkZSB1bSB0cmFiYWxobyBub3ZvLCBhbXBsbyBvdSBtdWx0aWRpc2NpcGxpbmFyLCBvdSBxdWFuZG8gbsOjbyBlc3TDoSBjbGFybyBwb3Igb25kZSBjb21lw6dhci4ifQpdfSwKe2c6IkFnZW50ZXMgZXhlY3V0b3JlcyIsZjoiYWdlbnRlIixpdGVtczpbCiB7bjoiaW50ZWxlY3RvLW1lbW9yaWFsaXN0YSIsazoiYWdlbnRlIixkOiJQcm9kdXogbWVtb3JpYWwgZGUgY8OhbGN1bG8gZSBkZXNjcml0aXZvLCBkbyBncmF1IGRlIGxpYmVyZGFkZSBhbyB0ZXh0byBmaW5hbCwgY29tIHJhc3RyZWFiaWxpZGFkZSBkbyBkYWRvIGFvIHBhcsOhZ3JhZm8uIix1OiJGZWNoYXIgdW0gbWVtb3JpYWwuIERldm9sdmUgYW8gcmV2aXNvciBpbmRlcGVuZGVudGU7IG7Do28gbGliZXJhIG8gcHLDs3ByaW8gdHJhYmFsaG8uIn0sCiB7bjoiaW50ZWxlY3RvLXByb2pldGlzdGEtZHdnIixrOiJhZ2VudGUiLGQ6IkzDqiwgZXh0cmFpLCBjb21wYXJhIGUgZ2VyYSBwcmFuY2hhIERXRy9EWEYsIGNvcnRlcywgbGF5b3V0IGUgdmVyaWZpY2HDp8OjbyBkZSBsb2Nhw6fDo28gZSBjb3RhcywgY29tIGNvb3JkZW5hZGEgZSBsYXllciByYXN0cmXDoXZlaXMuIix1OiJFeHRyYWlyIGRhZG9zIGRlIHByYW5jaGEsIG91IGdlcmFyIHByYW5jaGEgYSBwYXJ0aXIgZGUgbWVtb3JpYWwgZmVjaGFkby4ifSwKIHtuOiJpbnRlbGVjdG8tbW9kZWxhZG9yLTNkIixrOiJhZ2VudGUiLGQ6IlJlZ2VyYSBvIG1vZGVsbyAzRCBnZW9ycmVmZXJlbmNpYWRvIChleGVjdXRpdm9fRzIuanNvbiArIEhUTUwpIGEgcGFydGlyIGRlIHRlcnJlbm8ucHksIGFycmFuam8ucHkgZSByZWRlLnB5LiIsdToiQ29ycmlnaXIgbyBtb2RlbG8gM0QgcXVlIG8gdmVyaWZpY2Fkb3ItM2QgcmVwcm92b3UgKHJlYW1vc3RyYXIgdGVycmVubywgaW5jbHVpciB0cmVjaG9zKS4ifSwKIHtuOiJpbnRlbGVjdG8tZ2VzdG9yLWVudHJlZ2F2ZWlzIixrOiJhZ2VudGUiLGQ6Ik9yZ2FuaXphIG8gcGFjb3RlIGRlIGVudHJlZ2Egbm8gcGFkcsOjbywgaWRlbnRpZmljYSBhIHJldmlzw6NvIHZpZ2VudGUsIHRlc3RhIGEgYWJlcnR1cmEgZGUgY2FkYSBhcnF1aXZvIGUgY29udmVydGUgRFdHIGNvbSBsYXVkbyByb3VuZC10cmlwLiBDb3BpYSBlIGFycXVpdmEsIG51bmNhIG1vdmUgbmVtIGFwYWdhLiIsdToiTW9udGFyIHBhc3RhIGRlIGVudmlvLCByZXNvbHZlciBxdWFsIHJldmlzw6NvIHZhbGUsIGVudHJlZ2FyIGVtIERXRy4ifSwKIHtuOiJpbnRlbGVjdG8tZGVzaWduLWVkaXRvcmlhbCIsazoiYWdlbnRlIixkOiJBcGxpY2EgZSBhdWRpdGEgbyBhY2FiYW1lbnRvIGVkaXRvcmlhbCBlIGdyw6FmaWNvOiBlc3RpbG9zIGRvIGNsaWVudGUsIGRlbnNpZGFkZSBlIGFsdHVyYSBkZSBsZXRyYSwgcGVuYXMsIGxheWVycywgY2FyaW1ibywgbnVtZXJhw6fDo28gZGUgZmlndXJhcyBlIHF1YWRyb3MuIix1OiJEZXBvaXMgZGUgbyBjb250ZcO6ZG8gZXN0YXIgY29ycmV0byBlIGFudGVzIGRvIGNyaXZvLiJ9Cl19LAp7ZzoiVmVyaWZpY2HDp8OjbyBlIHJldmlzw6NvIChzb21lbnRlIGxlaXR1cmEpIixmOiJ2ZXJpZmljYWRvciIsaXRlbXM6Wwoge246ImludGVsZWN0by1yZXZpc29yLWluZGVwZW5kZW50ZSIsazoicmV2aXNvciIscm86MSxkOiJBcGxpY2EgbyBDcml2byBJbnRlbGVjdG8gQS1GIGVtIHF1YWxxdWVyIGVudHJlZ8OhdmVsIHNlbSB0ZXIgcGFydGljaXBhZG8gZGEgcHJvZHXDp8OjbyBlIGNvbnNvbGlkYSBvcyBsYXVkb3MgZG9zIHF1YXRybyB2ZXJpZmljYWRvcmVzLiIsdToiU2VtcHJlIGNvbW8gw7psdGltYSBldGFwYSwgYW50ZXMgZGUgbGliZXJhciBhbyBjbGllbnRlLiJ9LAoge246ImludGVsZWN0by12ZXJpZmljYWRvci1jYWxjdWxvIixrOiJ2ZXJpZmljYWRvciIscm86MSxkOiJSZWZheiBvIGRpbWVuc2lvbmFtZW50byBlbSBwcm92YSBjZWdhIGEgcGFydGlyIGRvcyBkYWRvcyBkZSBlbnRyYWRhIGUgcmVwb3J0YSBkaXZlcmfDqm5jaWEgYWNpbWEgZGEgdG9sZXLDom5jaWEuIix1OiJDb25mZXJpciBvcyBuw7ptZXJvcyBkZSB1bSBtZW1vcmlhbCBkZSBjw6FsY3Vsby4ifSwKIHtuOiJpbnRlbGVjdG8tdmVyaWZpY2Fkb3ItZ3JhZmljbyIsazoidmVyaWZpY2Fkb3IiLHJvOjEsZDoiTWVkZSBhIHF1YWxpZGFkZSBncsOhZmljYSBkYSBwcmFuY2hhIGVtaXRpZGEgKGZvbGhhLCBwZW5hcywgbGF5ZXJzLCBkZW5zaWRhZGUsIGFsdHVyYSBkZSBsZXRyYSwgbGlnYcOnw7VlcywgY3J1emFtZW50b3MpLiIsdToiQW50ZXMgZGUgZW1pdGlyIHByYW5jaGFzIGFvIGNsaWVudGUuIn0sCiB7bjoiaW50ZWxlY3RvLXZlcmlmaWNhZG9yLTNkIixrOiJ2ZXJpZmljYWRvciIscm86MSxkOiJDb25mcm9udGEgbWVtb3JpYWlzLCBwcmFuY2hhcyBlIG8gbW9kZWxvIDNEIGV4ZWN1dGl2byAoY290YXMsIFVUTSwgZ3JlaWRlcywgcmVjb2JyaW1lbnRvLCBpbnRlcmZlcsOqbmNpYXMsIHZvbHVtZXMpLiIsdToiUXVhbmRvIG8gbW9kZWxvIDNEIG11ZGEsIG91IHBhcmEgY29uZmVyaXIgdW1hIGNvdGEgY29udHJhIG8gbW9kZWxvLiJ9LAoge246ImludGVsZWN0by12ZXJpZmljYWRvci1ub3JtYXRpdm8iLGs6InZlcmlmaWNhZG9yIixybzoxLGQ6IkNvbmZlcmUgc2UgY2FkYSBub3JtYSBjaXRhZGEgZXhpc3RlLCBlc3TDoSB2aWdlbnRlIGUgw6kgYXBsaWPDoXZlbCwgZSBzZSBvIGNyaXTDqXJpbyBtYWlzIHJlc3RyaXRpdm8gcHJldmFsZWNldS4iLHU6IlZhbGlkYXIgYXMgbm9ybWFzIGUgcGFkcsO1ZXMgZGUgbGFuw6dhbWVudG8gZGUgdW0gbWVtb3JpYWwuIn0sCiB7bjoiaW50ZWxlY3RvLXZlcmlmaWNhZG9yLW1vZGVsby1jbGllbnRlIixrOiJ2ZXJpZmljYWRvciIscm86MSxkOiJDb21wYXJhIG8gZW50cmVnw6F2ZWwgY29tIG9zIG1vZGVsb3MgTUFDSC9WYWxlIChjb2RpZmljYcOnw6NvLCBxdWFkcm8gZGUgcmV2aXPDtWVzLCBlc3RpbG9zLCBtYXJnZW5zLCBjYXJpbWJvLCBzaW1ib2xvZ2lhKS4iLHU6IkNvbmZlcmlyIGNvbmZvcm1pZGFkZSBkZSBmb3JtYXRvIGFudGVzIGRlIGVtaXRpci4ifQpdfSwKe2c6IlNraWxscyBkZSBkb23DrW5pbyIsZjoic2tpbGwiLGl0ZW1zOlsKIHtuOiJpbnRlbGVjdG8tZXRlIixrOiJza2lsbCIsZDoiQ29uY2Vww6fDo28sIHNlbGXDp8OjbyBkZSByb3RhIGUgZGltZW5zaW9uYW1lbnRvIGRlIEVURSAoVUFTQiwgbG9kb3MgYXRpdmFkb3MsIGxhZ29hcywgdGFucXVlIHPDqXB0aWNvLCBsaW5oYSBkZSBsb2RvKS4iLHU6IkNvbmNlYmVyIG91IGRpbWVuc2lvbmFyIEVURSwgb3UgcmV2aXNhciBtZW1vcmlhbCBkZSBFVEUuIn0sCiB7bjoiaW50ZWxlY3RvLWhpZHJhdWxpY2EiLGs6InNraWxsIixkOiJBYmFzdGVjaW1lbnRvIGRlIMOhZ3VhLCBhZHXDp8OjbywgZWxldmF0w7NyaWEsIHJlc2VydmHDp8OjbywgcmVkZSwgRVRBLCBiYWxhbsOnbyBow61kcmljbyBlIGhpZHLDoXVsaWNhIGRlIGNvbmR1dG9zLiIsdToiRGltZW5zaW9uYXIgc2lzdGVtYSBkZSDDoWd1YSwgYWR1dG9yYSwgYm9tYmEsIHJlc2VydmF0w7NyaW8gb3UgRVRBLiJ9LAoge246ImludGVsZWN0by1iaW9nYXMiLGs6InNraWxsIixkOiJEaWdlc3TDo28gYW5hZXLDs2JpYSBlIGJpb2fDoXM6IEJNUCwgYmlvZGlnZXN0b3JlcywgcHJvZHXDp8OjbyBlIHVwZ3JhZGluZyBhIGJpb21ldGFubywgZGlnZXN0YXRvLiIsdToiQXZhbGlhciB2aWFiaWxpZGFkZSBkZSBiaW9nw6FzLCBkaW1lbnNpb25hciBiaW9kaWdlc3RvciwgY29tcGFyYXIgcm90YXMgZGUgdXBncmFkaW5nLiJ9LAoge246ImludGVsZWN0by10cmF0YWJpbGlkYWRlIixrOiJza2lsbCIsZDoiRW5zYWlvcyBkZSBiYW5jYWRhOiBKYXItVGVzdCwgY29hZ3VsYW50ZS9mbG9jdWxhbnRlLCBkb3NhZ2VtIMOzdGltYSwgY29sdW5hIGRlIHNlZGltZW50YcOnw6NvLCByb3RhIHRlY25vbMOzZ2ljYS4iLHU6IlBsYW5lamFyIG91IGludGVycHJldGFyIGVuc2FpbyBkZSB0cmF0YWJpbGlkYWRlLiJ9LAoge246ImludGVsZWN0by1hbWJpZW50YWwiLGs6InNraWxsIixkOiJUZW1hcyBhbWJpZW50YWlzIGUgZGUgbGljZW5jaWFtZW50byBkYSBjYXNhLiIsdToiQXBvaW8gYW1iaWVudGFsIGUgZGUgZW5xdWFkcmFtZW50by4ifSwKIHtuOiJpbnRlbGVjdG8tY2FyYm9ubyIsazoic2tpbGwiLGQ6IkludmVudMOhcmlvIGUgYmFsYW7Dp28gZGUgY2FyYm9uby4iLHU6IkVzdHVkb3MgZGUgY2FyYm9ubyBlIGRlc2NhcmJvbml6YcOnw6NvLiJ9LAoge246ImludGVsZWN0by1kcmVuYWdlbS1zYm4iLGs6InNraWxsIixkOiJEcmVuYWdlbSBlIFNvbHXDp8O1ZXMgYmFzZWFkYXMgbmEgTmF0dXJlemEuIix1OiJFc3R1ZG8gZGUgZHJlbmFnZW0sIGphcmRpbnMgZGUgY2h1dmEsIFNiTi4ifSwKIHtuOiJncmF1LWRlLWxpYmVyZGFkZSIsazoic2tpbGwiLGQ6IkFuw6FsaXNlIGRlIGdyYXVzIGRlIGxpYmVyZGFkZTogZGVjaWRlIHNlIG8gcHJvYmxlbWEgZXN0w6EgYmVtIGVzcGVjaWZpY2FkbyBhbnRlcyBkZSByZXNvbHZlci4iLHU6IkFvIG1vbnRhciBvdSBhdWRpdGFyIHVtIGJhbGFuw6dvIGRlIG1hc3NhIGUgZW5lcmdpYS4ifSwKIHtuOiJiYWxhbmNvLW1hc3NhIixrOiJza2lsbCIsZDoiRmVjaGFtZW50byBkZSBiYWxhbsOnbyBkZSBtYXNzYS4iLHU6IkJhc2UgZGUgcXVhbHF1ZXIgZGltZW5zaW9uYW1lbnRvIGRlIHByb2Nlc3NvLiJ9LAoge246ImJhbGFuY28tZW5lcmdpYSIsazoic2tpbGwiLGQ6IkZlY2hhbWVudG8gZGUgYmFsYW7Dp28gZGUgZW5lcmdpYS4iLHU6IkRlcG9pcyBkbyBncmF1IGRlIGxpYmVyZGFkZSBlIGRvIGJhbGFuw6dvIGRlIG1hc3NhLiJ9LAoge246ImludGVsZWN0by1wZCIsazoic2tpbGwiLGQ6IlBlc3F1aXNhIGUgZGVzZW52b2x2aW1lbnRvLCBlbnNhaW9zIGUgZXN0dWRvcy4iLHU6IlRyYWJhbGhvcyBkZSBQJkQgcXXDrW1pY28gZSBkZSBwcm9jZXNzby4ifQpdfSwKe2c6IlNraWxscyBkZSBmdW7Dp8OjbyIsZjoic2tpbGwiLGl0ZW1zOlsKIHtuOiJpbnRlbGVjdG8tY29udGV4dG8iLGs6InNraWxsIixkOiJDb250ZXh0by1tZXN0cmUgZSBQT1AtRU5HLTAwMTogcGFww6lpcywgYWzDp2FkYXMsIG1hY3JvcHJvY2Vzc28sIGNlbnRybyBkZSBjdXN0bywgY29uZmlkZW5jaWFsaWRhZGUsIENyaXZvIEEtRi4iLHU6IkFvIGFicmlyLCBwcm9wb3IsIGV4ZWN1dGFyLCByZXZpc2FyIG91IGxpYmVyYXIgcXVhbHF1ZXIgdHJhYmFsaG8gZGEgY2FzYS4ifSwKIHtuOiJpbnRlbGVjdG8tZGlhZ25vc3RpY28iLGs6InNraWxsIixkOiJEaWFnbsOzc3RpY28gZSBhdWRpdG9yaWEgZGUgZGFkb3MgZGUgcHJvY2Vzc286IGVzdGFiZWxlY2UgYSBiYXNlIGZhY3R1YWwgYW50ZXMgZGUgZGltZW5zaW9uYXIuIix1OiJObyBpbsOtY2lvIGRlIHF1YWxxdWVyIHByb2pldG8sIGFudGVzIGRlIGRpbWVuc2lvbmFyIG91IHJlZGlnaXIuIn0sCiB7bjoiaW50ZWxlY3RvLXJlZGF0b3IiLGs6InNraWxsIixkOiJSZWRhw6fDo28gdMOpY25pY2Egc8OqbmlvcjogcmVsYXTDs3Jpb3MgV29yZC9QREYgZGUgYWx0YSBkZW5zaWRhZGUgZSBwcm9wb3N0YXMgY29tIENBUEVYL09QRVguIix1OiJSZWRpZ2lyIG91IGVzdHJ1dHVyYXIgcmVsYXTDs3JpbyB0w6ljbmljbyBvdSBwcm9wb3N0YS4ifSwKIHtuOiJpbnRlbGVjdG8tcmV2aXNvciIsazoic2tpbGwiLGQ6IkNyaXZvIEludGVsZWN0byBBLUYgZW0gNiBkaW1lbnPDtWVzIHBhcmEgcXVhbHF1ZXIgZW50cmVnw6F2ZWwuIix1OiLDmmx0aW1hIGV0YXBhIGRlIFFBIGFudGVzIGRhIGxpYmVyYcOnw6NvLiJ9LAoge246ImludGVsZWN0by1zY2FmZm9sZGluZyIsazoic2tpbGwiLGQ6IkFicmUgZSBvcmdhbml6YSBwcm9qZXRvIG5vIHBhZHLDo286IGNlbnRybyBkZSBjdXN0byBFLkMuVC5QLCBwYXN0YXMsIG5vbWVuY2xhdHVyYSwgdmVyc2lvbmFtZW50byBSRVYuIix1OiJDcmlhciBjZW50cm8gZGUgY3VzdG8sIGFicmlyIHBhc3RhLCBub21lYXIgb3UgdmVyc2lvbmFyIGVudHJlZ8OhdmVsLiJ9LAoge246ImludGVsZWN0by13ZWJhcHAiLGs6InNraWxsIixkOiJTaXRlcyBlIGFwcHMgaW50ZXJub3M6IENsb3VkZmxhcmUgV29ya2VycyArIEQxICsgQXNzZXRzLCBhdXRoIHBvciB0b2tlbiwgZGVwbG95IHBvciB3cmFuZ2xlciwgUUEgUGxheXdyaWdodC4iLHU6IkNyaWFyLCBldm9sdWlyLCBwcm90ZWdlciwgcHVibGljYXIgb3UgdGVzdGFyIG8gcG9ydGFsIG91IG91dHJhIGZlcnJhbWVudGEgaW50ZXJuYS4ifSwKIHtuOiJpbnRlbGVjdG8tYXByZXNlbnRhY2FvIixrOiJza2lsbCIsZDoiQXByZXNlbnRhw6fDtWVzIGV4ZWN1dGl2YXMgSFRNTCBjb20gQ2hhcnQuanMsIGlkZW50aWRhZGUgSW50ZWxlY3RvLCBlc3BlbGhvIGRvIHJlbGF0w7NyaW8gdMOpY25pY28uIix1OiJDcmlhciBkZWNrIHBhcmEgY29taXTDqiwgZGVmZXNhIGRlIHByb3Bvc3RhIG91IHZpc2l0YSB0w6ljbmljYS4ifSwKIHtuOiJpbnRlbGVjdG8tbGVpdG9yLWR3ZyIsazoic2tpbGwiLGQ6IkxlaXR1cmEgZSBleHRyYcOnw6NvIGRlIHByYW5jaGFzIERXRy9EWEYgY29tIGV6ZHhmOiBjb29yZGVuYWRhcyBVVE0sIGNvdGFzLCBsYXllcnMsIMOhcmVhcywgY29tcGFyYcOnw6NvIGRlIHJldmlzw7Vlcy4iLHU6IkFicmlyLCBsZXIgb3UgY29tcGFyYXIgcHJhbmNoYXMgQ0FELiJ9LAoge246ImludGVsZWN0by1xZ2lzIixrOiJza2lsbCIsZDoiU0lHIGUgZ2VvcHJvY2Vzc2FtZW50byAoUUdJUykuIix1OiJNb250YXIgbWFwYXMgZSBhbsOhbGlzZXMgZXNwYWNpYWlzLiJ9LAoge246ImludGVsZWN0by1tb2RlbG8zZCIsazoic2tpbGwiLGQ6Ik1vZGVsbyAzRCBleGVjdXRpdm8gZ2VvcnJlZmVyZW5jaWFkby4iLHU6IkFwb2lvIGFvIG1vZGVsYWRvci0zZC4ifQpdfSwKe2c6IkNBRCBlIFAmSUQiLGY6ImNhZCIsaXRlbXM6Wwoge246ImNhZC1maWd1cmFzLXJlYWlzIixrOiJjYWQiLGQ6IkJpYmxpb3RlY2EgZGUgZmlndXJhcyByZWFpcyBkZSBlcXVpcGFtZW50byBlIGVzdHJ1dHVyYSAoYm9tYmFzLCBQYXJzaGFsbCwgc2VwYXJhZG9yIHRyaWbDoXNpY28sIGxhbWVsYXMsIGNsb3JhZG9yKS4iLHU6IkRlc2VuaGFyIHVuaWRhZGUgcmVhbCBuYSBwcmFuY2hhIG91IG5vIGZsdXhvZ3JhbWEuIn0sCiB7bjoiY2FkLWdlb21ldHJ5LXJlYWxpc20iLGs6ImNhZCIsZDoiUmVhbGlzbW8gZ2VvbcOpdHJpY28gZGFzIGZpZ3VyYXMuIix1OiJTdWJzdGl0dWlyIGNhaXhhIGdlbsOpcmljYSBwb3IgZXN0cnV0dXJhIHJlYWwuIn0sCiB7bjoiY2FkLWNyb3NzaW5nLWxvZ2ljIixrOiJjYWQiLGQ6IkzDs2dpY2EgZGUgY3J1emFtZW50byBkZSBsaW5oYXMgc2VtIHF1ZWJyYS4iLHU6IlJvdGVhbWVudG8gZSBzYWx0byBkZSBjcnV6YW1lbnRvLiJ9LAoge246ImNhZC1jdXJhZG9yaWEtZ2VvbWV0cmlhIixrOiJjYWQiLGQ6IkN1cmFkb3JpYSBkYSBnZW9tZXRyaWEgZG8gZGVzZW5oby4iLHU6IkxpbXBlemEgZSBjb25zaXN0w6puY2lhIGdlb23DqXRyaWNhLiJ9LAoge246ImNhZC1kd2ctY29udmVydGVyIixrOiJjYWQiLGQ6IkNvbnZlcnPDo28gRFdHL0RYRiAoZXpkeGYgKyBPREEpIGNvbSBsYXVkby4iLHU6IkNvbnZlcnRlciBmb3JtYXRvIHByZXNlcnZhbmRvIGNvbnRlw7pkby4ifSwKIHtuOiJjYWQtbGF5ZXItbWFuYWdlciIsazoiY2FkIixkOiJPcmdhbml6YcOnw6NvIGRlIGxheWVycyBlIHBlbmFzLiIsdToiUGFkcm9uaXphciBjYW1hZGFzIGRhIHByYW5jaGEuIn0sCiB7bjoiY2FkLWxheW91dC1hcmVhIixrOiJjYWQiLGQ6IkxheW91dCBkZSBmb2xoYSBlIGPDoWxjdWxvIGRlIMOhcmVhLiIsdToiTW9udGFyIGEgZm9saGEgZSBtZWRpciDDoXJlYXMuIn0sCiB7bjoicGlkLWV4dHJhY2FvIixrOiJjYWQiLGQ6IkV4dHJhaSBkYWRvcyBkZSBwcm9jZXNzbyAobWVtb3JpYWwgKyBwcmFuY2hhKSBwYXJhIG8gbW9kZWxvIMO6bmljbyBwaWQuanNvbi4iLHU6IkFudGVzIGRlIGRlc2VuaGFyIHF1YWxxdWVyIFAmSUQuIn0sCiB7bjoicGlkLXNpbWJvbG9naWEiLGs6ImNhZCIsZDoiU2ltYm9sb2dpYSBlIGNvbnZlbsOnw7VlcyBkZSBQJklEL1BGRCAoSVNBLTUuMSwgSVNPIDEwNjI4LCBOQlIgODE5MCkuIix1OiJEZXNlbmhhciwgbGVyIG91IGF1ZGl0YXIgZmx1eG9ncmFtYS4ifSwKIHtuOiJwaWQtY29uc3RydWNhbyIsazoiY2FkIixkOiJDb25zdHLDs2kgbyBmbHV4b2dyYW1hIFAmSUQgYSBwYXJ0aXIgZG8gcGlkLmpzb24gZSBlbWl0ZSBlbSBEWEYuIix1OiJEZXBvaXMgZGUgcGlkLWV4dHJhY2FvIGUgcGlkLXNpbWJvbG9naWEuIn0sCiB7bjoiaW50ZWxlY3RvLXByYW5jaGEtZXhlY3V0aXZhIixrOiJjYWQiLGQ6IlJlcXVpc2l0b3MgZSBjcml2byBkZSByZXByb3Zhw6fDo28gcGFyYSBwcmFuY2hhIGV4ZWN1dGl2YSBubyBwYWRyw6NvIFZhbGUvTUFDSC4iLHU6IkZlY2hhciBlIGNvbmZlcmlyIHByYW5jaGEgZXhlY3V0aXZhLiJ9LAoge246ImludGVsZWN0by1wcmFuY2hhcy1jb3J0ZXMiLGs6ImNhZCIsZDoiUHJhbmNoYXMgZSBjb3J0ZXMuIix1OiJHZXJhciBjb3J0ZXMgYSBwYXJ0aXIgZG8gbW9kZWxvLiJ9LAoge246ImludGVsZWN0by1jcml2by1ncmFmaWNvIixrOiJjYWQiLGQ6IkNyaXZvIGdyw6FmaWNvIGRvIGFycXVpdm8gZW1pdGlkby4iLHU6Ik1lZGlyIGEgZm9saGEgcXVlIHZhaSBhbyBjbGllbnRlLiJ9LAoge246ImludGVsZWN0by1lbWlzc2FvLWV0ZS1jZnRwIixrOiJjYWQiLGQ6IkNpY2xvIGRlIGVtaXNzw6NvIGUgYWZlcmnDp8OjbyBkbyBjb25qdW50byBkZSBwcmFuY2hhcyBkYSBFVEUvQ0ZUUCAoY29udHJhdG8gMDE3NEdHKS4iLHU6IkVtaXRpciBwZWxvIE1vdG9yLCBwcm9tb3ZlciBwYXJhIERXRywgcm9kYXIgY3Jpdm8uIn0KXX0sCntnOiJBY2Vydm8gZSBNQ1AgaW50ZWxlY3RvLW5vcm1hcyIsZjoibWNwIixpdGVtczpbCiB7bjoiYWNlcnZvLWNvbnN1bHRhIixrOiJza2lsbCIsZDoiQ29uc3VsdGEgYW8gQWNlcnZvICg5NTMgZG9jcykgdmlhIEFJIFNlYXJjaC9BdXRvUkFHLCBzZXJ2aWRvIHBlbG8gL21jcCBkbyBwb3J0YWwuIix1OiJCdXNjYXIgbm9ybWEsIGZpY2hhLCBwcmVjZWRlbnRlLCBwYXLDom1ldHJvLCAnbyBxdWUgYSBjYXNhIGrDoSB0ZW0gc29icmUgWCcuIn0sCiB7bjoiYnVzY2FyX25vcm1hIixrOiJtY3AiLGQ6IkJ1c2NhIG5vcm1hcyAoTkJSLCBDT05BTUEsIEROIENPUEFNKSBwb3IgZG9tw61uaW8vdGVybW86IGl0ZW0sIGNyaXTDqXJpbywgdmlnw6puY2lhLiIsdToiVG9vbCBkbyBNQ1A7IGNvbmVjdG9yIGF0aXZvLiJ9LAoge246ImJ1c2Nhcl9yZWZlcmVuY2lhIixrOiJtY3AiLGQ6IkJ1c2NhIHJlZmVyw6puY2lhcyBlIG3DqXRvZG9zIGRvIGFjZXJ2byBwb3IgZG9tw61uaW8vdGVybW8uIix1OiJUb29sIGRvIE1DUC4ifSwKIHtuOiJidXNjYXJfcHJlY2VkZW50ZSIsazoibWNwIixkOiJCdXNjYSBwcm9qZXRvcyBqw6EgZXhlY3V0YWRvcyBwZWxhIGNhc2EgcG9yIGRvbcOtbmlvL3Rlcm1vLiIsdToiVG9vbCBkbyBNQ1AuIn0sCiB7bjoiZmljaGEiLGs6Im1jcCIsZDoiUmV0b3JuYSBhIGZpY2hhIGRlIGFjZXJ2byBwb3IgaWQgKGV4LjogRVRFLTAwMSkuIix1OiJUb29sIGRvIE1DUC4ifSwKIHtuOiJwYXJhbWV0cm8iLGs6Im1jcCIsZDoiRmljaGFzIGRlIHBhcsOibWV0cm8gKGZhaXhhLCB2YWxvciBwcmF0aWNhZG8sIGNvbmRpw6fDo28sIGZvbnRlLCByaXNjbywgZXZpZMOqbmNpYSkuIix1OiJUb29sIGRvIE1DUC4ifSwKIHtuOiJwb3J0Zm9saW8iLGs6Im1jcCIsZDoiTGlzdGEgbyBwb3J0ZsOzbGlvIGRlIHByb2R1dG9zIGUgc2VydmnDp29zIGRhIGNhc2EgKHNlbSB2YWxvcmVzKS4iLHU6IlRvb2wgZG8gTUNQLiJ9LAoge246ImFnZW5kYSIsazoibWNwIixkOiJMaXN0YSBldmVudG9zIGUgcmV1bmnDtWVzIGRhIGFnZW5kYSBwb3IgdGVybW8sIHNldG9yIGUgaW50ZXJ2YWxvIGRlIGRhdGFzLiIsdToiVG9vbCBkbyBNQ1AuIn0sCiB7bjoiY29uaGVjaW1lbnRvIixrOiJtY3AiLGQ6IkJ1c2NhIGNvbnRlw7pkb3MgZGFzIGFiYXMgZGUgQ29uaGVjaW1lbnRvIGRvIHBvcnRhbCBwb3Igw6FyZWEgZSB0ZXJtby4iLHU6IlRvb2wgZG8gTUNQLiJ9LAoge246ImFjZXJ2b19zZWFyY2giLGs6Im1jcCIsZDoiQnVzY2Egc2Vtw6JudGljYSBubyBBY2Vydm8gKDk1MyBkb2NzKSB2aWEgQUkgU2VhcmNoLCBjb20gY2FiZcOnYWxobyBkZSBvcmlnZW0uIEV4aWdlIGFjZXNzbyBhbyBhY2Vydm8uIix1OiJUb29sIGRvIE1DUDsgZG9ubyBvdSBhY2dyYW50LiJ9Cl19Cl07CmNvbnN0IGxpc3RFbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGlzdCcpLHFFbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncScpLGNvdW50RWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvdW50Jyk7CmxldCBmaWx0ZXI9J2FsbCcsdGVybT0nJzsKZnVuY3Rpb24gZXNjKHMpe3JldHVybiBTdHJpbmcocykucmVwbGFjZSgvWyY8Pl0vZyxjPT4oeycmJzonJmFtcDsnLCc8JzonJmx0OycsJz4nOicmZ3Q7J31bY10pKX0KZnVuY3Rpb24gcmVuZGVyKCl7CiAgbGV0IHNob3duPTA7IGxpc3RFbC5pbm5lckhUTUw9Jyc7CiAgY29uc3QgdD10ZXJtLnRyaW0oKS50b0xvd2VyQ2FzZSgpOwogIGZvcihjb25zdCBncnAgb2YgREFUQSl7CiAgICBjb25zdCBtYXRjaGVzPWdycC5pdGVtcy5maWx0ZXIoaXQ9PnsKICAgICAgaWYoZmlsdGVyIT09J2FsbCcgJiYgaXQuayE9PWZpbHRlciAmJiBncnAuZiE9PWZpbHRlcikgcmV0dXJuIGZhbHNlOwogICAgICBpZighdCkgcmV0dXJuIHRydWU7CiAgICAgIHJldHVybiAoaXQubisnICcraXQuZCsnICcraXQudSsnICcrZ3JwLmcpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModCk7CiAgICB9KTsKICAgIGlmKCFtYXRjaGVzLmxlbmd0aCkgY29udGludWU7CiAgICBjb25zdCBzZWM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2VjdGlvbicpOyBzZWMuY2xhc3NOYW1lPSdncnAnOwogICAgc2VjLmlubmVySFRNTD0nPGgyPicrZXNjKGdycC5nKSsnIDxzbWFsbD4nK21hdGNoZXMubGVuZ3RoKyc8L3NtYWxsPjwvaDI+PGRpdiBjbGFzcz0iZ3JpZCI+PC9kaXY+JzsKICAgIGNvbnN0IGdyaWQ9c2VjLnF1ZXJ5U2VsZWN0b3IoJy5ncmlkJyk7CiAgICBmb3IoY29uc3QgaXQgb2YgbWF0Y2hlcyl7CiAgICAgIHNob3duKys7CiAgICAgIGNvbnN0IGM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7IGMuY2xhc3NOYW1lPSdjYXJkJzsKICAgICAgYy5pbm5lckhUTUw9JzxoMz4nK2VzYyhpdC5uKSsoaXQucm8/JyA8c3BhbiBjbGFzcz0idGFnIHJvIj5sZWl0dXJhPC9zcGFuPic6JycpKycgPHNwYW4gY2xhc3M9InRhZyI+Jytlc2MoaXQuaykrJzwvc3Bhbj48L2gzPicKICAgICAgICArJzxkaXYgY2xhc3M9ImQiPicrZXNjKGl0LmQpKyc8L2Rpdj4nCiAgICAgICAgKyc8ZGl2IGNsYXNzPSJ1c2UiPjxiPlF1YW5kbyB1c2FyOjwvYj4gJytlc2MoaXQudSkrJzwvZGl2Pic7CiAgICAgIGdyaWQuYXBwZW5kQ2hpbGQoYyk7CiAgICB9CiAgICBsaXN0RWwuYXBwZW5kQ2hpbGQoc2VjKTsKICB9CiAgaWYoIXNob3duKSBsaXN0RWwuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJlbXB0eSI+TmFkYSBlbmNvbnRyYWRvIHBhcmEgZXN0ZSBmaWx0cm8vYnVzY2EuPC9kaXY+JzsKICBjb3VudEVsLnRleHRDb250ZW50PXNob3duKycgaXRlbnMnOwp9CnFFbC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsZT0+e3Rlcm09ZS50YXJnZXQudmFsdWU7cmVuZGVyKCl9KTsKZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmNoaXAnKS5mb3JFYWNoKGNoPT5jaC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsKCk9PnsKICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuY2hpcCcpLmZvckVhY2goeD0+eC5jbGFzc0xpc3QucmVtb3ZlKCdvbicpKTsKICBjaC5jbGFzc0xpc3QuYWRkKCdvbicpOyBmaWx0ZXI9Y2guZGF0YXNldC5mOyByZW5kZXIoKTsKfSkpOwpyZW5kZXIoKTsKPC9zY3JpcHQ+PC9ib2R5PjwvaHRtbD4K";
function decodeB64(b: string): string { const bin = atob(b); const u = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return new TextDecoder().decode(u); }

/** Pessoas que saíram da equipe técnica: histórico preservado, acesso encerrado. */
const INATIVOS = ["gabriel", "nilson", "rafaela", "hector", "pedro"];
function checaAtivo(slug: string) {
  if (INATIVOS.includes(slug)) {
    throw new Error("Acesso encerrado. O histórico desta pessoa continua no portal; fale com a Coordenação.");
  }
}
/** Funções da proposta: a hora prevista é orçada por função e comparada com a hora executada
 *  por quem ocupa aquela função. Assim projetos diferentes ficam comparáveis entre si. */
const FUNCOES: [string, string][] = [
  ["coord", "Coordenação"], ["senior", "Engenheiro sênior"], ["pleno", "Engenheiro pleno"],
  ["junior", "Engenheiro júnior"], ["tecnico", "Técnico"], ["estagio", "Estagiário"],
  ["apoio", "Apoio administrativo"],
];
const FUNC_COD = FUNCOES.map((f) => f[0]);
const SETORES: [string, string][] = [
  ["engenharia", "Engenharia"], ["laboratorio", "Laboratório"], ["pd", "Pesquisa e Desenvolvimento"],
  ["projetos", "Projetos"], ["comercial", "Comercial"], ["juridico", "Jurídico"],
  ["financeiro", "Financeiro"], ["admin", "Administrativo"],
];
const SETOR_COD = SETORES.map((s) => s[0]);
/** Tipos de item do calendário — inclui os ritos de gestão (PDCA e auditoria 5S). */
const EV_TIPOS = ["REUNIAO", "EVENTO", "VISITA", "TREINAMENTO", "PDCA", "AUDITORIA_5S"];
/** Recorrência de evento periódico: frequências aceitas e teto de instâncias por série.
 *  A série é materializada como N linhas individuais de `evento` ligadas por `serie_id`
 *  (ver addserie/delserie); o teto evita gerar milhares de linhas. */
const EV_FREQS = ["diaria", "semanal", "quinzenal", "mensal"];
const MAX_SERIE = 60;
/** Soma dias a uma data ISO (AAAA-MM-DD), em UTC para não escorregar por fuso. */
function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Soma meses a uma data ISO, mantendo o dia do mês e grampeando ao último dia válido
 *  (ex.: 31/jan + 1 mês = 28/fev). Usado na recorrência mensal. */
function addMonthsISO(iso: string, n: number): string {
  const [y, m, day] = iso.split("-").map((x) => parseInt(x, 10));
  const base = new Date(Date.UTC(y, (m - 1) + n, 1));
  const yy = base.getUTCFullYear(), mm = base.getUTCMonth();
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  const dd = Math.min(day, last);
  return yy + "-" + String(mm + 1).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
}
/** Próxima ocorrência conforme a frequência da série. */
function proximaOcorrencia(iso: string, freq: string): string {
  if (freq === "diaria") return addDaysISO(iso, 1);
  if (freq === "semanal") return addDaysISO(iso, 7);
  if (freq === "quinzenal") return addDaysISO(iso, 14);
  return addMonthsISO(iso, 1); // mensal
}
/** Tipos de material da biblioteca. */
const BIB_TIPOS = ["NORMA", "ESTUDO", "PROJETO", "CASE", "ARTIGO", "MANUAL", "APRESENTACAO", "AULA"];
/** Domínios técnicos da base de conhecimento — ETE, tratabilidade/P&D, ambiental e hidráulica. */
const BIB_DOMS: [string, string][] = [
  ["ETE", "ETE e esgoto sanitário"],
  ["TRA", "Tratabilidade e P&D"],
  ["AMB", "Licenciamento e ambiental"],
  ["HID", "Hidráulica e drenagem"],
  ["BIO", "Biogás e energia"],
  ["GER", "Geral / transversal"],
];
const BIB_DOM_COD = BIB_DOMS.map((d) => d[0]);
const PDCA_FASES = ["PLANEJAR", "EXECUTAR", "CHECAR", "AGIR"];
const STATUSES = ["A INICIAR","EM ANDAMENTO","EM ESPERA","CONCLUÍDO","CANCELADO"];
const SITS = ["PENDENTE","APROVADO","DEVOLVIDO","LANÇADO"];
const AREAS_LIST = ["avisos","treinamentos","procedimentos","produtos","links","seguranca","comercial","financeiro","juridico"];
const RESTRITAS = ["financeiro", "comercial", "juridico"];
const SESS_DIAS = 30;

/* SENTINELA DE VERSAO DE SCHEMA — otimizacao de COLD START.
 * REGRA DE BUMP (obrigatoria): a cada mudanca de schema — nova tabela, nova
 * coluna (ALTER), novo indice ou novo backfill adicionado em ensureSchema() —
 * TROQUE o valor abaixo por um novo (ex.: incremente o sufixo da data). Se o
 * schema mudar e a sentinela NAO for bumpada, as instancias que ja gravaram a
 * sentinela antiga vao PULAR o setup e os ALTER novos nunca rodarao naquele D1.
 * O valor so precisa ser diferente do anterior; a data + sufixo e convencao. */
const SCHEMA_VER = "2026-10-19h";
/** Prioridade 1-100 = média de (G×U×T)/125 e (Impacto×Esforço)/25, ambas em %. 0 = não avaliado. */
function prioridade100(g: unknown, u: unknown, t: unknown, imp: unknown, esf: unknown): number {
  const gut = (Number(g) || 0) * (Number(u) || 0) * (Number(t) || 0); // 0-125
  const ie = (Number(imp) || 0) * (Number(esf) || 0);                 // 0-25
  return Math.round(((gut / 125) * 100 + (ie / 25) * 100) / 2);
}
/* RITOS & CADENCIA (catalogo da Agenda). Template a partir do processo da casa (POP-ENG-001):
 * o que, quando, quem, objetivo, pauta e entregavel de cada rito. Editavel no portal; semeadura
 * aditiva idempotente. Sem valor monetario. */
const RITOS_SEED: Array<{ rid: string; nome: string; tipo: string; cadencia: string; publico: string; objetivo: string; pauta: string; entregavel: string }> = [
  { rid: "daily_brief", nome: "Daily Brief", tipo: "Diário", cadencia: "Diária (início do dia)", publico: "Equipe e Coordenação",
    objetivo: "Radar do dia: editais, notícias e prioridades.", pauta: "Itens novos do radar\nPrioridades do dia\nBloqueios", entregavel: "Foco do dia alinhado" },
  { rid: "reuniao_coord", nome: "Reunião de Coordenação", tipo: "Semanal", cadencia: "Semanal", publico: "Coordenação",
    objetivo: "Rever carteira, prazos (GUT) e distribuição de trabalho.", pauta: "Status da carteira\nRiscos e prazos\nDistribuição de tarefas", entregavel: "Decisões e responsáveis definidos" },
  { rid: "kickoff", nome: "Kickoff de Projeto", tipo: "Por projeto", cadencia: "No início de cada projeto", publico: "Coordenação + equipe do projeto",
    objetivo: "Abrir o projeto no padrão e alinhar escopo e prazos.", pauta: "Centro de custo e pasta\nEscopo, prazos e responsáveis\nRiscos iniciais", entregavel: "Projeto ativo com escopo e responsáveis" },
  { rid: "crivo", nome: "Crivo A-F (revisão independente)", tipo: "Por entrega", cadencia: "Antes de liberar ao cliente", publico: "Revisor independente",
    objetivo: "Auditar o entregável nas dimensões do Crivo Intelecto, sem ter produzido.", pauta: "Conteúdo e evidência\nRigor e normas\nRedação e visual\nIntegridade e versão", entregavel: "Laudo PASSA/REPROVA por item" },
  { rid: "emissao", nome: "Emissão / Entrega", tipo: "Por entrega", cadencia: "Ao emitir ao cliente", publico: "Coordenação",
    objetivo: "Promover a revisão vigente e testar a abertura de cada arquivo antes de entregar.", pauta: "Pacote no padrão\nAbertura de cada arquivo testada\nLiberação registrada", entregavel: "Entrega liberada e versionada" },
  { rid: "pipeline_comercial", nome: "Pipeline Comercial", tipo: "Semanal", cadencia: "Semanal", publico: "Coordenação Comercial",
    objetivo: "Rever funil, propostas em aberto e Top Leads.", pauta: "Funil e conversão\nPropostas em aberto\nPróximos passos por cliente", entregavel: "Pipeline atualizado" },
  { rid: "revisao_financeira", nome: "Revisão Financeira", tipo: "Mensal", cadencia: "No fecho do mês", publico: "Sócios e Coordenação Financeira",
    objetivo: "Rever margem por projeto e a posição financeira da casa.", pauta: "Margem por projeto (prejuízo primeiro)\nContas a pagar e a receber", entregavel: "Decisões financeiras do mês" },
  { rid: "retrospectiva", nome: "Retrospectiva", tipo: "Mensal", cadencia: "Fim do mês ou do contrato", publico: "Equipe e Coordenação",
    objetivo: "Rever o que funcionou e o que melhorar no processo.", pauta: "O que foi bem\nO que melhorar\nAções de melhoria", entregavel: "Ações de melhoria registradas" },
];
/* GUIAS INTERNOS (tabela `conteudo`, aba Guias do Acervo): indice de referencia do processo da
 * casa. Seed com id fixo (INSERT OR IGNORE: nao duplica nem sobrescreve o que a equipe adicionar).
 * url vazia de proposito — a Coordenacao aponta para o documento real no portal. */
const CONTEUDO_SEED: Array<{ id: string; area: string; titulo: string; descricao: string; tag: string }> = [
  { id: "ref_pop", area: "Processo", titulo: "POP-ENG-001 — Processo de Engenharia", descricao: "Macroprocesso de 16 etapas em 5 fases e 6 gates; papéis, alçadas e centro de custo E.C.T.P.", tag: "processo" },
  { id: "ref_crivo", area: "Processo", titulo: "Crivo Intelecto A-F", descricao: "Checklist de 6 dimensões para liberar qualquer entregável (conteúdo, rigor, normas, redação, visual, integridade).", tag: "qualidade" },
  { id: "ref_cc", area: "Processo", titulo: "Centro de custo E.C.T.P e nomenclatura", descricao: "Numeração de projetos (Empresa.Cliente.Tipo.Projeto) e nomenclatura/versionamento de entregáveis (REV).", tag: "padrão" },
  { id: "ref_memorial", area: "Memorial e Relatório", titulo: "Padrão de memorial de cálculo e descritivo", descricao: "Estrutura e rastreabilidade do dado ao parágrafo; grau de liberdade → balanço → dimensionamento.", tag: "memorial" },
  { id: "ref_redacao", area: "Memorial e Relatório", titulo: "Redação técnica da casa", descricao: "Densidade técnica, narrativa fluida, linguagem factual; CAPEX/OPEX nas propostas.", tag: "redação" },
  { id: "ref_kitcad", area: "CAD e Pranchas", titulo: "KIT-CAD — prancha executiva padrão", descricao: "Carimbo, cores de pena, layers e notas gerais no padrão do cliente (Vale/MACh).", tag: "cad" },
  { id: "ref_pid", area: "CAD e Pranchas", titulo: "P&ID — simbologia e construção", descricao: "ISA-5.1, ISO 10628/14617; balão de instrumento, numeração de linha e limite de bateria.", tag: "p&id" },
  { id: "ref_normas", area: "Normas", titulo: "Índice de normas por domínio", descricao: "NBR, CONAMA e DN COPAM aplicáveis por frente (ETE, ETA, hidráulica, resíduos). Use também a busca do Acervo e o MCP.", tag: "normas" },
  { id: "ref_mcp_normas", area: "Plugins & MCP", titulo: "MCP intelecto-normas — como usar", descricao: "9 ferramentas: buscar_norma, buscar_referencia, buscar_precedente, ficha, parametro, portfolio, agenda, conhecimento, acervo_search. Instale o plugin intelecto-engenharia; defina INTELECTO_MCP_TOKEN no ambiente do Windows (setx) e reinicie o app; o token é emitido na aba Permissões (Coordenação). Sintoma de token ausente: conecta com 0 tools.", tag: "mcp" },
  { id: "ref_plugin", area: "Plugins & MCP", titulo: "Plugin intelecto-engenharia — agentes e skills", descricao: "12 agentes (orquestrador, memorialista, projetista-dwg, modelador-3d, verificadores, revisor independente...) e ~34 skills (ETE, hidráulica, biogás, tratabilidade, CAD, P&ID, redator, webapp...). Veja a aba Escritório de IA para o catálogo completo.", tag: "plugin" },
  { id: "ref_como_disparar", area: "Plugins & MCP", titulo: "Como disparar um agente ou skill", descricao: "No Claude Code: peça pelo nome (ex.: \"use o agente intelecto-memorialista\") ou invoque a skill; para trabalho amplo/multidisciplinar, deixe o intelecto-orquestrador montar a sequência. O trabalho roda no Claude Code/plugin, não dentro do portal.", tag: "uso" },
  { id: "ref_acervo_busca", area: "Plugins & MCP", titulo: "Acervo via AI Search (AutoRAG)", descricao: "953 documentos (mestrado, graduação, normas, cursos). Busque por tema/norma, abra o arquivo e veja o cabeçalho de origem. Acesso por concessão (Permissões) ou por cargo com acervo.consultar.", tag: "acervo" },
];
/* RH — catalogo de cargos (Fase 1). Seed de EXEMPLO (template): nasce so quando a tabela
 * rh_cargo esta vazia e a Coordenacao edita/substitui dentro do portal (manual vivo). Campos
 * multilinha usam \n por item. Sem valor monetario. Marcado "(exemplo - edite)" de proposito. */
const RH_CARGOS_SEED: Array<{ cid: string; nome: string; area: string; missao: string; responsabilidades: string; entregaveis: string; rotinas: string; cadencia: string; onboarding: string }> = [
  { cid: "socios", nome: "Sócios / Direção", area: "Direção",
    missao: "Responde pela estratégia, pelas alçadas e pela saúde do negócio; decide portfólio e investimentos.",
    responsabilidades: "Definir prioridades, alçadas e metas\nAprovar propostas, contratos e emissões ao cliente\nGarantir o POP-ENG-001 e o Crivo A-F\nZelar pela confidencialidade e pela saúde financeira",
    entregaveis: "Decisões de portfólio e investimento\nAprovação final de propostas e contratos",
    rotinas: "Revisão da carteira e dos indicadores\nReunião de direção\nAcompanhamento do financeiro",
    cadencia: "Diária: Daily Brief. Semanal: carteira e comercial. Mensal: financeiro.",
    onboarding: "Acesso total, incluindo Financeiro (R$) e Permissões\nLeitura do contexto-mestre (POP-ENG-001)" },
  { cid: "coord_tecnica", nome: "Coordenação Técnica / Operações", area: "Engenharia",
    missao: "Conduz os projetos de engenharia do kickoff à entrega, garantindo prazo, qualidade e processo.",
    responsabilidades: "Abrir e organizar centros de custo\nDistribuir tarefas e acompanhar prazos (GUT)\nAprovar propostas de projeto e horas\nAcionar o Crivo A-F antes de liberar",
    entregaveis: "Carteira atualizada com status e prioridade\nPacote de entrega revisado",
    rotinas: "Aprovar horas e propostas de projeto\nAtualizar GUT, etapas e prazos\nPreparar emissões",
    cadencia: "Diária: agenda e brief. Semanal: status da carteira.",
    onboarding: "Acesso de coordenação da engenharia\nLeitura do processo e do manual vivo (Trilhas)" },
  { cid: "coord_comercial", nome: "Coordenação Comercial", area: "Comercial",
    missao: "Conduz a prospecção, as propostas e o relacionamento com clientes.",
    responsabilidades: "Gerir o funil de leads e oportunidades\nElaborar e acompanhar propostas\nManter a carteira de clientes\nAlinhar entregas com a Coordenação Técnica",
    entregaveis: "Funil atualizado\nPropostas enviadas e acompanhadas",
    rotinas: "Trabalhar os Top Leads\nAtualizar o status do funil\nAgenda comercial",
    cadencia: "Diária: funil e brief. Semanal: pipeline e propostas.",
    onboarding: "Acesso comercial (cargo)\nLeitura do portfólio e da matriz de priorização" },
  { cid: "coord_financeira", nome: "Coordenação Financeira", area: "Financeiro",
    missao: "Responde pela posição financeira: custo real, contratos e margem por projeto.",
    responsabilidades: "Manter o custo/hora por colaborador\nLançar contrato e percentuais por projeto\nAcompanhar a margem (lucro x prejuízo)\nControlar contas a pagar e a receber",
    entregaveis: "Margem por projeto atualizada\nPosição financeira da casa",
    rotinas: "Conferir custos e contratos\nRevisar a margem (prejuízo primeiro)",
    cadencia: "Semanal: margem por projeto. Mensal: posição financeira.",
    onboarding: "Acesso ao módulo Financeiro (cargo)\nAlinhamento com a Direção" },
  { cid: "coord_juridica", nome: "Coordenação Jurídica / Contratos", area: "Jurídico",
    missao: "Garante a conformidade legal e a gestão de contratos da casa.",
    responsabilidades: "Revisar e gerir contratos\nConferir conformidade legal e regulatória\nApoiar propostas com cláusulas e análise de risco\nGuardar os documentos jurídicos",
    entregaveis: "Contratos revisados\nPareceres e cláusulas",
    rotinas: "Revisão de contratos em andamento\nAcompanhamento de prazos legais",
    cadencia: "Por contrato/proposta. Semanal: pendências jurídicas.",
    onboarding: "Acesso jurídico (cargo)\nLeitura dos modelos de contrato da casa" },
  { cid: "coord_adm_rh", nome: "Coordenação Administrativa / RH", area: "Pessoas",
    missao: "Cuida das pessoas, dos cargos, dos acessos e das rotinas administrativas.",
    responsabilidades: "Manter o catálogo de cargos e as capabilities\nAtribuir cargo a cada colaborador\nAprovar primeiro acesso e papéis não sensíveis\nConduzir onboarding e a cadência de pessoas",
    entregaveis: "Cada pessoa com cargo e acesso corretos\nOnboarding conduzido",
    rotinas: "Atribuir e ajustar cargos no RH\nAprovar acessos\nAcompanhar o onboarding",
    cadencia: "Semanal: pessoas e acessos. Por entrada: onboarding.",
    onboarding: "Acesso ao módulo RH (cargo)\nLeitura do modelo de cargos e capabilities" },
  { cid: "projetista", nome: "Engenheiro(a) Projetista", area: "Engenharia",
    missao: "Dimensiona e redige os memoriais técnicos com rastreabilidade do dado ao parágrafo.",
    responsabilidades: "Fechar grau de liberdade e balanços\nDimensionar pela skill de domínio\nRedigir memorial de cálculo e descritivo\nAtender aos comentários do revisor",
    entregaveis: "Memorial de cálculo\nMemorial descritivo\nCritérios de projeto",
    rotinas: "Apontar horas por centro de custo\nRegistrar premissas e fontes\nPropor novos projetos para aprovação",
    cadencia: "Diária: execução. Por entrega: revisão independente antes de liberar.",
    onboarding: "Acesso de equipe\nLeitura das skills de domínio e do padrão de memorial" },
  { cid: "analista", nome: "Analista Ambiental", area: "Ambiental",
    missao: "Sustenta a base factual: diagnóstico, dados de campo, licenciamento e normas.",
    responsabilidades: "Diagnóstico e linha de base\nAuditoria de dados de processo\nConferência normativa e de enquadramento\nApoio ao licenciamento",
    entregaveis: "Relatório de diagnóstico\nMatriz de normas aplicáveis",
    rotinas: "Apontar horas\nManter o acervo e as fichas atualizados",
    cadencia: "Por projeto: diagnóstico antes de dimensionar.",
    onboarding: "Acesso de equipe\nLeitura das skills de diagnóstico e normas" },
  { cid: "cadista", nome: "Projetista CAD / Modelador 3D", area: "Engenharia",
    missao: "Gera pranchas, cortes e o modelo 3D a partir de memorial fechado, com coordenada e layer rastreáveis.",
    responsabilidades: "Gerar prancha executiva e cortes\nOrganizar layers e penas\nManter o modelo 3D georreferenciado\nVerificar locação e cotas",
    entregaveis: "Pranchas em DWG/DXF\nModelo 3D navegável\nFluxograma P&ID",
    rotinas: "Apontar horas\nRodar o crivo gráfico antes de emitir",
    cadencia: "Por entrega: emissão e aferição contra o modelo do cliente.",
    onboarding: "Acesso de equipe\nLeitura do KIT-CAD e das skills de CAD/P&ID" },
  { cid: "estagiario", nome: "Estagiário(a)", area: "Formação",
    missao: "Aprende o processo da casa apoiando a execução sob supervisão.",
    responsabilidades: "Apoiar coletas e organização de dados\nSeguir as Trilhas do seu papel\nApontar horas e registrar dúvidas",
    entregaveis: "Tarefas de apoio concluídas\nRegistros organizados",
    rotinas: "Trilhas de onboarding\nApontamento diário de horas",
    cadencia: "Diária: trilha e tarefas. Semanal: devolutiva com o supervisor.",
    onboarding: "Acesso de equipe\nTrilha de primeiro acesso" },
  { cid: "engenheiro_jr", nome: "Engenheiro(a) Júnior", area: "Engenharia",
    missao: "Executa dimensionamentos e memoriais sob supervisão, consolidando a base técnica.",
    responsabilidades: "Dimensionar sob orientação do pleno/sênior\nRedigir trechos do memorial\nApontar horas e registrar premissas",
    entregaveis: "Trechos de memorial e planilhas de cálculo",
    rotinas: "Execução diária\nRevisão com o pleno/sênior antes de fechar",
    cadencia: "Diária: execução. Por entrega: revisão interna.",
    onboarding: "Acesso de equipe\nTrilhas de domínio e padrão de memorial" },
  { cid: "engenheiro_pl", nome: "Engenheiro(a) Pleno", area: "Engenharia",
    missao: "Conduz o dimensionamento e o memorial de um projeto com autonomia técnica.",
    responsabilidades: "Fechar grau de liberdade e balanços\nRedigir o memorial completo\nOrientar o júnior\nPropor projetos",
    entregaveis: "Memorial de cálculo e descritivo\nCritérios de projeto",
    rotinas: "Execução e orientação\nApontar horas",
    cadencia: "Diária: execução. Por entrega: revisão independente.",
    onboarding: "Acesso de equipe\nTrilhas de domínio" },
  { cid: "engenheiro_sr", nome: "Engenheiro(a) Sênior", area: "Engenharia",
    missao: "Responde tecnicamente pelo projeto e pela qualidade do que a equipe produz.",
    responsabilidades: "Definir concepção e rota técnica\nRevisar o trabalho do pleno/júnior\nGarantir normas e critérios\nApoiar a coordenação técnica",
    entregaveis: "Concepção e memorial sênior\nParecer técnico",
    rotinas: "Revisão técnica\nApoio à proposta e ao cliente",
    cadencia: "Por projeto: concepção e revisão técnica.",
    onboarding: "Acesso de equipe (ou coordenação, se também coordenar)\nTrilhas de domínio e normas" },
  { cid: "montagem", nome: "Montagem, Prototipagem e Serralheria", area: "Oficina / Protótipo",
    missao: "Executa montagem, prototipagem e serralheria dos projetos e ensaios.",
    responsabilidades: "Montar protótipos e bancadas\nServalheria e usinagem leve\nApoiar ensaios de tratabilidade/BMP\nZelar por segurança e ferramentas",
    entregaveis: "Protótipos e bancadas montados\nPeças fabricadas",
    rotinas: "Execução na oficina\nApontar horas por projeto",
    cadencia: "Por demanda de projeto/ensaio.",
    onboarding: "Acesso de equipe\nNormas de segurança da oficina" },
  /* ===== Catálogo ampliado (empresa de engenharia): esqueletos para o RH completar/atribuir.
     missão em uma linha; responsabilidades/entregáveis/rotinas/cadência/metas a cargo do RH. ===== */
  { cid: "eng_civil", nome: "Engenheiro(a) Civil", area: "Engenharia", missao: "Projeto e execução de obras civis, estruturas e infraestrutura.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "eng_ambiental", nome: "Engenheiro(a) Ambiental", area: "Ambiental", missao: "Estudos, licenciamento e soluções ambientais.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "eng_quimico", nome: "Engenheiro(a) Químico(a) / de Processos", area: "Processos", missao: "Processos, tratabilidade e dimensionamento de unidades.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "eng_sanitarista", nome: "Engenheiro(a) Sanitarista", area: "Saneamento", missao: "Água, esgoto, drenagem e resíduos.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "eng_eletricista", nome: "Engenheiro(a) Eletricista", area: "Elétrica/Automação", missao: "Projeto elétrico, automação e instrumentação.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "eng_mecanico", nome: "Engenheiro(a) Mecânico(a)", area: "Mecânica", missao: "Equipamentos, tubulação e sistemas mecânicos.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "gerente_projetos", nome: "Gerente de Projetos", area: "Gestão", missao: "Planeja, acompanha prazo/escopo/custo e entrega dos projetos.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "tecnico_campo", nome: "Técnico(a) de Campo", area: "Campo", missao: "Levantamentos, medições, coletas e acompanhamento de obra.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "tecnico_lab", nome: "Técnico(a) de Laboratório", area: "Laboratório", missao: "Ensaios de bancada, análises e registro de resultados.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "operador_ete", nome: "Operador(a) de ETE/ETA", area: "Operação", missao: "Operação e monitoramento de estações de tratamento.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "topografo", nome: "Topógrafo(a)", area: "Campo", missao: "Levantamento topográfico e georreferenciamento.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "eletricista", nome: "Eletricista / Instalações", area: "Oficina / Campo", missao: "Instalações e manutenção elétrica de sistemas e bancadas.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "soldador", nome: "Soldador(a) / Caldeireiro(a)", area: "Oficina / Protótipo", missao: "Solda e fabricação de estruturas e tubulação metálica.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "instalador_hidraulico", nome: "Instalador Hidráulico", area: "Oficina / Campo", missao: "Montagem e instalação hidráulica de sistemas.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "comercial_vendas", nome: "Analista Comercial / Vendas", area: "Comercial", missao: "Prospecção, qualificação de leads e propostas.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "adm_financeiro", nome: "Assistente Administrativo-Financeiro", area: "Financeiro", missao: "Rotinas administrativas e financeiras de apoio.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "compras", nome: "Compras / Suprimentos", area: "Suprimentos", missao: "Cotações, compras e gestão de fornecedores.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "marketing", nome: "Marketing / Conteúdo", area: "Marketing", missao: "Marca, conteúdo e presença digital.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
  { cid: "ti", nome: "TI / Sistemas", area: "TI", missao: "Infraestrutura, sistemas e suporte interno.", responsabilidades: "", entregaveis: "", rotinas: "", cadencia: "", onboarding: "" },
];

let ready: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!ready) ready = (async () => {
    /* Leitura rapida da sentinela (1 round-trip D1). Em D1 NOVO a tabela
     * `config` ainda nao existe — e num schema antigo ela pode nao ter a coluna
     * tenant_id que cfgGet filtra: nos dois casos o SELECT lanca, cai no catch e
     * `cur` fica null. Sentinela ausente/antiga != SCHEMA_VER => setup completo
     * roda. Nunca pulamos o setup num D1 sem a sentinela CORRETA. */
    let cur: string | null = null;
    try { cur = await cfgGet("schema_ver"); } catch (_) { cur = null; }
    /* Schema ja atual nesta instancia: pula o CREATE batch + todos os ALTER +
     * backfill; `ready` resolve com 1 unica leitura. E o que corta o cold start
     * de ~11s (laco de ALTER, cada um um round-trip) para o custo de 1 SELECT. */
    if (cur === SCHEMA_VER) return;
    /* Caminho de setup COMPLETO (D1 novo OU schema mudou OU D1 existente sem a
     * sentinela): idempotente e identico ao de antes — ao fim grava a sentinela. */
    await sqlite.batch([
      `CREATE TABLE IF NOT EXISTS lanc (
        id TEXT PRIMARY KEY, slug TEXT NOT NULL, d TEXT NOT NULL, cc TEXT NOT NULL,
        h REAL NOT NULL, t TEXT DEFAULT '', s TEXT DEFAULT 'PENDENTE', m TEXT DEFAULT '',
        a TEXT DEFAULT '', c TEXT DEFAULT '', u TEXT DEFAULT '')`,
      `CREATE TABLE IF NOT EXISTS proj (
        cc TEXT PRIMARY KEY, projeto TEXT NOT NULL, subtipo TEXT DEFAULT '', status TEXT DEFAULT 'A INICIAR',
        inicio TEXT DEFAULT '', previsto TEXT DEFAULT '', fim TEXT DEFAULT '', registro TEXT DEFAULT 'ATIVO')`,
      `CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS conteudo (
        id TEXT PRIMARY KEY, area TEXT NOT NULL, titulo TEXT NOT NULL,
        descricao TEXT DEFAULT '', url TEXT DEFAULT '', tag TEXT DEFAULT '',
        destaque INTEGER DEFAULT 0, autor TEXT DEFAULT '', criado TEXT DEFAULT '', u TEXT DEFAULT '')`,
      `CREATE TABLE IF NOT EXISTS sess (token TEXT PRIMARY KEY, slug TEXT NOT NULL, criado TEXT DEFAULT '', ultimo TEXT DEFAULT '')`,
      `CREATE TABLE IF NOT EXISTS audit (ts TEXT, slug TEXT, ev TEXT, det TEXT DEFAULT '', ip TEXT DEFAULT '')`,
      `CREATE TABLE IF NOT EXISTS docs (slug TEXT PRIMARY KEY, titulo TEXT, drive TEXT DEFAULT '', tipo TEXT DEFAULT 'md', corpo TEXT)`,
      `CREATE TABLE IF NOT EXISTS solic (id TEXT PRIMARY KEY, slug TEXT NOT NULL, itens TEXT DEFAULT '', obs TEXT DEFAULT '', status TEXT DEFAULT 'ABERTA', criado TEXT DEFAULT '', atendido_por TEXT DEFAULT '', atendido_em TEXT DEFAULT '')`,
      /* T7: solicitacoes de ACESSO (entrada no portal), distintas de `solic` (pedido de
         ferramentas de IA de quem ja entrou). Nasce no tenant Intelecto; tenant_id ja inline
         (tabela nova, fora do loop de ALTER da T1). `papel_sol` = papel sugerido (allowlist ou
         'cliente'); `papel_conc` = papel efetivamente concedido na aprovacao. */
      `CREATE TABLE IF NOT EXISTS acesso (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto',
        email TEXT NOT NULL DEFAULT '', nome TEXT DEFAULT '', slug TEXT DEFAULT '',
        papel_sol TEXT NOT NULL DEFAULT 'cliente', papel_conc TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'ABERTA', obs TEXT DEFAULT '',
        criado TEXT DEFAULT '', decidido_por TEXT DEFAULT '', decidido_em TEXT DEFAULT '', ip TEXT DEFAULT '')`,
      /* Funil comercial dos Leads Ambientais (aba Comercial): status/notas por lead, por
         tenant. `lead_key` = fkey do painel (fichaQF::nome|municipio|cod|idSePF). */
      `CREATE TABLE IF NOT EXISTS lead_funnel (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', lead_key TEXT NOT NULL,
        status TEXT DEFAULT '', notas TEXT DEFAULT '', dono TEXT DEFAULT '',
        atualizado_em TEXT DEFAULT '', PRIMARY KEY (tenant_id, lead_key))`,
      `CREATE TABLE IF NOT EXISTS projx (
        cc TEXT PRIMARY KEY, com TEXT DEFAULT '', assin TEXT DEFAULT '',
        prev REAL DEFAULT 0, obs TEXT DEFAULT '', u TEXT DEFAULT '')`,
      `CREATE TABLE IF NOT EXISTS andam (
        id TEXT PRIMARY KEY, cc TEXT NOT NULL, d TEXT NOT NULL,
        etapa INTEGER DEFAULT 0, total INTEGER DEFAULT 0,
        detalhe TEXT DEFAULT '', slug TEXT DEFAULT '', criado TEXT DEFAULT '')`,
      `CREATE TABLE IF NOT EXISTS prod (
        n INTEGER PRIMARY KEY, titulo TEXT, tipo TEXT, sit TEXT,
        met TEXT DEFAULT '', norma TEXT DEFAULT '', apr TEXT DEFAULT '',
        sec TEXT DEFAULT '', ccs TEXT DEFAULT '')`,
      // Horas previstas na proposta, abertas por função — a base da comparação de esforço.
      `CREATE TABLE IF NOT EXISTS prevf (
        cc TEXT NOT NULL, func TEXT NOT NULL, h REAL DEFAULT 0, u TEXT DEFAULT '',
        PRIMARY KEY (cc, func))`,
      // Calendário: reuniões, eventos, visitas, treinamentos, ciclos PDCA e auditorias 5S.
      `CREATE TABLE IF NOT EXISTS evento (
        id TEXT PRIMARY KEY, d TEXT NOT NULL, dfim TEXT DEFAULT '', hora TEXT DEFAULT '',
        tipo TEXT DEFAULT 'REUNIAO', titulo TEXT NOT NULL, setor TEXT DEFAULT '',
        cc TEXT DEFAULT '', resp TEXT DEFAULT '', fase TEXT DEFAULT '', local TEXT DEFAULT '',
        obs TEXT DEFAULT '', autor TEXT DEFAULT '', criado TEXT DEFAULT '')`,
      // Biblioteca técnica: normas, estudos, projetos, cases e materiais de estudo.
      `CREATE TABLE IF NOT EXISTS biblio (
        id TEXT PRIMARY KEY, titulo TEXT NOT NULL, tipo TEXT DEFAULT 'NORMA',
        tema TEXT DEFAULT '', norma TEXT DEFAULT '', ano TEXT DEFAULT '', cc TEXT DEFAULT '',
        url TEXT DEFAULT '', doc TEXT DEFAULT '', resumo TEXT DEFAULT '', tags TEXT DEFAULT '',
        destaque INTEGER DEFAULT 0, autor TEXT DEFAULT '', criado TEXT DEFAULT '', u TEXT DEFAULT '')`,
      // Fichas de parâmetro: o número que se consulta no meio do dimensionamento, com a condição
      // em que vale, a fonte na biblioteca e o risco de errar. Sem valor monetário, por regra.
      `CREATE TABLE IF NOT EXISTS param (
        id TEXT PRIMARY KEY, dominio TEXT DEFAULT 'GER', parametro TEXT NOT NULL,
        unidade TEXT DEFAULT '', faixa TEXT DEFAULT '', pratica TEXT DEFAULT '',
        condicao TEXT DEFAULT '', fonte TEXT DEFAULT '', risco TEXT DEFAULT '',
        verificacao TEXT DEFAULT '', autor TEXT DEFAULT '', criado TEXT DEFAULT '', u TEXT DEFAULT '')`,
      /* DAILY BRIEF — radar de editais/noticias com triagem por IA (inteligencia INTERNA).
         Tabela nova com tenant_id JA inline (fora do loop de ALTER da T1, como `acesso`). A
         confidencialidade real e o filtro por tenant_id no servidor em toda query (T2). Sem
         valor monetario, por regra da casa. `score` = Impact Score 0-100 de relevancia para os
         4 focos (saneamento/ambiente, mineracao, P&D/fomento, biogas/bioeconomia); `area` = uma
         ou mais de san|min|pd|bio (separadas por virgula); `sit` = TRIADO | A_TRIAR (fallback
         quando a IA nao respondeu); `origem` = 'manual' nesta rodada (porta aberta p/ fontes
         automaticas, ver BRIEF_FONTES). */
      `CREATE TABLE IF NOT EXISTS brief (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto',
        tipo TEXT NOT NULL DEFAULT 'noticia' CHECK (tipo IN ('edital','noticia')),
        titulo TEXT NOT NULL DEFAULT '', fonte TEXT DEFAULT '', url TEXT DEFAULT '',
        data TEXT DEFAULT '', resumo TEXT DEFAULT '', score INTEGER DEFAULT 0,
        tags TEXT DEFAULT '', area TEXT DEFAULT '', origem TEXT DEFAULT 'manual',
        sit TEXT DEFAULT 'TRIADO', autor TEXT DEFAULT '', criado TEXT DEFAULT '')`,
      /* FINANCEIRO (admin-only, dono): custo/hora por colaborador. Valor monetario — a regra
         "sem valor monetario" vale para TODO o resto do portal; esta tabela e a excecao
         explicita, restrita ao dono (isOwner) tanto no guard quanto na UI. tenant_id inline
         (fora do loop de ALTER da T1, como brief/acesso/lead_funnel). */
      `CREATE TABLE IF NOT EXISTS custohora (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL,
        valor REAL DEFAULT 0, u TEXT DEFAULT '', atualizado TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, slug))`,
      /* FINANCEIRO — custo/hora com VIGÊNCIA (histórico datado). Cada linha = o custo/hora de um
         colaborador a partir de `desde` (YYYY-MM-DD). O custo de um apontamento usa a taxa com o
         maior `desde` <= data do apontamento. Assim cortes/aumentos/margem NÃO reescrevem o custo
         histórico do CC: horas antigas mantêm a taxa da época; alocações após a mudança adotam a
         nova. Confidencial (R$): só dono / coord. financeira. */
      `CREATE TABLE IF NOT EXISTS custohora_vig (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, desde TEXT NOT NULL,
        valor REAL DEFAULT 0, motivo TEXT DEFAULT '', u TEXT DEFAULT '', criado TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, slug, desde))`,
      /* ===== CRM COMERCIAL (frente E) — réplica do CRM do Marcelo =====
         Confidencial (contatos = PII): acesso só Sócios / Coord. Comercial (gate comercial.*).
         `crm_deal` = entidade central (lead+oportunidade+contrato); `st` = etapa 1–21 do
         POP-ENG-001 (Anexo A); `val` = R$ da proposta/contrato; `cc` liga ao projeto do portal
         (para levar o contratado ao Financeiro). `history` guardado como JSON texto. */
      `CREATE TABLE IF NOT EXISTS crm_deal (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, st INTEGER DEFAULT 0,
        co TEXT DEFAULT '', city TEXT DEFAULT '', seg TEXT DEFAULT '', prod TEXT DEFAULT '',
        val REAL DEFAULT 0, owner TEXT DEFAULT '', pri TEXT DEFAULT '',
        contact TEXT DEFAULT '', role TEXT DEFAULT '', email TEXT DEFAULT '', phone TEXT DEFAULT '',
        src TEXT DEFAULT '', pain TEXT DEFAULT '', entry TEXT DEFAULT '',
        d4date TEXT DEFAULT '', sentdate TEXT DEFAULT '', signeddate TEXT DEFAULT '',
        lastdate TEXT DEFAULT '', last TEXT DEFAULT '', nextdate TEXT DEFAULT '', next TEXT DEFAULT '',
        lossreason TEXT DEFAULT '', autuacao TEXT DEFAULT '', temp TEXT DEFAULT '', tempreason TEXT DEFAULT '',
        history TEXT DEFAULT '', cc TEXT DEFAULT '', atualizado TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, id))`,
      `CREATE TABLE IF NOT EXISTS crm_lead (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, empresa TEXT DEFAULT '',
        segmento TEXT DEFAULT '', cidade TEXT DEFAULT '', produto TEXT DEFAULT '', porte TEXT DEFAULT '',
        sinal TEXT DEFAULT '', fonte TEXT DEFAULT '', contato TEXT DEFAULT '', cargo TEXT DEFAULT '',
        telefone TEXT DEFAULT '', email TEXT DEFAULT '', status TEXT DEFAULT '', descoberto TEXT DEFAULT '',
        origem TEXT DEFAULT '', mensagem TEXT DEFAULT '', canal TEXT DEFAULT '', dealid TEXT DEFAULT '',
        aprovado TEXT DEFAULT '', descartado TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, id))`,
      `CREATE TABLE IF NOT EXISTS crm_time (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, d TEXT DEFAULT '',
        area TEXT DEFAULT '', hours REAL DEFAULT 0, note TEXT DEFAULT '', updatedat TEXT DEFAULT '',
        deleted INTEGER DEFAULT 0, PRIMARY KEY (tenant_id, id))`,
      /* FINANCEIRO — RESUMO EXECUTIVO MATERIALIZADO. Cada linha é um snapshot DATADO do
         consolidado (financeiro + pipeline CRM + horas + fluxo), gravado como JSON em `dados`.
         "Materializar" = fechar o retrato de um dia e guardá-lo como registro histórico, com
         autor e data — a trilha de auditoria registra o evento `resumo_exec`. Confidencial (R$):
         só dono / coord. financeira. tenant_id inline (fora do loop de ALTER da T1). */
      `CREATE TABLE IF NOT EXISTS fin_snapshot (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', d TEXT NOT NULL,
        dados TEXT NOT NULL DEFAULT '{}', autor TEXT DEFAULT '', criado TEXT DEFAULT '')`,
      /* FINANCEIRO — BASE DO FLUXO DE CAIXA (item "criar" do cérebro operacional). Lançamentos de
         entradas e saídas, com previsto × realizado, por projeto (cc opcional). Editável e
         rastreável NO PORTAL: toda criação/edição/exclusão grava o evento `fluxo` na auditoria.
         Nasce VAZIA — nenhum valor é inventado; a casa lança o que é real. Confidencial (R$):
         só dono / coord. financeira. tenant_id inline (fora do loop de ALTER da T1). */
      `CREATE TABLE IF NOT EXISTS fluxo (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto',
        tipo TEXT NOT NULL DEFAULT 'entrada' CHECK (tipo IN ('entrada','saida')),
        categoria TEXT DEFAULT '', descricao TEXT DEFAULT '', cc TEXT DEFAULT '',
        valor REAL DEFAULT 0, data_prev TEXT DEFAULT '', data_real TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto','realizado','cancelado')),
        origem TEXT DEFAULT 'manual', u TEXT DEFAULT '', criado TEXT DEFAULT '', atualizado TEXT DEFAULT '')`,
      /* FINANCEIRO — CUSTOS FIXOS / OVERHEAD (item Onda 2). Pool editável de custos fixos da casa
         (comercial, financeiro, administrativo, RH, aluguel, jurídico, relações institucionais,
         outros) que NÃO são mão de obra técnica de projeto. O rollup rateia este pool sobre a
         carteira bilhável POR HORAS APONTADAS (decisão do dono), antes de impostos e margem.
         Nasce VAZIO — nada inventado. Confidencial (R$): só dono / coord. financeira. */
      `CREATE TABLE IF NOT EXISTS custo_fixo (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto',
        categoria TEXT NOT NULL DEFAULT 'outros', descricao TEXT DEFAULT '',
        valor REAL DEFAULT 0, u TEXT DEFAULT '', criado TEXT DEFAULT '', atualizado TEXT DEFAULT '')`,
      /* ESTRUTURA POR CENTRO DE CUSTO (item Onda 2 — preparação do backend futuro). Cada CC
         contratado poderá ter seus contratos, propostas, produtos e histórico próprios no portal.
         Tabelas-base criadas agora (vazias); CRUD/UI ficam para a próxima rodada. tenant_id inline. */
      `CREATE TABLE IF NOT EXISTS cc_contrato (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', cc TEXT NOT NULL,
        titulo TEXT DEFAULT '', valor REAL DEFAULT 0, assinado TEXT DEFAULT '', obs TEXT DEFAULT '',
        u TEXT DEFAULT '', criado TEXT DEFAULT '', atualizado TEXT DEFAULT '')`,
      `CREATE TABLE IF NOT EXISTS cc_proposta (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', cc TEXT NOT NULL,
        titulo TEXT DEFAULT '', valor REAL DEFAULT 0, status TEXT DEFAULT '', enviada TEXT DEFAULT '',
        obs TEXT DEFAULT '', u TEXT DEFAULT '', criado TEXT DEFAULT '', atualizado TEXT DEFAULT '')`,
      `CREATE TABLE IF NOT EXISTS cc_produto (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', cc TEXT NOT NULL,
        titulo TEXT DEFAULT '', tipo TEXT DEFAULT '', status TEXT DEFAULT '', obs TEXT DEFAULT '',
        u TEXT DEFAULT '', criado TEXT DEFAULT '', atualizado TEXT DEFAULT '')`,
      `CREATE TABLE IF NOT EXISTS cc_hist (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', cc TEXT NOT NULL,
        d TEXT DEFAULT '', tipo TEXT DEFAULT '', detalhe TEXT DEFAULT '',
        u TEXT DEFAULT '', criado TEXT DEFAULT '')`,
    ].map((sql) => ({ sql, args: [] })));
    // FINANCEIRO — consumíveis e terceiros por projeto (R$). O custo/hora JÁ embute impostos,
    // rateio e encargos de mão de obra; o custo real do projeto = MO + consumíveis + terceiros + outros.
    try { await sqlite.execute("ALTER TABLE projx ADD COLUMN consumiveis REAL DEFAULT 0"); } catch (_) { /* já existe */ }
    try { await sqlite.execute("ALTER TABLE projx ADD COLUMN terceiros REAL DEFAULT 0"); } catch (_) { /* já existe */ }
    // projx ganhou setor e responsável do projeto depois de criada: acrescenta se faltar.
    for (const col of ["setor TEXT DEFAULT ''", "resp TEXT DEFAULT ''"]) {
      try { await sqlite.execute("ALTER TABLE projx ADD COLUMN " + col); } catch (_) { /* já existe */ }
    }
    // CARTEIRA EXECUTIVA: priorização GUT (Gravidade × Urgência × Tendência, cada 1-5; 0 = não
    // avaliado) e Progresso 0-100 (%). A prioridade (G×U×T) é derivada, não armazenada. ALTER
    // idempotente — mesma disciplina das demais migrações de coluna. Sem valor monetário.
    // Impacto e Esforço (cada 1-5, aba "Matriz de Prioridade"): a Prioridade (1-100) = média de
    // (G×U×T)/125×100 e (Impacto×Esforço)/25×100. Esforço orientado p/ 5 = baixo esforço.
    for (const col of ["gravidade INTEGER DEFAULT 0", "urgencia INTEGER DEFAULT 0", "tendencia INTEGER DEFAULT 0", "progresso INTEGER DEFAULT 0", "impacto INTEGER DEFAULT 0", "esforco INTEGER DEFAULT 0"]) {
      try { await sqlite.execute("ALTER TABLE projx ADD COLUMN " + col); } catch (_) { /* já existe */ }
    }
    // FINANCEIRO (admin-only, dono): entradas de contrato por projeto. contratado/outros em R$;
    // pct_* em % (imposto sobre contratado, rateio sobre mão de obra, lucro-alvo sobre contratado
    // — referência). Fica em projx (já chaveada por cc e por tenant). ALTER idempotente. Visível
    // e editável só pelo dono (isOwner); o resto do portal continua sem valor monetário.
    for (const col of ["contratado REAL DEFAULT 0", "pct_imposto REAL DEFAULT 0", "pct_rateio REAL DEFAULT 0", "pct_lucro REAL DEFAULT 0", "outros REAL DEFAULT 0", "fin_u TEXT DEFAULT ''"]) {
      try { await sqlite.execute("ALTER TABLE projx ADD COLUMN " + col); } catch (_) { /* já existe */ }
    }
    // biblio virou ficha de acervo (domínio, quando se aplica, critério, limites, prática, evidência).
    for (const col of ["dominio TEXT DEFAULT ''", "assunto TEXT DEFAULT ''", "aplica TEXT DEFAULT ''",
      "criterio TEXT DEFAULT ''", "limites TEXT DEFAULT ''", "pratica TEXT DEFAULT ''",
      "evidencia TEXT DEFAULT ''", "revisao TEXT DEFAULT ''", "situacao TEXT DEFAULT 'VIGENTE'"]) {
      try { await sqlite.execute("ALTER TABLE biblio ADD COLUMN " + col); } catch (_) { /* já existe */ }
    }
    // Progresso de curso: um registro por pessoa, curso e módulo concluído.
    try {
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS progcurso (
        slug TEXT NOT NULL, curso TEXT NOT NULL, modulo TEXT NOT NULL,
        nota REAL DEFAULT 0, total REAL DEFAULT 0, quando TEXT DEFAULT '',
        PRIMARY KEY (slug, curso, modulo))`);
    } catch (_) { /* já existe */ }
    // Prazos alterados no portal guardam quem alterou e quando — a planilha não é tocada.
    for (const col of ["alterado_por TEXT DEFAULT ''", "alterado_em TEXT DEFAULT ''"]) {
      try { await sqlite.execute("ALTER TABLE proj ADD COLUMN " + col); } catch (_) { /* já existe */ }
    }
    // Empresa, cliente e tipo vieram da planilha Registrar Projetos na importação de 2026-09-23;
    // até então o cadastro do portal não coletava esses três campos.
    for (const col of ["empresa TEXT DEFAULT ''", "cliente TEXT DEFAULT ''", "tipo TEXT DEFAULT ''"]) {
      try { await sqlite.execute("ALTER TABLE proj ADD COLUMN " + col); } catch (_) { /* já existe */ }
    }
    // SHOWCASE/PORTAL DO CLIENTE: liberação por projeto ao papel 'cliente'. 0 = não liberado
    // (padrão, fail-closed). O cliente só enxerga proj com liberado_cliente=1 do SEU cliente,
    // recorte feito no SERVIDOR (ver ação 'showcase'). ALTER idempotente.
    try { await sqlite.execute("ALTER TABLE proj ADD COLUMN liberado_cliente INTEGER DEFAULT 0"); } catch (_) { /* já existe */ }
    // Ficha redigida pelo autor técnico nasce RASCUNHO e só vale depois da aprovação da Coordenação.
    try { await sqlite.execute("ALTER TABLE param ADD COLUMN situacao TEXT DEFAULT 'RASCUNHO'"); } catch (_) { /* já existe */ }
    // Agenda: eventos periódicos. Cada ocorrência de uma série é uma linha de `evento`;
    // todas compartilham o mesmo serie_id. Evento avulso fica com serie_id vazio — a
    // lista/edição/exclusão por instância seguem idênticas. ALTER idempotente (DEFAULT '').
    try { await sqlite.execute("ALTER TABLE evento ADD COLUMN serie_id TEXT DEFAULT ''"); } catch (_) { /* já existe */ }
    // Pauta/motivo da reunião (o que precisa ser discutido). ALTER idempotente.
    try { await sqlite.execute("ALTER TABLE evento ADD COLUMN pauta TEXT DEFAULT ''"); } catch (_) { /* já existe */ }

    /* ===== T1: multi-tenant + papel formal (migração delta-safe, idempotente) ===== */
    // tenant_id em TODAS as 16 tabelas. No SQLite, ADD COLUMN NOT NULL DEFAULT já
    // preenche as linhas legadas com o default — o backfill fica automático; não há
    // DROP nem recarga. O isolamento real é o filtro de tenant_id no servidor (T2).
    const TABELAS_TENANT = ["lanc", "proj", "config", "conteudo", "sess", "audit", "docs",
      "solic", "projx", "andam", "prod", "prevf", "evento", "biblio", "param", "progcurso"];
    for (const t of TABELAS_TENANT) {
      try { await sqlite.execute("ALTER TABLE " + t + " ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '" + TENANT_INTELECTO + "'"); } catch (_) { /* já existe */ }
    }
    // Backfill cinto-e-suspensório (idempotente): qualquer linha sem tenant vira Intelecto.
    await sqlite.batch(TABELAS_TENANT.map((t) => ({
      sql: "UPDATE " + t + " SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = ''",
      args: [TENANT_INTELECTO],
    })));
    try { await sqlite.execute("CREATE INDEX IF NOT EXISTS lanc_tenant ON lanc (tenant_id)"); } catch (_) {}
    try { await sqlite.execute("CREATE INDEX IF NOT EXISTS proj_tenant ON proj (tenant_id)"); } catch (_) {}
    // Tabela formal de papel (substitui a inferência por listas de slug). Fornecedor é lateral.
    try {
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS membro (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL,
        papel TEXT NOT NULL DEFAULT 'equipe' CHECK (papel IN ('admin','coordenacao','equipe','cliente','fornecedor')),
        nome TEXT DEFAULT '', ativo INTEGER DEFAULT 1, criado TEXT DEFAULT '', u TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, slug))`);
    } catch (_) { /* já existe */ }
    try { await sqlite.execute("CREATE INDEX IF NOT EXISTS membro_slug ON membro (slug)"); } catch (_) {}
    try { await sqlite.execute("CREATE INDEX IF NOT EXISTS acesso_status ON acesso (tenant_id, status)"); } catch (_) {}
    // Backfill das identidades atuais: cada colaborador recebe o papel mapeado, sem perda.
    // Inativos mantêm papel (histórico), ativo=0; o login já é barrado por checaAtivo.
    const hoje = new Date().toISOString().slice(0, 10);
    await sqlite.batch(COLABS.map((slug) => ({
      sql: "INSERT OR IGNORE INTO membro (tenant_id, slug, papel, nome, ativo, criado) VALUES (?,?,?,?,?,?)",
      args: [TENANT_INTELECTO, slug, papelInferido(slug), NOMES[slug] || slug, INATIVOS.includes(slug) ? 0 : 1, hoje],
    })));

    /* ===== T5: e-mail como identidade de login (extensao do modelo formal) ===== */
    // Coluna email em membro (ALTER idempotente). A credencial continua em config (pin:<slug>),
    // o hash segue SHA-256 salgado; aqui so ganhamos a identidade de login por e-mail.
    try { await sqlite.execute("ALTER TABLE membro ADD COLUMN email TEXT DEFAULT ''"); } catch (_) { /* ja existe */ }
    // Backfill do e-mail formal a partir do cadastro atual da Coordenacao (config email:<slug>),
    // so onde ainda estiver vazio — idempotente e nao sobrescreve e-mail ja definido.
    try {
      await sqlite.execute(
        "UPDATE membro SET email = COALESCE((SELECT v FROM config c WHERE c.k = 'email:' || membro.slug AND c.tenant_id = membro.tenant_id), '') " +
        "WHERE (email IS NULL OR email = '')",
      );
    } catch (_) { /* coluna recem-criada: segue vazia ate o proximo boot */ }

    /* ===== T6: avatar do membro (foto de perfil) ===== */
    // Coluna avatar em membro (ALTER idempotente). Guarda uma imagem PEQUENA como data URL
    // (limite AVATAR_MAX), persistida por tenant_id+slug na propria linha de membro — a
    // confidencialidade por tenant vale tambem para a foto. Sem upload externo (nada de R2).
    try { await sqlite.execute("ALTER TABLE membro ADD COLUMN avatar TEXT DEFAULT ''"); } catch (_) { /* ja existe */ }

    /* ===== SHOWCASE/PORTAL DO CLIENTE: associação Cliente→empresa-cliente ===== */
    // Guarda QUAL cliente (valor de proj.cliente) um usuário de papel 'cliente' representa.
    // Para papéis internos (equipe/coordenacao/admin) fica VAZIA. É a âncora do isolamento:
    // o recorte do showcase de um cliente usa ESTE valor (servidor), nunca o que ele alega.
    try { await sqlite.execute("ALTER TABLE membro ADD COLUMN cliente TEXT DEFAULT ''"); } catch (_) { /* ja existe */ }

    /* ===== DAILY BRIEF ===== */
    // Indice por tenant+score para o feed (ordenado por relevancia). Idempotente.
    try { await sqlite.execute("CREATE INDEX IF NOT EXISTS brief_tenant ON brief (tenant_id, score DESC)"); } catch (_) {}
    // Colunas do feed p/ a coleta automatica (ALTER idempotente — preserva itens existentes):
    //  - categoria: categoria rica (noticia|edital|artigo|licenciamento|outro); `tipo` legado deriva dela.
    //  - chave: hash de dedup (url|titulo por tenant) — impede reentrada do mesmo item entre rodadas.
    //  - fonte_id: liga o item a fonte de `brief_fonte` que o trouxe (rastreabilidade; '' p/ manual).
    try { await sqlite.execute("ALTER TABLE brief ADD COLUMN categoria TEXT DEFAULT ''"); } catch (_) { /* ja existe */ }
    try { await sqlite.execute("ALTER TABLE brief ADD COLUMN chave TEXT DEFAULT ''"); } catch (_) { /* ja existe */ }
    try { await sqlite.execute("ALTER TABLE brief ADD COLUMN fonte_id TEXT DEFAULT ''"); } catch (_) { /* ja existe */ }
    try { await sqlite.execute("CREATE INDEX IF NOT EXISTS brief_chave ON brief (tenant_id, chave)"); } catch (_) {}
    // FONTES DO RADAR (tabela, antes era so um JSON em config `brief_fontes`). Cada linha e uma
    // fonte de coleta: url, categoria, como parsear (tipo_fonte rss|json|html), cadencia, ativo,
    // ultima execucao/status. tenant_id inline. Confidencial por tenant (filtro no servidor).
    try {
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS brief_fonte (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL,
        nome TEXT DEFAULT '', url TEXT DEFAULT '', categoria TEXT DEFAULT 'noticia',
        tipo_fonte TEXT DEFAULT 'rss', seletor TEXT DEFAULT '', cadencia TEXT DEFAULT 'semanal',
        area TEXT DEFAULT '', ativo INTEGER DEFAULT 0,
        ult_exec TEXT DEFAULT '', ult_status TEXT DEFAULT '', ult_novos INTEGER DEFAULT 0,
        criado TEXT DEFAULT '', u TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, id))`);
      // Catalogo-semente DESLIGADO (ativo=0) e SEM url: nada e coletado ate a Coordenacao preencher
      // e ativar na aba Fontes. INSERT OR IGNORE: nunca sobrescreve ajuste ja feito pela casa.
      await sqlite.batch(BRIEF_FONTES_SEED.map((f) => ({
        sql: "INSERT OR IGNORE INTO brief_fonte (tenant_id, id, nome, url, categoria, tipo_fonte, seletor, cadencia, area, ativo, criado) VALUES (?,?,?,?,?,?,?,?,?,0,'')",
        args: [TENANT_INTELECTO, f.id, f.nome, f.url, f.categoria, f.tipo_fonte, "", f.cadencia, f.area],
      })));
    } catch (_) { /* ja existe */ }

    /* ===== RH: catalogo de cargos (manual vivo, editavel pela Coordenacao) =====
     * Descreve missao, responsabilidades, entregaveis, rotinas, cadencia e onboarding por
     * cargo. O vinculo pessoa->cargo reaproveita config `cargo:<slug>` (acao setcargo), entao
     * NAO ha mudanca em `membro`. Sem valor monetario. Seed de EXEMPLO so quando nasce vazia. */
    try {
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS rh_cargo (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', cid TEXT NOT NULL,
        nome TEXT DEFAULT '', ordem INTEGER DEFAULT 0, area TEXT DEFAULT '',
        missao TEXT DEFAULT '', responsabilidades TEXT DEFAULT '', entregaveis TEXT DEFAULT '',
        rotinas TEXT DEFAULT '', cadencia TEXT DEFAULT '', onboarding TEXT DEFAULT '',
        atualizado TEXT DEFAULT '', u TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, cid))`);
      // CAPACIDADE DE TRABALHO: vinculo (Contratado p/ a equipe; Sociedade p/ os socios) e
      // horas/dia esperadas por pessoa daquele cargo. Alimenta o planejamento (pessoas x horas).
      // ALTER idempotente. Sem valor monetario (horas, nao R$).
      try { await sqlite.execute("ALTER TABLE rh_cargo ADD COLUMN horas_dia REAL DEFAULT 0"); } catch (_) { /* ja existe */ }
      try { await sqlite.execute("ALTER TABLE rh_cargo ADD COLUMN vinculo TEXT DEFAULT 'Contratado'"); } catch (_) { /* ja existe */ }
      // Metas e KPIs esperados do cargo (texto livre, editavel no RH). Da ao RH o "tabuleiro" de
      // metas/indicadores por funcao. ALTER idempotente.
      try { await sqlite.execute("ALTER TABLE rh_cargo ADD COLUMN metas TEXT DEFAULT ''"); } catch (_) { /* ja existe */ }
      // Semeadura ADITIVA e idempotente: INSERT OR IGNORE garante que TODOS os cargos do modelo
      // existam, sem sobrescrever os que a Coordenacao ja editou (preserva edicoes) nem apagar
      // cargos criados a mao. Socios nascem com vinculo Sociedade; os demais, Contratado (8h/dia,
      // ajustavel no RH). Roda a cada setup para cargos novos aparecerem em tenants antigos.
      await sqlite.batch(RH_CARGOS_SEED.map((c, i) => {
        const soc = c.cid === "socios";
        return {
          // horas_dia nasce 0 (a definir no RH); so o VINCULO vem definido (Sociedade p/ socios).
          sql: "INSERT OR IGNORE INTO rh_cargo (tenant_id, cid, nome, ordem, area, missao, responsabilidades, entregaveis, rotinas, cadencia, onboarding, horas_dia, vinculo, atualizado) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          args: [TENANT_INTELECTO, c.cid, c.nome, i, c.area, c.missao, c.responsabilidades, c.entregaveis, c.rotinas, c.cadencia, c.onboarding, 0, soc ? "Sociedade" : "Contratado", ""],
        };
      }));
    } catch (_) { /* ja existe */ }

    /* ===== RITOS & CADENCIA (catalogo da Agenda, editavel) ===== */
    try {
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS rito (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', rid TEXT NOT NULL,
        nome TEXT DEFAULT '', tipo TEXT DEFAULT '', cadencia TEXT DEFAULT '', publico TEXT DEFAULT '',
        objetivo TEXT DEFAULT '', pauta TEXT DEFAULT '', entregavel TEXT DEFAULT '',
        ordem INTEGER DEFAULT 0, atualizado TEXT DEFAULT '', u TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, rid))`);
      await sqlite.batch(RITOS_SEED.map((x, i) => ({
        sql: "INSERT OR IGNORE INTO rito (tenant_id, rid, nome, tipo, cadencia, publico, objetivo, pauta, entregavel, ordem, atualizado) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        args: [TENANT_INTELECTO, x.rid, x.nome, x.tipo, x.cadencia, x.publico, x.objetivo, x.pauta, x.entregavel, i, ""],
      })));
    } catch (_) { /* ja existe */ }

    /* ===== GUIAS INTERNOS (indice de referencia na aba Guias do Acervo) ===== */
    try {
      await sqlite.batch(CONTEUDO_SEED.map((x) => ({
        sql: "INSERT OR IGNORE INTO conteudo (id, area, titulo, descricao, url, tag, destaque, autor, criado, u, tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        args: [x.id, x.area, x.titulo, x.descricao, "", x.tag, 0, "", "", "", TENANT_INTELECTO],
      })));
    } catch (_) { /* ja existe */ }

    /* ===== Onda 3 / INC 1 — MULTI-CARGO (associacao N:N pessoa<->cargo) =====
     * Numa startup a pessoa reune as funcoes/capabilities de VARIOS cargos. Esta tabela
     * substitui o vinculo unico `cargocid:<slug>` (config). Capabilities efetivas = UNIAO
     * dos cargos (ver capsDe/capsAtribuidas). `principal` (1 cargo), `prioridade` (ordem de
     * foco) e `foco` (texto) sao definidos pela Coordenacao e sao INFORMATIVOS (planejamento/
     * capacidade), nunca restringem acesso. Sem valor monetario. */
    try {
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS membro_cargo (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, cid TEXT NOT NULL,
        principal INTEGER DEFAULT 0, prioridade INTEGER DEFAULT 0, foco TEXT DEFAULT '',
        criado TEXT DEFAULT '', u TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, slug, cid))`);
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS membro_cargo_slug ON membro_cargo (tenant_id, slug)"); } catch (_) {}
      // Backfill idempotente do vinculo legado (`cargocid:<slug>`): cada atribuicao unica vira
      // a linha PRINCIPAL da pessoa. INSERT OR IGNORE preserva edicoes ja feitas na nova tabela.
      try {
        const leg = await sqlite.execute({ sql: "SELECT k, v FROM config WHERE tenant_id = ? AND k LIKE 'cargocid:%'", args: [TENANT_INTELECTO] });
        const hoje = new Date().toISOString().slice(0, 10);
        const ins = (leg.rows as P[])
          .map((c) => ({ slug: String(c.k).slice(9), cid: String(c.v || "").trim().toLowerCase() }))
          .filter((x) => x.slug && x.cid)
          .map((x) => ({ sql: "INSERT OR IGNORE INTO membro_cargo (tenant_id, slug, cid, principal, prioridade, foco, criado, u) VALUES (?,?,?,1,0,'',?, 'backfill')", args: [TENANT_INTELECTO, x.slug, x.cid, hoje] }));
        if (ins.length) await sqlite.batch(ins);
      } catch (_) { /* backfill best-effort */ }
    } catch (_) { /* ja existe */ }

    /* ===== Onda 3 / INC 2 — FICHA DA PESSOA (CV estruturado + Lattes + skills + metas +
     * treinamentos). Dados PESSOAIS: o gate de leitura/escrita e aplicado NA FONTE (acoes
     * pessoaficha*): a propria pessoa (piso equipe) OU RH/coordenacao/dono. O PDF do CV e do
     * comprovante vivem no R2 (BLOB), servidos de forma privada pela rota /pessoa/arquivo.
     * Sem valor monetario. Nascem VAZIAS — nada inventado. */
    try {
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS pessoa_ficha (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL,
        resumo TEXT DEFAULT '', formacao TEXT DEFAULT '', experiencia TEXT DEFAULT '',
        lattes_url TEXT DEFAULT '', lattes_id TEXT DEFAULT '',
        cv_key TEXT DEFAULT '', cv_nome TEXT DEFAULT '', cv_atualizado TEXT DEFAULT '',
        atualizado TEXT DEFAULT '', u TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, slug))`);
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS pessoa_skill (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, slug TEXT NOT NULL,
        nome TEXT DEFAULT '', nivel INTEGER DEFAULT 1, origem TEXT DEFAULT 'manual',
        area TEXT DEFAULT '', obs TEXT DEFAULT '', atualizado TEXT DEFAULT '', u TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, id))`);
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS pessoa_skill_slug ON pessoa_skill (tenant_id, slug)"); } catch (_) {}
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS pessoa_meta (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, slug TEXT NOT NULL,
        objetivo TEXT DEFAULT '', prazo TEXT DEFAULT '', status TEXT DEFAULT 'aberta',
        progresso INTEGER DEFAULT 0, obs TEXT DEFAULT '', atualizado TEXT DEFAULT '', u TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, id))`);
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS pessoa_meta_slug ON pessoa_meta (tenant_id, slug)"); } catch (_) {}
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS pessoa_treino (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, slug TEXT NOT NULL,
        nome TEXT DEFAULT '', instituicao TEXT DEFAULT '', data TEXT DEFAULT '', carga_h REAL DEFAULT 0,
        comprov_key TEXT DEFAULT '', comprov_nome TEXT DEFAULT '', obs TEXT DEFAULT '',
        atualizado TEXT DEFAULT '', u TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, id))`);
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS pessoa_treino_slug ON pessoa_treino (tenant_id, slug)"); } catch (_) {}
    } catch (_) { /* ja existe */ }

    /* ===== Onda 3 / INC 3 — PORTFÓLIO DE SERVIÇOS da empresa (artefato de empresa, VERSIONADO).
     * Aba própria. Cada serviço tem histórico de versões (portfolio_versao) e pode ligar-se a
     * habilidades (portfolio_skill, por NOME) — "o que a casa entrega com as habilidades atuais".
     * Editado pela Coordenação; leitura interna (piso equipe). Sem valor monetário. Nasce VAZIO. */
    try {
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS portfolio_servico (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', sid TEXT NOT NULL,
        nome TEXT DEFAULT '', categoria TEXT DEFAULT '', resumo TEXT DEFAULT '', descricao TEXT DEFAULT '',
        publico INTEGER DEFAULT 0, ordem INTEGER DEFAULT 0, ativo INTEGER DEFAULT 1,
        ver_atual TEXT DEFAULT '', atualizado TEXT DEFAULT '', u TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, sid))`);
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS portfolio_versao (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, sid TEXT NOT NULL,
        versao TEXT DEFAULT '', descricao TEXT DEFAULT '', mudancas TEXT DEFAULT '', data TEXT DEFAULT '',
        autor TEXT DEFAULT '', criado TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, id))`);
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS portfolio_versao_sid ON portfolio_versao (tenant_id, sid)"); } catch (_) {}
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS portfolio_skill (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', sid TEXT NOT NULL, skill TEXT NOT NULL,
        PRIMARY KEY (tenant_id, sid, skill))`);
    } catch (_) { /* ja existe */ }

    /* ===== Onda 3 / LEADS AMBIENTAIS — explorador multi-banco (tela única) =====
     * Projeção CONSULTÁVEL da base de prospecção ambiental de MG (7 bacias). Uma tabela
     * ÚNICA genérica: cada linha = 1 registro de um "banco" (empreendimentos/leads, outorgas,
     * minerários, embargos, contaminadas, ETEs, IQA, saneamento, RSU, cobertura, barragens...).
     * Campos COMUNS indexados (bank, bacia, municipio, setor, ord) + `props` (JSON, a linha
     * completa do painel) + `busca` (texto minúsculo p/ LIKE). A tela única consulta server-side:
     * paginação (LIMIT/OFFSET) + filtros + busca. Os painéis HTML por bacia (R2) seguem como
     * projeção/mapa (nada removido). Nasce VAZIA — a carga (~150k linhas, gerada dos 7
     * _painel_data.json) entra por wrangler (import em lote; escrita em massa pelo MCP é bloqueada).
     * PII já vem MASCARADA na fonte (PF = "dado protegido"); o gate de acesso é perm:comercial. */
    try {
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS amb_registro (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', bank TEXT NOT NULL, id TEXT NOT NULL,
        bacia TEXT DEFAULT '', municipio TEXT DEFAULT '', uf TEXT DEFAULT 'MG',
        lat REAL, lon REAL, rotulo TEXT DEFAULT '', setor TEXT DEFAULT '',
        classe TEXT DEFAULT '', situacao TEXT DEFAULT '', ord REAL DEFAULT 0,
        dt TEXT DEFAULT '', props TEXT DEFAULT '{}', busca TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, bank, id))`);
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS amb_reg_bank_bacia ON amb_registro (tenant_id, bank, bacia)"); } catch (_) {}
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS amb_reg_bank_mun ON amb_registro (tenant_id, bank, municipio)"); } catch (_) {}
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS amb_reg_bank_ord ON amb_registro (tenant_id, bank, ord)"); } catch (_) {}
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS amb_reg_bank_setor ON amb_registro (tenant_id, bank, setor)"); } catch (_) {}
      /* Instrumentos legais ligados a um lead (TAC/TCRA/PRAD/condicionante/PAEBM/compromisso) —
       * fase F3. lead_id = id do registro em amb_registro (bank='empreendimentos'). `problema` e
       * `servico` vêm do mapa problema→instrumento→serviço. Nasce VAZIA. */
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS lead_instrumento (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, lead_id TEXT DEFAULT '',
        municipio TEXT DEFAULT '', instrumento TEXT DEFAULT '', orgao TEXT DEFAULT '',
        numero TEXT DEFAULT '', situacao TEXT DEFAULT '', prazo TEXT DEFAULT '',
        obrigacoes TEXT DEFAULT '', problema TEXT DEFAULT '', servico TEXT DEFAULT '',
        fonte TEXT DEFAULT '', url_fonte TEXT DEFAULT '', data_consulta TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, id))`);
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS lead_instr_lead ON lead_instrumento (tenant_id, lead_id)"); } catch (_) {}
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS lead_instr_mun ON lead_instrumento (tenant_id, municipio)"); } catch (_) {}
      /* Agregados pré-calculados que NÃO são registros de linha (ex.: fiscalizações, que na base
       * vêm só somadas por município/tipo). dim='mun'|'tipo'|'total'. Nasce VAZIA (carga wrangler). */
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS amb_agg (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', bank TEXT NOT NULL, bacia TEXT DEFAULT '',
        dim TEXT NOT NULL DEFAULT '', chave TEXT NOT NULL DEFAULT '', valor REAL DEFAULT 0,
        PRIMARY KEY (tenant_id, bank, bacia, dim, chave))`);
    } catch (_) { /* ja existe */ }

    /* ===== Onda 3 / VITRINE — show-run de cases (galeria dos trabalhos entregues) =====
     * Vitrine EDITORIAL e demonstravel: cada `vitrine_case` tem apresentacao em HTML (corpo) e
     * uma galeria de PRODUTOS FINAIS (vitrine_produto: prancha/relatorio/modelo 3D/apresentacao/
     * imagem/link) que apontam para arquivos do bucket ACERVO (reaproveita o storage, sem bucket
     * novo) ou para URLs. Esta camada de cases curados é EXIBIDA DENTRO da "Vitrine de Projetos"
     * (viewShowcase, bloco "Cases em destaque") — NÃO é uma aba separada (evita a 2ª "Vitrine"
     * duplicada); complementa a projeção automática proj/prod por cliente do showcase. Conteúdo
     * curado pela gestao. cliente SEMPRE por centro de custo (nunca nome real) e ZERO valor monetario.
     * Edicao = coordenacao/admin; leitura = piso 'equipe' (abertura externa/cliente = TODO, ver
     * nota no route()). Nasce com 1-2 cases EXEMPLO ("(exemplo — edite)") so para a tela nascer
     * com conteudo — sem dado de cliente real nem numero. INSERT OR IGNORE: nao duplica nem
     * sobrescreve edicoes da casa (segue o padrao de seed das demais tabelas). */
    try {
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS vitrine_case (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', cid TEXT NOT NULL,
        titulo TEXT DEFAULT '', cliente_cc TEXT DEFAULT '', area TEXT DEFAULT '',
        resumo TEXT DEFAULT '', corpo TEXT DEFAULT '', capa TEXT DEFAULT '', capa_fonte TEXT DEFAULT '',
        publicado INTEGER DEFAULT 0, ordem INTEGER DEFAULT 0, ativo INTEGER DEFAULT 1,
        atualizado TEXT DEFAULT '', u TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, cid))`);
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS vitrine_case_pub ON vitrine_case (tenant_id, publicado, ordem)"); } catch (_) {}
      await sqlite.execute(`CREATE TABLE IF NOT EXISTS vitrine_produto (
        tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, cid TEXT NOT NULL DEFAULT '',
        tipo TEXT DEFAULT 'prancha', titulo TEXT DEFAULT '', legenda TEXT DEFAULT '',
        fonte TEXT DEFAULT 'acervo', ref TEXT DEFAULT '', ordem INTEGER DEFAULT 0, criado TEXT DEFAULT '',
        PRIMARY KEY (tenant_id, id))`);
      try { await sqlite.execute("CREATE INDEX IF NOT EXISTS vitrine_prod_cid ON vitrine_produto (tenant_id, cid, ordem)"); } catch (_) {}
      // Seed: 4 cases REAIS (modelo), a partir dos trabalhos entregues pela casa. Cliente SEMPRE
      // por código de centro de custo/contrato (nunca o nome real); ZERO valor monetário; nenhum
      // número de desempenho inventado — o corpo descreve escopo, método e entregáveis (por código
      // de documento), e a gestão completa os dados exatos ao editar. Idempotente (INSERT OR IGNORE:
      // não sobrescreve edições da casa). Os PRODUTOS FINAIS (pranchas/relatórios/3D) entram pela
      // galeria após o upload ao ACERVO (script em migracoes/vitrine/, rodado pelo Gustavo). Os 2
      // cases EXEMPLO antigos (vexemplo-*) são removidos abaixo, só se ainda intocados (u='seed').
      const _vxNow = new Date().toISOString();
      const _vxCases: [string, string, string, string, string, string, number][] = [
        ["case-ete-cftp", "ETE/CFTP — Projeto executivo de estação de tratamento de esgoto", "0174GG", "Água e efluentes · ETE",
          "Projeto executivo completo de uma ETE compacta: concepção, dimensionamento, pranchas emitidas no padrão do cliente e modelo 3D georreferenciado para compatibilização. Emitido pelo Motor da casa com o Crivo Intelecto A-F.",
          "<h3>Escopo</h3><p>Concepção e projeto executivo de estação de tratamento de esgoto com a linha: tratamento preliminar (gradeamento e desarenação), reator anaeróbio UASB, filtro anóxico/aerado, decantador de alta taxa, desinfecção por cloração e leito de secagem de lodo.</p><h3>O que a casa entregou</h3><ul><li>Memorial Descritivo (MD-0174GG-B-00003) e Memorial de Cálculo (MC-0174GG-B-00006), revisão vigente, com rastreabilidade do dado ao parágrafo e Crivo A-F.</li><li>Conjunto executivo de pranchas emitidas (série 0174GG-B-000xx): fluxograma geral, planta de implantação e detalhamento por unidade (UASB, decantador de alta taxa, tratamento preliminar, filtro aerado).</li><li>Modelo 3D executivo georreferenciado, navegável, usado na verificação de interferências e compatibilização.</li></ul><h3>Diferencial</h3><p>Emissão padronizada pelo Motor da casa (dado único → folha template → auditoria separada), com verificação independente de cálculo, gráfico, normativo e do modelo 3D antes da liberação.</p><p class=\"muted\"><em>Produtos finais na galeria abaixo — anexados pela gestão.</em></p>", 1],
        ["case-tratab-samarco", "Tratabilidade de efluente de mineração — DM e BN11", "POT26020", "Tratabilidade · Mineração",
          "Estudo de tratabilidade de efluentes de áreas de mina: ensaios de bancada (Jar-Test), seleção de coagulante/floculante, curvas de dosagem e caracterização com análise de metais, traduzidos em rota de tratamento.",
          "<h3>Escopo</h3><p>Caracterização físico-química das amostras e plano de ensaios de tratabilidade (coagulação, floculação e sedimentação) para dois pontos de efluente de mineração, incluindo análise de metais.</p><h3>O que a casa entregou</h3><ul><li>Produto 01 — Relatório de caracterização das amostras recebidas.</li><li>Produtos 02 a 04 — Apresentações dos blocos de ensaio.</li><li>Produto 05 — Relatório Técnico Final com análise de metais (POT26020-RT-H-005), com curvas de dosagem e recomendação de rota.</li><li>Produto 06 — Apresentação executiva do resultado final.</li></ul><h3>Diferencial</h3><p>Da bancada ao critério de projeto: o resultado do Jar-Test vira dosagem de projeto e rota tecnológica, com cada número rastreável ao ensaio.</p><p class=\"muted\"><em>Produtos finais na galeria abaixo — anexados pela gestão.</em></p>", 2],
        ["case-aro-secagem", "Secagem térmica — nota técnica de processo", "ARO", "Processo térmico · Secagem",
          "Nota técnica de processo de secagem térmica: balanço de massa e energia do secador e definição dos parâmetros operacionais, entregue como produto final com apresentação executiva.",
          "<h3>Escopo</h3><p>Avaliação do processo de secagem térmica — balanço de massa e energia, carga térmica e parâmetros de operação — a partir dos dados de processo do cliente.</p><h3>O que a casa entregou</h3><ul><li>Nota Técnica NT-ARO-SEC-001 (revisão vigente), com a memória de cálculo do balanço.</li><li>Apresentação executiva (HTML) do processo e dos resultados.</li></ul><h3>Diferencial</h3><p>Fecha o balanço (grau de liberdade → massa → energia) antes de recomendar parâmetro, no método da casa.</p><p class=\"muted\"><em>Produtos finais na galeria abaixo — anexados pela gestão.</em></p>", 3],
        ["case-biogas-thermo", "Usina de biogás/biometano — ThermoBiogasUp (P&D)", "CSTR · FINEP", "Biogás · P&D",
          "Projeto de P&D (fomento FINEP) de usina de biogás/biometano: digestão anaeróbia em reatores CSTR em PRFV, verificação de mistura por CFD e modelos 3D interativos de licenciamento e arranjo. Em desenvolvimento.",
          "<p><em>Projeto de P&amp;D em desenvolvimento (fomento FINEP) — case de capacidade técnica da casa.</em></p><h3>Escopo</h3><p>Concepção de usina de biogás/biometano com digestão anaeróbia em reatores CSTR em PRFV, verificação de mistura por CFD (OpenFOAM), cenários de pressão/vácuo e licenciamento.</p><h3>Artefatos demonstráveis</h3><ul><li>Modelo 3D interativo do arranjo e do licenciamento.</li><li>Estudos de CFD de mistura dos reatores CSTR (visualizadores HTML).</li><li>Memorial descritivo/de cálculo do processo.</li><li>Pranchas de equipamentos (P&amp;ID / TechDraw) da base de projeto.</li></ul><p class=\"muted\"><em>Produtos finais na galeria abaixo — anexados pela gestão.</em></p>", 4],
      ];
      for (const [cid, titulo, cc, area, resumo, corpo, ordem] of _vxCases) {
        await sqlite.execute({
          sql: "INSERT OR IGNORE INTO vitrine_case (tenant_id, cid, titulo, cliente_cc, area, resumo, corpo, capa, capa_fonte, publicado, ordem, ativo, atualizado, u) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          args: [TENANT_INTELECTO, cid, titulo, cc, area, resumo, corpo, "", "", 1, ordem, 1, _vxNow, "seed"],
        });
      }
      // Remove os 2 cases EXEMPLO da rodada anterior — só se ainda NÃO editados pela casa (u='seed').
      try { await sqlite.execute({ sql: "DELETE FROM vitrine_case WHERE tenant_id = ? AND cid IN ('vexemplo-ete','vexemplo-tratabilidade') AND u = 'seed'", args: [TENANT_INTELECTO] }); } catch (_) {}
    } catch (_) { /* ja existe */ }

    /* Setup completo concluido (idempotente). Grava a sentinela: a partir daqui
     * os cold starts seguintes deste D1 (nova instancia = `ready` resetado) leem
     * schema_ver == SCHEMA_VER e pulam todo o setup. Em D1 EXISTENTE sem sentinela
     * o setup roda UMA vez aqui (seguro, idempotente) e so entao a sentinela nasce. */
    await cfgSet("schema_ver", SCHEMA_VER);
  })();
  return ready;
}

/* config/sess/audit sao tabelas de INFRAESTRUTURA, nao dado de negocio: servem fluxos
 * pre-login (salt, credencial pin:<slug>, rate-limit, recuperacao) em que o tenant ainda
 * nao e conhecido. Nesta rodada so o tenant Intelecto existe, entao todas elas sao
 * ancoradas explicitamente em TENANT_INTELECTO — o filtro de tenant NUNCA fica implicito.
 * Os dados de NEGOCIO (lanc, proj, conteudo, solic, projx, prevf, andam, evento, biblio,
 * param, progcurso, prod) filtram sempre por u.tenant_id vindo de auth(). */
async function cfgGet(k: string): Promise<string | null> {
  const r = await sqlite.execute({ sql: "SELECT v FROM config WHERE k = ? AND tenant_id = ?", args: [k, TENANT_INTELECTO] });
  return r.rows.length ? String(r.rows[0].v) : null;
}
async function cfgSet(k: string, v: string) {
  await sqlite.execute({ sql: "INSERT INTO config (k, v, tenant_id) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", args: [k, v, TENANT_INTELECTO] });
}
async function cfgDel(k: string) {
  await sqlite.execute({ sql: "DELETE FROM config WHERE k = ? AND tenant_id = ?", args: [k, TENANT_INTELECTO] });
}
/** Acesso à aba Comercial (Leads Ambientais): allowlist de slugs em config `perm:comercial`
 *  (lista separada por vírgula), além do dono. Mesmo padrão do `perm:escritorio`. */
async function podeComercial(slug: string): Promise<boolean> {
  const al = String((await cfgGet("perm:comercial")) || "").split(",").map(s => s.trim()).filter(Boolean);
  return isOwner(slug) || al.includes(slug);
}
async function salt(): Promise<string> {
  let s = await cfgGet("salt");
  if (!s) { s = crypto.randomUUID(); await cfgSet("salt", s); }
  return s;
}
async function hashSenha(slug: string, senha: string): Promise<string> {
  const data = new TextEncoder().encode((await salt()) + "|" + slug + "|" + senha);
  const dig = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function validSenha(s: string) {
  if (s.length < 8 || s.length > 64) throw new Error("A senha deve ter de 8 a 64 caracteres.");
  if (!/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) throw new Error("A senha deve combinar letras e números.");
}
/** H2 — hash de SENHA com PBKDF2-SHA256 (KDF lenta, salt aleatorio por usuario, versionada):
 *  formato "pbkdf2$<iter>$<saltHex>$<hashHex>". Substitui o SHA-256 rapido no ARMAZENAMENTO de
 *  senha; o SHA-256 salgado (hashSenha) segue SO para TOKENS de uso unico (rec/reclink), cuja alta
 *  entropia dispensa KDF. Iteracoes conservadoras p/ caber no limite de CPU do Worker (ajustavel). */
async function hashSenhaNova(_slug: string, senha: string): Promise<string> {
  const iter = 150000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, key, 256);
  const hex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, "0")).join("");
  return "pbkdf2$" + iter + "$" + hex(salt) + "$" + hex(new Uint8Array(bits));
}
/** Verifica a senha contra o hash guardado: PBKDF2 ("pbkdf2$...") ou o legado SHA-256 salgado. */
async function verificaSenha(slug: string, senha: string, stored: string): Promise<boolean> {
  if (stored && stored.indexOf("pbkdf2$") === 0) {
    const parts = stored.split("$");
    const iter = Number(parts[1]) || 0;
    const salt = Uint8Array.from((String(parts[2]).match(/../g) || []).map((h) => parseInt(h, 16)));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, key, 256);
    const calc = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return calc === parts[3];
  }
  return !!stored && stored === await hashSenha(slug, senha);
}
/** H1 — conta habilitada a autenticar: colaborador interno ATIVO (COLABS sem INATIVOS) OU
 *  identidade do modelo formal `membro` com ativo=1 (cliente/fornecedor APROVADO via T7). Pendente
 *  (ativo=0) e desconhecido ficam de fora — a admissao segue gated pela aprovacao da Coordenacao. */
async function contaAtiva(slug: string): Promise<boolean> {
  if (COLABS.includes(slug)) return !INATIVOS.includes(slug);
  try {
    const r = await sqlite.execute({ sql: "SELECT ativo FROM membro WHERE slug = ? AND tenant_id = ? LIMIT 1", args: [slug, TENANT_INTELECTO] });
    return r.rows.length ? !!Number((r.rows[0] as any).ativo) : false;
  } catch (_) { return false; }
}
/** E-mail de contato/login do slug: config `email:<slug>` (cadastro da Coordenacao) com fallback a
 *  `membro.email` (identidade do T7). Usado no envio de recuperacao e nos avisos direcionados. */
async function emailDe(slug: string): Promise<string> {
  const c = await cfgGet("email:" + slug);
  if (c) return c;
  try {
    const r = await sqlite.execute({ sql: "SELECT email FROM membro WHERE slug = ? AND tenant_id = ? LIMIT 1", args: [slug, TENANT_INTELECTO] });
    return r.rows.length ? String((r.rows[0] as any).email || "") : "";
  } catch (_) { return ""; }
}
/** Data ISO ou vazio. Campo de data que chega livre acaba renderizado no Gantt dentro de
 *  atributo HTML; validar aqui fecha o XSS armazenado na origem. */
function dataISO(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Data inválida: " + s.slice(0, 40));
  return s;
}

/* ---------- auditoria e notificações ---------- */
async function audit(ev: string, slug: string, det: string, ip: string) {
  await sqlite.execute({
    sql: "INSERT INTO audit (ts, slug, ev, det, ip, tenant_id) VALUES (?,?,?,?,?,?)",
    args: [new Date().toISOString(), slug, ev, det.slice(0, 200), ip.slice(0, 60), TENANT_INTELECTO],
  });
  // M1 — retencao da trilha: NUNCA apaga evento sensivel (concessao de papel, login, reset, acesso,
  // falha de e-mail, etc.); so poda eventos de ROTINA alem de um teto folgado. A poda cega em 1000
  // de antes engolia os proprios eventos de seguranca antigos (lacuna forense).
  if (Math.random() < 0.02) {
    await sqlite.execute({
      sql: "DELETE FROM audit WHERE tenant_id = ? AND ev NOT IN (" + EVENTOS_SENSIVEIS.map(() => "?").join(",") + ") AND rowid NOT IN (SELECT rowid FROM audit ORDER BY ts DESC LIMIT 20000)",
      args: [TENANT_INTELECTO, ...EVENTOS_SENSIVEIS],
    });
  }
}
async function notify(assunto: string, corpo: string, alvoSlug?: string) {
  // M4 — falha de entrega NAO pode sumir sem rastro: a operacao de negocio ja persistiu antes
  // (nunca derrubamos o request por e-mail), mas a falha vira evento `email_falha` na trilha.
  try { await email({ subject: "[Portal Intelecto] " + assunto, text: corpo }); }
  catch (e: any) { try { await audit("email_falha", alvoSlug || "-", ("coordenacao | " + assunto).slice(0, 120) + " | " + String(e && e.message ? e.message : e).slice(0, 80), ""); } catch (_) { /* audit nunca derruba */ } }
  if (alvoSlug) {
    const to = await emailDe(alvoSlug);
    if (to) { try { await email({ to, subject: "[Portal Intelecto] " + assunto, text: corpo }); }
      catch (e: any) { try { await audit("email_falha", alvoSlug, ("alvo | " + assunto).slice(0, 120) + " | " + String(e && e.message ? e.message : e).slice(0, 80), ""); } catch (_) { /* idem */ } } }
  }
}

/* ---------- rate limiting (por pessoa e por IP) ---------- */
const JANELA_MS = 10 * 60 * 1000;
/** Validade de um pedido de primeiro acesso aguardando liberacao da Coordenacao. */
const PINREQ_MS = 48 * 60 * 60 * 1000;
/** Validade do link de recuperacao de senha (T5): uso unico, expira em 60 minutos. */
const RECLINK_MS = 60 * 60 * 1000;
async function lockInfo(key: string, limite: number): Promise<{ locked: boolean; n: number }> {
  const v = await cfgGet(key);
  if (!v) return { locked: false, n: 0 };
  const [n, last] = v.split("|").map(Number);
  if (Date.now() - last > JANELA_MS) { await cfgDel(key); return { locked: false, n: 0 }; }
  return { locked: n >= limite, n };
}
async function regFail(key: string) {
  const v = await cfgGet(key);
  const now = Date.now();
  if (!v) { await cfgSet(key, "1|" + now); return; }
  const [n, last] = v.split("|").map(Number);
  await cfgSet(key, (now - last > JANELA_MS ? 1 : n + 1) + "|" + now);
}
async function checkLocks(slug: string, ip: string) {
  const a = await lockInfo("fail:" + slug, 5);
  const b = await lockInfo("failip:" + ip, 20);
  if (a.locked || b.locked) throw new Error("Muitas tentativas de senha. Aguarde 10 minutos e tente de novo.");
}

/* ---------- sessões ---------- */
async function newSess(slug: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const now = new Date().toISOString();
  await sqlite.execute({ sql: "INSERT INTO sess (token, slug, criado, ultimo, tenant_id) VALUES (?,?,?,?,?)", args: [token, slug, now, now, TENANT_INTELECTO] });
  return token;
}
type P = Record<string, any>;
/** Papel + tenant de uma identidade. Autoridade = tabela `membro`; fallback seguro para a
 *  inferência por slug (e tenant Intelecto) enquanto a linha de membro não existir. */
async function papelTenantDe(slug: string): Promise<{ papel: Papel; tenant_id: string; ativo: number | null }> {
  try {
    const r = await sqlite.execute({ sql: "SELECT papel, tenant_id, ativo FROM membro WHERE slug = ? LIMIT 1", args: [slug] });
    if (r.rows.length) {
      const row = r.rows[0] as P;
      const pv = String(row.papel || "");
      return {
        papel: (PAPEIS.includes(pv as Papel) ? pv : papelInferido(slug)) as Papel,
        tenant_id: String(row.tenant_id || TENANT_INTELECTO),
        ativo: (row.ativo === null || row.ativo === undefined) ? null : (Number(row.ativo) ? 1 : 0),
      };
    }
  } catch (_) { /* membro ainda não materializada: cai no fallback */ }
  return { papel: papelInferido(slug), tenant_id: TENANT_INTELECTO, ativo: null };
}
/** Contrato de auth() consumido por T2: devolve sempre {slug, papel, tenant_id}.
 *  `coord` é mantido (derivado de papel) por compatibilidade com o código atual que o lê. */
async function auth(p: P): Promise<{ slug: string; coord: boolean; papel: Papel; tenant_id: string }> {
  const token = String(p.token || "");
  if (!token) throw new Error("Sessão expirada — entre de novo.");
  const r = await sqlite.execute({ sql: "SELECT slug, ultimo FROM sess WHERE token = ? AND tenant_id = ?", args: [token, TENANT_INTELECTO] });
  if (!r.rows.length) throw new Error("Sessão expirada — entre de novo.");
  const row = r.rows[0] as P;
  const ultimo = Date.parse(String(row.ultimo)) || 0;
  if (Date.now() - ultimo > SESS_DIAS * 86400000) {
    await sqlite.execute({ sql: "DELETE FROM sess WHERE token = ? AND tenant_id = ?", args: [token, TENANT_INTELECTO] });
    throw new Error("Sessão expirada — entre de novo.");
  }
  if (Date.now() - ultimo > 3600000) {
    await sqlite.execute({ sql: "UPDATE sess SET ultimo = ? WHERE token = ? AND tenant_id = ?", args: [new Date().toISOString(), token, TENANT_INTELECTO] });
  }
  const slug = String(row.slug);
  checaAtivo(slug);
  const { papel, tenant_id, ativo } = await papelTenantDe(slug);
  // L3 — desativacao conduzida pelo RH: membro.ativo=0 encerra o acesso (sessao recusada), sem
  // depender so da lista fixa INATIVOS. Linha ausente (ativo null) nao bloqueia (fallback seguro).
  if (ativo === 0) {
    await sqlite.execute({ sql: "DELETE FROM sess WHERE token = ? AND tenant_id = ?", args: [token, TENANT_INTELECTO] });
    throw new Error("Acesso encerrado. Fale com a Coordenação.");
  }
  return { slug, coord: papel === "coordenacao" || papel === "admin", papel, tenant_id };
}
async function loginSenha(slug: string, senha: string, ip: string): Promise<void> {
  if (!(await contaAtiva(slug))) throw new Error("Colaborador desconhecido.");
  await checkLocks(slug, ip);
  const saved = await cfgGet("pin:" + slug);
  if (!saved) throw new Error("Senha ainda não cadastrada. Escolha seu nome e crie a senha.");
  if (!(await verificaSenha(slug, senha, saved))) {
    await regFail("fail:" + slug);
    await regFail("failip:" + ip);
    await audit("login_falha", slug, "", ip);
    throw new Error("Senha incorreta. Se esqueceu, use a aba \"Esqueci minha senha\" na tela de entrada.");
  }
  // H2 — migracao transparente: pin legado (SHA-256) vira PBKDF2 no 1o login bem-sucedido.
  if (saved.indexOf("pbkdf2$") !== 0) { try { await cfgSet("pin:" + slug, await hashSenhaNova(slug, senha)); } catch (_) { /* re-hash best-effort */ } }
  await cfgDel("fail:" + slug);
}
/** T5 — Resolve um identificador de login (slug OU e-mail) para o slug canonico.
 *  E-mail e a nova identidade de login; o slug continua aceito para nao quebrar ninguem
 *  durante a transicao. Fonte do e-mail: coluna formal membro.email, com fallback ao
 *  config email:<slug> (cadastro atual da Coordenacao). Sem "@" => ja e um slug.
 *  String vazia => identidade nao encontrada (o chamador decide a mensagem). */
async function slugDeIdent(ident: string): Promise<string> {
  const v = String(ident || "").trim();
  if (!v) return "";
  if (!v.includes("@")) return v.toLowerCase();
  const em = v.toLowerCase();
  try {
    const r = await sqlite.execute({ sql: "SELECT slug FROM membro WHERE lower(email) = ? AND email <> '' LIMIT 1", args: [em] });
    if (r.rows.length) return String((r.rows[0] as P).slug);
  } catch (_) { /* membro sem coluna email ainda: cai no config */ }
  const r2 = await sqlite.execute({ sql: "SELECT k FROM config WHERE k LIKE 'email:%' AND lower(v) = ? AND tenant_id = ? LIMIT 1", args: [em, TENANT_INTELECTO] });
  if (r2.rows.length) return String((r2.rows[0] as P).k).slice(6);
  return "";
}

/* ============================================================================
 * T7 — ALLOWLIST + SOLICITACAO DE ACESSO (perfil inicial = cliente)
 * --------------------------------------------------------------------------
 * Trava da casa: QUEM ENTRA NASCE 'cliente' (menor privilegio), sempre. A allowlist
 * NAO eleva ninguem sozinha: ela apenas PRE-AUTORIZA um papel e o sugere no momento da
 * aprovacao. A subida de papel so acontece pela concessao auditada (concedePapel), feita
 * por Coordenacao (e por Admin quando o papel e sensivel). A UI nunca decide — o guard MIN
 * e os checks abaixo decidem no SERVIDOR.
 *
 * Allowlist = config 'allow:<email>' => papel sugerido. Consultavel/editavel so por papel
 * adequado (coordenacao; admin para papel sensivel). Nada cruza tenant: tudo em Intelecto.
 * ========================================================================== */
/** Papeis cuja concessao exige Admin (grant de papel sensivel). Conceder coordenacao/admin
 *  nao fica na alcada da Coordenacao — so o Admin eleva alguem a esse nivel. */
const PAPEIS_SENSIVEIS = new Set<Papel>(["admin", "coordenacao"]);
/** Papel sugerido pela allowlist para um e-mail, ou null se o e-mail nao esta na lista.
 *  A ausencia na allowlist => entrada como 'cliente' (regra de menor privilegio). */
async function allowlistPapel(email: string): Promise<Papel | null> {
  const em = String(email || "").trim().toLowerCase();
  if (!em) return null;
  const v = await cfgGet("allow:" + em);
  if (!v) return null;
  return PAPEIS.includes(v as Papel) ? (v as Papel) : null;
}
/** Allowlist inteira (e-mail -> papel sugerido) para o painel da Coordenacao. */
async function allowlistEntries(): Promise<Record<string, string>> {
  const r = await sqlite.execute({ sql: "SELECT k, v FROM config WHERE tenant_id = ? AND k LIKE 'allow:%'", args: [TENANT_INTELECTO] });
  const out: Record<string, string> = {};
  for (const x of r.rows as P[]) out[String(x.k).slice(6)] = String(x.v);
  return out;
}
/** Slug canonico derivado do e-mail, UNICO dentro do tenant. Nunca sequestra uma linha de
 *  `membro` de outra pessoa: se o slug-base ja existe para OUTRO e-mail, sufixa com numero.
 *  Se ja existe para o MESMO e-mail, reaproveita (idempotente). */
async function slugDeEmail(email: string): Promise<string> {
  const base0 = String(email || "").split("@")[0].toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const base = base0 || "u";
  const em = String(email || "").trim().toLowerCase();
  let slug = base, n = 1;
  while (n < 1000) {
    const r = await sqlite.execute({ sql: "SELECT email FROM membro WHERE slug = ? AND tenant_id = ? LIMIT 1", args: [slug, TENANT_INTELECTO] });
    if (!r.rows.length) return slug;
    if (String((r.rows[0] as P).email || "").trim().toLowerCase() === em) return slug;
    slug = base + (++n);
  }
  return base + "_" + crypto.randomUUID().slice(0, 6);
}
/** Garante a linha de `membro` do solicitante SEMPRE como 'cliente' (menor privilegio).
 *  Idempotente: INSERT OR IGNORE nao sobrescreve papel ja existente — a subida e so por
 *  concedePapel. Retorna o slug canonico. */
async function ensureMembroCliente(slug: string, nome: string, email: string): Promise<void> {
  const hoje = new Date().toISOString().slice(0, 10);
  await sqlite.execute({
    sql: "INSERT OR IGNORE INTO membro (tenant_id, slug, papel, nome, email, ativo, criado) VALUES (?,?,?,?,?,?,?)",
    args: [TENANT_INTELECTO, slug, "cliente", nome || slug, String(email || "").toLowerCase(), 0, hoje],
  });
}
/** Concessao de papel AUDITADA (unico caminho de subida). Materializa a linha de membro se
 *  faltar (como cliente) e so entao aplica o papel. Deixa o gancho para a T8 (autor/alvo/
 *  tenant/papel). Nao mexe em senha — credencial e sempre do usuario. */
async function concedePapel(slug: string, papel: Papel, nome: string, email: string, autor: string, ip: string): Promise<void> {
  if (!PAPEIS.includes(papel)) throw new Error("Papel invalido.");
  await ensureMembroCliente(slug, nome, email);
  await sqlite.execute({ sql: "UPDATE membro SET papel = ?, ativo = 1 WHERE slug = ? AND tenant_id = ?", args: [papel, slug, TENANT_INTELECTO] });
  await audit("papel_concedido", autor, "alvo:" + slug + " papel:" + papel + " tenant:" + TENANT_INTELECTO, ip);
}
function validEmail(v: string): string {
  const em = String(v || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) || em.length > 120) throw new Error("Informe um e-mail valido.");
  return em;
}

function validEntry(e: P) {
  if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(String(e.d || ""))) throw new Error("Data inválida.");
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(String(e.cc || ""))) throw new Error("Centro de custo inválido.");
  const h = Number(e.h);
  if (!(h > 0 && h <= 24)) throw new Error("Horas deve estar entre 0,1 e 24.");
  if (String(e.t || "").trim().length < 3) throw new Error("Descreva o que foi feito.");
  return { d: String(e.d), cc: String(e.cc), h: Math.round(h * 10) / 10, t: String(e.t).trim() };
}

function validItem(it: P) {
  const titulo = String(it.titulo || "").trim();
  if (titulo.length < 3) throw new Error("Título muito curto.");
  const url = String(it.url || "").trim();
  if (url && !/^(https?:\/\/|\/d\/)/.test(url)) throw new Error("O link deve começar com http(s):// ou /d/");
  return {
    titulo, url,
    descricao: String(it.descricao || "").trim(),
    tag: String(it.tag || "").trim(),
    destaque: it.destaque ? 1 : 0,
  };
}
async function canEditArea(area: string, u: { slug: string; coord: boolean }): Promise<boolean> {
  if (u.coord) return true;
  const r = await cfgGet("resp:" + area);
  return !!r && r.split(",").includes(u.slug);
}
async function getCont(id: string, tenant: string): Promise<P> {
  const r = await sqlite.execute({ sql: "SELECT * FROM conteudo WHERE id = ? AND tenant_id = ?", args: [id, tenant] });
  if (!r.rows.length) throw new Error("Item não encontrado.");
  return r.rows[0] as P;
}
async function getLanc(id: string, tenant: string): Promise<P> {
  const r = await sqlite.execute({ sql: "SELECT * FROM lanc WHERE id = ? AND tenant_id = ?", args: [id, tenant] });
  if (!r.rows.length) throw new Error("Lançamento não encontrado.");
  return r.rows[0] as P;
}

/* ============================================================================
 * FINANCEIRO (admin-only, dono) — custo real × valor contratado por projeto.
 * --------------------------------------------------------------------------
 * Fórmula (bases explícitas na UI): custo de mão de obra = Σ(horas efetivas do
 * colaborador × custo/hora dele); imposto = pct_imposto% sobre o valor contratado;
 * rateio = pct_rateio% sobre a mão de obra; outros = R$ fixo; custo total = MO +
 * imposto + rateio + outros; margem (lucro real) = contratado − custo total;
 * margem % = margem / contratado; lucro-alvo = pct_lucro% do contratado (referência).
 * `horas efetivas` = status APROVADO ou LANÇADO (mesma regra de projdetalhe).
 * ========================================================================== */
function arred2(n: number): number { return Math.round((Number(n) || 0) * 100) / 100; }
/* Repara mojibake de duplo-encoding (UTF-8 lido como Latin-1) nos TRECHOS que o AutoRAG devolve:
 * os arquivos-fonte estão em UTF-8 correto, mas o índice guardou "secundÃ¡rio" em vez de
 * "secundário". Só age quando há assinatura de mojibake (Ã/Â/â seguido de byte alto) e só aceita
 * o resultado se não gerar caractere de substituição. Não toca o arquivo, só a exibição. */
/** Mapa slug→custo/hora ATUAL (vigência mais recente por colaborador). Para EXIBIÇÃO da taxa
 *  corrente; o custo histórico usa a taxa vigente na data de cada apontamento (ver abaixo). */
async function custoHoraMap(tenant: string): Promise<Record<string, number>> {
  const r = await sqlite.execute({
    sql: "SELECT v.slug, v.valor FROM custohora_vig v WHERE v.tenant_id = ? AND v.desde = (SELECT MAX(w.desde) FROM custohora_vig w WHERE w.tenant_id = v.tenant_id AND w.slug = v.slug)",
    args: [tenant],
  });
  const m: Record<string, number> = {};
  for (const x of r.rows as P[]) m[String(x.slug)] = Number(x.valor) || 0;
  return m;
}
/** Horas efetivas por colaborador de UM cc (sem custo — para quem não vê R$). */
async function horasPorColab(cc: string, tenant: string): Promise<{ slug: string; h: number }[]> {
  const r = await sqlite.execute({
    sql: "SELECT slug, COALESCE(SUM(h),0) AS h FROM lanc WHERE cc = ? AND tenant_id = ? AND s IN ('APROVADO','LANÇADO') GROUP BY slug ORDER BY h DESC",
    args: [cc, tenant],
  });
  return (r.rows as P[]).map((x) => ({ slug: String(x.slug), h: arred2(Number(x.h) || 0) }));
}
/** Subconsulta SQL do custo/hora VIGENTE na data do apontamento (maior `desde` <= l.d). */
const CH_VIGENTE_SQL = "COALESCE((SELECT v.valor FROM custohora_vig v WHERE v.tenant_id = l.tenant_id AND v.slug = l.slug AND v.desde <= l.d ORDER BY v.desde DESC LIMIT 1),0)";
/** Horas + CUSTO (R$) por colaborador de UM cc, cada apontamento × a taxa vigente NA SUA DATA. */
async function horasCustoPorColab(cc: string, tenant: string): Promise<{ slug: string; h: number; custo: number }[]> {
  const r = await sqlite.execute({
    sql: "SELECT l.slug, COALESCE(SUM(l.h),0) AS h, COALESCE(SUM(l.h * " + CH_VIGENTE_SQL + "),0) AS custo FROM lanc l WHERE l.cc = ? AND l.tenant_id = ? AND l.s IN ('APROVADO','LANÇADO') GROUP BY l.slug ORDER BY h DESC",
    args: [cc, tenant],
  });
  return (r.rows as P[]).map((x) => ({ slug: String(x.slug), h: arred2(Number(x.h) || 0), custo: arred2(Number(x.custo) || 0) }));
}
/** Dado px (linha projx com campos fin) + custo de mão de obra (R$) + rateio de fixos (R$),
 * devolve a decomposição. `rateioFixIn` = parcela do pool de custos fixos (overhead) alocada a
 * este CC por participação de horas (ver rateioFixosCarteira); entra no custo real. */
function decompoeFin(px: P, moCustoIn: number, rateioFixIn: number = 0): P {
  const moCusto = arred2(Number(moCustoIn) || 0);
  const contratado = arred2(Number(px.contratado) || 0);
  const imposto = arred2(((Number(px.pct_imposto) || 0) / 100) * contratado);
  const rateio = arred2(((Number(px.pct_rateio) || 0) / 100) * moCusto); // legado: pct — não entra no custo
  const rateioFix = arred2(Number(rateioFixIn) || 0); // overhead rateado por horas (Onda 2)
  const outros = arred2(Number(px.outros) || 0);
  const consumiveis = arred2(Number(px.consumiveis) || 0);
  const terceiros = arred2(Number(px.terceiros) || 0);
  // Custo real = mão de obra (o custo/hora JÁ inclui encargos da MO) + consumíveis + terceiros +
  // outros + rateio dos fixos (overhead). O pct_rateio legado fica fora da soma (não dobrar).
  const custoTotal = arred2(moCusto + consumiveis + terceiros + outros + rateioFix);
  const margem = arred2(contratado - custoTotal);
  const margemPct = contratado > 0 ? Math.round((margem / contratado) * 1000) / 10 : null;
  const lucroAlvo = arred2(((Number(px.pct_lucro) || 0) / 100) * contratado);
  const configurado = contratado > 0 || moCusto > 0 || outros > 0 || consumiveis > 0 || terceiros > 0 || rateioFix > 0;
  return {
    contratado, moCusto, imposto, rateio, rateioFix, outros, consumiveis, terceiros, custoTotal, margem, margemPct, lucroAlvo,
    pct_imposto: Number(px.pct_imposto) || 0, pct_rateio: Number(px.pct_rateio) || 0, pct_lucro: Number(px.pct_lucro) || 0,
    configurado, prejuizo: configurado && contratado > 0 && margem < 0,
  };
}
/** RATEIO DOS CUSTOS FIXOS (overhead) sobre a carteira bilhável, POR HORAS APONTADAS (decisão do
 * dono — pool total editável). O pool = soma de custo_fixo; a base = horas (APROVADO/LANÇADO) dos
 * projetos ATIVOS com contratado>0. Cada CC absorve fixos × (horas_do_CC / horas_da_base). Assim o
 * overhead é coberto pela receita dos projetos proporcional ao esforço que cada um consumiu. */
async function rateioFixosCarteira(tenant: string): Promise<{ fixosTotal: number; byCc: Record<string, number>; horasBase: number }> {
  const fx = await sqlite.execute({ sql: "SELECT COALESCE(SUM(valor),0) t FROM custo_fixo WHERE tenant_id = ?", args: [tenant] });
  const fixosTotal = arred2(Number((fx.rows[0] as P)?.t) || 0);
  const r = await sqlite.execute({
    sql: "SELECT l.cc AS cc, COALESCE(SUM(l.h),0) AS h FROM lanc l WHERE l.tenant_id = ? AND l.s IN ('APROVADO','LANÇADO') AND l.cc IN (SELECT p.cc FROM proj p JOIN projx x ON x.cc = p.cc AND x.tenant_id = p.tenant_id WHERE p.tenant_id = ? AND p.registro = 'ATIVO' AND COALESCE(x.contratado,0) > 0) GROUP BY l.cc",
    args: [tenant, tenant],
  });
  const hByCc: Record<string, number> = {}; let horasBase = 0;
  for (const x of r.rows as P[]) { const h = Number(x.h) || 0; hByCc[String(x.cc)] = h; horasBase += h; }
  const byCc: Record<string, number> = {};
  if (fixosTotal > 0 && horasBase > 0) for (const cc in hByCc) byCc[cc] = arred2(fixosTotal * (hByCc[cc] / horasBase));
  return { fixosTotal, byCc, horasBase };
}
/* RESUMO EXECUTIVO — consolida, SEM inventar número (tudo derivado do D1): (1) Financeiro:
 * contratado × custo real × margem da carteira ativa; (2) Pipeline CRM: deals por macro-fase,
 * assinados × em aberto; (3) Horas apontadas e seu custo de MO; (4) Fluxo de caixa: saldo
 * previsto × realizado. Usado ao vivo (ação resumoExec) e materializado (resumoExecFechar). */
/* CAPACIDADE × APONTADO (horas extras / déficit). Capacidade estagiário = 20h/sem (4h/dia); demais
 * 40h/sem (8h/dia). Ajustável aqui até virar campo de cargo. */
const CAP20 = new Set<string>(["cecilia", "david"]);
function diasUteisMes(ym: string): number {
  const [y, m] = ym.split("-").map(Number); if (!y || !m) return 0;
  let n = 0; const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCMonth() === m - 1) { const w = d.getUTCDay(); if (w >= 1 && w <= 5) n++; d.setUTCDate(d.getUTCDate() + 1); }
  return n;
}
/* Saldo capacidade×apontado por colaborador/mês, derivado do lanc (feriado/férias/ausência pelos
 * rótulos da atividade t). Esperado = dias úteis×h/dia − feriado − férias − ausência JUSTIFICADA;
 * Realizado = trabalho (tudo menos os 4 rótulos); Saldo = Realizado − Esperado (>0 extra, <0 déficit;
 * ausência NÃO justificada puxa p/ déficit). Custo da extra = saldo+ × custo/hora vigente no mês. */
async function capacidadeApontado(tenant: string): Promise<P[]> {
  const r = await sqlite.execute({
    sql: "SELECT slug, substr(d,1,7) ym," +
      " SUM(CASE WHEN t LIKE '%Feriado%' THEN h ELSE 0 END) feriado," +
      " SUM(CASE WHEN t LIKE '%Ferias%' OR t LIKE '%Férias%' THEN h ELSE 0 END) ferias," +
      " SUM(CASE WHEN t LIKE '%Ausente Justificado%' THEN h ELSE 0 END) ausj," +
      " SUM(CASE WHEN t LIKE '%Ausente N%o Justificado%' THEN h ELSE 0 END) ausn," +
      " SUM(CASE WHEN t LIKE '%Feriado%' OR t LIKE '%Ferias%' OR t LIKE '%Férias%' OR t LIKE '%Ausente Justificado%' OR t LIKE '%Ausente N%o Justificado%' THEN 0 ELSE h END) trab" +
      " FROM lanc WHERE tenant_id = ? AND s IN ('APROVADO','LANÇADO') AND substr(d,1,7) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' GROUP BY slug, ym",
    args: [tenant],
  });
  const cvr = await sqlite.execute({ sql: "SELECT slug, desde, valor FROM custohora_vig WHERE tenant_id = ? ORDER BY slug, desde", args: [tenant] });
  const vig: Record<string, { desde: string; valor: number }[]> = {};
  for (const x of cvr.rows as P[]) { (vig[String(x.slug)] = vig[String(x.slug)] || []).push({ desde: String(x.desde), valor: Number(x.valor) || 0 }); }
  const taxaEm = (slug: string, ym: string) => { let v = 0; const ref = ym + "-01"; for (const e of (vig[slug] || [])) { if (e.desde <= ref) v = e.valor; else break; } return v; };
  const porSlug: Record<string, P> = {};
  for (const row of r.rows as P[]) {
    const slug = String(row.slug); const ym = String(row.ym);
    const hdia = CAP20.has(slug) ? 4 : 8;
    const feriado = arred2(Number(row.feriado) || 0), ferias = arred2(Number(row.ferias) || 0), ausj = arred2(Number(row.ausj) || 0), ausn = arred2(Number(row.ausn) || 0), trab = arred2(Number(row.trab) || 0);
    const esperado = arred2(diasUteisMes(ym) * hdia - feriado - ferias - ausj);
    const saldo = arred2(trab - esperado);
    const custoExtra = saldo > 0 ? arred2(saldo * taxaEm(slug, ym)) : 0;
    const o = porSlug[slug] = porSlug[slug] || { slug, nome: NOMES[slug] || slug, hsem: CAP20.has(slug) ? 20 : 40, meses: [] as P[], tEsper: 0, tReal: 0, tSaldo: 0, tExtra: 0, tDef: 0, tCustoExtra: 0, tFeriado: 0, tFerias: 0, tAusJ: 0, tAusN: 0 };
    (o.meses as P[]).push({ ym, esperado, realizado: trab, feriado, ferias, ausj, ausn, saldo, custoExtra });
    o.tEsper = arred2(o.tEsper + esperado); o.tReal = arred2(o.tReal + trab); o.tSaldo = arred2(o.tSaldo + saldo);
    o.tExtra = arred2(o.tExtra + (saldo > 0 ? saldo : 0)); o.tDef = arred2(o.tDef + (saldo < 0 ? -saldo : 0)); o.tCustoExtra = arred2(o.tCustoExtra + custoExtra);
    o.tFeriado = arred2(o.tFeriado + feriado); o.tFerias = arred2(o.tFerias + ferias); o.tAusJ = arred2(o.tAusJ + ausj); o.tAusN = arred2(o.tAusN + ausn);
  }
  return Object.values(porSlug).sort((a: any, b: any) => (b.tSaldo as number) - (a.tSaldo as number));
}
async function resumoExecutivo(tenant: string): Promise<P> {
  // (1) Financeiro — mão de obra por cc (taxa vigente na data) + horas; projx; projetos ativos.
  const hr = await sqlite.execute({ sql: "SELECT l.cc, COALESCE(SUM(l.h * " + CH_VIGENTE_SQL + "),0) AS mo, COALESCE(SUM(l.h),0) AS h FROM lanc l WHERE l.tenant_id = ? AND l.s IN ('APROVADO','LANÇADO') GROUP BY l.cc", args: [tenant] });
  const moByCc: Record<string, number> = {}; let horasTotais = 0; let moTotal = 0;
  for (const x of hr.rows as P[]) { moByCc[String(x.cc)] = Number(x.mo) || 0; horasTotais += Number(x.h) || 0; moTotal += Number(x.mo) || 0; }
  const pxr = await sqlite.execute({ sql: "SELECT cc, contratado, pct_imposto, pct_rateio, pct_lucro, outros, consumiveis, terceiros FROM projx WHERE tenant_id = ?", args: [tenant] });
  const pxByCc: Record<string, P> = {}; for (const x of pxr.rows as P[]) pxByCc[String(x.cc)] = x;
  const prr = await sqlite.execute({ sql: "SELECT cc FROM proj WHERE tenant_id = ? AND registro = 'ATIVO'", args: [tenant] });
  const rf = await rateioFixosCarteira(tenant);
  let contratado = 0, custoTotal = 0, margem = 0, nProj = 0, nPrej = 0;
  for (const pr of prr.rows as P[]) {
    const d = decompoeFin(pxByCc[String(pr.cc)] || {}, moByCc[String(pr.cc)] || 0, rf.byCc[String(pr.cc)] || 0);
    if (d.contratado <= 0) continue;
    contratado += d.contratado; custoTotal += d.custoTotal; margem += d.margem; nProj++;
    if (d.margem < 0) nPrej++;
  }
  const margemPct = contratado > 0 ? Math.round((margem / contratado) * 1000) / 10 : null;
  // (2) Pipeline CRM — por macro-fase (6 grupos das 21 subetapas); assinados × em aberto.
  const dr = await sqlite.execute({ sql: "SELECT st, val, signeddate FROM crm_deal WHERE tenant_id = ?", args: [tenant] });
  const macro = (st: number) => st <= 0 ? "" : st <= 4 ? "Prospecção & Qualificação" : st <= 8 ? "Diagnóstico Técnico" : st <= 12 ? "Proposta" : st <= 16 ? "Negociação & Contrato" : st <= 20 ? "Execução" : "Pós-venda & Expansão";
  const funil: Record<string, { n: number; val: number }> = {}; let dealsN = 0, assinN = 0, assinVal = 0, pipeAberto = 0;
  for (const d of dr.rows as P[]) {
    dealsN++;
    const m = macro(Number(d.st) || 0); if (m) { (funil[m] = funil[m] || { n: 0, val: 0 }); funil[m].n++; funil[m].val += Number(d.val) || 0; }
    if (String(d.signeddate || "")) { assinN++; assinVal += Number(d.val) || 0; } else { pipeAberto += Number(d.val) || 0; }
  }
  // (4) Fluxo de caixa — saldo previsto × realizado (entradas − saídas).
  const fx = await sqlite.execute({ sql: "SELECT tipo, status, COALESCE(SUM(valor),0) v, COUNT(*) n FROM fluxo WHERE tenant_id = ? GROUP BY tipo, status", args: [tenant] });
  let fxEP = 0, fxSP = 0, fxER = 0, fxSR = 0, fxN = 0;
  for (const r of fx.rows as P[]) { const v = Number(r.v) || 0; fxN += Number(r.n) || 0; const st = String(r.status); const entrada = String(r.tipo) === "entrada"; if (st === "realizado") { entrada ? (fxER += v) : (fxSR += v); } else if (st === "previsto") { entrada ? (fxEP += v) : (fxSP += v); } }
  return {
    fin: { contratado: arred2(contratado), custoTotal: arred2(custoTotal), margem: arred2(margem), margemPct, nProj, nPrej, overhead: rf.fixosTotal },
    pipeline: { dealsN, funil, assinN, assinVal: arred2(assinVal), pipeAberto: arred2(pipeAberto) },
    horas: { horasTotais: arred2(horasTotais), moTotal: arred2(moTotal) },
    fluxo: { n: fxN, entradaPrev: arred2(fxEP), saidaPrev: arred2(fxSP), entradaReal: arred2(fxER), saidaReal: arred2(fxSR), saldoPrev: arred2(fxEP - fxSP), saldoReal: arred2(fxER - fxSR) },
  };
}

/* ============================================================================
 * GUARD CENTRAL (T2) — a fronteira de autorizacao e o SERVIDOR, nunca a UI.
 * MIN declara o papel minimo de CADA acao autenticada de POST /api. Logo no inicio de
 * route(), apos auth(), nega-se no servidor quem nao satisfaz o papel (temPapelMinimo,
 * com aninhamento admin ⊃ coordenacao ⊃ equipe ⊃ cliente; fornecedor LATERAL). Remover
 * um check do front NAO concede acesso — a decisao vive aqui.
 *   - leitura comum e acao do proprio usuario .......... 'equipe'
 *     (preserva o acesso de hoje; admin/coordenacao satisfazem por aninhamento)
 *   - concessao / liberacao / aprovacao / status / gestao 'coordenacao'
 *   - permissoes confidenciais e grant de acervo (aba do dono) 'admin'
 * Os checks finos de cada branch (u.coord, isOwner, canEditArea, dono-do-registro,
 * podeFicha, grant de acervo) PERMANECEM como 2a camada — o guard e o piso, eles sao
 * o recorte. Paridade: gustavo=admin, bruno/caio/ananda=coordenacao, demais=equipe
 * mantem exatamente o acesso de hoje.
 * ========================================================================== */
/* Pre-login (sem guard). T5 acrescenta reclink/recsenhalink: recuperacao de senha por LINK,
 * de uso unico e com expiracao — fluxo pre-login por natureza, irmao de recuperar/recsenha. */
const PUBLICAS = new Set<string>(["ping", "haspin", "setpin", "login", "recuperar", "recsenha", "reclink", "recsenhalink", "logout", "acessoSolicitar"]);
const MIN: Record<string, Papel> = {
  // leitura comum e acoes do proprio usuario (piso = equipe)
  escritorio: "equipe", hist: "equipe", solicitar: "equipe", solListar: "equipe",
  comercial: "equipe", funnel_pull: "equipe", funnel_push: "equipe", crm: "equipe", crmDealSet: "equipe", crmLeadAprovar: "equipe",
  andamento: "equipe", addandam: "equipe", delandam: "equipe", produtos: "equipe",
  // CARTEIRA EXECUTIVA: leitura rica de projeto (piso equipe); edição de gestão (piso coordenacao).
  projdetalhe: "equipe", setproj: "coordenacao", lancColab: "coordenacao",
  state: "equipe", addcont: "equipe", editcont: "equipe", delcont: "equipe", setlink: "equipe",
  eventos: "equipe", addevento: "equipe", delevento: "equipe",
  addserie: "equipe", delserie: "equipe", biblio: "equipe",
  // RITOS & CADENCIA (catalogo da Agenda): leitura p/ todo logado; editar/remover = coordenacao
  // (o handler ainda confere agenda.editar, alinhado ao resto da Agenda).
  ritos: "cliente", ritoset: "coordenacao", ritodel: "coordenacao",
  progcurso: "equipe", setprog: "equipe", addparam: "equipe", delparam: "equipe",
  addbiblio: "equipe", delbiblio: "equipe", add: "equipe", edit: "equipe", del: "equipe",
  acervo_busca: "equipe",
  // DAILY BRIEF (inteligencia INTERNA): listar o feed e leitura da equipe (piso 'equipe' — admin
  // e coordenacao herdam por aninhamento; cliente rank 0 < equipe e fornecedor lateral ficam
  // de fora, exatamente como pedido). Adicionar/triar e apagar sao gestao: piso 'coordenacao'.
  brief: "equipe", briefadd: "coordenacao", briefdel: "coordenacao",
  // Fontes do radar (CRUD) e disparo manual da coleta: gestao, piso 'coordenacao' (+ cap brief.curar no handler).
  brieffontes: "coordenacao", brieffonteset: "coordenacao", brieffontedel: "coordenacao", briefrun: "coordenacao",
  // Backup manual do D1 (verificacao sob demanda); o handler ainda exige isOwner.
  backup_now: "coordenacao",
  // T4 — Hub/Launcher: piso = cliente (TODO logado pode perguntar o PROPRIO Hub). A acao
  // 'hub' apenas DEVOLVE a lista de modulos liberados; a liberacao de cada card deriva do
  // piso MIN da acao que o governa (ver MODULOS/modulosLiberados), nunca de flag de front.
  hub: "cliente",
  // T6 — Perfil & Conta: acoes da PROPRIA conta do usuario logado. Piso 'cliente' (todo
  // logado cuida da propria conta). O PAPEL e SO-LEITURA nessas acoes — ninguem se
  // autopromove: a mudanca de papel so sobe pela via T7 (coordenacao/admin), e 'contaSalvar'
  // recusa no SERVIDOR qualquer tentativa de alterar o proprio papel.
  perfil: "cliente", trocarsenha: "cliente", contaSalvar: "cliente", contaAvatar: "cliente",
  // SHOWCASE/PORTAL DO CLIENTE: a vitrine (piso 'cliente' — todo logado vê a PROPRIA projeção).
  // A negação de ver cliente de outrem/projeto não-liberado é feita DENTRO da ação, no servidor.
  showcase: "cliente",
  // VITRINE (show-run de cases): LEITURA piso 'equipe' (interna). CRUD (criar/editar/publicar/
  // remover case e produtos) = gestao, piso 'coordenacao' (o handler ainda exige u.coord).
  // TODO abertura externa: para expor a vitrine a 'cliente'/publico, baixar o piso de 'vitrine'/
  // 'vitrineFicha' e servir SOMENTE publicado=1 (ja filtrado no handler) — decisao explicita.
  vitrine: "equipe", vitrineFicha: "equipe",
  vitrineSet: "coordenacao", vitrineDel: "coordenacao", vitrineProdSet: "coordenacao", vitrineProdDel: "coordenacao",
  // TRILHAS (manual vivo): piso 'cliente' — todo logado vê o manual dos modulos que ACESSA.
  // A lista de capitulos deriva de modulosLiberados (mesma fonte do Hub), ja filtrada por
  // papel/tenant no servidor. So-leitura; nenhuma escrita. Fornecedor (lateral) fica de fora
  // (nao esta em FORNECEDOR_OK), como todo o resto fora do launcher.
  trilhas: "cliente",
  // DNA & ATIVOS (central de marca + documentos institucionais): area de coordenacao/admin.
  // Leitura dos conteudos institucionais (tabela 'conteudo') filtrada pelo tenant do usuario.
  // Piso 'coordenacao' (equipe/cliente negados na borda pelo guard). Sem campo monetario.
  dna: "coordenacao",
  // Associar usuário Cliente ao seu cliente e liberar/desliberar projeto ao cliente: coordenacao+.
  setmembrocliente: "coordenacao", liberarcliente: "coordenacao",
  // concessao / liberacao / aprovacao / gestao (coordenacao+)
  solStatus: "coordenacao", pinpend: "coordenacao", pinlib: "coordenacao", pinneg: "coordenacao",
  // T7: fluxo de solicitacao de acesso + allowlist (piso coordenacao; Admin para papel sensivel,
  // checado dentro do branch). acessoSolicitar e PUBLICO (pre-login) e nao entra aqui.
  acessoListar: "coordenacao", acessoAprovar: "coordenacao", acessoRejeitar: "coordenacao",
  allowList: "coordenacao", allowSet: "coordenacao",
  resetpin: "coordenacao", setemail: "coordenacao", auditoria: "coordenacao", setprojx: "coordenacao",
  setresp: "coordenacao", setfuncao: "coordenacao", setrespsetor: "coordenacao", setrespdom: "coordenacao",
  setprojmeta: "coordenacao", setprev: "coordenacao", aprovaficha: "coordenacao", setcargo: "coordenacao",
  situacao: "coordenacao", consolidar: "coordenacao", setprazos: "coordenacao",
  // PROJETOS (migracao 6.1 para acesso por acao): cadastrar vira SUBMETER (piso equipe); o
  // handler cria PROPOSTO se o cargo so tem `projetos.submeter`, e ATIVO se tem `projetos.aprovar`.
  // Aprovar/listar propostas pedem `projetos.aprovar` (piso coordenacao como teto grosso).
  addproj: "equipe", projaprovar: "coordenacao", projpropostas: "coordenacao",
  setstatus: "coordenacao", catset: "coordenacao", catinfo: "coordenacao",
  mcptoken: "coordenacao", mcptokens: "coordenacao", mcprevoke: "coordenacao",
  // permissoes confidenciais e concessao de acervo (aba do dono) — admin
  perms: "coordenacao", permset: "coordenacao", acset: "coordenacao",
  // FINANCEIRO — painel de lucro/prejuizo em R$. Piso 'admin' no guard; recorte fino isOwner
  // (so o dono) DENTRO de cada branch e em modulosLiberados. Unico lugar do portal com valor
  // monetario. acervo_list/acervo_arquivo ficam no piso de acervo (equipe + grant), nao aqui.
  financeiro: "coordenacao", custohoraList: "coordenacao", custohoraSet: "coordenacao", custohoraDel: "coordenacao", projfinSet: "coordenacao",
  // Resumo executivo materializado + base do fluxo de caixa: mesmo piso 'coordenacao', recorte
  // fino isOwner || financeiro.ver/editar DENTRO de cada branch (igual ao resto do Financeiro).
  resumoExec: "coordenacao", resumoExecFechar: "coordenacao", resumoExecHist: "coordenacao",
  fluxoList: "coordenacao", fluxoSet: "coordenacao", fluxoDel: "coordenacao", fluxoCc: "coordenacao",
  custoFixoList: "coordenacao", custoFixoSet: "coordenacao", custoFixoDel: "coordenacao",
  capacidade: "coordenacao",
  // ACERVO — navegar pastas do bucket-fonte (abrir arquivo e via rota POST /acervo/arquivo).
  // Mesmo piso da busca (equipe) + grant de acervo checado dentro do branch (isOwner||acgrant).
  acervo_list: "equipe",
  // RH (Fase 1): leitura E edicao do manual de cargos restritas a gestao (piso coordenacao;
  // equipe/cliente nao veem a aba, negados na borda pelo guard). Decisao do dono 2026-10-13:
  // RH e aba de gestao restrita. O vinculo pessoa->cargo ja e feito por `setcargo` (coordenacao).
  rh: "coordenacao", rhset: "coordenacao", rhdel: "coordenacao", rhatribuir: "coordenacao",
  // Onda 3 / INC 1 — multi-cargo (piso coordenacao; cap fina pessoas.cargo_atribuir no branch).
  rhcargoadd: "coordenacao", rhcargodel: "coordenacao", rhcargoprincipal: "coordenacao", rhcargofoco: "coordenacao",
  // Onda 3 / INC 2 — ficha da pessoa (piso equipe = time interno vê/edita a PRÓPRIA; o acesso à
  // ficha de OUTRA pessoa é gated no branch: self OU rh.ver/pessoas.cargo_atribuir/coord/dono).
  pessoaficha: "equipe", pessoafichaset: "equipe", pessoafichacv: "equipe",
  pessoaskillset: "equipe", pessoaskilldel: "equipe", pessoametaset: "equipe", pessoametadel: "equipe",
  pessoatreinoset: "equipe", pessoatreinodel: "equipe", pessoatreinocomprov: "equipe",
  // Onda 3 / INC 3 — portfólio de serviços (artefato de empresa): leitura interna (piso equipe),
  // edição pela Coordenação (piso coordenacao).
  portf: "equipe", portfservset: "coordenacao", portfservdel: "coordenacao",
  portfvernew: "coordenacao", portfverdel: "coordenacao", portfskilladd: "coordenacao", portfskilldel: "coordenacao",
  // G3 — gestão de colaboradores (quadro `membro`): piso coordenacao; gate fino por capability no branch.
  rhmembros: "coordenacao", rhmembroadd: "coordenacao", rhmembroset: "coordenacao", rhmembrodel: "coordenacao",
  // "Meu cargo": todo logado vê o DETALHE do PRÓPRIO cargo (piso cliente). Só leitura.
  meucargo: "cliente",
};
/* Fornecedor e LATERAL: nao herda a cadeia nem e herdado por ela. A UNICA acao que lhe e
 * aberta nesta rodada e 'hub' — a porta de entrada do launcher (T4), para que o fornecedor
 * consiga carregar o PROPRIO Hub; como nenhum modulo tem acao-governante propria de
 * fornecedor, o Hub dele vem VAZIO. Toda outra acao de MIN segue negada no servidor
 * (temPapelMinimo(fornecedor, <aninhado>) = false). O mecanismo ja esta pronto para quando
 * nascerem acoes proprias do fornecedor. T6 acrescenta as acoes da PROPRIA conta
 * (perfil/trocarsenha/contaSalvar/contaAvatar): "qualquer logado cuida da propria conta"
 * inclui o fornecedor (lateral), que de outro modo seria barrado pelo aninhamento. Papel
 * segue read-only para ele tambem — nenhuma dessas acoes escreve papel. */
const FORNECEDOR_OK = new Set<string>(["hub", "perfil", "trocarsenha", "contaSalvar", "contaAvatar"]);

/* ============================================================================
 * T4 — HUB / LAUNCHER: catalogo de modulos (os cards da porta de entrada)
 * --------------------------------------------------------------------------
 * Cada modulo aponta para a ACAO que o governa (`acao`). O papel minimo do card
 * NAO e redeclarado aqui: vem de MIN[acao], a MESMA fonte de verdade do guard T2.
 * Assim Hub e guard nunca divergem — mudou o piso em MIN, o card acompanha. A acao
 * 'hub' (piso cliente) governa o proprio launcher. `view` e a tela do front que o
 * card abre; `grupo` espelha o grupo da sidebar (paridade de navegacao). Recortes
 * finos alem do papel (grant de acervo, permissao de escritorio, dono) sao aplicados
 * no SERVIDOR dentro de modulosLiberados(). Nenhum modulo inventado: todos mapeiam
 * 1:1 as views ja existentes. Sem valor monetario em rotulo ou resumo.
 * ========================================================================== */
type Modulo = { id: string; view: string; acao: string; label: string; titulo: string; resumo: string; icon: string; grupo: string };
const MODULOS: Modulo[] = [
  { id: "cadastro",   view: "cadastro",   acao: "addproj",      label: "Cadastro",         titulo: "Cadastro da Casa",     resumo: "Projetos, pessoas, setores e parâmetros da operação.", icon: "📋", grupo: "PROJETOS" },
  { id: "lancar",     view: "lancar",     acao: "add",          label: "Lançar horas",     titulo: "Apontar Horas",        resumo: "Registre o esforço do dia por centro de custo.",       icon: "⏱️", grupo: "PROJETOS" },
  { id: "apont",      view: "apont",      acao: "hist",         label: "Apontamentos",     titulo: "Minhas Horas",         resumo: "Histórico das horas que você lançou e o status.",      icon: "📄", grupo: "PROJETOS" },
  { id: "pend",       view: "pend",       acao: "pinpend",      label: "Pendentes",        titulo: "Aprovações & Trilha",  resumo: "Liberações, pedidos de acesso e trilha de auditoria.", icon: "⏳", grupo: "PROJETOS" },
  { id: "projetos",   view: "projetos",   acao: "produtos",     label: "Projetos",         titulo: "Carteira de Projetos", resumo: "Projetos da casa, responsáveis e andamento.",          icon: "📁", grupo: "PROJETOS" },
  { id: "showcase",   view: "showcase",   acao: "showcase",     label: "Vitrine",          titulo: "Vitrine de Projetos",  resumo: "Galeria executiva de projetos e entregas por cliente e status.", icon: "🖼️", grupo: "PROJETOS" },
  /* (NÃO duplicar a Vitrine) A galeria de CASES (show-run: apresentação HTML + produtos finais)
     foi EMBUTIDA na própria "Vitrine de Projetos" (viewShowcase, bloco "Cases em destaque"), por
     decisão do dono (descartar a aba nova, enriquecer a antiga). Por isso NÃO há módulo próprio
     'vitrine' aqui — seria a 2ª aba "Vitrine" que causou a confusão. As ações vitrine/vitrineFicha
     e o CRUD seguem existindo (route()+MIN), consumidos pelo bloco de cases dentro do showcase. */
  { id: "agenda",     view: "agenda",     acao: "eventos",      label: "Agenda",           titulo: "Agenda & Ritos",       resumo: "Eventos, reuniões e ritos da equipe.",                 icon: "📅", grupo: "PROJETOS" },
  { id: "brief",      view: "brief",      acao: "brief",        label: "Daily Brief",      titulo: "Daily Brief",          resumo: "Radar de editais e notícias com triagem por IA.",      icon: "📰", grupo: "CONHECIMENTO" },
  { id: "acervo",     view: "acervo",     acao: "acervo_busca", label: "Acervo Técnico",   titulo: "Acervo Técnico",       resumo: "Biblioteca de normas, fichas e precedentes da casa.",  icon: "📚", grupo: "CONHECIMENTO" },
  { id: "trilhas",    view: "trilhas",    acao: "trilhas",      label: "Trilhas",          titulo: "Trilhas — Manual Vivo",resumo: "Guia de uso de cada módulo que você acessa, no seu papel.", icon: "🧭", grupo: "CONHECIMENTO" },
  { id: "escritorio", view: "escritorio", acao: "escritorio",   label: "Escritório de IA", titulo: "Escritório de IA",     resumo: "Catalogo e lancador dos agentes, skills e tools da casa (rodam no Claude Code).",     icon: "🤖", grupo: "CONHECIMENTO" },
  { id: "comercial",  view: "comercial",  acao: "comercial",    label: "Comercial · CRM",  titulo: "Comercial · CRM & Leads",resumo: "Pipeline comercial (CRM), leads inbound, horas da equipe e o explorador de leads ambientais de MG (tela única, todos os bancos).", icon: "📍", grupo: "COMERCIAL" },
  { id: "rh",         view: "rh",         acao: "rh",           label: "RH & Cargos",      titulo: "RH, Cargos e Rotinas", resumo: "Cargos, responsabilidades, rotinas e onboarding por função. Área de gestão.", icon: "👥", grupo: "PESSOAS" },
  { id: "ficha",      view: "ficha",      acao: "pessoaficha",  label: "Minha ficha",      titulo: "Ficha da Pessoa",      resumo: "Seu currículo, Lattes, habilidades, metas, treinamentos e evolução pelas horas.", icon: "🧑‍🎓", grupo: "PESSOAS" },
  { id: "servicos",   view: "servicos",   acao: "portf",        label: "Portfólio de Serviços", titulo: "Portfólio de Serviços", resumo: "Serviços da casa com histórico de versões e as habilidades que cada um exige.", icon: "🧰", grupo: "CONHECIMENTO" },
  { id: "dna",        view: "dna",        acao: "dna",          label: "DNA & Ativos",     titulo: "DNA & Ativos da Marca",resumo: "Kit de marca, logos e documentos institucionais da casa.", icon: "🎨", grupo: "CONHECIMENTO" },
  { id: "financeiro", view: "financeiro", acao: "financeiro",   label: "Financeiro",       titulo: "Financeiro — Lucro × Prejuízo", resumo: "Custo real × valor contratado por projeto, em tempo real. Área do dono.", icon: "💰", grupo: "FINANCEIRO" },
  { id: "permissoes", view: "permissoes", acao: "perms",        label: "Permissões",       titulo: "Permissões & Acessos", resumo: "Áreas confidenciais e concessão de acervo.",           icon: "🔒", grupo: "ADMINISTRAÇÃO" },
];
/** Liberacao de modulos para UM usuario, decidida NO SERVIDOR (auth + MIN + recortes finos).
 *  Base de verdade do Hub: o front so renderiza o que esta funcao devolver. Esconder no
 *  front nunca e a fronteira — o guard MIN ja nega a acao de cada card por conta propria. */
async function modulosLiberados(u: { slug: string; papel: Papel }): Promise<P[]> {
  const out: P[] = [];
  for (const m of MODULOS) {
    const min = (Object.prototype.hasOwnProperty.call(MIN, m.acao) ? MIN[m.acao] : "cliente") as Papel;
    const okPapel = u.papel === "fornecedor" ? FORNECEDOR_OK.has(m.acao) : temPapelMinimo(u.papel, min);
    if (!okPapel) continue;
    // 2a camada (alem do piso de papel): o MESMO recorte que a acao do modulo ja aplica.
    if (m.id === "acervo") {
      const acok = isOwner(u.slug) || grantValid(await cfgGet("acgrant:" + u.slug));
      if (!acok) continue;
    } else if (m.id === "escritorio") {
      const al = String((await cfgGet("perm:escritorio")) || "").split(",").filter(Boolean);
      if (!(isOwner(u.slug) || al.includes(u.slug) || temCapSet(await capsAtribuidas(u), "escritorio.ver"))) continue;
    } else if (m.id === "comercial") {
      if (!(await podeComercial(u.slug) || temCapSet(await capsAtribuidas(u), "comercial.ver"))) continue;
    } else if (m.id === "permissoes") {
      if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "sistema.config"))) continue;
    } else if (m.id === "financeiro") {
      // R$: dono (isOwner) ou cargo com financeiro.ver (Sócios / Coord. Financeira).
      if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.ver"))) continue;
    }
    out.push({ id: m.id, view: m.view, label: m.label, titulo: m.titulo, resumo: m.resumo, icon: m.icon, grupo: m.grupo, papelMin: min });
  }
  return out;
}

/* ============================================================================
 * MODELO DE ACESSO POR CAPABILITY / CARGO (migracao, ADITIVO — nao altera gate)
 * --------------------------------------------------------------------------
 * Base para mover a seguranca de "por aba" (MIN) para "por acao/conteudo", classificada
 * por CARGO. Nesta rodada e SO a fundacao: a camada existe e e exposta ao front (hub.caps),
 * mas NENHUM gate foi trocado — o guard MIN segue valendo. A migracao e incremental e
 * planejada no documento-mestre (01_Portal_Gestao\00_Planejamento_e_Status). White-label:
 * CARGO_CAPS pode ser sobrescrito por config D1 `cargocaps:<cid>` (JSON array). O vinculo
 * pessoa->cargo reaproveita config `cargo:<slug>` (acao setcargo). Enquanto o cargo nao for
 * um cid conhecido, cai no fallback por PAPEL — preservando EXATAMENTE o comportamento atual. */
const CAP_CATALOGO: Record<string, string[]> = {
  engenharia: ["projetos.ver", "projetos.submeter", "projetos.aprovar", "projetos.editar", "horas.lancar", "horas.aprovar", "horas.ver_todas", "agenda.ver", "agenda.editar"],
  comercial: ["comercial.ver", "comercial.gerir"],
  financeiro: ["financeiro.ver", "financeiro.editar"],
  pessoas: ["rh.ver", "rh.editar", "pessoas.cargo_atribuir"],
  juridico: ["juridico.ver", "juridico.editar", "contratos.ver", "contratos.editar"],
  conhecimento: ["acervo.consultar", "brief.ver", "brief.curar", "trilhas.ver", "escritorio.ver"],
  administracao: ["acesso.gerir", "sistema.config", "dna.ver"],
};
const PAPEL_CAPS: Record<string, string[]> = {
  admin: ["*"],
  coordenacao: ["engenharia.*", "horas.aprovar", "agenda.editar", "acervo.consultar", "brief.curar", "rh.ver", "comercial.ver", "dna.ver", "trilhas.ver"],
  equipe: ["projetos.ver", "projetos.submeter", "horas.lancar", "agenda.ver", "acervo.consultar", "brief.ver", "trilhas.ver"],
  cliente: ["showcase.ver", "trilhas.ver"],
  fornecedor: [],
};
const CARGO_CAPS_DEFAULT: Record<string, string[]> = {
  // Funcao executiva maxima (exercida por mais de uma pessoa). Substitui o antigo dono unico.
  socios: ["*"],
  direcao: ["*"], // alias historico
  // Coordenacao POR AREA: acesso total da propria area (area.*) + leituras cruzadas.
  coord_tecnica: ["engenharia.*", "acervo.consultar", "brief.curar", "trilhas.ver"],
  coord_comercial: ["comercial.*", "projetos.ver", "agenda.editar", "trilhas.ver"],
  coord_financeira: ["financeiro.*", "projetos.ver", "trilhas.ver"],
  coord_juridica: ["juridico.*", "projetos.ver", "trilhas.ver"],
  coord_adm_rh: ["pessoas.*", "acesso.gerir", "agenda.editar", "rh.ver", "trilhas.ver"],
  coordenacao: ["engenharia.*", "horas.aprovar", "agenda.editar", "acervo.consultar", "brief.curar", "rh.ver", "comercial.ver", "dna.ver", "trilhas.ver"], // generica (compat)
  // Cargos de execucao.
  projetista: ["projetos.ver", "projetos.submeter", "horas.lancar", "agenda.ver", "acervo.consultar", "trilhas.ver"],
  cadista: ["projetos.ver", "horas.lancar", "acervo.consultar", "trilhas.ver"],
  analista: ["projetos.ver", "projetos.submeter", "horas.lancar", "acervo.consultar", "brief.ver", "trilhas.ver"],
  estagiario: ["horas.lancar", "acervo.consultar", "agenda.ver", "projetos.ver", "trilhas.ver"],
  engenheiro_jr: ["projetos.ver", "projetos.submeter", "horas.lancar", "agenda.ver", "acervo.consultar", "trilhas.ver"],
  engenheiro_pl: ["projetos.ver", "projetos.submeter", "horas.lancar", "agenda.ver", "acervo.consultar", "trilhas.ver"],
  engenheiro_sr: ["projetos.ver", "projetos.submeter", "horas.lancar", "agenda.ver", "acervo.consultar", "brief.ver", "trilhas.ver"],
  montagem: ["projetos.ver", "horas.lancar", "acervo.consultar", "trilhas.ver"],
};
/** Expande coringas: "*" => tudo; "area.*" => todas as caps da area (+ mantem o coringa). */
function expandeCaps(lista: string[]): Set<string> {
  const out = new Set<string>();
  for (const c of lista) {
    if (c === "*") { out.add("*"); continue; }
    if (c.endsWith(".*")) { const area = c.slice(0, -2); for (const cap of (CAP_CATALOGO[area] || [])) out.add(cap); out.add(c); continue; }
    out.add(c);
  }
  return out;
}
/** Onda 3 / INC 1 — MULTI-CARGO. Cids de cargo atribuidos a uma pessoa. Fonte = tabela
 *  `membro_cargo` (N cargos por pessoa); fallback ao vinculo legado `cargocid:<slug>` (1 so)
 *  enquanto a linha da nova tabela nao existir. Ordem: principal primeiro, depois prioridade. */
async function cargosDe(slug: string): Promise<{ cid: string; principal: number; prioridade: number; foco: string }[]> {
  try {
    const r = await sqlite.execute({ sql: "SELECT cid, principal, prioridade, foco FROM membro_cargo WHERE tenant_id = ? AND slug = ? ORDER BY principal DESC, prioridade, cid", args: [TENANT_INTELECTO, slug] });
    if (r.rows.length) return (r.rows as P[]).map((x) => ({ cid: String(x.cid).trim().toLowerCase(), principal: Number(x.principal) ? 1 : 0, prioridade: Number(x.prioridade) || 0, foco: String(x.foco || "") }));
  } catch (_) { /* tabela ainda nao existe (pre-migracao): cai no legado */ }
  const cid = String((await cfgGet("cargocid:" + slug)) || "").trim().toLowerCase();
  return cid ? [{ cid, principal: 1, prioridade: 0, foco: "" }] : [];
}
/** Base de capabilities de UM cargo: override D1 `cargocaps:<cid>` (JSON array, white-label)
 *  senao o default do codigo. Cid desconhecido (sem override nem default) contribui vazio. */
async function capsBaseDeCid(cid: string): Promise<string[]> {
  const ov = await cfgGet("cargocaps:" + cid);
  if (ov) { try { const j = JSON.parse(ov); if (Array.isArray(j)) return j.map(String); } catch { /* json invalido: ignora */ } }
  return CARGO_CAPS_DEFAULT[cid] || [];
}
/** Mantem o vinculo legado `cargocid:<slug>` apontando para o cargo PRINCIPAL atual (ou o limpa),
 *  para qualquer leitor legado seguir funcionando durante a transicao multi-cargo. Best-effort. */
async function syncCargocidLegacy(slug: string): Promise<void> {
  try {
    const r = await sqlite.execute({ sql: "SELECT cid FROM membro_cargo WHERE tenant_id = ? AND slug = ? ORDER BY principal DESC, prioridade, cid LIMIT 1", args: [TENANT_INTELECTO, slug] });
    if (r.rows.length) await cfgSet("cargocid:" + slug, String((r.rows[0] as P).cid));
    else await cfgDel("cargocid:" + slug);
  } catch (_) { /* best-effort */ }
}
/** Capabilities efetivas do usuario: dono => tudo; senao UNIAO das capabilities de TODOS os
 *  cargos atribuidos (multi-cargo); senao (sem cargo conhecido) fallback por papel — preservando
 *  o comportamento atual. So-leitura; nao grava nada. */
async function capsDe(u: { slug: string; papel: Papel }): Promise<Set<string>> {
  if (isOwner(u.slug)) return new Set<string>(["*"]);
  const cargos = await cargosDe(u.slug);
  if (cargos.length) {
    const base: string[] = [];
    for (const c of cargos) for (const cap of await capsBaseDeCid(c.cid)) base.push(cap);
    if (base.length) return expandeCaps(base); // algum cargo conhecido => UNIAO
    // todos os cids desconhecidos (sem override/default): preserva o fallback por papel
  }
  return expandeCaps(PAPEL_CAPS[u.papel] || []);
}
/** Capabilities vindas SOMENTE dos cargos atribuidos (UNIAO, sem fallback por papel). Vazio se a
 *  pessoa nao tem cargo. Usado em AREAS RESTRITAS (acervo, comercial, financeiro, permissoes) para
 *  que a migracao NAO afrouxe o acesso por padrao: quem nao tem cargo segue barrado pelo gate
 *  existente (acgrant/allowlist/isOwner); o cargo so ESTENDE o acesso, nunca abre sozinho. */
async function capsAtribuidas(u: { slug: string; papel: Papel }): Promise<Set<string>> {
  if (isOwner(u.slug)) return new Set<string>(["*"]);
  const cargos = await cargosDe(u.slug);
  if (!cargos.length) return new Set<string>();
  const base: string[] = [];
  for (const c of cargos) for (const cap of await capsBaseDeCid(c.cid)) base.push(cap);
  return expandeCaps(base);
}
/** true se o conjunto concede a capability (considerando "*" e "area.*"). */
function temCapSet(caps: Set<string>, cap: string): boolean {
  if (caps.has("*") || caps.has(cap)) return true;
  const area = cap.split(".")[0];
  return caps.has(area + ".*");
}
/** GESTAO DE PROJETO — quem pode abrir o detalhe rico de projeto (horas por colaborador, GUT,
 *  progresso, obs, previsto×gasto) e ver/editar o andamento. Autoridade = coordenacao/admin
 *  (papel, cobre coordenadores de QUALQUER area) OU cargo com `projetos.aprovar` (coord. tecnica,
 *  socios). O colaborador de EXECUCAO (equipe/projetista/cadista/analista/estagiario/engenheiro_*)
 *  fica so com a lista basica (`produtos`) e com o lancamento das PROPRIAS horas — nao abre o
 *  detalhe rico nem mexe no andamento. R$ segue com recorte proprio (isOwner || financeiro.ver). */
async function podeGestaoProjeto(u: { slug: string; papel: Papel }): Promise<boolean> {
  if (temPapelMinimo(u.papel, "coordenacao")) return true;
  return temCapSet(await capsDe(u), "projetos.aprovar");
}

/* ============================================================================
 * T8 — AUDITORIA DE ACOES SENSIVEIS (trilha de "quem liberou o que, a quem")
 * --------------------------------------------------------------------------
 * A trilha e GRAVADA pelos ganchos de audit() espalhados por route() — muitos ja
 * deixados pela T7. Esta frente (a) fecha as lacunas de cobertura (ex.: email_alterado),
 * (b) torna a trilha CONSULTAVEL com filtro por periodo/autor/alvo/tipo. A consulta
 * (acao `auditoria`) e SO-LEITURA — nenhuma via da UI edita ou apaga um registro —,
 * negada no SERVIDOR pelo guard MIN (piso 'coordenacao') e filtrada pelo tenant de quem
 * consulta (u.tenant_id): a trilha de um tenant NUNCA aparece para outro (confidencialidade
 * por centro de custo). Modelo de registro (tabela `audit`, da T2, intacta):
 *   ts=TIMESTAMP · slug=AUTOR · ev=ACAO · det=DETALHE (inclui alvo + tenant) · ip · tenant_id=TENANT.
 * Trava de credencial: o registro guarda o EVENTO (quem resetou/liberou de quem), NUNCA o
 * valor de senha/hash; e nenhum detalhe carrega valor monetario. */
const EVENTOS_SENSIVEIS: string[] = [
  "papel_concedido", "acesso_solicitado", "acesso_aprovado", "acesso_rejeitado",
  "allow_set", "allow_remove", "senha_solicitada", "senha_liberada", "senha_negada",
  "senha_reset", "email_alterado", "permset", "acset", "mcptoken", "mcprevoke",
  // T6 — trilha das acoes da propria conta (sem nunca gravar o valor da senha/foto):
  "senha_alterada", "senha_troca_negada", "avatar_alterado", "papel_autopromocao_negada",
  // SHOWCASE/PORTAL DO CLIENTE — associacao de cliente e liberacao de projeto ao cliente:
  "membro_cliente_set", "liberar_cliente",
  // DAILY BRIEF — curadoria e triagem do radar interno (quem adicionou/apagou o que, geriu fonte, rodou coleta):
  "brief_add", "brief_del", "brief_fonte_set", "brief_fonte_del", "brief_coleta",
  // G3 — gestão do quadro de colaboradores (adicionar/editar papel/inativar/remover):
  "membro_add", "membro_set", "membro_del",
  // Onda 3 — atribuição de cargo (dirige o ACESSO da pessoa): multi-cargo e vínculo.
  "rh_atribuir", "rh_cargo_add", "rh_cargo_del", "rh_cargo_princ", "rh_cargo_foco",
  // Onda 3 — ficha da pessoa (dados pessoais/LGPD): CV, skills, metas, treinamentos.
  "pessoa_ficha", "pessoa_cv", "pessoa_skill", "pessoa_skill_del", "pessoa_meta", "pessoa_meta_del",
  "pessoa_treino", "pessoa_treino_del", "pessoa_arquivo",
  // Onda 3 — portfólio de serviços (artefato de empresa, versionado).
  "portfolio_serv", "portfolio_serv_del", "portfolio_ver", "portfolio_ver_del", "portfolio_skill",
  // M4 — falha de entrega de e-mail (retida para rastreio operacional).
  "email_falha",
];
/** T6 — tamanho maximo do avatar (comprimento da data URL, em caracteres). ~64 KB: a foto
 *  e PEQUENA e sem upload externo; o front reduz a imagem a um quadrado pequeno antes de
 *  enviar. O servidor ainda assim valida formato e tamanho (fronteira no servidor). */
const AVATAR_MAX = 65536;
/** Onda 3 / INC 2 — teto do PDF (CV e comprovante de treinamento) enviado ao R2, em bytes. 6 MB
 *  cobre currículos e certificados; o servidor valida tamanho e assinatura %PDF (fronteira real). */
const PDF_MAX_BYTES = 6 * 1024 * 1024;
/** Decodifica uma data URL / base64 de PDF em bytes, validando assinatura e teto. Lanca em erro. */
function pdfFromB64(raw: string): { bytes: Uint8Array } {
  let b = String(raw || "");
  const v = b.indexOf("base64,"); if (v >= 0) b = b.slice(v + 7);
  b = b.replace(/\s/g, "");
  if (!b) throw new Error("Arquivo vazio.");
  let bin: string; try { bin = atob(b); } catch { throw new Error("Arquivo inválido (base64)."); }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length > PDF_MAX_BYTES) throw new Error("PDF grande demais (limite de 6 MB).");
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) throw new Error("Envie um arquivo PDF.");
  return { bytes };
}

/* CARTEIRA EXECUTIVA — DESTAQUES DA SEMANA (derivados no SERVIDOR dos dados reais, tenant-filtrados).
 * Quatro lentes, cada uma com os projetos que mais pedem atenção nesta semana corrente (segunda→domingo):
 *  (a) prazo nesta semana — previsto/fim caindo na semana, ainda aberto;
 *  (b) maior prioridade GUT — G×U×T mais alto entre os avaliados;
 *  (c) maior consumo / estouro de horas — gasto/previsto mais alto (estouro em primeiro);
 *  (d) mais ativos — mais horas lançadas na semana.
 * Sem valor monetário; só esforço em horas e datas. */
async function destaquesSemana(tenant: string, proj: P[], px: P[], gastas: Record<string, number>): Promise<P[]> {
  const hoje = new Date();
  const dow = (hoje.getUTCDay() + 6) % 7; // 0 = segunda
  const seg = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - dow));
  const dom = new Date(Date.UTC(seg.getUTCFullYear(), seg.getUTCMonth(), seg.getUTCDate() + 6));
  const segISO = seg.toISOString().slice(0, 10), domISO = dom.toISOString().slice(0, 10);
  // horas lançadas nesta semana por cc (qualquer status: é atividade da semana)
  const sem = await sqlite.execute({ sql: "SELECT cc, COALESCE(SUM(h),0) AS h FROM lanc WHERE tenant_id = ? AND d >= ? AND d <= ? GROUP BY cc", args: [tenant, segISO, domISO] });
  const semMap: Record<string, number> = {};
  for (const r of sem.rows as P[]) semMap[String(r.cc)] = Math.round((Number(r.h) || 0) * 10) / 10;
  const pxMap: Record<string, P> = {}; for (const x of px) pxMap[String(x.cc)] = x;
  const ativo = (p: P) => { const s = String(p.status || "").toUpperCase(); return s.indexOf("CONCLU") < 0 && s.indexOf("CANCEL") < 0; };
  const info = (p: P) => ({ cc: String(p.cc), projeto: String(p.projeto || p.cc), cliente: String(p.cliente || ""), status: String(p.status || "") });
  const out: P[] = [];
  // (a) prazos nesta semana
  const prazos = proj.filter((p) => ativo(p)).map((p) => {
    const dt = String(p.previsto || p.fim || ""); return dt >= segISO && dt <= domISO ? { p, dt } : null;
  }).filter(Boolean).sort((a: any, b: any) => a.dt.localeCompare(b.dt)).slice(0, 3);
  for (const x of prazos as any[]) out.push({ tipo: "prazo", label: "Prazo nesta semana", valor: x.dt, ...info(x.p) });
  // (b) maior prioridade (1-100, GUT + impacto/esforço)
  const gut = proj.filter((p) => ativo(p)).map((p) => {
    const x = pxMap[String(p.cc)] || {}; const g = prioridade100(x.gravidade, x.urgencia, x.tendencia, x.impacto, x.esforco);
    return g > 0 ? { p, g } : null;
  }).filter(Boolean).sort((a: any, b: any) => b.g - a.g).slice(0, 3);
  for (const x of gut as any[]) out.push({ tipo: "gut", label: "Prioridade", valor: x.g, ...info(x.p) });
  // (c) maior consumo / estouro de horas
  const consumo = proj.filter((p) => ativo(p)).map((p) => {
    const x = pxMap[String(p.cc)] || {}; const prev = Number(x.prev) || 0; const g = gastas[String(p.cc)] || 0;
    return prev > 0 ? { p, pct: Math.round((g / prev) * 1000) / 10, estouro: g > prev } : null;
  }).filter(Boolean).sort((a: any, b: any) => b.pct - a.pct).slice(0, 3);
  for (const x of consumo as any[]) out.push({ tipo: "consumo", label: x.estouro ? "Estouro de horas" : "Maior consumo de horas", valor: x.pct, estouro: x.estouro, ...info(x.p) });
  // (d) mais ativos na semana
  const ativos = Object.keys(semMap).map((cc) => {
    const p = proj.find((q) => String(q.cc) === cc); return p ? { p, h: semMap[cc] } : null;
  }).filter(Boolean).sort((a: any, b: any) => b.h - a.h).slice(0, 3);
  for (const x of ativos as any[]) out.push({ tipo: "ativo", label: "Mais horas na semana", valor: x.h, ...info(x.p) });
  return out;
}

async function route(action: string, p: P, ip: string): Promise<P> {
  /* GUARD CENTRAL: negacao por papel no SERVIDOR, antes de qualquer branch. Acoes publicas
     (pre-login) passam direto; toda acao catalogada em MIN exige o papel minimo. Os branches
     seguem chamando auth() para obter u.tenant_id e aplicar o recorte fino de cada acao. */
  if (!PUBLICAS.has(action) && Object.prototype.hasOwnProperty.call(MIN, action)) {
    const g = await auth(p);
    const min = MIN[action];
    const autorizado = g.papel === "fornecedor" ? FORNECEDOR_OK.has(action) : temPapelMinimo(g.papel, min);
    if (!autorizado) throw new Error("Sem acesso: esta ação exige o papel mínimo \"" + min + "\".");
  }

  if (action === "backup_now") {
    const u = await auth(p);
    if (!isOwner(u.slug)) throw new Error("Apenas o dono pode disparar o backup.");
    const r = await backupD1(ENV);
    if (!r.ok) throw new Error("Backup falhou: " + (r.erro || "erro desconhecido"));
    return { ok: true, backup: r } as P;
  }

  if (action === "escritorio") {
    const u = await auth(p);
    const al = String((await cfgGet("perm:escritorio")) || "").split(",").filter(Boolean);
    if (!(isOwner(u.slug) || al.includes(u.slug))) throw new Error("Sem acesso a esta aba.");
    // Catálogo HONESTO (Fase 0.2): agentes e skills REAIS da casa, que rodam no Claude Code / plugin
    // (não dentro do Worker). Cada item diz o que faz e como disparar. Nada "executa" aqui.
    const catalogo = [
      { grupo: "Orquestração", nota: "Comece por aqui num trabalho novo, amplo ou multidisciplinar.", itens: [
        { nome: "intelecto-orquestrador", tipo: "agente", faz: "Roteia qualquer pedido da casa para o combo certo de skills/agentes, na ordem certa, garantindo POP-ENG-001, confidencialidade e o Crivo A-F.", disparo: "No Claude Code: “use o orquestrador para …”." },
      ]},
      { grupo: "Produção de engenharia", nota: "Executam o entregável; devolvem ao revisor (não liberam o próprio trabalho).", itens: [
        { nome: "intelecto-memorialista", tipo: "agente", faz: "Memorial de cálculo e descritivo, do grau de liberdade ao texto final, com rastreabilidade do dado ao parágrafo.", disparo: "“use o memorialista para fechar o MC do CC …”." },
        { nome: "intelecto-projetista-dwg", tipo: "agente", faz: "Lê, extrai, compara e gera prancha em DWG/DXF, cortes, layout e verificação de locação/cotas.", disparo: "“use o projetista-dwg para …”." },
        { nome: "intelecto-modelador-3d", tipo: "agente", faz: "Regera o modelo 3D georreferenciado (executivo_G2.json) a partir de terreno/arranjo/rede.", disparo: "“use o modelador-3d para …”." },
      ]},
      { grupo: "Verificação & Crivo (somente leitura)", nota: "Auditam sem ter produzido; emitem laudo, não corrigem.", itens: [
        { nome: "intelecto-revisor-independente", tipo: "agente", faz: "Aplica o Crivo Intelecto A-F e consolida os verificadores. Última etapa antes de liberar.", disparo: "“revise com o revisor independente”." },
        { nome: "intelecto-verificador-calculo", tipo: "agente", faz: "Refaz o dimensionamento em prova cega e compara.", disparo: "“verifique os cálculos”." },
        { nome: "intelecto-verificador-normativo", tipo: "agente", faz: "Vigência/aplicabilidade das normas e critério mais restritivo.", disparo: "“verifique as normas”." },
        { nome: "intelecto-verificador-grafico", tipo: "agente", faz: "Qualidade gráfica da prancha emitida (penas, layers, densidade, ligações).", disparo: "“verifique a prancha emitida”." },
        { nome: "intelecto-verificador-3d", tipo: "agente", faz: "Compatibiliza memorial × prancha × modelo 3D (cotas, UTM, interferências).", disparo: "“verifique contra o 3D”." },
        { nome: "intelecto-verificador-modelo-cliente", tipo: "agente", faz: "Conformidade contra os modelos do cliente (MACH/Vale).", disparo: "“verifique contra o modelo do cliente”." },
      ]},
      { grupo: "Entregáveis & Acabamento", nota: "", itens: [
        { nome: "intelecto-gestor-entregaveis", tipo: "agente", faz: "Organiza o pacote de entrega, identifica a revisão vigente, testa a abertura de cada arquivo; copia e arquiva, nunca move nem apaga.", disparo: "“monte a pasta de envio”." },
        { nome: "intelecto-design-editorial", tipo: "agente", faz: "Acabamento gráfico/editorial: estilos do cliente, densidade e altura de letra, penas/layers, carimbo e simbologia.", disparo: "“aplique o padrão visual do cliente”." },
      ]},
      { grupo: "Skills de domínio técnico", nota: "Disparam por “/nome” no Claude Code ou por palavra-gatilho.", itens: [
        { nome: "intelecto-ete", tipo: "skill", faz: "Concepção e dimensionamento de ETE e esgoto sanitário.", disparo: "/intelecto-ete" },
        { nome: "intelecto-hidraulica", tipo: "skill", faz: "Abastecimento, adução, elevatória, reservação, rede e ETA.", disparo: "/intelecto-hidraulica" },
        { nome: "intelecto-tratabilidade", tipo: "skill", faz: "Jar-Test, coagulação/floculação, dosagem ótima, rota tecnológica.", disparo: "/intelecto-tratabilidade" },
        { nome: "intelecto-biogas", tipo: "skill", faz: "Digestão anaeróbia, biodigestor, BMP, biogás/biometano.", disparo: "/intelecto-biogas" },
        { nome: "balanco-massa / balanco-energia / grau-de-liberdade", tipo: "skill", faz: "Fecha balanços e checa se o sistema está bem especificado antes de resolver.", disparo: "/balanco-massa · /grau-de-liberdade" },
      ]},
      { grupo: "Skills de função & processo", nota: "", itens: [
        { nome: "intelecto-contexto", tipo: "skill", faz: "Contexto-mestre e POP-ENG-001 (papéis, gates, centro de custo, Crivo).", disparo: "/intelecto-contexto" },
        { nome: "intelecto-redator", tipo: "skill", faz: "Redação técnica sênior: relatórios e propostas (CAPEX/OPEX).", disparo: "/intelecto-redator" },
        { nome: "intelecto-revisor", tipo: "skill", faz: "Crivo A-F de qualidade do entregável.", disparo: "/intelecto-revisor" },
        { nome: "intelecto-scaffolding", tipo: "skill", faz: "Abre e organiza o projeto no padrão (centro de custo E.C.T.P, pastas, versão).", disparo: "/intelecto-scaffolding" },
        { nome: "intelecto-diagnostico / escopo-consistencia", tipo: "skill", faz: "Diagnóstico técnico (linha de base) e varredura de inconsistências de escopo.", disparo: "/intelecto-diagnostico" },
        { nome: "intelecto-webapp", tipo: "skill", faz: "Sites/apps internos (Cloudflare Workers + D1), como este portal.", disparo: "/intelecto-webapp" },
      ]},
      { grupo: "CAD, P&ID, SIG e Acervo", nota: "", itens: [
        { nome: "pid-extracao / pid-simbologia / pid-construcao", tipo: "skill", faz: "Extrai dados de processo, aplica ISA-5.1/ISO e desenha o P&ID.", disparo: "/pid-extracao" },
        { nome: "cad-* (dwg-converter, layer-manager, figuras-reais…)", tipo: "skill", faz: "Conversão, camadas, geometria e realismo de pranchas CAD.", disparo: "/cad-dwg-converter" },
        { nome: "intelecto-qgis / intelecto-leitor-dwg", tipo: "skill", faz: "SIG/mapas e leitura/extração de pranchas DWG/DXF.", disparo: "/intelecto-qgis" },
        { nome: "acervo-consulta", tipo: "skill", faz: "Consulta os 953 docs do acervo (normas, fichas, precedentes) via AutoRAG/MCP.", disparo: "/acervo-consulta · ou a aba Acervo" },
      ]},
    ];
    /* CÉREBRO OPERACIONAL (Fase F): o mapa de COMO A CASA FUNCIONA. Espinha = macroprocesso
       POP-ENG-001 (16 etapas, 5 fases, 6 gates). Lóbulos = áreas, cada uma com seus
       procedimentos (passo) e os recursos (agente/skill) que atuam — estado 'existe' (no plugin)
       ou 'criar' (proposto, a construir). Conteúdo real onde documentado; "a detalhar" onde falta. */
    const macro = [
      { fase: "I · Captação & Qualificação", area: "Comercial", etapas: "E1 Prospecção · E2 Qualificação · E3 Passagem comercial→engenharia", gates: "G0 aderência ao portfólio · G1 qualificação do lead" },
      { fase: "II · Estruturação técnico-comercial", area: "Comercial + Coordenação", etapas: "E4 Diagnóstico & escopo · E5 Esforço & QQP · E6 Proposta · E7 Contrato", gates: "G2 suficiência de dados · G3 consistência do QQP e do preço" },
      { fase: "III · Mobilização", area: "Coordenação + RH", etapas: "E8 Centro de custo · E9 Pasta do projeto · E10 Kickoff", gates: "G4 prontidão para kickoff" },
      { fase: "IV · Execução & Entrega", area: "Engenharia", etapas: "E11 Execução · E12 Revisão & liberação · E13 Entrega ao cliente", gates: "G5 Crivo Intelecto A-F" },
      { fase: "V · Encerramento & Pós-venda", area: "Comercial + Coordenação", etapas: "E14 Encerramento · E15 Pós-venda · E16 Retroalimentação de contextos", gates: "—" },
    ];
    const r = (nome: string, tipo: string, estado: string, faz: string) => ({ nome, tipo, estado, faz });
    const areas = [
      { area: "Comercial", cor: "info", procedimentos: [
          { nome: "Prospecção & qualificação (funil 21 etapas / E1–E2)", passos: "Captar lead → qualificar (score/GUT) → mover no pipeline (6 macro-fases). CRM no portal.", estado: "existe" },
          { nome: "Proposta & QQP (E5–E6, gate G3)", passos: "Diagnóstico → esforço em horas → preço rastreável → proposta.", estado: "a detalhar" },
          { nome: "Contrato (E7)", passos: "Fechamento; valor contratado alimenta o Financeiro.", estado: "existe" },
        ], recursos: [ r("agente-comercial", "agente", "criar", "Capta/qualifica leads, monta proposta a partir do histórico e do portfólio."), r("acervo-consulta", "skill", "existe", "Portfólio e precedentes para a proposta.") ] },
      { area: "Engenharia", cor: "brand", procedimentos: [
          { nome: "Diagnóstico & escopo (E4, gate G2)", passos: "Linha de base, auditoria de dados, gap analysis.", estado: "existe" },
          { nome: "Execução (E11)", passos: "Grau de liberdade → balanços → dimensionamento → memorial/prancha/3D.", estado: "existe" },
          { nome: "Revisão & Crivo (E12, gate G5)", passos: "Verificadores + revisor independente aplicam o Crivo A-F.", estado: "existe" },
          { nome: "Entrega (E13)", passos: "Pacote versionado, DWG testado, laudo de round-trip.", estado: "existe" },
        ], recursos: [ r("intelecto-orquestrador", "agente", "existe", "Roteia o trabalho e garante POP-ENG + Crivo."), r("intelecto-memorialista", "agente", "existe", "Memorial de cálculo e descritivo."), r("intelecto-projetista-dwg", "agente", "existe", "Pranchas DWG/DXF."), r("intelecto-modelador-3d", "agente", "existe", "Modelo 3D georreferenciado."), r("intelecto-revisor-independente + 5 verificadores", "agente", "existe", "Crivo A-F e verificação cega."), r("intelecto-gestor-entregaveis", "agente", "existe", "Pacote de entrega versionado."), r("skills de domínio (ete, hidráulica, tratabilidade, biogás, balanços)", "skill", "existe", "Dimensionamento por disciplina.") ] },
      { area: "Financeiro", cor: "ok", procedimentos: [
          { nome: "Custo real por projeto/CC", passos: "Horas × custo/hora (c/ encargos) + consumíveis + terceiros.", estado: "existe" },
          { nome: "Contratado × custo = margem", passos: "Valor contratado (do CRM) menos custo real; lucro×prejuízo.", estado: "existe" },
          { nome: "Resumo executivo (snapshot datado)", passos: "Consolida financeiro + pipeline CRM + horas + fluxo; materializa snapshot datado com auditoria.", estado: "existe" },
          { nome: "Fluxo de caixa", passos: "Base de lançamentos entrada/saída, previsto × realizado, por projeto — editável e auditada no portal. Falta completar (impostos, empréstimos, faturamento futuro).", estado: "a detalhar" },
        ], recursos: [ r("agente-financeiro", "agente", "criar", "Fecha QQP/preço, fluxo de caixa e custo por centro de custo.") ] },
      { area: "Pessoas / RH", cor: "warn", procedimentos: [
          { nome: "Cargos & capacidade", passos: "Catálogo de cargos, vínculo, horas/dia, capacidade da equipe.", estado: "existe" },
          { nome: "Atribuição pessoa→cargo", passos: "O cargo dirige o acesso (RBAC por capability).", estado: "existe" },
          { nome: "Metas & KPIs por cargo", passos: "Metas/indicadores por função (campo no RH).", estado: "a detalhar" },
          { nome: "Onboarding & primeiro acesso", passos: "Convite → aprovação → senha → primeiro login.", estado: "existe" },
        ], recursos: [ r("agente-rh", "agente", "criar", "Ajuda a desenhar cargos, metas e alocação de pessoas.") ] },
      { area: "Conhecimento & IA", cor: "accent", procedimentos: [
          { nome: "Acervo (AutoRAG)", passos: "953 docs: normas, fichas, precedentes; consulta por IA.", estado: "existe" },
          { nome: "Daily Brief (radar)", passos: "Editais e notícias com triagem por IA (env.AI).", estado: "existe" },
          { nome: "Contexto-mestre (POP-ENG)", passos: "Memória da casa que orienta todo trabalho.", estado: "existe" },
          { nome: "Assistente online no portal", passos: "Responder sobre os dados da casa e sugerir ações (IA leve).", estado: "criar" },
        ], recursos: [ r("acervo-consulta", "skill", "existe", "Consulta o acervo via AutoRAG/MCP."), r("intelecto-contexto", "skill", "existe", "Contexto-mestre e POP-ENG.") ] },
    ];
    return { ok: true, catalogo, cerebro: { macro, areas } };
  }

  // ===== COMERCIAL · Leads Ambientais (allowlist perm:comercial) =====
  // RELIGADO à base nova (amb_registro): a aba usa ambMeta/ambList; esta ação vira um shim
  // compatível (campo `index.regioes` preservado p/ qualquer consumidor antigo), agora servido
  // do D1 e não mais do R2. Nada depende mais dos painéis HTML por bacia.
  if (action === "comercial") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.ver")) throw new Error("Sem acesso a esta aba.");
    const bk = await sqlite.execute({ sql: "SELECT bank, COUNT(*) n FROM amb_registro WHERE tenant_id = ? GROUP BY bank", args: [u.tenant_id] });
    const banks: Record<string, number> = {};
    for (const r of bk.rows as P[]) banks[String(r.bank)] = Number(r.n) || 0;
    const rg = await sqlite.execute({ sql: "SELECT bacia, COUNT(*) emp FROM amb_registro WHERE tenant_id = ? AND bank = 'empreendimentos' AND bacia <> '' GROUP BY bacia ORDER BY emp DESC", args: [u.tenant_id] });
    const regioes = (rg.rows as P[]).map((r) => ({ slug: String(r.bacia), nome: String(r.bacia).replace(/_/g, " "), emp: Number(r.emp) || 0 }));
    return { ok: true, index: { regioes }, banks, fonte: "d1:amb_registro" };
  }
  if (action === "funnel_pull") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.ver")) throw new Error("Sem acesso.");
    const r = await sqlite.execute({ sql: "SELECT lead_key, status, notas, dono, atualizado_em FROM lead_funnel WHERE tenant_id = ?", args: [u.tenant_id] });
    const records = r.rows.map((x: P) => ({ key: x.lead_key, status: x.status || "", notas: x.notas || "", ts: Date.parse(String(x.atualizado_em)) || 0, dono: x.dono || "" }));
    return { ok: true, records };
  }
  if (action === "funnel_push") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.gerir")) throw new Error("Sem acesso.");
    const key = String(p.key || "").slice(0, 400);
    if (!key) throw new Error("lead_key vazio.");
    const status = String(p.status || "").slice(0, 60);
    const notas = String(p.notas || "").slice(0, 4000);
    const now = new Date().toISOString();
    await sqlite.execute({ sql: "INSERT INTO lead_funnel (tenant_id, lead_key, status, notas, dono, atualizado_em) VALUES (?,?,?,?,?,?) ON CONFLICT(tenant_id, lead_key) DO UPDATE SET status=excluded.status, notas=excluded.notas, dono=excluded.dono, atualizado_em=excluded.atualizado_em", args: [u.tenant_id, key, status, notas, u.slug, now] });
    await audit("funnel_push", u.slug, key + ": " + status, ip);
    return { ok: true };
  }
  /* ===== LEADS AMBIENTAIS — explorador multi-banco (tela única, SERVER-SIDE) =====
     Mesma allowlist perm:comercial da aba. Três ações: ambMeta (bancos + bacias p/ montar os
     filtros), ambList (página filtrada de 1 banco) e ambFicha (1 registro + instrumentos/TACs).
     Nunca carrega tudo: a tela pede só a página corrente (LIMIT/OFFSET) do banco escolhido. */
  if (action === "ambMeta") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.ver")) throw new Error("Sem acesso a esta aba.");
    const bk = await sqlite.execute({ sql: "SELECT bank, COUNT(*) n FROM amb_registro WHERE tenant_id = ? GROUP BY bank", args: [u.tenant_id] });
    const bc = await sqlite.execute({ sql: "SELECT DISTINCT bacia FROM amb_registro WHERE tenant_id = ? AND bacia <> '' ORDER BY bacia", args: [u.tenant_id] });
    const banks: Record<string, number> = {};
    for (const r of bk.rows as P[]) banks[String(r.bank)] = Number(r.n) || 0;
    const bacias = (bc.rows as P[]).map((r) => String(r.bacia));
    const tr = await sqlite.execute({ sql: "SELECT COUNT(DISTINCT lead_id) n FROM lead_instrumento WHERE tenant_id = ?", args: [u.tenant_id] });
    const tacLeads = Number((tr.rows[0] as P).n) || 0;
    return { ok: true, banks, bacias, tacLeads };
  }
  if (action === "ambList") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.ver")) throw new Error("Sem acesso a esta aba.");
    const { bank, w, args } = ambWhere(p, u.tenant_id);
    const ob = ambOrder(p);
    const limit = Math.max(1, Math.min(100, Math.floor(Number(p.limit) || 50)));
    const offset = Math.max(0, Math.floor(Number(p.offset) || 0));
    const cnt = await sqlite.execute({ sql: "SELECT COUNT(*) n FROM amb_registro WHERE " + w, args });
    const total = Number((cnt.rows[0] as P).n) || 0;
    const rs = await sqlite.execute({ sql: "SELECT id, bacia, municipio, lat, lon, ord, props FROM amb_registro WHERE " + w + " " + ob + " LIMIT ? OFFSET ?", args: [...args, limit, offset] });
    const rows = (rs.rows as P[]).map((r) => { let pr: P = {}; try { pr = JSON.parse(String(r.props || "{}")); } catch (_) { /* props corrompido: devolve só o comum */ } return { ...pr, _id: r.id, _bacia: r.bacia, _m: r.municipio, _ord: r.ord, _lat: r.lat, _lon: r.lon }; });
    return { ok: true, bank, rows, total, limit, offset };
  }
  /* Valores distintos (com contagem) p/ montar os seletores de filtro do banco corrente —
     respeita a bacia selecionada. Cada chave: coluna dedicada (setor/classe/...) ou props. */
  if (action === "ambFacets") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.ver")) throw new Error("Sem acesso a esta aba.");
    const bank = String(p.bank || "empreendimentos").replace(/[^a-z_]/gi, "").slice(0, 40);
    const base: string[] = ["tenant_id = ?", "bank = ?"]; const bargs: P[] = [u.tenant_id, bank];
    const bacia = String(p.bacia || "").slice(0, 60); if (bacia) { base.push("bacia = ?"); bargs.push(bacia); }
    const COL = new Set(["setor", "classe", "situacao", "municipio", "bacia"]);
    const keys = (Array.isArray(p.keys) ? p.keys : []).slice(0, 12);
    const facets: Record<string, P[]> = {};
    for (const kraw of keys) {
      const k = String(kraw || "").replace(/[^a-z_0-9]/gi, "").slice(0, 30); if (!k) continue;
      const expr = COL.has(k) ? k : "json_extract(props,'$." + k + "')";
      const lim = k === "municipio" ? 400 : 80;
      const r = await sqlite.execute({ sql: "SELECT " + expr + " v, COUNT(*) n FROM amb_registro WHERE " + base.join(" AND ") + " AND " + expr + " IS NOT NULL AND " + expr + " <> '' GROUP BY " + expr + " ORDER BY " + (k === "municipio" ? expr + " ASC" : "n DESC") + " LIMIT ?", args: [...bargs, lim] });
      facets[String(kraw)] = (r.rows as P[]).map((x) => ({ v: String(x.v), n: Number(x.n) || 0 }));
    }
    return { ok: true, bank, facets };
  }
  /* Recorte FILTRADO completo (não paginado, teto 50k) p/ download no cliente (CSV/GeoJSON/KML).
     Projeta só as colunas pedidas (sanitizadas) + coordenada. Mesmo WHERE/ordem da lista. */
  if (action === "ambExport") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.ver")) throw new Error("Sem acesso a esta aba.");
    const { bank, w, args } = ambWhere(p, u.tenant_id);
    const ob = ambOrder(p);
    const cap = Math.max(1, Math.min(50000, Math.floor(Number(p.max) || 50000)));
    const cols = (Array.isArray(p.cols) ? p.cols : []).map((k: any) => String(k).replace(/[^a-z_0-9]/gi, "").slice(0, 30)).filter(Boolean).slice(0, 30);
    const rs = await sqlite.execute({ sql: "SELECT id, lat, lon, props FROM amb_registro WHERE " + w + " " + ob + " LIMIT ?", args: [...args, cap] });
    const rows = (rs.rows as P[]).map((r) => { let pr: P = {}; try { pr = JSON.parse(String(r.props || "{}")); } catch (_) { /* */ } const o: P = {}; for (const k of cols) o[k] = pr[k]; o.c = [r.lon, r.lat]; return o; });
    return { ok: true, bank, rows, truncated: rows.length >= cap, cap };
  }
  /* Pontos (lat/lon) do recorte FILTRADO p/ o mapa vetorial (sem tiles). Teto 3k, ordenados
     pela métrica do banco (top primeiro se truncar). Payload enxuto: id/lat/lon/ord/rótulo. */
  if (action === "ambPoints") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.ver")) throw new Error("Sem acesso a esta aba.");
    const { bank, w, args } = ambWhere(p, u.tenant_id);
    const ob = ambOrder(p);
    const cap = Math.max(1, Math.min(5000, Math.floor(Number(p.max) || 3000)));
    const rs = await sqlite.execute({ sql: "SELECT id, lat, lon, ord, rotulo FROM amb_registro WHERE " + w + " AND lat IS NOT NULL AND lon IS NOT NULL " + ob + " LIMIT ?", args: [...args, cap] });
    const pts = (rs.rows as P[]).map((r) => ({ id: r.id, lat: r.lat, lon: r.lon, ord: r.ord, rotulo: r.rotulo }));
    return { ok: true, bank, pts, truncated: pts.length >= cap, cap };
  }
  /* Agregados (ex.: fiscalizações) — total + top por município e por tipo. Soma entre bacias
     quando nenhuma é escolhida. Lê amb_agg (bank='fiscalizacao'). */
  if (action === "ambAgg") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.ver")) throw new Error("Sem acesso a esta aba.");
    const bank = String(p.bank || "fiscalizacao").replace(/[^a-z_]/gi, "").slice(0, 40);
    const where: string[] = ["tenant_id = ?", "bank = ?"]; const args: P[] = [u.tenant_id, bank];
    const bacia = String(p.bacia || "").slice(0, 60); if (bacia) { where.push("bacia = ?"); args.push(bacia); }
    const w = where.join(" AND ");
    const totR = await sqlite.execute({ sql: "SELECT COALESCE(SUM(valor),0) v FROM amb_agg WHERE " + w + " AND dim='total'", args });
    const mkDim = async (dim: string, lim: number) => {
      const r = await sqlite.execute({ sql: "SELECT chave, SUM(valor) v FROM amb_agg WHERE " + w + " AND dim=? GROUP BY chave ORDER BY v DESC LIMIT ?", args: [...args, dim, lim] });
      return (r.rows as P[]).map((x) => ({ chave: String(x.chave), valor: Number(x.v) || 0 }));
    };
    return { ok: true, bank, total: Number((totR.rows[0] as P).v) || 0, mun: await mkDim("mun", 20), tipo: await mkDim("tipo", 20) };
  }
  /* Promove um lead ambiental (empreendimento) a LEAD CANDIDATO no CRM (fila de homologação) —
     decisão humana (gate comercial.gerir). Preserva atribuição (origem/canal/fonte). PF é
     protegido (LGPD) e não entra. Idempotente: id determinístico LA-<amb_id> (não duplica).
     A promoção a Lead/negócio continua sendo o botão "Aprovar → negócio" (crmLeadAprovar). */
  if (action === "ambToCrm") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.gerir")) throw new Error("Sem permissão para promover ao CRM.");
    const id = String(p.id || "").slice(0, 200);
    const r = await sqlite.execute({ sql: "SELECT props, municipio, bacia FROM amb_registro WHERE tenant_id = ? AND bank = 'empreendimentos' AND id = ?", args: [u.tenant_id, id] });
    if (!r.rows.length) throw new Error("Lead não encontrado.");
    const row0 = r.rows[0] as P; let pr: P = {}; try { pr = JSON.parse(String(row0.props || "{}")); } catch (_) { /* */ }
    if (String(pr.tp || "") === "PF") throw new Error("Lead de pessoa física é protegido (LGPD); promova apenas PJ.");
    const lid = "LA-" + id;
    // Contato enriquecido (opcional, vindo do cnpjLookup): e-mail/telefone/contato/CNPJ.
    const email = String(p.email || "").slice(0, 160);
    const telefone = String(p.telefone || "").slice(0, 60);
    const contato = String(p.contato || "").slice(0, 160);
    const cnpj = String(p.cnpj || "").replace(/\D/g, "").slice(0, 14);
    const temContato = !!(email || telefone || contato || cnpj);
    const ex = await sqlite.execute({ sql: "SELECT id, status, dealid FROM crm_lead WHERE tenant_id = ? AND id = ?", args: [u.tenant_id, lid] });
    if (ex.rows.length) {
      const e0 = ex.rows[0] as P;
      if (temContato) { await sqlite.execute({ sql: "UPDATE crm_lead SET email = COALESCE(NULLIF(?,''), email), telefone = COALESCE(NULLIF(?,''), telefone), contato = COALESCE(NULLIF(?,''), contato) WHERE tenant_id = ? AND id = ?", args: [email, telefone, contato, u.tenant_id, lid] }); await audit("amb_to_crm_enriq", u.slug, lid + (cnpj ? " cnpj " + cnpj : ""), ip); }
      return { ok: true, id: lid, jaExiste: true, atualizado: temContato, status: String(e0.status || ""), dealid: String(e0.dealid || "") };
    }
    const g = (k: string, n = 200) => String(pr[k] == null ? "" : pr[k]).slice(0, n);
    const hoje = new Date().toISOString().slice(0, 10);
    const bacia = String(row0.bacia || "").replace(/_/g, " ");
    const msg = "Lead promovido da tela de Leads Ambientais (bacia " + bacia + "). Cód. DN217 " + g("cd") + " · atividade: " + g("a", 280) + (g("sv") ? " · serviço sugerido: " + g("sv", 200) : "") + (cnpj ? " · CNPJ " + cnpj : "");
    await sqlite.execute({ sql: "INSERT INTO crm_lead (tenant_id, id, empresa, segmento, cidade, produto, sinal, fonte, status, descoberto, origem, mensagem, canal, email, telefone, contato) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", args: [u.tenant_id, lid, g("n"), g("s"), String(row0.municipio || ""), g("sv"), g("pq", 400), "Prospecção · base ambiental MG", "candidato", hoje, "base-ambiental-mg", msg, "prospeccao-amb", email, telefone, contato] });
    await audit("amb_to_crm", u.slug, id + " -> " + lid + (cnpj ? " cnpj " + cnpj : ""), ip);
    return { ok: true, id: lid, jaExiste: false };
  }
  /* Enriquecimento de contato por CNPJ (proxy server-side → BrasilAPI, pública, sem chave).
     O Worker faz o fetch (sem restrição de CSP); devolve e-mail/telefone/endereço/sócios da
     Receita p/ o usuário validar e salvar no CRM. Gate comercial.ver. */
  if (action === "cnpjLookup") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.ver")) throw new Error("Sem acesso a esta aba.");
    const cnpj = String(p.cnpj || "").replace(/\D/g, "");
    if (cnpj.length !== 14) throw new Error("CNPJ inválido — informe os 14 dígitos.");
    let d: P = {};
    try {
      const resp = await fetch("https://brasilapi.com.br/api/cnpj/v1/" + cnpj, { headers: { accept: "application/json", "user-agent": "portal-intelecto" } });
      if (resp.status === 404) throw new Error("CNPJ não encontrado na base da Receita.");
      if (!resp.ok) throw new Error("Consulta indisponível (HTTP " + resp.status + ").");
      d = await resp.json();
    } catch (e: any) { throw new Error(e && e.message ? e.message : "Falha ao consultar o CNPJ."); }
    const tel = String(d.ddd_telefone_1 || d.ddd_telefone_2 || "").trim();
    const socios = Array.isArray(d.qsa) ? (d.qsa as P[]).slice(0, 6).map((s) => String(s.nome_socio || s.nome || "")).filter(Boolean) : [];
    const contato = {
      cnpj, razao: String(d.razao_social || ""), fantasia: String(d.nome_fantasia || ""),
      email: String(d.email || "").toLowerCase(), telefone: tel,
      endereco: [d.logradouro, d.numero, d.bairro, d.municipio, d.uf, d.cep].map((x) => String(x || "").trim()).filter(Boolean).join(", "),
      cnae: String(d.cnae_fiscal_descricao || ""), situacao: String(d.descricao_situacao_cadastral || ""), socios,
    };
    await audit("cnpj_lookup", u.slug, cnpj, ip);
    return { ok: true, contato };
  }
  if (action === "ambFicha") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.ver")) throw new Error("Sem acesso a esta aba.");
    const bank = String(p.bank || "empreendimentos").replace(/[^a-z_]/gi, "").slice(0, 40);
    const id = String(p.id || "").slice(0, 200);
    const r = await sqlite.execute({ sql: "SELECT id, bacia, municipio, lat, lon, props FROM amb_registro WHERE tenant_id = ? AND bank = ? AND id = ?", args: [u.tenant_id, bank, id] });
    if (!r.rows.length) throw new Error("Registro não encontrado.");
    const row0 = r.rows[0] as P; let props: P = {}; try { props = JSON.parse(String(row0.props || "{}")); } catch (_) { /* props corrompido */ }
    let instrumentos: P[] = [];
    if (bank === "empreendimentos" && id) {
      const ir = await sqlite.execute({ sql: "SELECT id, instrumento, orgao, numero, situacao, prazo, obrigacoes, problema, servico, fonte, url_fonte FROM lead_instrumento WHERE tenant_id = ? AND lead_id = ? ORDER BY instrumento", args: [u.tenant_id, id] });
      instrumentos = ir.rows as P[];
    }
    // Ficha de ação (funil): status/notas por registro. Chave própria (amb::bank::id), sem
    // colisão com os painéis por bacia (fichaQF::). Reusa a tabela lead_funnel e funnel_push.
    const fk = "amb::" + bank + "::" + id;
    const fr = await sqlite.execute({ sql: "SELECT status, notas, dono, atualizado_em FROM lead_funnel WHERE tenant_id = ? AND lead_key = ?", args: [u.tenant_id, fk] });
    const f0 = (fr.rows[0] as P) || {};
    const funil = { key: fk, status: String(f0.status || ""), notas: String(f0.notas || ""), dono: String(f0.dono || ""), ts: String(f0.atualizado_em || "") };
    const podeGerir = (await podeComercial(u.slug)) || temCapSet(await capsAtribuidas(u), "comercial.gerir");
    return { ok: true, bank, registro: { ...props, _id: row0.id, _bacia: row0.bacia, _m: row0.municipio, _lat: row0.lat, _lon: row0.lon }, instrumentos, funil, podeGerir };
  }
  // ===== CRM COMERCIAL (frente E) — leitura do pipeline/leads/horas (gate comercial) =====
  if (action === "crm") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.ver")) throw new Error("Sem acesso ao CRM.");
    const dr = await sqlite.execute({ sql: "SELECT id, st, co, city, seg, prod, val, owner, pri, contact, role, email, phone, src, pain, entry, d4date, sentdate, signeddate, lastdate, last, nextdate, next, lossreason, temp, cc FROM crm_deal WHERE tenant_id = ? ORDER BY st DESC, val DESC", args: [u.tenant_id] });
    const lr = await sqlite.execute({ sql: "SELECT id, empresa, segmento, cidade, produto, sinal, fonte, contato, telefone, email, status, descoberto, canal, dealid FROM crm_lead WHERE tenant_id = ? ORDER BY descoberto DESC", args: [u.tenant_id] });
    const tr = await sqlite.execute({ sql: "SELECT id, d, area, hours, note FROM crm_time WHERE tenant_id = ? AND deleted = 0 ORDER BY d DESC", args: [u.tenant_id] });
    // Resumo do funil por macro-fase (6 grupos das 21 subetapas do POP-ENG-001).
    const macro = (st: number) => st <= 0 ? "" : st <= 4 ? "Prospecção & Qualificação" : st <= 8 ? "Diagnóstico Técnico" : st <= 12 ? "Proposta" : st <= 16 ? "Negociação & Contrato" : st <= 20 ? "Execução" : "Pós-venda & Expansão";
    const funil: Record<string, { n: number; val: number }> = {};
    for (const d of dr.rows as P[]) { const m = macro(Number(d.st) || 0); if (!m) continue; (funil[m] = funil[m] || { n: 0, val: 0 }); funil[m].n++; funil[m].val += Number(d.val) || 0; }
    return { ok: true, deals: dr.rows, leads: lr.rows, time: tr.rows, funil, podeGerir: (await podeComercial(u.slug)) || temCapSet(await capsAtribuidas(u), "comercial.gerir") };
  }
  /* CRM — criar/editar negócio (E5). Upsert: em edição só toca os campos do formulário
     (preserva cc/history/d4date/autuacao). Gate comercial.gerir. */
  if (action === "crmDealSet") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.gerir")) throw new Error("Sem permissão para editar o CRM.");
    let id = String(p.id || "").trim();
    const isNew = !id;
    if (isNew) id = "INT-NOVO-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    const st = Math.max(0, Math.min(21, Math.floor(Number(p.st) || 0)));
    const val = Math.max(0, Number(p.val) || 0);
    const g = (k: string, n = 200) => String(p[k] == null ? "" : p[k]).slice(0, n);
    const dt = (k: string) => { const s = String(p[k] || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; };
    const co = g("co", 200); if (co.length < 2) throw new Error("Informe a empresa / nome do negócio.");
    const now = new Date().toISOString();
    const entry = dt("entry") || (isNew ? now.slice(0, 10) : "");
    await sqlite.execute({
      sql: "INSERT INTO crm_deal (tenant_id,id,st,co,city,seg,prod,val,owner,pri,contact,role,email,phone,src,pain,entry,sentdate,signeddate,lastdate,last,nextdate,next,lossreason,temp,atualizado) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
        + "ON CONFLICT(tenant_id,id) DO UPDATE SET st=excluded.st,co=excluded.co,city=excluded.city,seg=excluded.seg,prod=excluded.prod,val=excluded.val,owner=excluded.owner,pri=excluded.pri,contact=excluded.contact,role=excluded.role,email=excluded.email,phone=excluded.phone,src=excluded.src,pain=excluded.pain,sentdate=excluded.sentdate,signeddate=excluded.signeddate,lastdate=excluded.lastdate,last=excluded.last,nextdate=excluded.nextdate,next=excluded.next,lossreason=excluded.lossreason,temp=excluded.temp,atualizado=excluded.atualizado"
        + (isNew ? "" : "") ,
      args: [u.tenant_id, id, st, co, g("city"), g("seg"), g("prod"), val, g("owner", 60), g("pri", 20), g("contact"), g("role"), g("email", 160), g("phone", 60), g("src"), g("pain", 2000), entry, dt("sentdate"), dt("signeddate"), dt("lastdate"), g("last", 2000), dt("nextdate"), g("next", 2000), g("lossreason", 300), g("temp", 20), now],
    });
    await audit("crm_deal", u.slug, (isNew ? "novo " : "edit ") + id + ": " + co.slice(0, 60), ip);
    return { ok: true, id, isNew };
  }
  /* CRM — aprovar lead inbound: vira um negócio (deal) no topo do funil e marca o lead. */
  if (action === "crmLeadAprovar") {
    const u = await auth(p);
    if (!(await podeComercial(u.slug)) && !temCapSet(await capsAtribuidas(u), "comercial.gerir")) throw new Error("Sem permissão para editar o CRM.");
    const lid = String(p.id || "").trim();
    const lr = await sqlite.execute({ sql: "SELECT * FROM crm_lead WHERE tenant_id = ? AND id = ? LIMIT 1", args: [u.tenant_id, lid] });
    if (!lr.rows.length) throw new Error("Lead não encontrado.");
    const l = lr.rows[0] as P;
    if (String(l.status) === "aprovado" && l.dealid) throw new Error("Lead já aprovado.");
    const did = "INT-NOVO-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    const now = new Date().toISOString();
    await sqlite.execute({
      sql: "INSERT INTO crm_deal (tenant_id,id,st,co,city,seg,prod,owner,contact,email,phone,src,pain,entry,atualizado) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [u.tenant_id, did, 1, String(l.empresa || "(sem nome)"), String(l.cidade || ""), String(l.segmento || ""), String(l.produto || ""), u.slug, String(l.contato || ""), String(l.email || ""), String(l.telefone || ""), String(l.fonte || l.canal || ""), String(l.sinal || l.mensagem || ""), now.slice(0, 10), now],
    });
    await sqlite.execute({ sql: "UPDATE crm_lead SET status = 'aprovado', dealid = ?, aprovado = ? WHERE tenant_id = ? AND id = ?", args: [did, now.slice(0, 10), u.tenant_id, lid] });
    await audit("crm_lead_aprovar", u.slug, lid + " -> " + did, ip);
    return { ok: true, dealid: did };
  }

  const now = new Date().toISOString();

  if (action === "ping") return { ok: true, v: 3 };

  if (action === "hist") {
    const u = await auth(p);
    await ensureSeed();
    return { ok: true, hist: u.coord ? HIST_ALL : histDe(u.slug) };
  }

  if (action === "solicitar") {
    const u = await auth(p);
    const itens = String(p.itens || "").slice(0, 600).trim();
    const obs = String(p.obs || "").slice(0, 2000).trim();
    if (!itens) throw new Error("Selecione ao menos uma ferramenta.");
    const id = crypto.randomUUID().slice(0, 8);
    await sqlite.execute({
      sql: "INSERT INTO solic (id,slug,itens,obs,status,criado,tenant_id) VALUES (?,?,?,?, 'ABERTA', ?,?)",
      args: [id, u.slug, itens, obs, now, u.tenant_id],
    });
    await notify(
      "Solicitacao de ferramentas de IA: " + (NOMES[u.slug] || u.slug),
      (NOMES[u.slug] || u.slug) + " solicitou: " + itens + (obs ? "\nObservacao: " + obs : "") + "\nEm " + now + ".",
    );
    await audit("solicitar", u.slug, itens, ip);
    return { ok: true, id };
  }

  if (action === "solListar") {
    const u = await auth(p);
    const cols = "id, slug, itens, obs, status, criado, atendido_por, atendido_em";
    const r = u.coord
      ? await sqlite.execute({ sql: "SELECT " + cols + " FROM solic WHERE tenant_id = ? ORDER BY criado DESC", args: [u.tenant_id] })
      : await sqlite.execute({ sql: "SELECT " + cols + " FROM solic WHERE slug = ? AND tenant_id = ? ORDER BY criado DESC", args: [u.slug, u.tenant_id] });
    return { ok: true, solic: r.rows };
  }

  if (action === "solStatus") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenacao altera o status.");
    const id = String(p.id || "");
    const st = String(p.status || "");
    if (!["ABERTA", "EM ANDAMENTO", "ATENDIDA", "RECUSADA"].includes(st)) throw new Error("Status invalido.");
    await sqlite.execute({ sql: "UPDATE solic SET status=?, atendido_por=?, atendido_em=? WHERE id=? AND tenant_id=?", args: [st, u.slug, now, id, u.tenant_id] });
    await audit("solic_status", u.slug, id + ": " + st, ip);
    return { ok: true };
  }

  /* ===== T7: SOLICITACAO DE ACESSO + ALLOWLIST ===== */
  if (action === "acessoSolicitar") {
    // PUBLICO (pre-login). Rate-limit por IP contra abuso. NUNCA concede papel: so registra
    // o pedido e materializa a identidade como 'cliente' (menor privilegio). A subida depende
    // da aprovacao da Coordenacao. A allowlist apenas SUGERE o papel para a aprovacao.
    const il = await lockInfo("acreq:" + ip, 5);
    if (il.locked) throw new Error("Muitos pedidos deste dispositivo. Aguarde alguns minutos e tente de novo.");
    const email = validEmail(p.email ?? p.ident ?? "");
    const nome = String(p.nome || "").slice(0, 80).trim();
    const obs = String(p.obs || "").slice(0, 1000).trim();
    if (nome.length < 2) throw new Error("Informe seu nome.");
    // Um pedido em aberto por e-mail de cada vez (idempotente para o solicitante impaciente).
    const ja = await sqlite.execute({ sql: "SELECT id FROM acesso WHERE tenant_id = ? AND lower(email) = ? AND status = 'ABERTA' LIMIT 1", args: [TENANT_INTELECTO, email] });
    if (ja.rows.length) { await regFail("acreq:" + ip); return { ok: true, id: String((ja.rows[0] as P).id), repetido: true }; }
    const slug = await slugDeEmail(email);
    await ensureMembroCliente(slug, nome, email); // nasce cliente, inativo ate aprovacao
    const sugerido = (await allowlistPapel(email)) || "cliente"; // allowlist => sugestao; senao cliente
    const id = crypto.randomUUID().slice(0, 8);
    await sqlite.execute({
      sql: "INSERT INTO acesso (id, tenant_id, email, nome, slug, papel_sol, status, obs, criado, ip) VALUES (?,?,?,?,?,?, 'ABERTA', ?,?,?)",
      args: [id, TENANT_INTELECTO, email, nome, slug, sugerido, obs, now, ip],
    });
    await regFail("acreq:" + ip);
    await notify("Novo pedido de acesso ao portal: " + nome, nome + " <" + email + "> pediu acesso.\nPapel sugerido (allowlist): " + sugerido + "\n" + (obs ? "Observacao: " + obs + "\n" : "") + "Em " + now + ".");
    await audit("acesso_solicitado", slug, email + " sugerido:" + sugerido + " tenant:" + TENANT_INTELECTO, ip);
    return { ok: true, id };
  }

  if (action === "acessoListar") {
    const u = await auth(p);
    // Guard MIN ja exigiu coordenacao. So ve o proprio tenant — nada cruza empresa.
    const r = await sqlite.execute({
      sql: "SELECT id, email, nome, slug, papel_sol, papel_conc, status, obs, criado, decidido_por, decidido_em FROM acesso WHERE tenant_id = ? ORDER BY (status='ABERTA') DESC, criado DESC LIMIT 200",
      args: [u.tenant_id],
    });
    return { ok: true, acesso: r.rows, papeis: PAPEIS, sensiveis: [...PAPEIS_SENSIVEIS] };
  }

  if (action === "acessoAprovar") {
    const u = await auth(p);
    const id = String(p.id || "");
    const papel = String(p.papel || "") as Papel;
    if (!PAPEIS.includes(papel)) throw new Error("Escolha um papel valido.");
    // Papel sensivel (coordenacao/admin) so por Admin — 2a camada acima do piso MIN.
    if (PAPEIS_SENSIVEIS.has(papel) && !(u.papel === "admin" || isOwner(u.slug))) {
      throw new Error("Apenas o Admin concede os papeis coordenacao/admin.");
    }
    const r = await sqlite.execute({ sql: "SELECT email, nome, slug, status FROM acesso WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    if (!r.rows.length) throw new Error("Pedido nao encontrado.");
    const req = r.rows[0] as P;
    if (String(req.status) !== "ABERTA") throw new Error("Este pedido ja foi decidido.");
    // M3 — reivindicacao ATOMICA: so concede quem venceu a transicao ABERTA->APROVADA. Duas
    // aprovacoes simultaneas do mesmo pedido: uma afeta a linha, a outra ve rowsAffected=0 e para
    // antes de conceder (evita papel/auditoria em dobro).
    const claim = await sqlite.execute({ sql: "UPDATE acesso SET status = 'APROVADA', papel_conc = ?, decidido_por = ?, decidido_em = ? WHERE id = ? AND tenant_id = ? AND status = 'ABERTA'", args: [papel, u.slug, now, id, u.tenant_id] });
    if (!claim.rowsAffected) throw new Error("Este pedido ja foi decidido.");
    await concedePapel(String(req.slug), papel, String(req.nome || ""), String(req.email || ""), u.slug, ip);
    await audit("acesso_aprovado", u.slug, "alvo:" + req.slug + " <" + req.email + "> papel:" + papel + " tenant:" + u.tenant_id, ip);
    await notify(
      "Acesso aprovado: " + req.nome,
      String(req.nome) + " <" + req.email + "> aprovado como " + papel + " por " + (NOMES[u.slug] || u.slug) + ".\n\n"
        + "Para entrar: acesse " + portalBase() + " e use \"Primeiro acesso / Esqueci minha senha\" com este e-mail (" + req.email + ") para definir a senha. A conta ja esta liberada.",
      String(req.slug),
    );
    return { ok: true, id, papel };
  }

  if (action === "acessoRejeitar") {
    const u = await auth(p);
    const id = String(p.id || "");
    const r = await sqlite.execute({ sql: "SELECT email, nome, slug, status FROM acesso WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    if (!r.rows.length) throw new Error("Pedido nao encontrado.");
    const req = r.rows[0] as P;
    if (String(req.status) !== "ABERTA") throw new Error("Este pedido ja foi decidido.");
    // M3 — mesma reivindicacao atomica da aprovacao (transicao ABERTA->REJEITADA guardada).
    const claim = await sqlite.execute({ sql: "UPDATE acesso SET status = 'REJEITADA', decidido_por = ?, decidido_em = ? WHERE id = ? AND tenant_id = ? AND status = 'ABERTA'", args: [u.slug, now, id, u.tenant_id] });
    if (!claim.rowsAffected) throw new Error("Este pedido ja foi decidido.");
    // Rejeitar nao mexe no papel: a identidade permanece 'cliente' (ou inexistente de fato).
    await audit("acesso_rejeitado", u.slug, "alvo:" + req.slug + " <" + req.email + "> tenant:" + u.tenant_id, ip);
    return { ok: true, id };
  }

  if (action === "allowList") {
    await auth(p); // guard MIN ja exigiu coordenacao
    return { ok: true, allow: await allowlistEntries(), papeis: PAPEIS, sensiveis: [...PAPEIS_SENSIVEIS] };
  }

  if (action === "allowSet") {
    const u = await auth(p);
    const email = validEmail(p.email ?? "");
    const papel = String(p.papel || "").trim();
    if (papel === "") { await cfgDel("allow:" + email); await audit("allow_remove", u.slug, email + " tenant:" + u.tenant_id, ip); return { ok: true, email, removido: true }; }
    if (!PAPEIS.includes(papel as Papel)) throw new Error("Papel invalido.");
    // Pre-autorizar um papel sensivel na allowlist tambem e alcada de Admin.
    if (PAPEIS_SENSIVEIS.has(papel as Papel) && !(u.papel === "admin" || isOwner(u.slug))) {
      throw new Error("Apenas o Admin inclui coordenacao/admin na allowlist.");
    }
    await cfgSet("allow:" + email, papel);
    await audit("allow_set", u.slug, email + "=" + papel + " tenant:" + u.tenant_id, ip);
    return { ok: true, email, papel };
  }

  if (action === "haspin") {
    const s = String(p.slug || "");
    checaAtivo(s);
    await checkLocks(s, ip);
    return { ok: true, has: !!(await cfgGet("pin:" + s)), pendente: !!(await cfgGet("pinreq:" + s)) };
  }

  /* Criacao de senha NAO concede acesso sozinha: registra um pedido que a Coordenacao
     libera na aba Pendentes. Sem isso, qualquer pessoa da internet reivindicava a conta
     de quem ainda nao tinha senha — inclusive contas de Coordenacao. */
  if (action === "setpin") {
    const slug = String(p.slug || ""), senha = String(p.senha || ""), senha2 = String(p.senha2 || "");
    if (!COLABS.includes(slug)) throw new Error("Colaborador desconhecido.");
    checaAtivo(slug);
    await checkLocks(slug, ip);
    validSenha(senha);
    if (senha !== senha2) throw new Error("As senhas não conferem.");
    if (await cfgGet("pin:" + slug)) throw new Error("Senha já cadastrada. Esqueceu? O coordenador pode redefinir.");
    const jaTem = await cfgGet("pinreq:" + slug);
    if (jaTem && Date.now() - (JSON.parse(jaTem).ts || 0) < PINREQ_MS) {
      throw new Error("Já existe um pedido aguardando liberação da Coordenação para este nome.");
    }
    await cfgSet("pinreq:" + slug, JSON.stringify({ h: await hashSenhaNova(slug, senha), ts: Date.now(), ip, quando: now }));
    await regFail("failip:" + ip);
    await audit("senha_solicitada", slug, "ip:" + ip, ip);
    await notify(
      "Pedido de primeiro acesso: " + (NOMES[slug] || slug),
      (NOMES[slug] || slug) + " pediu para criar a senha do Portal em " + now + " (IP " + ip + ").\n\nO acesso só é concedido depois que a Coordenação liberar na aba Pendentes do portal.",
      slug,
    );
    return { ok: true, pendente: true };
  }

  if (action === "pinpend") {
    const u = await auth(p); if (!u.coord) throw new Error("Apenas a Coordenação.");
    const r = await sqlite.execute({ sql: "SELECT k, v FROM config WHERE k LIKE 'pinreq:%' AND tenant_id = ?", args: [TENANT_INTELECTO] });
    const itens = r.rows.map((x: P) => {
      const s = String(x.k).slice(7);
      let o: P = {}; try { o = JSON.parse(String(x.v)); } catch { /* registro corrompido */ }
      return { slug: s, nome: NOMES[s] || s, quando: o.quando || "", ip: o.ip || "", ts: o.ts || 0, coord: COORDS.includes(s) };
    }).filter((it: P) => Date.now() - (it.ts || 0) < PINREQ_MS)
      .sort((a: P, b: P) => (b.ts || 0) - (a.ts || 0));
    return { ok: true, itens };
  }

  if (action === "pinlib") {
    const u = await auth(p); if (!u.coord) throw new Error("Apenas a Coordenação libera primeiro acesso.");
    const alvo = String(p.alvo || "");
    if (!COLABS.includes(alvo)) throw new Error("Colaborador desconhecido.");
    const raw = await cfgGet("pinreq:" + alvo);
    if (!raw) throw new Error("Não há pedido pendente para este nome.");
    const o = JSON.parse(raw);
    if (Date.now() - (o.ts || 0) >= PINREQ_MS) { await cfgDel("pinreq:" + alvo); throw new Error("O pedido expirou. Peça para a pessoa cadastrar de novo."); }
    if (await cfgGet("pin:" + alvo)) { await cfgDel("pinreq:" + alvo); throw new Error("Essa conta já tem senha cadastrada."); }
    await cfgSet("pin:" + alvo, String(o.h));
    await cfgDel("pinreq:" + alvo);
    await cfgDel("fail:" + alvo);
    await audit("senha_liberada", u.slug, "alvo:" + alvo + " ip_pedido:" + (o.ip || ""), ip);
    await notify("Primeiro acesso liberado: " + (NOMES[alvo] || alvo), (NOMES[alvo] || alvo) + " teve o primeiro acesso liberado por " + (NOMES[u.slug] || u.slug) + " em " + now + ".", alvo);
    return { ok: true, alvo };
  }

  if (action === "pinneg") {
    const u = await auth(p); if (!u.coord) throw new Error("Apenas a Coordenação.");
    const alvo = String(p.alvo || "");
    if (!COLABS.includes(alvo)) throw new Error("Colaborador desconhecido.");
    await cfgDel("pinreq:" + alvo);
    await audit("senha_negada", u.slug, "alvo:" + alvo, ip);
    return { ok: true, alvo };
  }

  if (action === "login") {
    // T5 — identidade de login por e-mail OU slug. p.ident/p.email sao o caminho novo;
    // p.slug (front atual, seletor de nome) continua aceito — ninguem quebra na transicao.
    const slug = await slugDeIdent(String(p.ident ?? p.email ?? p.slug ?? ""));
    if (!slug) throw new Error("E-mail ou nome não encontrado. Confira ou fale com a Coordenação.");
    checaAtivo(slug);
    await loginSenha(slug, String(p.senha || ""), ip);
    const token = await newSess(slug);
    await audit("login", slug, "", ip);
    // Papel/coord REAIS vindos do modelo formal (membro) — correto tambem para cliente/fornecedor
    // do T7, nao so para COLABS internos. A UI refina no hub; aqui ja entrega o papel certo.
    const pt = await papelTenantDe(slug);
    return { ok: true, coord: pt.papel === "coordenacao" || pt.papel === "admin", papel: pt.papel, token };
  }

  if (action === "recuperar") {
    // Passo 1: gera código de recuperação e envia por e-mail.
    const slug = String(p.slug || "");
    if (!(await contaAtiva(slug))) throw new Error("Colaborador desconhecido.");
    checaAtivo(slug);
    await checkLocks(slug, ip);
    const lock = await lockInfo("rec:" + slug, 3);
    if (lock.locked) throw new Error("Muitos pedidos de recuperação. Aguarde 10 minutos.");
    await regFail("rec:" + slug);
    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    await cfgSet("rectok:" + slug, (await hashSenha("rec|" + slug, codigo)) + "|" + Date.now());
    const destino = await emailDe(slug);
    const nome = NOMES[slug] || slug;
    const corpo = "Código de recuperação de senha do Portal Intelecto & CSTR\n\n"
      + "Pessoa: " + nome + "\nCódigo: " + codigo + "\nVálido por 30 minutos.\nSolicitado em " + now + " (IP " + ip + ").\n\n"
      + "Se não foi " + nome + " quem pediu, ignore este e-mail: sem o código, nada muda.\n"
      + "A senha só é trocada por quem digitar este código no portal.";
    await notify("Recuperação de senha: " + nome, corpo, slug);
    await audit("recuperacao_pedido", slug, destino ? "email do colaborador" : "somente coordenação", ip);
    return {
      ok: true,
      enviado: destino ? destino.replace(/^(.).*(@.*)$/, "$1•••$2") : null,
      coord: COORDS.includes(slug),
    };
  }

  if (action === "recsenha") {
    // Passo 2: valida o código e grava a nova senha.
    const slug = String(p.slug || ""), codigo = String(p.codigo || "").trim();
    if (!(await contaAtiva(slug))) throw new Error("Colaborador desconhecido.");
    await checkLocks(slug, ip);
    const guardado = await cfgGet("rectok:" + slug);
    if (!guardado) throw new Error("Nenhum pedido de recuperação em aberto. Peça um novo código.");
    const [hash, ts] = guardado.split("|");
    if (Date.now() - Number(ts) > 30 * 60 * 1000) {
      await cfgDel("rectok:" + slug);
      throw new Error("Código expirado. Peça um novo código.");
    }
    if (hash !== await hashSenha("rec|" + slug, codigo)) {
      await regFail("fail:" + slug);
      await regFail("failip:" + ip);
      await audit("recuperacao_codigo_errado", slug, "", ip);
      throw new Error("Código incorreto. Confira o e-mail e tente de novo.");
    }
    const senha = String(p.senha || ""), senha2 = String(p.senha2 || "");
    validSenha(senha);
    if (senha !== senha2) throw new Error("As senhas não conferem.");
    await cfgSet("pin:" + slug, await hashSenhaNova(slug, senha));
    await cfgDel("rectok:" + slug);
    await cfgDel("fail:" + slug);
    await sqlite.execute({ sql: "DELETE FROM sess WHERE slug = ? AND tenant_id = ?", args: [slug, TENANT_INTELECTO] });
    const token = await newSess(slug);
    await audit("senha_recuperada", slug, "", ip);
    await notify(
      "Senha alterada: " + (NOMES[slug] || slug),
      (NOMES[slug] || slug) + " concluiu a recuperação e definiu uma nova senha em " + now + " (IP " + ip + ").\n\n"
        + "Todas as sessões anteriores foram encerradas. Se não foi essa pessoa, redefina a senha dela na aba Gestão imediatamente.",
      slug,
    );
    return { ok: true, coord: COORDS.includes(slug), papel: papelInferido(slug), token };
  }

  if (action === "reclink") {
    /* T5 — Recuperacao por LINK, Passo 1. Gera um token aleatorio de uso unico, guarda-o
       SOMENTE como hash (SHA-256 salgado, nunca em claro) com carimbo de tempo por tenant,
       e envia por e-mail um link que leva a pessoa a DEFINIR a nova senha. A senha e SEMPRE
       escolhida pelo proprio usuario; o link apenas habilita isso. Convive com o fluxo por
       codigo (recuperar/recsenha) sem substitui-lo. Aceita e-mail ou nome como identidade. */
    const slug = await slugDeIdent(String(p.ident ?? p.email ?? p.slug ?? ""));
    if (!slug || !(await contaAtiva(slug))) throw new Error("E-mail ou nome não encontrado. Confira ou fale com a Coordenação.");
    checaAtivo(slug);
    await checkLocks(slug, ip);
    const lock = await lockInfo("rec:" + slug, 3);
    if (lock.locked) throw new Error("Muitos pedidos de recuperação. Aguarde 10 minutos.");
    await regFail("rec:" + slug);
    const tok = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await cfgSet("reclink:" + slug, (await hashSenha("reclink|" + slug, tok)) + "|" + Date.now());
    const nome = NOMES[slug] || slug;
    const link = portalBase() + "/#rec=" + slug + "." + tok;
    const destino = await emailDe(slug);
    const corpo = "Recuperação de senha do Portal Intelecto & CSTR\n\n"
      + "Pessoa: " + nome + "\n\n"
      + "Para definir uma nova senha, abra este link (válido por 60 minutos, uso único):\n\n"
      + link + "\n\n"
      + "Solicitado em " + now + " (IP " + ip + ").\n"
      + "Se não foi " + nome + " quem pediu, ignore este e-mail: sem abrir o link, nada muda.\n"
      + "A senha só é definida por quem abrir o link e digitar a nova senha.";
    await notify("Link de recuperação de senha: " + nome, corpo, slug);
    // Em ambiente sem provedor de e-mail (dev local), registra o link para prova do fluxo.
    if (!ENV || !ENV.RESEND_API_KEY) { try { console.log("[DEV reclink] " + nome + " -> " + link); } catch (_) { /* */ } }
    await audit("recuperacao_link_pedido", slug, destino ? "email do colaborador" : "somente coordenação", ip);
    return {
      ok: true,
      enviado: destino ? destino.replace(/^(.).*(@.*)$/, "$1•••$2") : null,
      coord: COORDS.includes(slug),
    };
  }

  if (action === "recsenhalink") {
    /* T5 — Recuperacao por LINK, Passo 2. Valida o token por HASH + EXPIRACAO + USO UNICO
       (consumido ao usar) e grava a nova senha escolhida pelo proprio usuario. Mesmo modelo
       de hash (SHA-256 salgado) e de sessao do fluxo atual; mesma politica de encerrar as
       sessoes anteriores DAQUELA pessoa, com aviso por e-mail (nao e invalidacao em massa). */
    const slug = String(p.slug || "").toLowerCase().trim();
    const tok = String(p.token || "").trim();
    if (!(await contaAtiva(slug))) throw new Error("Link inválido. Peça um novo link de recuperação.");
    await checkLocks(slug, ip);
    const guardado = await cfgGet("reclink:" + slug);
    if (!guardado) throw new Error("Link inválido ou já utilizado. Peça um novo link de recuperação.");
    const [hash, ts] = guardado.split("|");
    if (Date.now() - Number(ts) > RECLINK_MS) {
      await cfgDel("reclink:" + slug);
      throw new Error("Link expirado. Peça um novo link de recuperação.");
    }
    if (!tok || hash !== await hashSenha("reclink|" + slug, tok)) {
      await regFail("fail:" + slug);
      await regFail("failip:" + ip);
      await audit("recuperacao_link_invalido", slug, "", ip);
      throw new Error("Link inválido. Peça um novo link de recuperação.");
    }
    const senha = String(p.senha || ""), senha2 = String(p.senha2 || "");
    validSenha(senha);
    if (senha !== senha2) throw new Error("As senhas não conferem.");
    await cfgSet("pin:" + slug, await hashSenhaNova(slug, senha));
    await cfgDel("reclink:" + slug); // uso unico: consome o token
    await cfgDel("fail:" + slug);
    await sqlite.execute({ sql: "DELETE FROM sess WHERE slug = ? AND tenant_id = ?", args: [slug, TENANT_INTELECTO] });
    const token = await newSess(slug);
    await audit("senha_recuperada_link", slug, "", ip);
    await notify(
      "Senha alterada: " + (NOMES[slug] || slug),
      (NOMES[slug] || slug) + " concluiu a recuperação por link e definiu uma nova senha em " + now + " (IP " + ip + ").\n\n"
        + "Todas as sessões anteriores foram encerradas. Se não foi essa pessoa, redefina a senha dela na aba Gestão imediatamente.",
      slug,
    );
    return { ok: true, coord: COORDS.includes(slug), papel: papelInferido(slug), token };
  }

  if (action === "logout") {
    await sqlite.execute({ sql: "DELETE FROM sess WHERE token = ? AND tenant_id = ?", args: [String(p.token || ""), TENANT_INTELECTO] });
    return { ok: true };
  }

  if (action === "resetpin") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação redefine senhas.");
    const alvo = String(p.alvo || "");
    await sqlite.execute({ sql: "DELETE FROM config WHERE k = ? AND tenant_id = ?", args: ["pin:" + alvo, TENANT_INTELECTO] });
    await sqlite.execute({ sql: "DELETE FROM sess WHERE slug = ? AND tenant_id = ?", args: [alvo, TENANT_INTELECTO] });
    await cfgDel("fail:" + alvo);
    await audit("senha_reset", u.slug, "alvo:" + alvo, ip);
    return { ok: true };
  }

  if (action === "setemail") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação cadastra e-mails.");
    const alvo = String(p.alvo || "");
    if (!COLABS.includes(alvo)) throw new Error("Colaborador desconhecido.");
    const em = String(p.email || "").trim();
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error("E-mail inválido.");
    if (em) {
      // T5 — e-mail e identidade de login: nao pode colidir com o de outra pessoa.
      const dup = await sqlite.execute({ sql: "SELECT k FROM config WHERE k LIKE 'email:%' AND lower(v) = ? AND k <> ? AND tenant_id = ? LIMIT 1", args: [em.toLowerCase(), "email:" + alvo, TENANT_INTELECTO] });
      if (dup.rows.length) throw new Error("Este e-mail já está vinculado a outra pessoa.");
      await cfgSet("email:" + alvo, em);
    } else {
      await cfgDel("email:" + alvo);
    }
    // Espelha no modelo formal (membro.email) para o login por e-mail e a auditoria por papel.
    try { await sqlite.execute({ sql: "UPDATE membro SET email = ? WHERE slug = ? AND tenant_id = ?", args: [em, alvo, TENANT_INTELECTO] }); } catch (_) { /* coluna criada em ensureSchema */ }
    /* T8 — e-mail e a IDENTIDADE DE LOGIN (T5): altera-la e acao sensivel. Registra o EVENTO
       (quem mudou de quem, definido/removido) sem gravar o valor do e-mail (privacidade). */
    await audit("email_alterado", u.slug, "alvo:" + alvo + " " + (em ? "definido" : "removido") + " tenant:" + u.tenant_id, ip);
    return { ok: true };
  }

  if (action === "auditoria") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação consulta o registro.");
    /* T8 — consulta SO-LEITURA da trilha, filtrada pelo tenant de quem consulta (u.tenant_id):
       a trilha de um tenant nunca aparece para outro. Filtros opcionais: periodo (de/ate,
       data ISO), autor (slug exato), alvo (texto no detalhe) e tipo (evento exato). `soSens`
       limita aos eventos sensiveis. Nenhum ramo aqui escreve/edita/apaga — leitura pura. */
    const de = dataISO(p.de);                                   // '' ou AAAA-MM-DD (inicio, inclusivo)
    const ate = dataISO(p.ate);                                 // '' ou AAAA-MM-DD (fim, dia inteiro incluso)
    const autor = String(p.autor || "").trim().toLowerCase().slice(0, 40);
    const tipo = String(p.tipo || "").trim().slice(0, 40);
    const alvo = String(p.alvo || "").trim().toLowerCase().slice(0, 80);
    const soSens = p.soSens === true || String(p.soSens || "") === "1";
    const cond: string[] = ["tenant_id = ?"];
    const args: any[] = [u.tenant_id];
    if (de) { cond.push("ts >= ?"); args.push(de); }
    if (ate) { cond.push("ts < ?"); args.push(ate + "T99"); }   // ISO: 'T99' > qualquer hora do dia 'ate' e < o dia seguinte
    if (autor) { cond.push("lower(slug) = ?"); args.push(autor); }
    if (tipo) { cond.push("ev = ?"); args.push(tipo); }
    if (alvo) { cond.push("lower(det) LIKE ?"); args.push("%" + alvo + "%"); }
    if (soSens) { cond.push("ev IN (" + EVENTOS_SENSIVEIS.map(() => "?").join(",") + ")"); args.push(...EVENTOS_SENSIVEIS); }
    const r = await sqlite.execute({
      sql: "SELECT ts, slug, ev, det, ip, tenant_id FROM audit WHERE " + cond.join(" AND ") + " ORDER BY ts DESC LIMIT 300",
      args,
    });
    return { ok: true, eventos: r.rows, tipos: EVENTOS_SENSIVEIS };
  }

  if (action === "setprojx") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação altera contrato e previsão.");
    const cc = String(p.cc || "");
    if (!/^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/.test(cc)) throw new Error("Centro de custo inválido.");
    const COM = ["", "PROSPECCAO", "PROPOSTA", "CONTRATADO", "NAO_FECHADO"];
    const com = String(p.com || "");
    if (!COM.includes(com)) throw new Error("Situação comercial inválida.");
    const assin = String(p.assin || "").slice(0, 10);
    if (assin && !/^\d{4}-\d{2}-\d{2}$/.test(assin)) throw new Error("Data de assinatura inválida.");
    const prev = Math.max(0, Math.min(100000, Number(p.prev) || 0));
    const obs = String(p.obs || "").slice(0, 300);
    // CARTEIRA EXECUTIVA: GUT (cada eixo 1-5; 0 = não avaliado) e Progresso 0-100. Validação
    // no servidor — a prioridade G×U×T é sempre derivada, nunca gravada.
    const n05 = (v: unknown) => Math.max(0, Math.min(5, Math.round(Number(v) || 0)));
    const gravidade = n05(p.gravidade), urgencia = n05(p.urgencia), tendencia = n05(p.tendencia);
    const impacto = n05(p.impacto), esforco = n05(p.esforco);
    const progresso = Math.max(0, Math.min(100, Math.round(Number(p.progresso) || 0)));
    await sqlite.execute({
      sql: "INSERT INTO projx (cc,com,assin,prev,obs,gravidade,urgencia,tendencia,progresso,impacto,esforco,u,tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(cc) DO UPDATE SET com=?, assin=?, prev=?, obs=?, gravidade=?, urgencia=?, tendencia=?, progresso=?, impacto=?, esforco=?, u=?",
      args: [cc, com, assin, prev, obs, gravidade, urgencia, tendencia, progresso, impacto, esforco, new Date().toISOString(), u.tenant_id,
        com, assin, prev, obs, gravidade, urgencia, tendencia, progresso, impacto, esforco, new Date().toISOString()],
    });
    await audit("projx", u.slug, cc + ": " + (com || "sem situação") + ", previsto " + prev + " h, prioridade " + prioridade100(gravidade, urgencia, tendencia, impacto, esforco) + ", progresso " + progresso + "%", ip);
    return { ok: true };
  }

  if (action === "setproj") {
    /* CARTEIRA EXECUTIVA — edição de gestão num só ponto: status e datas em `proj`, responsável
       e setor em `projx`. Piso 'coordenacao' (guard MIN), tenant-filtrado, auditado. Convive com
       setprazos/setstatus/setprojmeta (preservados); este é o endpoint que o painel de detalhe
       usa para a edição inline. Só grava o que vier definido; campo ausente não é tocado. */
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação edita a gestão do projeto.");
    const cc = String(p.cc || "");
    if (!/^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/.test(cc)) throw new Error("Centro de custo inválido.");
    const agora = new Date().toISOString();
    const dt = (v: unknown) => {
      const s = String(v || "").trim();
      if (!s) return "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Data inválida: " + s);
      return s;
    };
    // --- proj: status, início, previsto, fim (só os campos presentes) ---
    const setsP: string[] = [], argsP: any[] = [];
    if (p.status !== undefined) {
      const status = String(p.status || "");
      if (!STATUSES.includes(status)) throw new Error("Status inválido.");
      setsP.push("status = ?"); argsP.push(status);
    }
    if (p.inicio !== undefined) { setsP.push("inicio = ?"); argsP.push(dt(p.inicio)); }
    if (p.previsto !== undefined) { setsP.push("previsto = ?"); argsP.push(dt(p.previsto)); }
    if (p.fim !== undefined) { setsP.push("fim = ?"); argsP.push(dt(p.fim)); }
    if (setsP.length) {
      setsP.push("alterado_por = ?", "alterado_em = ?"); argsP.push(u.slug, agora);
      const cur = await sqlite.execute({ sql: "SELECT projeto, subtipo, status, registro FROM proj WHERE cc = ? AND tenant_id = ?", args: [cc, u.tenant_id] });
      if (cur.rows.length) {
        await sqlite.execute({ sql: "UPDATE proj SET " + setsP.join(", ") + " WHERE cc = ? AND tenant_id = ?", args: [...argsP, cc, u.tenant_id] });
      } else {
        const b = p.base || {};
        await sqlite.execute({
          sql: "INSERT INTO proj (cc, projeto, subtipo, status, inicio, previsto, fim, registro, alterado_por, alterado_em, tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          args: [cc, String(b.projeto || cc), String(b.subtipo || ""),
            p.status !== undefined ? String(p.status) : String(b.status || "EM ANDAMENTO"),
            p.inicio !== undefined ? dt(p.inicio) : "", p.previsto !== undefined ? dt(p.previsto) : "", p.fim !== undefined ? dt(p.fim) : "",
            String(b.registro || "ATIVO"), u.slug, agora, u.tenant_id],
        });
      }
    }
    // --- projx: responsável, setor (upsert sem apagar com/assin/prev/gut/progresso) ---
    if (p.resp !== undefined || p.setor !== undefined) {
      const resp = String(p.resp || "");
      if (resp && !COLABS.includes(resp)) throw new Error("Responsável desconhecido.");
      const setor = String(p.setor || "");
      if (setor && !SETOR_COD.includes(setor)) throw new Error("Setor inválido.");
      const cols: string[] = [], vals: any[] = [], upds: string[] = [];
      if (p.resp !== undefined) { cols.push("resp"); vals.push(resp); upds.push("resp = ?"); }
      if (p.setor !== undefined) { cols.push("setor"); vals.push(setor); upds.push("setor = ?"); }
      await sqlite.execute({
        sql: "INSERT INTO projx (cc," + cols.join(",") + ",u,tenant_id) VALUES (?," + cols.map(() => "?").join(",") + ",?,?) ON CONFLICT(cc) DO UPDATE SET " + upds.join(", ") + ", u = ?",
        args: [cc, ...vals, agora, u.tenant_id, ...vals, agora],
      });
    }
    await audit("projeto_gestao", u.slug, cc + ": " +
      (p.status !== undefined ? "status " + p.status + " " : "") +
      (p.resp !== undefined ? "resp " + (p.resp || "—") + " " : "") +
      (p.previsto !== undefined ? "previsto " + (p.previsto || "—") : ""), ip);
    return { ok: true, alterado_por: u.slug, alterado_em: agora };
  }

  if (action === "projdetalhe") {
    /* CARTEIRA EXECUTIVA — leitura rica de UM projeto (piso 'equipe'). Devolve proj + projx
       (resp/prev/gut/progresso/obs/setor) + andamento (etapa atual/total, último detalhe e
       histórico) + horas gastas (SUM lanc aprovado/lançado) × previstas (projx.prev) + restantes
       + % de consumo, e a abertura prevista × executada por função (prevf × lanc). Tudo
       tenant-filtrado no servidor. Sem valor monetário — esforço em horas. */
    const u = await auth(p);
    // GESTAO: o detalhe rico (horas por colaborador, GUT, progresso, obs, previsto×gasto) e so
    // da coordenacao/gestao de projeto. Execucao (equipe) fica na lista basica (produtos).
    if (!(await podeGestaoProjeto(u))) throw new Error("O detalhe do projeto é restrito à coordenação. Sua conta vê a lista de projetos e lança as próprias horas.");
    const cc = String(p.cc || "");
    if (!/^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/.test(cc)) throw new Error("Centro de custo inválido.");
    const pr = await sqlite.execute({ sql: "SELECT * FROM proj WHERE cc = ? AND tenant_id = ?", args: [cc, u.tenant_id] });
    if (!pr.rows.length) throw new Error("Projeto não encontrado.");
    const proj = pr.rows[0] as P;
    const pxr = await sqlite.execute({ sql: "SELECT cc, com, assin, prev, obs, setor, resp, gravidade, urgencia, tendencia, progresso, impacto, esforco, contratado, pct_imposto, pct_rateio, pct_lucro, outros, consumiveis, terceiros FROM projx WHERE cc = ? AND tenant_id = ?", args: [cc, u.tenant_id] });
    const px = (pxr.rows[0] as P) || {};
    const andr = await sqlite.execute({ sql: "SELECT id, d, etapa, total, detalhe, slug, criado FROM andam WHERE cc = ? AND tenant_id = ? ORDER BY d DESC, criado DESC LIMIT 50", args: [cc, u.tenant_id] });
    const andam = andr.rows as P[];
    // horas gastas: esforço já aprovado (APROVADO) ou já consolidado (LANÇADO) — ambos são efetivos.
    const gr = await sqlite.execute({ sql: "SELECT COALESCE(SUM(h),0) AS g FROM lanc WHERE cc = ? AND tenant_id = ? AND s IN ('APROVADO','LANÇADO')", args: [cc, u.tenant_id] });
    const gastas = Math.round((Number((gr.rows[0] as P).g) || 0) * 10) / 10;
    const prev = Math.round((Number(px.prev) || 0) * 10) / 10;
    const restantes = Math.round((prev - gastas) * 10) / 10;
    const consumo = prev > 0 ? Math.round((gastas / prev) * 1000) / 10 : null; // % (1 casa)
    // previsto × executado por função (base já existente)
    const pf = await sqlite.execute({ sql: "SELECT func, h FROM prevf WHERE cc = ? AND tenant_id = ?", args: [cc, u.tenant_id] });
    const gut = (Number(px.gravidade) || 0) * (Number(px.urgencia) || 0) * (Number(px.tendencia) || 0);
    const prioridade = prioridade100(px.gravidade, px.urgencia, px.tendencia, px.impacto, px.esforco);
    /* HORAS POR COLABORADOR (não monetário: visível a todo papel que abre o detalhe) +
       FINANCEIRO (monetário: SÓ o dono). O custo/hora e a decomposição só entram quando isOwner. */
    const podeFin = isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.ver");
    const chMap = podeFin ? await custoHoraMap(u.tenant_id) : {};
    // Com R$: custo por colaborador = soma dos apontamentos × taxa vigente na data de cada um
    // (histórico preservado). custoHora exibido = taxa ATUAL do colaborador (referência).
    const colab = podeFin
      ? (await horasCustoPorColab(cc, u.tenant_id)).map((c) => ({ slug: c.slug, nome: NOMES[c.slug] || c.slug, h: c.h, custoHora: chMap[c.slug] || 0, custo: c.custo }))
      : (await horasPorColab(cc, u.tenant_id)).map((c) => ({ slug: c.slug, nome: NOMES[c.slug] || c.slug, h: c.h }));
    const rfp = podeFin ? await rateioFixosCarteira(u.tenant_id) : { fixosTotal: 0, byCc: {} as Record<string, number>, horasBase: 0 };
    const fin = podeFin ? decompoeFin(px, (colab as any[]).reduce((s, c) => s + (c.custo || 0), 0), rfp.byCc[cc] || 0) : null;
    // HISTÓRICO DE HORAS do projeto: cada apontamento efetivo (aprovado/lançado) com o que foi
    // feito (lanc.t). Em importados o `t` costuma vir vazio — o front exibe "—" quando não houver.
    const lcr = await sqlite.execute({ sql: "SELECT d, slug, h, t FROM lanc WHERE cc = ? AND tenant_id = ? AND s IN ('APROVADO','LANÇADO') ORDER BY d DESC LIMIT 300", args: [cc, u.tenant_id] });
    const lancs = (lcr.rows as P[]).map((x) => ({ d: String(x.d || ""), slug: String(x.slug || ""), nome: NOMES[String(x.slug)] || String(x.slug), h: Math.round((Number(x.h) || 0) * 10) / 10, t: String(x.t || "") }));
    // etapa atual/total: o andamento mais recente que informou etapas
    let etapaAtual = 0, etapaTotal = 0, ultimoDetalhe = "", ultimaData = "";
    for (const a of andam) {
      if (!ultimoDetalhe && a.detalhe) { ultimoDetalhe = String(a.detalhe); ultimaData = String(a.d); }
      if ((Number(a.total) || 0) > 0 || (Number(a.etapa) || 0) > 0) { etapaAtual = Number(a.etapa) || 0; etapaTotal = Number(a.total) || 0; break; }
    }
    return {
      ok: true, coord: u.coord, cc,
      proj: {
        cc: proj.cc, projeto: proj.projeto, subtipo: proj.subtipo || "", status: proj.status || "",
        inicio: proj.inicio || "", previsto: proj.previsto || "", fim: proj.fim || "",
        empresa: proj.empresa || "", cliente: proj.cliente || "", tipo: proj.tipo || "",
        liberado_cliente: Number(proj.liberado_cliente) || 0,
        alterado_por: proj.alterado_por || "", alterado_em: proj.alterado_em || "",
      },
      projx: {
        resp: px.resp || "", setor: px.setor || "", com: px.com || "", assin: px.assin || "",
        obs: px.obs || "", prev,
        gravidade: Number(px.gravidade) || 0, urgencia: Number(px.urgencia) || 0,
        tendencia: Number(px.tendencia) || 0, impacto: Number(px.impacto) || 0, esforco: Number(px.esforco) || 0,
        gut, prioridade, progresso: Number(px.progresso) || 0,
        // Entradas financeiras SÓ vão para o front quando isOwner (não vazam R$ para outros papéis).
        ...(podeFin ? {
          contratado: Number(px.contratado) || 0, pct_imposto: Number(px.pct_imposto) || 0,
          pct_rateio: Number(px.pct_rateio) || 0, pct_lucro: Number(px.pct_lucro) || 0,
          outros: Number(px.outros) || 0, consumiveis: Number(px.consumiveis) || 0, terceiros: Number(px.terceiros) || 0,
        } : {}),
      },
      horas: { gastas, previstas: prev, restantes, consumo, estouro: prev > 0 && gastas > prev },
      etapa: { atual: etapaAtual, total: etapaTotal, ultimoDetalhe, ultimaData },
      andam, prevf: pf.rows, lancs,
      colab, podeFin, fin,
    };
  }
  /* APONTAMENTOS DE OUTRO COLABORADOR (seletor da aba Horas): histórico COMPLETO de um colega,
     para coordenação/dono. O servidor é a fronteira — equipe/cliente são negados aqui (o MIN
     exige coordenacao; e reconfirmamos coord||owner). Só leitura; não edita horas de ninguém. */
  if (action === "lancColab") {
    const u = await auth(p);
    if (!(u.coord || isOwner(u.slug))) throw new Error("Ver apontamentos de outro colaborador é restrito à coordenação.");
    const alvo = String(p.slug || "").trim();
    if (!alvo) throw new Error("Colaborador não informado.");
    const r = await sqlite.execute({ sql: "SELECT id, slug, d, cc, h, t, s, m, a, c FROM lanc WHERE slug = ? AND tenant_id = ?", args: [alvo, u.tenant_id] });
    return { ok: true, slug: alvo, lanc: r.rows };
  }

  /* ===== FINANCEIRO (admin-only, dono) ===== */
  if (action === "custohoraList") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.ver"))) throw new Error("Acesso ao financeiro restrito à direção ou coordenação financeira.");
    const m = await custoHoraMap(u.tenant_id); // taxa ATUAL (vigência mais recente)
    // Roster interno (quadro `membro`), com fallback ao COLABS legado se a tabela vier vazia.
    const mr = await sqlite.execute({ sql: "SELECT slug, nome, ativo FROM membro WHERE tenant_id = ? AND papel NOT IN ('cliente','fornecedor') ORDER BY ativo DESC, nome", args: [u.tenant_id] });
    const roster = (mr.rows as P[]).length
      ? (mr.rows as P[]).map((x) => ({ slug: String(x.slug), nome: String(x.nome || x.slug), inativo: Number(x.ativo) ? false : true }))
      : COLABS.map((s) => ({ slug: s, nome: NOMES[s] || s, inativo: INATIVOS.includes(s) }));
    // Histórico de vigências (todas), por colaborador, mais recente primeiro.
    const vr = await sqlite.execute({ sql: "SELECT slug, desde, valor, motivo FROM custohora_vig WHERE tenant_id = ? ORDER BY slug, desde DESC", args: [u.tenant_id] });
    const vig: Record<string, P[]> = {};
    for (const x of vr.rows as P[]) (vig[String(x.slug)] = vig[String(x.slug)] || []).push({ desde: String(x.desde), valor: Number(x.valor) || 0, motivo: String(x.motivo || "") });
    const lista = roster.map((r) => ({ slug: r.slug, nome: r.nome, inativo: r.inativo, valor: m[r.slug] || 0, vigencias: vig[r.slug] || [] }));
    return { ok: true, custos: lista };
  }
  if (action === "custohoraSet") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.editar"))) throw new Error("Edição do financeiro restrita à direção ou coordenação financeira.");
    const slug = String(p.slug || "");
    const ex = await sqlite.execute({ sql: "SELECT slug FROM membro WHERE tenant_id = ? AND slug = ? LIMIT 1", args: [u.tenant_id, slug] });
    if (!ex.rows.length && !COLABS.includes(slug)) throw new Error("Colaborador desconhecido.");
    const valor = Math.max(0, Number(p.valor) || 0);
    // `desde` = data a partir da qual a taxa vale (YYYY-MM-DD). Default: hoje. Apontamentos
    // anteriores a essa data mantêm a taxa de vigência anterior (histórico preservado).
    let desde = String(p.desde || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) desde = new Date().toISOString().slice(0, 10);
    const motivo = String(p.motivo || "").slice(0, 120).trim();
    const now = new Date().toISOString();
    await sqlite.execute({
      sql: "INSERT INTO custohora_vig (tenant_id, slug, desde, valor, motivo, u, criado) VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id, slug, desde) DO UPDATE SET valor=excluded.valor, motivo=excluded.motivo, u=excluded.u, criado=excluded.criado",
      args: [u.tenant_id, slug, desde, valor, motivo, u.slug, now],
    });
    await audit("custohora", u.slug, slug + "=" + valor + " desde " + desde + (motivo ? " (" + motivo + ")" : ""), ip);
    return { ok: true, slug, valor, desde };
  }
  if (action === "custohoraDel") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.editar"))) throw new Error("Edição do financeiro restrita à direção ou coordenação financeira.");
    const slug = String(p.slug || ""); const desde = String(p.desde || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) throw new Error("Vigência inválida.");
    await sqlite.execute({ sql: "DELETE FROM custohora_vig WHERE tenant_id = ? AND slug = ? AND desde = ?", args: [u.tenant_id, slug, desde] });
    await audit("custohora", u.slug, slug + " removeu vigência " + desde, ip);
    return { ok: true };
  }
  if (action === "projfinSet") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.editar"))) throw new Error("Edição do financeiro restrita à direção ou coordenação financeira.");
    const cc = String(p.cc || ""); if (!/^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/.test(cc)) throw new Error("Centro de custo inválido.");
    const contratado = Math.max(0, Number(p.contratado) || 0);
    const pct_imposto = Math.max(0, Math.min(100, Number(p.pct_imposto) || 0));
    const pct_rateio = Math.max(0, Math.min(1000, Number(p.pct_rateio) || 0));
    const pct_lucro = Math.max(0, Math.min(100, Number(p.pct_lucro) || 0));
    const outros = Math.max(0, Number(p.outros) || 0);
    const consumiveis = Math.max(0, Number(p.consumiveis) || 0);
    const terceiros = Math.max(0, Number(p.terceiros) || 0);
    // projx é chaveada por cc; pode ainda não haver linha para este cc → upsert. tenant_id só
    // é gravado na inserção (no update não se toca, preservando o tenant do dono do registro).
    await sqlite.execute({
      sql: "INSERT INTO projx (cc, tenant_id, contratado, pct_imposto, pct_rateio, pct_lucro, outros, consumiveis, terceiros, fin_u) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(cc) DO UPDATE SET contratado=excluded.contratado, pct_imposto=excluded.pct_imposto, pct_rateio=excluded.pct_rateio, pct_lucro=excluded.pct_lucro, outros=excluded.outros, consumiveis=excluded.consumiveis, terceiros=excluded.terceiros, fin_u=excluded.fin_u",
      args: [cc, u.tenant_id, contratado, pct_imposto, pct_rateio, pct_lucro, outros, consumiveis, terceiros, u.slug],
    });
    await audit("projfin", u.slug, cc + " contratado=" + contratado, ip);
    return { ok: true, cc };
  }
  if (action === "financeiro") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.ver"))) throw new Error("Acesso ao financeiro restrito à direção ou coordenação financeira.");
    // mão de obra por cc: cada apontamento × a taxa de custo/hora VIGENTE na sua data (histórico preservado).
    const hr = await sqlite.execute({ sql: "SELECT l.cc, COALESCE(SUM(l.h * " + CH_VIGENTE_SQL + "),0) AS mo FROM lanc l WHERE l.tenant_id = ? AND l.s IN ('APROVADO','LANÇADO') GROUP BY l.cc", args: [u.tenant_id] });
    const moByCc: Record<string, number> = {};
    for (const x of hr.rows as P[]) moByCc[String(x.cc)] = Number(x.mo) || 0;
    const pxr = await sqlite.execute({ sql: "SELECT cc, contratado, pct_imposto, pct_rateio, pct_lucro, outros, consumiveis, terceiros FROM projx WHERE tenant_id = ?", args: [u.tenant_id] });
    const pxByCc: Record<string, P> = {}; for (const x of pxr.rows as P[]) pxByCc[String(x.cc)] = x;
    const prr = await sqlite.execute({ sql: "SELECT cc, projeto, cliente, status FROM proj WHERE tenant_id = ? AND registro = 'ATIVO'", args: [u.tenant_id] });
    const rf = await rateioFixosCarteira(u.tenant_id);
    const rows: P[] = [];
    for (const pr of prr.rows as P[]) {
      const cc = String(pr.cc); const px = pxByCc[cc] || {};
      const d = decompoeFin(px, moByCc[cc] || 0, rf.byCc[cc] || 0);
      if (d.contratado <= 0) continue; // carteira = só projetos com valor contratado informado
      rows.push({ cc, projeto: pr.projeto, cliente: pr.cliente || "", status: pr.status || "", ...d });
    }
    rows.sort((a: any, b: any) => (a.margem - b.margem)); // prejuízo/menor margem primeiro
    const tot = rows.reduce((s: any, r: any) => ({ contratado: s.contratado + r.contratado, custoTotal: s.custoTotal + r.custoTotal, margem: s.margem + r.margem }), { contratado: 0, custoTotal: 0, margem: 0 });
    return { ok: true, projetos: rows, total: { contratado: arred2(tot.contratado), custoTotal: arred2(tot.custoTotal), margem: arred2(tot.margem) }, overhead: { total: rf.fixosTotal, horasBase: rf.horasBase } };
  }
  /* CUSTOS FIXOS / OVERHEAD — pool editável rateado por horas (Onda 2). Leitura restrita. */
  if (action === "custoFixoList") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.ver"))) throw new Error("Acesso ao financeiro restrito à direção ou coordenação financeira.");
    const r = await sqlite.execute({ sql: "SELECT id, categoria, descricao, valor, u, criado, atualizado FROM custo_fixo WHERE tenant_id = ? ORDER BY categoria, criado", args: [u.tenant_id] });
    const total = (r.rows as P[]).reduce((s, x) => s + (Number(x.valor) || 0), 0);
    const rf = await rateioFixosCarteira(u.tenant_id);
    return { ok: true, fixos: r.rows, total: arred2(total), horasBase: rf.horasBase };
  }
  if (action === "custoFixoSet") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.editar"))) throw new Error("Edição do financeiro restrita à direção ou coordenação financeira.");
    let id = String(p.id || "").trim(); const isNew = !id;
    if (isNew) id = "CF-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    const cats = ["comercial", "financeiro", "administrativo", "rh", "aluguel", "juridico", "relacoes_institucionais", "outros"];
    let categoria = String(p.categoria || "outros").trim().toLowerCase(); if (!cats.includes(categoria)) categoria = "outros";
    const valor = Math.max(0, Number(p.valor) || 0);
    const descricao = String(p.descricao || "").slice(0, 200);
    const now = new Date().toISOString();
    await sqlite.execute({
      sql: "INSERT INTO custo_fixo (id,tenant_id,categoria,descricao,valor,u,criado,atualizado) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET categoria=excluded.categoria,descricao=excluded.descricao,valor=excluded.valor,u=excluded.u,atualizado=excluded.atualizado",
      args: [id, u.tenant_id, categoria, descricao, valor, u.slug, now, now],
    });
    await audit("custo_fixo", u.slug, (isNew ? "novo " : "edit ") + id + " " + categoria + " " + valor, ip);
    return { ok: true, id, isNew };
  }
  if (action === "custoFixoDel") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.editar"))) throw new Error("Edição do financeiro restrita à direção ou coordenação financeira.");
    const id = String(p.id || "").trim(); if (!id) throw new Error("ID do custo fixo ausente.");
    await sqlite.execute({ sql: "DELETE FROM custo_fixo WHERE tenant_id = ? AND id = ?", args: [u.tenant_id, id] });
    await audit("custo_fixo", u.slug, "excluiu " + id, ip);
    return { ok: true };
  }
  /* CAPACIDADE × APONTADO — horas extras / déficit por colaborador e mês (derivado do lanc). Leitura restrita. */
  if (action === "capacidade") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.ver"))) throw new Error("Acesso ao financeiro restrito à direção ou coordenação financeira.");
    const pessoas = await capacidadeApontado(u.tenant_id);
    return { ok: true, pessoas };
  }
  /* RESUMO EXECUTIVO — consolidado ao vivo (financeiro + pipeline + horas + fluxo). Leitura
     restrita ao dono / coord. financeira. Devolve também o último snapshot materializado. */
  if (action === "resumoExec") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.ver"))) throw new Error("Acesso ao financeiro restrito à direção ou coordenação financeira.");
    const resumo = await resumoExecutivo(u.tenant_id);
    const snap = await sqlite.execute({ sql: "SELECT id, d, autor, criado FROM fin_snapshot WHERE tenant_id = ? ORDER BY criado DESC LIMIT 1", args: [u.tenant_id] });
    return { ok: true, resumo, ultimoSnapshot: snap.rows[0] || null };
  }
  /* RESUMO EXECUTIVO — MATERIALIZAR: fecha o retrato de hoje e grava como snapshot datado
     (fin_snapshot) com autor e data. Registra `resumo_exec` na auditoria (rastreabilidade). */
  if (action === "resumoExecFechar") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.editar"))) throw new Error("Materialização do resumo restrita à direção ou coordenação financeira.");
    const resumo = await resumoExecutivo(u.tenant_id);
    const d = now.slice(0, 10);
    const id = "FS-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    await sqlite.execute({ sql: "INSERT INTO fin_snapshot (id, tenant_id, d, dados, autor, criado) VALUES (?,?,?,?,?,?)", args: [id, u.tenant_id, d, JSON.stringify(resumo), u.slug, now] });
    await audit("resumo_exec", u.slug, "materializou snapshot " + d + " margem=" + resumo.fin.margem, ip);
    return { ok: true, id, d, resumo };
  }
  /* RESUMO EXECUTIVO — histórico dos snapshots materializados (para a linha do tempo). */
  if (action === "resumoExecHist") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.ver"))) throw new Error("Acesso ao financeiro restrito à direção ou coordenação financeira.");
    const r = await sqlite.execute({ sql: "SELECT id, d, dados, autor, criado FROM fin_snapshot WHERE tenant_id = ? ORDER BY criado DESC LIMIT 60", args: [u.tenant_id] });
    const snapshots = (r.rows as P[]).map((x) => ({ id: x.id, d: x.d, autor: x.autor, criado: x.criado, dados: (() => { try { return JSON.parse(String(x.dados || "{}")); } catch (_) { return {}; } })() }));
    return { ok: true, snapshots };
  }
  /* FLUXO DE CAIXA — listar lançamentos + resumo (previsto × realizado). Leitura restrita. */
  if (action === "fluxoList") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.ver"))) throw new Error("Acesso ao financeiro restrito à direção ou coordenação financeira.");
    const r = await sqlite.execute({ sql: "SELECT id, tipo, categoria, descricao, cc, valor, data_prev, data_real, status, origem, u, criado, atualizado FROM fluxo WHERE tenant_id = ? ORDER BY COALESCE(NULLIF(data_prev,''), data_real, criado) ASC, criado ASC", args: [u.tenant_id] });
    const rows = r.rows as P[];
    let ep = 0, sp = 0, er = 0, sr = 0;
    for (const x of rows) { const v = Number(x.valor) || 0; const st = String(x.status); const entrada = String(x.tipo) === "entrada"; if (st === "realizado") { entrada ? (er += v) : (sr += v); } else if (st === "previsto") { entrada ? (ep += v) : (sp += v); } }
    return { ok: true, fluxos: rows, resumo: { entradaPrev: arred2(ep), saidaPrev: arred2(sp), entradaReal: arred2(er), saidaReal: arred2(sr), saldoPrev: arred2(ep - sp), saldoReal: arred2(er - sr) } };
  }
  /* FLUXO DE CAIXA — criar / editar lançamento. Upsert por id. Grava `fluxo` na auditoria. */
  if (action === "fluxoSet") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.editar"))) throw new Error("Edição do financeiro restrita à direção ou coordenação financeira.");
    let id = String(p.id || "").trim(); const isNew = !id;
    if (isNew) id = "FX-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    const tipo = String(p.tipo || "entrada") === "saida" ? "saida" : "entrada";
    const st0 = String(p.status || "previsto"); const status = (st0 === "realizado" || st0 === "cancelado") ? st0 : "previsto";
    const valor = Math.max(0, Number(p.valor) || 0);
    const g = (k: string, n = 200) => String(p[k] == null ? "" : p[k]).slice(0, n);
    const dt = (k: string) => { const s = String(p[k] || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; };
    const cc = g("cc", 40); if (cc && !/^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/.test(cc)) throw new Error("Centro de custo inválido.");
    const descricao = g("descricao", 300); if (descricao.length < 2) throw new Error("Informe uma descrição do lançamento.");
    await sqlite.execute({
      sql: "INSERT INTO fluxo (id,tenant_id,tipo,categoria,descricao,cc,valor,data_prev,data_real,status,origem,u,criado,atualizado) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
        + "ON CONFLICT(id) DO UPDATE SET tipo=excluded.tipo,categoria=excluded.categoria,descricao=excluded.descricao,cc=excluded.cc,valor=excluded.valor,data_prev=excluded.data_prev,data_real=excluded.data_real,status=excluded.status,u=excluded.u,atualizado=excluded.atualizado",
      args: [id, u.tenant_id, tipo, g("categoria", 80), descricao, cc, valor, dt("data_prev"), dt("data_real"), status, g("origem", 40) || "manual", u.slug, now, now],
    });
    await audit("fluxo", u.slug, (isNew ? "novo " : "edit ") + id + " " + tipo + " " + valor + " " + status, ip);
    return { ok: true, id, isNew };
  }
  /* FLUXO DE CAIXA — excluir lançamento. Grava `fluxo` na auditoria. */
  if (action === "fluxoDel") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.editar"))) throw new Error("Edição do financeiro restrita à direção ou coordenação financeira.");
    const id = String(p.id || "").trim(); if (!id) throw new Error("ID do lançamento ausente.");
    await sqlite.execute({ sql: "DELETE FROM fluxo WHERE tenant_id = ? AND id = ?", args: [u.tenant_id, id] });
    await audit("fluxo", u.slug, "excluiu " + id, ip);
    return { ok: true };
  }
  /* FLUXO DE CAIXA — atribuir CENTRO DE CUSTO a um ou vários lançamentos (liga o caixa ao projeto).
     Atualiza só o cc (não mexe nos demais campos). cc vazio = desliga. Auditado. Manual: o vínculo
     é definido pela gestão, nunca inferido. Aceita id (um) ou ids[] (lote, até 500 por chamada). */
  if (action === "fluxoCc") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "financeiro.editar"))) throw new Error("Edição do financeiro restrita à direção ou coordenação financeira.");
    const cc = String(p.cc || "").trim();
    if (cc && !/^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/.test(cc)) throw new Error("Centro de custo inválido.");
    let ids: string[] = [];
    if (Array.isArray(p.ids)) ids = (p.ids as any[]).map((x) => String(x || "").trim()).filter(Boolean);
    else if (p.id) ids = [String(p.id).trim()];
    ids = Array.from(new Set(ids)).slice(0, 500);
    if (!ids.length) throw new Error("Nenhum lançamento informado.");
    const now = new Date().toISOString();
    await sqlite.execute({ sql: "UPDATE fluxo SET cc = ?, u = ?, atualizado = ? WHERE tenant_id = ? AND id IN (" + ids.map(() => "?").join(",") + ")", args: [cc, u.slug, now, u.tenant_id, ...ids] });
    await audit("fluxo", u.slug, "cc=" + (cc || "(limpo)") + " em " + ids.length + " lançamento(s)", ip);
    return { ok: true, n: ids.length, cc };
  }

  /* ===== ACERVO — navegar pastas do bucket-fonte (abrir arquivo é a rota POST /acervo/arquivo) ===== */
  if (action === "acervo_list") {
    const u = await auth(p);
    const acok = isOwner(u.slug) || grantValid(await cfgGet("acgrant:" + u.slug)) || temCapSet(await capsAtribuidas(u), "acervo.consultar");
    if (!acok) throw new Error("Sem acesso ao acervo. Peça liberação ao dono do portal.");
    let prefix = String(p.prefix || "").replace(/^\/+/, "");
    if (prefix && !prefix.endsWith("/")) prefix += "/";
    if (prefix.includes("..")) throw new Error("Caminho inválido.");
    if (!ENV.ACERVO) return { ok: true, prefix, pastas: [], arquivos: [] };
    const r: any = await ENV.ACERVO.list({ prefix, delimiter: "/", limit: 1000 });
    const pastas = (r.delimitedPrefixes || []).map((pp: string) => ({ prefix: pp, nome: pp.slice(prefix.length).replace(/\/$/, "") }));
    const arquivos = (r.objects || []).filter((o: any) => o.key !== prefix).map((o: any) => ({ key: o.key, nome: o.key.slice(prefix.length), tam: o.size || 0 }));
    return { ok: true, prefix, pastas, arquivos };
  }

  if (action === "andamento") {
    const u = await auth(p);
    if (!(await podeGestaoProjeto(u))) throw new Error("O andamento dos projetos é restrito à coordenação.");
    const cc = String(p.cc || "");
    const r = cc
      ? await sqlite.execute({ sql: "SELECT * FROM andam WHERE cc = ? AND tenant_id = ? ORDER BY d DESC, criado DESC", args: [cc, u.tenant_id] })
      : await sqlite.execute({ sql: "SELECT * FROM andam WHERE tenant_id = ? ORDER BY d DESC LIMIT 300", args: [u.tenant_id] });
    return { ok: true, andam: r.rows };
  }

  if (action === "addandam") {
    const u = await auth(p);
    if (!(await podeGestaoProjeto(u))) throw new Error("Registrar andamento é restrito à coordenação.");
    const cc = String(p.cc || "");
    if (!/^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/.test(cc)) throw new Error("Centro de custo inválido.");
    const d = String(p.d || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Informe a data do avanço.");
    const etapa = Math.max(0, Math.min(99, Number(p.etapa) || 0));
    const total = Math.max(0, Math.min(99, Number(p.total) || 0));
    const detalhe = String(p.detalhe || "").slice(0, 500).trim();
    if (!detalhe && !etapa) throw new Error("Descreva o avanço ou informe a etapa.");
    if (total && etapa > total) throw new Error("A etapa não pode ser maior que o total de etapas.");
    const id = "an" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const agora = new Date().toISOString();
    await sqlite.execute({
      sql: "INSERT INTO andam (id,cc,d,etapa,total,detalhe,slug,criado,tenant_id) VALUES (?,?,?,?,?,?,?,?,?)",
      args: [id, cc, d, etapa, total, detalhe, u.slug, agora, u.tenant_id],
    });
    await audit("andamento_add", u.slug, cc + ": etapa " + etapa + "/" + total, ip);
    return { ok: true, id };
  }

  if (action === "delandam") {
    const u = await auth(p);
    if (!(await podeGestaoProjeto(u))) throw new Error("Excluir andamento é restrito à coordenação.");
    const id = String(p.id || "");
    const r = await sqlite.execute({ sql: "SELECT cc, slug FROM andam WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    if (!r.rows.length) throw new Error("Registro não encontrado.");
    const dono = String((r.rows[0] as P).slug);
    if (!u.coord && dono !== u.slug) throw new Error("Só a Coordenação ou quem registrou pode excluir.");
    await sqlite.execute({ sql: "DELETE FROM andam WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    await audit("andamento_del", u.slug, String((r.rows[0] as P).cc), ip);
    return { ok: true };
  }

  if (action === "produtos") {
    const u = await auth(p);
    const r = await sqlite.execute({ sql: "SELECT n, titulo, tipo, sit, met, norma, apr, sec, ccs FROM prod WHERE tenant_id = ? ORDER BY n", args: [u.tenant_id] });
    return { ok: true, prod: r.rows };
  }

  if (action === "hub") {
    // T4 — porta de entrada. A LIBERACAO vem do SERVIDOR (auth + MIN + recortes finos),
    // nunca de flag de front. Piso 'cliente' no MIN: todo logado pode pedir o proprio Hub.
    // Confidencialidade por tenant preservada: tudo deriva do papel/tenant de auth().
    const u = await auth(p);
    const modulos = await modulosLiberados({ slug: u.slug, papel: u.papel });
    /* Capabilities efetivas do usuario (modelo por cargo). Exposto para o front comecar a
     * decidir por ACAO; nesta fase o gate real ainda e o guard MIN (migracao aditiva). */
    const caps = [...(await capsDe({ slug: u.slug, papel: u.papel }))];
    return {
      ok: true, slug: u.slug, nome: NOMES[u.slug] || u.slug, papel: u.papel,
      papelLabel: PAPEL_LABEL[u.papel] || u.papel, coord: u.coord,
      owner: isOwner(u.slug), tenant: u.tenant_id, modulos, caps,
    };
  }

  /* ============================================================================
   * T6 — PERFIL & CONTA (acoes da PROPRIA conta do usuario logado)
   * --------------------------------------------------------------------------
   * Construido SOBRE T1 (membro/papel/tenant) e T5 (hashSenha/salt/validSenha; e-mail como
   * identidade de login). Travas da casa cravadas AQUI, no servidor:
   *  - SENHA e SEMPRE do usuario: 'trocarsenha' exige a senha ATUAL e so o proprio troca a
   *    propria senha. O executor NUNCA cria/digita/redefine senha de ninguem; redefinir
   *    senha de OUTRO segue sendo so 'resetpin' (coordenacao, T5), intacto.
   *  - PAPEL e READ-ONLY: 'perfil' DEVOLVE o papel; nenhuma acao de conta o ESCREVE.
   *    'contaSalvar' RECUSA no servidor qualquer tentativa de autopromocao — a mudanca de
   *    papel so sobe pela via T7 (coordenacao/admin).
   *  - E-mail reusa a regra da T5 (formato + recusa de duplicado + espelho em membro +
   *    auditoria 'email_alterado'), sem tocar o branch 'setemail' da coordenacao.
   *  - Confidencialidade por tenant: tudo filtra/grava por u.tenant_id.
   * ========================================================================== */
  if (action === "perfil") {
    const u = await auth(p);
    const emCfg = (await cfgGet("email:" + u.slug)) || "";
    let nome = NOMES[u.slug] || u.slug, avatar = "", emMembro = "";
    try {
      const r = await sqlite.execute({ sql: "SELECT nome, email, avatar FROM membro WHERE slug = ? AND tenant_id = ? LIMIT 1", args: [u.slug, u.tenant_id] });
      if (r.rows.length) {
        const row = r.rows[0] as P;
        if (row.nome) nome = String(row.nome);
        emMembro = String(row.email || "");
        avatar = String(row.avatar || "");
      }
    } catch (_) { /* membro/coluna ainda nao materializada: casca minima */ }
    return {
      ok: true, slug: u.slug, nome, email: emCfg || emMembro,
      papel: u.papel, papelLabel: PAPEL_LABEL[u.papel] || u.papel,
      coord: u.coord, owner: isOwner(u.slug), tenant: u.tenant_id,
      avatar, temSenha: !!(await cfgGet("pin:" + u.slug)), avatarMax: AVATAR_MAX,
    };
  }

  if (action === "trocarsenha") {
    // Troca da PROPRIA senha: exige a senha ATUAL; quem define a nova e SEMPRE o usuario.
    // Mesmas primitivas da T5 (hashSenha salgado + validSenha). Rate-limit como no login.
    const u = await auth(p);
    await checkLocks(u.slug, ip);
    const atual = String(p.atual || ""), senha = String(p.senha || ""), senha2 = String(p.senha2 || "");
    const saved = await cfgGet("pin:" + u.slug);
    if (!saved) throw new Error("Senha ainda não cadastrada para esta conta.");
    if (!(await verificaSenha(u.slug, atual, saved))) {
      await regFail("fail:" + u.slug);
      await regFail("failip:" + ip);
      await audit("senha_troca_negada", u.slug, "senha atual incorreta", ip);
      throw new Error("A senha atual está incorreta.");
    }
    validSenha(senha);
    if (senha !== senha2) throw new Error("As senhas não conferem.");
    if (await verificaSenha(u.slug, senha, saved)) throw new Error("A nova senha deve ser diferente da atual.");
    await cfgSet("pin:" + u.slug, await hashSenhaNova(u.slug, senha));
    await cfgDel("fail:" + u.slug);
    // Seguranca: derruba as OUTRAS sessoes do usuario; mantem a atual (a que trocou a senha).
    await sqlite.execute({ sql: "DELETE FROM sess WHERE slug = ? AND tenant_id = ? AND token <> ?", args: [u.slug, TENANT_INTELECTO, String(p.token || "")] });
    await audit("senha_alterada", u.slug, "troca pelo proprio usuario", ip);
    return { ok: true };
  }

  if (action === "contaSalvar") {
    // Dados editaveis pelo PROPRIO: nome de exibicao e e-mail. PAPEL e READ-ONLY —
    // autopromocao e NEGADA aqui no servidor (papel so sobe pela via T7, coordenacao/admin).
    const u = await auth(p);
    if (p.papel !== undefined && String(p.papel) !== u.papel) {
      await audit("papel_autopromocao_negada", u.slug, "tentou papel:" + String(p.papel).slice(0, 20) + " (negado; via T7)", ip);
      throw new Error("O papel não pode ser alterado pela própria conta — a mudança de papel é feita pela Coordenação.");
    }
    const nome = String(p.nome || "").trim().slice(0, 80);
    if (nome) {
      try { await sqlite.execute({ sql: "UPDATE membro SET nome = ?, u = ? WHERE slug = ? AND tenant_id = ?", args: [nome, now, u.slug, u.tenant_id] }); } catch (_) { /* sem linha de membro: nome fica o de NOMES */ }
    }
    if (p.email !== undefined) {
      const em = String(p.email || "").trim();
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error("E-mail inválido.");
      const atualEmail = (await cfgGet("email:" + u.slug)) || "";
      if (em.toLowerCase() !== atualEmail.toLowerCase()) {
        // Mesma regra da T5 'setemail': o e-mail e identidade de login — nao pode colidir.
        if (em) {
          const dup = await sqlite.execute({ sql: "SELECT k FROM config WHERE k LIKE 'email:%' AND lower(v) = ? AND k <> ? AND tenant_id = ? LIMIT 1", args: [em.toLowerCase(), "email:" + u.slug, TENANT_INTELECTO] });
          if (dup.rows.length) throw new Error("Este e-mail já está vinculado a outra pessoa.");
          await cfgSet("email:" + u.slug, em);
        } else {
          await cfgDel("email:" + u.slug);
        }
        try { await sqlite.execute({ sql: "UPDATE membro SET email = ? WHERE slug = ? AND tenant_id = ?", args: [em, u.slug, u.tenant_id] }); } catch (_) { /* coluna de membro criada em ensureSchema */ }
        await audit("email_alterado", u.slug, "alvo:" + u.slug + " " + (em ? "definido" : "removido") + " (propria conta) tenant:" + u.tenant_id, ip);
      }
    }
    return { ok: true };
  }

  if (action === "contaAvatar") {
    // Avatar persistido por tenant_id+slug na propria linha de membro. Imagem PEQUENA como
    // data URL (sem upload externo): valida formato e tamanho no SERVIDOR. '' remove a foto.
    const u = await auth(p);
    const raw = String(p.avatar || "").trim();
    if (raw) {
      if (!/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(raw)) throw new Error("Formato de imagem inválido. Envie PNG, JPG, WEBP ou GIF.");
      if (raw.length > AVATAR_MAX) throw new Error("A imagem é grande demais (limite de 64 KB). Escolha uma menor ou reduza a resolução.");
    }
    // Upsert com o papel JA resolvido por auth() (nunca o default) — a foto se grava mesmo
    // sem linha previa, sem abrir brecha de autopromocao de papel.
    await sqlite.execute({
      sql: "INSERT INTO membro (tenant_id, slug, papel, nome, ativo, criado, avatar) VALUES (?,?,?,?,1,?,?) " +
        "ON CONFLICT(tenant_id, slug) DO UPDATE SET avatar = excluded.avatar, u = ?",
      args: [u.tenant_id, u.slug, u.papel, NOMES[u.slug] || u.slug, now.slice(0, 10), raw, now],
    });
    await audit("avatar_alterado", u.slug, raw ? "definido" : "removido", ip);
    return { ok: true, avatar: raw };
  }

  if (action === "state") {
    const u = await auth(p);
    // Coordenacao sempre ve todo PENDENTE (nunca sumir sem revisar), mas o ja aprovado/lancado
    // mais antigo que 120 dias fica de fora do carregamento inicial — com o historico importado
    // em 2026-09-23 (4663 linhas), mandar a tabela inteira toda vez levava ~1,2 MB e 2s por login.
    const lanc = u.coord
      ? await sqlite.execute({ sql: "SELECT id, slug, d, cc, h, t, s, m, a, c FROM lanc WHERE tenant_id = ? AND (s = 'PENDENTE' OR d >= date('now','-120 days'))", args: [u.tenant_id] })
      : await sqlite.execute({ sql: "SELECT id, slug, d, cc, h, t, s, m, a, c FROM lanc WHERE slug = ? AND tenant_id = ?", args: [u.slug, u.tenant_id] });
    /* Propostas pendentes (PROPOSTO) e rejeitadas (REJEITADO) NAO entram na carteira global —
     * ficam so na fila do aprovador (acao `projpropostas`). Carrega todo o resto. */
    const proj = await sqlite.execute({ sql: "SELECT * FROM proj WHERE tenant_id = ? AND (registro IS NULL OR registro NOT IN ('PROPOSTO','REJEITADO'))", args: [u.tenant_id] });
    const cont = await sqlite.execute({ sql: "SELECT * FROM conteudo WHERE tenant_id = ?", args: [u.tenant_id] });
    const px = u.coord
      ? await sqlite.execute({ sql: "SELECT cc, com, assin, prev, obs, setor, resp, gravidade, urgencia, tendencia, progresso, impacto, esforco FROM projx WHERE tenant_id = ?", args: [u.tenant_id] })
      : ({ rows: [] as P[] });
    const pf = u.coord
      ? await sqlite.execute({ sql: "SELECT cc, func, h FROM prevf WHERE tenant_id = ?", args: [u.tenant_id] })
      : ({ rows: [] as P[] });
    /* CARTEIRA EXECUTIVA — horas gastas por cc (SUM lanc aprovado/lançado) e DESTAQUES DA SEMANA,
       ambos derivados no SERVIDOR a partir dos dados reais (tenant-filtrado). Só para gestão
       (coord): a comparação gasto×previsto e os destaques são visão executiva. Sem valor monetário. */
    const gastas: Record<string, number> = {};
    let destaques: P[] = [];
    if (u.coord) {
      const g = await sqlite.execute({ sql: "SELECT cc, COALESCE(SUM(h),0) AS h FROM lanc WHERE tenant_id = ? AND s IN ('APROVADO','LANÇADO') GROUP BY cc", args: [u.tenant_id] });
      for (const r of g.rows as P[]) gastas[String(r.cc)] = Math.round((Number(r.h) || 0) * 10) / 10;
      destaques = await destaquesSemana(u.tenant_id, proj.rows as P[], px.rows as P[], gastas);
    }
    const cfg = await sqlite.execute({
      sql: "SELECT k, v FROM config WHERE tenant_id = ? AND (k LIKE 'cargo:%' OR k LIKE 'resp:%' OR k LIKE 'email:%' OR k LIKE 'link:%' OR k LIKE 'func:%' OR k LIKE 'setor:%' OR k LIKE 'respsetor:%' OR k LIKE 'respdom:%')",
      args: [TENANT_INTELECTO],
    });
    const cargos: Record<string, string> = {};
    const resp: Record<string, string[]> = {};
    const emails: Record<string, string> = {};
    const links: Record<string, string> = {};
    const funcs: Record<string, string> = {};
    const setores: Record<string, string> = {};
    const respsetor: Record<string, string[]> = {};
    const respdom: Record<string, string[]> = {};
    for (const r of cfg.rows as P[]) {
      const k = String(r.k);
      if (k.startsWith("cargo:")) cargos[k.slice(6)] = String(r.v);
      else if (k.startsWith("respsetor:")) respsetor[k.slice(10)] = String(r.v).split(",").filter(Boolean);
      else if (k.startsWith("respdom:")) respdom[k.slice(8)] = String(r.v).split(",").filter(Boolean);
      else if (k.startsWith("resp:")) resp[k.slice(5)] = String(r.v).split(",").filter(Boolean);
      else if (k.startsWith("link:")) links[k.slice(5)] = String(r.v);
      else if (k.startsWith("func:")) funcs[k.slice(5)] = String(r.v);
      else if (k.startsWith("setor:")) setores[k.slice(6)] = String(r.v);
      else if (u.coord) emails[k.slice(6)] = String(r.v);
    }
    const canView = (a: string) => !RESTRITAS.includes(a) || u.coord || (resp[a] || []).includes(u.slug);
    const conteudo = (cont.rows as P[]).filter((c) => canView(String(c.area)));
    const owner = isOwner(u.slug);
    const myareas: string[] = [];
    for (const a of AREAS_PROT_COD) {
      if (owner) { myareas.push(a); continue; }
      const pv = await cfgGet("perm:" + a);
      if (pv && pv.split(",").includes(u.slug)) myareas.push(a);
    }
    const acgrantMe = await cfgGet("acgrant:" + u.slug);
    const acok = owner || grantValid(acgrantMe);
    // Roster INTERNO ativo (slug->nome) direto da tabela `membro` — fonte viva do PESSOAS/nomeDe
    // do front (substitui a lista fixa). So pessoas internas (exclui cliente/fornecedor).
    const mr = await sqlite.execute({ sql: "SELECT slug, nome FROM membro WHERE tenant_id = ? AND ativo = 1 AND papel NOT IN ('cliente','fornecedor') ORDER BY nome", args: [u.tenant_id] });
    const membros = (mr.rows as P[]).map((m) => [String(m.slug), String(m.nome || m.slug)]);
    return {
      owner, myareas, acok, acgrant: acgrantMe || "", catAreasProt: AREAS_PROT, membros,
      ok: true, coord: u.coord, slug: u.slug, area: AREA_DE[u.slug] || "", ccArea: CC_AREA,
      lanc: lanc.rows, proj: proj.rows, projx: px.rows, prevf: pf.rows,
      gastas, destaques,
      conteudo, cargos, resp, emails, links, funcs, setores, respsetor, respdom,
      catFuncoes: FUNCOES, catSetores: SETORES, catEvTipos: EV_TIPOS, catBibTipos: BIB_TIPOS, catFases: PDCA_FASES,
      catBibDoms: BIB_DOMS,
      caps: [...(await capsDe({ slug: u.slug, papel: u.papel }))],
    };
  }

  if (action === "addcont") {
    const u = await auth(p);
    const area = String(p.area || "");
    if (!AREAS_LIST.includes(area)) throw new Error("Área desconhecida.");
    if (!await canEditArea(area, u)) throw new Error("Sem permissão para editar esta área.");
    const it = validItem(p.item || {});
    const id = crypto.randomUUID().slice(0, 8);
    await sqlite.execute({
      sql: "INSERT INTO conteudo (id,area,titulo,descricao,url,tag,destaque,autor,criado,u,tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      args: [id, area, it.titulo, it.descricao, it.url, it.tag, it.destaque, u.slug, now, now, u.tenant_id],
    });
    await audit("conteudo_add", u.slug, area + ": " + it.titulo, ip);
    return { ok: true, id };
  }

  if (action === "editcont") {
    const u = await auth(p);
    const cur = await getCont(String(p.id), u.tenant_id);
    if (!await canEditArea(String(cur.area), u)) throw new Error("Sem permissão para editar esta área.");
    const it = validItem(p.item || {});
    await sqlite.execute({
      sql: "UPDATE conteudo SET titulo=?, descricao=?, url=?, tag=?, destaque=?, u=? WHERE id=? AND tenant_id=?",
      args: [it.titulo, it.descricao, it.url, it.tag, it.destaque, now, String(p.id), u.tenant_id],
    });
    await audit("conteudo_edit", u.slug, String(cur.area) + ": " + it.titulo, ip);
    return { ok: true };
  }

  if (action === "delcont") {
    const u = await auth(p);
    const cur = await getCont(String(p.id), u.tenant_id);
    if (!await canEditArea(String(cur.area), u)) throw new Error("Sem permissão para editar esta área.");
    await sqlite.execute({ sql: "DELETE FROM conteudo WHERE id = ? AND tenant_id = ?", args: [String(p.id), u.tenant_id] });
    await audit("conteudo_del", u.slug, String(cur.area) + ": " + String(cur.titulo), ip);
    return { ok: true };
  }

  if (action === "setresp") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação define responsáveis.");
    const area = String(p.area || "");
    if (!AREAS_LIST.includes(area)) throw new Error("Área desconhecida.");
    const slugs = (Array.isArray(p.slugs) ? p.slugs : []).map(String).filter((s) => COLABS.includes(s));
    await cfgSet("resp:" + area, slugs.join(","));
    return { ok: true };
  }

  if (action === "setlink") {
    // Link de controle próprio de cada área (projetos/leads e clientes). Só a Coordenação
    // ou o responsável designado da área pode cadastrar.
    const u = await auth(p);
    const area = String(p.area || "");
    if (!AREAS_LIST.includes(area)) throw new Error("Área desconhecida.");
    if (!await canEditArea(area, u) && AREA_DE[u.slug] !== area) {
      throw new Error("Sem permissão para alterar o link desta área.");
    }
    const url = String(p.url || "").trim();
    if (url && !/^https:\/\/[^\s"'<>]{4,300}$/.test(url)) throw new Error("Informe um endereço começando com https://");
    if (url) await cfgSet("link:" + area, url); else await cfgDel("link:" + area);
    await audit("link_area", u.slug, area + ": " + (url ? "definido" : "removido"), ip);
    return { ok: true };
  }

  /* ---------- funções, setores e horas previstas por função ---------- */

  if (action === "setfuncao") {
    // Função (nível da proposta) e setor de cada pessoa.
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação define função e setor.");
    const alvo = String(p.alvo || "");
    if (!COLABS.includes(alvo)) throw new Error("Colaborador desconhecido.");
    const func = String(p.func || "");
    if (func && !FUNC_COD.includes(func)) throw new Error("Função inválida.");
    const setor = String(p.setor || "");
    if (setor && !SETOR_COD.includes(setor)) throw new Error("Setor inválido.");
    if (func) await cfgSet("func:" + alvo, func); else await cfgDel("func:" + alvo);
    if (setor) await cfgSet("setor:" + alvo, setor); else await cfgDel("setor:" + alvo);
    await audit("funcao", u.slug, alvo + ": " + (func || "sem função") + " / " + (setor || "sem setor"), ip);
    return { ok: true };
  }

  if (action === "setrespsetor") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação define responsáveis de setor.");
    const setor = String(p.setor || "");
    if (!SETOR_COD.includes(setor)) throw new Error("Setor inválido.");
    const slugs = (Array.isArray(p.slugs) ? p.slugs : []).map(String).filter((s) => COLABS.includes(s));
    if (slugs.length) await cfgSet("respsetor:" + setor, slugs.join(",")); else await cfgDel("respsetor:" + setor);
    await audit("resp_setor", u.slug, setor + ": " + (slugs.join(", ") || "ninguém"), ip);
    return { ok: true };
  }

  if (action === "setrespdom") {
    // Autor técnico do domínio: redige as fichas daquele domínio; a Coordenação aprova.
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação define o autor técnico de um domínio.");
    const dom = String(p.dominio || "");
    if (!BIB_DOM_COD.includes(dom)) throw new Error("Domínio inválido.");
    const slugs = (Array.isArray(p.slugs) ? p.slugs : []).map(String).filter((s) => COLABS.includes(s));
    if (slugs.length) await cfgSet("respdom:" + dom, slugs.join(",")); else await cfgDel("respdom:" + dom);
    await audit("resp_dom", u.slug, dom + ": " + (slugs.join(", ") || "ninguém"), ip);
    return { ok: true };
  }

  if (action === "setprojmeta") {
    // Setor e responsável do projeto.
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação altera setor e responsável do projeto.");
    const cc = String(p.cc || "");
    if (!/^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/.test(cc)) throw new Error("Centro de custo inválido.");
    const setor = String(p.setor || "");
    if (setor && !SETOR_COD.includes(setor)) throw new Error("Setor inválido.");
    const resp = String(p.resp || "");
    if (resp && !COLABS.includes(resp)) throw new Error("Responsável desconhecido.");
    await sqlite.execute({
      sql: "INSERT INTO projx (cc, setor, resp, u, tenant_id) VALUES (?,?,?,?,?) ON CONFLICT(cc) DO UPDATE SET setor=?, resp=?, u=?",
      args: [cc, setor, resp, new Date().toISOString(), u.tenant_id, setor, resp, new Date().toISOString()],
    });
    await audit("projeto_meta", u.slug, cc + ": " + (setor || "sem setor") + " / " + (resp || "sem responsável"), ip);
    return { ok: true };
  }

  if (action === "setprev") {
    // Horas previstas na proposta, uma linha por função.
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação cadastra as horas da proposta.");
    const cc = String(p.cc || "");
    if (!/^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/.test(cc)) throw new Error("Centro de custo inválido.");
    const itens = Array.isArray(p.itens) ? p.itens : [];
    const agora = new Date().toISOString();
    const st: { sql: string; args: any[] }[] = [{ sql: "DELETE FROM prevf WHERE cc = ? AND tenant_id = ?", args: [cc, u.tenant_id] }];
    let total = 0;
    for (const it of itens as P[]) {
      const f = String(it.func || "");
      if (!FUNC_COD.includes(f)) throw new Error("Função inválida: " + f);
      const h = Math.max(0, Math.min(100000, Number(it.h) || 0));
      if (!h) continue;
      total += h;
      st.push({ sql: "INSERT INTO prevf (cc, func, h, u, tenant_id) VALUES (?,?,?,?,?)", args: [cc, f, Math.round(h * 10) / 10, agora, u.tenant_id] });
    }
    await sqlite.batch(st);
    await audit("prev_funcao", u.slug, cc + ": " + total + " h previstas em " + (st.length - 1) + " funções", ip);
    return { ok: true, total };
  }

  /* ---------- calendário ---------- */

  if (action === "eventos") {
    const u = await auth(p);
    const de = String(p.de || "").slice(0, 10), ate = String(p.ate || "").slice(0, 10);
    const r = de && ate
      ? await sqlite.execute({ sql: "SELECT * FROM evento WHERE tenant_id = ? AND d <= ? AND (CASE WHEN dfim = '' THEN d ELSE dfim END) >= ? ORDER BY d, hora", args: [u.tenant_id, ate, de] })
      : await sqlite.execute({ sql: "SELECT * FROM evento WHERE tenant_id = ? ORDER BY d DESC LIMIT 500", args: [u.tenant_id] });
    return { ok: true, eventos: r.rows };
  }

  if (action === "addevento") {
    const u = await auth(p);
    if (!temCapSet(await capsDe(u), "agenda.editar")) throw new Error("Seu cargo não permite criar ou alterar eventos da agenda.");
    const e = p.ev || {};
    const d = String(e.d || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Informe a data do evento.");
    const dfim = String(e.dfim || "").slice(0, 10);
    if (dfim && (!/^\d{4}-\d{2}-\d{2}$/.test(dfim) || dfim < d)) throw new Error("Data final inválida.");
    const tipo = String(e.tipo || "REUNIAO");
    if (!EV_TIPOS.includes(tipo)) throw new Error("Tipo de evento inválido.");
    const titulo = String(e.titulo || "").trim();
    if (titulo.length < 3) throw new Error("Descreva o evento em pelo menos 3 letras.");
    const setor = String(e.setor || "");
    if (setor && !SETOR_COD.includes(setor)) throw new Error("Setor inválido.");
    const cc = String(e.cc || "");
    if (cc && !/^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/.test(cc)) throw new Error("Centro de custo inválido.");
    const resp = String(e.resp || "");
    if (resp && !COLABS.includes(resp)) throw new Error("Responsável desconhecido.");
    const fase = String(e.fase || "");
    if (fase && !PDCA_FASES.includes(fase)) throw new Error("Fase do ciclo inválida.");
    const hora = String(e.hora || "").slice(0, 5);
    if (hora && !/^\d{2}:\d{2}$/.test(hora)) throw new Error("Horário inválido.");
    const id = String(e.id || "").trim() || ("ev" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    /* O id vem do cliente e o UPSERT abaixo sobrescreve. Sem conferir o dono do registro
       existente, qualquer pessoa autenticada reescrevia o evento de outra — mesma regra
       que delevento ja aplicava. */
    if (String(e.id || "").trim()) {
      const at = await sqlite.execute({ sql: "SELECT autor FROM evento WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
      if (at.rows.length) {
        const dono = String((at.rows[0] as P).autor || "");
        if (!u.coord && dono !== u.slug) throw new Error("Este evento é de outra pessoa. Só a Coordenação ou quem criou pode alterar.");
      }
    }
    const agora = new Date().toISOString();
    const pauta = String(e.pauta || "").slice(0, 2000);
    const local = String(e.local || "").slice(0, 120), obs = String(e.obs || "").slice(0, 500);
    await sqlite.execute({
      sql: `INSERT INTO evento (id,d,dfim,hora,tipo,titulo,setor,cc,resp,fase,local,obs,pauta,autor,criado,tenant_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET d=?,dfim=?,hora=?,tipo=?,titulo=?,setor=?,cc=?,resp=?,fase=?,local=?,obs=?,pauta=?`,
      args: [id, d, dfim, hora, tipo, titulo, setor, cc, resp, fase, local, obs, pauta, u.slug, agora, u.tenant_id,
        d, dfim, hora, tipo, titulo, setor, cc, resp, fase, local, obs, pauta],
    });
    await audit("evento", u.slug, tipo + " " + d + ": " + titulo, ip);
    return { ok: true, id };
  }

  if (action === "delevento") {
    const u = await auth(p);
    if (!temCapSet(await capsDe(u), "agenda.editar")) throw new Error("Seu cargo não permite criar ou alterar eventos da agenda.");
    const id = String(p.id || "");
    const r = await sqlite.execute({ sql: "SELECT autor, titulo FROM evento WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    if (!r.rows.length) throw new Error("Evento não encontrado.");
    if (!u.coord && String((r.rows[0] as P).autor) !== u.slug) throw new Error("Só a Coordenação ou quem cadastrou pode excluir.");
    await sqlite.execute({ sql: "DELETE FROM evento WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    await audit("evento_del", u.slug, String((r.rows[0] as P).titulo), ip);
    return { ok: true };
  }

  if (action === "addserie") {
    /* Evento PERIÓDICO: valida o evento-base (mesmas regras de addevento) e a recorrência,
       gera as ocorrências em memória (respeitando o teto MAX_SERIE) e grava TODAS num único
       batch — nunca N chamadas soltas. Toda linha leva serie_id, autor e tenant_id do usuário.
       Só cria; a edição e a exclusão continuam por instância (addevento/delevento) ou pela
       série inteira (delserie). */
    const u = await auth(p);
    if (!temCapSet(await capsDe(u), "agenda.editar")) throw new Error("Seu cargo não permite criar ou alterar eventos da agenda.");
    const e = p.ev || {};
    const d = String(e.d || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Informe a data de início da série.");
    const dfim = String(e.dfim || "").slice(0, 10);
    if (dfim && (!/^\d{4}-\d{2}-\d{2}$/.test(dfim) || dfim < d)) throw new Error("Data final inválida.");
    const tipo = String(e.tipo || "REUNIAO");
    if (!EV_TIPOS.includes(tipo)) throw new Error("Tipo de evento inválido.");
    const titulo = String(e.titulo || "").trim();
    if (titulo.length < 3) throw new Error("Descreva o evento em pelo menos 3 letras.");
    const setor = String(e.setor || "");
    if (setor && !SETOR_COD.includes(setor)) throw new Error("Setor inválido.");
    const cc = String(e.cc || "");
    if (cc && !/^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/.test(cc)) throw new Error("Centro de custo inválido.");
    const resp = String(e.resp || "");
    if (resp && !COLABS.includes(resp)) throw new Error("Responsável desconhecido.");
    const fase = String(e.fase || "");
    if (fase && !PDCA_FASES.includes(fase)) throw new Error("Fase do ciclo inválida.");
    const hora = String(e.hora || "").slice(0, 5);
    if (hora && !/^\d{2}:\d{2}$/.test(hora)) throw new Error("Horário inválido.");
    const local = String(e.local || "").slice(0, 120);
    const obs = String(e.obs || "").slice(0, 500);
    // duração em dias da ocorrência-base, replicada em cada instância (eventos de múltiplos dias)
    const durDias = dfim ? Math.round((Date.parse(dfim + "T00:00:00Z") - Date.parse(d + "T00:00:00Z")) / 86400000) : 0;

    const rec = p.rec || {};
    const freq = String(rec.freq || "");
    if (!EV_FREQS.includes(freq)) throw new Error("Frequência de recorrência inválida.");
    const modo = String(rec.modo || "count"); // "ate" (até uma data) | "count" (nº de ocorrências)
    const ateData = String(rec.ate || "").slice(0, 10);
    let count = Math.floor(Number(rec.count || 0));
    if (modo === "ate") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ateData) || ateData < d) throw new Error("Data de término da série inválida.");
    } else {
      if (!(count >= 1)) throw new Error("Informe o número de ocorrências (mínimo 1).");
    }

    // Gera as datas de início de cada ocorrência (teto MAX_SERIE em qualquer dos modos).
    const datas: string[] = [];
    let cur = d;
    while (datas.length < MAX_SERIE) {
      if (modo === "ate") { if (cur > ateData) break; } else { if (datas.length >= count) break; }
      datas.push(cur);
      cur = proximaOcorrencia(cur, freq);
    }
    if (!datas.length) throw new Error("A recorrência não gerou nenhuma ocorrência.");
    // Cortou no teto: ainda haveria ocorrência (modo count pediu mais; modo até ainda cabe data).
    const atingiuTeto = datas.length === MAX_SERIE && (modo === "count" ? count > MAX_SERIE : cur <= ateData);

    const serie_id = "sr" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const agora = new Date().toISOString();
    const pauta = String((p.ev || {}).pauta || "").slice(0, 2000);
    const stmts = datas.map((di) => ({
      sql: `INSERT INTO evento (id,d,dfim,hora,tipo,titulo,setor,cc,resp,fase,local,obs,pauta,autor,criado,tenant_id,serie_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        "ev" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        di, durDias ? addDaysISO(di, durDias) : "", hora, tipo, titulo, setor, cc, resp, fase,
        local, obs, pauta, u.slug, agora, u.tenant_id, serie_id,
      ],
    }));
    await sqlite.batch(stmts);
    await audit("evento_serie", u.slug, tipo + " " + freq + " x" + datas.length + " desde " + d + ": " + titulo, ip);
    return { ok: true, serie_id, n: datas.length, teto: MAX_SERIE, atingiuTeto };
  }

  if (action === "delserie") {
    /* Exclui a SÉRIE inteira por serie_id (todas as ocorrências). Mesma regra de dono/coord
       de delevento: a Coordenação apaga qualquer série; os demais só a própria. */
    const u = await auth(p);
    if (!temCapSet(await capsDe(u), "agenda.editar")) throw new Error("Seu cargo não permite criar ou alterar eventos da agenda.");
    const serie = String(p.serie_id || "").trim();
    if (!serie) throw new Error("Série não informada.");
    const r = await sqlite.execute({ sql: "SELECT DISTINCT autor FROM evento WHERE serie_id = ? AND tenant_id = ?", args: [serie, u.tenant_id] });
    if (!r.rows.length) throw new Error("Série não encontrada.");
    if (!u.coord) {
      for (const row of r.rows) {
        if (String((row as P).autor || "") !== u.slug) throw new Error("Esta série tem eventos de outra pessoa. Só a Coordenação pode excluir a série inteira.");
      }
    }
    const del = await sqlite.execute({ sql: "DELETE FROM evento WHERE serie_id = ? AND tenant_id = ?", args: [serie, u.tenant_id] });
    await audit("evento_del_serie", u.slug, serie, ip);
    return { ok: true, n: del.rowsAffected };
  }

  /* ---------- biblioteca ---------- */

  /* Quem pode redigir a ficha de um domínio: a Coordenação, quem responde pelos treinamentos
     e o autor técnico designado para aquele domínio. */
  async function podeFicha(dom: string, u: { slug: string; coord: boolean }): Promise<boolean> {
    if (u.coord) return true;
    if (await canEditArea("treinamentos", u)) return true;
    const v = await cfgGet("respdom:" + String(dom || ""));
    return !!v && v.split(",").filter(Boolean).includes(u.slug);
  }
  /* podeFicha valida o dominio que veio no corpo. Quando o id ja existe, o UPSERT atinge um
     registro que pode ser de OUTRO dominio — entao a permissao tem de ser checada contra o
     dominio do registro atingido, nao contra o que o cliente alegou. */
  async function podeFichaExistente(tabela: "biblio" | "param", id: string, u: { slug: string; coord: boolean; tenant_id: string }) {
    if (!id) return;
    const t = tabela === "biblio" ? "biblio" : "param";
    const r = await sqlite.execute({ sql: "SELECT dominio FROM " + t + " WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    if (!r.rows.length) return;
    const domAtual = String((r.rows[0] as P).dominio || "");
    if (!await podeFicha(domAtual, u)) throw new Error("Este registro pertence ao domínio " + (domAtual || "?") + ", em que você não tem permissão.");
  }

  if (action === "biblio") {
    const u = await auth(p);
    const r = await sqlite.execute({ sql: "SELECT id,titulo,tipo,tema,norma,ano,cc,url,doc,resumo,tags,destaque,autor,criado,dominio,assunto,aplica,criterio,limites,pratica,evidencia,revisao,situacao FROM biblio WHERE tenant_id = ? ORDER BY destaque DESC, criado DESC", args: [u.tenant_id] });
    const q = await sqlite.execute({ sql: "SELECT id,dominio,parametro,unidade,faixa,pratica,condicao,fonte,risco,verificacao,autor,criado,situacao FROM param WHERE tenant_id = ? ORDER BY dominio, parametro", args: [u.tenant_id] });
    return { ok: true, biblio: r.rows, param: q.rows };
  }

  if (action === "progcurso") {
    /* Progresso dos cursos: o próprio colaborador vê o seu; a Coordenação vê o da equipe. */
    const u = await auth(p);
    const r = u.coord
      ? await sqlite.execute({ sql: "SELECT slug, curso, modulo, nota, total, quando FROM progcurso WHERE tenant_id = ?", args: [u.tenant_id] })
      : await sqlite.execute({ sql: "SELECT slug, curso, modulo, nota, total, quando FROM progcurso WHERE slug = ? AND tenant_id = ?", args: [u.slug, u.tenant_id] });
    return { ok: true, prog: r.rows };
  }

  if (action === "setprog") {
    const u = await auth(p);
    const curso = String(p.curso || "").slice(0, 60);
    const modulo = String(p.modulo || "").slice(0, 60);
    if (!curso || !modulo) throw new Error("Curso ou módulo não informado.");
    const nota = Number(p.nota) || 0, total = Number(p.total) || 0;
    if (p.limpar) {
      await sqlite.execute({ sql: "DELETE FROM progcurso WHERE slug = ? AND curso = ? AND modulo = ? AND tenant_id = ?", args: [u.slug, curso, modulo, u.tenant_id] });
      return { ok: true };
    }
    await sqlite.execute({
      sql: `INSERT INTO progcurso (slug, curso, modulo, nota, total, quando, tenant_id) VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(slug, curso, modulo) DO UPDATE SET nota = ?, total = ?, quando = ?`,
      args: [u.slug, curso, modulo, nota, total, new Date().toISOString(), u.tenant_id, nota, total, new Date().toISOString()],
    });
    return { ok: true };
  }

  if (action === "aprovaficha") {
    // Só a Coordenação torna vigente a ficha redigida pelo autor técnico.
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação aprova uma ficha.");
    const tabela = String(p.tabela || "");
    if (tabela !== "biblio" && tabela !== "param") throw new Error("Ficha desconhecida.");
    const id = String(p.id || "");
    const nova = p.devolver ? "RASCUNHO" : "VIGENTE";
    const r = await sqlite.execute({ sql: "UPDATE " + tabela + " SET situacao = ? WHERE id = ? AND tenant_id = ?", args: [nova, id, u.tenant_id] });
    if (!r.rowsAffected) throw new Error("Ficha não encontrada.");
    await audit("ficha_" + nova.toLowerCase(), u.slug, tabela + ": " + id, ip);
    return { ok: true };
  }

  if (action === "addparam") {
    const u = await auth(p);
    const b = p.item || {};
    const parametro = String(b.parametro || "").trim();
    if (parametro.length < 3) throw new Error("Nome do parâmetro muito curto.");
    const dominio = String(b.dominio || "GER");
    if (!BIB_DOM_COD.includes(dominio)) throw new Error("Domínio inválido.");
    if (!await podeFicha(dominio, u)) throw new Error("Sem permissão para redigir fichas deste domínio.");
    await podeFichaExistente("param", String(b.id || "").trim(), u);
    const condicao = String(b.condicao || "").trim();
    if (condicao.length < 3) throw new Error("Informe a condição em que o parâmetro vale.");
    const fonte = String(b.fonte || "").trim();
    if (!fonte) throw new Error("Informe a fonte — o item da biblioteca que sustenta o parâmetro.");
    const id = String(b.id || "").trim() || ("pa" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const agora = new Date().toISOString();
    const vals = [dominio, parametro, String(b.unidade || "").slice(0, 40), String(b.faixa || "").slice(0, 200),
      String(b.pratica || "").slice(0, 200), condicao.slice(0, 300), fonte.slice(0, 120),
      String(b.risco || "").slice(0, 400), String(b.verificacao || "").slice(0, 400),
      u.coord ? "VIGENTE" : "RASCUNHO"];
    await sqlite.execute({
      sql: `INSERT INTO param (id,dominio,parametro,unidade,faixa,pratica,condicao,fonte,risco,verificacao,situacao,autor,criado,u,tenant_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET dominio=?,parametro=?,unidade=?,faixa=?,pratica=?,condicao=?,fonte=?,risco=?,verificacao=?,situacao=?,u=?`,
      args: [id, ...vals, u.slug, agora, agora, u.tenant_id, ...vals, agora],
    });
    await audit("param", u.slug, dominio + ": " + parametro, ip);
    return { ok: true, id };
  }

  if (action === "delparam") {
    const u = await auth(p);
    if (!await canEditArea("treinamentos", u) && !u.coord) throw new Error("Sem permissão para alterar a base técnica.");
    const id = String(p.id || "");
    const r = await sqlite.execute({ sql: "SELECT parametro FROM param WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    if (!r.rows.length) throw new Error("Parâmetro não encontrado.");
    await sqlite.execute({ sql: "DELETE FROM param WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    await audit("param_del", u.slug, String((r.rows[0] as P).parametro), ip);
    return { ok: true };
  }

  if (action === "addbiblio") {
    const u = await auth(p);
    const b = p.item || {};
    if (!await podeFicha(String(b.dominio || ""), u)) throw new Error("Sem permissão para alterar a biblioteca.");
    await podeFichaExistente("biblio", String(b.id || "").trim(), u);
    const titulo = String(b.titulo || "").trim();
    if (titulo.length < 3) throw new Error("Título muito curto.");
    const tipo = String(b.tipo || "NORMA");
    if (!BIB_TIPOS.includes(tipo)) throw new Error("Tipo de material inválido.");
    const url = String(b.url || "").trim();
    if (url && !/^https:\/\/[^\s"'<>]{4,500}$/.test(url)) throw new Error("O link deve começar com https://");
    const doc = String(b.doc || "").trim();
    if (doc && !/^[a-z0-9-]{1,60}$/.test(doc)) throw new Error("Documento interno inválido.");
    const criterio = String(b.criterio || "").trim();
    const dominio = String(b.dominio || "");
    if (dominio && !BIB_DOM_COD.includes(dominio)) throw new Error("Domínio inválido.");
    if (!url && !doc && !criterio) {
      throw new Error("Informe o link, o documento interno ou o critério da ficha.");
    }
    const cc = String(b.cc || "");
    if (cc && !/^\d{1,2}\.\d{1,2}\.[1-4]\.\d{1,3}$/.test(cc)) throw new Error("Centro de custo inválido.");
    const id = String(b.id || "").trim() || ("bi" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const agora = new Date().toISOString();
    const vals = [titulo, tipo, String(b.tema || "").slice(0, 80), String(b.norma || "").slice(0, 80),
      String(b.ano || "").slice(0, 4), cc, url, doc, String(b.resumo || "").slice(0, 600),
      String(b.tags || "").slice(0, 160), b.destaque ? 1 : 0,
      dominio, String(b.assunto || "").slice(0, 120), String(b.aplica || "").slice(0, 400),
      criterio.slice(0, 800), String(b.limites || "").slice(0, 400),
      String(b.pratica || "").slice(0, 400), String(b.evidencia || "").slice(0, 200),
      String(b.revisao || "").slice(0, 80), u.coord ? "VIGENTE" : "RASCUNHO"];
    await sqlite.execute({
      sql: `INSERT INTO biblio (id,titulo,tipo,tema,norma,ano,cc,url,doc,resumo,tags,destaque,dominio,assunto,aplica,criterio,limites,pratica,evidencia,revisao,situacao,autor,criado,u,tenant_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET titulo=?,tipo=?,tema=?,norma=?,ano=?,cc=?,url=?,doc=?,resumo=?,tags=?,destaque=?,dominio=?,assunto=?,aplica=?,criterio=?,limites=?,pratica=?,evidencia=?,revisao=?,situacao=?,u=?`,
      args: [id, ...vals, u.slug, agora, agora, u.tenant_id, ...vals, agora],
    });
    await audit("biblio", u.slug, tipo + ": " + titulo, ip);
    return { ok: true, id };
  }

  if (action === "delbiblio") {
    const u = await auth(p);
    if (!await canEditArea("treinamentos", u) && !u.coord) throw new Error("Sem permissão para alterar a biblioteca.");
    const id = String(p.id || "");
    const r = await sqlite.execute({ sql: "SELECT titulo FROM biblio WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    if (!r.rows.length) throw new Error("Material não encontrado.");
    await sqlite.execute({ sql: "DELETE FROM biblio WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    await audit("biblio_del", u.slug, String((r.rows[0] as P).titulo), ip);
    return { ok: true };
  }

  if (action === "setcargo") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação altera cargos.");
    const alvo = String(p.alvo || "");
    if (!COLABS.includes(alvo)) throw new Error("Colaborador desconhecido.");
    const cargo = String(p.cargo || "").trim();
    if (cargo) await cfgSet("cargo:" + alvo, cargo);
    else await cfgDel("cargo:" + alvo);
    return { ok: true };
  }

  /* ===== RH (Fase 1 + Onda 3 multi-cargo): catalogo de cargos + rotinas (manual vivo) ===== */
  if (action === "rh") {
    const u = await auth(p);
    const caps = await capsDe({ slug: u.slug, papel: u.papel });
    const r = await sqlite.execute({ sql: "SELECT cid, nome, ordem, area, missao, responsabilidades, entregaveis, rotinas, cadencia, onboarding, horas_dia, vinculo, metas, atualizado FROM rh_cargo WHERE tenant_id = ? ORDER BY ordem, nome", args: [u.tenant_id] });
    // Nome e horas/vinculo por cid (para "quem ocupa", headcount e capacidade).
    const nomeCid: Record<string, string> = {}; const hdCid: Record<string, number> = {}; const vincCid: Record<string, string> = {};
    for (const x of r.rows as P[]) { const cid = String(x.cid); nomeCid[cid] = String(x.nome || cid); hdCid[cid] = Number(x.horas_dia) || 0; vincCid[cid] = String(x.vinculo || "Contratado"); }
    // Onda 3: atribuicoes multi-cargo (membro_cargo) + merge defensivo do legado `cargocid:<slug>`.
    const porSlug: Record<string, { cid: string; principal: number; prioridade: number; foco: string }[]> = {};
    try {
      const mc = await sqlite.execute({ sql: "SELECT slug, cid, principal, prioridade, foco FROM membro_cargo WHERE tenant_id = ? ORDER BY principal DESC, prioridade, cid", args: [u.tenant_id] });
      for (const x of mc.rows as P[]) { const s = String(x.slug); (porSlug[s] = porSlug[s] || []).push({ cid: String(x.cid), principal: Number(x.principal) ? 1 : 0, prioridade: Number(x.prioridade) || 0, foco: String(x.foco || "") }); }
    } catch (_) { /* tabela ainda nao existe */ }
    const cfgLeg = await sqlite.execute({ sql: "SELECT k, v FROM config WHERE tenant_id = ? AND k LIKE 'cargocid:%'", args: [u.tenant_id] });
    for (const c of cfgLeg.rows as P[]) { const s = String(c.k).slice(9); const cid = String(c.v || "").trim().toLowerCase(); if (cid && !porSlug[s]) porSlug[s] = [{ cid, principal: 1, prioridade: 0, foco: "" }]; }
    // "Quem ocupa" por cargo + headcount (conta TODAS as atribuicoes de cada cargo).
    const pessoas: Record<string, string[]> = {}; const headcount: Record<string, number> = {}; const atrib: Record<string, string> = {};
    for (const s in porSlug) {
      const lista = porSlug[s]; const princ = (lista.find((z) => z.principal) || lista[0]);
      if (princ) atrib[s] = princ.cid; // compat: cid PRINCIPAL por pessoa
      for (const z of lista) { headcount[z.cid] = (headcount[z.cid] || 0) + 1; const nm = nomeCid[z.cid]; if (nm) (pessoas[nm] = pessoas[nm] || []).push(NOMES[s] || s); }
    }
    const cargos = (r.rows as P[]).map((x) => {
      const cid = String(x.cid); const hd = Number(x.horas_dia) || 0; const n = headcount[cid] || 0;
      return { cid, nome: x.nome, area: x.area, missao: x.missao, responsabilidades: x.responsabilidades, entregaveis: x.entregaveis, rotinas: x.rotinas, cadencia: x.cadencia, onboarding: x.onboarding, metas: x.metas || "", atualizado: x.atualizado, horas_dia: hd, vinculo: String(x.vinculo || "Contratado"), pessoas_no_cargo: n, capacidade_dia: Math.round(n * hd * 10) / 10, caps: (CARGO_CAPS_DEFAULT[cid] || []) };
    });
    const podeAtribuir = temCapSet(caps, "pessoas.cargo_atribuir");
    // Colaboradores ativos + cargos atribuidos (painel de atribuicao da Coord. Adm/RH).
    const mrh = await sqlite.execute({ sql: "SELECT slug, nome FROM membro WHERE tenant_id = ? AND ativo = 1 AND papel NOT IN ('cliente','fornecedor') ORDER BY nome", args: [u.tenant_id] });
    const colabs = ((mrh.rows as P[]).length
      ? (mrh.rows as P[]).map((m) => ({ slug: String(m.slug), nome: String(m.nome || m.slug) }))
      : COLABS.filter((s) => !INATIVOS.includes(s)).map((s) => ({ slug: s, nome: NOMES[s] || s })))
      .map((co) => ({ slug: co.slug, nome: co.nome, cargocid: atrib[co.slug] || "", cargos: porSlug[co.slug] || [] }));
    // CAPACIDADE: conta cada PESSOA uma vez, pelo cargo PRINCIPAL (evita somar 8h+8h de 2 cargos).
    let totPessoas = 0, totHoras = 0, totSoc = 0, totSocH = 0;
    for (const s in porSlug) {
      const lista = porSlug[s]; const princ = (lista.find((z) => z.principal) || lista[0]); if (!princ) continue;
      const hd = hdCid[princ.cid] || 0; totPessoas += 1; totHoras += hd;
      if (vincCid[princ.cid] === "Sociedade") { totSoc += 1; totSocH += hd; }
    }
    const capacidade = {
      pessoas: totPessoas, horas_dia: Math.round(totHoras * 10) / 10,
      contratados: totPessoas - totSoc, horas_contratadas: Math.round((totHoras - totSocH) * 10) / 10,
      socios: totSoc, horas_sociedade: Math.round(totSocH * 10) / 10,
      atribuidos: Object.keys(atrib).length, total_ativos: colabs.length,
    };
    return { ok: true, cargos, pessoas, atrib, colabs, capacidade, podeEditar: !!u.coord, podeAtribuir, caps: [...caps] };
  }
  if (action === "ritos") {
    const u = await auth(p);
    const r = await sqlite.execute({ sql: "SELECT rid, nome, tipo, cadencia, publico, objetivo, pauta, entregavel, ordem, atualizado FROM rito WHERE tenant_id = ? ORDER BY ordem, nome", args: [u.tenant_id] });
    return { ok: true, ritos: r.rows, podeEditar: (u.coord || temCapSet(await capsDe(u), "agenda.editar")) };
  }
  if (action === "ritoset") {
    const u = await auth(p);
    if (!(u.coord || temCapSet(await capsDe(u), "agenda.editar"))) throw new Error("Seu cargo não permite editar os ritos.");
    const rid = String(p.rid || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    if (!rid) throw new Error("Identificador de rito inválido.");
    const g = (k: string) => String(p[k] || "").slice(0, 2000);
    const nome = (String(p.nome || "").trim() || rid).slice(0, 120);
    const ordem = Math.max(0, Math.min(999, Number(p.ordem) || 0));
    const now = new Date().toISOString();
    await sqlite.execute({
      sql: "INSERT INTO rito (tenant_id, rid, nome, tipo, cadencia, publico, objetivo, pauta, entregavel, ordem, atualizado, u) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id, rid) DO UPDATE SET nome=excluded.nome, tipo=excluded.tipo, cadencia=excluded.cadencia, publico=excluded.publico, objetivo=excluded.objetivo, pauta=excluded.pauta, entregavel=excluded.entregavel, ordem=excluded.ordem, atualizado=excluded.atualizado, u=excluded.u",
      args: [u.tenant_id, rid, nome, g("tipo"), g("cadencia"), g("publico"), g("objetivo"), g("pauta"), g("entregavel"), ordem, now, u.slug],
    });
    await audit("rito", u.slug, rid, ip);
    return { ok: true, rid };
  }
  if (action === "ritodel") {
    const u = await auth(p);
    if (!(u.coord || temCapSet(await capsDe(u), "agenda.editar"))) throw new Error("Seu cargo não permite remover ritos.");
    const rid = String(p.rid || "").trim();
    if (!rid) throw new Error("Identificador de rito inválido.");
    await sqlite.execute({ sql: "DELETE FROM rito WHERE tenant_id = ? AND rid = ?", args: [u.tenant_id, rid] });
    await audit("rito_del", u.slug, rid, ip);
    return { ok: true };
  }
  if (action === "meucargo") {
    /* Detalhe dos cargos do PRÓPRIO usuário (o que se espera dele). Multi-cargo: devolve TODOS,
     * com o principal primeiro. `cargo` = principal (compat com a UI atual). Só leitura. */
    const u = await auth(p);
    const lista = await cargosDe(u.slug);
    if (!lista.length) return { ok: true, cargo: null, cargos: [] };
    const detalhe: P[] = [];
    for (const z of lista) {
      const r = await sqlite.execute({ sql: "SELECT cid, nome, area, missao, responsabilidades, entregaveis, rotinas, cadencia, onboarding, horas_dia, vinculo FROM rh_cargo WHERE tenant_id = ? AND cid = ?", args: [u.tenant_id, z.cid] });
      const row = (r.rows[0] as P) || null;
      if (row) detalhe.push({ ...row, principal: z.principal, prioridade: z.prioridade, foco: z.foco });
    }
    return { ok: true, cargo: detalhe[0] || null, cargos: detalhe };
  }
  /* ===== Onda 3 / INC 1 — atribuicao MULTI-CARGO (membro_cargo). Gate: pessoas.cargo_atribuir.
   * Helpers inline reaproveitados pelas 5 acoes abaixo. Toda escrita e auditada e mantem o
   * vinculo legado `cargocid:<slug>` sincronizado com o cargo principal. */
  if (action === "rhatribuir" || action === "rhcargoadd" || action === "rhcargodel" || action === "rhcargoprincipal" || action === "rhcargofoco") {
    const u = await auth(p);
    const caps = await capsDe({ slug: u.slug, papel: u.papel });
    if (!temCapSet(caps, "pessoas.cargo_atribuir")) throw new Error("Você não tem permissão para atribuir cargos.");
    const alvo = String(p.alvo || "").trim();
    const alvoEx = await sqlite.execute({ sql: "SELECT slug FROM membro WHERE tenant_id = ? AND slug = ? LIMIT 1", args: [u.tenant_id, alvo] });
    if (!alvoEx.rows.length && !COLABS.includes(alvo)) throw new Error("Colaborador desconhecido.");
    const normCid = (v: unknown) => String(v || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    const cargoExiste = async (cid: string) => (await sqlite.execute({ sql: "SELECT cid FROM rh_cargo WHERE tenant_id = ? AND cid = ?", args: [u.tenant_id, cid] })).rows.length > 0;
    const hoje = new Date().toISOString().slice(0, 10);

    if (action === "rhatribuir") {
      /* Compat: define o CONJUNTO de cargos da pessoa de uma vez. Aceita `cids` (array) ou `cid`
       * (um só). O 1º vira principal. Vazio limpa todos. Substitui o estado anterior. */
      let cids: string[] = Array.isArray(p.cids) ? (p.cids as unknown[]).map(normCid).filter(Boolean) : [];
      if (!cids.length && p.cid != null) { const c = normCid(p.cid); if (c) cids = [c]; }
      cids = [...new Set(cids)];
      for (const c of cids) if (!(await cargoExiste(c))) throw new Error("Cargo inexistente no catálogo de RH: " + c);
      await sqlite.execute({ sql: "DELETE FROM membro_cargo WHERE tenant_id = ? AND slug = ?", args: [u.tenant_id, alvo] });
      if (cids.length) {
        await sqlite.batch(cids.map((c, i) => ({ sql: "INSERT OR IGNORE INTO membro_cargo (tenant_id, slug, cid, principal, prioridade, foco, criado, u) VALUES (?,?,?,?,?,?,?,?)", args: [u.tenant_id, alvo, c, i === 0 ? 1 : 0, i, "", hoje, u.slug] })));
      }
      await syncCargocidLegacy(alvo);
      await audit("rh_atribuir", u.slug, alvo + " -> " + (cids.join(",") || "(sem cargo)"), ip);
      return { ok: true, alvo, cids };
    }
    if (action === "rhcargoadd") {
      const cid = normCid(p.cid);
      if (!cid) throw new Error("Cargo inválido.");
      if (!(await cargoExiste(cid))) throw new Error("Cargo inexistente no catálogo de RH.");
      const cur = await sqlite.execute({ sql: "SELECT COUNT(*) AS n, MAX(prioridade) AS mp FROM membro_cargo WHERE tenant_id = ? AND slug = ?", args: [u.tenant_id, alvo] });
      const n = Number((cur.rows[0] as P).n) || 0; const mp = Number((cur.rows[0] as P).mp) || 0;
      await sqlite.execute({ sql: "INSERT OR IGNORE INTO membro_cargo (tenant_id, slug, cid, principal, prioridade, foco, criado, u) VALUES (?,?,?,?,?,?,?,?)", args: [u.tenant_id, alvo, cid, n === 0 ? 1 : 0, n === 0 ? 0 : mp + 1, "", hoje, u.slug] });
      await syncCargocidLegacy(alvo);
      await audit("rh_cargo_add", u.slug, alvo + " + " + cid, ip);
      return { ok: true, alvo, cid };
    }
    if (action === "rhcargodel") {
      const cid = normCid(p.cid);
      if (!cid) throw new Error("Cargo inválido.");
      const eraPrinc = (await sqlite.execute({ sql: "SELECT principal FROM membro_cargo WHERE tenant_id = ? AND slug = ? AND cid = ? LIMIT 1", args: [u.tenant_id, alvo, cid] })).rows;
      await sqlite.execute({ sql: "DELETE FROM membro_cargo WHERE tenant_id = ? AND slug = ? AND cid = ?", args: [u.tenant_id, alvo, cid] });
      // Se removeu o principal, promove o proximo (menor prioridade) a principal.
      if (eraPrinc.length && Number((eraPrinc[0] as P).principal)) {
        const prox = await sqlite.execute({ sql: "SELECT cid FROM membro_cargo WHERE tenant_id = ? AND slug = ? ORDER BY prioridade, cid LIMIT 1", args: [u.tenant_id, alvo] });
        if (prox.rows.length) await sqlite.execute({ sql: "UPDATE membro_cargo SET principal = 1 WHERE tenant_id = ? AND slug = ? AND cid = ?", args: [u.tenant_id, alvo, String((prox.rows[0] as P).cid)] });
      }
      await syncCargocidLegacy(alvo);
      await audit("rh_cargo_del", u.slug, alvo + " - " + cid, ip);
      return { ok: true, alvo, cid };
    }
    if (action === "rhcargoprincipal") {
      const cid = normCid(p.cid);
      if (!cid) throw new Error("Cargo inválido.");
      const ex = await sqlite.execute({ sql: "SELECT cid FROM membro_cargo WHERE tenant_id = ? AND slug = ? AND cid = ? LIMIT 1", args: [u.tenant_id, alvo, cid] });
      if (!ex.rows.length) throw new Error("Este cargo não está atribuído à pessoa.");
      await sqlite.execute({ sql: "UPDATE membro_cargo SET principal = 0 WHERE tenant_id = ? AND slug = ?", args: [u.tenant_id, alvo] });
      await sqlite.execute({ sql: "UPDATE membro_cargo SET principal = 1 WHERE tenant_id = ? AND slug = ? AND cid = ?", args: [u.tenant_id, alvo, cid] });
      await syncCargocidLegacy(alvo);
      await audit("rh_cargo_princ", u.slug, alvo + " => " + cid, ip);
      return { ok: true, alvo, cid };
    }
    // rhcargofoco — atualiza foco (texto) e/ou prioridade (ordem) de um cargo da pessoa.
    const cid = normCid(p.cid);
    if (!cid) throw new Error("Cargo inválido.");
    const ex = await sqlite.execute({ sql: "SELECT cid FROM membro_cargo WHERE tenant_id = ? AND slug = ? AND cid = ? LIMIT 1", args: [u.tenant_id, alvo, cid] });
    if (!ex.rows.length) throw new Error("Este cargo não está atribuído à pessoa.");
    const sets: string[] = [], args: (string | number)[] = [];
    if (p.foco != null) { sets.push("foco = ?"); args.push(String(p.foco).slice(0, 600)); }
    if (p.prioridade != null) { sets.push("prioridade = ?"); args.push(Math.max(0, Math.min(999, Number(p.prioridade) || 0))); }
    if (!sets.length) throw new Error("Nada para alterar.");
    args.push(u.tenant_id, alvo, cid);
    await sqlite.execute({ sql: "UPDATE membro_cargo SET " + sets.join(", ") + " WHERE tenant_id = ? AND slug = ? AND cid = ?", args });
    await audit("rh_cargo_foco", u.slug, alvo + " / " + cid, ip);
    return { ok: true, alvo, cid };
  }
  if (action === "rhset") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação edita os cargos de RH.");
    const cid = String(p.cid || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    if (!cid) throw new Error("Identificador de cargo inválido.");
    const g = (k: string) => String(p[k] || "").slice(0, 4000);
    const nome = (String(p.nome || "").trim() || cid).slice(0, 120);
    const ordem = Math.max(0, Math.min(999, Number(p.ordem) || 0));
    const horasDia = Math.max(0, Math.min(24, Number(p.horas_dia))) || 0;
    const vinculo = String(p.vinculo || "").trim() === "Sociedade" ? "Sociedade" : "Contratado";
    const now = new Date().toISOString();
    await sqlite.execute({
      sql: "INSERT INTO rh_cargo (tenant_id, cid, nome, ordem, area, missao, responsabilidades, entregaveis, rotinas, cadencia, onboarding, horas_dia, vinculo, metas, atualizado, u) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id, cid) DO UPDATE SET nome=excluded.nome, ordem=excluded.ordem, area=excluded.area, missao=excluded.missao, responsabilidades=excluded.responsabilidades, entregaveis=excluded.entregaveis, rotinas=excluded.rotinas, cadencia=excluded.cadencia, onboarding=excluded.onboarding, horas_dia=excluded.horas_dia, vinculo=excluded.vinculo, metas=excluded.metas, atualizado=excluded.atualizado, u=excluded.u",
      args: [u.tenant_id, cid, nome, ordem, g("area"), g("missao"), g("responsabilidades"), g("entregaveis"), g("rotinas"), g("cadencia"), g("onboarding"), horasDia, vinculo, g("metas"), now, u.slug],
    });
    await audit("rh_cargo", u.slug, cid, ip);
    return { ok: true, cid };
  }
  if (action === "rhdel") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação remove cargos de RH.");
    const cid = String(p.cid || "").trim();
    if (!cid) throw new Error("Identificador de cargo inválido.");
    await sqlite.execute({ sql: "DELETE FROM rh_cargo WHERE tenant_id = ? AND cid = ?", args: [u.tenant_id, cid] });
    await audit("rh_cargo_del", u.slug, cid, ip);
    return { ok: true };
  }

  /* ===== Onda 3 / INC 2 — FICHA DA PESSOA (CV/Lattes + skills + metas + treinamentos +
   * evolução pelas horas). Dados pessoais (LGPD): a própria pessoa (piso equipe) OU
   * RH/coordenação/dono. O gate é aplicado AQUI, na fonte. ========================= */
  if (action === "pessoaficha" || action === "pessoafichaset" || action === "pessoafichacv" ||
      action === "pessoaskillset" || action === "pessoaskilldel" || action === "pessoametaset" ||
      action === "pessoametadel" || action === "pessoatreinoset" || action === "pessoatreinodel" ||
      action === "pessoatreinocomprov") {
    const u = await auth(p);
    const T = u.tenant_id;
    const alvo = (String(p.alvo || "").trim() || u.slug);
    const ehOutro = alvo !== u.slug;
    if (ehOutro) {
      const caps = await capsDe({ slug: u.slug, papel: u.papel });
      if (!(isOwner(u.slug) || u.coord || temCapSet(caps, "rh.ver") || temCapSet(caps, "pessoas.cargo_atribuir")))
        throw new Error("Sem acesso à ficha de outra pessoa.");
      const ex = await sqlite.execute({ sql: "SELECT slug FROM membro WHERE tenant_id = ? AND slug = ? LIMIT 1", args: [T, alvo] });
      if (!ex.rows.length && !COLABS.includes(alvo)) throw new Error("Colaborador desconhecido.");
    }
    const nowIso = new Date().toISOString();
    const g = (k: string, n: number) => String(p[k] == null ? "" : p[k]).slice(0, n);

    if (action === "pessoaficha") {
      const fr = await sqlite.execute({ sql: "SELECT resumo, formacao, experiencia, lattes_url, lattes_id, cv_key, cv_nome, cv_atualizado, atualizado FROM pessoa_ficha WHERE tenant_id = ? AND slug = ? LIMIT 1", args: [T, alvo] });
      const f = (fr.rows[0] as P) || {};
      const sk = await sqlite.execute({ sql: "SELECT id, nome, nivel, origem, area, obs, atualizado FROM pessoa_skill WHERE tenant_id = ? AND slug = ? ORDER BY area, nome", args: [T, alvo] });
      const mt = await sqlite.execute({ sql: "SELECT id, objetivo, prazo, status, progresso, obs, atualizado FROM pessoa_meta WHERE tenant_id = ? AND slug = ? ORDER BY (status='concluida'), (status='cancelada'), prazo", args: [T, alvo] });
      const tr = await sqlite.execute({ sql: "SELECT id, nome, instituicao, data, carga_h, comprov_key, comprov_nome, obs FROM pessoa_treino WHERE tenant_id = ? AND slug = ? ORDER BY data DESC, nome", args: [T, alvo] });
      // EVOLUÇÃO = horas APROVADAS reais (nada inventado): total, por projeto, por mês.
      let total = { h: 0, n: 0 }, porProjeto: P[] = [], porMes: P[] = [], sugestoes: string[] = [];
      try {
        const tot = await sqlite.execute({ sql: "SELECT COALESCE(SUM(h),0) h, COUNT(*) n FROM lanc WHERE tenant_id = ? AND slug = ? AND s = 'APROVADO'", args: [T, alvo] });
        total = { h: Math.round((Number((tot.rows[0] as P).h) || 0) * 10) / 10, n: Number((tot.rows[0] as P).n) || 0 };
        const pp = await sqlite.execute({ sql: "SELECT l.cc cc, COALESCE(p.projeto,'') projeto, COALESCE(p.subtipo,'') subtipo, ROUND(SUM(l.h),1) h FROM lanc l LEFT JOIN proj p ON p.cc = l.cc AND p.tenant_id = l.tenant_id WHERE l.tenant_id = ? AND l.slug = ? AND l.s = 'APROVADO' GROUP BY l.cc ORDER BY h DESC LIMIT 15", args: [T, alvo] });
        porProjeto = pp.rows as P[];
        const pm = await sqlite.execute({ sql: "SELECT substr(d,1,7) ym, ROUND(SUM(h),1) h FROM lanc WHERE tenant_id = ? AND slug = ? AND s = 'APROVADO' AND length(d) >= 7 GROUP BY ym ORDER BY ym DESC LIMIT 12", args: [T, alvo] });
        porMes = pm.rows as P[];
        // SUGESTÃO de skill (confirmação humana): subtipos reais dos projetos trabalhados, que
        // ainda não viraram skill. Nunca grava sozinho — vira skill só quando a pessoa/RH aceita.
        const jaTem = new Set((sk.rows as P[]).map((x) => String(x.nome || "").trim().toLowerCase()));
        const seen = new Set<string>();
        for (const row of porProjeto) {
          const st = String(row.subtipo || "").trim();
          if (st && !jaTem.has(st.toLowerCase()) && !seen.has(st.toLowerCase())) { seen.add(st.toLowerCase()); sugestoes.push(st); }
        }
        sugestoes = sugestoes.slice(0, 8);
      } catch (_) { /* lanc/proj sem tenant_id em algum ambiente: evolução fica vazia */ }
      return {
        ok: true, alvo, nome: (NOMES[alvo] || alvo), ehProprio: !ehOutro, podeEditar: true,
        ficha: { resumo: f.resumo || "", formacao: f.formacao || "", experiencia: f.experiencia || "", lattes_url: f.lattes_url || "", lattes_id: f.lattes_id || "", atualizado: f.atualizado || "" },
        temCv: !!f.cv_key, cvNome: f.cv_nome || "", cvAtualizado: f.cv_atualizado || "",
        skills: sk.rows, metas: mt.rows, treinos: (tr.rows as P[]).map((x) => ({ id: x.id, nome: x.nome, instituicao: x.instituicao, data: x.data, carga_h: x.carga_h, obs: x.obs, temComprov: !!x.comprov_key, comprovNome: x.comprov_nome || "" })),
        evolucao: { total, porProjeto, porMes }, sugestoes,
      };
    }

    if (action === "pessoafichaset") {
      await sqlite.execute({
        sql: "INSERT INTO pessoa_ficha (tenant_id, slug, resumo, formacao, experiencia, lattes_url, lattes_id, atualizado, u) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id, slug) DO UPDATE SET resumo=excluded.resumo, formacao=excluded.formacao, experiencia=excluded.experiencia, lattes_url=excluded.lattes_url, lattes_id=excluded.lattes_id, atualizado=excluded.atualizado, u=excluded.u",
        args: [T, alvo, g("resumo", 4000), g("formacao", 4000), g("experiencia", 6000), g("lattes_url", 300), g("lattes_id", 60), nowIso, u.slug],
      });
      await audit("pessoa_ficha", u.slug, alvo, ip);
      return { ok: true, alvo };
    }

    if (action === "pessoafichacv") {
      if (p.remover) {
        const cur = await sqlite.execute({ sql: "SELECT cv_key FROM pessoa_ficha WHERE tenant_id = ? AND slug = ? LIMIT 1", args: [T, alvo] });
        const key = String((cur.rows[0] as P || {}).cv_key || "");
        if (key && ENV.BLOB) { try { await ENV.BLOB.delete(key); } catch (_) {} }
        await sqlite.execute({ sql: "INSERT INTO pessoa_ficha (tenant_id, slug, cv_key, cv_nome, cv_atualizado, u) VALUES (?,?, '', '', '', ?) ON CONFLICT(tenant_id, slug) DO UPDATE SET cv_key='', cv_nome='', cv_atualizado='', u=excluded.u", args: [T, alvo, u.slug] });
        await audit("pessoa_cv", u.slug, alvo + " (removido)", ip);
        return { ok: true, alvo, removido: true };
      }
      if (!ENV.BLOB) throw new Error("Armazenamento de arquivos indisponível.");
      const { bytes } = pdfFromB64(String(p.b64 || p.data || ""));
      const key = "ficha/" + T + "/" + alvo + "/cv.pdf";
      await ENV.BLOB.put(key, bytes, { httpMetadata: { contentType: "application/pdf" } });
      const nome = (g("nome", 160) || "curriculo.pdf");
      await sqlite.execute({ sql: "INSERT INTO pessoa_ficha (tenant_id, slug, cv_key, cv_nome, cv_atualizado, atualizado, u) VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id, slug) DO UPDATE SET cv_key=excluded.cv_key, cv_nome=excluded.cv_nome, cv_atualizado=excluded.cv_atualizado, atualizado=excluded.atualizado, u=excluded.u", args: [T, alvo, key, nome, nowIso, nowIso, u.slug] });
      await audit("pessoa_cv", u.slug, alvo + " (" + bytes.length + "B)", ip);
      return { ok: true, alvo, cvNome: nome };
    }

    if (action === "pessoaskillset") {
      const nome = g("nome", 120).trim(); if (!nome) throw new Error("Informe a habilidade.");
      const nivel = Math.max(1, Math.min(5, Number(p.nivel) || 1));
      const origem = String(p.origem || "").trim() === "auto" ? "auto" : "manual";
      let id = String(p.id || "").trim();
      if (id) { const ex = await sqlite.execute({ sql: "SELECT slug FROM pessoa_skill WHERE tenant_id = ? AND id = ? LIMIT 1", args: [T, id] }); if (ex.rows.length && String((ex.rows[0] as P).slug) !== alvo) throw new Error("Habilidade de outra pessoa."); }
      else id = crypto.randomUUID().slice(0, 12);
      await sqlite.execute({ sql: "INSERT INTO pessoa_skill (tenant_id, id, slug, nome, nivel, origem, area, obs, atualizado, u) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id, id) DO UPDATE SET nome=excluded.nome, nivel=excluded.nivel, area=excluded.area, obs=excluded.obs, atualizado=excluded.atualizado, u=excluded.u", args: [T, id, alvo, nome, nivel, origem, g("area", 80), g("obs", 600), nowIso, u.slug] });
      await audit("pessoa_skill", u.slug, alvo + ": " + nome, ip);
      return { ok: true, alvo, id };
    }
    if (action === "pessoaskilldel") {
      const id = String(p.id || "").trim(); if (!id) throw new Error("Habilidade inválida.");
      await sqlite.execute({ sql: "DELETE FROM pessoa_skill WHERE tenant_id = ? AND id = ? AND slug = ?", args: [T, id, alvo] });
      await audit("pessoa_skill_del", u.slug, alvo + "/" + id, ip);
      return { ok: true };
    }

    if (action === "pessoametaset") {
      const objetivo = g("objetivo", 600).trim(); if (!objetivo) throw new Error("Descreva a meta.");
      const status = ["aberta", "andamento", "concluida", "cancelada"].includes(String(p.status)) ? String(p.status) : "aberta";
      const progresso = Math.max(0, Math.min(100, Number(p.progresso) || 0));
      let id = String(p.id || "").trim();
      if (id) { const ex = await sqlite.execute({ sql: "SELECT slug FROM pessoa_meta WHERE tenant_id = ? AND id = ? LIMIT 1", args: [T, id] }); if (ex.rows.length && String((ex.rows[0] as P).slug) !== alvo) throw new Error("Meta de outra pessoa."); }
      else id = crypto.randomUUID().slice(0, 12);
      await sqlite.execute({ sql: "INSERT INTO pessoa_meta (tenant_id, id, slug, objetivo, prazo, status, progresso, obs, atualizado, u) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id, id) DO UPDATE SET objetivo=excluded.objetivo, prazo=excluded.prazo, status=excluded.status, progresso=excluded.progresso, obs=excluded.obs, atualizado=excluded.atualizado, u=excluded.u", args: [T, id, alvo, objetivo, g("prazo", 20), status, progresso, g("obs", 600), nowIso, u.slug] });
      await audit("pessoa_meta", u.slug, alvo + ": " + objetivo.slice(0, 40), ip);
      return { ok: true, alvo, id };
    }
    if (action === "pessoametadel") {
      const id = String(p.id || "").trim(); if (!id) throw new Error("Meta inválida.");
      await sqlite.execute({ sql: "DELETE FROM pessoa_meta WHERE tenant_id = ? AND id = ? AND slug = ?", args: [T, id, alvo] });
      await audit("pessoa_meta_del", u.slug, alvo + "/" + id, ip);
      return { ok: true };
    }

    if (action === "pessoatreinoset") {
      const nome = g("nome", 160).trim(); if (!nome) throw new Error("Informe o treinamento.");
      const cargaH = Math.max(0, Math.min(100000, Number(p.carga_h) || 0));
      let id = String(p.id || "").trim();
      if (id) { const ex = await sqlite.execute({ sql: "SELECT slug FROM pessoa_treino WHERE tenant_id = ? AND id = ? LIMIT 1", args: [T, id] }); if (ex.rows.length && String((ex.rows[0] as P).slug) !== alvo) throw new Error("Treinamento de outra pessoa."); }
      else id = crypto.randomUUID().slice(0, 12);
      await sqlite.execute({ sql: "INSERT INTO pessoa_treino (tenant_id, id, slug, nome, instituicao, data, carga_h, obs, atualizado, u) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id, id) DO UPDATE SET nome=excluded.nome, instituicao=excluded.instituicao, data=excluded.data, carga_h=excluded.carga_h, obs=excluded.obs, atualizado=excluded.atualizado, u=excluded.u", args: [T, id, alvo, nome, g("instituicao", 160), g("data", 20), cargaH, g("obs", 600), nowIso, u.slug] });
      await audit("pessoa_treino", u.slug, alvo + ": " + nome, ip);
      return { ok: true, alvo, id };
    }
    if (action === "pessoatreinocomprov") {
      const id = String(p.id || "").trim(); if (!id) throw new Error("Treinamento inválido.");
      const cur = await sqlite.execute({ sql: "SELECT slug, comprov_key FROM pessoa_treino WHERE tenant_id = ? AND id = ? LIMIT 1", args: [T, id] });
      if (!cur.rows.length) throw new Error("Treinamento não encontrado.");
      if (String((cur.rows[0] as P).slug) !== alvo) throw new Error("Treinamento de outra pessoa.");
      const antigo = String((cur.rows[0] as P).comprov_key || "");
      if (p.remover) {
        if (antigo && ENV.BLOB) { try { await ENV.BLOB.delete(antigo); } catch (_) {} }
        await sqlite.execute({ sql: "UPDATE pessoa_treino SET comprov_key='', comprov_nome='', atualizado=?, u=? WHERE tenant_id = ? AND id = ?", args: [nowIso, u.slug, T, id] });
        await audit("pessoa_treino", u.slug, alvo + "/" + id + " (comprov removido)", ip);
        return { ok: true, removido: true };
      }
      if (!ENV.BLOB) throw new Error("Armazenamento de arquivos indisponível.");
      const { bytes } = pdfFromB64(String(p.b64 || p.data || ""));
      const key = "ficha/" + T + "/" + alvo + "/treino-" + id + ".pdf";
      await ENV.BLOB.put(key, bytes, { httpMetadata: { contentType: "application/pdf" } });
      const nome = (g("nome", 160) || "comprovante.pdf");
      await sqlite.execute({ sql: "UPDATE pessoa_treino SET comprov_key=?, comprov_nome=?, atualizado=?, u=? WHERE tenant_id = ? AND id = ?", args: [key, nome, nowIso, u.slug, T, id] });
      await audit("pessoa_treino", u.slug, alvo + "/" + id + " (comprov " + bytes.length + "B)", ip);
      return { ok: true, comprovNome: nome };
    }
    // pessoatreinodel
    const id = String(p.id || "").trim(); if (!id) throw new Error("Treinamento inválido.");
    const cur = await sqlite.execute({ sql: "SELECT comprov_key FROM pessoa_treino WHERE tenant_id = ? AND id = ? AND slug = ? LIMIT 1", args: [T, id, alvo] });
    const ck = String((cur.rows[0] as P || {}).comprov_key || "");
    if (ck && ENV.BLOB) { try { await ENV.BLOB.delete(ck); } catch (_) {} }
    await sqlite.execute({ sql: "DELETE FROM pessoa_treino WHERE tenant_id = ? AND id = ? AND slug = ?", args: [T, id, alvo] });
    await audit("pessoa_treino_del", u.slug, alvo + "/" + id, ip);
    return { ok: true };
  }

  /* ===== Onda 3 / INC 3 — PORTFÓLIO DE SERVIÇOS (artefato de empresa, versionado) =====
   * Leitura: piso equipe (guard MIN). Edição: coordenação/dono (piso coordenacao no guard). */
  if (action === "portf") {
    const u = await auth(p);
    const podeEditar = temPapelMinimo(u.papel, "coordenacao");
    const sv = await sqlite.execute({ sql: "SELECT sid, nome, categoria, resumo, descricao, publico, ordem, ativo, ver_atual, atualizado FROM portfolio_servico WHERE tenant_id = ? ORDER BY ordem, nome", args: [u.tenant_id] });
    const vs = await sqlite.execute({ sql: "SELECT id, sid, versao, descricao, mudancas, data, autor FROM portfolio_versao WHERE tenant_id = ? ORDER BY data DESC, criado DESC", args: [u.tenant_id] });
    const sk = await sqlite.execute({ sql: "SELECT sid, skill FROM portfolio_skill WHERE tenant_id = ?", args: [u.tenant_id] });
    // Quantas PESSOAS têm cada habilidade (por nome, case-insensitive) — liga portfólio ↔ skills.
    const pc = await sqlite.execute({ sql: "SELECT lower(nome) k, COUNT(DISTINCT slug) n FROM pessoa_skill WHERE tenant_id = ? GROUP BY lower(nome)", args: [u.tenant_id] });
    const cnt: Record<string, number> = {}; for (const x of pc.rows as P[]) cnt[String(x.k)] = Number(x.n) || 0;
    const versByS: Record<string, P[]> = {}; for (const v of vs.rows as P[]) (versByS[String(v.sid)] = versByS[String(v.sid)] || []).push(v);
    const skByS: Record<string, P[]> = {}; for (const s of sk.rows as P[]) (skByS[String(s.sid)] = skByS[String(s.sid)] || []).push({ skill: String(s.skill), pessoas: cnt[String(s.skill).toLowerCase()] || 0 });
    const servicos = (sv.rows as P[]).map((x) => ({ ...x, versoes: versByS[String(x.sid)] || [], skills: skByS[String(x.sid)] || [] }));
    const allSk = await sqlite.execute({ sql: "SELECT DISTINCT nome FROM pessoa_skill WHERE tenant_id = ? AND nome <> '' ORDER BY nome", args: [u.tenant_id] });
    return { ok: true, servicos, podeEditar, skillsCatalogo: (allSk.rows as P[]).map((x) => x.nome) };
  }
  if (action === "portfservset" || action === "portfservdel" || action === "portfvernew" ||
      action === "portfverdel" || action === "portfskilladd" || action === "portfskilldel") {
    const u = await auth(p);
    if (!temPapelMinimo(u.papel, "coordenacao")) throw new Error("Apenas a Coordenação edita o portfólio.");
    const T = u.tenant_id; const nowIso = new Date().toISOString();
    const g = (k: string, n: number) => String(p[k] == null ? "" : p[k]).slice(0, n);

    if (action === "portfservset") {
      const nome = g("nome", 160).trim(); if (!nome) throw new Error("Informe o nome do serviço.");
      let sid = String(p.sid || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
      if (!sid) { // novo: deriva do nome e garante unicidade
        let base = (slugColab(nome) || crypto.randomUUID().slice(0, 8)).slice(0, 36); sid = base; let n = 1;
        while ((await sqlite.execute({ sql: "SELECT sid FROM portfolio_servico WHERE tenant_id = ? AND sid = ? LIMIT 1", args: [T, sid] })).rows.length) { n += 1; sid = base + n; if (n > 50) { sid = crypto.randomUUID().slice(0, 8); break; } }
      }
      await sqlite.execute({ sql: "INSERT INTO portfolio_servico (tenant_id, sid, nome, categoria, resumo, descricao, publico, ordem, ativo, atualizado, u) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id, sid) DO UPDATE SET nome=excluded.nome, categoria=excluded.categoria, resumo=excluded.resumo, descricao=excluded.descricao, publico=excluded.publico, ordem=excluded.ordem, ativo=excluded.ativo, atualizado=excluded.atualizado, u=excluded.u", args: [T, sid, nome, g("categoria", 80), g("resumo", 600), g("descricao", 8000), p.publico ? 1 : 0, Math.max(0, Math.min(999, Number(p.ordem) || 0)), (p.ativo == null ? 1 : (p.ativo ? 1 : 0)), nowIso, u.slug] });
      await audit("portfolio_serv", u.slug, sid, ip);
      return { ok: true, sid };
    }
    if (action === "portfservdel") {
      const sid = String(p.sid || "").trim(); if (!sid) throw new Error("Serviço inválido.");
      await sqlite.execute({ sql: "DELETE FROM portfolio_servico WHERE tenant_id = ? AND sid = ?", args: [T, sid] });
      await sqlite.execute({ sql: "DELETE FROM portfolio_versao WHERE tenant_id = ? AND sid = ?", args: [T, sid] });
      await sqlite.execute({ sql: "DELETE FROM portfolio_skill WHERE tenant_id = ? AND sid = ?", args: [T, sid] });
      await audit("portfolio_serv_del", u.slug, sid, ip);
      return { ok: true };
    }
    if (action === "portfvernew") {
      const sid = String(p.sid || "").trim(); if (!sid) throw new Error("Serviço inválido.");
      const ex = await sqlite.execute({ sql: "SELECT sid FROM portfolio_servico WHERE tenant_id = ? AND sid = ? LIMIT 1", args: [T, sid] });
      if (!ex.rows.length) throw new Error("Serviço inexistente.");
      const versao = g("versao", 40).trim() || "s/ nº";
      const data = g("data", 20).trim() || nowIso.slice(0, 10);
      const id = crypto.randomUUID().slice(0, 12);
      await sqlite.execute({ sql: "INSERT INTO portfolio_versao (tenant_id, id, sid, versao, descricao, mudancas, data, autor, criado) VALUES (?,?,?,?,?,?,?,?,?)", args: [T, id, sid, versao, g("descricao", 4000), g("mudancas", 4000), data, u.slug, nowIso] });
      await sqlite.execute({ sql: "UPDATE portfolio_servico SET ver_atual = ?, atualizado = ?, u = ? WHERE tenant_id = ? AND sid = ?", args: [versao, nowIso, u.slug, T, sid] });
      await audit("portfolio_ver", u.slug, sid + " " + versao, ip);
      return { ok: true, id, versao };
    }
    if (action === "portfverdel") {
      const id = String(p.id || "").trim(); if (!id) throw new Error("Versão inválida.");
      const cur = await sqlite.execute({ sql: "SELECT sid FROM portfolio_versao WHERE tenant_id = ? AND id = ? LIMIT 1", args: [T, id] });
      const sid = String((cur.rows[0] as P || {}).sid || "");
      await sqlite.execute({ sql: "DELETE FROM portfolio_versao WHERE tenant_id = ? AND id = ?", args: [T, id] });
      if (sid) { // recomputa ver_atual = versão mais recente restante
        const last = await sqlite.execute({ sql: "SELECT versao FROM portfolio_versao WHERE tenant_id = ? AND sid = ? ORDER BY data DESC, criado DESC LIMIT 1", args: [T, sid] });
        await sqlite.execute({ sql: "UPDATE portfolio_servico SET ver_atual = ?, atualizado = ? WHERE tenant_id = ? AND sid = ?", args: [String((last.rows[0] as P || {}).versao || ""), nowIso, T, sid] });
      }
      await audit("portfolio_ver_del", u.slug, id, ip);
      return { ok: true };
    }
    // portfskilladd / portfskilldel
    const sid = String(p.sid || "").trim(); if (!sid) throw new Error("Serviço inválido.");
    const skill = g("skill", 120).trim(); if (!skill) throw new Error("Informe a habilidade.");
    if (action === "portfskilladd") {
      await sqlite.execute({ sql: "INSERT OR IGNORE INTO portfolio_skill (tenant_id, sid, skill) VALUES (?,?,?)", args: [T, sid, skill] });
      await audit("portfolio_skill", u.slug, sid + " + " + skill, ip);
      return { ok: true };
    }
    await sqlite.execute({ sql: "DELETE FROM portfolio_skill WHERE tenant_id = ? AND sid = ? AND skill = ?", args: [T, sid, skill] });
    await audit("portfolio_skill", u.slug, sid + " - " + skill, ip);
    return { ok: true };
  }

  /* ===== G3 — Gestão de colaboradores (tabela `membro` editável pelo RH) =====
   * A `membro` já é a autoridade de auth; aqui a Coord. Adm/RH mantém o quadro:
   * adiciona, edita (nome/e-mail/papel), inativa/reativa e (com guardas) remove.
   * Gate: mesma capability de pessoas (`pessoas.cargo_atribuir`) ou Coordenação. */
  if (action === "rhmembros") {
    const u = await auth(p);
    const caps = await capsDe({ slug: u.slug, papel: u.papel });
    if (!u.coord && !temCapSet(caps, "pessoas.cargo_atribuir")) throw new Error("Sem permissão para gerir colaboradores.");
    const r = await sqlite.execute({ sql: "SELECT slug, nome, email, papel, ativo FROM membro WHERE tenant_id = ? ORDER BY ativo DESC, papel, nome", args: [u.tenant_id] });
    // Marca quem tem histórico de horas (não deve ser excluído, só inativado).
    const hr = await sqlite.execute({ sql: "SELECT slug, COUNT(*) AS n FROM lanc WHERE tenant_id = ? GROUP BY slug", args: [u.tenant_id] });
    const hist: Record<string, number> = {};
    for (const x of hr.rows as P[]) hist[String(x.slug)] = Number(x.n) || 0;
    // Onda 3: cargo PRINCIPAL + nº de cargos por pessoa (membro_cargo), com fallback ao legado.
    const atrib: Record<string, string> = {}; const nCargos: Record<string, number> = {};
    try {
      const mc = await sqlite.execute({ sql: "SELECT slug, cid, principal FROM membro_cargo WHERE tenant_id = ? ORDER BY principal DESC, prioridade, cid", args: [u.tenant_id] });
      for (const x of mc.rows as P[]) { const s = String(x.slug); nCargos[s] = (nCargos[s] || 0) + 1; if (!atrib[s]) atrib[s] = String(x.cid); }
    } catch (_) { /* tabela ainda nao existe */ }
    const cfg = await sqlite.execute({ sql: "SELECT k, v FROM config WHERE tenant_id = ? AND k LIKE 'cargocid:%'", args: [u.tenant_id] });
    for (const c of cfg.rows as P[]) { const s = String(c.k).slice(9); const v = String(c.v || "").trim(); if (v && !atrib[s]) { atrib[s] = v; nCargos[s] = nCargos[s] || 1; } }
    const membros = (r.rows as P[]).map((m) => ({
      slug: String(m.slug), nome: String(m.nome || m.slug), email: String(m.email || ""),
      papel: String(m.papel || "equipe"), ativo: Number(m.ativo) ? 1 : 0,
      cargocid: atrib[String(m.slug)] || "", cargos_n: nCargos[String(m.slug)] || 0, lancs: hist[String(m.slug)] || 0,
      owner: isOwner(String(m.slug)),
    }));
    return { ok: true, membros, podeGerir: true, papeis: PAPEIS.filter((x) => x !== "admin") };
  }
  if (action === "rhmembroadd") {
    const u = await auth(p);
    const caps = await capsDe({ slug: u.slug, papel: u.papel });
    if (!u.coord && !temCapSet(caps, "pessoas.cargo_atribuir")) throw new Error("Sem permissão para gerir colaboradores.");
    const nome = String(p.nome || "").trim().slice(0, 120);
    if (nome.length < 2) throw new Error("Informe o nome do colaborador.");
    const email = String(p.email || "").trim().toLowerCase().slice(0, 160);
    let papel = String(p.papel || "equipe").trim() as Papel;
    if (!PAPEIS.includes(papel) || papel === "admin") papel = "equipe"; // 'admin' só por concessão do dono
    let base = slugColab(nome);
    if (!base) throw new Error("Nome inválido para gerar o identificador.");
    // Garante slug único no tenant (sufixo numérico se já existir).
    let slug = base, n = 1;
    while (true) {
      const ex = await sqlite.execute({ sql: "SELECT slug FROM membro WHERE tenant_id = ? AND slug = ? LIMIT 1", args: [u.tenant_id, slug] });
      if (!ex.rows.length) break;
      n += 1; slug = base + n;
      if (n > 50) throw new Error("Não foi possível gerar um identificador único.");
    }
    const hoje = new Date().toISOString().slice(0, 10);
    await sqlite.execute({
      sql: "INSERT INTO membro (tenant_id, slug, papel, nome, email, ativo, criado) VALUES (?,?,?,?,?,1,?)",
      args: [u.tenant_id, slug, papel, nome, email, hoje],
    });
    if (email) { try { await cfgSet("email:" + slug, email); } catch (_) { /* best-effort */ } }
    await audit("membro_add", u.slug, slug + " (" + papel + ")", ip);
    return { ok: true, slug };
  }
  if (action === "rhmembroset") {
    const u = await auth(p);
    const caps = await capsDe({ slug: u.slug, papel: u.papel });
    if (!u.coord && !temCapSet(caps, "pessoas.cargo_atribuir")) throw new Error("Sem permissão para gerir colaboradores.");
    const slug = String(p.slug || "").trim();
    if (!slug) throw new Error("Colaborador inválido.");
    const cur = await sqlite.execute({ sql: "SELECT slug, papel, ativo FROM membro WHERE tenant_id = ? AND slug = ? LIMIT 1", args: [u.tenant_id, slug] });
    if (!cur.rows.length) throw new Error("Colaborador não encontrado.");
    const curPapel = String((cur.rows[0] as P).papel || "equipe");
    const sets: string[] = [], args: (string | number)[] = [];
    if (p.nome != null) { const nome = String(p.nome).trim().slice(0, 120); if (nome.length < 2) throw new Error("Nome inválido."); sets.push("nome = ?"); args.push(nome); }
    if (p.email != null) { const email = String(p.email).trim().toLowerCase().slice(0, 160); sets.push("email = ?"); args.push(email); if (email) { try { await cfgSet("email:" + slug, email); } catch (_) {} } }
    if (p.papel != null) {
      let papel = String(p.papel).trim() as Papel;
      if (!PAPEIS.includes(papel)) throw new Error("Papel desconhecido.");
      if (isOwner(slug) && papel !== "admin") throw new Error("O dono do portal não pode ser rebaixado aqui.");
      if (papel === "admin" && curPapel !== "admin") throw new Error("O papel de Administração é concedido só pelo dono, na aba Permissões.");
      sets.push("papel = ?"); args.push(papel);
    }
    if (p.ativo != null) {
      const ativo = Number(p.ativo) ? 1 : 0;
      if (!ativo && isOwner(slug)) throw new Error("O dono do portal não pode ser inativado.");
      if (!ativo && slug === u.slug) throw new Error("Você não pode inativar a si mesmo.");
      sets.push("ativo = ?"); args.push(ativo);
    }
    if (!sets.length) throw new Error("Nada para alterar.");
    args.push(u.tenant_id, slug);
    await sqlite.execute({ sql: "UPDATE membro SET " + sets.join(", ") + " WHERE tenant_id = ? AND slug = ?", args });
    await audit("membro_set", u.slug, slug + ": " + sets.join(","), ip);
    return { ok: true };
  }
  if (action === "rhmembrodel") {
    const u = await auth(p);
    const caps = await capsDe({ slug: u.slug, papel: u.papel });
    if (!u.coord && !temCapSet(caps, "pessoas.cargo_atribuir")) throw new Error("Sem permissão para gerir colaboradores.");
    const slug = String(p.slug || "").trim();
    if (!slug) throw new Error("Colaborador inválido.");
    if (isOwner(slug)) throw new Error("O dono do portal não pode ser removido.");
    if (slug === u.slug) throw new Error("Você não pode remover a si mesmo.");
    const ex = await sqlite.execute({ sql: "SELECT slug FROM membro WHERE tenant_id = ? AND slug = ? LIMIT 1", args: [u.tenant_id, slug] });
    if (!ex.rows.length) throw new Error("Colaborador não encontrado.");
    // Guarda de histórico: com lançamentos, só inativar (preserva a trilha).
    const h = await sqlite.execute({ sql: "SELECT COUNT(*) AS n FROM lanc WHERE tenant_id = ? AND slug = ?", args: [u.tenant_id, slug] });
    if (Number((h.rows[0] as P).n) > 0) throw new Error("Este colaborador tem horas lançadas; inative em vez de excluir (preserva o histórico).");
    await sqlite.execute({ sql: "DELETE FROM membro WHERE tenant_id = ? AND slug = ?", args: [u.tenant_id, slug] });
    try { await sqlite.execute({ sql: "DELETE FROM membro_cargo WHERE tenant_id = ? AND slug = ?", args: [u.tenant_id, slug] }); } catch (_) {}
    try { await cfgDel("cargocid:" + slug); } catch (_) {}
    try { await cfgDel("cargo:" + slug); } catch (_) {}
    await audit("membro_del", u.slug, slug, ip);
    return { ok: true };
  }

  if (action === "add") {
    const u = await auth(p);
    const e = validEntry(p.entry);
    const id = crypto.randomUUID().slice(0, 8);
    await sqlite.execute({
      sql: "INSERT INTO lanc (id, slug, d, cc, h, t, s, m, a, c, u, tenant_id) VALUES (?,?,?,?,?,?,'PENDENTE','','',?,?,?)",
      args: [id, u.slug, e.d, e.cc, e.h, e.t, now, now, u.tenant_id],
    });
    return { ok: true, id };
  }

  if (action === "edit") {
    const u = await auth(p);
    const cur = await getLanc(String(p.id), u.tenant_id);
    if (cur.slug !== u.slug && !u.coord) throw new Error("Só é possível editar o próprio lançamento.");
    if (cur.s !== "PENDENTE" && cur.s !== "DEVOLVIDO") throw new Error("Lançamento " + cur.s + " não pode mais ser editado.");
    const e = validEntry(p.entry);
    await sqlite.execute({
      sql: "UPDATE lanc SET d=?, cc=?, h=?, t=?, s='PENDENTE', m='', a='', u=? WHERE id=? AND tenant_id=?",
      args: [e.d, e.cc, e.h, e.t, now, String(p.id), u.tenant_id],
    });
    return { ok: true };
  }

  if (action === "del") {
    const u = await auth(p);
    const cur = await getLanc(String(p.id), u.tenant_id);
    if (cur.slug !== u.slug && !u.coord) throw new Error("Só é possível excluir o próprio lançamento.");
    if (cur.s !== "PENDENTE" && cur.s !== "DEVOLVIDO") throw new Error("Lançamento " + cur.s + " não pode ser excluído.");
    await sqlite.execute({ sql: "DELETE FROM lanc WHERE id = ? AND tenant_id = ?", args: [String(p.id), u.tenant_id] });
    return { ok: true };
  }

  if (action === "situacao") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação analisa lançamentos.");
    const s = String(p.s || "");
    if (!SITS.includes(s)) throw new Error("Situação inválida.");
    await getLanc(String(p.id), u.tenant_id);
    await sqlite.execute({
      sql: "UPDATE lanc SET s=?, m=?, a=CASE WHEN ?='APROVADO' THEN ? ELSE a END, u=? WHERE id=? AND tenant_id=?",
      args: [s, s === "DEVOLVIDO" ? String(p.m || "") : "", s, now.slice(0, 10), now, String(p.id), u.tenant_id],
    });
    return { ok: true };
  }

  if (action === "consolidar") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação consolida.");
    const r = await sqlite.execute({ sql: "UPDATE lanc SET s='LANÇADO', u=? WHERE s='APROVADO' AND tenant_id=?", args: [now, u.tenant_id] });
    await audit("consolidar", u.slug, String(r.rowsAffected ?? 0) + " lançamentos", ip);
    return { ok: true, n: r.rowsAffected ?? 0 };
  }

  if (action === "addproj") {
    /* 6.1 — acesso por ACAO: quem tem `projetos.aprovar` cadastra ATIVO direto; quem so tem
     * `projetos.submeter` cadastra como PROPOSTO (pendente). Sem capability nenhuma => negado. */
    const u = await auth(p);
    const caps = await capsDe({ slug: u.slug, papel: u.papel });
    const podeAprovar = temCapSet(caps, "projetos.aprovar");
    const podeSubmeter = podeAprovar || temCapSet(caps, "projetos.submeter");
    if (!podeSubmeter) throw new Error("Você não tem permissão para cadastrar/propor projetos.");
    const pr = p.proj || {};
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(String(pr.cc || "")) || String(pr.projeto || "").trim().length < 3)
      throw new Error("Projeto incompleto.");
    if (!STATUSES.includes(String(pr.status || ""))) throw new Error("Status inválido.");
    const dup = await sqlite.execute({ sql: "SELECT cc FROM proj WHERE cc = ? AND tenant_id = ?", args: [String(pr.cc), u.tenant_id] });
    if (dup.rows.length) throw new Error("Centro de custo " + pr.cc + " já existe.");
    const reg = podeAprovar ? "ATIVO" : "PROPOSTO";
    await sqlite.execute({
      sql: "INSERT INTO proj (cc, projeto, subtipo, status, inicio, previsto, fim, registro, alterado_por, alterado_em, tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      args: [String(pr.cc), String(pr.projeto).trim(), String(pr.subtipo || ""), String(pr.status), dataISO(pr.inicio), dataISO(pr.previsto), dataISO(pr.fim), reg, u.slug, new Date().toISOString(), u.tenant_id],
    });
    await audit(reg === "ATIVO" ? "projeto_add" : "projeto_proposto", u.slug, String(pr.cc) + " " + String(pr.projeto), ip);
    return { ok: true, estado: reg };
  }
  if (action === "projpropostas") {
    /* Lista os projetos PROPOSTOS (pendentes). Gate por capability — so quem aprova enxerga. */
    const u = await auth(p);
    const caps = await capsDe({ slug: u.slug, papel: u.papel });
    if (!temCapSet(caps, "projetos.aprovar")) throw new Error("Apenas quem aprova projetos vê as propostas.");
    const r = await sqlite.execute({ sql: "SELECT cc, projeto, subtipo, status, inicio, previsto, fim, alterado_por, alterado_em FROM proj WHERE tenant_id = ? AND registro = 'PROPOSTO' ORDER BY alterado_em DESC", args: [u.tenant_id] });
    return { ok: true, propostas: r.rows };
  }
  if (action === "projaprovar") {
    /* Aprova (PROPOSTO -> ATIVO) ou rejeita (PROPOSTO -> REJEITADO) uma proposta. */
    const u = await auth(p);
    const caps = await capsDe({ slug: u.slug, papel: u.papel });
    if (!temCapSet(caps, "projetos.aprovar")) throw new Error("Apenas quem aprova projetos pode decidir.");
    const cc = String(p.cc || "");
    const cur = await sqlite.execute({ sql: "SELECT registro FROM proj WHERE cc = ? AND tenant_id = ?", args: [cc, u.tenant_id] });
    if (!cur.rows.length) throw new Error("Projeto não encontrado.");
    if (String((cur.rows[0] as P).registro) !== "PROPOSTO") throw new Error("Este projeto não está pendente de aprovação.");
    const rejeita = String(p.decisao || "aprovar") === "rejeitar";
    const novo = rejeita ? "REJEITADO" : "ATIVO";
    await sqlite.execute({ sql: "UPDATE proj SET registro = ?, alterado_por = ?, alterado_em = ? WHERE cc = ? AND tenant_id = ?", args: [novo, u.slug, new Date().toISOString(), cc, u.tenant_id] });
    await audit(rejeita ? "projeto_rejeitado" : "projeto_aprovado", u.slug, cc, ip);
    return { ok: true, estado: novo };
  }

  if (action === "setprazos") {
    /* Datas do projeto — início, previsto e fim. A planilha entrou como ponto de partida;
       daqui em diante o que vale é o que a Coordenação registra aqui, com autor e hora. */
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação altera as datas do projeto.");
    const cc = String(p.cc || "");
    const dt = (v: unknown) => {
      const s = String(v || "").trim();
      if (!s) return "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Data inválida: " + s);
      return s;
    };
    const inicio = dt(p.inicio), previsto = dt(p.previsto), fim = dt(p.fim);
    if (previsto && inicio && previsto < inicio) throw new Error("A data prevista não pode ser anterior ao início.");
    if (fim && inicio && fim < inicio) throw new Error("A data de conclusão não pode ser anterior ao início.");
    const status = String(p.status || "");
    if (status && !STATUSES.includes(status)) throw new Error("Status inválido.");
    const agora = new Date().toISOString();
    const cur = await sqlite.execute({ sql: "SELECT cc FROM proj WHERE cc = ? AND tenant_id = ?", args: [cc, u.tenant_id] });
    if (cur.rows.length) {
      await sqlite.execute({
        sql: "UPDATE proj SET inicio = ?, previsto = ?, fim = ?" + (status ? ", status = ?" : "")
          + ", alterado_por = ?, alterado_em = ? WHERE cc = ? AND tenant_id = ?",
        args: status
          ? [inicio, previsto, fim, status, u.slug, agora, cc, u.tenant_id]
          : [inicio, previsto, fim, u.slug, agora, cc, u.tenant_id],
      });
    } else {
      const b = p.base || {};
      await sqlite.execute({
        sql: `INSERT INTO proj (cc, projeto, subtipo, status, inicio, previsto, fim, registro, alterado_por, alterado_em, tenant_id)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        args: [cc, String(b.projeto || cc), String(b.subtipo || ""), status || String(b.status || "EM ANDAMENTO"),
          inicio, previsto, fim, String(b.registro || "ATIVO"), u.slug, agora, u.tenant_id],
      });
    }
    await audit("prazos", u.slug, cc + ": " + (inicio || "—") + " → " + (previsto || "—") + (fim ? " · fim " + fim : ""), ip);
    return { ok: true, alterado_por: u.slug, alterado_em: agora };
  }

  if (action === "setstatus") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação altera status.");
    if (!STATUSES.includes(String(p.status))) throw new Error("Status inválido.");
    const cc = String(p.cc || "");
    const cur = await sqlite.execute({ sql: "SELECT cc FROM proj WHERE cc = ? AND tenant_id = ?", args: [cc, u.tenant_id] });
    if (cur.rows.length) {
      await sqlite.execute({ sql: "UPDATE proj SET status = ? WHERE cc = ? AND tenant_id = ?", args: [String(p.status), cc, u.tenant_id] });
    } else {
      const b = p.base || {};
      await sqlite.execute({
        sql: "INSERT INTO proj (cc, projeto, subtipo, status, inicio, previsto, fim, registro, tenant_id) VALUES (?,?,?,?,?,?,?,?,?)",
        args: [cc, String(b.projeto || cc), String(b.subtipo || ""), String(p.status), dataISO(b.inicio), dataISO(b.previsto), dataISO(b.fim), String(b.registro || "ATIVO"), u.tenant_id],
      });
    }
    return { ok: true };
  }

  if (action === "catset") {
    const u = await auth(p); if (!u.coord) throw new Error("Apenas a Coordenação importa o catálogo.");
    const j = String(p.json || ""); if (j.length < 2) throw new Error("JSON do catálogo vazio.");
    try { JSON.parse(j); } catch { throw new Error("JSON do catálogo inválido."); }
    await cfgSet("cat:json", j); await audit("catset", u.slug, "catalogo " + j.length + " bytes", ip);
    return { ok: true, bytes: j.length };
  }

  if (action === "catinfo") {
    const u = await auth(p); if (!u.coord) throw new Error("Apenas a Coordenação.");
    const j = await cfgGet("cat:json"); if (!j) return { ok: true, carregado: false };
    const o = JSON.parse(j);
    return { ok: true, carregado: true, bytes: j.length, acervo: (o.acervo || []).length, precedentes: (o.prec || []).length, dominios: Object.keys(o.param || {}) };
  }

  if (action === "mcptoken") {
    const u = await auth(p); if (!u.coord) throw new Error("Apenas a Coordenação emite token de MCP.");
    const alvo = String(p.alvo || ""); if (!COLABS.includes(alvo)) throw new Error("Colaborador desconhecido.");
    const antigo = await cfgGet("mcptoken:" + alvo); if (antigo) await cfgDel("mcptokh:" + antigo);
    const tok = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tok));
    const hx = [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    await cfgSet("mcptoken:" + alvo, hx); await cfgSet("mcptokh:" + hx, alvo);
    await audit("mcptoken", u.slug, alvo, ip);
    return { ok: true, alvo, token: tok };
  }

  if (action === "mcptokens") {
    const u = await auth(p); if (!u.coord) throw new Error("Apenas a Coordenação.");
    const r = await sqlite.execute({ sql: "SELECT k FROM config WHERE k LIKE 'mcptoken:%' AND tenant_id = ?", args: [TENANT_INTELECTO] });
    return { ok: true, slugs: r.rows.map((x: P) => String(x.k).slice(9)) };
  }

  if (action === "mcprevoke") {
    const u = await auth(p); if (!u.coord) throw new Error("Apenas a Coordenação revoga token de MCP.");
    const alvo = String(p.alvo || ""); const hx = await cfgGet("mcptoken:" + alvo);
    if (hx) { await cfgDel("mcptokh:" + hx); await cfgDel("mcptoken:" + alvo); }
    await audit("mcprevoke", u.slug, alvo, ip);
    return { ok: true, alvo };
  }

  if (action === "acervo_busca") {
    const u = await auth(p);
    const acok = isOwner(u.slug) || grantValid(await cfgGet("acgrant:" + u.slug)) || temCapSet(await capsAtribuidas(u), "acervo.consultar");
    if (!acok) throw new Error("Sem acesso ao acervo. Peça liberação ao dono do portal.");
    const q = String(p.q || p.termo || "").trim();
    if (!q) return { ok: true, hits: [] };
    const k = Math.min(Number(p.top_k) || 8, 15);
    const r: any = await ENV.AI.autorag("acervo-intelecto").search({ query: q, max_num_results: k });
    const data = (r && r.data) || [];
    await audit("acervo_busca", u.slug, q.slice(0, 60), ip);
    return { ok: true, hits: data.map((d: any) => ({ arquivo: d.filename, score: d.score, trecho: ((d.content || []).map((c: any) => c.text).join("\n")).slice(0, 1200) })) };
  }

  if (action === "perms") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "sistema.config"))) throw new Error("Acesso às permissões restrito à direção (Sócios).");
    const r = await sqlite.execute({ sql: "SELECT k, v FROM config WHERE tenant_id = ? AND (k LIKE 'perm:%' OR k LIKE 'acgrant:%')", args: [TENANT_INTELECTO] });
    const areas: Record<string, string[]> = {};
    const acgrant: Record<string, string> = {};
    for (const x of r.rows as P[]) {
      const k = String(x.k);
      if (k.startsWith("perm:")) areas[k.slice(5)] = String(x.v).split(",").filter(Boolean);
      else if (k.startsWith("acgrant:")) acgrant[k.slice(8)] = String(x.v);
    }
    return { ok: true, areas, acgrant, catAreasProt: AREAS_PROT, colabs: COLABS, nomes: NOMES, coords: COORDS, owner: OWNER, acervoTools: ACERVO_TOOLS };
  }

  if (action === "permset") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "sistema.config"))) throw new Error("Definir permissões restrito à direção (Sócios).");
    const area = String(p.area || ""); if (!AREAS_PROT_COD.includes(area)) throw new Error("Area desconhecida.");
    const raw = Array.isArray(p.slugs) ? p.slugs : String(p.slugs || "").split(",");
    const slugs = raw.map((x: any) => String(x).trim()).filter((x: string) => COLABS.includes(x));
    if (slugs.length) await cfgSet("perm:" + area, slugs.join(",")); else await cfgDel("perm:" + area);
    await audit("permset", u.slug, area + "=" + slugs.join(","), ip);
    return { ok: true, area, slugs };
  }

  if (action === "acset") {
    const u = await auth(p); if (!(isOwner(u.slug) || temCapSet(await capsAtribuidas(u), "sistema.config"))) throw new Error("Conceder acesso ao acervo restrito à direção (Sócios).");
    const alvo = String(p.alvo || ""); if (!COLABS.includes(alvo)) throw new Error("Colaborador desconhecido.");
    let modo = String(p.modo || "").trim().toUpperCase();
    let val = "";
    if (modo === "PERM") val = "PERM";
    else if (modo === "TEMP") { const dt = String(p.ate || "").trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) throw new Error("Informe a data limite AAAA-MM-DD."); val = dt; }
    else if (modo === "" || modo === "NENHUM" || modo === "SEM") val = "";
    else throw new Error("Modo invalido.");
    if (val) await cfgSet("acgrant:" + alvo, val); else await cfgDel("acgrant:" + alvo);
    await audit("acset", u.slug, alvo + "=" + (val || "sem"), ip);
    return { ok: true, alvo, val };
  }

  /* ============================================================================
   * SHOWCASE & PORTAL DO CLIENTE — vitrine executiva + isolamento por cliente
   * --------------------------------------------------------------------------
   * Audiência: interno (equipe+ vê tudo do tenant) + papel 'cliente' read-only, que vê
   * SOMENTE os projetos/entregas do SEU cliente que foram LIBERADOS a ele. A negação é
   * no SERVIDOR (este branch), nunca na UI. Nenhum campo monetário circula — as colunas
   * selecionadas de proj/prod não têm custo/preço (regra de confidencialidade da casa).
   * ========================================================================== */
  if (action === "setmembrocliente") {
    // Associa um usuário de papel 'cliente' ao cliente (valor de proj.cliente) que ele
    // representa. Piso 'coordenacao' (guard central). Só se aplica a papel 'cliente' —
    // papéis internos têm a coluna vazia por definição. Auditada.
    const u = await auth(p);
    const slug = String(p.slug || "").trim().toLowerCase();
    const cliente = String(p.cliente || "").trim();
    if (!slug) throw new Error("Informe o usuário.");
    const r = await sqlite.execute({ sql: "SELECT papel FROM membro WHERE slug = ? AND tenant_id = ? LIMIT 1", args: [slug, u.tenant_id] });
    if (!r.rows.length) throw new Error("Usuário não encontrado neste tenant.");
    if (String((r.rows[0] as P).papel || "") !== "cliente") throw new Error("A associação de cliente só se aplica a usuários de papel Cliente.");
    await sqlite.execute({ sql: "UPDATE membro SET cliente = ? WHERE slug = ? AND tenant_id = ?", args: [cliente, slug, u.tenant_id] });
    await audit("membro_cliente_set", u.slug, "alvo:" + slug + " cliente:" + (cliente || "—") + " tenant:" + u.tenant_id, ip);
    return { ok: true, slug, cliente };
  }

  if (action === "liberarcliente") {
    // Marca/desmarca um projeto como liberado ao cliente dele. Piso 'coordenacao' (guard).
    // Sempre dentro do tenant de quem age (u.tenant_id). Auditada.
    const u = await auth(p);
    const cc = String(p.cc || "").trim();
    const on = (p.on === true || p.on === 1 || String(p.on) === "1" || String(p.on) === "true") ? 1 : 0;
    if (!cc) throw new Error("Informe o centro de custo.");
    const cur = await sqlite.execute({ sql: "SELECT cc FROM proj WHERE cc = ? AND tenant_id = ?", args: [cc, u.tenant_id] });
    if (!cur.rows.length) throw new Error("Projeto não encontrado neste tenant.");
    await sqlite.execute({ sql: "UPDATE proj SET liberado_cliente = ? WHERE cc = ? AND tenant_id = ?", args: [on, cc, u.tenant_id] });
    await audit("liberar_cliente", u.slug, "cc:" + cc + " liberado:" + on + " tenant:" + u.tenant_id, ip);
    return { ok: true, cc, liberado: on };
  }

  if (action === "showcase") {
    // Projeção por papel. Interno (equipe+): tudo do tenant, com flag de liberado. Cliente:
    // SOMENTE proj do SEU cliente (membro.cliente, lido no servidor) com liberado_cliente=1,
    // e os prod correspondentes. O filtro por cliente NUNCA vem do que o cliente alega.
    const u = await auth(p);
    const interno = temPapelMinimo(u.papel, "equipe"); // equipe < coordenacao < admin
    const projCols = "cc, projeto, subtipo, status, inicio, previsto, fim, empresa, cliente, tipo, liberado_cliente";
    const prodCols = "n, titulo, tipo, sit, met, norma, apr, sec, ccs"; // sem coluna monetária
    let projRows: P[] = [];
    let prodRows: P[] = [];
    let cliente = "";
    if (interno) {
      const pr = await sqlite.execute({ sql: "SELECT " + projCols + " FROM proj WHERE tenant_id = ? ORDER BY cc", args: [u.tenant_id] });
      projRows = pr.rows as P[];
      const pd = await sqlite.execute({ sql: "SELECT " + prodCols + " FROM prod WHERE tenant_id = ? ORDER BY n", args: [u.tenant_id] });
      prodRows = pd.rows as P[];
    } else {
      // papel === 'cliente' (fornecedor nem chega aqui: guard + FORNECEDOR_OK). O cliente que
      // ele representa vem do SERVIDOR (membro.cliente), nunca do payload.
      const mr = await sqlite.execute({ sql: "SELECT cliente FROM membro WHERE slug = ? AND tenant_id = ? LIMIT 1", args: [u.slug, u.tenant_id] });
      cliente = mr.rows.length ? String((mr.rows[0] as P).cliente || "") : "";
      if (!cliente) {
        // Cliente sem associação não vê NADA (fail-closed) — nunca "todos" por engano.
        return { ok: true, papel: u.papel, modoCliente: true, cliente: "", proj: [], prod: [], andam: {} };
      }
      const pr = await sqlite.execute({
        sql: "SELECT " + projCols + " FROM proj WHERE tenant_id = ? AND cliente = ? AND liberado_cliente = 1 ORDER BY cc",
        args: [u.tenant_id, cliente],
      });
      projRows = pr.rows as P[];
      const scope = new Set(projRows.map((x) => String(x.cc)));
      if (scope.size) {
        const pd = await sqlite.execute({ sql: "SELECT " + prodCols + " FROM prod WHERE tenant_id = ? ORDER BY n", args: [u.tenant_id] });
        prodRows = (pd.rows as P[]).filter((x) => String(x.ccs || "").split(/[\s,;]+/).filter(Boolean).some((t) => scope.has(t)));
      }
    }
    // VITRINE = portfólio de ENTREGAS: só projetos CONCLUÍDOS (exclui cancelados e em andamento).
    projRows = projRows.filter((x) => /CONCLU/i.test(String(x.status || "")));
    // Andamento (progresso/etapa) dos projetos em escopo — última linha por cc, dentro do tenant.
    const ccScope = new Set(projRows.map((x) => String(x.cc)));
    const andam: Record<string, P> = {};
    if (ccScope.size) {
      const ar = await sqlite.execute({ sql: "SELECT cc, etapa, total, d, detalhe FROM andam WHERE tenant_id = ? ORDER BY d ASC, criado ASC", args: [u.tenant_id] });
      for (const row of ar.rows as P[]) {
        const cc = String(row.cc);
        if (!ccScope.has(cc)) continue;
        andam[cc] = { etapa: Number(row.etapa) || 0, total: Number(row.total) || 0, d: String(row.d || ""), detalhe: String(row.detalhe || "") };
      }
    }
    return { ok: true, papel: u.papel, modoCliente: !interno, cliente, proj: projRows, prod: prodRows, andam };
  }

  /* ============================================================================
   * DAILY BRIEF — radar de editais/noticias com triagem por IA (inteligencia INTERNA)
   * --------------------------------------------------------------------------
   * `brief` lista (piso equipe); `briefadd`/`briefdel` gerem (piso coordenacao) — o guard
   * central ja negou cliente/fornecedor. Tudo filtrado por u.tenant_id (confidencialidade).
   * A IA roda SO no servidor (env.AI); falha dela nunca derruba a requisicao (fallback A_TRIAR).
   * Sem valor monetario. Ingestao hoje = curadoria manual; fontes automaticas ficam previstas
   * em `brief_fontes` (ver BRIEF_FONTES_SEED), sem busca/scraping nesta rodada.
   * ========================================================================== */
  if (action === "briefadd") {
    const u = await auth(p);
    if (!temCapSet(await capsDe(u), "brief.curar")) throw new Error("Seu cargo não permite curar o Daily Brief.");
    // categoria rica (default do `tipo` legado quando so veio tipo, p/ compat com UI antiga)
    const cat = briefCat(p.categoria || (String(p.tipo || "").trim().toLowerCase() === "edital" ? "edital" : "noticia"));
    const tipo = catToTipo(cat);
    const url = String(p.url || "").trim();
    const texto = String(p.texto || p.conteudo || "").trim();
    let titulo = String(p.titulo || "").trim();
    let fonte = String(p.fonte || "").trim();
    if (url && !/^https?:\/\//i.test(url)) throw new Error("URL inválida — use http(s):// ou cole o texto.");
    if (!url && !texto) throw new Error("Informe a URL ou cole o texto do edital/notícia.");
    // Monta o conteudo a triar: texto colado tem prioridade; senao tenta baixar da URL.
    let conteudo = texto;
    if (url) {
      if (!conteudo) conteudo = await briefFetch(url);
      if (!fonte) { try { fonte = new URL(url).hostname.replace(/^www\./, ""); } catch (_) { /* url ja validada */ } }
    }
    if (!conteudo || conteudo.length < 20) {
      throw new Error("Não foi possível ler o conteúdo da URL. Cole o texto do edital/notícia para triar.");
    }
    const tri = await triagemIA(conteudo, tipo);
    if (!titulo) titulo = (tri && tri.titulo) || conteudo.slice(0, 120).replace(/\s+\S*$/, "") || "(sem título)";
    const id = crypto.randomUUID().slice(0, 8);
    const data = /^\d{4}-\d{2}-\d{2}/.test(String(p.data || "")) ? String(p.data).slice(0, 10) : now.slice(0, 10);
    const sit = tri ? "TRIADO" : "A_TRIAR";
    const chave = await briefChave(u.tenant_id, url, titulo);
    await sqlite.execute({
      sql: "INSERT INTO brief (id,tenant_id,tipo,categoria,titulo,fonte,url,data,resumo,score,tags,area,origem,sit,autor,criado,chave,fonte_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'manual', ?,?,?,?, '')",
      args: [id, u.tenant_id, tipo, cat, titulo.slice(0, 240), fonte.slice(0, 120), url.slice(0, 500), data,
        tri ? tri.resumo : "", tri ? tri.score : 0, tri ? tri.tags : "", tri ? tri.area : "", sit, u.slug, now, chave],
    });
    await audit("brief_add", u.slug, "id:" + id + " cat:" + cat + " sit:" + sit + " score:" + (tri ? tri.score : "-") + " tenant:" + u.tenant_id, ip);
    return { ok: true, id, triado: !!tri, sit, score: tri ? tri.score : 0, resumo: tri ? tri.resumo : "", tags: tri ? tri.tags : "", area: tri ? tri.area : "" };
  }

  if (action === "brief") {
    const u = await auth(p);
    const cond: string[] = ["tenant_id = ?"];
    const args: any[] = [u.tenant_id];
    // Filtro por CATEGORIA rica (preferido). Itens antigos sem categoria caem em 'noticia'
    // (mesma derivacao do tipo legado) p/ nao sumirem do filtro. `tipo` ainda aceito (compat UI).
    const catf = String(p.categoria || "").trim().toLowerCase();
    if (BRIEF_CAT_COD.includes(catf)) {
      if (catf === "noticia") cond.push("((categoria = 'noticia') OR (COALESCE(categoria,'') = '' AND tipo = 'noticia'))");
      else if (catf === "edital") cond.push("((categoria = 'edital') OR (COALESCE(categoria,'') = '' AND tipo = 'edital'))");
      else { cond.push("categoria = ?"); args.push(catf); }
    } else {
      const tipo = String(p.tipo || "").trim().toLowerCase();
      if (tipo === "edital" || tipo === "noticia") { cond.push("tipo = ?"); args.push(tipo); }
    }
    const area = String(p.area || "").trim().toLowerCase();
    if (BRIEF_AREA_COD.includes(area)) { cond.push("area LIKE ?"); args.push("%" + area + "%"); }
    const smin = Math.max(0, Math.min(100, Math.round(Number(p.scoremin)) || 0));
    if (smin > 0) { cond.push("score >= ?"); args.push(smin); }
    const de = String(p.de || "").trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(de)) { cond.push("data >= ?"); args.push(de); }
    const ate = String(p.ate || "").trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(ate)) { cond.push("data <= ?"); args.push(ate); }
    const origem = String(p.origem || "").trim().toLowerCase();
    if (origem === "auto" || origem === "manual") { cond.push("origem = ?"); args.push(origem); }
    const q = String(p.q || "").trim().toLowerCase();
    if (q) {
      cond.push("(lower(titulo) LIKE ? OR lower(resumo) LIKE ? OR lower(tags) LIKE ? OR lower(fonte) LIKE ?)");
      const like = "%" + q + "%"; args.push(like, like, like, like);
    }
    const r = await sqlite.execute({
      sql: "SELECT id,tipo,categoria,titulo,fonte,url,data,resumo,score,tags,area,origem,sit,autor,criado,fonte_id FROM brief WHERE " +
        cond.join(" AND ") + " ORDER BY score DESC, data DESC, criado DESC LIMIT 300",
      args,
    });
    let coleta: any = null;
    if (u.coord) { try { coleta = JSON.parse((await cfgGet("brief_coleta_last")) || "null"); } catch { coleta = null; } }
    return { ok: true, itens: r.rows, podeGerir: u.coord, areas: BRIEF_AREAS, categorias: BRIEF_CATEGORIAS, coleta };
  }

  if (action === "briefdel") {
    const u = await auth(p);
    if (!temCapSet(await capsDe(u), "brief.curar")) throw new Error("Seu cargo não permite curar o Daily Brief.");
    const id = String(p.id || "").trim();
    if (!id) throw new Error("Informe o item.");
    const r = await sqlite.execute({ sql: "SELECT id FROM brief WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    if (!r.rows.length) throw new Error("Item do brief não encontrado.");
    await sqlite.execute({ sql: "DELETE FROM brief WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    await audit("brief_del", u.slug, "id:" + id + " tenant:" + u.tenant_id, ip);
    return { ok: true, id };
  }

  /* ---- FONTES DO RADAR (CRUD) — gestao, piso coordenacao + cap brief.curar ---- */
  if (action === "brieffontes") {
    const u = await auth(p);
    if (!temCapSet(await capsDe(u), "brief.curar")) throw new Error("Seu cargo não permite gerir as fontes do Daily Brief.");
    const r = await sqlite.execute({
      sql: "SELECT id,nome,url,categoria,tipo_fonte,seletor,cadencia,area,ativo,ult_exec,ult_status,ult_novos FROM brief_fonte WHERE tenant_id = ? ORDER BY ativo DESC, nome ASC",
      args: [u.tenant_id],
    });
    let coleta: any = null; try { coleta = JSON.parse((await cfgGet("brief_coleta_last")) || "null"); } catch { coleta = null; }
    return { ok: true, fontes: r.rows, categorias: BRIEF_CATEGORIAS, areas: BRIEF_AREAS, cadencias: Object.keys(BRIEF_CADENCIAS), tiposFonte: BRIEF_FONTE_TIPOS, coleta };
  }

  if (action === "brieffonteset") {
    const u = await auth(p);
    if (!temCapSet(await capsDe(u), "brief.curar")) throw new Error("Seu cargo não permite gerir as fontes do Daily Brief.");
    const nome = String(p.nome || "").trim();
    if (!nome) throw new Error("Informe o nome da fonte.");
    const url = String(p.url || "").trim();
    if (url && !/^https?:\/\//i.test(url)) throw new Error("URL inválida — use http(s)://");
    const ativo = (p.ativo === true || p.ativo === 1 || String(p.ativo) === "1") ? 1 : 0;
    if (ativo && !url) throw new Error("Para ativar a fonte, informe a URL (feed/página oficial).");
    const cat = briefCat(p.categoria), tf = briefFonteTipo(p.tipo_fonte), cad = briefCadencia(p.cadencia);
    const area = String(p.area || "").trim().toLowerCase(); const areaOk = BRIEF_AREA_COD.includes(area) ? area : "";
    const seletor = String(p.seletor || "").trim().slice(0, 200);
    let id = String(p.id || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const existe = id ? (await sqlite.execute({ sql: "SELECT id FROM brief_fonte WHERE tenant_id = ? AND id = ?", args: [u.tenant_id, id] })).rows.length : 0;
    if (id && existe) {
      await sqlite.execute({
        sql: "UPDATE brief_fonte SET nome=?,url=?,categoria=?,tipo_fonte=?,seletor=?,cadencia=?,area=?,ativo=?,u=? WHERE tenant_id=? AND id=?",
        args: [nome.slice(0, 160), url.slice(0, 500), cat, tf, seletor, cad, areaOk, ativo, u.slug, u.tenant_id, id],
      });
      await audit("brief_fonte_set", u.slug, "upd:" + id + " ativo:" + ativo + " cat:" + cat + " tenant:" + u.tenant_id, ip);
    } else {
      if (!id) id = (nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "fonte") + "-" + crypto.randomUUID().slice(0, 4);
      await sqlite.execute({
        sql: "INSERT INTO brief_fonte (tenant_id,id,nome,url,categoria,tipo_fonte,seletor,cadencia,area,ativo,criado,u) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        args: [u.tenant_id, id, nome.slice(0, 160), url.slice(0, 500), cat, tf, seletor, cad, areaOk, ativo, now, u.slug],
      });
      await audit("brief_fonte_set", u.slug, "new:" + id + " ativo:" + ativo + " cat:" + cat + " tenant:" + u.tenant_id, ip);
    }
    return { ok: true, id };
  }

  if (action === "brieffontedel") {
    const u = await auth(p);
    if (!temCapSet(await capsDe(u), "brief.curar")) throw new Error("Seu cargo não permite gerir as fontes do Daily Brief.");
    const id = String(p.id || "").trim();
    if (!id) throw new Error("Informe a fonte.");
    const r = await sqlite.execute({ sql: "SELECT id FROM brief_fonte WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    if (!r.rows.length) throw new Error("Fonte não encontrada.");
    await sqlite.execute({ sql: "DELETE FROM brief_fonte WHERE id = ? AND tenant_id = ?", args: [id, u.tenant_id] });
    await audit("brief_fonte_del", u.slug, "id:" + id + " tenant:" + u.tenant_id, ip);
    return { ok: true, id };
  }

  if (action === "briefrun") {
    const u = await auth(p);
    if (!temCapSet(await capsDe(u), "brief.curar")) throw new Error("Seu cargo não permite rodar a coleta do Daily Brief.");
    const fonteId = String(p.id || "").trim() || undefined; // opcional: so uma fonte (botao "colher agora")
    const res = await briefColetar(ENV, { autor: u.slug, fonteId });
    await audit("brief_coleta", u.slug, (fonteId ? "fonte:" + fonteId + " " : "") + "fontes:" + res.fontes + " novos:" + res.novos + " erros:" + res.erros + (res.erro ? " erro:" + res.erro.slice(0, 60) : "") + " tenant:" + u.tenant_id, ip);
    return { ok: true, ...res };
  }

  if (action === "trilhas") {
    // TRILHAS — manual vivo. Devolve os modulos liberados AO PROPRIO usuario (a MESMA fonte
    // do Hub, ja recortada por papel/tenant no servidor). A UI monta um capitulo por modulo
    // liberado; nunca inventa acesso — reflete exatamente o que o servidor libera. So-leitura.
    // Guard MIN ja exigiu piso 'cliente' (todo logado); fornecedor fica de fora (FORNECEDOR_OK).
    const u = await auth(p);
    const modulos = await modulosLiberados({ slug: u.slug, papel: u.papel });
    return { ok: true, modulos, papel: u.papel, papelLabel: PAPEL_LABEL[u.papel] || u.papel };
  }

  if (action === "dna") {
    // DNA & ATIVOS — documentos institucionais da casa (tabela 'conteudo'), filtrados pelo
    // tenant do usuario (nada cruza empresa). Guard MIN ja exigiu piso 'coordenacao'
    // (equipe/cliente/fornecedor negados na borda). O kit de marca (paleta/tipografia/logos)
    // e 100% front (tokens do Design System + assets em public/); aqui so vem o acervo de
    // documentos. Colunas selecionadas nao tem qualquer campo monetario. So-leitura.
    const u = await auth(p);
    const cont = await sqlite.execute({
      sql: "SELECT id, area, titulo, descricao, url, tag, destaque, autor, criado FROM conteudo WHERE tenant_id = ? ORDER BY area, titulo",
      args: [u.tenant_id],
    });
    return { ok: true, documentos: cont.rows };
  }

  /* ===== VITRINE — show-run de cases (galeria dos trabalhos entregues) =====
     Leitura (vitrine/vitrineFicha): piso 'equipe' (guard MIN). Equipe vê só PUBLICADOS; a gestao
     (u.coord) vê tambem rascunhos e recebe podeGerir=true. CRUD so u.coord. Produtos apontam p/
     o bucket ACERVO (reaproveitado) via a rota POST /vitrine/arquivo, ou p/ URL externa. Sem
     valor monetario; cliente por centro de custo. ABERTURA EXTERNA = TODO (ver nota no MIN). */
  if (action === "vitrine") {
    const u = await auth(p);
    const gerir = !!u.coord;
    const r = await sqlite.execute({
      sql: "SELECT cid, titulo, cliente_cc, area, resumo, capa, capa_fonte, publicado, ordem, atualizado FROM vitrine_case WHERE tenant_id = ? AND ativo = 1" + (gerir ? "" : " AND publicado = 1") + " ORDER BY ordem, titulo",
      args: [u.tenant_id],
    });
    // Contagem de produtos por case (p/ o badge do card), em 1 consulta.
    const pc = await sqlite.execute({ sql: "SELECT cid, COUNT(*) n FROM vitrine_produto WHERE tenant_id = ? GROUP BY cid", args: [u.tenant_id] });
    const nprod: Record<string, number> = {};
    for (const x of pc.rows as P[]) nprod[String(x.cid)] = Number(x.n) || 0;
    const cases = (r.rows as P[]).map((x) => ({
      cid: x.cid, titulo: x.titulo, cliente_cc: x.cliente_cc, area: x.area, resumo: x.resumo,
      capa: x.capa, capa_fonte: x.capa_fonte, publicado: Number(x.publicado) ? 1 : 0, ordem: Number(x.ordem) || 0,
      atualizado: x.atualizado, produtos: nprod[String(x.cid)] || 0,
    }));
    return { ok: true, cases, podeGerir: gerir };
  }

  if (action === "vitrineFicha") {
    const u = await auth(p);
    const gerir = !!u.coord;
    const cid = String(p.cid || "").trim();
    if (!cid) throw new Error("Case não informado.");
    const r = await sqlite.execute({
      sql: "SELECT cid, titulo, cliente_cc, area, resumo, corpo, capa, capa_fonte, publicado, ordem, atualizado, u FROM vitrine_case WHERE tenant_id = ? AND cid = ? AND ativo = 1" + (gerir ? "" : " AND publicado = 1") + " LIMIT 1",
      args: [u.tenant_id, cid],
    });
    if (!r.rows.length) throw new Error("Case não encontrado.");
    const c = r.rows[0] as P;
    const pr = await sqlite.execute({
      sql: "SELECT id, tipo, titulo, legenda, fonte, ref, ordem FROM vitrine_produto WHERE tenant_id = ? AND cid = ? ORDER BY ordem, id",
      args: [u.tenant_id, cid],
    });
    return { ok: true, caso: { ...c, publicado: Number(c.publicado) ? 1 : 0 }, produtos: pr.rows, podeGerir: gerir };
  }

  if (action === "vitrineSet") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação edita a Vitrine.");
    let cid = String(p.cid || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 48);
    if (!cid) cid = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const titulo = (String(p.titulo || "").trim() || "(sem título)").slice(0, 200);
    const cc = String(p.cliente_cc || "").slice(0, 60);
    const area = String(p.area || "").slice(0, 120);
    const resumo = String(p.resumo || "").slice(0, 2000);
    const corpo = String(p.corpo || "").slice(0, 60000);
    const capa = String(p.capa || "").slice(0, 600);
    const capaFonte = String(p.capa_fonte || "").trim() === "acervo" ? "acervo" : "url";
    const publicado = Number(p.publicado) ? 1 : 0;
    const ordem = Math.max(0, Math.min(9999, Number(p.ordem) || 0));
    const now = new Date().toISOString();
    await sqlite.execute({
      sql: "INSERT INTO vitrine_case (tenant_id, cid, titulo, cliente_cc, area, resumo, corpo, capa, capa_fonte, publicado, ordem, ativo, atualizado, u) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?) ON CONFLICT(tenant_id, cid) DO UPDATE SET titulo=excluded.titulo, cliente_cc=excluded.cliente_cc, area=excluded.area, resumo=excluded.resumo, corpo=excluded.corpo, capa=excluded.capa, capa_fonte=excluded.capa_fonte, publicado=excluded.publicado, ordem=excluded.ordem, ativo=1, atualizado=excluded.atualizado, u=excluded.u",
      args: [u.tenant_id, cid, titulo, cc, area, resumo, corpo, capa, capaFonte, publicado, ordem, now, u.slug],
    });
    await audit("vitrine_case", u.slug, cid + (publicado ? " [pub]" : " [rascunho]"), ip);
    return { ok: true, cid };
  }

  if (action === "vitrineDel") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação remove da Vitrine.");
    const cid = String(p.cid || "").trim();
    if (!cid) throw new Error("Case não informado.");
    // Remove o case e seus produtos (metadados; os arquivos do acervo NÃO são tocados).
    await sqlite.execute({ sql: "DELETE FROM vitrine_produto WHERE tenant_id = ? AND cid = ?", args: [u.tenant_id, cid] });
    await sqlite.execute({ sql: "DELETE FROM vitrine_case WHERE tenant_id = ? AND cid = ?", args: [u.tenant_id, cid] });
    await audit("vitrine_case_del", u.slug, cid, ip);
    return { ok: true, cid };
  }

  if (action === "vitrineProdSet") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação edita os produtos da Vitrine.");
    const cid = String(p.cid || "").trim();
    if (!cid) throw new Error("Case não informado.");
    const exists = await sqlite.execute({ sql: "SELECT 1 FROM vitrine_case WHERE tenant_id = ? AND cid = ? LIMIT 1", args: [u.tenant_id, cid] });
    if (!exists.rows.length) throw new Error("Case não encontrado.");
    let id = String(p.id || "").trim();
    if (!id) id = "vp" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const TIPOS = ["prancha", "relatorio", "modelo3d", "apresentacao", "imagem", "link"];
    const tipo = TIPOS.includes(String(p.tipo || "")) ? String(p.tipo) : "prancha";
    const titulo = (String(p.titulo || "").trim() || "Produto").slice(0, 200);
    const legenda = String(p.legenda || "").slice(0, 1000);
    const fonte = String(p.fonte || "").trim() === "url" ? "url" : "acervo";
    const ref = String(p.ref || "").trim().replace(/^\/+/, "").slice(0, 600);
    if (!ref) throw new Error("Informe o caminho no acervo ou a URL do produto.");
    if (fonte === "acervo" && ref.includes("..")) throw new Error("Caminho de acervo inválido.");
    if (fonte === "url" && !/^https?:\/\//i.test(ref)) throw new Error("A URL deve começar com http:// ou https://.");
    const ordem = Math.max(0, Math.min(9999, Number(p.ordem) || 0));
    const now = new Date().toISOString();
    await sqlite.execute({
      sql: "INSERT INTO vitrine_produto (tenant_id, id, cid, tipo, titulo, legenda, fonte, ref, ordem, criado) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id, id) DO UPDATE SET cid=excluded.cid, tipo=excluded.tipo, titulo=excluded.titulo, legenda=excluded.legenda, fonte=excluded.fonte, ref=excluded.ref, ordem=excluded.ordem",
      args: [u.tenant_id, id, cid, tipo, titulo, legenda, fonte, ref, ordem, now],
    });
    await audit("vitrine_prod", u.slug, cid + "/" + id + " " + tipo, ip);
    return { ok: true, id, cid };
  }

  if (action === "vitrineProdDel") {
    const u = await auth(p);
    if (!u.coord) throw new Error("Apenas a Coordenação remove produtos da Vitrine.");
    const id = String(p.id || "").trim();
    if (!id) throw new Error("Produto não informado.");
    await sqlite.execute({ sql: "DELETE FROM vitrine_produto WHERE tenant_id = ? AND id = ?", args: [u.tenant_id, id] });
    await audit("vitrine_prod_del", u.slug, id, ip);
    return { ok: true, id };
  }

  throw new Error("Ação desconhecida: " + action);
}

/* ---------- visualizador de documentos ---------- */
function docShell(titulo: string, drive: string, corpo: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let temMermaid = false;
  const pre = corpo.replace(/```mermaid([\s\S]*?)```/g, (_m, g) => {
    temMermaid = true;
    return '\n<div class="mermaid">' + esc(String(g)) + "</div>\n";
  });
  const artigo = marked.parse(pre, { async: false, mangle: false, headerIds: false } as any) as string;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${titulo.replace(/[<>&]/g, "")} — Portal Intelecto &amp; CSTR</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=Public+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
:root{--ground:#f4f6f4;--surface:#fff;--surface-2:#eef2ef;--ink:#182420;--ink-2:#5a6660;--line:#dfe5e1;
  --accent:#176a56;--accent-ink:#0f5443;--accent-soft:#e3efeb;--accent-line:#bcd8cf}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--ground:#0e1211;--surface:#171d1b;--surface-2:#1e2624;
  --ink:#eef2f0;--ink-2:#9fada7;--line:#2a332f;--accent:#46c3a0;--accent-ink:#63d4b4;--accent-soft:#12352c;--accent-line:#1e4e40}}
:root[data-theme="dark"]{--ground:#0e1211;--surface:#171d1b;--surface-2:#1e2624;
  --ink:#eef2f0;--ink-2:#9fada7;--line:#2a332f;--accent:#46c3a0;--accent-ink:#63d4b4;--accent-soft:#12352c;--accent-line:#1e4e40}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:15.5px/1.65 "Public Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
header{position:sticky;top:0;background:var(--surface);border-bottom:1px solid var(--line);padding:12px 0;z-index:10}
.wrap{max-width:860px;margin:0 auto;padding:0 20px}
header .wrap{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.logo{width:30px;height:30px;border-radius:7px;background:var(--accent);color:#fff;display:grid;place-items:center;
  font-family:"Archivo",system-ui,sans-serif;font-weight:700;font-size:13px;flex:none}
header .t{font-family:"Archivo","Public Sans",system-ui,sans-serif;font-weight:700;font-size:15px;flex:1;min-width:180px}
header a{color:var(--accent-ink);text-decoration:none;font-size:13px;font-weight:500;border:1px solid var(--line);
  border-radius:8px;padding:6px 11px;background:var(--surface)}
header a:hover{background:var(--accent-soft);border-color:var(--accent-line)}
main{padding:28px 0 90px}
article{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:34px 38px;
  box-shadow:0 1px 2px rgba(24,36,32,.05),0 4px 14px rgba(24,36,32,.05)}
@media(max-width:640px){article{padding:22px 18px}}
article h1,article h2,article h3,article h4{font-family:"Archivo","Public Sans",system-ui,sans-serif;letter-spacing:-.01em;line-height:1.25}
article h1{font-size:26px;margin:0 0 14px}
article h2{font-size:20px;margin:30px 0 10px;padding-top:14px;border-top:1px solid var(--line)}
article h3{font-size:16.5px;margin:22px 0 8px}
article a{color:var(--accent-ink)}
article blockquote{margin:14px 0;padding:10px 16px;border-left:3px solid var(--accent-line);background:var(--accent-soft);border-radius:0 9px 9px 0;color:var(--ink)}
article code{background:var(--surface-2);border:1px solid var(--line);border-radius:5px;padding:1px 5px;font-size:.88em}
article pre{background:var(--surface-2);border:1px solid var(--line);border-radius:9px;padding:14px;overflow-x:auto}
article pre code{background:none;border:none;padding:0}
article .tbl{overflow-x:auto;margin:14px 0}
article table{border-collapse:collapse;width:100%;font-size:13.5px}
article th{background:var(--surface-2);text-align:left}
article th,article td{border:1px solid var(--line);padding:7px 10px;vertical-align:top}
article img{max-width:100%}
article hr{border:none;border-top:1px solid var(--line);margin:26px 0}
.mermaid{background:var(--surface);text-align:center;margin:14px 0}
</style>
</head>
<body>
<header><div class="wrap">
  <div class="logo">IC</div><div class="t">${esc(titulo)}</div>
  <a href="/">← Portal</a>
  ${drive ? '<a href="' + esc(drive) + '" target="_blank" rel="noopener">Ver no Drive ↗</a>' : ""}
</div></header>
<main><div class="wrap"><article id="doc">${artigo}</article></div></main>
${temMermaid ? '<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"><\/script>' : ""}
<script>
const el=document.getElementById('doc');
el.querySelectorAll('table').forEach(t=>{const w=document.createElement('div');w.className='tbl';t.parentNode.insertBefore(w,t);w.appendChild(t);});
el.querySelectorAll('a[href^="http"]').forEach(a=>{a.target='_blank';a.rel='noopener';});
if(window.mermaid){try{mermaid.initialize({startOnLoad:false,theme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'default'});mermaid.run({querySelector:'.mermaid'});}catch(e){}}
</script>
</body>
</html>`;
}

const app = new Hono();
app.use("*", async (c: any, next: any) => { ENV = c.env; try { REQ_ORIGIN = new URL(c.req.url).origin; } catch (_) { /* url invalida: mantem origem anterior */ } await next(); });

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if ((c.res.headers.get("content-type") || "").includes("text/html")) {
    c.header("Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://esm.town https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
      "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }
});

app.post("/api", async (c) => {
  await ensureSchema();
  const ip = c.req.header("cf-connecting-ip") || (c.req.header("x-forwarded-for") || "").split(",")[0].trim() || "?";
  try {
    const p = await c.req.json();
    // M2 — sessão em cookie HttpOnly: se o corpo não traz token, usa o do cookie `ce_t`.
    if (!p.token) { const ct = cookieVal(c.req.header("cookie") || "", "ce_t"); if (ct) p.token = ct; }
    const action = String(p.action || "");
    const out = await route(action, p, ip);
    // O token NUNCA volta ao JS: ação que cria sessão grava-o no cookie HttpOnly e some do corpo.
    if (out && (out as any).token) {
      c.header("Set-Cookie", "ce_t=" + (out as any).token + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" + (SESS_DIAS * 86400));
      delete (out as any).token;
    } else if (action === "logout") {
      c.header("Set-Cookie", "ce_t=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
    }
    return c.json(out);
  } catch (err) {
    /* Erro de regra de negocio e escrito para a pessoa ler e pode sair. Erro de
       infraestrutura (D1, rede) carrega nome de tabela e coluna: vira mensagem generica
       e o detalhe fica so na auditoria. */
    const msg = err instanceof Error ? err.message : String(err);
    const interno = /\b(SQLITE|D1_|no such (table|column)|UNIQUE constraint|syntax error|FOREIGN KEY)\b/i.test(msg);
    if (interno) {
      try { await audit("erro_interno", "-", msg, ip); } catch { /* auditoria nunca derruba a resposta */ }
      return c.json({ ok: false, error: "Não foi possível concluir. Tente de novo; se persistir, avise a Coordenação." });
    }
    return c.json({ ok: false, error: msg });
  }
});

function cookieVal(h: string, k: string): string {
  for (const part of h.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === k) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}
function paginaEntrar(): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Documento restrito — Portal Intelecto &amp; CSTR</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1216;color:#e7ecf2;
font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.b{max-width:420px;padding:28px;border:1px solid #263041;border-radius:14px;background:#151a21;text-align:center}
h1{font-size:18px;margin:0 0 10px}p{color:#a9b4c2;margin:0 0 18px}
a{display:inline-block;background:#2f6df6;color:#fff;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:600}</style>
</head><body><div class="b"><h1>Documento restrito</h1>
<p>Este documento é interno da Intelecto &amp; CSTR. Entre no portal com seu nome e senha para abri-lo.</p>
<a href="/">Ir para o portal</a></div></body></html>`;
}

app.get("/d/:slug", async (c) => {
  await ensureSchema();
  const tok = cookieVal(c.req.header("cookie") || "", "ce_t");
  let ok = false;
  try { await auth({ token: tok }); ok = true; } catch { ok = false; }
  if (!ok) return c.html(paginaEntrar(), 401);
  const slug = c.req.param("slug");
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return c.text("Documento não encontrado.", 404);
  const r = await sqlite.execute({ sql: "SELECT titulo, drive, tipo, corpo FROM docs WHERE slug = ? AND tenant_id = ?", args: [slug, TENANT_INTELECTO] });
  if (!r.rows.length) return c.text("Documento não encontrado.", 404);
  const d = r.rows[0] as P;
  if (String(d.tipo) === "html") return c.html(String(d.corpo));
  return c.html(docShell(String(d.titulo), String(d.drive || ""), String(d.corpo)));
});

app.get("/img/:nome", async (c) => {
  const n = c.req.param("nome");
  if (!/^[a-z0-9._-]{1,40}$/.test(n)) return c.text("Não encontrado.", 404);
  const tipo = n.endsWith(".webp")
    ? "image/webp"
    : n.endsWith(".svg")
    ? "image/svg+xml"
    : n.endsWith(".jpg") || n.endsWith(".jpeg")
    ? "image/jpeg"
    : "image/png";
  try {
    const b = await blob.get("img/" + n);
    return new Response(b.body, {
      headers: { "content-type": tipo, "cache-control": "public, max-age=86400" },
    });
  } catch (_) {
    return c.text("Não encontrado.", 404);
  }
});

/**
 * A página é montada a partir de três arquivos:
 *  - index.html: a aplicação (a linha "const SEED={...}" nela é a base ANTIGA e é descartada aqui);
 *  - cursos.js: o conteúdo da trilha de formação — calculadoras, catálogo de normas e literatura,
 *    e os cursos com seus módulos. Entra no lugar da âncora /*CURSOS*​/ dentro do index.html;
 *  - seed.js: a base de dados atual (projetos, planos e apontamentos), gerada a partir da planilha
 *    Calendário Engenharia. Para atualizar os dados, basta trocar seed.js.
 * Separar conteúdo de aplicação é o que permite reescrever um curso sem tocar no portal.
 */
let paginaCache = "";
let SEED_DATA: any = null;
let HIST_ALL: [string, number, string, number][] = [];
async function ensureSeed(): Promise<void> {
  if (SEED_DATA) return;
  const txt = await readFile("/seed.js", import.meta.url);
  SEED_DATA = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
  const hb = SEED_DATA.histByDay || {};
  const ccs: string[] = SEED_DATA.ccs || [];
  const out: [string, number, string, number][] = [];
  for (const d in hb) for (const r of hb[d]) out.push([d, r[0], ccs[r[1]], r[2]]);
  HIST_ALL = out;
}
function slugColab(n: string): string {
  return String(n).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function histDe(slug: string): [string, number, string, number][] {
  const idx = ((SEED_DATA?.colabs || []) as string[]).findIndex((n) => slugColab(n) === slug);
  return idx < 0 ? [] : HIST_ALL.filter((r) => r[1] === idx);
}
async function montarPagina(): Promise<string> {
  if (paginaCache) return paginaCache;
  await ensureSeed();
  const html = await readFile("/index.html", import.meta.url);
  const semHist: any = { ...SEED_DATA };
  delete semHist.histByDay;
  const seed = "var SEED=" + JSON.stringify(semHist) + ";";
  const cursos = await readFile("/cursos.js", import.meta.url);
  const base = html.replace("/*CURSOS*/", () => cursos.replace(/\n+$/, ""));
  const i = base.indexOf("\nconst SEED={");
  const j = base.indexOf("\nSEED.hist=[]", i + 1);
  paginaCache = j < 0 ? base : base.slice(0, i >= 0 ? i : j) + "\n" + seed.replace(/\n+$/, "") + base.slice(j);
  return paginaCache;
}

/* ===== LEADS AMBIENTAIS — helpers de consulta (WHERE/ORDER) reusados por ambList/Facets/Export.
   Toda chave de coluna/props é sanitizada (alfanum) e todo VALOR vai parametrizado (?), sem
   interpolar dado do usuário no SQL. Sort por coluna comum (indexada) ou por props (json_extract,
   com CAST p/ num e reordenação dd/mm/aaaa -> aaaammdd p/ date). */
function ambWhere(p: P, tenant: string): { bank: string; w: string; args: P[] } {
  const bank = String(p.bank || "empreendimentos").replace(/[^a-z_]/gi, "").slice(0, 40);
  const where: string[] = ["tenant_id = ?", "bank = ?"];
  const args: P[] = [tenant, bank];
  const eq = (col: string, val: any, n: number) => { const v = String(val == null ? "" : val).slice(0, n); if (v) { where.push(col + " = ?"); args.push(v); } };
  eq("bacia", p.bacia, 60);
  eq("municipio", p.municipio, 90);
  eq("setor", p.setor, 80);
  eq("classe", p.classe, 20);
  eq("situacao", p.situacao, 80);
  // filtros categóricos genéricos em props (fx = { chave: valor }).
  if (p.fx && typeof p.fx === "object") {
    for (const kraw of Object.keys(p.fx).slice(0, 8)) {
      const k = String(kraw).replace(/[^a-z_0-9]/gi, "").slice(0, 30);
      const v = String((p.fx as P)[kraw] == null ? "" : (p.fx as P)[kraw]).slice(0, 120);
      if (k && v) { where.push("json_extract(props,'$." + k + "') = ?"); args.push(v); }
    }
  }
  // vencimento (dias p/ vencer): vencidas / a vencer ≤ N meses / futuras (> 1 ano).
  const dv = String(p.dv || "");
  if (dv) {
    const c = "CAST(json_extract(props,'$.dv') AS REAL)";
    if (dv === "venc") where.push(c + " < 0");
    else if (dv === "fut") where.push(c + " > 365");
    else { const mm = Math.round(Number(dv) * 30.4) || 0; where.push(c + " >= 0 AND " + c + " <= ?"); args.push(mm); }
  }
  // faixa numérica sobre uma chave de props (nkey): score, área, IQA…
  const nkey = String(p.nkey || "").replace(/[^a-z_0-9]/gi, "").slice(0, 30);
  if (nkey) {
    const c = "CAST(json_extract(props,'$." + nkey + "') AS REAL)";
    if (p.nmin !== "" && p.nmin != null && isFinite(Number(p.nmin))) { where.push(c + " >= ?"); args.push(Number(p.nmin)); }
    if (p.nmax !== "" && p.nmax != null && isFinite(Number(p.nmax))) { where.push(c + " <= ?"); args.push(Number(p.nmax)); }
  }
  const q = String(p.q || "").trim().toLowerCase().slice(0, 90);
  if (q) { for (const term of q.split(/\s+/).filter(Boolean).slice(0, 6)) { where.push("busca LIKE ?"); args.push("%" + term + "%"); } }
  return { bank, w: where.join(" AND "), args };
}
function ambOrder(p: P): string {
  const COMMON: Record<string, string> = { municipio: "municipio", bacia: "bacia", setor: "setor", classe: "classe", situacao: "situacao", ord: "ord", dt: "dt", rotulo: "rotulo" };
  const key = String(p.sortKey || "").replace(/[^a-z_0-9]/gi, "").slice(0, 30);
  const type = String(p.sortType || "txt");
  const dir = String(p.dir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  /* Re-ranking do Lead Score por PESOS da Coordenação (só empreendimentos têm `brk`): o score é
     Σ peso_k × intensidade_k, com intensidades 0..1 em props.brk.{fit,agua,timing,pressao,autuacao,cred}.
     Pesos vêm do cliente, coeridos a número finito e embutidos como literais (seguro). Sem sortKey
     explícito, a ordenação passa a ser por esse score ponderado. */
  if (!key && p.weights && typeof p.weights === "object") {
    const parts: string[] = [];
    for (const k of ["fit", "agua", "timing", "pressao", "autuacao", "cred"]) {
      const w = Number((p.weights as P)[k]);
      if (isFinite(w) && w > 0) parts.push(w.toFixed(3) + "*COALESCE(CAST(json_extract(props,'$.brk." + k + "') AS REAL),0)");
    }
    if (parts.length) return "ORDER BY (" + parts.join("+") + ") " + dir + ", id ASC";
  }
  if (!key) return "ORDER BY ord " + dir + ", id ASC";
  let expr: string;
  if (COMMON[key]) expr = COMMON[key];
  else {
    const j = "json_extract(props,'$." + key + "')";
    if (type === "num" || type === "int") expr = "CAST(" + j + " AS REAL)";
    else if (type === "date") expr = "(substr(" + j + ",7,4)||substr(" + j + ",4,2)||substr(" + j + ",1,2))";
    else expr = j;
  }
  return "ORDER BY " + expr + " " + dir + ", id ASC";
}

// (Rota /comercial/leads-region REMOVIDA — os painéis HTML por bacia no R2 foram aposentados;
//  os leads ambientais agora são a tela única nativa no D1, via ações amb* no /api.)

// Arquivo do Acervo servido PRIVADO do bucket-fonte (acervo-intelecto), gate por concessão de
// acervo (isOwner || acgrant). Token no corpo (mesmo modelo do /api e do /comercial); nunca na
// URL. O SPA faz fetch autenticado e abre como blob — material confidencial não vira link público.
app.post("/acervo/arquivo", async (c) => {
  try {
    const b: P = await c.req.json().catch(() => ({} as P));
    const u = await auth({ token: String(b.token || "") || cookieVal(c.req.header("cookie") || "", "ce_t") } as P);
    const acok = isOwner(u.slug) || grantValid(await cfgGet("acgrant:" + u.slug));
    if (!acok) return c.text("Sem acesso ao acervo.", 403);
    const key = String(b.path || "").replace(/^\/+/, "");
    if (!key || key.includes("..")) return c.text("Caminho inválido.", 400);
    const o = ENV.ACERVO ? await ENV.ACERVO.get(key) : null;
    if (!o) return c.text("Arquivo não encontrado.", 404);
    const low = key.toLowerCase();
    const tipo = low.endsWith(".pdf") ? "application/pdf"
      : low.endsWith(".md") || low.endsWith(".txt") ? "text/plain; charset=utf-8"
      : low.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : low.endsWith(".doc") ? "application/msword"
      : low.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : low.endsWith(".csv") ? "text/csv; charset=utf-8"
      : low.endsWith(".png") ? "image/png"
      : low.endsWith(".jpg") || low.endsWith(".jpeg") ? "image/jpeg"
      : "application/octet-stream";
    await audit("acervo_arquivo", u.slug, key.slice(0, 80), c.req.header("cf-connecting-ip") || "");
    return new Response(o.body, { headers: { "content-type": tipo, "cache-control": "private, max-age=120" } });
  } catch (e: any) {
    return c.text("Erro: " + (e && e.message ? e.message : String(e)), 401);
  }
});

/* VITRINE — serve um PRODUTO FINAL de um case a partir do bucket ACERVO (reaproveitado, sem
 * storage novo). A CHAVE vem do banco (vitrine_produto.ref), nunca do cliente → sem path
 * injection. Gate = leitura da Vitrine (piso 'equipe'); independe do grant de acervo (quem vê a
 * vitrine pode abrir os produtos dela). Produtos fonte='url' nao passam por aqui (link direto no
 * front). .html/.htm servem inline p/ modelos 3D navegaveis (conteudo curado pela gestao). */
app.post("/vitrine/arquivo", async (c) => {
  try {
    await ensureSchema();
    const b: P = await c.req.json().catch(() => ({} as P));
    const u = await auth({ token: String(b.token || "") || cookieVal(c.req.header("cookie") || "", "ce_t") } as P);
    if (!temPapelMinimo(u.papel, "equipe")) return c.text("Sem acesso à Vitrine.", 403);
    const cid = String(b.cid || "").trim();
    const id = String(b.id || "").trim();
    if (!cid || !id) return c.text("Produto inválido.", 400);
    const r = await sqlite.execute({ sql: "SELECT fonte, ref FROM vitrine_produto WHERE tenant_id = ? AND cid = ? AND id = ? LIMIT 1", args: [u.tenant_id, cid, id] });
    if (!r.rows.length) return c.text("Produto não encontrado.", 404);
    const prod = r.rows[0] as P;
    if (String(prod.fonte) !== "acervo") return c.text("Este produto é um link externo.", 400);
    const key = String(prod.ref || "").replace(/^\/+/, "");
    if (!key || key.includes("..")) return c.text("Caminho inválido.", 400);
    const o = ENV.ACERVO ? await ENV.ACERVO.get(key) : null;
    if (!o) return c.text("Arquivo não encontrado.", 404);
    const low = key.toLowerCase();
    const tipo = low.endsWith(".pdf") ? "application/pdf"
      : low.endsWith(".html") || low.endsWith(".htm") ? "text/html; charset=utf-8"
      : low.endsWith(".md") || low.endsWith(".txt") ? "text/plain; charset=utf-8"
      : low.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : low.endsWith(".doc") ? "application/msword"
      : low.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : low.endsWith(".pptx") ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      : low.endsWith(".ppt") ? "application/vnd.ms-powerpoint"
      : low.endsWith(".csv") ? "text/csv; charset=utf-8"
      : low.endsWith(".png") ? "image/png"
      : low.endsWith(".jpg") || low.endsWith(".jpeg") ? "image/jpeg"
      : low.endsWith(".svg") ? "image/svg+xml"
      : low.endsWith(".glb") ? "model/gltf-binary"
      : "application/octet-stream";
    await audit("vitrine_arquivo", u.slug, (cid + "/" + id).slice(0, 80), c.req.header("cf-connecting-ip") || "");
    return new Response(o.body, { headers: { "content-type": tipo, "cache-control": "private, max-age=120" } });
  } catch (e: any) {
    return c.text("Erro: " + (e && e.message ? e.message : String(e)), 401);
  }
});

/* Onda 3 / INC 2 — serve PRIVADO do CV / comprovante de treinamento (R2 BLOB). O cliente passa
 * slug+tipo (+id p/ treino); a CHAVE vem do banco (nunca do cliente) — sem path injection. Gate
 * LGPD: a própria pessoa OU RH/coordenação/dono. */
app.post("/pessoa/arquivo", async (c) => {
  try {
    await ensureSchema();
    const b: P = await c.req.json().catch(() => ({} as P));
    const u = await auth({ token: String(b.token || "") || cookieVal(c.req.header("cookie") || "", "ce_t") } as P);
    const alvo = String(b.slug || "").trim() || u.slug;
    if (alvo !== u.slug) {
      const caps = await capsDe({ slug: u.slug, papel: u.papel });
      if (!(isOwner(u.slug) || u.coord || temCapSet(caps, "rh.ver") || temCapSet(caps, "pessoas.cargo_atribuir"))) return c.text("Sem acesso à ficha de outra pessoa.", 403);
    }
    const tipo = String(b.tipo || "cv");
    let key = "";
    if (tipo === "treino") {
      const id = String(b.id || "").trim(); if (!id) return c.text("Treinamento inválido.", 400);
      const r = await sqlite.execute({ sql: "SELECT comprov_key FROM pessoa_treino WHERE tenant_id = ? AND id = ? AND slug = ? LIMIT 1", args: [u.tenant_id, id, alvo] });
      key = String((r.rows[0] as P || {}).comprov_key || "");
    } else {
      const r = await sqlite.execute({ sql: "SELECT cv_key FROM pessoa_ficha WHERE tenant_id = ? AND slug = ? LIMIT 1", args: [u.tenant_id, alvo] });
      key = String((r.rows[0] as P || {}).cv_key || "");
    }
    if (!key) return c.text("Arquivo não encontrado.", 404);
    const o = ENV.BLOB ? await ENV.BLOB.get(key) : null;
    if (!o) return c.text("Arquivo não encontrado.", 404);
    await audit("pessoa_arquivo", u.slug, alvo + "/" + tipo, c.req.header("cf-connecting-ip") || "");
    return new Response(o.body, { headers: { "content-type": "application/pdf", "cache-control": "private, max-age=60" } });
  } catch (e: any) {
    return c.text("Erro: " + (e && e.message ? e.message : String(e)), 401);
  }
});

app.get("/", async (c) => c.html(await montarPagina()));
app.get("/source", (c) => c.redirect((ENV && ENV.REPO_URL) || "/"));

app.post("/mcp", async (c) => {
  let msg: any = null; try { msg = await c.req.json(); } catch { /* */ }
  const id = msg && ("id" in msg) ? msg.id : null;
  const method = msg?.method;
  /* Handshake instantaneo: responde ANTES de tocar o D1/ensureSchema. O cliente MCP
   * mede o connect aqui; em Worker frio o ensureSchema (CREATE TABLE em lote) levava
   * ~8 s e, sob rede ruim, estourava o timeout de 30 s -> CONNECT_TIMEOUT. initialize
   * so devolve capabilities/serverInfo (sem dado) e notifications/initialized e um ack:
   * nenhum dos dois precisa de banco nem de token, entao nao dependem de aquecimento. */
  if (method === "initialize") return c.json({ jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "intelecto-normas", version: "1.0.0" } } });
  if (method === "notifications/initialized") return new Response(null, { status: 204 });
  /* Daqui para baixo (tools/list, tools/call) precisa de schema e token. */
  await ensureSchema();
  const h0 = c.req.header("authorization") || "";
  const bearer = h0.toLowerCase().startsWith("bearer ") ? h0.slice(7).trim() : "";
  /* Token so por cabecalho: em query string ele vaza para log de borda, historico e Referer. */
  const tk = bearer || c.req.header("x-intelecto-token") || "";
  let quem = "";
  if (tk) {
    const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tk));
    const hh = [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    quem = (await cfgGet("mcptokh:" + hh)) || "";
  }
  if (!quem) return c.json({ jsonrpc: "2.0", id, error: { code: -32001, message: "token invalido ou ausente — verifique INTELECTO_MCP_TOKEN no ambiente do app e reinicie o app por completo" } }, 401);
  const acPerm = isOwner(quem) || grantValid(await cfgGet("acgrant:" + quem));
  /* Catalogo (cat:b64) e grande e so as fns de tools/call precisam dele; tools/list nao.
   * Carrega sob demanda (loadCat, chamado no ramo tools/call) para o handshake de tools ficar leve. */
  let AC: any[] = [], PR: any[] = [], PA: any = {};
  const loadCat = async () => {
    const b64 = (await cfgGet("cat:b64")) || "";
    if (!b64) return;
    try { const cat = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)))); AC = cat.acervo || []; PR = cat.prec || []; PA = cat.param || {}; } catch { /* catalogo ausente/invalido: fns do acervo retornam vazio */ }
  };
  const nm = (s: any) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const mt = (hay: any[], termo: string) => { const t = nm(termo); if (!t) return true; return t.split(/\s+/).every((w) => hay.some((x) => nm(x).includes(w))); };
  const fns: Record<string, (a: any) => any> = {
    buscar_norma: (a) => AC.filter((f: any) => f.tipo === "NORMA" && (!a.dominio || nm(f.dominio) === nm(a.dominio)) && mt([f.fonte, f.titulo, f.assunto, f.diz, f.id], a.termo || "")).map((f: any) => ({ id: f.id, fonte: f.fonte, titulo: f.titulo, criterio: f.diz, quando: f.quando, vigencia: f.rev, dominio: f.dominio })),
    buscar_referencia: (a) => AC.filter((f: any) => (!a.dominio || nm(f.dominio) === nm(a.dominio)) && mt([f.fonte, f.titulo, f.assunto, f.diz, f.id], a.termo || "")).map((f: any) => ({ id: f.id, tipo: f.tipo, fonte: f.fonte, titulo: f.titulo, resumo: f.diz, dominio: f.dominio })),
    buscar_precedente: (a) => PR.filter((x: any) => (!a.dominio || nm(x.dom) === nm(a.dominio)) && mt([x.proj, x.cli, x.met, x.norm, x.dom], a.termo || "")).map((x: any) => ({ dominio: x.dom, projeto: x.proj, cliente_ou_origem: x.cli, metodologia: x.met, normas: x.norm })),
    ficha: (a) => { const f = AC.find((x: any) => nm(x.id) === nm(a.id || "")); return f ? [f] : []; },
    parametro: (a) => { const ds = a.dominio ? [String(a.dominio).toUpperCase()] : Object.keys(PA); const o: any[] = []; for (const d of ds) for (const x of (PA[d] || [])) if (mt([x.p, x.u, x.faixa, x.val, x.cond, x.fonte, x.evid], a.termo || "")) o.push({ dominio: d, parametro: x.p, unidade: x.u, faixa: x.faixa, valor_praticado: x.val, condicao: x.cond, fonte: x.fonte, risco_se_errar: x.risco, verificacao: x.verif, evidencia: x.evid }); return o; },
    portfolio: async (a) => { const r = await sqlite.execute({ sql: "SELECT n,titulo,tipo,sit,met,norma,sec,ccs FROM prod WHERE tenant_id = ? ORDER BY n", args: [TENANT_INTELECTO] }); return r.rows.map((x: any) => ({ n: x.n, titulo: x.titulo, tipo: x.tipo, situacao: x.sit, metodo: x.met, norma: x.norma, setor: x.sec, ccs: x.ccs })).filter((p: any) => (!a.tipo || nm(p.tipo) === nm(a.tipo)) && mt([p.titulo, p.tipo, p.situacao, p.metodo, p.norma, p.setor, p.ccs], a.termo || "")); },
    agenda: async (a) => { const r = await sqlite.execute({ sql: "SELECT d,hora,tipo,titulo,setor,cc,resp,local,fase,obs FROM evento WHERE tenant_id = ? ORDER BY d,hora", args: [TENANT_INTELECTO] }); return r.rows.map((x: any) => ({ data: x.d, hora: x.hora, tipo: x.tipo, titulo: x.titulo, setor: x.setor, cc: x.cc, resp: x.resp, local: x.local, fase: x.fase, obs: x.obs })).filter((e: any) => (!a.de || String(e.data) >= a.de) && (!a.ate || String(e.data) <= a.ate) && (!a.setor || nm(e.setor) === nm(a.setor)) && mt([e.titulo, e.tipo, e.setor, e.cc, e.resp, e.local, e.obs], a.termo || "")).slice(0, 80); },
    conhecimento: async (a) => {
      const r = await sqlite.execute({ sql: "SELECT area,titulo,descricao,url,tag,autor FROM conteudo WHERE tenant_id = ? ORDER BY area,titulo", args: [TENANT_INTELECTO] });
      /* H3 — a tool respeita as AREAS RESTRITAS (financeiro/comercial/juridico) exatamente como o
       * /api (canView): so o dono do token que for coordenacao/admin OU responsavel pela area ve o
       * conteudo restrito. Antes a tool devolvia tudo por tenant, mais larga que o papel no portal. */
      const { papel } = await papelTenantDe(quem);
      const coordQuem = isOwner(quem) || temPapelMinimo(papel, "coordenacao");
      const restritasOK = new Set<string>();
      if (coordQuem) { for (const ar of RESTRITAS) restritasOK.add(ar); }
      else { for (const ar of RESTRITAS) { const rr = String((await cfgGet("resp:" + ar)) || "").split(",").filter(Boolean); if (rr.includes(quem)) restritasOK.add(ar); } }
      const canView = (area: string) => !RESTRITAS.includes(area) || restritasOK.has(area);
      return r.rows.filter((x: any) => canView(String(x.area))).map((x: any) => ({ area: x.area, titulo: x.titulo, descricao: x.descricao, url: x.url, tag: x.tag, autor: x.autor })).filter((k: any) => (!a.area || nm(k.area) === nm(a.area)) && mt([k.area, k.titulo, k.descricao, k.tag], a.termo || "")); },
    acervo_search: async (a: any) => {
      const q = String(a.termo || a.query || "").trim();
      if (!q) return [];
      const k = Math.min(Number(a.top_k) || 8, 15);
      const r: any = await ENV.AI.autorag("acervo-intelecto").search({ query: q, max_num_results: k });
      const data = (r && r.data) || [];
      return data.map((d: any) => ({
        arquivo: d.filename,
        score: d.score,
        trecho: ((d.content || []).map((c: any) => c.text).join("\n")).slice(0, 2500),
      }));
    },
  };
  const TL = [
    { name: "buscar_norma", description: "Busca normas (NBR, CONAMA, DN COPAM) por dominio/termo; devolve item, criterio e vigencia. Nao reproduz o texto da norma.", inputSchema: { type: "object", properties: { dominio: { type: "string" }, termo: { type: "string" } } } },
    { name: "buscar_referencia", description: "Busca referencias e metodos do acervo por dominio/termo.", inputSchema: { type: "object", properties: { dominio: { type: "string" }, termo: { type: "string" } } } },
    { name: "buscar_precedente", description: "Busca projetos ja executados pela casa por dominio/termo (cliente por centro de custo/origem).", inputSchema: { type: "object", properties: { dominio: { type: "string" }, termo: { type: "string" } } } },
    { name: "ficha", description: "Retorna a ficha de acervo por id (ex.: ETE-001).", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
    { name: "parametro", description: "Busca fichas de parametro (faixa, valor praticado, condicao, fonte, risco, evidencia) por dominio/termo.", inputSchema: { type: "object", properties: { dominio: { type: "string" }, termo: { type: "string" } } } },
    { name: "portfolio", description: "Lista o portfolio de produtos e servicos da casa (tipo, situacao, metodo, norma, centros de custo). Filtro por tipo e termo. Sem valores monetarios.", inputSchema: { type: "object", properties: { tipo: { type: "string" }, termo: { type: "string" } } } },
    { name: "agenda", description: "Lista eventos e reunioes da agenda (data, hora, tipo, titulo, setor, responsavel, local). Filtro por termo, setor e intervalo de datas de/ate no formato AAAA-MM-DD. Cliente por centro de custo.", inputSchema: { type: "object", properties: { de: { type: "string" }, ate: { type: "string" }, setor: { type: "string" }, termo: { type: "string" } } } },
    { name: "conhecimento", description: "Busca conteudos das abas de Conhecimento do portal (contextos, procedimentos, guias e links) por area e termo.", inputSchema: { type: "object", properties: { area: { type: "string" }, termo: { type: "string" } } } },
    { name: "acervo_search", description: "Busca semantica no Acervo de Conhecimento (953 docs: mestrado, graduacao, normas, cursos) via AI Search. Devolve trechos com cabecalho de origem (ramo, caminho, id, titulo, fonte). Uso interno; nao expor material confidencial nem valores.", inputSchema: { type: "object", properties: { termo: { type: "string" }, top_k: { type: "number" } }, required: ["termo"] } },
  ];
  if (method === "tools/list") return c.json({ jsonrpc: "2.0", id, result: { tools: acPerm ? TL : TL.filter((t) => !ACERVO_TOOLS.includes(t.name)) } });
  if (method === "tools/call") {
    /* hasOwn evita resolver nome herdado de Object.prototype (constructor, toString, __proto__). */
    const nome = msg?.params?.name; const fn = (typeof nome === "string" && Object.prototype.hasOwnProperty.call(fns, nome)) ? fns[nome] : undefined;
    if (!fn) return c.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "ferramenta desconhecida" } });
    if (ACERVO_TOOLS.includes(nome) && !acPerm) return c.json({ jsonrpc: "2.0", id, error: { code: -32001, message: "sem acesso ao acervo — solicite liberacao ao dono do portal" } }, 403);
    await loadCat(); /* carrega o catalogo so agora, para uma tool realmente invocada */
    const res = await fn(msg?.params?.arguments || {});
    await audit("mcp", quem, nome + " " + JSON.stringify(msg?.params?.arguments || {}).slice(0, 80), c.req.header("cf-connecting-ip") || "");
    return c.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(res, null, 1) }] } });
  }
  return c.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "metodo nao suportado: " + method } });
});
app.onError((err) => Promise.reject(err));

/* ---------- Keep-alive (Cron Trigger) ----------
 * Com o handshake /mcp ja instantaneo (initialize/notifications respondem antes do
 * D1), o connect nunca mais estoura o timeout. Este cron e a 2a camada: mantem o D1
 * e o cache de schema quentes para que tools/list e tools/call tambem respondam
 * rapido apos ociosidade. Aquece o D1 DIRETO (ENV global + ensureSchema), sem HTTP
 * e sem tocar a IA (zero custo de AutoRAG). Falha aqui nunca derruba o cron. */
async function keepAlive(env: any) {
  ENV = env; /* sqlite/ensureSchema usam o ENV global, normalmente setado no middleware de fetch */
  try { await ensureSchema(); } catch { /* aquecer nunca pode derrubar o cron */ }
}

/* ---------- Backup diario do D1 -> R2 (0.3) ----------
 * Exporta TODAS as tabelas de dados do D1 para o bucket BACKUP em JSON datado. Nao usa
 * DB.dump() (indisponivel no D1 remoto): varre sqlite_master e serializa linha a linha via
 * o helper sqlite. Retencao simples por data no nome do arquivo. Nunca lanca (cron robusto). */
const BACKUP_RET_DIAS = 90;
async function backupD1(env: any): Promise<{ ok: boolean; key?: string; tabelas?: number; linhas?: number; bytes?: number; removidos?: number; erro?: string }> {
  ENV = env; /* mesmo padrao do keepAlive: helpers usam o ENV global */
  if (!ENV.BACKUP) return { ok: false, erro: "binding BACKUP ausente (ver wrangler.toml)" };
  try {
    await ensureSchema();
    const tb = await sqlite.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name");
    const nomes = tb.rows.map((r: any) => r.name as string);
    const dump: any = { gerado_em: new Date().toISOString(), db: "portal-intelecto", tabelas: {} };
    let linhas = 0;
    for (const t of nomes) {
      const r = await sqlite.execute('SELECT * FROM "' + t + '"');
      dump.tabelas[t] = r.rows;
      linhas += r.rows.length;
    }
    const corpo = JSON.stringify(dump);
    const key = "d1/portal-intelecto-" + new Date().toISOString().slice(0, 10) + ".json";
    await ENV.BACKUP.put(key, corpo, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
    /* retencao best-effort: remove backups mais antigos que BACKUP_RET_DIAS (data no nome) */
    let removidos = 0;
    try {
      const corte = Date.now() - BACKUP_RET_DIAS * 86400000;
      const lista: any = await ENV.BACKUP.list({ prefix: "d1/" });
      for (const o of (lista.objects || [])) {
        const m = /(\d{4}-\d{2}-\d{2})\.json$/.exec(o.key);
        if (m && new Date(m[1] + "T00:00:00Z").getTime() < corte) { await ENV.BACKUP.delete(o.key); removidos++; }
      }
    } catch { /* retencao e best-effort */ }
    return { ok: true, key, tabelas: nomes.length, linhas, bytes: corpo.length, removidos };
  } catch (e: any) {
    return { ok: false, erro: e && e.message ? e.message : String(e) };
  }
}

/* ============================================================================
 * DAILY BRIEF — COLETOR AGENDADO (radar automatico)
 * --------------------------------------------------------------------------
 * Roda no cron (tick diario) e, sob demanda, pela acao `briefrun`. Para cada fonte ATIVA e
 * DEVIDA (pela cadencia), baixa o conteudo, extrai itens novos e grava no feed `brief` com
 * triagem por IA (a MESMA triagemIA do fluxo manual). Principios inegociaveis:
 *  - LIMITES: respeita robots.txt (grupo *), timeout por fetch, teto de itens/fonte, teto de
 *    chamadas de IA por rodada e teto de fontes/rodada. Prefere RSS/feed a scraping de HTML.
 *  - ROBUSTEZ: erro/timeout de UMA fonte NUNCA derruba a rodada nem o cron — vira status na
 *    propria fonte (ult_status) e segue. A funcao inteira e best-effort (nunca lanca).
 *  - DEDUP: cada item carrega uma `chave` (hash de url|titulo por tenant); item ja visto nao
 *    reentra. O feed e historico: nada e apagado pela coleta.
 *  - CONFIDENCIALIDADE/LGPD: sem valor monetario (regra da triagem); nao coletamos dado pessoal
 *    — so titulo/resumo/link de publicacao. origem='auto' distingue do 'manual'. */
const BRIEF_UA = "Mozilla/5.0 (compatible; IntelectoBrief/1.0; +portal.intelecto-eng.com.br)";
const BRIEF_COLETA = { maxFontes: 12, maxItensFonte: 6, maxIA: 24, fetchTimeoutMs: 8000, fetchMaxBytes: 1_500_000 };

/** Fetch resiliente com timeout (AbortController) e teto de bytes. Nunca lanca: devolve
 *  { ok, status, ct, text }. CSP do browser nao se aplica aqui (server-side). */
async function briefFetchRaw(url: string, timeoutMs = BRIEF_COLETA.fetchTimeoutMs): Promise<{ ok: boolean; status: number; ct: string; text: string }> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "user-agent": BRIEF_UA, "accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, text/html;q=0.8" }, redirect: "follow", signal: ctrl.signal });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok) return { ok: false, status: res.status, ct, text: "" };
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > BRIEF_COLETA.fetchMaxBytes ? buf.slice(0, BRIEF_COLETA.fetchMaxBytes) : buf;
    return { ok: true, status: res.status, ct, text: new TextDecoder("utf-8").decode(slice) };
  } catch (e: any) {
    return { ok: false, status: 0, ct: "", text: "" };
  } finally { clearTimeout(to); }
}

/** robots.txt do grupo `*` (conservador): cacheado por origem na rodada. Longest-match entre
 *  Allow/Disallow decide. Sem robots acessivel => permite (robots ausente = sem restricao). */
async function briefRobotsOk(url: string, cache: Map<string, { allow: string[]; disallow: string[] }>): Promise<boolean> {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  const origem = u.origin;
  let rules = cache.get(origem);
  if (!rules) {
    rules = { allow: [], disallow: [] };
    try {
      const r = await briefFetchRaw(origem + "/robots.txt", 5000);
      if (r.ok && r.text) {
        let aplica = false; // dentro de um grupo que cobre o nosso UA (* ou IntelectoBrief)
        for (const linhaRaw of r.text.split(/\r?\n/)) {
          const linha = linhaRaw.replace(/#.*$/, "").trim();
          if (!linha) continue;
          const mi = linha.indexOf(":");
          if (mi < 0) continue;
          const campo = linha.slice(0, mi).trim().toLowerCase();
          const val = linha.slice(mi + 1).trim();
          if (campo === "user-agent") { const ua = val.toLowerCase(); aplica = ua === "*" || ua.includes("intelectobrief"); }
          else if (aplica && campo === "disallow" && val) rules.disallow.push(val);
          else if (aplica && campo === "allow" && val) rules.allow.push(val);
        }
      }
    } catch { /* robots best-effort: ausencia nao bloqueia */ }
    cache.set(origem, rules);
  }
  const path = (u.pathname || "/") + (u.search || "");
  const match = (pats: string[]) => pats.reduce((best, p) => (path.startsWith(p) && p.length > best ? p.length : best), 0);
  const d = match(rules.disallow), a = match(rules.allow);
  return d === 0 || a >= d; // sem disallow que case, ou allow mais especifico, => permitido
}

/** Decodifica entidades XML/HTML basicas e remove tags. Para titulo/resumo de item de feed. */
function briefDecode(s: string): string {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_m, n) => { try { return String.fromCodePoint(Number(n)); } catch { return " "; } })
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return " "; } })
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ").trim();
}

type BriefItem = { titulo: string; url: string; data: string; resumo: string };

/** Extrai itens de RSS 2.0 (<item>) ou Atom (<entry>). Regex-based (sem dependencia): robusto o
 *  suficiente para os campos que usamos. Devolve [] se nada casar (nunca lanca). */
function parseRss(xml: string, limite: number): BriefItem[] {
  const out: BriefItem[] = [];
  try {
    const blocos = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
    for (const b of blocos) {
      if (out.length >= limite) break;
      const tag = (re: RegExp) => { const m = b.match(re); return m ? briefDecode(m[1]) : ""; };
      const titulo = tag(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
      // RSS: <link>url</link>. Atom: <link href="url"/>.
      let url = tag(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
      if (!url) { const m = b.match(/<link\b[^>]*href=["']([^"']+)["']/i); if (m) url = briefDecode(m[1]); }
      const data = tag(/<(?:pubDate|published|updated|dc:date)\b[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/i);
      const resumo = tag(/<(?:description|summary|content)\b[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i);
      if (!titulo && !url) continue;
      out.push({ titulo, url, data, resumo });
    }
  } catch { /* parse best-effort */ }
  return out;
}

/** Extrai itens de um feed JSON. `seletor` = caminho opcional ate o array (ex.: "items" ou
 *  "data.results"); vazio => procura o primeiro array de objetos. Mapeia campos comuns. */
function parseJsonFeed(obj: any, seletor: string, limite: number): BriefItem[] {
  const out: BriefItem[] = [];
  try {
    let arr: any = obj;
    if (seletor) { for (const k of seletor.split(".").map(s => s.trim()).filter(Boolean)) arr = arr == null ? null : arr[k]; }
    if (!Array.isArray(arr)) {
      // JSON Feed padrao usa .items; senao, primeiro array de objetos encontrado no topo
      if (obj && Array.isArray(obj.items)) arr = obj.items;
      else if (obj && typeof obj === "object") { for (const k in obj) { if (Array.isArray(obj[k]) && obj[k].length && typeof obj[k][0] === "object") { arr = obj[k]; break; } } }
    }
    if (!Array.isArray(arr)) return out;
    for (const it of arr) {
      if (out.length >= limite) break;
      if (!it || typeof it !== "object") continue;
      const titulo = briefDecode(it.title || it.titulo || it.name || it.headline || "");
      const url = String(it.url || it.link || it.href || it.id || "").trim();
      const data = String(it.date_published || it.published || it.pubDate || it.date || it.data || "").trim();
      const resumo = briefDecode(it.summary || it.description || it.content_text || it.resumo || it.abstract || "");
      if (!titulo && !url) continue;
      out.push({ titulo, url, data, resumo });
    }
  } catch { /* best-effort */ }
  return out;
}

/** Limpa HTML cru em texto (reaproveita a logica do briefFetch manual, aqui sobre `text` ja baixado). */
function briefHtmlToText(t: string): string {
  return String(t || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|br|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 7000);
}

/** Chave de dedup estavel por tenant: sha-256(tenant|url) ou (tenant|titulo). Hex curto (16). */
async function briefChave(tenant: string, url: string, titulo: string): Promise<string> {
  const base = tenant + "|" + (url ? url.trim().toLowerCase() : "t:" + titulo.trim().toLowerCase());
  const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  return [...new Uint8Array(dig)].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Converte uma data de feed (RFC822/ISO/livre) para YYYY-MM-DD; falha => hoje. */
function briefData(raw: string, hoje: string): string {
  const s = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : hoje;
}

/** COLETOR. env = binding Worker. opts.fonteId limita a uma fonte (usado pelo botao "colher agora"
 *  de uma fonte especifica); opts.autor registra quem disparou (cron ou slug). Best-effort total. */
async function briefColetar(env: any, opts: { fonteId?: string; autor?: string } = {}): Promise<{ ok: boolean; fontes: number; novos: number; erros: number; detalhe: any[]; erro?: string }> {
  ENV = env; // helpers (sqlite/ensureSchema/triagemIA) usam o ENV global
  const autor = opts.autor || "cron";
  const detalhe: any[] = [];
  let novos = 0, erros = 0, fontesProc = 0, iaUsadas = 0;
  try {
    await ensureSchema();
    const hoje = new Date().toISOString().slice(0, 10);
    const agora = Date.now();
    const cond = ["tenant_id = ?", "ativo = 1", "url != ''"];
    const args: any[] = [TENANT_INTELECTO];
    if (opts.fonteId) { cond.push("id = ?"); args.push(opts.fonteId); }
    const fr = await sqlite.execute({ sql: "SELECT id,nome,url,categoria,tipo_fonte,seletor,cadencia,area,ult_exec FROM brief_fonte WHERE " + cond.join(" AND ") + " ORDER BY ult_exec ASC LIMIT ?", args: [...args, BRIEF_COLETA.maxFontes] });
    const robots = new Map<string, { allow: string[]; disallow: string[] }>();
    for (const row of fr.rows as any[]) {
      // Devida? (ignora cadencia quando a coleta e de UMA fonte sob demanda)
      const intervalo = BRIEF_CADENCIAS[briefCadencia(row.cadencia)] || BRIEF_CADENCIAS.semanal;
      const ult = Date.parse(String(row.ult_exec || "")) || 0;
      if (!opts.fonteId && ult && agora - ult < intervalo) continue;
      fontesProc++;
      let status = "ok", nfonte = 0;
      try {
        if (!(await briefRobotsOk(String(row.url), robots))) {
          status = "bloqueado por robots.txt";
        } else {
          const raw = await briefFetchRaw(String(row.url));
          if (!raw.ok) { status = "falha ao baixar (HTTP " + raw.status + ")"; }
          else {
            const tf = briefFonteTipo(row.tipo_fonte);
            let itens: BriefItem[] = [];
            if (tf === "json") { try { itens = parseJsonFeed(JSON.parse(raw.text), String(row.seletor || ""), BRIEF_COLETA.maxItensFonte); } catch { status = "JSON inválido"; } }
            else if (tf === "rss") { itens = parseRss(raw.text, BRIEF_COLETA.maxItensFonte); if (!itens.length) status = "sem itens no feed"; }
            else { // html = pagina inteira como 1 item (conservador, sem harvest de links)
              const txt = briefHtmlToText(raw.text);
              if (txt.length >= 20) itens = [{ titulo: "", url: String(row.url), data: hoje, resumo: txt.slice(0, 400) }];
              else status = "conteúdo insuficiente";
            }
            const cat = briefCat(row.categoria), tipo = catToTipo(cat), fonteNome = String(row.nome || (() => { try { return new URL(String(row.url)).hostname.replace(/^www\./, ""); } catch { return ""; } })());
            for (const it of itens) {
              const chave = await briefChave(TENANT_INTELECTO, it.url, it.titulo || fonteNome);
              const dup = await sqlite.execute({ sql: "SELECT 1 FROM brief WHERE tenant_id = ? AND chave = ? LIMIT 1", args: [TENANT_INTELECTO, chave] });
              if (dup.rows.length) continue;
              // Conteudo a triar: resumo do feed, ou (html) a pagina; so chama IA ate o teto.
              const conteudo = (it.resumo || "") + (tf === "html" ? "\n" + briefHtmlToText(raw.text) : "");
              let tri = null as any;
              if (iaUsadas < BRIEF_COLETA.maxIA && conteudo.trim().length >= 20) { tri = await triagemIA(conteudo, tipo); iaUsadas++; }
              const titulo = (it.titulo || (tri && tri.titulo) || briefDecode(it.resumo).slice(0, 120) || fonteNome || "(sem título)").slice(0, 240);
              const id = crypto.randomUUID().slice(0, 8);
              const area = tri && tri.area ? tri.area : String(row.area || "");
              await sqlite.execute({
                sql: "INSERT INTO brief (id,tenant_id,tipo,categoria,titulo,fonte,url,data,resumo,score,tags,area,origem,sit,autor,criado,chave,fonte_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'auto', ?,?,?,?,?)",
                args: [id, TENANT_INTELECTO, tipo, cat, titulo, fonteNome.slice(0, 120), String(it.url || "").slice(0, 500), briefData(it.data, hoje),
                  tri ? tri.resumo : briefDecode(it.resumo).slice(0, 400), tri ? tri.score : 0, tri ? tri.tags : "", area,
                  tri ? "TRIADO" : "A_TRIAR", autor, new Date().toISOString(), chave, String(row.id)],
              });
              novos++; nfonte++;
            }
            if (status === "ok" && nfonte === 0 && itens.length) status = "sem novidades";
          }
        }
      } catch (e: any) { status = "erro: " + String(e && e.message ? e.message : e).slice(0, 80); }
      if (status.startsWith("erro") || status.startsWith("falha") || status.startsWith("bloqueado") || status.includes("inválido")) erros++;
      try {
        await sqlite.execute({
          sql: "UPDATE brief_fonte SET ult_exec = ?, ult_status = ?, ult_novos = ? WHERE tenant_id = ? AND id = ?",
          args: [new Date().toISOString(), status.slice(0, 120), nfonte, TENANT_INTELECTO, String(row.id)],
        });
      } catch { /* status best-effort */ }
      detalhe.push({ id: row.id, nome: row.nome, status, novos: nfonte });
    }
    // Resumo da rodada (para a UI e trilha). Config, nao audit spam; o manual tambem audita.
    const resumo = { em: new Date().toISOString(), por: autor, fontes: fontesProc, novos, erros, ia: iaUsadas, detalhe };
    try { await cfgSet("brief_coleta_last", JSON.stringify(resumo)); } catch { /* best-effort */ }
    return { ok: true, fontes: fontesProc, novos, erros, detalhe };
  } catch (e: any) {
    return { ok: false, fontes: fontesProc, novos, erros, detalhe, erro: e && e.message ? e.message : String(e) };
  }
}

export default {
  fetch: app.fetch,
  scheduled: (event: any, env: any, ctx: any) => {
    /* ramifica por cron (ver [triggers] no wrangler.toml):
     *  - "0 6 * * *" : backup diario do D1 -> R2
     *  - "0 9 * * *" : coletor do Daily Brief (fontes ativas e devidas pela cadencia)
     *  - demais ("*​/5 * * * *") : keep-alive */
    if (event && event.cron === "0 6 * * *") ctx.waitUntil(backupD1(env));
    else if (event && event.cron === "0 9 * * *") ctx.waitUntil(briefColetar(env, { autor: "cron" }));
    else ctx.waitUntil(keepAlive(env));
  },
};
