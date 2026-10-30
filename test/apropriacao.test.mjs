// Apropriação de receita recorrente e rateio mensal de fixos — testes de COMPORTAMENTO (node --test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { tipoCc, ccFaturavel, ym, vigenteEm, horasPorMes, rateioFixosMensal, receitaRecorrente, proxMes, situacaoHoras } from "../src/apropriacao.mjs";

test("tipo do CC e faturável (tipo 4 fica fora)", () => {
  assert.equal(tipoCc("1.25.2.3"), 2);
  assert.equal(ccFaturavel("1.25.2.3"), true);
  assert.equal(ccFaturavel("1.1.4.9"), false);
  assert.equal(ccFaturavel("lixo"), false);
});

test("vigência por mês: vazio = aberto; ym aceita data completa", () => {
  assert.equal(ym("2026-03-15"), "2026-03");
  assert.equal(ym("2026-13"), "");
  assert.equal(vigenteEm({ desde: "2026-01", ate: "2026-06" }, "2026-06"), true);
  assert.equal(vigenteEm({ desde: "2026-01", ate: "2026-06" }, "2026-07"), false);
  assert.equal(vigenteEm({}, "2020-01"), true);
  assert.equal(proxMes("2026-12"), "2027-01");
});

const HPM = horasPorMes([
  { cc: "1.2.3.1", mes: "2026-01", h: 30 }, { cc: "1.2.3.2", mes: "2026-01", h: 10 }, { cc: "1.1.4.9", mes: "2026-01", h: 50 },
  { cc: "1.2.3.1", mes: "2026-02", h: 20 },
  { cc: "1.25.2.3", mes: "2026-02", h: 20 },
]);

test("rateio mensal: pool do mês pelas horas faturáveis do mês; fecha 100%", () => {
  const r = rateioFixosMensal([{ valor: 1000, desde: "2026-01" }], HPM, "2026-02");
  // jan: 40 h faturáveis (o 1.1.4.9 não entra) — 750/250; fev: 40 h — 500/500
  assert.deepEqual(r.byCc, { "1.2.3.1": 1250, "1.2.3.2": 250, "1.25.2.3": 500 });
  assert.equal(r.absorvido, 2000);
  const soma = Object.values(r.byCc).reduce((s, v) => s + v, 0);
  assert.equal(Math.round(soma), 2000);
});

test("rateio mensal: respeita vigência, mês de referência e mês sem horas faturáveis", () => {
  const r = rateioFixosMensal([{ valor: 1000, desde: "2026-02", ate: "2026-02" }], HPM, "2026-02");
  assert.equal(r.absorvido, 1000);
  assert.equal(rateioFixosMensal([{ valor: 1000 }], HPM, "2026-01").absorvido, 1000); // fev fora do limite
  const soApoio = horasPorMes([{ cc: "1.1.4.9", mes: "2026-03", h: 10 }]);
  const n = rateioFixosMensal([{ valor: 500 }], soApoio, "2026-03");
  assert.equal(n.naoAbsorvido, 500);
  assert.deepEqual(n.byCc, {});
});

test("recorrente: valor mensal do cliente pelas horas do mês nos projetos dele", () => {
  const cli = { "1.2.3.1": "IQR", "1.2.3.2": "iqr ", "1.25.2.3": "INOVATIVO", "1.1.4.9": "INTELECTO" };
  const r = receitaRecorrente([{ id: "C1", cliente: "IQR", valor_mensal: 8000, desde: "2026-01" }], HPM, cli, "2026-03");
  // jan: 30/10 → 6000/2000; fev: só 1.2.3.1 → 8000; mar: sem horas → não apropriado
  assert.deepEqual(r.byCc, { "1.2.3.1": 14000, "1.2.3.2": 2000 });
  assert.deepEqual(r.porContrato.C1, { apropriado: 16000, naoApropriado: 8000, meses: 3 });
});

test("recorrente: sem receita futura, respeita 'ate' e ignora contrato incompleto", () => {
  const cli = { "1.2.3.1": "IQR" };
  assert.deepEqual(receitaRecorrente([{ id: "C", cliente: "IQR", valor_mensal: 100, desde: "2026-01", ate: "2026-01" }], HPM, cli, "2026-12").porContrato.C, { apropriado: 100, naoApropriado: 0, meses: 1 });
  assert.deepEqual(receitaRecorrente([{ id: "C", cliente: "IQR", valor_mensal: 100, desde: "2027-01" }], HPM, cli, "2026-12").porContrato.C.meses, 0);
  assert.deepEqual(receitaRecorrente([{ id: "C", cliente: "", valor_mensal: 100, desde: "2026-01" }], HPM, cli, "2026-12").byCc, {});
});

