import { useEffect, useState } from "react";
import { api, fmtBRL, fmtHoras, ApiError, type StateResp, type Proj, type ProjDetalhe } from "./api";

const ABERTOS = new Set(["A INICIAR", "EM ANDAMENTO", "EM ESPERA"]);
function pillCor(status: string): string {
  const s = (status || "").toUpperCase();
  if (s.includes("CONCLU")) return "var(--ok)";
  if (s.includes("CANCEL")) return "var(--crit)";
  if (s.includes("ANDAMENTO")) return "var(--brand)";
  return "var(--muted)";
}
function Pill({ status }: { status: string }) {
  return <span className="pill" style={{ background: "transparent", color: pillCor(status), border: "1px solid currentColor" }}>{status || "—"}</span>;
}
function ErroCard({ e }: { e: ApiError }) {
  const login = e.status === 401;
  return (
    <div className="card">
      <p style={{ margin: "0 0 10px" }}>{e.message}</p>
      <a className={"btn " + (login ? "primary" : "")} href="/">{login ? "Ir para o login do portal" : "Abrir o portal"}</a>
    </div>
  );
}

// -------- Carteira: lista de projetos, cada um com endereço próprio (#/projetos/<cc>) --------
export function Carteira() {
  const [proj, setProj] = useState<Proj[] | null>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  const [q, setQ] = useState("");
  const [soAbertos, setSoAbertos] = useState(true);

  useEffect(() => {
    let vivo = true;
    api<StateResp>("state").then((s) => { if (vivo) setProj((s.proj || []).filter((p) => (p.registro || "ATIVO") === "ATIVO")); })
      .catch((e: unknown) => { if (vivo) setErro(e as ApiError); });
    return () => { vivo = false; };
  }, []);

  if (erro) return <ErroCard e={erro} />;
  if (!proj) return <div className="note">Carregando a carteira…</div>;

  const t = q.trim().toLowerCase();
  const lista = proj
    .filter((p) => !soAbertos || ABERTOS.has(String(p.status || "").toUpperCase()))
    .filter((p) => !t || (p.projeto + " " + p.cc + " " + (p.cliente || "")).toLowerCase().includes(t))
    .sort((a, b) => String(a.projeto).localeCompare(String(b.projeto)));

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 12px" }}>
        <input className="btn" style={{ flex: 1, minWidth: 180 }} placeholder="Buscar projeto, código ou cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="btn" style={{ display: "inline-flex", gap: 7, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={soAbertos} onChange={(e) => setSoAbertos(e.target.checked)} /> só abertos
        </label>
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ background: "var(--sunk)" }}>
            <th style={th}>Projeto</th><th style={th}>Centro de custo</th><th style={th}>Cliente</th><th style={th}>Situação</th>
          </tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.cc} style={{ borderTop: "1px solid var(--line)", cursor: "pointer" }}
                  onClick={() => { location.hash = "#/projetos/" + encodeURIComponent(p.cc); }}>
                <td style={{ ...td, fontWeight: 600 }}>{p.projeto}</td>
                <td style={{ ...td, fontFamily: "var(--fm)", fontSize: 12.5 }}>{p.cc}</td>
                <td style={td}>{p.cliente || "—"}</td>
                <td style={td}><Pill status={String(p.status || "")} /></td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td style={td} colSpan={4}><span className="muted">Nenhum projeto no filtro.</span></td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>{lista.length} projeto(s). Clique para abrir o Projeto 360.</p>
    </>
  );
}
const th: React.CSSProperties = { textAlign: "left", padding: "9px 12px", font: "600 11.5px var(--fm)", letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" };
const td: React.CSSProperties = { padding: "9px 12px" };

// -------- Projeto 360: abas Visão / Equipe e horas / Entregáveis / Financeiro / Documentos / Histórico --------
const ABAS = ["Visão", "Equipe e horas", "Entregáveis", "Financeiro", "Documentos", "Histórico"] as const;
type Aba = typeof ABAS[number];

export function Projeto360({ cc }: { cc: string }) {
  const [j, setJ] = useState<ProjDetalhe | null>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  const [aba, setAba] = useState<Aba>("Visão");

  useEffect(() => {
    let vivo = true; setJ(null); setErro(null);
    api<ProjDetalhe>("projdetalhe", { cc }).then((r) => { if (vivo) setJ(r); })
      .catch((e: unknown) => { if (vivo) setErro(e as ApiError); });
    return () => { vivo = false; };
  }, [cc]);

  if (erro) return (
    <>
      <a className="btn" href="#/projetos" style={{ marginBottom: 12 }}>← Carteira</a>
      <ErroCard e={erro} />
    </>
  );
  if (!j) return <div className="note">Carregando o projeto {cc}…</div>;

  const abas = ABAS.filter((a) => a !== "Financeiro" || j.podeFin);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <a className="btn" href="#/projetos">← Carteira</a>
        <Pill status={j.proj.status} />
        <span className="muted" style={{ fontFamily: "var(--fm)", fontSize: 12.5 }}>{j.proj.cc}</span>
      </div>
      <h2 style={{ margin: "6px 0 2px", fontSize: 20 }}>{j.proj.projeto}</h2>
      <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{[j.proj.cliente, j.proj.tipo, j.proj.subtipo].filter(Boolean).join(" · ") || "—"}</div>

      <nav className="nav" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8, marginBottom: 16, gap: 4 }}>
        {abas.map((a) => (
          <button key={a} className="btn" style={a === aba ? { background: "var(--brand-soft)", borderColor: "var(--brand)" } : {}} onClick={() => setAba(a)}>{a}</button>
        ))}
      </nav>

      {aba === "Visão" && <AbaVisao j={j} />}
      {aba === "Equipe e horas" && <AbaEquipe j={j} />}
      {aba === "Entregáveis" && <AbaEntregaveis j={j} />}
      {aba === "Financeiro" && j.podeFin && <AbaFinanceiro j={j} />}
      {aba === "Documentos" && <AbaDocumentos />}
      {aba === "Histórico" && <AbaHistorico j={j} />}
    </>
  );
}

