---
name: portal-gestao-intelecto
description: "Memória e padrão oficial do Portal de Gestão Intelecto & CSTR em Cloudflare Workers (repo gustavosmg-netizen/Intelecto, portal.intelecto-eng.com.br). Use ao alterar, corrigir, revisar, publicar ou testar o portal: Worker/Hono (src/index.ts), casca clássica (public/index.html), casca nova React (app/), D1/R2/AI, migrações e SCHEMA_VER, papéis e capabilities, feature flags, ondas (3-A/3-B/3-C), CI/deploy por GitHub Actions, staging, backup/restore, MCP do acervo, horas, rateio, financeiro e privacidade por perfil."
---

# Portal de Gestão Intelecto & CSTR — memória do projeto (Cloudflare)

Sistema em produção, uso interno, multi-tenant (hoje só o tenant `intelecto` ativo). Interlocutor:
**Gustavo — Coordenador Técnico, Engenharia, dono do portal** (`OWNER = ["gustavo"]`).

> O portal **saiu do Val Town**. Nada de `val.run`, `std/sqlite`, `seed.js`, `fetch_val_endpoint`
> ou `replace_in_file` de val. A fonte da verdade é o **repositório GitHub** e o que está em `main`.

## 0. Antes de editar qualquer coisa

1. `git fetch --all --prune` e confira `main`, branches `arquitetura/*` e **PRs abertos** — o portal
   evolui em várias sessões em paralelo; o que está no GitHub costuma estar à frente desta memória.
2. Trabalhe em branch próprio cortado de `main` atualizado. **Nunca commitar direto em `main`**:
   `main` == produção (todo push em `main` publica).
3. Se houver outro PR aberto tocando `src/index.ts`/`public/index.html`, ensaie a integração
   (merge local de `main` + PRs) e rode a verificação antes de propor merge. Conflitos típicos são
   aditivos (imports de `./ondaNx.mjs`, entradas em `FLAGS`, `MIN`, `MODULOS`) — manter os dois lados.
4. Os arquivos são grandes (`src/index.ts` ~7.200 linhas, `public/index.html` ~5.200): nunca ler
   inteiros; localizar com `grep -n` e editar por âncora exata.
5. Ler a spec/plano da onda em `docs/superpowers/{specs,plans}/` antes de mexer nela.

## 1. Infraestrutura

| Item | Valor |
|---|---|
| Endereço | https://portal.intelecto-eng.com.br (domínio custom; `workers_dev = false` em produção) |
| Repositório | `gustavosmg-netizen/Intelecto` (GitHub) |
| Runtime | Cloudflare Worker `portal-intelecto`, Hono, `compatibility_flags = ["nodejs_compat"]` |
| Banco | D1 `portal-intelecto` (binding `DB`); staging `portal-intelecto-staging` |
| R2 | `BLOB` (painéis/arquivos privados), `ACERVO` (953 docs do AutoRAG), `BACKUP` (export diário do D1, retenção 90 d), `VIDEO` (vídeos da Academia, servidos com Range) |
| IA | binding `AI` — AutoRAG `acervo-intelecto`; Workers AI (`BRIEF_MODELO`, `CONC_MODELO`) |
| Assets | `./public` (binding `ASSETS`): casca clássica `public/index.html` + build da casca nova em `public/app` |
| Observabilidade | Workers Logs ligado; `logEvent()` emite JSON por `/api` e por cron, sem PII |
| Crons | `*/5` keep-alive · `0 6` backup D1→R2 · `0 9` coletor do Daily Brief · `0 11` regras agendadas (3-B) |

Rotas do Worker: `POST /api` (todas as ações), `POST /mcp` (MCP do acervo, token), `GET /` (casca
clássica via `montarPagina()`), `GET /d/:slug`, `GET /img/:nome`, `POST /acervo/arquivo`,
`POST /vitrine/arquivo`, `POST /pessoa/arquivo`, `GET /academia/video/:aula`.

## 2. Fluxo de publicação (GitHub Actions)

