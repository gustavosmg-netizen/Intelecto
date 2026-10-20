-- ============================================================================
-- PAINEL DE CONSISTÊNCIA — regras de integridade entre módulos (somente leitura)
-- ----------------------------------------------------------------------------
-- Cada bloco é UMA regra. Convém que toda regra devolva:
--   rule  (id estável), sev (crit|alto|medio), n (nº de violações), dono (área),
--   atalho (onde corrigir). As consultas de detalhe (lista das linhas que
--   violam) ficam ao lado de cada regra, comentadas.
--
-- Fonte das regras: Plano Diretor do Portal (laudo, 2026-10-19). São as mesmas
-- consultas que mediram o estado inicial; viram verificação diária (cron) na
-- tela de Administração. NENHUMA escreve — é diagnóstico.
--
-- Uso manual (staging):  wrangler d1 execute <db> --file=consistency/rules.sql
-- Baseline de produção medido em 2026-10-19 anotado em cada regra como [base: N].
-- ============================================================================

-- C1 · caixa sem centro de custo  [crit · Financeiro · Financeiro › Caixa]  [base: 1831]
SELECT 'C1' rule, 'crit' sev, COUNT(*) n, 'Financeiro' dono, 'Financeiro › Caixa' atalho
FROM fluxo WHERE COALESCE(cc,'') = '';
-- detalhe: SELECT id, data_prev, data_real, tipo, categoria, descricao, valor FROM fluxo WHERE COALESCE(cc,'')='' ORDER BY COALESCE(data_real,data_prev) DESC;

-- C2 · contrato assinado sem valor no Financeiro  [crit · Comercial+Financeiro · Projeto 360 › Financeiro]  [base: 1]
SELECT 'C2' rule, 'crit' sev, COUNT(*) n, 'Comercial+Financeiro' dono, 'Projeto 360 › Financeiro' atalho
FROM crm_deal d LEFT JOIN projx x ON x.cc = d.cc AND x.tenant_id = d.tenant_id
WHERE d.signeddate <> '' AND d.cc <> '' AND COALESCE(x.contratado,0) = 0;
-- detalhe: SELECT d.id, d.co, d.cc, d.val FROM crm_deal d LEFT JOIN projx x ON x.cc=d.cc WHERE d.signeddate<>'' AND d.cc<>'' AND COALESCE(x.contratado,0)=0;

-- C3 · valor do contrato divergente entre CRM e Financeiro (> R$1)  [crit · Comercial+Financeiro · Projeto 360 › Financeiro]  [base: 3]
SELECT 'C3' rule, 'crit' sev, COUNT(*) n, 'Comercial+Financeiro' dono, 'Projeto 360 › Financeiro' atalho
FROM crm_deal d JOIN projx x ON x.cc = d.cc AND x.tenant_id = d.tenant_id
WHERE d.signeddate <> '' AND x.contratado > 0 AND ABS(x.contratado - d.val) > 1;
-- detalhe: SELECT d.cc, d.co, d.val crm, x.contratado fin, (x.contratado-d.val) dif FROM crm_deal d JOIN projx x ON x.cc=d.cc WHERE d.signeddate<>'' AND x.contratado>0 AND ABS(x.contratado-d.val)>1;

-- C4 · valor contratado no Financeiro sem deal assinado de origem  [alto · Financeiro · Projeto 360 › Financeiro]  [base: 1]
SELECT 'C4' rule, 'alto' sev, COUNT(*) n, 'Financeiro' dono, 'Projeto 360 › Financeiro' atalho
FROM projx x WHERE x.contratado > 0
  AND NOT EXISTS (SELECT 1 FROM crm_deal d WHERE d.cc = x.cc AND d.tenant_id = x.tenant_id AND d.signeddate <> '');
-- detalhe: SELECT cc, contratado FROM projx WHERE contratado>0 AND cc NOT IN (SELECT cc FROM crm_deal WHERE signeddate<>'' AND cc<>'');

-- C5 · andamento divergente (> 10 p.p.) entre Carteira e último registro de andamento  [alto · Projetos · Projeto 360 › Visão]  [base: 39]
SELECT 'C5' rule, 'alto' sev, COUNT(*) n, 'Projetos' dono, 'Projeto 360 › Visão' atalho
FROM projx x
JOIN (SELECT cc, MAX(d) md FROM andam GROUP BY cc) a ON a.cc = x.cc
JOIN andam an ON an.cc = a.cc AND an.d = a.md
WHERE an.total > 0 AND ABS(ROUND(100.0 * an.etapa / an.total) - x.progresso) > 10;
-- detalhe: inclua x.progresso e ROUND(100.0*an.etapa/an.total) por cc.