function Prog({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div className="bar" style={{ flex: 1 }}><i style={{ width: p + "%", background: "var(--brand)" }} /></div>
      <b style={{ fontVariantNumeric: "tabular-nums", minWidth: 42, textAlign: "right" }}>{p}%</b>
    </div>
  );
}
function Linha({ k, v }: { k: string; v: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--line)", fontSize: 14 }}><span className="muted">{k}</span><span style={{ fontWeight: 500 }}>{v || "—"}</span></div>;
}

function AbaVisao({ j }: { j: ProjDetalhe }) {
  const et = j.etapa; const x = j.projx; const h = j.horas;
  const prog = et.progressoDerivado != null ? et.progressoDerivado : x.progresso;
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
      <div className="w span6" style={{ display: "block" }}>
        <div className="wh">Progresso</div>
        <div style={{ marginTop: 8 }}><Prog pct={prog} /></div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {et.progressoDerivado != null ? `derivado dos marcos (${et.atual}/${et.total})` : "informado manualmente"}
          {et.divergente ? <span style={{ color: "var(--crit)" }}> · campo manual diz {x.progresso}%</span> : null}
        </div>
        <div style={{ marginTop: 10 }}>
          <Linha k="Responsável" v={x.resp} /><Linha k="Setor" v={x.setor} />
          <Linha k="Prioridade (1–100)" v={x.prioridade} />
        </div>
      </div>
      <div className="w span6" style={{ display: "block" }}>
        <div className="wh">Prazo & esforço</div>
        <div style={{ marginTop: 8 }}>
          <Linha k="Início" v={j.proj.inicio} /><Linha k="Previsto" v={j.proj.previsto} /><Linha k="Fim" v={j.proj.fim} />
          <Linha k="Horas gastas" v={fmtHoras(h.gastas)} />
          <Linha k="Horas previstas" v={h.previstas ? fmtHoras(h.previstas) : "—"} />
          <Linha k="Consumo" v={h.consumo != null ? <span style={{ color: h.estouro ? "var(--crit)" : undefined }}>{h.consumo}%</span> : "—"} />
        </div>
      </div>
      {et.ultimoDetalhe && (
        <div className="w span12" style={{ display: "block" }}>
          <div className="wh">Último avanço{et.ultimaData ? " · " + et.ultimaData : ""}</div>
          <div style={{ fontSize: 14, marginTop: 6 }}>{et.ultimoDetalhe}</div>
        </div>
      )}
    </div>
  );
}

