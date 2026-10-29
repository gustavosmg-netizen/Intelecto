// "Manter conectado" — lógica PURA da sessão (sem D1, sem relógio: o "agora" é injetado),
// importada pelo Worker (src/index.ts) e testada em test/sessao.test.mjs.
//
// Marcado (padrão, igual ao comportamento anterior): cookie com Max-Age de 30 dias e sessão que
// expira após 30 dias SEM USO (cada acesso renova). Desmarcado: cookie de sessão (sem Max-Age —
// o navegador o descarta ao fechar) e o servidor recusa a sessão após 12 h sem uso, para cobrir
// navegador que restaura a sessão ou computador compartilhado deixado aberto.

export const SESS_DIAS = 30;
export const SESS_CURTA_HORAS = 12;

/**
 * Lê a escolha "manter conectado" do corpo da ação. Ausente = true (compatível com clientes que
 * ainda não mandam o campo: a casca nova e versões em cache do portal seguem com 30 dias).
 * @param {unknown} v
 * @returns {boolean}
 */
export function querManter(v) {
  if (v === undefined || v === null || v === "") return true;
  return !(v === false || v === 0 || v === "0" || v === "false");
}

/**
 * Prazo de inatividade da sessão, em milissegundos.
 * @param {boolean} persist
 * @returns {number}
 */
export function prazoInatividadeMs(persist) {
  return persist ? SESS_DIAS * 86400000 : SESS_CURTA_HORAS * 3600000;
}

/**
 * A sessão expirou? `persist` vem da linha de `sess` (1/0; linha antiga sem a coluna = 1).
 * `ultimoIso` inválido conta como expirada (fail-closed).
 * @param {string} ultimoIso
 * @param {unknown} persist
 * @param {number} agoraMs
 * @returns {boolean}
 */
export function sessaoExpirada(ultimoIso, persist, agoraMs) {
  const ultimo = Date.parse(String(ultimoIso || ""));
  if (!Number.isFinite(ultimo)) return true;
  const p = persist === undefined || persist === null ? true : Number(persist) !== 0;
  return agoraMs - ultimo > prazoInatividadeMs(p);
}

/**
 * Cabeçalho Set-Cookie da sessão. Sem Max-Age quando não é para manter (cookie de sessão).
 * @param {string} token
 * @param {boolean} persist
 * @returns {string}
 */
export function cookieSessao(token, persist) {
  const base = "ce_t=" + token + "; HttpOnly; Secure; SameSite=Lax; Path=/";
  return persist ? base + "; Max-Age=" + SESS_DIAS * 86400 : base;
}