- `.github/workflows/verify.yml` — todo push de branch e todo PR: `npm ci` → `npm run build:app`
  (Vite → `public/app`) → `npm run build:check` (`wrangler deploy --dry-run`) → `npm test`
  (`node --test`) → `npm run typecheck` (informativo, não bloqueia; há dívida legada ~30 erros —
  **não aumentar**: compare com o baseline do `main`).
- `.github/workflows/deploy.yml` — push em `main`: job `verify` como pré-requisito, depois
  `wrangler deploy` com os secrets `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`.
- **Publicar = merge do PR em `main`** (merge commit, padrão "Merge PR #N: …"). Merge é decisão do
  dono; só faça quando ele pedir explicitamente.
- Staging: `wrangler deploy --env staging` (Worker `portal-intelecto-staging`, URL `*.workers.dev`,
  `crons = []`, `AMBIENTE = "staging"`). Reusa os buckets R2 de produção (só leitura em teste).
- Secrets (ex.: `RESEND_API_KEY`) ficam no painel Cloudflare; `wrangler deploy` não os toca.
- Rollback: `git revert` do merge em `main` (o deploy roda de novo) ou redeploy da versão anterior.
- O antigo mirror `C:\pideploy` (deploy manual do Windows) é legado: se ainda for usado, deve estar
  idêntico a `main` — senão há duas versões do portal.
- Sessões na nuvem normalmente **não alcançam** o portal (proxy 403): validação logada e ping em
  produção/staging são feitos pelo dono ou por sessão com rede liberada.

Verificação local completa (o mesmo do CI): `npm ci && npm run verify && npm run typecheck`.

## 3. Schema: `ensureSchema()` + `SCHEMA_VER` + migrações

- `ensureSchema()` cria/ajusta tabelas em runtime no 1º request após mudança de `SCHEMA_VER`
  (`src/index.ts`, `const SCHEMA_VER`). **Toda mudança de schema exige bump de `SCHEMA_VER`** — sem o
  bump o D1 existente pula o setup e a tabela nunca nasce em produção.
- Espelho versionado em `migrations/NNNN_*.sql` (0001 baseline … 0011 `notificacao_lida`). Toda
  tabela nova ganha migração própria, idempotente (`IF NOT EXISTS`, sem `DROP`/`DELETE`). Numerar em
  sequência e checar se outro PR aberto já usou o número.
- D1 `--remote` rejeita `BEGIN/COMMIT/PRAGMA`; `DELETE` em massa é feito pelo dono no terminal dele.
- Depois do deploy, o 1º `POST /api` (ex.: `{"action":"ping"}`) dispara o `ensureSchema`.
- `API_VER` só muda quando o contrato da API quebra; ações novas são aditivas e não bumpam.

## 4. Autenticação, papéis e capabilities

- Login por senha: hash **PBKDF2 a 100000 iterações** (`hashSenhaNova`; teto do runtime do Worker —
  nunca subir), legado SHA-256 salgado ainda verificado. Sessão em `sess`; token no `localStorage`
  (`ce_tok`) e enviado no corpo do `POST /api`. Rate limit e tudo auditado em `audit`.
- **Reauth** (S-03): ações sensíveis (`SENSIVEIS`: flags, restore, etc.) exigem `reauth` recente
  (coluna `sess.reauth`).
- **Papéis** (`PAPEIS`): `admin > coordenacao > equipe > cliente` aninhados + `fornecedor` lateral
  (só acessa o que está em `FORNECEDOR_OK`). Tabela `membro` guarda o papel por tenant;
  `papelInferido()` é o fallback (OWNER→admin, `COORDS`→coordenacao, resto→equipe).
- **Guard central** em `route()`: `MIN[action]` é o piso de papel de cada ação; **negar por omissão**
  (S-02) — ação nova sem entrada em `MIN` não fica aberta. Recorte fino fica dentro da ação.
