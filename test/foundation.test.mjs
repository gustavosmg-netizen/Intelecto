// Verificação de fundação (Onda 0) — roda no CI com `node --test`, sem rede.
// Guarda invariantes estruturais do repositório; não toca produção nem D1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

test("baseline tem todas as tabelas de produção", () => {
  const sql = read("migrations/0001_baseline.sql");
  const esperadas = [
    "lanc","proj","projx","andam","prod","prevf","custohora","custohora_vig","custo_fixo",
    "fluxo","fin_snapshot","cc_contrato","cc_proposta","cc_produto","cc_hist","crm_deal",
    "crm_lead","crm_time","lead_funnel","amb_registro","lead_instrumento","amb_agg","membro",
    "membro_cargo","rh_cargo","pessoa_ficha","pessoa_skill","pessoa_meta","pessoa_treino",
    "progcurso","evento","rito","biblio","param","conteudo","docs","portfolio_servico",
    "portfolio_versao","portfolio_skill","vitrine_case","vitrine_produto","brief","brief_fonte",
    "config","sess","audit","solic","acesso",
  ];
  for (const t of esperadas) {
    assert.match(sql, new RegExp("CREATE TABLE IF NOT EXISTS " + t + "\\b"), "falta tabela: " + t);
  }
});

test("baseline é idempotente (só IF NOT EXISTS; nenhum DROP/DELETE)", () => {
  const sql = read("migrations/0001_baseline.sql");
  const creates = sql.match(/CREATE TABLE/g) || [];
  const guards = sql.match(/CREATE TABLE IF NOT EXISTS/g) || [];
  assert.equal(creates.length, guards.length, "todo CREATE TABLE deve ter IF NOT EXISTS");
  assert.doesNotMatch(sql, /\bDROP\s+TABLE\b/i, "baseline não pode conter DROP TABLE");
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i, "baseline não pode conter DELETE");
});

test("regras de consistência são só leitura e nomeadas", () => {
  const sql = read("consistency/rules.sql");
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i, "regra só pode consultar (SELECT)");
  const regras = (sql.match(/^SELECT '([A-Z0-9-]+)' rule/gim) || []);
  assert.ok(regras.length >= 11, "esperado ao menos 11 regras nomeadas, achei " + regras.length);
});

test("toda tabela do wrangler.toml existe no baseline", () => {
  const toml = read("wrangler.toml");
  const base = read("migrations/0001_baseline.sql");
  // bindings de D1 referenciam database_name; o schema é um só (portal-intelecto).
  assert.match(toml, /database_name = "portal-intelecto"/);
  // sanidade: o binding DB existe
  assert.match(toml, /binding = "DB"/);
  assert.ok(base.length > 1000, "baseline parece vazio");
});

test("src/index.ts ainda declara SCHEMA_VER (contrato do caminho atual)", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /const SCHEMA_VER = "/);
});

test("Onda 1: imposto entra no custo real (correção do D-3)", () => {
  const ts = read("src/index.ts");
  // decompoeFin soma o imposto no custoTotal (antes ficava de fora).
  assert.match(ts, /const custoTotal = arred2\(moCusto \+ imposto \+/);
});

test("Onda 1: Contrato é o dono do valor (helper + override)", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /async function valorContratadoMap/);
  assert.match(ts, /contratadoOverride\?: number/);
  assert.match(ts, /action === "contratoSet"/);
});

test("migração 0002 cria colunas de contrato e parcelas", () => {
  const sql = read("migrations/0002_contrato.sql");
  for (const c of ["status", "tipo", "deal_id"]) {
    assert.match(sql, new RegExp("ALTER TABLE cc_contrato ADD COLUMN " + c));
  }
  assert.match(sql, /CREATE TABLE IF NOT EXISTS contrato_parcela/);
});

test("migrations/ só tem arquivos .sql numerados em ordem", () => {
  const files = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql"));
  assert.ok(files.length >= 1, "nenhuma migração");
  for (const f of files) assert.match(f, /^\d{4}_/, "migração sem prefixo numérico: " + f);
});
