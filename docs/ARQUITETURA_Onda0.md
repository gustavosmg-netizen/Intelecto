# Onda 0 — Fundação (Plano Diretor do Portal)

Branch `arquitetura/onda0`. Esta onda **não altera produção**: prepara o terreno
para evoluir o portal com segurança. Tudo aqui é verificação, versionamento e
diagnóstico. Nenhum deploy e nenhum recurso Cloudflare novo saem daqui sem OK.

Contexto completo (laudo + arquitetura-alvo + ondas): artifact "Plano Diretor do
Portal Intelecto". Decisões dos sócios em 19/10/2026: React+TS gradual (D-1),
chat paralelo só corrige (D-2), imposto e overhead separados na margem (D-3).

## O que entra nesta onda

### 1. Portão de verificação no CI
- **`.github/workflows/verify.yml`** — roda em todo push de branch e em todo PR:
  empacota o Worker (`wrangler deploy --dry-run`), roda os testes de fundação e
  reporta o typecheck (informativo). Não publica, não usa segredos.
- **`.github/workflows/deploy.yml`** — ganhou o job `verify` como **pré-requisito**
  do `deploy`. A partir do merge, nenhum push em `main` publica sem a verificação
  passar. (Antes, todo commit em main ia direto para produção.)
- Scripts em `package.json`: `build:check`, `typecheck`, `test`, `verify`.
- Typecheck: 18 erros de tipo hoje (dívida baixa, código legado nunca tipado).
  Fica como informativo (não bloqueia) e cai por etapas nas próximas ondas.

### 2. Migrações versionadas (substituem o schema em runtime)
- **`migrations/0001_baseline.sql`** — baseline capturado do schema **real de
  produção** em 2026-10-19 (47 tabelas + índices), tudo `IF NOT EXISTS` e sem
  `DROP`/`DELETE` (idempotente; aplicar não muda nada no que já existe).
- O caminho novo é `wrangler d1 migrations apply` (histórico e reversão), em vez
  de `ensureSchema()` + `SCHEMA_VER` criando tabela a cada boot. O `ensureSchema`
  atual **permanece** funcionando até a migração estar validada em staging — a
  troca é gradual, não um corte.

### 3. Painel de Consistência (somente leitura)
- **`consistency/rules.sql`** — as regras de integridade entre módulos (as mesmas
  consultas do laudo). Cada regra devolve id, severidade, nº de violações, dono e
  atalho de correção. Baseline de produção anotado em cada regra.
- Estado inicial medido (19/10/2026): **C1 caixa sem CC = 1.831**, C2 contrato
  assinado sem valor = 1, C3 valor divergente CRM×Financeiro = 3, C4 contratado
  sem deal = 1, C5 andamento divergente = 39, C6 concluído com horas = 5,
  C7 andamento parado = 8, C8 hora sem projeto = 0, C9 horas no 2º livro = 73,
  C10 custo/hora legado = 0, C11 ativo sem custo/hora = 0.
- Próximo passo (Onda 0.2): expor essas contagens numa aba de Administração,
  recalculadas pelo cron diário. Aqui ficam só as consultas, validadas.

## O que depende de você (não faço sem OK — cria recurso/toca produção)

1. **Banco de staging**: `wrangler d1 create portal-intelecto-staging`, adicionar o
   binding num `[env.staging]` do `wrangler.toml` e aplicar as migrações lá
   (`npm run db:migrate:staging`). Carga: cópia **anonimizada** de produção.
2. **Cloudflare Access** na frente de `portal.intelecto-eng.com.br` (Zero Trust) —
   pendência antiga do laudo de segurança.
3. **Cabeçalhos de segurança** (CSP/HSTS/X-Frame-Options) aplicados também à
   resposta em cache — entra como mudança de código numa branch, revisada por PR.
4. **Branch protection** em `main` no GitHub: exigir o check `verify` verde antes
   do merge (a wiring do workflow já existe; falta ligar a regra no repositório).

## Como verificar localmente

```bash
npm ci
npm run verify   # build:check (dry-run) + testes de fundação
npm run typecheck
```

Produção não é tocada por nenhum desses comandos.