- **Capabilities por cargo**: `capsDe()` (dono = `*`; senão união das caps dos cargos em
  `membro_cargo`, override `config cargocaps:<cid>`, default `CARGO_CAPS_DEFAULT`; sem cargo →
  fallback `PAPEL_CAPS`). `capsAtribuidas()` (sem fallback) é usada nas **áreas restritas** (acervo,
  comercial, financeiro, permissões): cargo só estende acesso, nunca abre sozinho.
  `temCapSet(caps,"area.acao")` aceita `*` e `area.*`. `podeGestaoProjeto()` = papel coordenação/admin
  **ou** cap `projetos.aprovar`.
- **Navegação server-driven**: `MODULOS` + `modulosLiberados(u)` decidem o que a casca mostra;
  esconder no front nunca é a fronteira.
- `/mcp` valida o token por SHA-256 contra `config["mcptokh:<hash>"]`; ferramentas de acervo
  (`ACERVO_TOOLS`) checam permissão de acervo.
- Definir ou alterar senha é sempre ação do usuário: nunca criar nem digitar senha por ele.

## 5. Feature flags (E-06)

`const FLAGS` em `src/index.ts`; leitura por `flagsAtivas(tenant)`; escrita **só o dono + reauth**,
em Administração › Feature flags, em runtime e sem redeploy (auditado). Funcionalidade nova nasce
**`def:false` e sem seed**; ligar é decisão do dono, depois da validação em staging.

| Flag | O que liga | Estado de referência |
|---|---|---|
| `casca_nova` / `casca_auto` | link/banner e redirecionamento para a casca React `/app` | OFF |
| `horas_aprovacao` | horas exigem aprovação da coordenação para entrar nos indicadores | semeada ON para a Intelecto |
| `contrato_abre_projeto` | 3-A: contrato confirmado cria projeto PROPOSTO + parcela inicial | OFF |
| `regras_agendadas` | 3-B: cron diário R1–R4 notifica no sino (projeto parado 30 d, estouro 80/100/120 %, sexta sem apontamento, snapshot mensal) | OFF |
| `conciliacao_ia` | 3-C: "Sugerir CC (IA)" na fila de conciliação (IA só sugere; humano aceita via `fluxoCc`) | OFF |

Confirme o estado real pela ação de flags antes de afirmar; a tabela acima é referência de 2026-10-29.

## 6. Código: onde fica cada coisa

- `src/index.ts` — Worker inteiro: `ensureSchema`, auth, `MIN`, `MODULOS`, `route()` com todas as
  ações, crons (`scheduled()` ramifica por `event.cron`), `/mcp`, `backupD1`, `rodarRegrasAgendadas`.
- `src/ondaNx.mjs` + `.d.mts` — **helpers puros** de cada onda (ESM, sem D1, sem relógio — data
  injetada), importados pelo Worker e testados por comportamento. Lógica nova testável vai para cá.
- `public/index.html` — casca clássica (JS puro, sem framework). Padrões: botões por `data-*` +
  `querySelectorAll` (nunca interpolar id em `onclick`); escapar com `esc()`; mapas de lookup com
  `Object.create(null)`; cor só por token CSS nos três blocos de tema.
- `app/` — casca nova React+TS (Vite → `public/app`), rotas por hash `#/<area>/<sub>` em
  `app/src/routes.ts`; áreas ainda não migradas apontam para o legado (estrangulamento).
- `test/*.test.mjs` — `node --test`; testes de comportamento dos helpers + asserts de fonte (ex.:
  proibir `INSERT INTO notificacao` fora de `notifStatements`, provar ação read-only).
- `consistency/rules.sql` — Painel de Consistência (C1…C18); regras novas também na ação
  `consistencia` do Worker (as da Onda 3 vêm de `regrasExtra()` em `src/onda3a.mjs`).
- `docs/` — arquitetura, plano de deploy, drill de restore, specs e planos por onda.

## 7. Regras de negócio

- Centro de custo **E.C.T.P** (`empresa.cliente.tipo.projeto`, ex. `1.25.2.3`); tipo 4 = não
  faturável; abertos = A INICIAR, EM ANDAMENTO, EM ESPERA. Toda hora tem CC, inclusive reunião,
  treinamento e ausência.
