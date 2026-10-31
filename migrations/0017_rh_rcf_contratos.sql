-- ============================================================================
-- Migration 0017 — RH: RCF digital, ciência, contratos e acordos de colaboradores
-- ----------------------------------------------------------------------------
-- rh_cargo.rcf: RCF (Responsabilidades, Cargos e Funções) no modelo da casa, JSON
--   normalizado por src/rh.mjs (missão, indicadores, responsabilidades Jr/Pl/Sr,
--   matrizes de conhecimentos e soft skills 1–3, exigências, status e revisão).
-- rh_rcf_ciencia: ciência do ocupante POR REVISÃO (nova revisão pede nova ciência).
-- rh_contrato / rh_acordo: vínculo (CLT, PJ, estágio, sócio…), vigência, renovação,
--   carga semanal (alimenta capacidade_vig) e acordos — SEM valores monetários.
-- Espelho do ensureSchema (SCHEMA_VER 2026-10-30c). Idempotente.
-- ============================================================================

ALTER TABLE rh_cargo ADD COLUMN rcf TEXT DEFAULT '';
CREATE TABLE IF NOT EXISTS rh_rcf_ciencia (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, cid TEXT NOT NULL, revisao TEXT NOT NULL DEFAULT '',
  ciente_em TEXT DEFAULT '', PRIMARY KEY (tenant_id, slug, cid, revisao));
CREATE TABLE IF NOT EXISTS rh_contrato (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, slug TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'CLT',
  inicio TEXT DEFAULT '', fim TEXT DEFAULT '', renovacao_auto INTEGER DEFAULT 0, carga_semanal REAL DEFAULT 0,
  doc_url TEXT DEFAULT '', obs TEXT DEFAULT '', u TEXT DEFAULT '', criado TEXT DEFAULT '', atualizado TEXT DEFAULT '',
  PRIMARY KEY (tenant_id, id));
CREATE TABLE IF NOT EXISTS rh_acordo (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, slug TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'Outro',
  descricao TEXT DEFAULT '', inicio TEXT DEFAULT '', fim TEXT DEFAULT '', doc_url TEXT DEFAULT '',
  u TEXT DEFAULT '', criado TEXT DEFAULT '', atualizado TEXT DEFAULT '', PRIMARY KEY (tenant_id, id));