function AbaEquipe({ j }: { j: ProjDetalhe }) {
  return (
    <>
      <div className="card" style={{ padding: 0, overflow: "auto", marginBottom: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ background: "var(--sunk)" }}>
            <th style={th}>Colaborador</th><th style={{ ...th, textAlign: "right" }}>Horas</th>
            {j.podeFin && <th style={{ ...th, textAlign: "right" }}>Custo MO</th>}
            {j.podeFin && <th style={{ ...th, textAlign: "right" }}>Custo real (c/ rateio)</th>}
          </tr></thead>
          <tbody>
            {j.colab.map((c) => (
              <tr key={c.slug} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{c.nome}</td>
                <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtHoras(c.h)}</td>
                {j.podeFin && <td style={{ ...td, textAlign: "right" }}>{c.custo != null ? fmtBRL(c.custo) : "—"}</td>}
                {j.podeFin && <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{c.custoReal != null ? fmtBRL(c.custoReal) : "—"}</td>}
              </tr>
            ))}
            {j.colab.length === 0 && <tr><td style={td} colSpan={4}><span className="muted">Sem horas lançadas neste projeto.</span></td></tr>}
          </tbody>
        </table>
      </div>
      {j.prevf.length > 0 && (
        <div className="card">
          <div className="wh" style={{ marginBottom: 8 }}>Horas previstas por função</div>
          {j.prevf.map((r) => <Linha key={r.func} k={r.func} v={fmtHoras(r.h)} />)}
        </div>
      )}
    </>
  );
}

function AbaEntregaveis({ j }: { j: ProjDetalhe }) {
  const marcos = j.andam.filter((a) => a.detalhe);
  return (
    <>
      <div className="note" style={{ marginBottom: 12 }}>Os produtos finais (pranchas, relatórios, 3D) e sua revisão vigente ficam, por ora, no portal atual (Vitrine / Acervo). Abaixo, os marcos de avanço registrados neste projeto.</div>
      <div className="card">
        <div className="wh" style={{ marginBottom: 8 }}>Marcos de avanço</div>
        {marcos.length === 0 && <span className="muted">Sem marcos registrados.</span>}
        {marcos.map((a) => (
          <div key={a.id} style={{ borderLeft: "2px solid var(--line)", padding: "2px 0 8px 10px", marginBottom: 4 }}>
            <div className="muted" style={{ fontSize: 12 }}>{a.d}{a.total ? ` · etapa ${a.etapa}/${a.total}` : ""}</div>
            <div style={{ fontSize: 14 }}>{a.detalhe}</div>
          </div>
        ))}
      </div>
      <a className="btn" style={{ marginTop: 12 }} href="/#vitrine">Abrir entregáveis no portal →</a>
    </>
  );
}