- Com `horas_aprovacao` ligada, lançamento nasce PENDENTE e só entra em indicador depois de aprovado.
- Projeto CONCLUÍDO/CANCELADO não recebe horas; a Coordenação (`projetos.aprovar`) pode forçar
  lançamento retroativo, auditado (`hora_retroativa_forcada`), e a mensagem sugere CCs ativos do
  mesmo cliente.
- Rateio das áreas de apoio (`CC_AREA`: `1.1.4.9` comercial, `1.1.4.10` jurídico, `1.1.4.11`
  financeiro) distribuído mês a mês entre projetos faturáveis com horas técnicas, fechando 100 %.
- Proposta × execução por função; acima de 120 % marca atenção.
- Roster legado no servidor (`COLABS`, `NOMES`, `COORDS`, `AREA_DE`) convive com `membro`/
  `membro_cargo`; pessoa nova entra pelo cadastro do portal, não editando listas no código.

### Confidencialidade e privacidade (crítico)

- **Valor monetário (R$) só no módulo Financeiro**, visível ao dono (`isOwner`) ou a cargo com
  `financeiro.ver`. Fora dele (horas, projetos, notificações, Vitrine, MCP), nenhuma resposta da API
  carrega valor. A regra age na origem (o que a ação devolve), não como aviso visível na tela —
  não exibir frases do tipo "nenhum valor monetário circula".
- Travar dado sensível **no servidor** (recorte por slug/tenant/cap na ação), nunca só esconder na
  tela. Toda query filtra `tenant_id`.
- Áreas confidenciais (`AREAS_PROT`: escritório de IA, financeiro confidencial, propostas,
  contratos) por allowlist `config perm:<area>` controlada pelo dono.
- Material `interno` e de cliente não sai da casa; nenhum arquivo é público — R2 servido só pelo
  Worker, com gate.
- Na dúvida sobre acesso, o item fica só para a coordenação.

## 8. Ondas e pendências (estado em 2026-10-29)

- Em produção: Ondas 0–4 (PR #1), hotfix PBKDF2, 3-A (PR #2), 3-B (PR #3), 3-C (PR #4) — todas as
  flags novas OFF.
- **Validação logada em staging** pendente antes de ligar `contrato_abre_projeto`,
  `regras_agendadas` e `conciliacao_ia` (roteiros nos corpos dos PRs #2–#4). O cron de 3-B não roda
  em staging: disparar as regras por chamada direta.
- Conferir que o cron de backup `0 6 * * *` está gravando em `portal-intelecto-backup`.
- `BRIEF_MODELO` (Daily Brief) ainda aponta para `@cf/meta/llama-3.1-8b-instruct`, descontinuado
  em 2026-05-30 — trocar para `-fast` (como `CONC_MODELO`) numa mudança própria.
- Pendências de infraestrutura do dono: Cloudflare Access na frente do domínio; branch protection
  em `main` exigindo o check `verify`.

## 9. Lições (não repetir)

1. Schema sem bump de `SCHEMA_VER` não nasce em produção.
2. Agregação sem recorte de tenant/slug soma o portal inteiro.
3. Cron precisa ser idempotente: grave por `INSERT OR IGNORE` contra `UNIQUE` de janela.
4. Flag de cron checada no início da rotina (sai cedo com a flag OFF).
5. Modelo de Workers AI pode ser descontinuado: centralize em constante e logue o erro da IA.
6. Dois PRs no mesmo arquivo: ensaie a integração antes; resolva por merge commit, sem rebase/force
   em branch alheio.
7. PBKDF2 acima de 100000 iterações quebra login no Worker.
8. Não confie no deploy manual do Windows: a produção sai do `main` via Actions.

## 10. Como o Gustavo trabalha

- Pergunta antes de mudar hábito da equipe; decide entre opções concretas.
- Confere se o pedido foi atendido por inteiro — dizer com honestidade o que ficou de fora.
- Nenhum deploy, merge ou ligação de flag sem OK explícito; confirmar ações externas/irreversíveis.
- Prefere ajuste no que já existe a arquivo/aba nova.
- Tom institucional: direto, sem enfeite, sem emoji, número sempre com unidade.
