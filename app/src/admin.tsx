import { useEffect, useState } from "react";
import { api, ApiError } from "./api";

function ErroCard({ e }: { e: ApiError }) {
  const login = e.status === 401;
  const restrito = e.status === 403 || /restrito|direção|Sócios/i.test(e.message);
  return <div className="card"><p style={{ margin: "0 0 10px" }}>{e.message}</p>
    {!restrito && <a className={"btn " + (login ? "primary" : "")} href="/">{login ? "Ir para o login do portal" : "Abrir o portal"}</a>}</div>;
}
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", font: "600 11px var(--fm)", textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)" };
const td: React.CSSProperties = { padding: "8px 10px", verticalAlign: "top" };

// E-06 — painel de feature flags (só o dono recebe o `catalogo`; para os demais o card não aparece).
// Liga/desliga recursos em runtime (sem redeploy); o toggle chama `flagset` (dono + reauth, tratado
// no api.ts). Torna o corte da nova interface reversível por aqui.
function FlagsCard() {
  const [j, setJ] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<any>("flags").then(setJ).catch(() => setJ({})); }, []);
  if (!j || !j.catalogo) return null;
  const cat: Record<string, { desc: string; def: boolean }> = j.catalogo;
  const flags: Record<string, boolean> = j.flags || {};
  const toggle = async (nome: string, on: boolean) => {
    setBusy(nome); setErr(null);
    try { const r = await api<any>("flagset", { flag: nome, on }); setJ({ ...j, flags: r.flags }); }
    catch (e) { setErr((e as ApiError).message); }
    finally { setBusy(null); }
  };
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700 }}>Feature flags</div>
      <div className="muted" style={{ fontSize: 12, margin: "2px 0 8px" }}>Ligam/desligam recursos em runtime, sem redeploy. O corte da nova interface é reversível por aqui.</div>
      {err && <p style={{ color: "var(--crit)", fontSize: 13, margin: "0 0 8px" }}>{err}</p>}
      {Object.keys(cat).map((nome) => {
        const on = !!flags[nome];
        return (
          <div key={nome} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid var(--line)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--fm)", fontSize: 12 }}>{nome}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>{cat[nome].desc}</div>
            </div>
            <button className={"btn " + (on ? "primary" : "")} disabled={busy === nome} onClick={() => toggle(nome, !on)}>
              {busy === nome ? "…" : on ? "Ligada" : "Desligada"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

const sevCor = (s: string) => s === "crit" ? "var(--crit)" : s === "alto" ? "var(--warn)" : "var(--muted)";
const sevNome = (s: string) => s === "crit" ? "Crítico" : s === "alto" ? "Alto" : "Médio";
const atalhoHash: Record<string, string> = {
  "Financeiro › Conciliação": "#/financeiro", "Projeto 360 › Financeiro": "#/projetos", "Projeto 360 › Visão": "#/projetos",
  "Projeto 360 › Contrato": "#/projetos", "Lançar horas": "#/meu", "Financeiro › Custo/hora": "#/financeiro",
  "Financeiro › Capacidade": "#/financeiro", "Comercial › Horas": "#/comercial",
};

export function Administracao() {
  const [j, setJ] = useState<any>(null);
  const [erro, setErro] = useState<ApiError | null>(null);

  useEffect(() => { api<any>("consistencia").then(setJ).catch((e: unknown) => setErro(e as ApiError)); }, []);

  if (erro) return <ErroCard e={erro} />;
  if (!j) return <div className="note">Rodando as regras de consistência…</div>;

  const regras: any[] = j.regras || [];
  const abertas = regras.filter((r: any) => (r.n as number) > 0);
  const ordem: Record<string, number> = { crit: 0, alto: 1, medio: 2 };
  const sorted = regras.slice().sort((a: any, b: any) => {
    const na = (a.n as number) > 0 ? 0 : 1, nb = (b.n as number) > 0 ? 0 : 1;
    return na - nb || (ordem[a.sev] ?? 3) - (ordem[b.sev] ?? 3) || (b.n as number) - (a.n as number);
  });

  return (
    <>
      <FlagsCard />
      <div className="card" style={{ marginBottom: 14, borderColor: j.criticosAbertos > 0 ? "var(--crit)" : "var(--line)" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
          <div><b style={{ fontSize: 20, color: j.criticosAbertos > 0 ? "var(--crit)" : "var(--ok)" }}>{j.criticosAbertos || 0}</b> <span className="muted">regra(s) crítica(s) aberta(s)</span></div>
          <div><b style={{ fontSize: 20 }}>{abertas.length}</b> <span className="muted">de {regras.length} regras com violação</span></div>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Painel de Consistência — mede a integridade entre módulos (fonte única, contrato×caixa, andamento). Recalculado agora{j.em ? " · " + String(j.em).slice(0, 16).replace("T", " ") : ""}.
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "var(--sunk)" }}>
            <th style={th}>Regra</th><th style={th}>Severidade</th><th style={{ ...th, textAlign: "right" }}>Violações</th><th style={th}>Dono</th><th style={th}>Onde corrigir</th>
          </tr></thead>
          <tbody>
            {sorted.map((r: any) => {
              const n = r.n as number;
              const hash = atalhoHash[r.atalho];
              return (
                <tr key={r.rule} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={td}><span style={{ fontFamily: "var(--fm)", fontSize: 11.5, color: "var(--muted)" }}>{r.rule}</span><div style={{ fontWeight: 600 }}>{r.titulo}</div></td>
                  <td style={td}><span className="pill" style={{ background: "transparent", color: sevCor(r.sev), border: "1px solid currentColor" }}>{sevNome(r.sev)}</span></td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: n > 0 ? sevCor(r.sev) : "var(--ok)" }}>{n < 0 ? "—" : n === 0 ? "ok" : n}</td>
                  <td style={td}>{r.dono}</td>
                  <td style={td}>{hash ? <a href={hash}>{r.atalho}</a> : <span className="muted">{r.atalho}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
        "—" = regra cuja tabela ainda não existe nesta instância (entra após o deploy da espinha dorsal). Permissões, auditoria e cadastros seguem no portal atual. <a href="/#permissoes">Abrir Administração no portal →</a>
      </p>
    </>
  );
}
