-- ============================================================================
-- Migration 0007 — Reauth step-up (S-03) + endurecimento de segurança
-- ----------------------------------------------------------------------------
-- Coluna que carimba a última reautenticação da sessão. Ações sensíveis (R$,
-- exclusões, acesso) exigem senha reconfirmada nos últimos 10 min (ver SENSIVEIS
-- e exigeReauth em src/index.ts). O guard central passou a NEGAR POR OMISSÃO
-- (S-02) e os cabeçalhos ganharam HSTS + Cache-Control na página (BUG-01) e
-- CSP nos assets de /app (public/_headers) — essas duas não são schema.
-- ALTER idempotente. Aplicar em STAGING primeiro.
-- ============================================================================

ALTER TABLE sess ADD COLUMN reauth TEXT DEFAULT '';
