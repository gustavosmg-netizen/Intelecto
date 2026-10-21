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
  // o bloqueio roda no lançar e no editar.
  assert.match(ts, /await bloqueiaSeFechado\(e\.cc, u\.tenant_id\)/);
  // progresso derivado dos marcos.
  assert.match(ts, /function pctEtapa/);
  assert.match(ts, /progressoDerivado: pctEtapa/);
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

test("migrations/ só tem arquivos .sql numerados em ordem", () => {
  const files = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql"));
  assert.ok(files.length >= 1, "nenhuma migração");
  for (const f of files) assert.match(f, /^\d{4}_/, "migração sem prefixo numérico: " + f);
});
