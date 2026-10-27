// Tipos para o módulo puro src/onda3a.mjs (consumido pelo index.ts; tsc fora do gate, mas limpo).
export function planoProporProjeto(
  c: { cc: string; valor: number; status: string; titulo: string; contratoId: string; tenant: string; now: string; parcelaId: string },
  opts: { flagOn: boolean; temParcela: boolean }
): Array<{ sql: string; args: any[] }>;

export function decideBloqueioHoras(
  status: string,
  opts: { forcar: boolean; podeAprovar: boolean }
): { bloqueia: boolean };

export function regrasExtra(
  T: string
): Array<{ rule: string; titulo: string; sev: string; dono: string; atalho: string; sql: string; args: any[] }>;
