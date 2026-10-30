import { useEffect, useState } from "react";
import { api, fmtBRL, fmtHoras, ApiError, type StateResp, type Proj } from "./api";
import { ContasQuadro } from "./fincontas";

function ErroCard({ e }: { e: ApiError }) {
  const login = e.status === 401;
  const restrito = e.status === 403 || /restrito|permiss/i.test(e.message);
  return <div className="card"><p style={{ margin: "0 0 10px" }}>{e.message}</p>
    {!restrito && <a className={"btn " + (login ? "primary" : "")} href="/">{login ? "Ir para o login do portal" : "Abrir o portal"}</a>}</div>;
}
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", font: "600 11px var(--fm)", textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)" };
const td: React.CSSProperties = { padding: "8px 10px" };

const ABAS = ["Resumo", "Contas", "Carteira", "Conciliação"] as const;
type Aba = typeof ABAS[number];

export function Financeiro() {
  const [aba, setAba] = useState<Aba>("Resumo");
  return (
    <>
      <nav className="nav" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8, marginBottom: 16, gap: 4 }}>
        {ABAS.map((a) => <button key={a} className="btn" style={a === aba ? { background: "var(--brand-soft)", borderColor: "var(--brand)" } : {}} onClick={() => setAba(a)}>{a}</button>)}
      </nav>
      {aba === "Resumo" && <Resumo />}
      {aba === "Contas" && <ContasQuadro />}
      {aba === "Carteira" && <CarteiraFin />}
      {aba === "Conciliação" && <Conciliacao />}
      <p className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>
        Edição de custo/hora, custos fixos, capacidade e fluxo de caixa seguem no portal atual. <a href="/#financeiro">Abrir Financeiro completo →</a>
      </p>
    </>
  );
}

function Kpi({ l, v, cor }: { l: string; v: string; cor?: string }) {
  return <div className="w span3" style={{ display: "block", minHeight: 88 }}>
    <div className="wh">{l}</div><div className="big" style={{ color: cor, fontSize: 24 }}>{v}</div></div>;
}

function Resumo() {
  const [j, setJ] = useState<any>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  useEffect(() => { api<any>("resumoExec").then(setJ).catch((e: unknown) => setErro(e as ApiError)); }, []);
  if (erro) return <ErroCard e={erro} />;
  if (!j) return <div className="note">Carregando o resumo…</div>;
  const r = j.resumo || {}; const fin = r.fin || {}; const pipe = r.pipeline || {}; const horas = r.horas || {}; const fx = r.fluxo || {};
  const mCor = (fin.margem || 0) < 0 ? "var(--crit)" : "var(--ok)";
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
      <Kpi l="Contratado (carteira ativa)" v={fmtBRL(fin.contratado || 0)} />
      <Kpi l="Custo real" v={fmtBRL(fin.custoTotal || 0)} />
      <Kpi l="Margem" v={fmtBRL(fin.margem || 0)} cor={mCor} />
      <Kpi l="Margem %" v={fin.margemPct != null ? fin.margemPct + "%" : "—"} cor={mCor} />
      <Kpi l="Projetos (prejuízo)" v={(fin.nProj || 0) + " (" + (fin.nPrej || 0) + ")"} cor={fin.nPrej ? "var(--crit)" : undefined} />
      <Kpi l="Overhead (pool fixos)" v={fmtBRL(fin.overhead || 0)} />
      <Kpi l="Horas apontadas" v={fmtHoras(horas.horasTotais || 0)} />
      <Kpi l="Negócios no pipeline" v={String(pipe.dealsN || 0)} />
      <Kpi l="Pipeline em aberto" v={fmtBRL(pipe.pipeAberto || 0)} />
      <Kpi l="Assinados" v={(pipe.assinN || 0) + " · " + fmtBRL(pipe.assinVal || 0)} />
      <Kpi l="Caixa — saldo realizado" v={fmtBRL(fx.saldoReal || 0)} cor={(fx.saldoReal || 0) < 0 ? "var(--crit)" : "var(--ok)"} />
      <Kpi l="Caixa — saldo previsto" v={fmtBRL(fx.saldoPrev || 0)} cor={(fx.saldoPrev || 0) < 0 ? "var(--crit)" : undefined} />
      {j.ultimoSnapshot && <div className="w span12" style={{ display: "block" }}>
        <div className="muted" style={{ fontSize: 12 }}>Último fechamento materializado: {j.ultimoSnapshot.d} por {j.ultimoSnapshot.autor || "—"}.</div></div>}
    </div>
  );
}

