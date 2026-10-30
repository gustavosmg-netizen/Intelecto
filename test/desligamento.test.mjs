// Desligamento com data de saída — asserts de fonte sobre a fiação no Worker e na tela do RH.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = readFileSync(join(root, "src/index.ts"), "utf8");
const html = readFileSync(join(root, "public/index.html"), "utf8");
const bloco = (ini, fim) => ts.slice(ts.indexOf(ini), ts.indexOf(fim, ts.indexOf(ini) + 1));

test("saída vencida = acesso recusado no login e na sessão aberta", () => {
  const ca = bloco("async function contaAtiva", "\n}\n");
  assert.match(ca, /!!Number\(m\.ativo\) && !membroDesligado\(m\.saida\)/);
  // colaborador fixo (COLABS) também é barrado pela membro (antes só pela lista INATIVOS)
  assert.doesNotMatch(ca, /if \(COLABS\.includes\(slug\)\) return !INATIVOS\.includes\(slug\);/);
  assert.match(bloco("async function papelTenantDe", "\n}\n"), /!membroDesligado\(row\.saida\)/);
  assert.match(ts, /function membroDesligado\(saida: unknown, hojeIso = new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\): boolean \{/);
  assert.match(ts, /&& s < hojeIso;/); // vale até o fim do próprio dia
});

test("cron diário efetiva o desligamento (ativo=0, sessões encerradas, auditoria)", () => {
  const ef = bloco("async function efetivaDesligamentos", "\n}\n");
  assert.match(ef, /UPDATE membro SET ativo = 0/);
  assert.match(ef, /DELETE FROM sess WHERE tenant_id = \? AND slug = \?/);
  assert.match(ef, /audit\("membro_desligado"/);
  assert.match(ts, /event\.cron === "0 6 \* \* \*"\) \{ ctx\.waitUntil\(run\("backup", backupD1\(env\)\)\); ctx\.waitUntil\(run\("desligamentos", efetivaDesligamentos\(env\)\)\); \}/);
});

test("RH: rhmembroset aceita a data com guardas; tela tem a coluna Saída; migração 0016", () => {
  const b = bloco('if (action === "rhmembroset")', 'if (action === "rhmembrodel")');
  assert.match(b, /sets\.push\("saida = \?"\)/);
  assert.match(b, /O dono do portal não pode ter saída agendada/);
  assert.match(html, /class="cl-saida" type="date"/);
  assert.match(html, /payload\.saida=sd/);
  assert.match(readFileSync(join(root, "migrations/0016_membro_saida.sql"), "utf8"), /ALTER TABLE membro ADD COLUMN saida TEXT DEFAULT ''/);
  assert.match(ts, /ALTER TABLE membro ADD COLUMN saida TEXT DEFAULT ''/);
});
