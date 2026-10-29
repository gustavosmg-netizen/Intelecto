// Tipos para o módulo puro src/fin.mjs (consumido pelo index.ts e pela casca nova em app/).
export const COLUNAS_FIN: { id: string; label: string }[];
export type SituacaoFin = "vencido" | "avencer" | "previsto" | "realizado" | "cancelado";
export function situacaoFluxo(f: { status?: string; data_prev?: string }, hoje: string): SituacaoFin;
export function transicaoFin(de: string, para: string): "baixar" | "cancelar" | "reabrir" | null;
export const OPS_LOTE: string[];
export function validaLote(p: unknown): { op: string; ids: string[]; categoria: string };
export function planoLote(
  l: { op: string; ids: string[]; categoria: string },
  c: { tenant: string; slug: string; now: string; hoje: string }
): Array<{ sql: string; args: any[] }>;
export interface FiltroFin { q: string; tipo: string; situacoes: string[]; ccs: string[]; categorias: string[]; tags: string[]; de: string; ate: string }
export function normalizaFiltroFin(f: unknown): FiltroFin;
export function filtroFinVazio(f: unknown): boolean;
export function aplicaFiltroFin<T extends { id: string }>(rows: T[], filtro: unknown, ctx: { itemTags?: Record<string, string[]>; hoje: string }): T[];
