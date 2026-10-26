-- ============================================================================
-- Migration 0003 — Fila de conciliação do caixa (Onda 1)
-- ----------------------------------------------------------------------------
-- Índice para a FILA DE CONCILIAÇÃO: os movimentos de caixa SEM centro de custo,
-- consultados por tenant (ação `conciliacao`, paginada no servidor). A tabela
-- contrato_parcela (criada na 0002) é a base da baixa de recebimentos: uma
-- entrada do caixa baixa uma parcela e herda o CC do contrato (ação parcelaBaixar),
-- fechando o buraco "1.831 movimentos de caixa, 0 com centro de custo" para os
-- recebimentos. Despesas diretas seguem recebendo CC pela fila (ação fluxoCc).
--
-- Idempotente. Aplicar em STAGING primeiro, não em produção sem OK.
-- ============================================================================

CREATE INDEX IF NOT EXISTS fluxo_cc ON fluxo (tenant_id, cc);
