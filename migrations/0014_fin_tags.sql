-- ============================================================================
-- Migration 0014 — Financeiro na casca nova: tags dos lançamentos de caixa
-- ----------------------------------------------------------------------------
-- fin_tag / fluxo_tag: tags POR PESSOA (slug), mesma regra do CRM (decisão do
-- dono). A classificação compartilhada continua em fluxo.categoria. Filtros
-- salvos do quadro usam filtro_salvo (modulo='financeiro', migração 0013).
-- Espelho do ensureSchema (SCHEMA_VER 2026-10-29c). Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS fin_tag (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, slug TEXT NOT NULL,
  nome TEXT NOT NULL DEFAULT '', cor TEXT NOT NULL DEFAULT 'cinza', criado TEXT DEFAULT '',
  PRIMARY KEY (tenant_id, id));
CREATE INDEX IF NOT EXISTS idx_fin_tag_slug ON fin_tag (tenant_id, slug);

CREATE TABLE IF NOT EXISTS fluxo_tag (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, fluxo_id TEXT NOT NULL,
  tag_id TEXT NOT NULL, PRIMARY KEY (tenant_id, slug, fluxo_id, tag_id));
