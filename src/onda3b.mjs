// Onda 3 · Sub-projeto B (núcleo) — lógica PURA das regras agendadas (sem D1, sem rede, sem
// relógio: a data entra por parâmetro). Importada pelo Worker (src/index.ts) no branch de cron
// e testada em test/onda3b.test.mjs. O `scheduled()` faz as CONSULTAS D1 e chama estes helpers;
// manter a lógica aqui é o que torna o comportamento testável no `node --test` estático da casa.

/**
 * Decide se a regra deve rodar NESTA data. Cada regra se autolimita pelo calendário, então o
 * cron pode ser um só (diário) — não há um trigger por regra.
 *  - sem_apontamento (R3): só na sexta (o lembrete da semana que fecha).
 *  - snapshot (R4): só no dia 1 (fecha o mês anterior).
 *  - parado (R1) / estouro (R2): todo dia; a dedup por janela é que evita o spam.
 * Fail-closed: regra desconhecida não roda.
 * @param {"parado"|"estouro"|"sem_apontamento"|"snapshot"} regra
 * @param {Date} data  data de referência (UTC; o cron roda em UTC)
 * @returns {boolean}
 */
export function deveRodar(regra, data) {
  const d = data instanceof Date && !isNaN(data.getTime()) ? data : null;
  if (!d) return false;
  if (regra === "sem_apontamento") return d.getUTCDay() === 5;
  if (regra === "snapshot") return d.getUTCDate() === 1;
  if (regra === "parado" || regra === "estouro") return true;
  return false;
}

/**
 * Nível de estouro de horas de um CC: consumido ÷ previsto em %. O nível devolvido é também a
 * CHAVE DE DEDUP (`periodo`) da notificação — por isso é discreto (80/100/120) e não o percentual
 * exato: cada faixa avisa uma vez só, e a próxima faixa é um alerta novo.
 * @param {number} consumido  horas lançadas no CC
 * @param {number} previsto   horas previstas no CC (prevf)
 * @returns {""|"80"|"100"|"120"}  "" = sem nível (não avisa)
 */
export function nivelEstouro(consumido, previsto) {
  const c = Number(consumido);
  const p = Number(previsto);
  if (!isFinite(c) || !isFinite(p) || p <= 0) return "";
  const pct = (100 * c) / p;
  if (pct >= 120) return "120";
  if (pct >= 100) return "100";
  if (pct >= 80) return "80";
  return "";
}

/**
 * Semana ISO-8601 da data, no formato `AAAA-Wss` (ex.: "2026-W44"). É a janela de dedup das
 * regras semanais: a mesma condição no mesmo período não gera notificação nova; na semana
 * seguinte, sim. Semana começa na SEGUNDA e o ano é o da QUINTA daquela semana (por isso
 * 2027-01-01, uma sexta, cai em 2026-W53).
 * @param {Date} data
 * @returns {string}
 */
export function periodoSemanaISO(data) {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  // Anda até a quinta-feira da mesma semana ISO: define o ano a que a semana pertence.
  const dow = d.getUTCDay() || 7; // 1=segunda ... 7=domingo
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const ano = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(ano, 0, 1));
  const semana = Math.ceil(((d - jan1) / 86400000 + 1) / 7);
  return ano + "-W" + String(semana).padStart(2, "0");
}

/**
 * Monta os INSERTs das notificações. `INSERT OR IGNORE` contra `UNIQUE(tenant_id,tipo,ref,periodo)`
 * é o que torna o cron idempotente: re-rodar no mesmo período não duplica nada (nem reabre o que
 * já foi lido). Puro: recebe os itens já consultados e devolve statements, nada executa.
 * Itens sem `destino` ou sem `tipo` são descartados (não há a quem avisar / do quê).
 * @param {Array<{id:string,tenant:string,destino:string,tipo:string,ref?:string,periodo?:string,titulo?:string,texto?:string,now?:string}>} itens
 * @returns {Array<{sql:string,args:any[]}>}  [] quando não há nada a notificar
 */
export function notifStatements(itens) {
  const lista = Array.isArray(itens) ? itens : [];
  const txt = (v) => (v === undefined || v === null ? "" : String(v));
  const out = [];
  for (const it of lista) {
    if (!it) continue;
    const destino = txt(it.destino);
    const tipo = txt(it.tipo);
    if (!destino || !tipo) continue;
    out.push({
      sql: "INSERT OR IGNORE INTO notificacao (id,tenant_id,destino,tipo,ref,periodo,titulo,texto,criado) "
        + "VALUES (?,?,?,?,?,?,?,?,?)",
      args: [
        txt(it.id), txt(it.tenant), destino, tipo, txt(it.ref),
        txt(it.periodo), txt(it.titulo).slice(0, 200), txt(it.texto).slice(0, 1000), txt(it.now),
      ],
    });
  }
  return out;
}
