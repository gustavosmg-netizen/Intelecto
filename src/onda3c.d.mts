// Tipos para o módulo puro src/onda3c.mjs (consumido pelo index.ts; tsc fora do gate, mas limpo).
export function montaPromptSugestaoCC(
  mov: { descricao: string; valor: number; data: string },
  candidatos: Array<{ cc: string; cliente: string; projeto: string }>,
  historico: Array<{ descricao: string; cc: string }>
): { system: string; user: string };

export function parseSugestaoCC(
  textoIA: string,
  ccsValidos: string[]
): { cc: string; confianca: number | ""; motivo: string };

export function selecionaCandidatos(
  descricao: string,
  candidatos: Array<{ cc: string; cliente: string; projeto: string }>,
  historico: Array<{ descricao: string; cc: string }>,
  max?: number
): Array<{ cc: string; cliente: string; projeto: string }>;
