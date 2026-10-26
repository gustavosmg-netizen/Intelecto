-- ============================================================================
-- Migration 0001 — BASELINE do schema de produção (portal-intelecto / D1)
-- ----------------------------------------------------------------------------
-- Capturado de sqlite_master em 2026-10-19 (D1 75a51d70..., 47 tabelas de
-- aplicação + índices). É o ponto de partida da gestão de schema por migração
-- versionada (substitui, no caminho novo, o ensureSchema() + SCHEMA_VER em
-- tempo de execução). NÃO altera nada em produção: todas as tabelas já existem;
-- CREATE TABLE IF NOT EXISTS é idempotente. A tabela interna _cf_KV do D1 e os
-- índices automáticos não entram aqui.
--
-- Onda 0 do Plano Diretor do Portal. Não aplicar em produção sem OK — o alvo é
-- aplicar primeiro num D1 de staging (cópia anonimizada).
-- ============================================================================

-- ---- Operação: horas, projetos, centros de custo -----------------------------
CREATE TABLE IF NOT EXISTS lanc (id TEXT PRIMARY KEY, slug TEXT NOT NULL, d TEXT NOT NULL, cc TEXT NOT NULL, h REAL NOT NULL, t TEXT DEFAULT '', s TEXT DEFAULT 'PENDENTE', m TEXT DEFAULT '', a TEXT DEFAULT '', c TEXT DEFAULT '', u TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto', origem TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS proj (cc TEXT PRIMARY KEY, projeto TEXT NOT NULL, subtipo TEXT DEFAULT '', status TEXT DEFAULT 'A INICIAR', inicio TEXT DEFAULT '', previsto TEXT DEFAULT '', fim TEXT DEFAULT '', registro TEXT DEFAULT 'ATIVO', alterado_por TEXT DEFAULT '', alterado_em TEXT DEFAULT '', empresa TEXT DEFAULT '', cliente TEXT DEFAULT '', tipo TEXT DEFAULT '', etapa TEXT DEFAULT '', progresso TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto', liberado_cliente INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS projx (cc TEXT PRIMARY KEY, com TEXT DEFAULT '', assin TEXT DEFAULT '', prev REAL DEFAULT 0, obs TEXT DEFAULT '', u TEXT DEFAULT '', setor TEXT DEFAULT '', resp TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto', gravidade INTEGER DEFAULT 0, urgencia INTEGER DEFAULT 0, tendencia INTEGER DEFAULT 0, progresso INTEGER DEFAULT 0, contratado REAL DEFAULT 0, pct_imposto REAL DEFAULT 0, pct_rateio REAL DEFAULT 0, pct_lucro REAL DEFAULT 0, outros REAL DEFAULT 0, fin_u TEXT DEFAULT '', consumiveis REAL DEFAULT 0, terceiros REAL DEFAULT 0, impacto INTEGER DEFAULT 0, esforco INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS andam (id TEXT PRIMARY KEY, cc TEXT NOT NULL, d TEXT NOT NULL, etapa INTEGER DEFAULT 0, total INTEGER DEFAULT 0, detalhe TEXT DEFAULT '', slug TEXT DEFAULT '', criado TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto');
CREATE TABLE IF NOT EXISTS prod (n INTEGER PRIMARY KEY, titulo TEXT, tipo TEXT, sit TEXT, met TEXT DEFAULT '', norma TEXT DEFAULT '', apr TEXT DEFAULT '', sec TEXT DEFAULT '', ccs TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto');
CREATE TABLE IF NOT EXISTS prevf (cc TEXT NOT NULL, func TEXT NOT NULL, h REAL DEFAULT 0, u TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto', PRIMARY KEY (cc, func));

-- ---- Financeiro (R$ — acesso restrito na aplicação) --------------------------
CREATE TABLE IF NOT EXISTS custohora (tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, valor REAL DEFAULT 0, u TEXT DEFAULT '', atualizado TEXT DEFAULT '', PRIMARY KEY (tenant_id, slug));
CREATE TABLE IF NOT EXISTS custohora_vig (tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, desde TEXT NOT NULL, valor REAL DEFAULT 0, motivo TEXT DEFAULT '', u TEXT DEFAULT '', criado TEXT DEFAULT '', PRIMARY KEY (tenant_id, slug, desde));
CREATE TABLE IF NOT EXISTS custo_fixo (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', categoria TEXT NOT NULL DEFAULT 'outros', descricao TEXT DEFAULT '', valor REAL DEFAULT 0, u TEXT DEFAULT '', criado TEXT DEFAULT '', atualizado TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS fluxo (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', tipo TEXT NOT NULL DEFAULT 'entrada' CHECK (tipo IN ('entrada','saida')), categoria TEXT DEFAULT '', descricao TEXT DEFAULT '', cc TEXT DEFAULT '', valor REAL DEFAULT 0, data_prev TEXT DEFAULT '', data_real TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto','realizado','cancelado')), origem TEXT DEFAULT 'manual', u TEXT DEFAULT '', criado TEXT DEFAULT '', atualizado TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS fin_snapshot (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', d TEXT NOT NULL, dados TEXT NOT NULL DEFAULT '{}', autor TEXT DEFAULT '', criado TEXT DEFAULT '');

-- ---- Estrutura por centro de custo (preparação do backend futuro) ------------
CREATE TABLE IF NOT EXISTS cc_contrato (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', cc TEXT NOT NULL, titulo TEXT DEFAULT '', valor REAL DEFAULT 0, assinado TEXT DEFAULT '', obs TEXT DEFAULT '', u TEXT DEFAULT '', criado TEXT DEFAULT '', atualizado TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS cc_proposta (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', cc TEXT NOT NULL, titulo TEXT DEFAULT '', valor REAL DEFAULT 0, status TEXT DEFAULT '', enviada TEXT DEFAULT '', obs TEXT DEFAULT '', u TEXT DEFAULT '', criado TEXT DEFAULT '', atualizado TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS cc_produto (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', cc TEXT NOT NULL, titulo TEXT DEFAULT '', tipo TEXT DEFAULT '', status TEXT DEFAULT '', obs TEXT DEFAULT '', u TEXT DEFAULT '', criado TEXT DEFAULT '', atualizado TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS cc_hist (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', cc TEXT NOT NULL, d TEXT DEFAULT '', tipo TEXT DEFAULT '', detalhe TEXT DEFAULT '', u TEXT DEFAULT '', criado TEXT DEFAULT '');

-- ---- CRM comercial -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_deal (tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, st INTEGER DEFAULT 0, co TEXT DEFAULT '', city TEXT DEFAULT '', seg TEXT DEFAULT '', prod TEXT DEFAULT '', val REAL DEFAULT 0, owner TEXT DEFAULT '', pri TEXT DEFAULT '', contact TEXT DEFAULT '', role TEXT DEFAULT '', email TEXT DEFAULT '', phone TEXT DEFAULT '', src TEXT DEFAULT '', pain TEXT DEFAULT '', entry TEXT DEFAULT '', d4date TEXT DEFAULT '', sentdate TEXT DEFAULT '', signeddate TEXT DEFAULT '', lastdate TEXT DEFAULT '', last TEXT DEFAULT '', nextdate TEXT DEFAULT '', next TEXT DEFAULT '', lossreason TEXT DEFAULT '', autuacao TEXT DEFAULT '', temp TEXT DEFAULT '', tempreason TEXT DEFAULT '', history TEXT DEFAULT '', cc TEXT DEFAULT '', atualizado TEXT DEFAULT '', PRIMARY KEY (tenant_id, id));
CREATE TABLE IF NOT EXISTS crm_lead (tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, empresa TEXT DEFAULT '', segmento TEXT DEFAULT '', cidade TEXT DEFAULT '', produto TEXT DEFAULT '', porte TEXT DEFAULT '', sinal TEXT DEFAULT '', fonte TEXT DEFAULT '', contato TEXT DEFAULT '', cargo TEXT DEFAULT '', telefone TEXT DEFAULT '', email TEXT DEFAULT '', status TEXT DEFAULT '', descoberto TEXT DEFAULT '', origem TEXT DEFAULT '', mensagem TEXT DEFAULT '', canal TEXT DEFAULT '', dealid TEXT DEFAULT '', aprovado TEXT DEFAULT '', descartado TEXT DEFAULT '', PRIMARY KEY (tenant_id, id));
CREATE TABLE IF NOT EXISTS crm_time (tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, d TEXT DEFAULT '', area TEXT DEFAULT '', hours REAL DEFAULT 0, note TEXT DEFAULT '', updatedat TEXT DEFAULT '', deleted INTEGER DEFAULT 0, PRIMARY KEY (tenant_id, id));
CREATE TABLE IF NOT EXISTS lead_funnel (tenant_id TEXT NOT NULL DEFAULT 'intelecto', lead_key TEXT NOT NULL, status TEXT DEFAULT '', notas TEXT DEFAULT '', dono TEXT DEFAULT '', atualizado_em TEXT DEFAULT '', PRIMARY KEY (tenant_id, lead_key));

-- ---- Leads ambientais (explorador multi-banco) -------------------------------
CREATE TABLE IF NOT EXISTS amb_registro (tenant_id TEXT NOT NULL DEFAULT 'intelecto', bank TEXT NOT NULL, id TEXT NOT NULL, bacia TEXT DEFAULT '', municipio TEXT DEFAULT '', uf TEXT DEFAULT 'MG', lat REAL, lon REAL, rotulo TEXT DEFAULT '', setor TEXT DEFAULT '', classe TEXT DEFAULT '', situacao TEXT DEFAULT '', ord REAL DEFAULT 0, dt TEXT DEFAULT '', props TEXT DEFAULT '{}', busca TEXT DEFAULT '', PRIMARY KEY (tenant_id, bank, id));
CREATE TABLE IF NOT EXISTS lead_instrumento (tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, lead_id TEXT DEFAULT '', municipio TEXT DEFAULT '', instrumento TEXT DEFAULT '', orgao TEXT DEFAULT '', numero TEXT DEFAULT '', situacao TEXT DEFAULT '', prazo TEXT DEFAULT '', obrigacoes TEXT DEFAULT '', problema TEXT DEFAULT '', servico TEXT DEFAULT '', fonte TEXT DEFAULT '', url_fonte TEXT DEFAULT '', data_consulta TEXT DEFAULT '', PRIMARY KEY (tenant_id, id));
CREATE TABLE IF NOT EXISTS amb_agg (tenant_id TEXT NOT NULL DEFAULT 'intelecto', bank TEXT NOT NULL, bacia TEXT DEFAULT '', dim TEXT NOT NULL DEFAULT '', chave TEXT NOT NULL DEFAULT '', valor REAL DEFAULT 0, PRIMARY KEY (tenant_id, bank, bacia, dim, chave));

-- ---- Pessoas / RH ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS membro (tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, papel TEXT NOT NULL DEFAULT 'equipe' CHECK (papel IN ('admin','coordenacao','equipe','cliente','fornecedor')), nome TEXT DEFAULT '', ativo INTEGER DEFAULT 1, criado TEXT DEFAULT '', u TEXT DEFAULT '', email TEXT DEFAULT '', avatar TEXT DEFAULT '', cliente TEXT DEFAULT '', PRIMARY KEY (tenant_id, slug));
CREATE TABLE IF NOT EXISTS membro_cargo (tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, cid TEXT NOT NULL, principal INTEGER DEFAULT 0, prioridade INTEGER DEFAULT 0, foco TEXT DEFAULT '', criado TEXT DEFAULT '', u TEXT DEFAULT '', PRIMARY KEY (tenant_id, slug, cid));
CREATE TABLE IF NOT EXISTS rh_cargo (tenant_id TEXT NOT NULL DEFAULT 'intelecto', cid TEXT NOT NULL, nome TEXT DEFAULT '', ordem INTEGER DEFAULT 0, area TEXT DEFAULT '', missao TEXT DEFAULT '', responsabilidades TEXT DEFAULT '', entregaveis TEXT DEFAULT '', rotinas TEXT DEFAULT '', cadencia TEXT DEFAULT '', onboarding TEXT DEFAULT '', atualizado TEXT DEFAULT '', u TEXT DEFAULT '', horas_dia REAL DEFAULT 8, vinculo TEXT DEFAULT 'Contratado', metas TEXT DEFAULT '', PRIMARY KEY (tenant_id, cid));
CREATE TABLE IF NOT EXISTS pessoa_ficha (tenant_id TEXT NOT NULL DEFAULT 'intelecto', slug TEXT NOT NULL, resumo TEXT DEFAULT '', formacao TEXT DEFAULT '', experiencia TEXT DEFAULT '', lattes_url TEXT DEFAULT '', lattes_id TEXT DEFAULT '', cv_key TEXT DEFAULT '', cv_nome TEXT DEFAULT '', cv_atualizado TEXT DEFAULT '', atualizado TEXT DEFAULT '', u TEXT DEFAULT '', PRIMARY KEY (tenant_id, slug));
CREATE TABLE IF NOT EXISTS pessoa_skill (tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, slug TEXT NOT NULL, nome TEXT DEFAULT '', nivel INTEGER DEFAULT 1, origem TEXT DEFAULT 'manual', area TEXT DEFAULT '', obs TEXT DEFAULT '', atualizado TEXT DEFAULT '', u TEXT DEFAULT '', PRIMARY KEY (tenant_id, id));
CREATE TABLE IF NOT EXISTS pessoa_meta (tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, slug TEXT NOT NULL, objetivo TEXT DEFAULT '', prazo TEXT DEFAULT '', status TEXT DEFAULT 'aberta', progresso INTEGER DEFAULT 0, obs TEXT DEFAULT '', atualizado TEXT DEFAULT '', u TEXT DEFAULT '', PRIMARY KEY (tenant_id, id));
CREATE TABLE IF NOT EXISTS pessoa_treino (tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, slug TEXT NOT NULL, nome TEXT DEFAULT '', instituicao TEXT DEFAULT '', data TEXT DEFAULT '', carga_h REAL DEFAULT 0, comprov_key TEXT DEFAULT '', comprov_nome TEXT DEFAULT '', obs TEXT DEFAULT '', atualizado TEXT DEFAULT '', u TEXT DEFAULT '', PRIMARY KEY (tenant_id, id));
CREATE TABLE IF NOT EXISTS progcurso (slug TEXT NOT NULL, curso TEXT NOT NULL, modulo TEXT NOT NULL, nota REAL DEFAULT 0, total REAL DEFAULT 0, quando TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto', PRIMARY KEY (slug, curso, modulo));

-- ---- Agenda, ritos, conhecimento, portfólio, vitrine -------------------------
CREATE TABLE IF NOT EXISTS evento (id TEXT PRIMARY KEY, d TEXT NOT NULL, dfim TEXT DEFAULT '', hora TEXT DEFAULT '', tipo TEXT DEFAULT 'REUNIAO', titulo TEXT NOT NULL, setor TEXT DEFAULT '', cc TEXT DEFAULT '', resp TEXT DEFAULT '', fase TEXT DEFAULT '', local TEXT DEFAULT '', obs TEXT DEFAULT '', autor TEXT DEFAULT '', criado TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto', serie_id TEXT DEFAULT '', pauta TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS rito (tenant_id TEXT NOT NULL DEFAULT 'intelecto', rid TEXT NOT NULL, nome TEXT DEFAULT '', tipo TEXT DEFAULT '', cadencia TEXT DEFAULT '', publico TEXT DEFAULT '', objetivo TEXT DEFAULT '', pauta TEXT DEFAULT '', entregavel TEXT DEFAULT '', ordem INTEGER DEFAULT 0, atualizado TEXT DEFAULT '', u TEXT DEFAULT '', PRIMARY KEY (tenant_id, rid));
CREATE TABLE IF NOT EXISTS biblio (id TEXT PRIMARY KEY, titulo TEXT NOT NULL, tipo TEXT DEFAULT 'NORMA', tema TEXT DEFAULT '', norma TEXT DEFAULT '', ano TEXT DEFAULT '', cc TEXT DEFAULT '', url TEXT DEFAULT '', doc TEXT DEFAULT '', resumo TEXT DEFAULT '', tags TEXT DEFAULT '', destaque INTEGER DEFAULT 0, autor TEXT DEFAULT '', criado TEXT DEFAULT '', u TEXT DEFAULT '', dominio TEXT DEFAULT '', assunto TEXT DEFAULT '', aplica TEXT DEFAULT '', criterio TEXT DEFAULT '', limites TEXT DEFAULT '', pratica TEXT DEFAULT '', evidencia TEXT DEFAULT '', revisao TEXT DEFAULT '', situacao TEXT DEFAULT 'VIGENTE', tenant_id TEXT NOT NULL DEFAULT 'intelecto');
CREATE TABLE IF NOT EXISTS param (id TEXT PRIMARY KEY, dominio TEXT DEFAULT 'GER', parametro TEXT NOT NULL, unidade TEXT DEFAULT '', faixa TEXT DEFAULT '', pratica TEXT DEFAULT '', condicao TEXT DEFAULT '', fonte TEXT DEFAULT '', risco TEXT DEFAULT '', verificacao TEXT DEFAULT '', autor TEXT DEFAULT '', criado TEXT DEFAULT '', u TEXT DEFAULT '', situacao TEXT DEFAULT 'RASCUNHO', tenant_id TEXT NOT NULL DEFAULT 'intelecto');
CREATE TABLE IF NOT EXISTS conteudo (id TEXT PRIMARY KEY, area TEXT NOT NULL, titulo TEXT NOT NULL, descricao TEXT DEFAULT '', url TEXT DEFAULT '', tag TEXT DEFAULT '', destaque INTEGER DEFAULT 0, autor TEXT DEFAULT '', criado TEXT DEFAULT '', u TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto');
CREATE TABLE IF NOT EXISTS docs (slug TEXT PRIMARY KEY, titulo TEXT, drive TEXT DEFAULT '', tipo TEXT DEFAULT 'md', corpo TEXT, tenant_id TEXT NOT NULL DEFAULT 'intelecto');
CREATE TABLE IF NOT EXISTS portfolio_servico (tenant_id TEXT NOT NULL DEFAULT 'intelecto', sid TEXT NOT NULL, nome TEXT DEFAULT '', categoria TEXT DEFAULT '', resumo TEXT DEFAULT '', descricao TEXT DEFAULT '', publico INTEGER DEFAULT 0, ordem INTEGER DEFAULT 0, ativo INTEGER DEFAULT 1, ver_atual TEXT DEFAULT '', atualizado TEXT DEFAULT '', u TEXT DEFAULT '', PRIMARY KEY (tenant_id, sid));
CREATE TABLE IF NOT EXISTS portfolio_versao (tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, sid TEXT NOT NULL, versao TEXT DEFAULT '', descricao TEXT DEFAULT '', mudancas TEXT DEFAULT '', data TEXT DEFAULT '', autor TEXT DEFAULT '', criado TEXT DEFAULT '', PRIMARY KEY (tenant_id, id));
CREATE TABLE IF NOT EXISTS portfolio_skill (tenant_id TEXT NOT NULL DEFAULT 'intelecto', sid TEXT NOT NULL, skill TEXT NOT NULL, PRIMARY KEY (tenant_id, sid, skill));
CREATE TABLE IF NOT EXISTS vitrine_case (tenant_id TEXT NOT NULL DEFAULT 'intelecto', cid TEXT NOT NULL, titulo TEXT DEFAULT '', cliente_cc TEXT DEFAULT '', area TEXT DEFAULT '', resumo TEXT DEFAULT '', corpo TEXT DEFAULT '', capa TEXT DEFAULT '', capa_fonte TEXT DEFAULT '', publicado INTEGER DEFAULT 0, ordem INTEGER DEFAULT 0, ativo INTEGER DEFAULT 1, atualizado TEXT DEFAULT '', u TEXT DEFAULT '', PRIMARY KEY (tenant_id, cid));
CREATE TABLE IF NOT EXISTS vitrine_produto (tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, cid TEXT NOT NULL DEFAULT '', tipo TEXT DEFAULT 'prancha', titulo TEXT DEFAULT '', legenda TEXT DEFAULT '', fonte TEXT DEFAULT 'acervo', ref TEXT DEFAULT '', ordem INTEGER DEFAULT 0, criado TEXT DEFAULT '', PRIMARY KEY (tenant_id, id));

-- ---- Radar (Daily Brief) -----------------------------------------------------
CREATE TABLE IF NOT EXISTS brief (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', tipo TEXT NOT NULL DEFAULT 'noticia' CHECK (tipo IN ('edital','noticia')), titulo TEXT NOT NULL DEFAULT '', fonte TEXT DEFAULT '', url TEXT DEFAULT '', data TEXT DEFAULT '', resumo TEXT DEFAULT '', score INTEGER DEFAULT 0, tags TEXT DEFAULT '', area TEXT DEFAULT '', origem TEXT DEFAULT 'manual', sit TEXT DEFAULT 'TRIADO', autor TEXT DEFAULT '', criado TEXT DEFAULT '', categoria TEXT DEFAULT '', chave TEXT DEFAULT '', fonte_id TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS brief_fonte (tenant_id TEXT NOT NULL DEFAULT 'intelecto', id TEXT NOT NULL, nome TEXT DEFAULT '', url TEXT DEFAULT '', categoria TEXT DEFAULT 'noticia', tipo_fonte TEXT DEFAULT 'rss', seletor TEXT DEFAULT '', cadencia TEXT DEFAULT 'semanal', area TEXT DEFAULT '', ativo INTEGER DEFAULT 0, ult_exec TEXT DEFAULT '', ult_status TEXT DEFAULT '', ult_novos INTEGER DEFAULT 0, criado TEXT DEFAULT '', u TEXT DEFAULT '', PRIMARY KEY (tenant_id, id));

-- ---- Plataforma: acesso, sessão, auditoria, config, solicitações -------------
CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL, tenant_id TEXT NOT NULL DEFAULT 'intelecto');
CREATE TABLE IF NOT EXISTS sess (token TEXT PRIMARY KEY, slug TEXT NOT NULL, criado TEXT DEFAULT '', ultimo TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto');
CREATE TABLE IF NOT EXISTS audit (ts TEXT, slug TEXT, ev TEXT, det TEXT DEFAULT '', ip TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto');
CREATE TABLE IF NOT EXISTS solic (id TEXT PRIMARY KEY, slug TEXT NOT NULL, itens TEXT DEFAULT '', obs TEXT DEFAULT '', status TEXT DEFAULT 'ABERTA', criado TEXT DEFAULT '', atendido_por TEXT DEFAULT '', atendido_em TEXT DEFAULT '', tenant_id TEXT NOT NULL DEFAULT 'intelecto');
CREATE TABLE IF NOT EXISTS acesso (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', email TEXT NOT NULL DEFAULT '', nome TEXT DEFAULT '', slug TEXT DEFAULT '', papel_sol TEXT NOT NULL DEFAULT 'cliente', papel_conc TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'ABERTA', obs TEXT DEFAULT '', criado TEXT DEFAULT '', decidido_por TEXT DEFAULT '', decidido_em TEXT DEFAULT '', ip TEXT DEFAULT '');

-- ---- Índices -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS lanc_tenant ON lanc (tenant_id);
CREATE INDEX IF NOT EXISTS lanc_slug_d ON lanc (slug, d);
CREATE INDEX IF NOT EXISTS proj_tenant ON proj (tenant_id);
CREATE INDEX IF NOT EXISTS audit_ts ON audit (ts);
CREATE INDEX IF NOT EXISTS evento_d ON evento (d);
CREATE INDEX IF NOT EXISTS acesso_status ON acesso (tenant_id, status);
CREATE INDEX IF NOT EXISTS membro_slug ON membro (slug);
CREATE INDEX IF NOT EXISTS membro_cargo_slug ON membro_cargo (tenant_id, slug);
CREATE INDEX IF NOT EXISTS pessoa_meta_slug ON pessoa_meta (tenant_id, slug);
CREATE INDEX IF NOT EXISTS pessoa_skill_slug ON pessoa_skill (tenant_id, slug);
CREATE INDEX IF NOT EXISTS pessoa_treino_slug ON pessoa_treino (tenant_id, slug);
CREATE INDEX IF NOT EXISTS portfolio_versao_sid ON portfolio_versao (tenant_id, sid);
CREATE INDEX IF NOT EXISTS brief_tenant ON brief (tenant_id, score DESC);
CREATE INDEX IF NOT EXISTS brief_chave ON brief (tenant_id, chave);
CREATE INDEX IF NOT EXISTS amb_reg_bank_bacia ON amb_registro (tenant_id, bank, bacia);
CREATE INDEX IF NOT EXISTS amb_reg_bank_mun ON amb_registro (tenant_id, bank, municipio);
CREATE INDEX IF NOT EXISTS amb_reg_bank_ord ON amb_registro (tenant_id, bank, ord);
CREATE INDEX IF NOT EXISTS amb_reg_bank_setor ON amb_registro (tenant_id, bank, setor);
CREATE INDEX IF NOT EXISTS lead_instr_lead ON lead_instrumento (tenant_id, lead_id);
CREATE INDEX IF NOT EXISTS lead_instr_mun ON lead_instrumento (tenant_id, municipio);
CREATE INDEX IF NOT EXISTS vitrine_case_pub ON vitrine_case (tenant_id, publicado, ordem);
CREATE INDEX IF NOT EXISTS vitrine_prod_cid ON vitrine_produto (tenant_id, cid, ordem);
