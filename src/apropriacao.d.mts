// Tipos para o módulo puro src/apropriacao.mjs (consumido pelo index.ts).
export function tipoCc(cc: string): number;
export function ccFaturavel(cc: string): boolean;
export function ym(v: unknown): string;
export function vigenteEm(item: { desde?: string; ate?: string }, m: string): boolean;
export function horasPorMes(rows: Array<{ cc: string; mes: string; h: number }>): Record<string, Record<string, number>>;
export function rateioFixosMensal(
  fixos: Array<{ valor: number; desde?: string; ate?: string }>,
  hpm: Record<string, Record<string, number>>,
  ateMes: string
): { byCc: Record<string, number>; absorvido: number; naoAbsorvido: number; meses: Record<string, { pool: number; horas: number }> };
export function receitaRecorrente(
  recs: Array<{ id: string; cliente: string; valor_mensal: number; desde?: string; ate?: string }>,
  hpm: Record<string, Record<string, number>>,
  clienteDoCc: Record<string, string>,
  ateMes: string
): { byCc: Record<string, number>; porContrato: Record<string, { apropriado: number; naoApropriado: number; meses: number }> };
export function proxMes(m: string): string;
export function situacaoHoras(gastas: number, previstas: number): { situacao: "sem_contrato" | "ok" | "atencao" | "estouro"; pct: number | null };
