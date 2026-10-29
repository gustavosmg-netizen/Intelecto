-- ============================================================================
-- Migration 0012 — "Manter conectado" no login
-- ----------------------------------------------------------------------------
-- sess.persist: 1 = sessão mantida (cookie de 30 dias, expira após 30 dias sem
-- uso — comportamento anterior, por isso é o DEFAULT e as linhas existentes ficam
-- iguais); 0 = cookie de sessão (some ao fechar o navegador) e o servidor recusa
-- a sessão após 12 h sem uso. Lógica em src/sessao.mjs.
-- Espelho do ALTER idempotente do ensureSchema (SCHEMA_VER 2026-10-29a).
-- ============================================================================

ALTER TABLE sess ADD COLUMN persist INTEGER DEFAULT 1;
