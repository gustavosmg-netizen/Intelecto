// Tipos para o módulo puro src/onda3b.mjs (consumido pelo index.ts; tsc fora do gate, mas limpo).
export function deveRodar(
  regra: "parado" | "estouro" | "sem_apontamento" | "snapshot" | string,
  data: Date
): boolean;

export function nivelEstouro(
  consumido: number | null | undefined,
  previsto: number | null | undefined
): "" | "80" | "100" | "120";

export function periodoSemanaISO(data: Date): string;

export function notifStatements(
  itens: Array<{
    id: string; tenant: string; destino: string; tipo: string;
    ref?: string; periodo?: string; titulo?: string; texto?: string; now?: string;
  }> | null | undefined
): Array<{ sql: string; args: any[] }>;
