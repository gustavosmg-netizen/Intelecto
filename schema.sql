-- Esquema do Portal de Gestao Intelecto & CSTR (SQLite / Cloudflare D1). Rev02, 2026-10-06.
-- 16 tabelas de dados + tabela formal de papel (membro). Todas carregam tenant_id.
-- Multi-tenant nasce no SERVIDOR (tenant_id), mas so o tenant 'intelecto' esta ativo:
-- toda linha legada e do tenant Intelecto. O isolamento e o filtro tenant_id no Worker
-- (T2), nunca a UI. Aplicado com:
--   wrangler d1 execute portal-intelecto --remote --file=schema.sql
-- Em banco ja existente, a migracao delta-safe e feita por ensureSchema() (ALTER
-- idempotente) e pelo script migracoes_dados/T-1_migracao_tenant_papel_Rev00_2026-10-06.sql.

CREATE TABLE IF NOT EXISTS lanc (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL, d TEXT NOT NULL, cc TEXT NOT NULL, h REAL NOT NULL,
  t TEXT DEFAULT '', s TEXT DEFAULT 'PENDENTE', m TEXT DEFAULT '', a TEXT DEFAULT '', c TEXT DEFAULT '', u TEXT DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS proj (
  cc TEXT PRIMARY KEY, projeto TEXT NOT NULL, subtipo TEXT DEFAULT '', status TEXT DEFAULT 'A INICIAR',
  inicio TEXT DEFAULT '', previsto TEXT DEFAULT '', fim TEXT DEFAULT '', registro TEXT DEFAULT 'ATIVO',
  alterado_por TEXT DEFAULT '', alterado_em TEXT DEFAULT '',
  empresa TEXT DEFAULT '', cliente TEXT DEFAULT '', tipo TEXT DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS conteudo (
  id TEXT PRIMARY KEY, area TEXT NOT NULL, titulo TEXT NOT NULL, descricao TEXT DEFAULT '', url TEXT DEFAULT '',
  tag TEXT DEFAULT '', destaque INTEGER DEFAULT 0, autor TEXT DEFAULT '', criado TEXT DEFAULT '', u TEXT DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS sess (token TEXT PRIMARY KEY, slug TEXT NOT NULL, criado TEXT DEFAULT '', ultimo TEXT DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS audit (ts TEXT, slug TEXT, ev TEXT, det TEXT DEFAULT '', ip TEXT DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS docs (slug TEXT PRIMARY KEY, titulo TEXT, drive TEXT DEFAULT '', tipo TEXT DEFAULT 'md', corpo TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS solic (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL, itens TEXT DEFAULT '', obs TEXT DEFAULT '', status TEXT DEFAULT 'ABERTA',
  criado TEXT DEFAULT '', atendido_por TEXT DEFAULT '', atendido_em TEXT DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS projx (
  cc TEXT PRIMARY KEY, com TEXT DEFAULT '', assin TEXT DEFAULT '', prev REAL DEFAULT 0, obs TEXT DEFAULT '', u TEXT DEFAULT '',
  setor TEXT DEFAULT '', resp TEXT DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS andam (
  id TEXT PRIMARY KEY, cc TEXT NOT NULL, d TEXT NOT NULL, etapa INTEGER DEFAULT 0, total INTEGER DEFAULT 0,
  detalhe TEXT DEFAULT '', slug TEXT DEFAULT '', criado TEXT DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS prod (
  n INTEGER PRIMARY KEY, titulo TEXT, tipo TEXT, sit TEXT, met TEXT DEFAULT '', norma TEXT DEFAULT '',
  apr TEXT DEFAULT '', sec TEXT DEFAULT '', ccs TEXT DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS prevf (cc TEXT NOT NULL, func TEXT NOT NULL, h REAL DEFAULT 0, u TEXT DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', PRIMARY KEY (cc, func));

CREATE TABLE IF NOT EXISTS evento (
  id TEXT PRIMARY KEY, d TEXT NOT NULL, dfim TEXT DEFAULT '', hora TEXT DEFAULT '', tipo TEXT DEFAULT 'REUNIAO',
  titulo TEXT NOT NULL, setor TEXT DEFAULT '', cc TEXT DEFAULT '', resp TEXT DEFAULT '', fase TEXT DEFAULT '',
  local TEXT DEFAULT '', obs TEXT DEFAULT '', autor TEXT DEFAULT '', criado TEXT DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS biblio (
  id TEXT PRIMARY KEY, titulo TEXT NOT NULL, tipo TEXT DEFAULT 'NORMA', tema TEXT DEFAULT '', norma TEXT DEFAULT '',
  ano TEXT DEFAULT '', cc TEXT DEFAULT '', url TEXT DEFAULT '', doc TEXT DEFAULT '', resumo TEXT DEFAULT '',
  tags TEXT DEFAULT '', destaque INTEGER DEFAULT 0, autor TEXT DEFAULT '', criado TEXT DEFAULT '', u TEXT DEFAULT '',
  dominio TEXT DEFAULT '', assunto TEXT DEFAULT '', aplica TEXT DEFAULT '', criterio TEXT DEFAULT '', limites TEXT DEFAULT '',
  pratica TEXT DEFAULT '', evidencia TEXT DEFAULT '', revisao TEXT DEFAULT '', situacao TEXT DEFAULT 'VIGENTE',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS param (
  id TEXT PRIMARY KEY, dominio TEXT DEFAULT 'GER', parametro TEXT NOT NULL, unidade TEXT DEFAULT '', faixa TEXT DEFAULT '',
  pratica TEXT DEFAULT '', condicao TEXT DEFAULT '', fonte TEXT DEFAULT '', risco TEXT DEFAULT '', verificacao TEXT DEFAULT '',
  autor TEXT DEFAULT '', criado TEXT DEFAULT '', u TEXT DEFAULT '', situacao TEXT DEFAULT 'RASCUNHO',
  tenant_id TEXT NOT NULL DEFAULT 'intelecto');

CREATE TABLE IF NOT EXISTS progcurso (
  slug TEXT NOT NULL, curso TEXT NOT NULL, modulo TEXT NOT NULL, nota REAL DEFAULT 0, total REAL DEFAULT 0,
  quando TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto', PRIMARY KEY (slug, curso, modulo));

-- Modelo de papel FORMAL (substitui a inferencia por listas de slug COORDS/COLABS/OWNER).
-- Papel aninhado: admin > coordenacao > equipe > cliente. Fornecedor e LATERAL (nao aninhado;
-- restrito ao que lhe diz respeito). Identidade/credencial (pin:/email:) continua em config;
-- membro e a autoridade de papel + tenant por identidade e o futuro lar de Cliente/Fornecedor.
CREATE TABLE IF NOT EXISTS membro (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto',
  slug      TEXT NOT NULL,
  papel     TEXT NOT NULL DEFAULT 'equipe'
            CHECK (papel IN ('admin','coordenacao','equipe','cliente','fornecedor')),
  nome      TEXT DEFAULT '',
  ativo     INTEGER DEFAULT 1,
  criado    TEXT DEFAULT '',
  u         TEXT DEFAULT '',
  PRIMARY KEY (tenant_id, slug));

CREATE INDEX IF NOT EXISTS lanc_slug_d ON lanc (slug, d);
CREATE INDEX IF NOT EXISTS audit_ts ON audit (ts);
CREATE INDEX IF NOT EXISTS evento_d ON evento (d);
CREATE INDEX IF NOT EXISTS lanc_tenant ON lanc (tenant_id);
CREATE INDEX IF NOT EXISTS proj_tenant ON proj (tenant_id);
CREATE INDEX IF NOT EXISTS membro_slug ON membro (slug);
