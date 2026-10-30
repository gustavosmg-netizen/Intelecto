-- ============================================================================
-- Migration 0015 — Apropriação mensal: contrato recorrente e custos fixos com vigência
-- ----------------------------------------------------------------------------
-- cc_contrato: tipo 'recorrente' com cliente + valor_mensal + vigência (desde/ate
--   em AAAA-MM). A receita de cada mês é distribuída entre os projetos do cliente
--   pela participação nas horas do mês (src/apropriacao.mjs).
-- custo_fixo: valor MENSAL com vigência (desde/ate AAAA-MM; vazio = aberto). O
--   rateio é feito mês a mês pelas horas dos projetos faturáveis daquele mês.
-- Espelho do ensureSchema (SCHEMA_VER 2026-10-30a). ALTERs idempotentes no runtime.
-- ============================================================================

ALTER TABLE cc_contrato ADD COLUMN cliente TEXT DEFAULT '';
ALTER TABLE cc_contrato ADD COLUMN valor_mensal REAL DEFAULT 0;
ALTER TABLE cc_contrato ADD COLUMN desde TEXT DEFAULT '';
ALTER TABLE cc_contrato ADD COLUMN ate TEXT DEFAULT '';
ALTER TABLE custo_fixo ADD COLUMN desde TEXT DEFAULT '';
ALTER TABLE custo_fixo ADD COLUMN ate TEXT DEFAULT '';