function CarteiraFin() {
  const [j, setJ] = useState<any>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  useEffect(() => { api<any>("financeiro").then(setJ).catch((e: unknown) => setErro(e as ApiError)); }, []);
  if (erro) return <ErroCard e={erro} />;
  if (!j) return <div className="note">Carregando a carteira…</div>;
  const rows: any[] = j.projetos || []; const t = j.total || {};
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)", marginBottom: 12 }}>
        <Kpi l="Contratado" v={fmtBRL(t.contratado || 0)} />
        <Kpi l="Custo real" v={fmtBRL(t.custoTotal || 0)} />
        <Kpi l="Margem" v={fmtBRL(t.margem || 0)} cor={(t.margem || 0) < 0 ? "var(--crit)" : "var(--ok)"} />
        <Kpi l="Imposto padrão" v={(j.impostoPadrao || 0) + "%"} />
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
          <thead><tr style={{ background: "var(--sunk)" }}>
            <th style={th}>Projeto</th><th style={{ ...th, textAlign: "right" }}>Contratado</th><th style={{ ...th, textAlign: "right" }}>MO</th>
            <th style={{ ...th, textAlign: "right" }}>Custo real</th><th style={{ ...th, textAlign: "right" }}>Margem</th><th style={{ ...th, textAlign: "right" }}>%</th>
          </tr></thead>
          <tbody>
            {rows.map((p: any) => {
              const cor = (p.margem || 0) < 0 ? "var(--crit)" : "var(--ok)";
              return <tr key={p.cc} style={{ borderTop: "1px solid var(--line)", cursor: "pointer" }} onClick={() => { location.hash = "#/projetos/" + encodeURIComponent(p.cc); }}>
                <td style={{ ...td, fontWeight: 600 }}>{p.projeto}<div className="muted" style={{ fontFamily: "var(--fm)", fontSize: 11 }}>{p.cc}</div></td>
                <td style={{ ...td, textAlign: "right" }}>{fmtBRL(p.contratado || 0)}</td>
                <td style={{ ...td, textAlign: "right", color: "var(--muted)" }}>{fmtBRL(p.moCusto || 0)}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtBRL(p.custoTotal || 0)}</td>
                <td style={{ ...td, textAlign: "right", color: cor, fontWeight: 600 }}>{fmtBRL(p.margem || 0)}</td>
                <td style={{ ...td, textAlign: "right", color: cor }}>{p.margemPct == null ? "—" : p.margemPct + "%"}</td>
              </tr>;
            })}
            {rows.length === 0 && <tr><td style={td} colSpan={6}><span className="muted">Nenhum projeto com valor contratado informado.</span></td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Ordenado por margem (prejuízo primeiro). Clique para abrir o Projeto 360.</p>
    </>
  );
}

function Conciliacao() {
  const [j, setJ] = useState<any>(null);
  const [proj, setProj] = useState<Proj[]>([]);
  const [erro, setErro] = useState<ApiError | null>(null);
  const [offset, setOffset] = useState(0);
  const [msg, setMsg] = useState("");
  const LIM = 50;

  const carregar = (off: number) => api<any>("conciliacao", { limit: LIM, offset: off }).then(setJ).catch((e: unknown) => setErro(e as ApiError));
  useEffect(() => { carregar(offset); }, [offset]);
  useEffect(() => { api<StateResp>("state").then((s) => setProj((s.proj || []).filter((p) => (p.registro || "ATIVO") === "ATIVO"))).catch(() => {}); }, []);

  if (erro) return <ErroCard e={erro} />;
  if (!j) return <div className="note">Carregando a fila…</div>;
  if (j.total === 0) return <div className="card"><p style={{ margin: 0 }}>✅ Todos os movimentos de caixa têm centro de custo.</p></div>;

  const opts = proj.map((p) => [p.cc, p.cc + " — " + (p.cliente || p.projeto || "")] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]));
  const atribuir = (id: string, cc: string) => {
    if (!cc) return; setMsg("Conciliando…");
    api("fluxoCc", { id, cc }).then(() => { setMsg("Conciliado."); return carregar(offset); }).catch((e: ApiError) => setMsg(e.message || "Erro"));
  };
  const ini = j.offset + 1, fim = Math.min(j.offset + LIM, j.total);

  return (
    <>
      <div className="card" style={{ marginBottom: 10, borderColor: "var(--crit)" }}>
        <b>{j.total}</b> movimento(s) de caixa sem centro de custo · <span className="muted">{fmtBRL(j.valorPendente || 0)} a conciliar</span>
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "var(--sunk)" }}>
            <th style={th}>Data</th><th style={th}>Descrição</th><th style={{ ...th, textAlign: "right" }}>Valor</th><th style={th}>Centro de custo</th>
          </tr></thead>
          <tbody>
            {(j.fila || []).map((x: any) => {
              const cor = x.tipo === "entrada" ? "var(--ok)" : "var(--crit)";
              return <tr key={x.id} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ ...td, fontFamily: "var(--fm)", fontSize: 12 }}>{x.data_real || x.data_prev || "—"}</td>
                <td style={td}>{x.descricao}{x.categoria ? <span className="muted" style={{ fontSize: 11 }}> · {x.categoria}</span> : null}</td>
                <td style={{ ...td, textAlign: "right", color: cor, fontVariantNumeric: "tabular-nums" }}>{x.tipo === "entrada" ? "+" : "−"}{fmtBRL(x.valor || 0)}</td>
                <td style={td}>
                  <select className="btn" style={{ padding: "5px 8px" }} defaultValue="" onChange={(e) => atribuir(x.id, e.target.value)}>
                    <option value="">— escolher —</option>
                    {opts.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
                  </select>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, fontSize: 13 }}>
        <span className="muted">{ini}–{fim} de {j.total} {msg ? <b style={{ marginLeft: 8, color: "var(--ink)" }}>{msg}</b> : null}</span>
        <span>
          <button className="btn" disabled={j.offset <= 0} onClick={() => setOffset(Math.max(0, offset - LIM))}>← anteriores</button>{" "}
          <button className="btn" disabled={!j.temMais} onClick={() => setOffset(offset + LIM)}>próximos →</button>
        </span>
      </div>
    </>
  );
}
