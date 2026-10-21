import { useEffect, useState } from "react";
import { api, ApiError } from "./api";

function ErroCard({ e }: { e: ApiError }) {
  const login = e.status === 401;
  return <div className="card"><p style={{ margin: "0 0 10px" }}>{e.message}</p><a className={"btn " + (login ? "primary" : "")} href="/">{login ? "Ir para o login do portal" : "Abrir o portal"}</a></div>;
}
const ABAS = ["Daily Brief", "Escritório de IA"] as const;
type Aba = typeof ABAS[number];

export function Inteligencia() {
  const [aba, setAba] = useState<Aba>("Daily Brief");
  return (
    <>
      <nav className="nav" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8, marginBottom: 16, gap: 4 }}>
        {ABAS.map((a) => <button key={a} className="btn" style={a === aba ? { background: "var(--brand-soft)", borderColor: "var(--brand)" } : {}} onClick={() => setAba(a)}>{a}</button>)}
      </nav>
      {aba === "Daily Brief" ? <Brief /> : <Escritorio />}
    </>
  );
}

function Brief() {
  const [j, setJ] = useState<any>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  const [area, setArea] = useState("");
  useEffect(() => { api<any>("brief", area ? { area } : {}).then(setJ).catch((e: unknown) => setErro(e as ApiError)); }, [area]);
  if (erro) return <ErroCard e={erro} />;
  if (!j) return <div className="note">Carregando o radar…</div>;
  const itens: any[] = j.itens || [];
  const areas: [string, string][] = (j.areas || []).map((a: any) => Array.isArray(a) ? a : [a, a]);
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 12px", alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 13 }}>Foco:</span>
        <button className={"btn" + (area === "" ? " primary" : "")} onClick={() => setArea("")}>Todos</button>
        {areas.map(([cod, lbl]) => <button key={cod} className={"btn" + (area === cod ? " primary" : "")} onClick={() => setArea(cod)}>{lbl}</button>)}
      </div>
      {itens.length === 0 ? (
        <div className="note">Nenhum item no radar ainda. As fontes do Daily Brief se cadastram e ativam no portal atual (nascem desligadas). <a href="/#brief">Configurar fontes →</a></div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {itens.map((x: any) => (
            <div key={x.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <span className="pill" style={{ background: "var(--brand-soft)", color: "var(--ok)" }}>{x.categoria || x.tipo}</span>
                {typeof x.score === "number" && <span className="muted" style={{ fontSize: 11.5, fontFamily: "var(--fm)" }}>score {x.score}</span>}
                <span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>{x.data || ""} {x.fonte ? "· " + x.fonte : ""}</span>
              </div>
              <div style={{ fontWeight: 600, marginTop: 6 }}>{x.titulo}</div>
              {x.resumo && <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}>{x.resumo}</div>}
              {x.url && <a className="src" style={{ color: "var(--brand)", display: "inline-block", marginTop: 6, fontSize: 12.5 }} href={x.url} target="_blank" rel="noreferrer">abrir fonte →</a>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Escritorio() {
  const [j, setJ] = useState<any>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  useEffect(() => { api<any>("escritorio").then(setJ).catch((e: unknown) => setErro(e as ApiError)); }, []);
  if (erro) return <ErroCard e={erro} />;
  if (!j) return <div className="note">Carregando o catálogo…</div>;
  const cat: any[] = j.catalogo || [];
  const corTipo = (t: string) => t === "agente" ? "var(--brand)" : t === "skill" ? "var(--warn)" : "var(--muted)";
  return (
    <>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>Agentes, skills e ferramentas da casa — rodam no Claude Code. O catálogo mostra o que existe e como acionar.</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
        {cat.map((c: any, i: number) => (
          <div key={i} className="w span6" style={{ display: "block" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <b style={{ fontFamily: "var(--fm)", fontSize: 13.5 }}>{c.nome}</b>
              <span className="pill" style={{ background: "transparent", color: corTipo(c.tipo), border: "1px solid currentColor" }}>{c.tipo}</span>
            </div>
            <div style={{ fontSize: 13, marginTop: 6 }}>{c.faz}</div>
            {c.disparo && <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{c.disparo}</div>}
          </div>
        ))}
        {cat.length === 0 && <div className="note">Catálogo vazio ou sem acesso.</div>}
      </div>
    </>
  );
}
