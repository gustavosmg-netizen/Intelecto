// Tipos para o módulo puro src/rh.mjs (consumido pelo index.ts).
export interface LinhaMatriz { item: string; jr: string; pl: string; sr: string }
export interface Rcf {
  status: "rascunho" | "aprovado"; revisao: string; subordinacao: string; missao: string; indicadores: string[];
  niveis: { jr: string[]; pl: string[]; sr: string[] }; conhecimentos: LinhaMatriz[]; soft: LinhaMatriz[];
  exigencias: { educacao: string; experiencia: string; treinamento: string; habilidade: string };
}
export const ESCALA_RCF: Record<string, string>;
export function normalizaRcf(r: unknown): Rcf;
export function rcfVazio(r: unknown): boolean;
export function cienciaEmDia(rcf: unknown, ciencias: Array<{ revisao: string }>): boolean;
export const TIPOS_CONTRATO: string[];
export const TIPOS_ACORDO: string[];
export function validaContrato(c: unknown): { tipo: string; inicio: string; fim: string; renovacao_auto: number; carga_semanal: number; doc_url: string; obs: string };
export function validaAcordo(a: unknown): { tipo: string; descricao: string; inicio: string; fim: string; doc_url: string };
export function contratoVigente<T extends { inicio: string; fim?: string }>(contratos: T[], hoje: string): T | null;
export function alertasRh(contratos: any[], acordos: any[], hoje: string): Array<{ origem: string; id: string; slug: string; tipo: string; fim: string; dias: number; nivel: "vencido" | "critico" | "atencao" }>;
