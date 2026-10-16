# Handoff: Portal Intelecto & CSTR (próxima conversa)

> Atualizado em 2026-10-13 após o incidente e a recuperação do canon. O conteúdo canônico vive na auto-memória do Claude Code; este arquivo é cópia de segurança do prompt de continuidade.

## Leia primeiro

- `ESTADO_ATUAL_Portal_Intelecto_2026-10-13.md`: arquitetura, módulos, schema, regras e pendências.
- `PLANO_Portal_Intelecto_Fase0-1-2_2026-10-13.md`: roteiro Fase 0, 1 e 2 e decisões.
- `REGISTRO_Incidente_Canon_2026-10-13.md`: o que se perdeu e o que foi recuperado. NÃO rodar os scripts `Reorganizar_*`. NÃO esvaziar a Lixeira sem confirmar.

## Onde estão os arquivos

- Canon (fonte da verdade): `...\00 - Padrão Intelecto\01_Portal_Gestao (Cloudflare ATIVO)\01_Portal_Codigo_e_Arquitetura\cloudflare-portal\` (`src/index.ts`, `public/`, `wrangler.toml`, `package*`, `schema.sql`, seeds).
- Mirror de deploy: `C:\pideploy\`. O deploy sempre sai daqui.
- O canon tem enumeração intermitente por normalização Unicode; ver o registro do incidente para a forma segura de resolver o caminho.

## Regras de operação

- UTF-8: só `[System.IO.File]::ReadAllText/WriteAllText` com `UTF8Encoding($false)`; nunca `Get-Content`/`Set-Content` do PowerShell 5.1.
- `SCHEMA_VER`: toda mudança de schema em `ensureSchema()` exige bump de `const SCHEMA_VER` em `src/index.ts`. Atual: `2026-10-09a`.
- Deploy: `cd C:\pideploy; npx.cmd -y wrangler@4 deploy`, depois `ping` (`POST /api {"action":"ping"}`).
- D1 `--remote` rejeita BEGIN/COMMIT/PRAGMA; DELETE é bloqueado (o usuário roda no terminal dele).
- Sem valor monetário fora do módulo Financeiro (admin e dono). Multi-tenant no servidor.
- Confirmar antes de ações externas ou irreversíveis e antes de rodadas de agentes em massa. Nenhum deploy sem OK.

## Estado no fim desta conversa (2026-10-13)

- Canon recuperado e reconstruído; `src/index.ts` do canon com SHA igual ao do pideploy e à produção.
- Fase 0.1 (MCP): diagnóstico feito (servidor saudável) e endurecimento aplicado no canon e no pideploy (mensagem de token acionável; catálogo lazy em `tools/call`). Validado por dry-run. NÃO deployado.
- A seguir, sob OK: Fase 0.2 (Escritório como catálogo e lançador), depois Fase 1 (RH) e Fase 2 (fluxos e manual vivo). Preferência: agrupar as mudanças e fazer um deploy só, testado.

## Arquitetura (resumo)

Cloudflare Worker (Hono) + D1 `portal-intelecto` + R2 (`portal-intelecto-blob`, `acervo-intelecto`) + AI Search/AutoRAG (`acervo-intelecto`). Front SPA em `public/index.html`. Auth por token (localStorage `ce_tok`, no corpo do POST /api) para `{slug, coord, papel, tenant_id}`; SHA-256 salgado; tabela `sess`. Guard central em `route()` por `MIN[action]`; papéis admin, coordenacao, equipe, cliente e fornecedor (tabela `membro`). Navegação server-driven por `MODULOS` e `modulosLiberados()`. `/mcp` valida token SHA-256 para `config["mcptokh:<hash>"]`. URL: `https://portal.intelecto-eng.com.br`.
