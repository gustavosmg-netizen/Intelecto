// Teste de regressão do hotfix de login (PBKDF2).
// Standalone: roda com `node --test test/pbkdf2.test.mjs` (a main ainda não tem script `test`
// nem CI de verify — isso chega com o corte da Onda 0). Lê o fonte e confere os invariantes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/index.ts"), "utf8");

test("hashSenhaNova grava 100000 iterações (teto do runtime do Worker)", () => {
  // Acima de 100000 o Cloudflare Workers rejeita o PBKDF2 ("iteration counts above 100000 are not
  // supported"): o hash fica impossível de verificar e o login quebra para quem criar/redefinir senha.
  assert.match(src, /async function hashSenhaNova[\s\S]*?const iter = 100000;/);
  assert.doesNotMatch(src, /const iter = 150000;/);
});

test("verificaSenha trata hash legado >100000 como não-verificável (sem estourar)", () => {
  assert.match(src, /if \(iter > 100000\) return false;/);
});
