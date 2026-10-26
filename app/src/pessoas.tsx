import { useEffect, useState } from "react";
import { api, ApiError, type StateResp } from "./api";

function ErroCard({ e }: { e: ApiError }) {
  const login = e.status === 401;
  return <div className="card"><p style={{ margin: "0 0 10px" }}>{e.message}</p><a className={"btn " + (login ? "primary" : "")} href="/">{login ? "Ir para o login do portal" : "Abrir o portal"}</a></div>;
}
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", font: "600 11px var(--fm)", textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)" };
const td: React.CSSProperties = { padding: "8px 10px", verticalAlign: "top" };

export function Pessoas() {
  const [st, setSt] = useState<StateResp | null>(null);
  const [cargos, setCargos] = useState<any[] | null>(null);
  const [erro, setErro] = useState<ApiError | null>(null);

  useEffect(() => {
    api<StateResp>("state").then(setSt).catch((e: unknown) => setErro(e as ApiError));
    api<any>("rh").then((r) => setCargos(r.cargos || r.rows || [])).catch(() => setCargos([]));
  }, []);

  if (erro) return <ErroCard e={erro} />;
  if (!st) return <div className="note">Carregando…</div>;

  const membros = (st.membros || []).slice().sort((a, b) => a[1].localeCompare(b[1]));
  const cargoDe = st.cargos || {}; const setorDe = st.setores || {};

  return (
    <>
      <section style={{ marginBottom: 20 }}>
        <div className="wh" style={{ marginBottom: 8 }}>Equipe · {membros.length}</div>
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead><tr style={{ background: "var(--sunk)" }}>
              <th style={th}>Pessoa</th><th style={th}>Cargo</th><th style={th}>Setor</th>
            </tr></thead>
            <tbody>
              {membros.map(([slug, nome]) => (
                <tr key={slug} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{nome}</td>
                  <td style={td}>{cargoDe[slug] || <span className="muted">—</span>}</td>
                  <td style={td}>{setorDe[slug] || <span className="muted">—</span>}</td>
                </tr>
              ))}
              {membros.length === 0 && <tr><td style={td} colSpan={3}><span className="muted">Sem equipe carregada.</span></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="wh" style={{ marginBottom: 8 }}>Catálogo de cargos{cargos ? " · " + cargos.length : ""}</div>
        {!cargos ? <div className="note">Carregando cargos…</div> : cargos.length === 0 ? (
          <div className="note">Catálogo de cargos vazio ou sem acesso. <a href="/#rh">Abrir RH no portal →</a></div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
            {cargos.map((c: any) => (
              <div key={c.cid} className="w span4" style={{ display: "block" }}>
                <div style={{ fontWeight: 600 }}>{c.nome || c.cid}</div>
                <div className="muted" style={{ fontSize: 12 }}>{[c.area, c.vinculo, c.horas_dia ? c.horas_dia + "h/dia" : ""].filter(Boolean).join(" · ")}</div>
                {c.missao && <div style={{ fontSize: 12.5, marginTop: 6 }}>{String(c.missao).slice(0, 160)}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>
        Edição de cargos, capacidade, fichas e rotinas segue no portal atual. <a href="/#rh">Abrir RH completo →</a>
      </p>
    </>
  );
}
