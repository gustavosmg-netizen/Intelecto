---
name: gate-de-lancamento
description: "Portão obrigatório antes de LANÇAR qualquer coisa na Intelecto & CSTR: entregável de engenharia (memorial, planilha, dimensionamento, prancha, apresentação, proposta), carga de dados (D1, R2, acervo) ou mudança no Portal (merge em main, deploy, ligar feature flag). Trilha E (engenharia): diagnóstico → medir → grau de liberdade → cálculo conferido → Crivo A-F. Trilha P (portal): CI verde → integração ensaiada → schema/flags → privacidade → OK do dono. Ambas travam confidencialidade/valores e risco de plataforma. Palavras-gatilho: lançar, publicar, entregar, liberar, subir, pronto para entrega, deploy, merge, ligar flag, memorial, planilha, dimensionamento, prancha, carga, importar."
---

# Gate de Lançamento (Intelecto & CSTR)

NENHUM entregável, NENHUMA carga e NENHUMA mudança de portal é lançada sem passar por este
portão, na ordem da trilha correspondente. Se qualquer passo falhar, o item **volta para revisão**
— não é lançado. Passos 6 e 7 valem para as duas trilhas.

Escolha a trilha:
- **Trilha E** — entregável de engenharia ou carga de dados técnicos.
- **Trilha P** — código/dados do Portal (PR, merge em `main`, deploy, flag, carga no D1/R2).

## Trilha E — entregável de engenharia

1. **Diagnóstico dos dados.** Estabeleça a base factual: linha de base, predecessores (fichas e
   precedentes via `acervo-consulta`), auditoria dos dados de entrada. Nada é dimensionado ou
   publicado sobre dado não verificado. Contexto da casa e macroprocesso: `intelecto-contexto`.
2. **Medir, não assumir.** Toda dimensão (largura, cota, área, vazão) vem de **medição** na
   prancha/dado, com fonte rastreável (para DWG/DXF: `cad-engineering`; locação e cotas:
   `verificacao-locacao-cotas-terraplenagem`; topografia: `mdt-de-curvas-de-nivel`).
   **Premissa sem medida é bloqueio.**
3. **Grau de liberdade** (`grau-de-liberdade`). Liste TODA variável assumida e justifique; confirme
   GL = 0 antes de resolver. Subespecificado ou sobreespecificado = pare.
4. **Cálculo conferido.** Fórmula e unidades conferidas; para ETE use os crivos de
   `intelecto-ete`. **Verifique a célula/faixa selecionada** em cada planilha. Refaça um ponto-chave
   por caminho independente para bater o resultado. Pranchas: `intelecto-prancha-executiva` /
   `intelecto-pranchas-cortes`; emissão do motor Python: `eng-auditor`.
5. **Crivo Intelecto A-F** (definido em `intelecto-contexto`): conteúdo/evidência, rigor
   matemático, compliance normativo, redação/tom, elementos visuais, integridade/versão. Reprova
   retorna ao passo do erro.

## Trilha P — Portal (Cloudflare Worker, repo `gustavosmg-netizen/Intelecto`)

Memória técnica do portal: skill `portal-gestao-intelecto`.

1. **Base atualizada.** `git fetch --all --prune`; o branch está sobre o `main` atual; lidos os PRs
   abertos que tocam os mesmos arquivos e a spec/plano da onda em `docs/superpowers/`.
2. **CI verde no head atual** (`verify.yml`): `build:app`, `build:check` (dry-run do wrangler),
   `npm test` — e typecheck **sem aumentar** o número de erros em relação ao `main`.
3. **Integração ensaiada.** Se há mais de um PR para entrar, faça o merge local de `main` + PRs na
   ordem prevista, resolva conflitos (merge commit, sem rebase/force em branch alheio) e rode o
   passo 2 sobre o resultado. A árvore final do merge deve ser igual à ensaiada.
4. **Schema e flags.** Mudança de schema tem bump de `SCHEMA_VER` + migração própria numerada sem
   colisão. Funcionalidade nova nasce atrás de flag `def:false`, sem seed. Cron novo sai cedo com a
   flag OFF e é idempotente.
5. **Privacidade e autorização.** Ação nova tem entrada em `MIN` (negar por omissão), recorte por
   `tenant_id`/slug/cap no servidor, e nenhuma resposta fora do Financeiro carrega valor monetário.
6. **OK do dono.** Merge em `main` (= deploy em produção) e ligar flag só com pedido explícito do
   dono. Depois do merge, confirme o job `deploy` verde. Ligar flag exige validação logada em
   staging antes (dono + reauth, em Administração › Feature flags).

## 6. Confidencialidade e valores (ambas as trilhas)

`confidencialidade: interno` NUNCA sai da casa (inclui material de cliente/terceiros).
**Nenhum valor monetário** publicado ou exposto fora do módulo Financeiro do portal (dono ou cargo
com `financeiro.ver`).

## 7. Segurança de plataforma (ambas as trilhas)

Conta de negócio; cargas em **lote único** (nunca centenas de chamadas em rajada); MCP/endpoint
atrás de token; sem automação em massa de desenvolvimento (criação de branches/tokens/recursos em
série). A produção roda em Cloudflare Workers a partir do `main` do GitHub — não publicar por
caminho paralelo (deploy manual, outro host).

## Definição de "pronto"

Só depois da trilha completa + 6 e 7 em verde. Antes disso, o item está EM REVISÃO, não lançado.
Ao concluir, registre o que foi lançado e por qual caminho: no documento de registro do projeto
(Trilha E) ou no PR/commit de merge (Trilha P).
