// Portal clássico — CRM e Financeiro melhorados nas abas existentes (asserts de fonte).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "public/index.html"), "utf8");

test("CRM clássico: filtros, filtros salvos por pessoa, arrastar entre fases", () => {
  assert.match(html, /function _crmFiltrados\(\)/);
  assert.match(html, /api\("filtroSet",\{modulo:"crm"/);
  assert.match(html, /api\("filtroList",\{modulo:"crm"\}\)/);
  assert.match(html, /draggable="true"/);
  assert.match(html, /api\("crmDealStage",\{id:id,alvo:"fase:"\+fase\}\)/);
  // a busca redesenha só as colunas (não perde o foco do campo)
  assert.match(html, /q\.oninput=function\(\)\{CRMF\.q=q\.value;CRMSALVO="";_crmRenderCols\(\);\}/);
});

test("CRM clássico: painel do negócio com subetapa, minhas tags e atividades", () => {
  assert.match(html, /function _crmDealExtra\(d\)/);
  assert.match(html, /api\("crmDealStage",\{id:d\.id,alvo:"st:"\+st\.value\}\)/);
  assert.match(html, /api\("crmDealTag",\{deal:d\.id/);
  assert.match(html, /api\("crmAtividadeSet",pay\)/);
  assert.match(html, /api\("crmAtividades",\{deal:d\.id\}\)/);
});

test("Financeiro clássico: contas a pagar/receber com arrastar, filtros salvos, lote e tags", () => {
  assert.match(html, /data-tab="fin-tab-contas"/);
  assert.match(html, /function _fincSit\(x,hj\)/);
  assert.match(html, /function _fincTrans\(de,para\)/);
  assert.match(html, /api\("fluxoLote",Object\.assign\(\{op:op,ids:ids\}/);
  assert.match(html, /api\("fluxoCc",\{ids:FINC\.sel\.slice\(\)/);
  assert.match(html, /api\("fluxoTag",\{tag:t,ids:FINC\.sel\.slice\(\)/);
  assert.match(html, /api\("filtroSet",\{modulo:"financeiro"/);
  assert.match(html, /_finResumo\(\);_finContas\(\);_finCarteira\(\)/);
});
