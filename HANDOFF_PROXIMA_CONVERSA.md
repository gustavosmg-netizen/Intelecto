# Handoff: Portal Intelecto & CSTR (próxima conversa)

> Atualizado em 2026-10-29. A memória técnica completa está na skill do repositório
> `.claude/skills/portal-gestao-intelecto/SKILL.md` (carregada automaticamente pelo Claude Code
> neste repo). O portão de lançamento está em `.claude/skills/gate-de-lancamento/SKILL.md`.

## Fonte da verdade

- Repositório GitHub `gustavosmg-netizen/Intelecto`, branch `main` == produção.
- Publicar = merge de PR em `main` → `deploy.yml` (verify + `wrangler deploy`). Nada de deploy
  manual; o antigo mirror `C:\pideploy` e o canon no Drive são legado e só valem se idênticos a `main`.
- URL: `https://portal.intelecto-eng.com.br`. Staging: `wrangler deploy --env staging`.

## Estado em 2026-10-29

- Em produção (deploys verdes): Ondas 0–4 (PR #1), hotfix PBKDF2, Onda 3-A (PR #2), Onda 3-B
  regras agendadas + sino (PR #3), Onda 3-C conciliação assistida por IA (PR #4).
- `SCHEMA_VER = 2026-10-28a`; migrações até `0011_notificacao_lida.sql`.
- Flags novas **OFF**: `contrato_abre_projeto`, `regras_agendadas`, `conciliacao_ia`, `casca_nova`,
  `casca_auto`. `horas_aprovacao` semeada ON para a Intelecto.

## Próximos passos (sob OK do dono)

1. Validação logada em staging de 3-A, 3-B e 3-C (roteiros nos corpos dos PRs #2–#4); só então
   ligar cada flag em Administração › Feature flags (dono + reauth), uma por vez.
2. Conferir que o cron de backup `0 6 * * *` grava em `portal-intelecto-backup`.
3. Trocar `BRIEF_MODELO` (Daily Brief) para `@cf/meta/llama-3.1-8b-instruct-fast` — o modelo atual
   foi descontinuado em 2026-05-30.
4. Infra: Cloudflare Access na frente do domínio; branch protection em `main` exigindo `verify`.

## Regras de operação

- Toda mudança de schema: bump de `SCHEMA_VER` + migração própria.
- Funcionalidade nova atrás de flag `def:false`. Ação nova com entrada em `MIN`.
- Valor monetário só no módulo Financeiro (dono ou `financeiro.ver`). Multi-tenant no servidor.
- Confirmar antes de ações externas ou irreversíveis. Nenhum merge/deploy/flag sem OK.
