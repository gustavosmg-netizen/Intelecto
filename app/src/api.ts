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
  if (!r.ok || !j || j.ok === false) {
    const msg = (j && (j.error as string)) || (r.status === 401 ? "Faça login no portal para continuar." : "Erro inesperado.");
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
}

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
