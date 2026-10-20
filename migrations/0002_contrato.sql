-- ============================================================================
-- Migration 0002 — CONTRATO como dono único do valor contratado (Onda 1)
-- ----------------------------------------------------------------------------
-- O valor contratado passa a morar no CONTRATO (cc_contrato), não em projx.contratado.
-- cc_contrato já existia (id, cc, titulo, valor, assinado, obs); ganha status/tipo/deal_id
-- para funcionar como dono: confirmado × rascunho, base × aditivo, e a ligação ao deal
-- do CRM de origem. Enquanto um CC não tiver contrato confirmado, o Financeiro cai no
-- fallback projx.contratado (transição gradual — ver valorContratadoMap/decompoeFin).
--
-- Decisão dos sócios D-3 (2026-10-19): imposto e overhead separados; o custo real do
-- projeto passa a somar o IMPOSTO (antes era calculado e não somado).
--
-- Idempotente onde dá (CREATE IF NOT EXISTS). Os ALTER ADD COLUMN assumem colunas
-- ausentes — o runner de migração (wrangler d1 migrations) roda cada arquivo UMA vez.
-- Em paralelo, ensureSchema() faz os mesmos ALTER com try/catch (coerência na transição).
-- Aplicar primeiro em STAGING (cópia anonimizada), não em produção sem OK.
-- ============================================================================

ALTER TABLE cc_contrato ADD COLUMN status TEXT DEFAULT 'rascunho';
ALTER TABLE cc_contrato ADD COLUMN tipo TEXT DEFAULT 'base';
ALTER TABLE cc_contrato ADD COLUMN deal_id TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS cc_contrato_cc ON cc_contrato (tenant_id, cc, status);

-- Parcelas do contrato — base da conciliação com o caixa (fluxo). Cada recebimento do
-- caixa baixa uma parcela (fluxo_id) e carrega o CC. Nasce vazia.
CREATE TABLE IF NOT EXISTS contrato_parcela (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto', contrato_id TEXT NOT NULL, cc TEXT DEFAULT '',
  numero INTEGER DEFAULT 1, valor REAL DEFAULT 0, venc_prev TEXT DEFAULT '', recebido_em TEXT DEFAULT '',
  fluxo_id TEXT DEFAULT '', status TEXT DEFAULT 'prevista', obs TEXT DEFAULT '', criado TEXT DEFAULT '', u TEXT DEFAULT '');
CREATE INDEX IF NOT EXISTS contrato_parcela_ct ON contrato_parcela (tenant_id, contrato_id);
CREATE INDEX IF NOT EXISTS contrato_parcela_cc ON contrato_parcela (tenant_id, cc, status);
