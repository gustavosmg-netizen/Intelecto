// Tipos para o módulo puro src/crm.mjs (consumido pelo index.ts e pela casca nova em app/).
export interface Fase { id: string; label: string; base: number; lo: number; hi: number }
export const FASES: Fase[];
export function faseDeSt(st: number): string | null;
export function rotuloSt(st: number): string;
export function destinoMovimento(stAtual: number, alvo: string): number;
export const CORES_TAG: string[];
export function validaTag(nome: unknown, cor: unknown): { nome: string; cor: string };
export interface FiltroCrm { q: string; owners: string[]; fases: string[]; tags: string[]; temp: string[]; pri: string[]; prazo: string }
export function normalizaFiltro(f: unknown): FiltroCrm;
export function filtroVazio(f: unknown): boolean;
export function aplicaFiltro<T extends { id: string; st: number }>(
  deals: T[],
  filtro: unknown,
  ctx: { dealTags?: Record<string, string[]>; prox?: Record<string, { prazo?: string }>; hoje: string }
): T[];
export const TIPOS_ATIVIDADE: string[];
export function validaAtividade(a: unknown): { tipo: string; texto: string; data: string; prazo: string; resp: string };
export function proximosPassos(
  atividades: Array<{ deal_id: string; tipo: string; feito: unknown; prazo: string; texto: string; resp?: string; id: string }>
): Record<string, { id: string; prazo: string; texto: string; resp: string }>;
