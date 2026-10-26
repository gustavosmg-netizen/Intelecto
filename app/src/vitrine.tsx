import { useEffect, useState } from "react";
import { api, ApiError } from "./api";

function ErroCard({ e }: { e: ApiError }) {
  const login = e.status === 401;
  return <div className="card"><p style={{ margin: "0 0 10px" }}>{e.message}</p><a className={"btn " + (login ? "primary" : "")} href="/">{login ? "Ir para o login do portal" : "Abrir o portal"}</a></div>;
}

export function Vitrine() {
  const [j, setJ] = useState<any>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  useEffect(() => { api<any>("vitrine").then(setJ).catch((e: unknown) => setErro(e as ApiError)); }, []);
  if (erro) return <ErroCard e={erro} />;
  if (!j) return <div className="note">Carregando a vitrine…</div>;
  const cases: any[] = j.cases || j.casos || [];
  const prodN: Record<string, number> = j.produtos || j.prodN || {};
  return (
    <>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>Cases e trabalhos entregues pela casa — cliente por código de contrato, sem valores. A marca e os ativos ficam em DNA & Ativos, no portal atual.</p>
      {cases.length === 0 ? (
        <div className="note">Nenhum case publicado ainda. A galeria de cases é curada no portal atual. <a href="/#showcase">Abrir Vitrine no portal →</a></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
          {cases.map((c: any) => (
            <div key={c.cid} className="w span4" style={{ display: "block" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <b style={{ fontSize: 14 }}>{c.titulo}</b>
                {c.publicado ? null : <span className="pill" style={{ background: "transparent", color: "var(--muted)", border: "1px solid currentColor" }}>rascunho</span>}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{[c.area, c.cliente_cc].filter(Boolean).join(" · ")}</div>
              {c.resumo && <div style={{ fontSize: 13, marginTop: 6 }}>{String(c.resumo).slice(0, 180)}</div>}
              <div className="src" style={{ marginTop: "auto", paddingTop: 8 }}>{(prodN[c.cid] || 0)} produto(s) final(is)</div>
            </div>
          ))}
        </div>
      )}
      <a className="btn" style={{ marginTop: 12 }} href="/#showcase">Abrir Vitrine completa no portal →</a>
    </>
  );
}
