-- 0010 — Onda 3-B (núcleo): NOTIFICAÇÕES IN-PORTAL. Caixa de avisos gerada pelas regras
-- agendadas (cron diário, atrás da flag `regras_agendadas`). Não há e-mail (sem binding), então
-- o aviso mora no portal e é lido pelo "sino". Espelha o CREATE idempotente do ensureSchema.
--
-- `destino` = slug do colaborador OU o token de grupo '@coordenacao' (proj não tem campo
-- responsável; os alertas de projeto vão para a Coordenação, que é quem tem `projetos.aprovar`).
-- `periodo` é a JANELA DE DEDUP: semana ISO (R1/R3), nível de estouro 80/100/120 (R2) ou mês (R4).
-- O UNIQUE(tenant_id, tipo, ref, periodo) + `INSERT OR IGNORE` é o que torna o cron idempotente:
-- re-rodar no mesmo período não duplica nada nem reabre o que já foi marcado como lido.
CREATE TABLE IF NOT EXISTS notificacao (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto',
  destino TEXT NOT NULL, tipo TEXT NOT NULL, ref TEXT DEFAULT '', periodo TEXT DEFAULT '',
  titulo TEXT DEFAULT '', texto TEXT DEFAULT '', criado TEXT DEFAULT '', lido INTEGER DEFAULT 0,
  UNIQUE(tenant_id, tipo, ref, periodo));

-- Listagem da caixa: por tenant + destinatário, não-lidas primeiro, mais recentes no topo.
CREATE INDEX IF NOT EXISTS notificacao_cx ON notificacao (tenant_id, destino, lido, criado);
