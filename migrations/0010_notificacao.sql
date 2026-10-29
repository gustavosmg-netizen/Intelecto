-- 0010 — Onda 3-B (núcleo): NOTIFICAÇÕES IN-PORTAL. Caixa de avisos gerada pelas regras
-- agendadas (cron diário, atrás da flag `regras_agendadas`). Não há e-mail (sem binding), então
-- o aviso mora no portal e é lido pelo "sino". Espelha o CREATE idempotente do ensureSchema.
--
-- `destino` = slug do colaborador OU o token de grupo '@coordenacao' (proj não tem campo
-- responsável; os alertas de projeto vão para a Coordenação, que é quem tem `projetos.aprovar`).
-- Quem JÁ LEU não mora aqui: a caixa '@coordenacao' é compartilhada por quatro pessoas, então o
-- estado de leitura é POR PESSOA, em `notificacao_lida` (migração 0011).
-- `periodo` é a JANELA DE DEDUP: semana ISO (R1/R3), nível de estouro 80/100/120 (R2) ou mês (R4).
-- O UNIQUE(tenant_id, tipo, ref, periodo) + `INSERT OR IGNORE` é o que torna o cron idempotente:
-- re-rodar no mesmo período não duplica nada nem reabre o que já foi marcado como lido.
CREATE TABLE IF NOT EXISTS notificacao (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'intelecto',
  destino TEXT NOT NULL, tipo TEXT NOT NULL, ref TEXT DEFAULT '', periodo TEXT DEFAULT '',
  titulo TEXT DEFAULT '', texto TEXT DEFAULT '', criado TEXT DEFAULT '',
  UNIQUE(tenant_id, tipo, ref, periodo));

-- Listagem da caixa: por tenant + destinatário, mais recentes no topo.
CREATE INDEX IF NOT EXISTS notificacao_cx ON notificacao (tenant_id, destino, criado);
