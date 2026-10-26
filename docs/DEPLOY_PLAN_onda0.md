# Plano de deploy para produção — branch `arquitetura/onda0`

> Objetivo: levar o trabalho do branch para produção **com segurança e em fases**, resolvendo
> primeiro o risco concreto de login (PBKDF2) e só depois fazendo o corte grande da casca nova.
> Deploy em produção é sempre decisão do dono; este documento prepara, não executa.

## Estado atual (2026-10-21)

- **PR #1** `arquitetura/onda0 → main`, aberto, **CI `verify` verde** (build do app + bundle dry-run
  + 26 testes). Head `5b335cf`, base `main` `a45d7dd`.
- Escopo do branch: **44 arquivos, +6.708/−687** — casca React em `/app`, novas ações `/api`,
  Onda 1 (contrato/imposto/caixa/capacidade), Academia, segurança (S-02/S-03/CSP/HSTS),
  observabilidade (E-04), backup+restore (E-05), migrações 0001–0007, `SCHEMA_VER=2026-10-21b`.
- **Nada disso está em produção.** Produção ainda roda o H2 com PBKDF2 a **150000** iterações.

## Fase A — Hotfix do login (PBKDF2), isolado e primeiro

**Por quê:** o runtime do Cloudflare Workers não deriva PBKDF2 acima de 100000 iterações. Produção
grava senha com 150000 (H2), então **qualquer primeiro acesso ou redefinição de senha em produção
hoje gera um hash que o Worker nunca verifica → a pessoa fica sem conseguir logar.** É um bug
latente de produção (ainda não disparado só porque ninguém redefiniu senha sob o H2). Descoberto no
drill E-05.

**Mudança (cirúrgica, sem schema):** apenas os 2 trechos de `src/index.ts` do commit `b219930`:
- `hashSenhaNova`: `iter` 150000 → **100000**.
- `verificaSenha`: trata hash legado `>100000` como não-verificável (`false`) em vez de estourar.

Sem alteração de tabela, sem bump de `SCHEMA_VER`, sem tocar a UI. Logins legados (SHA-256 salgado)
continuam idênticos; só passa a gerar/verificar hashes PBKDF2 dentro do teto.

**Como publicar:**
1. Branch `hotfix/pbkdf2-100k` a partir de `main`; aplicar os 2 trechos (+ teste de regressão).
2. Abrir PR; esperar o CI `verify` verde.
3. **Dono faz o merge** → `deploy.yml` publica em produção.
4. **Validar:** em produção, fazer um primeiro acesso / redefinição de senha de teste e confirmar o
   login. Logins existentes seguem funcionando.
5. **Rollback:** `git revert` do commit + redeploy (trivial; é mudança de 2 linhas).

**Risco:** mínimo. Nenhum login atual quebra; o fix só remove a impossibilidade de verificar senhas
novas.

## Fase B — Corte da casca nova (PR #1 inteiro)

**Escopo:** casca React em `/app` (aditiva — a UI antiga em `/` permanece; estrangulamento), novas
ações `/api`, Onda 1, Academia, segurança S-02/S-03/CSP/HSTS, observabilidade e backup/restore.

**Schema:** `ensureSchema` provisiona em runtime, no 1º request após o bump de `SCHEMA_VER`, tudo o
que falta (`contrato_parcela`, `atividade_classe`, `capacidade_vig`, `curso*`, `ALTER TABLE sess ADD
reauth`). As migrações 0001–0009 são o espelho versionado; aplicá-las explicitamente
(`wrangler d1 migrations apply portal-intelecto --remote`) é opcional (cinto e suspensório).

**Recursos R2 antes do deploy:** o binding `VIDEO` (D-5, vídeos da Academia) exige o bucket
`portal-intelecto-video` — criar antes de publicar, senão o deploy falha ao resolver o binding:
`npx wrangler r2 bucket create portal-intelecto-video` (já criado em staging/conta).

**Pré-requisitos / riscos a tratar ANTES do merge:**
1. **Validação logada ao vivo em staging com dados reais** (`popula_staging.py`) — click-through de
   Projeto 360, kanbans, cronograma, Financeiro, Pessoas, Admin, Academia. Vários pontos ainda não
   foram exercitados logado.
2. **S-02 (negar por omissão) + S-03 (reauth):** confirmar que nenhum fluxo existente trava; validar
   login e uma ação sensível com o passo de reauth.
3. **CSP/HSTS × cache do Cloudflare** (BUG-01 do laudo): confirmar que os cabeçalhos chegam em
   produção (o `Cache-Control` já foi adicionado; purgar o cache do HTML se necessário).
4. **Cron de backup de produção:** o drill E-05 mostrou que o backup mais recente no R2 era de
   19/10 (~48 h). Confirmar que o cron `0 6 * * *` roda em produção (ou rodar `backup_now`) antes de
   depender do RPO.
5. **Idealmente atrás de feature flags (E-06):** para o corte React ser reversível sem redeploy.

**Janela e rollback:** publicar em baixo tráfego; checklist de validação logado; rollback = reverter
o merge do PR / redeploy da versão anterior do Worker (a casca antiga em `/` reduz o risco por ser
aditiva).

## Sequência recomendada

1. **Fase A agora** — resolve um risco real de login, é reversível e não depende da casca nova.
2. **E-06** (feature flags + contrato de API versionado) — pré-requisito saudável do corte grande.
3. **Fase B** — após a validação logada em staging e com as flags, em janela combinada.
