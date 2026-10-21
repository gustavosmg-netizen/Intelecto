-- ============================================================================
-- Migration 0006 — Academia (Onda 4): cursos, aulas, matrícula, progresso, certificado
-- ----------------------------------------------------------------------------
-- Fecha o ciclo aprender → comprovar → alocar. O certificado, ao ser emitido,
-- grava um treinamento na ficha da pessoa (pessoa_treino). A alternativa correta do
-- quiz vive em curso_aula.quiz (JSON) e NUNCA é enviada ao cliente — a nota é calculada
-- no servidor. Sem valor monetário. O seed do 1º curso ("Como usar o portal") é aplicado
-- pelo ensureSchema. Idempotente. Aplicar em STAGING primeiro.
-- ============================================================================

CREATE TABLE IF NOT EXISTS curso (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', cid TEXT NOT NULL, titulo TEXT DEFAULT '',
  resumo TEXT DEFAULT '', categoria TEXT DEFAULT '', cargo_alvo TEXT DEFAULT '', carga_h REAL DEFAULT 0,
  publicado INTEGER DEFAULT 0, ordem INTEGER DEFAULT 0, capa TEXT DEFAULT '',
  atualizado TEXT DEFAULT '', u TEXT DEFAULT '', PRIMARY KEY (tenant_id, cid));

CREATE TABLE IF NOT EXISTS curso_modulo (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, curso_id TEXT NOT NULL,
  titulo TEXT DEFAULT '', ordem INTEGER DEFAULT 0, u TEXT DEFAULT '', PRIMARY KEY (tenant_id, id));
CREATE INDEX IF NOT EXISTS curso_modulo_c ON curso_modulo (tenant_id, curso_id, ordem);

CREATE TABLE IF NOT EXISTS curso_aula (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, curso_id TEXT NOT NULL, modulo_id TEXT DEFAULT '',
  titulo TEXT DEFAULT '', tipo TEXT DEFAULT 'texto', conteudo TEXT DEFAULT '', url TEXT DEFAULT '',
  ordem INTEGER DEFAULT 0, quiz TEXT DEFAULT '', min_nota REAL DEFAULT 70, u TEXT DEFAULT '', PRIMARY KEY (tenant_id, id));
CREATE INDEX IF NOT EXISTS curso_aula_c ON curso_aula (tenant_id, curso_id, ordem);

CREATE TABLE IF NOT EXISTS matricula (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, curso_id TEXT NOT NULL,
  status TEXT DEFAULT 'ativa', iniciado TEXT DEFAULT '', concluido TEXT DEFAULT '', PRIMARY KEY (tenant_id, slug, curso_id));

CREATE TABLE IF NOT EXISTS aula_prog (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, aula_id TEXT NOT NULL, curso_id TEXT DEFAULT '',
  nota REAL DEFAULT 0, concluido_em TEXT DEFAULT '', PRIMARY KEY (tenant_id, slug, aula_id));
CREATE INDEX IF NOT EXISTS aula_prog_sc ON aula_prog (tenant_id, slug, curso_id);

CREATE TABLE IF NOT EXISTS certificado (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, curso_id TEXT NOT NULL,
  titulo TEXT DEFAULT '', carga_h REAL DEFAULT 0, emitido TEXT DEFAULT '', u TEXT DEFAULT '');
CREATE INDEX IF NOT EXISTS certificado_sc ON certificado (tenant_id, slug, curso_id);
