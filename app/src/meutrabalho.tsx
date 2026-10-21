import { useEffect, useState } from "react";
import { api, fmtHoras, ApiError, type StateResp, type Lanc, type Proj } from "./api";

function ErroCard({ e }: { e: ApiError }) {
  const login = e.status === 401;
  return <div className="card"><p style={{ margin: "0 0 10px" }}>{e.message}</p><a className={"btn " + (login ? "primary" : "")} href="/">{login ? "Ir para o login do portal" : "Abrir o portal"}</a></div>;
}
function StatusPill({ s }: { s: string }) {
  const u = (s || "").toUpperCase();
  const cor = u === "APROVADO" || u === "LANÇADO" ? "var(--ok)" : u === "PENDENTE" ? "var(--warn)" : u === "DEVOLVIDO" || u === "REJEITADO" ? "var(--crit)" : "var(--muted)";
  return <span className="pill" style={{ background: "transparent", color: cor, border: "1px solid currentColor" }}>{s || "—"}</span>;
}

const hojeISO = () => new Date().toISOString().slice(0, 10);

export function MeuTrabalho() {
  const [st, setSt] = useState<StateResp | null>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  const [form, setForm] = useState({ d: hojeISO(), cc: "", h: "", t: "" });
  const [msg, setMsg] = useState<{ t: string; err: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = () => api<StateResp>("state").then(setSt).catch((e: unknown) => setErro(e as ApiError));
  useEffect(() => { carregar(); }, []);

  if (erro) return <ErroCard e={erro} />;
  if (!st) return <div className="note">Carregando…</div>;

  const minhas = (st.lanc || []).filter((l: Lanc) => l.slug === st.slug).sort((a, b) => String(b.d).localeCompare(String(a.d)));
  const projs = (st.proj || []).filter((p: Proj) => (p.registro || "ATIVO") === "ATIVO")
    .sort((a, b) => String(a.projeto).localeCompare(String(b.projeto)));

  const enviar = () => {
    setMsg(null);
    const h = Number(String(form.h).replace(",", "."));
    if (!form.cc) { setMsg({ t: "Escolha o centro de custo.", err: true }); return; }
    if (!(h > 0 && h <= 24)) { setMsg({ t: "Horas entre 0,1 e 24.", err: true }); return; }
    if (form.t.trim().length < 3) { setMsg({ t: "Descreva o que foi feito.", err: true }); return; }
    setSalvando(true);
    api("add", { entry: { d: form.d, cc: form.cc, h, t: form.t.trim() } })
      .then(() => { setMsg({ t: "Lançado — fica pendente até a aprovação.", err: false }); setForm((f) => ({ ...f, h: "", t: "" })); return carregar(); })
      .catch((e: ApiError) => setMsg({ t: e.message || "Erro ao lançar.", err: true }))
      .finally(() => setSalvando(false));
  };

  const totalPend = minhas.filter((l) => String(l.s).toUpperCase() === "PENDENTE").reduce((a, l) => a + (Number(l.h) || 0), 0);

  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
      <section className="w span5" style={{ display: "block" }}>
        <div className="wh" style={{ marginBottom: 10 }}>Lançar horas</div>
        <label style={lbl}>Data</label>
        <input style={inp} type="date" value={form.d} max={hojeISO()} onChange={(e) => setForm({ ...form, d: e.target.value })} />
        <label style={lbl}>Centro de custo</label>
        <select style={inp} value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })}>
          <option value="">— escolher projeto —</option>
          {projs.map((p) => <option key={p.cc} value={p.cc}>{p.cc} — {p.projeto}</option>)}
        </select>
        <label style={lbl}>Horas</label>
        <input style={inp} type="number" min="0.1" max="24" step="0.1" value={form.h} onChange={(e) => setForm({ ...form, h: e.target.value })} placeholder="ex.: 4" />
        <label style={lbl}>O que foi feito</label>
        <input style={inp} value={form.t} maxLength={500} onChange={(e) => setForm({ ...form, t: e.target.value })} placeholder="ex.: fechamento do memorial de cálculo" />
        <button className="btn primary" style={{ marginTop: 12 }} disabled={salvando} onClick={enviar}>{salvando ? "Lançando…" : "Lançar"}</button>
        {msg && <p style={{ fontSize: 13, marginTop: 8, color: msg.err ? "var(--crit)" : "var(--ok)" }}>{msg.t}</p>}
        <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Projeto concluído ou cancelado não recebe horas. Reuniões e ausências continuam no portal atual por ora.</p>
      </section>

      <section className="w span7" style={{ display: "block" }}>
        <div className="wh" style={{ marginBottom: 10 }}>Minhas horas <span className="muted" style={{ textTransform: "none", letterSpacing: 0 }}>· {fmtHoras(totalPend)} pendentes</span></div>
        <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "var(--sunk)", position: "sticky", top: 0 }}>
              <th style={th}>Data</th><th style={th}>Projeto</th><th style={{ ...th, textAlign: "right" }}>Horas</th><th style={th}>Situação</th>
            </tr></thead>
            <tbody>
              {minhas.slice(0, 200).map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ ...td, fontFamily: "var(--fm)", fontSize: 12 }}>{l.d}</td>
                  <td style={td}><div style={{ fontFamily: "var(--fm)", fontSize: 11.5 }}>{l.cc}</div><div style={{ fontSize: 12 }}>{l.t || "—"}</div></td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtHoras(l.h)}</td>
                  <td style={td}><StatusPill s={l.s} /></td>
                </tr>
              ))}
              {minhas.length === 0 && <tr><td style={td} colSpan={4}><span className="muted">Nenhuma hora lançada ainda.</span></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
const lbl: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--muted)", margin: "8px 0 3px" };
const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", color: "var(--ink)", font: "inherit" };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", font: "600 11px var(--fm)", textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)" };
const td: React.CSSProperties = { padding: "7px 10px", verticalAlign: "top" };
