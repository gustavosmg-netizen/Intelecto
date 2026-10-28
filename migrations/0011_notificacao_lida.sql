-- 0011 — Onda 3-B: ESTADO DE LEITURA POR PESSOA. A caixa '@coordenacao' é UMA notificação
-- compartilhada por quatro coordenadores (`proj` não tem campo responsável; ver spec §2). Com um
-- único `lido` na própria notificação, o primeiro a ler apagava o aviso de projeto parado para os
-- outros três até a próxima janela de dedup — e o aviso morria sem ninguém ter agido.
--
-- Aqui, "lido" é uma linha por (notificação, pessoa): `INSERT OR IGNORE` ao marcar, e o `lido` que
-- a UI recebe é DERIVADO por LEFT JOIN com o slug de quem consulta. Não há dado antigo a migrar:
-- a 0010 cria `notificacao` já sem a coluna `lido`.
CREATE TABLE IF NOT EXISTS notificacao_lida (
  tenant_id TEXT NOT NULL DEFAULT 'intelecto', notif_id TEXT NOT NULL, slug TEXT NOT NULL,
  lido_em TEXT DEFAULT '',
  PRIMARY KEY (tenant_id, notif_id, slug));

-- A PK já serve ao LEFT JOIN da listagem (tenant_id, notif_id, slug). Este índice serve à
-- varredura por pessoa: contagem de não-lidas e uma futura poda por retenção.
CREATE INDEX IF NOT EXISTS notificacao_lida_slug ON notificacao_lida (tenant_id, slug);
