// Cliente de API da casca nova. Mesma origem, mesma sessão do portal atual: o auth é por cookie
// HttpOnly (credentials same-origin), então nada de token no corpo — quem está logado em / está
// logado em /app. O gate real é no servidor (MIN/capabilities); aqui só consumimos as ações.

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(action: string, extra?: Record<string, unknown>): Promise<T> {
  return apiCall<T>(action, extra, true);
}

// E-06 — contrato de API versionado. Toda resposta do /api carrega `apiVer`. Guardamos o valor do
// primeiro contato; se uma resposta posterior vier com outro, o Worker foi atualizado por baixo
// (esta casca está servida do cache antigo) e avisamos a UI para recarregar — em vez de seguir
// chamando um contrato que pode ter mudado. Best-effort: nunca derruba a chamada em si.
let bootApiVer: string | null = null;
let verListener: ((v: string) => void) | null = null;
export function apiVerAtual(): string | null { return bootApiVer; }
export function onApiVerChange(cb: (v: string) => void): void { verListener = cb; }
function registraApiVer(v: unknown): void {
  if (typeof v !== "string" || !v) return;
  if (!bootApiVer) { bootApiVer = v; return; }
  if (v !== bootApiVer && verListener) { try { verListener(v); } catch (_) { /* listener nunca derruba */ } }
}

async function apiCall<T = any>(action: string, extra: Record<string, unknown> | undefined, permiteReauth: boolean): Promise<T> {
  let r: Response;
  try {
    r = await fetch("/api", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...(extra || {}) }),
    });
  } catch (e) {
    throw new ApiError("Sem conexão com o servidor.", 0);
  }
  let j: any = null;
  try { j = await r.json(); } catch (_) { /* resposta não-JSON */ }
  if (j) registraApiVer(j.apiVer); // E-06 — detecta contrato mudado (sucesso ou erro)
  if (!r.ok || !j || j.ok === false) {
    const msg = (j && (j.error as string)) || (r.status === 401 ? "Faça login no portal para continuar." : "Erro inesperado.");
    // S-03 — ação sensível pede senha reconfirmada: confirma e repete a ação uma vez.
    if (permiteReauth && typeof msg === "string" && msg.indexOf("REAUTH_NECESSARIO") === 0) {
      let senha: string | null = null;
      try { senha = window.prompt("Confirme a sua senha para esta ação sensível:"); } catch (_) { senha = null; }
      if (senha) {
        await apiCall("reauth", { senha }, false); // lança se a senha estiver errada
        return apiCall<T>(action, extra, false);   // repete a ação original uma vez
      }
    }
    throw new ApiError(msg, r.status);
  }
  return j as T;
}

// ---- Tipos parciais do que o cockpit consome da ação `state` (defensivo: campos podem faltar).
export interface Lanc { id: string; slug: string; d: string; cc: string; h: number; s: string; t?: string }
export interface Proj { cc: string; projeto: string; status?: string; registro?: string; cliente?: string }
export interface StateResp {
  ok: true; coord: boolean; slug: string; owner: boolean;
  lanc: Lanc[]; proj: Proj[]; projx: any[]; membros?: [string, string][];
  cargos?: Record<string, string>; setores?: Record<string, string>; funcs?: Record<string, string>;
}

// ---- Projeto 360 (ação `projdetalhe`, só gestão). Tipagem defensiva do que a página 360 usa.
export interface Colab360 { slug: string; nome: string; h: number; custoHora?: number; custo?: number; custoReal?: number }
export interface Parcela360 { id: string; numero: number; valor: number; venc_prev: string; status: string; recebido_em?: string }
export interface Contrato360 { id: string; titulo: string; valor: number; status: string; tipo: string; assinado?: string; parcelas: Parcela360[] }
export interface Fin360 { contratado: number; moCusto: number; imposto: number; rateioFix: number; outros: number; consumiveis: number; terceiros: number; custoTotal: number; margem: number; margemPct: number | null; pct_imposto: number }
export interface ProjDetalhe {
  ok: true; cc: string; coord: boolean; podeFin: boolean;
  proj: { cc: string; projeto: string; status: string; subtipo?: string; inicio?: string; previsto?: string; fim?: string; empresa?: string; cliente?: string; tipo?: string; alterado_por?: string; alterado_em?: string };
  projx: { resp?: string; setor?: string; obs?: string; prev: number; gut: number; prioridade: number; progresso: number; gravidade: number; urgencia: number; tendencia: number; impacto: number; esforco: number };
  horas: { gastas: number; previstas: number; restantes: number; consumo: number | null; estouro: boolean };
  etapa: { atual: number; total: number; ultimoDetalhe: string; ultimaData: string; progressoDerivado: number | null; divergente: boolean };
  andam: { id: string; d: string; etapa: number; total: number; detalhe: string; slug: string }[];
  prevf: { func: string; h: number }[];
  lancs: { d: string; slug: string; nome: string; h: number; t: string }[];
  colab: Colab360[];
  fin?: Fin360 | null;
  contratos?: Contrato360[];
}

// ---- CRM / pipeline (ação `crm`). O card do pipeline NÃO exibe valor em R$ (confidencialidade:
// valor monetário não circula fora do Financeiro) — mostra empresa, responsável, prioridade.
export interface Deal { id: string; st: number; co: string; owner?: string; pri?: string; temp?: string; city?: string; seg?: string; cc?: string; signeddate?: string;
  contact?: string; role?: string; email?: string; phone?: string; prod?: string }
// Tags e filtros são POR PESSOA (o servidor só devolve os de quem consulta); `prox` = próximo passo
// (tarefa aberta de prazo mais cedo) de cada negócio.
export interface CrmTag { id: string; nome: string; cor: string }
export interface CrmAtividade { id: string; tipo: string; texto: string; data: string; prazo: string; resp: string; feito: number; autor: string; criado: string }
export interface CrmResp { ok: true; deals: Deal[]; podeGerir: boolean; eu?: string; tags?: CrmTag[];
  dealTags?: Record<string, string[]>; prox?: Record<string, { id: string; prazo: string; texto: string; resp: string }> }

// Fases e subetapas: fonte única em src/crm.mjs (a mesma regra que o servidor aplica).
export { FASES as MACRO, faseDeSt } from "../../src/crm.mjs";

export const fmtBRL = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtHoras = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " h";

const ABERTOS = new Set(["A INICIAR", "EM ANDAMENTO", "EM ESPERA"]);
const EFETIVAS = new Set(["APROVADO", "LANÇADO", "LANCADO"]);

export interface Kpis {
  horasEfetivas: number;
  horasMinhas: number;
  projetosAbertos: number;
  projetosTotal: number;
  pendentes: number;
  coord: boolean;
  slug: string;
}

export function derivaKpis(s: StateResp): Kpis {
  const lanc = s.lanc || [];
  const proj = (s.proj || []).filter((p) => (p.registro || "ATIVO") === "ATIVO" || !p.registro);
  const ef = lanc.filter((l) => EFETIVAS.has(String(l.s).toUpperCase()));
  const soma = (xs: Lanc[]) => Math.round(xs.reduce((a, l) => a + (Number(l.h) || 0), 0) * 10) / 10;
  return {
    horasEfetivas: soma(ef),
    horasMinhas: soma(ef.filter((l) => l.slug === s.slug)),
    projetosAbertos: proj.filter((p) => ABERTOS.has(String(p.status || "").toUpperCase())).length,
    projetosTotal: proj.length,
    pendentes: lanc.filter((l) => String(l.s).toUpperCase() === "PENDENTE").length,
    coord: !!s.coord,
    slug: s.slug,
  };
}
