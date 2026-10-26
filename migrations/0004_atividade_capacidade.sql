-- ============================================================================
-- Migration 0004 — Catálogo de atividades + capacidade com vigência (Onda 1)
-- ----------------------------------------------------------------------------
-- Tira do código (1) as palavras-chave que classificam o apontamento como
-- não-trabalho (feriado/férias/ausência) e (2) a lista fixa de capacidade (CAP20).
-- Ambas viram dados do tenant, editáveis — é o que torna a capacidade reaproveitável
-- por outra empresa. O seed reproduz o comportamento de hoje (mesmos termos; 20h
-- para estagiários, 40h para os demais), para nada mudar no dia 1.
--
-- O seed por colaborador (capacidade_vig) é feito pelo ensureSchema a partir da
-- lista COLABS/CAP20 no deploy; aqui ficam só as tabelas e o seed do catálogo de
-- classes (independente de pessoas). Idempotente. Aplicar em STAGING primeiro.
-- ============================================================================

CREATE TABLE IF NOT EXISTS atividade_classe (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', cid TEXT NOT NULL, nome TEXT DEFAULT '',
  classe TEXT NOT NULL DEFAULT 'feriado', padroes TEXT DEFAULT '', ordem INTEGER DEFAULT 0,
  atualizado TEXT DEFAULT '', u TEXT DEFAULT '', PRIMARY KEY (tenant_id, cid));

INSERT OR IGNORE INTO atividade_classe (tenant_id, cid, nome, classe, padroes, ordem) VALUES
  ('intelecto','feriado','Feriado','feriado','Feriado',0),
  ('intelecto','ferias','Férias','ferias','Ferias|Férias',1),
  ('intelecto','ausj','Ausência justificada','aus_just','Ausente Justificado',2),
  ('intelecto','ausn','Ausência não justificada','aus_naojust','Ausente Não Justificado|Ausente Nao Justificado',3);

CREATE TABLE IF NOT EXISTS capacidade_vig (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, desde TEXT NOT NULL,
  horas_semana REAL DEFAULT 40, u TEXT DEFAULT '', criado TEXT DEFAULT '',
  PRIMARY KEY (tenant_id, slug, desde));
-- O seed por pessoa (20h estagiários / 40h demais, desde 2025-01-01) é aplicado pelo
-- ensureSchema com a lista de colaboradores. Para aplicar sem o Worker, preencher aqui
-- com um INSERT OR IGNORE por colaborador conforme a realidade da casa.
