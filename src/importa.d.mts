// Tipos para o módulo puro src/importa.mjs (consumido pelo index.ts).
export interface LinhaImport { slug: string; d: string; cc: string; h: number }
export function slugDoNome(nome: unknown, roster: Record<string, string>): string;
export function ccDoTexto(txt: unknown): string;
export function chave(slug: string, d: string, cc: string, h: number): string;
export function normalizaLinhas(
  linhas: Array<{ d: string; nome: string; cc: string; h: number }>,
  roster: Record<string, string>,
  ccsConhecidos: Set<string> | string[],
  hoje: string
): { validas: LinhaImport[]; semPessoa: Record<string, number>; semProjeto: Record<string, number>; invalidas: { data: number; horas: number; cc: number; futuro: number } };
export function diffLancamentos(planilha: LinhaImport[], portal: LinhaImport[]): { novos: LinhaImport[]; jaNoPortal: number };
export function resumoNovos(novos: LinhaImport[]): { n: number; horas: number; porMes: Record<string, { n: number; h: number }>; porPessoa: Record<string, { n: number; h: number }> };
