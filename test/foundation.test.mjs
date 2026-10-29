// Verificação de fundação (Onda 0) — roda no CI com `node --test`, sem rede.
// Guarda invariantes estruturais do repositório; não toca produção nem D1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

test("baseline tem todas as tabelas de produção", () => {
  const sql = read("migrations/0001_baseline.sql");
  const esperadas = [
    "lanc","proj","projx","andam","prod","prevf","custohora","custohora_vig","custo_fixo",
    "fluxo","fin_snapshot","cc_contrato","cc_proposta","cc_produto","cc_hist","crm_deal",
    "crm_lead","crm_time","lead_funnel","amb_registro","lead_instrumento","amb_agg","membro",
    "membro_cargo","rh_cargo","pessoa_ficha","pessoa_skill","pessoa_meta","pessoa_treino",
    "progcurso","evento","rito","biblio","param","conteudo","docs","portfolio_servico",
    "portfolio_versao","portfolio_skill","vitrine_case","vitrine_produto","brief","brief_fonte",
    "config","sess","audit","solic","acesso",
  ];
  for (const t of esperadas) {
    assert.match(sql, new RegExp("CREATE TABLE IF NOT EXISTS " + t + "\\b"), "falta tabela: " + t);
  }
});

test("baseline é idempotente (só IF NOT EXISTS; nenhum DROP/DELETE)", () => {
  const sql = read("migrations/0001_baseline.sql");
  const creates = sql.match(/CREATE TABLE/g) || [];
  const guards = sql.match(/CREATE TABLE IF NOT EXISTS/g) || [];
  assert.equal(creates.length, guards.length, "todo CREATE TABLE deve ter IF NOT EXISTS");
  assert.doesNotMatch(sql, /\bDROP\s+TABLE\b/i, "baseline não pode conter DROP TABLE");
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i, "baseline não pode conter DELETE");
});

test("regras de consistência são só leitura e nomeadas", () => {
  const sql = read("consistency/rules.sql");
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i, "regra só pode consultar (SELECT)");
  const regras = (sql.match(/^SELECT '([A-Z0-9-]+)' rule/gim) || []);
  assert.ok(regras.length >= 11, "esperado ao menos 11 regras nomeadas, achei " + regras.length);
});

test("toda tabela do wrangler.toml existe no baseline", () => {
  const toml = read("wrangler.toml");
  const base = read("migrations/0001_baseline.sql");
  // bindings de D1 referenciam database_name; o schema é um só (portal-intelecto).
  assert.match(toml, /database_name = "portal-intelecto"/);
  // sanidade: o binding DB existe
  assert.match(toml, /binding = "DB"/);
  assert.ok(base.length > 1000, "baseline parece vazio");
});

test("src/index.ts ainda declara SCHEMA_VER (contrato do caminho atual)", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /const SCHEMA_VER = "/);
});

test("Onda 1: imposto entra no custo real (correção do D-3)", () => {
  const ts = read("src/index.ts");
  // decompoeFin soma o imposto no custoTotal (antes ficava de fora).
  assert.match(ts, /const custoTotal = arred2\(moCusto \+ imposto \+/);
});

test("Onda 1: Contrato é o dono do valor (helper + override)", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /async function valorContratadoMap/);
  assert.match(ts, /contratadoOverride\?: number/);
  assert.match(ts, /action === "contratoSet"/);
});

test("Onda 1: imposto é sobre o contrato (faturamento), não sobre horas, com padrão da empresa", () => {
  const ts = read("src/index.ts");
  // alíquota efetiva = override do projeto OU padrão da empresa; imposto = pct × contratado.
  assert.match(ts, /const imposto = arred2\(\(pctImp \/ 100\) \* contratado\)/);
  assert.match(ts, /async function impostoPadrao/);
  assert.match(ts, /action === "impostoPadraoSet"/);
});

test("Onda 3-A: contratoSet dispara planoProporProjeto atrás da flag contrato_abre_projeto", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /from "\.\/onda3a\.mjs"/);
  assert.match(ts, /planoProporProjeto\(/);
  assert.match(ts, /contrato_abre_projeto/);
});

test("migração 0002 cria colunas de contrato e parcelas", () => {
  const sql = read("migrations/0002_contrato.sql");
  for (const c of ["status", "tipo", "deal_id"]) {
    assert.match(sql, new RegExp("ALTER TABLE cc_contrato ADD COLUMN " + c));
  }
  assert.match(sql, /CREATE TABLE IF NOT EXISTS contrato_parcela/);
});

test("Onda 1: regra de status (concluído/cancelado não recebe horas) + andamento derivado", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /async function bloqueiaSeFechado/);
  assert.match(ts, /não recebe horas/);
  // o bloqueio roda no lançar e no editar (agora com 3º arg = opções de exceção).
  assert.match(ts, /await bloqueiaSeFechado\(e\.cc, u\.tenant_id, \{/);
  // progresso derivado dos marcos.
  assert.match(ts, /function pctEtapa/);
  assert.match(ts, /progressoDerivado: pctEtapa/);
});