-- C6 · projeto CONCLUÍDO com horas lançadas nos últimos 30 dias  [alto · Projetos · Projeto 360 › Visão]  [base: 5]
SELECT 'C6' rule, 'alto' sev, COUNT(*) n, 'Projetos' dono, 'Projeto 360 › Visão' atalho
FROM proj WHERE status = 'CONCLUÍDO'
  AND EXISTS (SELECT 1 FROM lanc l WHERE l.cc = proj.cc AND l.d >= date('now','-30 day'));
-- detalhe: SELECT cc, projeto FROM proj WHERE status='CONCLUÍDO' AND cc IN (SELECT cc FROM lanc WHERE d>=date('now','-30 day'));

-- C7 · projeto EM ANDAMENTO sem horas há mais de 60 dias  [medio · Projetos · Projeto 360 › Visão]  [base: 8]
SELECT 'C7' rule, 'medio' sev, COUNT(*) n, 'Projetos' dono, 'Projeto 360 › Visão' atalho
FROM proj p WHERE p.status = 'EM ANDAMENTO'
  AND NOT EXISTS (SELECT 1 FROM lanc l WHERE l.cc = p.cc AND l.d >= date('now','-60 day'));
-- detalhe: SELECT cc, projeto, previsto FROM proj p WHERE status='EM ANDAMENTO' AND cc NOT IN (SELECT cc FROM lanc WHERE d>=date('now','-60 day'));

-- C8 · hora lançada em centro de custo sem projeto cadastrado  [alto · Horas · Lançar horas]  [base: 0]
SELECT 'C8' rule, 'alto' sev, COUNT(*) n, 'Horas' dono, 'Lançar horas' atalho
FROM lanc l WHERE NOT EXISTS (SELECT 1 FROM proj p WHERE p.cc = l.cc AND p.tenant_id = l.tenant_id);
-- detalhe: SELECT cc, COUNT(*) n, ROUND(SUM(h),1) h FROM lanc l WHERE cc NOT IN (SELECT cc FROM proj) GROUP BY cc ORDER BY h DESC;

-- C9 · horas vivas num segundo livro (crm_time fora de lanc)  [medio · Comercial · Comercial › Horas]  [base: 73]
SELECT 'C9' rule, 'medio' sev, COUNT(*) n, 'Comercial' dono, 'Comercial › Horas' atalho
FROM crm_time WHERE deleted = 0 AND hours > 0;
-- detalhe: SELECT id, d, area, hours, note FROM crm_time WHERE deleted=0 AND hours>0 ORDER BY d DESC;

-- C10 · custo/hora legado preenchido (deve estar vazio; a fonte é custohora_vig)  [medio · Financeiro · Financeiro › Custo/hora]  [base: 0]
SELECT 'C10' rule, 'medio' sev, COUNT(*) n, 'Financeiro' dono, 'Financeiro › Custo/hora' atalho
FROM custohora WHERE valor > 0;

-- C11 · pessoa ativa com horas lançadas e sem custo/hora vigente  [alto · Financeiro · Financeiro › Custo/hora]
SELECT 'C11' rule, 'alto' sev, COUNT(*) n, 'Financeiro' dono, 'Financeiro › Custo/hora' atalho
FROM (SELECT DISTINCT l.slug FROM lanc l JOIN membro m ON m.slug = l.slug AND m.tenant_id = l.tenant_id WHERE m.ativo = 1) a
WHERE NOT EXISTS (SELECT 1 FROM custohora_vig v WHERE v.slug = a.slug);
-- detalhe: lista os slugs ativos com apontamento e sem taxa vigente — custo de MO fica subavaliado.

-- C12 · aba visível com tabela vazia (módulo sem conteúdo mínimo)  [medio · dono do módulo · Administração › Consistência]
-- Não é uma única query: o Painel checa, por módulo, se a tabela-fonte tem linhas.
-- Exemplos medidos [base 2026-10-19]: evento=0, brief=0, brief_fonte ativas=0,
-- portfolio_servico=0, pessoa_ficha=0, prevf=0, progcurso=0, custo_fixo=0,
-- fin_snapshot=0, cc_contrato/proposta/produto/hist=0, solic=0, crm_lead=5.
SELECT 'C12-evento' rule, 'medio' sev, (SELECT COUNT(*) FROM evento) n, 'Agenda' dono, 'Agenda' atalho
UNION ALL SELECT 'C12-brief', 'medio', (SELECT COUNT(*) FROM brief), 'Inteligência', 'Daily Brief'
UNION ALL SELECT 'C12-prevf', 'medio', (SELECT COUNT(*) FROM prevf), 'Projetos', 'Projeto 360 › Equipe'
UNION ALL SELECT 'C12-portfolio', 'medio', (SELECT COUNT(*) FROM portfolio_servico), 'Comercial', 'Portfólio de Serviços'
UNION ALL SELECT 'C12-ficha', 'medio', (SELECT COUNT(*) FROM pessoa_ficha), 'Pessoas', 'Ficha da pessoa';
