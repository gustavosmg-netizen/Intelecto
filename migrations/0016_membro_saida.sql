-- ============================================================================
-- Migration 0016 — Desligamento com data de saída
-- ----------------------------------------------------------------------------
-- membro.saida (AAAA-MM-DD; vazio = sem saída prevista). Até a data a pessoa
-- segue normal; depois o login é recusado e o cron diário (0 6 * * *) passa
-- ativo=0 e encerra sessões, com auditoria. Histórico de horas preservado.
-- Espelho do ensureSchema (SCHEMA_VER 2026-10-30b). ALTER idempotente no runtime.
-- ============================================================================

ALTER TABLE membro ADD COLUMN saida TEXT DEFAULT '';