function AbaFinanceiro({ j }: { j: ProjDetalhe }) {
  const f = j.fin;
  if (!f) return <div className="note">Sem dados financeiros para este projeto.</div>;
  const cor = f.margem < 0 ? "var(--crit)" : "var(--ok)";
  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="wh" style={{ marginBottom: 8 }}>Custo real × valor contratado</div>
        <Linha k="Mão de obra (c/ encargos)" v={fmtBRL(f.moCusto)} />
        {f.imposto > 0 && <Linha k={`Imposto (${f.pct_imposto}% s/ contratado)`} v={fmtBRL(f.imposto)} />}
        {f.consumiveis > 0 && <Linha k="Consumíveis" v={fmtBRL(f.consumiveis)} />}
        {f.terceiros > 0 && <Linha k="Terceiros" v={fmtBRL(f.terceiros)} />}
        {f.outros > 0 && <Linha k="Outros" v={fmtBRL(f.outros)} />}
        {f.rateioFix > 0 && <Linha k="Overhead (rateio por horas)" v={fmtBRL(f.rateioFix)} />}
        <Linha k="Custo real total" v={<b>{fmtBRL(f.custoTotal)}</b>} />
        <Linha k="Valor contratado" v={f.contratado > 0 ? fmtBRL(f.contratado) : "— não informado"} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, paddingTop: 8, marginTop: 4, borderTop: "2px solid " + cor, fontWeight: 700 }}>
          <span>Margem</span><span style={{ color: cor, fontVariantNumeric: "tabular-nums" }}>{f.contratado > 0 ? fmtBRL(f.margem) + (f.margemPct != null ? ` (${f.margemPct}%)` : "") : "—"}</span>
        </div>
      </div>
      {(j.contratos || []).length > 0 && (
        <div className="card">
          <div className="wh" style={{ marginBottom: 8 }}>Contratos & parcelas</div>
          {(j.contratos || []).map((c) => {
            const receb = c.parcelas.filter((p) => p.status === "recebida").reduce((s, p) => s + (Number(p.valor) || 0), 0);
            return (
              <div key={c.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <b style={{ fontSize: 14 }}>{c.titulo || "Contrato " + c.tipo}</b>
                  <span className="pill" style={{ background: c.status === "confirmado" ? "var(--brand-soft)" : "transparent", color: c.status === "confirmado" ? "var(--ok)" : "var(--muted)", border: "1px solid currentColor" }}>{c.status}</span>
                  <span style={{ marginLeft: "auto", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtBRL(c.valor)}</span>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{c.parcelas.length} parcela(s) · recebido {fmtBRL(receb)}</div>
              </div>
            );
          })}
          <a className="btn" href={"/#financeiro"}>Editar no portal →</a>
        </div>
      )}
    </>
  );
}

function AbaDocumentos() {
  return (
    <div className="note">
      Os documentos do projeto (memoriais, pranchas, pacotes de emissão) ficam no portal atual, no Acervo e na pasta do projeto.
      <div style={{ marginTop: 10 }}><a className="btn" href="/#acervo">Abrir o Acervo →</a></div>
    </div>
  );
}

function AbaHistorico({ j }: { j: ProjDetalhe }) {
  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="wh" style={{ marginBottom: 8 }}>Avanços registrados</div>
        {j.andam.length === 0 && <span className="muted">Sem avanços.</span>}
        {j.andam.map((a) => (
          <div key={a.id} style={{ borderLeft: "2px solid var(--line)", padding: "2px 0 8px 10px", marginBottom: 2 }}>
            <div className="muted" style={{ fontSize: 12 }}>{a.d}{a.total ? ` · etapa ${a.etapa}/${a.total}` : ""}{a.slug ? " · " + a.slug : ""}</div>
            {a.detalhe && <div style={{ fontSize: 14 }}>{a.detalhe}</div>}
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead><tr style={{ background: "var(--sunk)" }}>
            <th style={th}>Data</th><th style={th}>Quem</th><th style={{ ...th, textAlign: "right" }}>Horas</th><th style={th}>Atividade</th>
          </tr></thead>
          <tbody>
            {j.lancs.slice(0, 120).map((l, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ ...td, fontFamily: "var(--fm)", fontSize: 12 }}>{l.d}</td>
                <td style={td}>{l.nome}</td>
                <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtHoras(l.h)}</td>
                <td style={td}>{l.t || "—"}</td>
              </tr>
            ))}
            {j.lancs.length === 0 && <tr><td style={td} colSpan={4}><span className="muted">Sem horas lançadas.</span></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
