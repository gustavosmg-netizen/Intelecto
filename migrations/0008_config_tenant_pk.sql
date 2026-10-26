-- 0008 — D-6: config isolado por TENANT (PK composta).
-- Até aqui config tinha PRIMARY KEY só em (k): dois tenants não podiam ter a mesma chave
-- (pin:, flag:, allow:, salt, imposto_padrao, …) e o upsert ON CONFLICT(k) colidia entre tenants.
-- O SQLite não altera PK: rebuild preservando os dados, com PK (tenant_id, k).
-- Espelha o rebuild idempotente do ensureSchema (src/index.ts). Em 0001 a config já tem tenant_id.
CREATE TABLE config_mt (k TEXT NOT NULL, v TEXT NOT NULL, tenant_id TEXT NOT NULL DEFAULT 'intelecto', PRIMARY KEY (tenant_id, k));
INSERT OR IGNORE INTO config_mt (tenant_id, k, v) SELECT COALESCE(tenant_id, 'intelecto'), k, v FROM config;
DROP TABLE config;
ALTER TABLE config_mt RENAME TO config;
