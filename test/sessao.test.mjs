// "Manter conectado" — testes de COMPORTAMENTO da lógica pura de sessão (node --test, sem rede/D1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { querManter, sessaoExpirada, cookieSessao, prazoInatividadeMs } from "../src/sessao.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const H = 3600000, D = 86400000;
const T0 = Date.parse("2026-10-29T12:00:00Z");

test("querManter: ausente segue 30 dias (compatível); só falso explícito desliga", () => {
  for (const v of [undefined, null, "", true, 1, "1", "true"]) assert.equal(querManter(v), true, String(v));
  for (const v of [false, 0, "0", "false"]) assert.equal(querManter(v), false, String(v));
});

test("sessaoExpirada: mantida dura 30 dias sem uso", () => {
  const ult = new Date(T0).toISOString();
  assert.equal(sessaoExpirada(ult, 1, T0 + 29 * D), false);
  assert.equal(sessaoExpirada(ult, 1, T0 + 30 * D + 1), true);
});

test("sessaoExpirada: não mantida cai após 12 h sem uso", () => {
  const ult = new Date(T0).toISOString();
  assert.equal(sessaoExpirada(ult, 0, T0 + 11 * H), false);
  assert.equal(sessaoExpirada(ult, 0, T0 + 12 * H + 1), true);
  assert.equal(sessaoExpirada(ult, "0", T0 + 13 * H), true);
});

test("sessaoExpirada: linha antiga sem a coluna (persist ausente) conta como mantida", () => {
  const ult = new Date(T0).toISOString();
  assert.equal(sessaoExpirada(ult, undefined, T0 + 20 * D), false);
  assert.equal(sessaoExpirada(ult, null, T0 + 20 * D), false);
});

test("sessaoExpirada: data inválida é expirada (fail-closed)", () => {
  assert.equal(sessaoExpirada("", 1, T0), true);
  assert.equal(sessaoExpirada("lixo", 1, T0), true);
});

test("cookieSessao: Max-Age só quando mantida; sempre HttpOnly/Secure", () => {
  const m = cookieSessao("abc", true), n = cookieSessao("abc", false);
  assert.match(m, /^ce_t=abc; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=2592000$/);
  assert.equal(n, "ce_t=abc; HttpOnly; Secure; SameSite=Lax; Path=/");
  assert.equal(prazoInatividadeMs(true), 30 * D);
});

test("fiação no Worker: auth, criação de sessão e cookie usam o helper", () => {
  const ts = readFileSync(join(root, "src/index.ts"), "utf8");
  assert.match(ts, /from "\.\/sessao\.mjs"/);
  assert.match(ts, /sessaoExpirada\(/);
  assert.match(ts, /cookieSessao\(/);
  // nenhum Set-Cookie de sessão montado à mão com Max-Age fixo
  assert.doesNotMatch(ts, /"ce_t=" \+ \(out as any\)\.token \+ "; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age="/);
  // a coluna nasce no ensureSchema e tem migração própria
  assert.match(ts, /ALTER TABLE sess ADD COLUMN persist INTEGER DEFAULT 1/);
  assert.match(readFileSync(join(root, "migrations/0012_sess_persist.sql"), "utf8"), /ALTER TABLE sess ADD COLUMN persist INTEGER DEFAULT 1/);
  const html = readFileSync(join(root, "public/index.html"), "utf8");
  assert.match(html, /id="lg-manter"/);
});

test("boot: só recusa explícita de sessão leva ao login; falha passageira tenta de novo", () => {
  const html = readFileSync(join(root, "public/index.html"), "utf8");
  const i = html.indexOf("(async function boot(){"); const b = html.slice(i, html.indexOf("})();", i));
  assert.match(b, /var sessaoRecusada=function\(e\)\{return \/sess\[aã\]o expirada\|acesso encerrado/);
  assert.match(b, /for\(var tentativa=0;tentativa<4;tentativa\+\+\)/);
  assert.match(b, /if\(sessaoRecusada\(e\)\|\|tentativa===3\)break;/);
  assert.match(b, /sua sessão continua válida/);
  // o padrão antigo (qualquer erro do probe => login) não pode voltar
  assert.doesNotMatch(b, /try\{\s*await api\("perfil"\);\s*await entrarApp\(\);\s*\}catch\(e\)\{/);
});