test("Onda 3-A: guard de horas usa decideBloqueioHoras + exceção auditada + sugestão de CC", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /decideBloqueioHoras\(/);
  assert.match(ts, /hora_retroativa_forcada/);
  assert.match(ts, /CCs ativos do mesmo cliente/);
});

test("Onda 3-A: Painel de Consistência inclui regrasExtra (C17/C18) sem perder as antigas", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /\.\.\.regrasExtra\(T\)/);
  assert.match(ts, /rule: "C1"/); // regras antigas inline preservadas
});

test("Onda 3-A: UI clássica oferece lançamento retroativo forçado à Coordenação", () => {
  const html = read("public/index.html");
  assert.match(html, /forcar:true/);
  assert.match(html, /não recebe horas/);
});

test("Onda 3-A: exceção do guard é cap-only (projetos.aprovar), coerente com projaprovar — sem || u.coord", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /podeAprovarAdd = temCapSet\(capsAdd, "projetos\.aprovar"\);/);
  assert.match(ts, /podeAprovarEd = temCapSet\(capsEd, "projetos\.aprovar"\);/);
  assert.doesNotMatch(ts, /podeAprovar(Add|Ed) = .*u\.coord/);
});

test("Onda 3-C: acao conciliaSugerir read-only, atras da flag, reusa env.AI", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /from "\.\/onda3c\.mjs"/);
  assert.match(ts, /conciliacao_ia: \{[^}]*def: false/); // flag nasce OFF
  assert.match(ts, /conciliaSugerir: "coordenacao"/); // piso no mapa de acoes
  const ini = ts.indexOf('action === "conciliaSugerir"');
  assert.ok(ini > 0, "acao conciliaSugerir ausente");
  // corpo inteiro da acao: ate o proximo `if (action === ` de nivel do handler.
  const fim = ts.indexOf('\n  if (action === "', ini + 10);
  const corpo = ts.slice(ini, fim > 0 ? fim : ini + 6000);
  assert.ok(corpo.length > 400 && corpo.length < 6000, "corpo da acao mal delimitado");
  // read-only: o corpo da acao nao grava fluxo nem chama fluxoSet/fluxoCc
  assert.doesNotMatch(corpo, /UPDATE fluxo|INSERT INTO fluxo|DELETE FROM fluxo|fluxoSet|fluxoCc/);
  assert.doesNotMatch(corpo, /INSERT |UPDATE |DELETE /); // nenhuma escrita (audit() e funcao, nao SQL aqui)
  // reusa o padrao do triagemIA e o guard anti-invencao
  assert.match(corpo, /ENV\.AI\.run\(/);
  assert.match(corpo, /parseSugestaoCC\(/);
  assert.match(corpo, /montaPromptSugestaoCC\(/);
  assert.match(corpo, /conciliacao_ia/);
  assert.match(corpo, /registro='ATIVO'/); // so candidatos ATIVOS
  assert.match(corpo, /financeiro\.ver/);
  // C1 (revisao): llama-3.1-8b-instruct foi DESCONTINUADO em 2026-05-30 (so -fast/-lora seguem ativos):
  // a acao usa modelo proprio ativo e nao engole o erro do modelo em silencio.
  assert.match(ts, /const CONC_MODELO = "@cf\/meta\/llama-3\.1-8b-instruct-fast"/);
  assert.match(corpo, /ENV\.AI\.run\(CONC_MODELO/);
  assert.match(corpo, /console\.error\(/);
  assert.match(corpo, /selecionaCandidatos\(/); // I1: prompt limitado
});

test("Onda 3-C: casca clássica tem sugerir+aceitar na conciliação (IA só sugere; Aceitar grava por clique)", () => {
  const html = read("public/index.html");
  const ini = html.indexOf("function _finConciliacao(");
  const fim = html.indexOf("function _finFluxo(", ini);
  assert.ok(ini > 0 && fim > ini, "funcao _finConciliacao nao localizada");
  const conc = html.slice(ini, fim);
  assert.match(conc, /Sugerir CC \(IA\)/);
  assert.match(conc, /api\("conciliaSugerir"/);
  assert.match(conc, /conciliacao_ia/); // botao so aparece com a flag ligada
  assert.match(conc, /Aceitar/);
  // o unico caminho de escrita do cc continua sendo o fluxoCc/fluxoSet existente, disparado por clique
  const sug = conc.slice(conc.indexOf('api("conciliaSugerir"'));
  const aceitar = sug.slice(sug.indexOf("conc-aceitar"));
  assert.match(aceitar, /api\("fluxoCc"/);
  // a resposta da sugestao NAO grava: o handler de sugerir nao chama fluxoCc/fluxoSet
  const soSugerir = sug.slice(0, sug.indexOf("conc-aceitar"));
  assert.doesNotMatch(soSugerir, /fluxoCc|fluxoSet/);
});

test("Onda 2: scaffold da casca nova (React/Vite) existe e aponta para /app", () => {
  const pkg = JSON.parse(read("app/package.json"));
  assert.ok(pkg.dependencies.react, "app sem react");
  assert.ok(pkg.dependencies["@dnd-kit/sortable"], "app sem dnd-kit (cockpit arrastável)");
  assert.match(read("app/vite.config.ts"), /base:\s*"\/app\/"/);
  assert.match(read("app/vite.config.ts"), /outDir:\s*"\.\.\/public\/app"/);
  // o build do app entra no verify e no deploy.
  assert.match(read("package.json"), /"build:app"/);
  assert.match(read(".github/workflows/verify.yml"), /npm run build:app/);
  assert.match(read(".github/workflows/deploy.yml"), /npm run build:app/);
  // cockpit arrastável + paleta Ctrl+K + cliente de API por cookie (sem token no corpo).
  assert.match(read("app/src/cockpit.tsx"), /DndContext/);
  assert.match(read("app/src/api.ts"), /credentials:\s*"same-origin"/);
});

test("Onda 2: Projeto 360 na casca nova (abas + endereço por CC)", () => {
  const p = read("app/src/projetos.tsx");
  assert.match(p, /export function Projeto360/);
  assert.match(p, /export function Carteira/);
  for (const aba of ["Visão", "Equipe e horas", "Entregáveis", "Financeiro", "Documentos", "Histórico"]) {
    assert.ok(p.includes(aba), "falta a aba: " + aba);
  }
  assert.match(p, /projdetalhe/);                 // consome a ação rica do servidor
  // sub-rota por CC (#/projetos/<cc>) dá endereço próprio a cada projeto.
  assert.match(read("app/src/routes.ts"), /export function parseHash/);
});

test("Onda 2: kanbans arrastáveis (pipeline + projetos) com mutação segura", () => {
  const ts = read("src/index.ts");
  // mutação FINA do estágio do deal (não sobrescreve os outros campos, ao contrário do crmDealSet).
  assert.match(ts, /action === "crmDealStage"/);
  assert.match(ts, /UPDATE crm_deal SET st = \?, atualizado = \? WHERE id = \?/);
  // front: board reutilizável com dnd-kit + os dois quadros.
  assert.match(read("app/src/kanban.tsx"), /useDroppable/);
  assert.match(read("app/src/kanban.tsx"), /useDraggable/);
  const b = read("app/src/boards.tsx");
  assert.match(b, /export function PipelineBoard/);
  assert.match(b, /export function ProjetosBoard/);
  assert.match(b, /crmDealStage/);
  assert.match(b, /"setproj"/); // quadro de projetos usa setproj (update parcial seguro)
});

test("Onda 2: cronograma com arraste de prazo auditado (via setproj)", () => {
  const c = read("app/src/cronograma.tsx");
  assert.match(c, /export function Cronograma/);
  assert.match(c, /onPointerDown/);        // arraste por ponteiro/toque
  assert.match(c, /"setproj"/);            // persiste a mudança de data
  assert.match(c, /previsto = fromDays|payload\.previsto/); // muda o previsto
  // setproj audita a mudança de datas no servidor (trilha projeto_gestao).
  assert.match(read("src/index.ts"), /audit\("projeto_gestao"/);
});

test("Onda 2: Meu trabalho e Financeiro migrados para a casca nova", () => {
  const mt = read("app/src/meutrabalho.tsx");
  assert.match(mt, /export function MeuTrabalho/);
  assert.match(mt, /"add"/);               // lançar horas
  assert.match(mt, /entry:\s*\{\s*d:/);    // formato entry {d,cc,h,t}
  const fin = read("app/src/financeiro.tsx");
  assert.match(fin, /export function Financeiro/);
  for (const ac of ["resumoExec", "financeiro", "conciliacao", "fluxoCc"]) {
    assert.ok(fin.includes(ac), "Financeiro sem a ação: " + ac);
  }
  const app = read("app/src/App.tsx");
  assert.match(app, /area\.id === "meu"/);
  assert.match(app, /area\.id === "financeiro"/);
});

test("Onda 2: Pessoas e Administração (Painel de Consistência operacional)", () => {
  const ts = read("src/index.ts");
  // ação que roda as regras de consistência (read-only, gated admin).
  assert.match(ts, /action === "consistencia"/);
  assert.match(ts, /Painel de Consistência restrito/);
  assert.match(ts, /rule: "C1"/);
  assert.match(ts, /consistencia: "coordenacao"/);
  // front: as duas áreas migradas.
  assert.match(read("app/src/pessoas.tsx"), /export function Pessoas/);
  const ad = read("app/src/admin.tsx");
  assert.match(ad, /export function Administracao/);
  assert.match(ad, /"consistencia"/);
  const app = read("app/src/App.tsx");
  assert.match(app, /area\.id === "pessoas"/);
  assert.match(app, /area\.id === "admin"/);
});

test("Onda 2: Inteligência e Vitrine migradas (Daily Brief, Escritório, cases)", () => {
  const i = read("app/src/inteligencia.tsx");
  assert.match(i, /export function Inteligencia/);
  assert.match(i, /"brief"/);
  assert.match(i, /"escritorio"/);
  assert.match(read("app/src/vitrine.tsx"), /export function Vitrine/);
  assert.match(read("app/src/vitrine.tsx"), /"vitrine"/);
  const app = read("app/src/App.tsx");
  assert.match(app, /area\.id === "inteligencia"/);
  assert.match(app, /area\.id === "vitrine"/);
});

test("Onda 4: Academia (cursos/aulas/quiz/certificado ligado à ficha)", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /CREATE TABLE IF NOT EXISTS curso \(/);
  assert.match(ts, /CREATE TABLE IF NOT EXISTS certificado \(/);
  for (const ac of ["academia", "cursoDetalhe", "matricular", "aulaConcluir"]) assert.ok(ts.includes('action === "' + ac + '"'), "falta ação " + ac);
  // a nota do quiz é calculada no servidor; a correta só vai ao cliente p/ coord (autoria), nunca ao aluno.
  assert.match(ts, /u\.coord \? q : \{ q: q\.q, opc: q\.opc \}/);
  assert.match(ts, /resp\[i\] === Number\(\(perg\[i\] as P\)\.correta\)/);
  // o certificado grava um treinamento na ficha.
  assert.match(ts, /INSERT OR IGNORE INTO pessoa_treino/);
  assert.match(read("migrations/0006_academia.sql"), /CREATE TABLE IF NOT EXISTS curso_aula/);
  // front: catálogo + player.
  assert.match(read("app/src/academia.tsx"), /export function AcademiaCatalogo/);
  assert.match(read("app/src/academia.tsx"), /export function CursoPlayer/);
  assert.match(read("app/src/App.tsx"), /area\.id === "academia"/);
});

test("Segurança: S-02 negar-por-omissão, S-03 reauth e cabeçalhos", () => {
  const ts = read("src/index.ts");
  // S-02 — guard fail-closed: ação fora de PUBLICAS e de MIN é NEGADA.
  assert.match(ts, /if \(!Object\.prototype\.hasOwnProperty\.call\(MIN, action\)\) \{\s*\n\s*throw new Error\("Ação não reconhecida/);
  assert.match(ts, /ambList: "equipe"/); // as ações antes não-catalogadas entraram em MIN
  // S-03 — reauth step-up.
  assert.match(ts, /const SENSIVEIS = new Set<string>\(/);
  assert.match(ts, /async function exigeReauth/);
  assert.match(ts, /action === "reauth"/);
  assert.match(ts, /REAUTH_NECESSARIO/);
  assert.match(ts, /if \(SENSIVEIS\.has\(action\)\) await exigeReauth/);
  // cabeçalhos: HSTS + cache-control na página; CSP nos assets de /app.
  assert.match(ts, /Strict-Transport-Security/);
  assert.match(ts, /Cache-Control", "private, no-cache/);
  assert.match(read("public/_headers"), /Content-Security-Policy:.*script-src 'self'/);
  // o front (casca nova e portal) trata o REAUTH e repete a ação.
  assert.match(read("app/src/api.ts"), /REAUTH_NECESSARIO/);
  assert.match(read("public/index.html"), /REAUTH_NECESSARIO/);
});

test("Observabilidade (E-04): logs estruturados + Workers Logs ligado", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /function logEvent/);
  assert.match(ts, /logEvent\(\{ ev: "api", reqId, action, ms:/);   // RED por requisição
  assert.match(ts, /ev: "cron", job:/);                              // cron instrumentado
  assert.doesNotMatch(ts, /logEvent\([^)]*token/);                   // nunca loga o token
  const toml = read("wrangler.toml");
  assert.match(toml, /\[observability\]\s*\nenabled = true/);
  assert.match(toml, /\[env\.staging\.observability\]/);
});

test("Recuperação (E-05): restore_backup com verify/apply, dono+reauth e trava de ambiente", () => {
  const ts = read("src/index.ts");
  // o backup exclui a projeção reconstruível (leads) para ser restaurável no Worker.
  assert.match(ts, /const BACKUP_SKIP = new Set<string>\(\["amb_registro", "amb_agg"\]\)/);
  assert.match(ts, /\.filter\(\(n: string\) => !BACKUP_SKIP\.has\(n\)\)/);   // backup aplica o skip
  // helper de restauração (verify não escreve; apply exige confirmar).
  assert.match(ts, /async function restauraBackup/);
  assert.match(ts, /modo: "verify"/);
  assert.match(ts, /if \(!opts\.aplicar\) return \{ \.\.\.base, modo: "verify" \}/);
  assert.match(ts, /modo apply exige confirmar:true/);
  assert.match(ts, /INSERT OR REPLACE INTO/);
  // ação: dono-only + reauth (SENSIVEIS) + trava de ambiente (só staging sem prod:true) + auditada.
  assert.match(ts, /action === "restore_backup"/);
  assert.match(ts, /Apenas o dono pode restaurar o backup/);
  assert.match(ts, /exige prod:true explícito/);
  assert.match(ts, /audit\("restore_backup"/);
  assert.ok(/const SENSIVEIS = new Set<string>\(\[[\s\S]*?"restore_backup"[\s\S]*?\]\)/.test(ts), "restore_backup em SENSIVEIS");
  assert.ok(/const EVENTOS_SENSIVEIS[\s\S]*?"restore_backup"[\s\S]*?\];/.test(ts), "restore_backup retido na trilha");
  // a trava de ambiente depende do var AMBIENTE nos dois ambientes do wrangler.
  const toml = read("wrangler.toml");
  assert.match(toml, /AMBIENTE = "producao"/);
  assert.match(toml, /AMBIENTE = "staging"/);
  // runbook com RPO/RTO existe.
  assert.match(read("docs/RESTORE_DRILL.md"), /\*\*RPO\*\*[\s\S]*\*\*RTO\*\*/);
});

test("Auth: PBKDF2 respeita o teto de 100000 iterações do runtime do Worker", () => {
  const ts = read("src/index.ts");
  // hashSenhaNova NUNCA grava acima de 100000 (acima disso o Worker lança ao verificar → login quebra).
  assert.match(ts, /async function hashSenhaNova[\s\S]*?const iter = 100000;/);
  assert.doesNotMatch(ts, /const iter = 150000;/);
  // verificaSenha trata hash legado >100000 como não-verificável (false), sem estourar.
  assert.match(ts, /if \(iter > 100000\) return false;/);
});

test("E-06: contrato de API versionado + feature flags", () => {
  const ts = read("src/index.ts");
  // contrato versionado: API_VER existe e é carimbado em toda resposta do /api.
  assert.match(ts, /const API_VER = "/);
  assert.match(ts, /\(out as any\)\.apiVer = API_VER/);
  // feature flags: registro + leitura efetiva + ações flags/flagset (dono + auditada).
  assert.match(ts, /const FLAGS: Record<string, \{ desc: string; def: boolean \}>/);
  assert.match(ts, /async function flagsAtivas/);
  assert.match(ts, /action === "flags"/);
  assert.match(ts, /action === "flagset"/);
  assert.match(ts, /Apenas o dono altera as flags/);
  assert.match(ts, /audit\("flag_set"/);
  // flagset é sensível (dono + reauth) e retido na trilha; hub carrega o handshake.
  assert.ok(/const SENSIVEIS = new Set<string>\(\[[\s\S]*?"flagset"[\s\S]*?\]\)/.test(ts), "flagset em SENSIVEIS");
  assert.ok(/const EVENTOS_SENSIVEIS[\s\S]*?"flag_set"[\s\S]*?\];/.test(ts), "flag_set retido na trilha");
  assert.match(ts, /apiVer: API_VER, schemaVer: SCHEMA_VER, flags: await flagsAtivas\(\)/);
  // front: detecta mismatch de contrato e oferece recarregar; entrada reversível no portal clássico.
  assert.match(read("app/src/api.ts"), /export function onApiVerChange/);
  assert.match(read("app/src/App.tsx"), /onApiVerChange\(\(\) => setNovaVersao\(true\)\)/);
  assert.match(read("app/src/admin.tsx"), /function FlagsCard/);
  assert.match(read("public/index.html"), /_fl\.casca_nova/);
  assert.match(read("public/index.html"), /casca_auto/);
});

test("Onda 1: catálogo de atividades + capacidade com vigência (CAP20 só como semente)", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /CREATE TABLE IF NOT EXISTS atividade_classe/);
  assert.match(ts, /CREATE TABLE IF NOT EXISTS capacidade_vig/);
  assert.match(ts, /async function classesNaoTrabalho/);
  // capacidade vem da tabela (h/semana ÷ 5), não mais da constante hardcoded.
  assert.match(ts, /const hdia = arred2\(hsem \/ 5\)/);
  assert.match(ts, /action === "capacidadeSet"/);
  assert.match(ts, /action === "atividadeClasseSet"/);
  // a migração 0004 existe e a 0005 é o template documentado do crm_time.
  assert.match(read("migrations/0004_atividade_capacidade.sql"), /CREATE TABLE IF NOT EXISTS capacidade_vig/);
  assert.match(read("migrations/0005_crm_time_to_lanc.sql"), /crm_time é hora de ÁREA, não de pessoa/);
});

test("UI: painel Contrato & parcelas no detalhe do projeto", () => {
  const html = read("public/index.html");
  assert.match(html, /function _contratoBloco/);
  assert.match(html, /function _contratoLiga/);
  assert.match(html, /_finBloco\(j\)\+_contratoBloco\(j\)/);
});

test("Onda 1: conciliação do caixa (fila paginada + baixa que preenche o CC)", () => {
  const ts = read("src/index.ts");
  assert.match(ts, /action === "conciliacao"/);
  assert.match(ts, /action === "parcelaBaixar"/);
  // a baixa só preenche o CC quando o movimento ainda não tem um (não sobrescreve decisão humana).
  assert.match(ts, /UPDATE fluxo SET cc = \?, u = \?, atualizado = \? WHERE id = \? AND tenant_id = \? AND COALESCE\(cc,''\) = ''/);
  // só uma entrada (recebimento) baixa uma parcela.
  assert.match(ts, /Só uma entrada \(recebimento\) baixa uma parcela/);
  assert.match(read("migrations/0003_conciliacao.sql"), /CREATE INDEX IF NOT EXISTS fluxo_cc/);
});

test("D-6: config isolado por tenant (PK composta + cfg* tenant-aware)", () => {
  const ts = read("src/index.ts");
  // rebuild idempotente da PK composta no ensureSchema (guardado por contagem de colunas PK).
  assert.match(ts, /pragma_table_info\('config'\) WHERE pk > 0/);
  assert.match(ts, /PRIMARY KEY \(tenant_id, k\)/);
  assert.match(ts, /ALTER TABLE config_mt RENAME TO config/);
  // upsert passa a usar ON CONFLICT(tenant_id, k); não sobra nenhum ON CONFLICT(k) de config.
  assert.match(ts, /ON CONFLICT\(tenant_id, k\) DO UPDATE SET v = excluded\.v/);
  assert.doesNotMatch(ts, /ON CONFLICT\(k\)/);
  // helpers tenant-aware (param opcional, default Intelecto) — não quebra os call-sites atuais.
  assert.match(ts, /async function cfgGet\(k: string, tenant: string = TENANT_INTELECTO\)/);
  assert.match(ts, /async function cfgSet\(k: string, v: string, tenant: string = TENANT_INTELECTO\)/);
  assert.match(ts, /async function cfgDel\(k: string, tenant: string = TENANT_INTELECTO\)/);
  // migração espelho existe.
  assert.match(read("migrations/0008_config_tenant_pk.sql"), /PRIMARY KEY \(tenant_id, k\)/);
});

test("D-5: vídeo self-hosted da Academia (R2 + rota com Range)", () => {
  const ts = read("src/index.ts");
  // schema: curso_aula ganha video_key (CREATE + ALTER idempotente).
  assert.match(ts, /ALTER TABLE curso_aula ADD COLUMN video_key TEXT DEFAULT ''/);
  // rota GET com Range, chave do banco (não do cliente), gate login + publicado.
  assert.match(ts, /app\.get\("\/academia\/video\/:aula"/);
  assert.match(ts, /ENV\.VIDEO\.get\(key, \{ range: \{ offset: start, length: end - start \+ 1 \} \}\)/);
  assert.match(ts, /status: 206/);
  assert.match(ts, /Curso ainda não publicado\./);
  // aulaSet grava video_key sanitizada (sem path traversal); cursodetalhe expõe temVideo.
  assert.match(ts, /if \(videoKey\.includes\("\.\."\)\) throw new Error/);
  assert.match(ts, /temVideo: !!String\(a\.video_key/);
  // binding VIDEO e migração espelho.
  assert.match(read("wrangler.toml"), /binding = "VIDEO"/);
  assert.match(read("migrations/0009_curso_aula_video.sql"), /ADD COLUMN video_key/);
  // front: player embute <video> gated e editor tem o campo da chave.
  assert.match(read("app/src/academia.tsx"), /\/academia\/video\/" \+ encodeURIComponent\(aula\.id\)/);
  assert.match(read("app/src/academia.tsx"), /Vídeo hospedado \(chave no R2\)/);
});

test("Acervo/MCP: catset unifica cat:json + cat:b64 (buscar_norma enxerga o import)", () => {
  const ts = read("src/index.ts");
  // catset grava os dois formatos; o /mcp lê cat:b64 com fallback para cat:json.
  assert.match(ts, /function b64FromStr/);
  assert.match(ts, /await cfgSet\("cat:b64", b64FromStr\(j\)\)/);
  assert.match(ts, /if \(!raw\) raw = \(await cfgGet\("cat:json"\)\) \|\| "";/);
});

test("D-4: aprovação de horas opt-in (flag; Intelecto semeada ON; add respeita)", () => {
  const ts = read("src/index.ts");
  // flag opt-in (default OFF) + seed ON para a Intelecto (preserva o fluxo atual).
  assert.match(ts, /horas_aprovacao: \{ desc:[^}]*def: false \}/);
  assert.match(ts, /if \(\(await cfgGet\("flag:horas_aprovacao"\)\) === null\) await cfgSet\("flag:horas_aprovacao", "1"\)/);
  // add: PENDENTE quando a aprovação está ligada; APROVADO imediato quando desligada.
  assert.match(ts, /const aprovReq = \(await flagsAtivas\(u\.tenant_id\)\)\.horas_aprovacao;/);
  assert.match(ts, /const st = aprovReq \? "PENDENTE" : "APROVADO";/);
  // edit/del liberam o próprio autor quando a aprovação está OFF.
  assert.match(ts, /!\(!aprovReq && \(cur\.slug === u\.slug \|\| u\.coord\)\)/);
  assert.match(ts, /!\(!aprovReqDel && \(cur\.slug === u\.slug \|\| u\.coord\)\)/);
  // flagsAtivas é tenant-aware (param opcional).
  assert.match(ts, /async function flagsAtivas\(tenant: string = TENANT_INTELECTO\)/);
});

test("migrations/ só tem arquivos .sql numerados em ordem", () => {
  const files = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql"));
  assert.ok(files.length >= 1, "nenhuma migração");
  for (const f of files) assert.match(f, /^\d{4}_/, "migração sem prefixo numérico: " + f);
});

test("Onda 3-B: tabela notificacao + ações + SCHEMA_VER bump", () => {
  const ts = read("src/index.ts");
  // Tabela no ensureSchema (nasce em D1 novo) + dedup por janela no próprio schema.
  assert.match(ts, /CREATE TABLE IF NOT EXISTS notificacao/);
  assert.match(ts, /UNIQUE\(tenant_id, ?tipo, ?ref, ?periodo\)/);
  // Sem bump, o D1 existente pula o setup e a tabela nunca nasce lá.
  assert.doesNotMatch(ts, /const SCHEMA_VER = "2026-10-26c"/, "SCHEMA_VER precisa ser bumpado");
  // Ações novas + piso no guard (todo logado vê as SUAS; o recorte fino é dentro da ação).
  assert.match(ts, /action === "notificacoes"/);
  assert.match(ts, /action === "notifLida"/);
  assert.match(ts, /notificacoes: "cliente"/);
  assert.match(ts, /notifLida: "cliente"/);
  // Visibilidade: o alvo de grupo só aparece para quem é coordenação (spec §4) — o parâmetro
  // desliga a condição, então um não-coordenador NUNCA casa com destino='@coordenacao'.
  assert.match(ts, /destino = '@coordenacao' AND \? = 1/);
  // Migração versionada espelha o CREATE (D1 existente aplica por `d1 migrations apply`).
  const mig = read("migrations/0010_notificacao.sql");
  assert.match(mig, /CREATE TABLE IF NOT EXISTS notificacao/);
  assert.match(mig, /UNIQUE\(tenant_id, ?tipo, ?ref, ?periodo\)/);
});

test("Onda 3-B: cron diário + regras agendadas atrás da flag", () => {
  // Trigger novo (o scheduled() ramifica por event.cron; staging segue com crons=[]).
  assert.match(read("wrangler.toml"), /"0 11 \* \* \*"/);
  const ts = read("src/index.ts");
  // Flag nasce OFF (def:false) e SEM seed — ligar é decisão explícita do dono.
  assert.match(ts, /regras_agendadas: \{ desc:[^}]*def: false \}/);
  assert.doesNotMatch(ts, /cfgSet\("flag:regras_agendadas"/, "a flag não pode ser semeada ligada");
  // Função + branch do cron + observabilidade pelo wrapper run().
  assert.match(ts, /async function rodarRegrasAgendadas/);
  assert.match(ts, /event\.cron === "0 11 \* \* \*"/);
  assert.match(ts, /run\("regras_agendadas"/);
  // Reusa os helpers puros (lógica testada por comportamento em test/onda3b.test.mjs).
  assert.match(ts, /from "\.\/onda3b\.mjs"/);
  assert.match(ts, /deveRodar\("parado"/);
  assert.match(ts, /deveRodar\("estouro"/);
  assert.match(ts, /deveRodar\("sem_apontamento"/);
  assert.match(ts, /deveRodar\("snapshot"/);
  // Dedup: nenhuma regra grava notificação fora do notifStatements (que é INSERT OR IGNORE).
  assert.match(ts, /notifStatements\(/);
  assert.doesNotMatch(ts, /INSERT INTO notificacao/, "notificação só entra por INSERT OR IGNORE");
  // R4 reusa o helper já existente do resumo executivo (não reimplementa o cálculo).
  assert.match(ts, /await resumoExecutivo\(TENANT_INTELECTO\)/);
  assert.match(ts, /INSERT INTO fin_snapshot/);
});

test("Onda 3-B: casca clássica tem o sino de notificações", () => {
  const html = read("public/index.html");
  // Consome as duas ações novas (listar + marcar lida) e tem o gatilho na casca.
  assert.match(html, /api\("notificacoes"\)/);
  assert.match(html, /api\("notifLida"/);
  assert.match(html, /id="ap-sino"/);
  // Conteúdo vem escapado (o texto da notificação é gerado pelo servidor, mas nunca cru no DOM).
  assert.match(html, /esc\(n\.titulo\)/);
});

test("Onda 3-B (revisão): as regras alcançam exatamente quem devem alcançar", () => {
  const ts = read("src/index.ts");
  // R3: `membro` também guarda cliente/fornecedor (ensureMembroCliente/membroadd), que nunca
  // lançam horas — sem filtro, receberiam "lance suas horas" toda sexta, para sempre.
  assert.match(ts, /AND m\.papel NOT IN \('cliente','fornecedor'\)/);
  // R2: `prevf` sobrevive ao encerramento do projeto. Sem filtro, a primeira rodada com a flag
  // ligada alerta estouro de projeto CONCLUÍDO/CANCELADO — e a dedup por nível nunca reabre.
  assert.match(ts, /FROM prevf f JOIN proj p ON p\.cc = f\.cc AND p\.tenant_id = f\.tenant_id/);
  assert.match(ts, /p\.registro = 'ATIVO'/);
  // Caixa '@coordenacao': mesmo predicado de autoridade do resto da gestão de projeto. Cap-only
  // esvazia a caixa em silêncio para um coordenador com cargo coord_comercial/coord_financeira
  // (nenhum dos dois concede projetos.aprovar, e capsDe deixa de cair no fallback por papel).
  assert.equal((ts.match(/const coord = \(await podeGestaoProjeto\(u\)\) \? 1 : 0;/g) || []).length, 2);
  // (O recorte de "marcar todas" que entrou aqui foi SUPERADO pelo `lido` por pessoa — ver o
  //  teste "`lido` é por pessoa (notificacao_lida)". Com notificacao_lida, marcar não silencia.)
  // Guarda da R4 não pode ser por autor: se a coordenação financeira fechar o resumo na manhã
  // do dia 1, o cron gravaria um SEGUNDO snapshot do mesmo dia na linha do tempo.
  assert.doesNotMatch(ts, /AND autor = 'cron' LIMIT 1/);
});

test("Onda 3-B: `lido` é por pessoa (notificacao_lida), não compartilhado", () => {
  const ts = read("src/index.ts");
  // Tabela própria: uma linha por (notificação, pessoa). Sem ela, o primeiro coordenador a ler
  // apagava o aviso de projeto parado para os outros três até a próxima janela de dedup.
  assert.match(ts, /CREATE TABLE IF NOT EXISTS notificacao_lida/);
  assert.match(ts, /PRIMARY KEY \(tenant_id, notif_id, slug\)/);
  assert.match(read("migrations/0011_notificacao_lida.sql"), /CREATE TABLE IF NOT EXISTS notificacao_lida/);
  // `notificacao` deixa de ter coluna `lido`: o estado de leitura é derivado por pessoa.
  assert.doesNotMatch(read("migrations/0010_notificacao.sql"), /lido INTEGER/);
  assert.match(ts, /LEFT JOIN notificacao_lida x ON/);
  assert.match(ts, /INSERT OR IGNORE INTO notificacao_lida/);
  // Nova tabela => novo bump (senão o D1 existente pula o setup e ela não nasce lá).
  assert.doesNotMatch(ts, /const SCHEMA_VER = "2026-10-27a"/);
  // "all" volta a alcançar a caixa de grupo — marcar é por pessoa, não silencia mais ninguém.
  assert.doesNotMatch(ts, /\? = 'all' AND destino = \?/);
  assert.match(read("public/index.html"), /Marcar todas/);
});

test("Onda 3-B: sino segue o padrão da casca (data-*) e conta não-lidas fora do LIMIT", () => {
  const html = read("public/index.html");
  // O id não vai interpolado dentro de um onclick: o parser decodifica &#39; ANTES de compilar o
  // atributo como JS, então esc() é o escape errado nesse contexto. A casca usa data-* em todo
  // o resto (ver [data-apr]/[data-delandam]); o sino era a única exceção.
  assert.doesNotMatch(html, /onclick="marcarNotif/);
  assert.match(html, /data-notif="/);
  assert.match(html, /querySelectorAll\("\[data-notif\]"\)\.forEach/);
  // NOTIF_ICONE sem cadeia de protótipos: um tipo "constructor"/"toString" despejaria o código
  // da função na caixa em vez de cair no bullet.
  assert.match(html, /const NOTIF_ICONE=Object\.assign\(Object\.create\(null\)/);
  const ts = read("src/index.ts");
  // naoLidas vem de um COUNT próprio: contado sobre as 100 linhas da janela, o badge satura.
  assert.match(ts, /SELECT COUNT\(\*\) qtd FROM notificacao n LEFT JOIN notificacao_lida/);
  assert.doesNotMatch(ts, /notificacoes\.reduce/);
});

test("Workers AI: nenhum modelo descontinuado em 2026-05-30 (triagem do Brief e conciliação)", () => {
  const ts = read("src/index.ts");
  // Sem sufixo, o llama-3.1-8b-instruct foi retirado pela Cloudflare: a chamada falha e o
  // triagemIA cai no catch em silêncio (todo item fica A_TRIAR). Só -fast/-lora seguem ativos.
  const usados = [...ts.matchAll(/"(@cf\/[^"]+)"/g)].map((m) => m[1]);
  const descontinuados = ["@cf/meta/llama-3.1-8b-instruct", "@cf/meta/llama-3.1-8b-instruct-awq",
    "@cf/meta/llama-3-8b-instruct", "@cf/meta/llama-3.1-70b-instruct", "@cf/mistral/mistral-7b-instruct-v0.1"];
  assert.deepEqual(usados.filter((m) => descontinuados.includes(m)), []);
  assert.match(ts, /const BRIEF_MODELO = "@cf\/meta\/llama-3\.1-8b-instruct-fast";/);
});