test("situacaoHoras: sem previsto é 'sem contrato', nunca estouro", () => {
  assert.deepEqual(situacaoHoras(72, 0), { situacao: "sem_contrato", pct: null });
  assert.deepEqual(situacaoHoras(349, 300), { situacao: "estouro", pct: 116.3 });
  assert.equal(situacaoHoras(86, 100).situacao, "atencao");
  assert.equal(situacaoHoras(10, 100).situacao, "ok");
});

// ---------- Fiação no Worker (asserts de fonte) ----------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { regrasLogica } from "../src/apropriacao.mjs";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = readFileSync(join(root, "src/index.ts"), "utf8");
const bloco = (ini, fim) => ts.slice(ts.indexOf(ini), ts.indexOf(fim, ts.indexOf(ini) + 1));

test("Worker: rateio de fixos é mensal e o recorrente entra no valor contratado (fora do CC guarda-chuva)", () => {
  const rf = bloco("async function rateioFixosCarteira", "\n}\n");
  assert.match(rf, /rateioFixosMensal\(/);
  assert.doesNotMatch(rf, /SUM\(valor\)/); // não soma mais o pool inteiro contra todo o histórico
  const vc = bloco("async function valorContratadoMap", "\n}\n");
  assert.match(vc, /COALESCE\(tipo,'base'\) <> 'recorrente'/);
  assert.match(vc, /receitaRecorrenteMap\(tenant\)/);
});

test("Worker: confirmar contrato não zera valor/título (edição parcial)", () => {
  const b = bloco('if (action === "contratoSet")', 'if (action === "financeiro")');
  assert.match(b, /const pega = \(k: string, def: any\) => \(tem\(k\) \? p\[k\] : \(atual\[k\] \?\? def\)\)/);
  assert.match(b, /const valor = Math\.max\(0, Number\(pega\("valor", 0\)\) \|\| 0\)/);
  assert.match(b, /const titulo = String\(pega\("titulo", ""\)\)/);
  assert.match(b, /tipo !== "recorrente"/);
});

test("Worker: trava de 24 h por pessoa/dia no lançar e no editar; concluído = 100%", () => {
  assert.match(bloco('if (action === "add")', 'if (action === "edit")'), /await checaTotalDia\(u\.slug, e\.d, e\.h, u\.tenant_id\)/);
  assert.match(bloco('if (action === "edit")', 'const st = aprovReq'), /await checaTotalDia\(cur\.slug, e\.d, e\.h, u\.tenant_id, String\(p\.id\)\)/);
  assert.match(bloco('if (action === "setproj")', 'if (setsP.length)'), /if \(status === "CONCLUÍDO"\) await sqlite\.execute\(\{ sql: "UPDATE projx SET progresso = 100/);
});

test("Painel de Consistência: regras C19–C23 com um ? por tenant e fiadas na ação", () => {
  const r = regrasLogica("intelecto");
  assert.deepEqual(r.map((x) => x.rule), ["C19", "C20", "C21", "C22", "C23"]);
  for (const x of r) assert.equal((x.sql.match(/\?/g) || []).length, x.args.length, x.rule);
  assert.match(ts, /\.\.\.regrasLogica\(T\)/);
});

test("Schema: colunas novas no ensureSchema, migração 0015 e SCHEMA_VER", () => {
  const ver = (ts.match(/const SCHEMA_VER = "([^"]+)";/) || [])[1] || "";
  assert.ok(ver >= "2026-10-30a", ver);
  const mig = readFileSync(join(root, "migrations/0015_apropriacao_mensal.sql"), "utf8");
  for (const c of ["cliente", "valor_mensal", "desde", "ate"]) assert.match(mig, new RegExp("ALTER TABLE cc_contrato ADD COLUMN " + c + " "));
  assert.match(mig, /ALTER TABLE custo_fixo ADD COLUMN desde /);
  assert.match(ts, /"valor_mensal REAL DEFAULT 0"/);
});
