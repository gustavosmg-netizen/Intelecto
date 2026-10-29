-- ============================================================================
-- Migration 0013 — CRM na casca nova: tags, atividades e filtros salvos
-- ----------------------------------------------------------------------------
-- crm_tag / crm_deal_tag: tags POR PESSOA (slug) — cada um organiza o próprio
--   funil, invisível aos demais (decisão do dono). Cor de paleta fechada.
-- crm_atividade: histórico do negócio (nota, ligação, reunião, e-mail, tarefa
--   com prazo/responsável = próximo passo) + rastro automático de mudança de
--   etapa (tipo 'etapa'). Compartilhado com quem acessa o CRM.
-- filtro_salvo: filtros nomeados POR PESSOA e por módulo ('crm', 'financeiro').
-- Espelho do ensureSchema (SCHEMA_VER 2026-10-29b). Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_tag (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, slug TEXT NOT NULL,
  nome TEXT NOT NULL DEFAULT '', cor TEXT NOT NULL DEFAULT 'cinza', criado TEXT DEFAULT '',
  PRIMARY KEY (tenant_id, id));
CREATE INDEX IF NOT EXISTS idx_crm_tag_slug ON crm_tag (tenant_id, slug);

CREATE TABLE IF NOT EXISTS crm_deal_tag (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, deal_id TEXT NOT NULL,
  tag_id TEXT NOT NULL, PRIMARY KEY (tenant_id, slug, deal_id, tag_id));

CREATE TABLE IF NOT EXISTS crm_atividade (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, deal_id TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'nota', texto TEXT DEFAULT '', data TEXT DEFAULT '', prazo TEXT DEFAULT '',
  resp TEXT DEFAULT '', feito INTEGER DEFAULT 0, autor TEXT DEFAULT '', criado TEXT DEFAULT '',
  PRIMARY KEY (tenant_id, id));
CREATE INDEX IF NOT EXISTS idx_crm_ativ_deal ON crm_atividade (tenant_id, deal_id);

CREATE TABLE IF NOT EXISTS filtro_salvo (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, slug TEXT NOT NULL,
  modulo TEXT NOT NULL, nome TEXT NOT NULL DEFAULT '', filtro TEXT DEFAULT '{}', criado TEXT DEFAULT '',
  PRIMARY KEY (tenant_id, id));
CREATE INDEX IF NOT EXISTS idx_filtro_slug ON filtro_salvo (tenant_id, slug, modulo);
