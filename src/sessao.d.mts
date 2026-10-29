// Tipos para o módulo puro src/sessao.mjs (consumido pelo index.ts).
export const SESS_DIAS: number;
export const SESS_CURTA_HORAS: number;
export function querManter(v: unknown): boolean;
export function prazoInatividadeMs(persist: boolean): number;
export function sessaoExpirada(ultimoIso: string, persist: unknown, agoraMs: number): boolean;
export function cookieSessao(token: string, persist: boolean): string;
