import { useEffect, useState } from "react";
import { api, ApiError } from "./api";

function ErroCard({ e }: { e: ApiError }) {
  const login = e.status === 401;
  return <div className="card"><p style={{ margin: "0 0 10px" }}>{e.message}</p><a className={"btn " + (login ? "primary" : "")} href="/">{login ? "Ir para o login do portal" : "Abrir o portal"}</a></div>;
}
function Ring({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ width: 46, height: 46, borderRadius: "50%", background: `conic-gradient(var(--brand) ${p * 3.6}deg, var(--sunk) 0)`, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", font: "700 11px var(--fm)" }}>{p}%</div>
    </div>
  );
}

// -------- Catálogo --------
export function AcademiaCatalogo() {
  const [j, setJ] = useState<any>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  useEffect(() => { api<any>("academia").then(setJ).catch((e: unknown) => setErro(e as ApiError)); }, []);
  if (erro) return <ErroCard e={erro} />;
  if (!j) return <div className="note">Carregando a Academia…</div>;
  const cursos: any[] = j.cursos || []; const certs: any[] = j.certificados || [];
  return (
    <>
      {cursos.length === 0 ? (
        <div className="note">Nenhum curso publicado ainda.{j.coord ? " Crie o primeiro no portal ou aqui (em breve)." : ""}</div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
          {cursos.map((c: any) => (
            <a key={c.cid} className="w span4" href={"#/academia/" + encodeURIComponent(c.cid)} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Ring pct={c.pct} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{c.titulo}{c.publicado ? "" : " (rascunho)"}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{[c.categoria, c.carga_h ? c.carga_h + "h" : "", c.totalAulas + " aula(s)"].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
              {c.resumo && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>{String(c.resumo).slice(0, 150)}</div>}
              <div className="src" style={{ marginTop: "auto", paddingTop: 8, color: "var(--brand)" }}>
                {c.concluido ? "✓ concluído — rever" : c.matriculado ? "continuar →" : "começar →"}
              </div>
            </a>
          ))}
        </div>
      )}
      {certs.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <div className="wh" style={{ marginBottom: 8 }}>Meus certificados</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
            {certs.map((c: any) => (
              <div key={c.curso_id} className="w span4" style={{ display: "block" }}>
                <div style={{ fontWeight: 600 }}>🎓 {c.titulo}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{c.carga_h ? c.carga_h + "h · " : ""}emitido {String(c.emitido || "").slice(0, 10)}</div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Os certificados entram na sua ficha como treinamentos.</p>
        </section>
      )}
    </>
  );
}

// -------- Player do curso --------
export function CursoPlayer({ cid }: { cid: string }) {
  const [j, setJ] = useState<any>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  const [sel, setSel] = useState<string>("");
  const [resp, setResp] = useState<Record<number, number>>({});
  const [msg, setMsg] = useState("");

  const carregar = () => api<any>("cursoDetalhe", { cid }).then((r) => {
    setJ(r);
    setSel((s) => s || (r.aulas && r.aulas[0] ? r.aulas[0].id : ""));
  }).catch((e: unknown) => setErro(e as ApiError));
  useEffect(() => { setJ(null); setSel(""); carregar(); }, [cid]);

  if (erro) return (<><a className="btn" href="#/academia" style={{ marginBottom: 12 }}>← Academia</a><ErroCard e={erro} /></>);
  if (!j) return <div className="note">Carregando o curso…</div>;

  const aulas: any[] = j.aulas || []; const mods: any[] = j.modulos || [];
  const feitas = aulas.filter((a) => a.feito).length;
  const pct = aulas.length ? Math.round((feitas / aulas.length) * 100) : 0;
  const aula = aulas.find((a) => a.id === sel) || aulas[0];

  const concluir = () => {
    if (!aula) return;
    const payload: any = { aula_id: aula.id };
    if (aula.tipo === "quiz") payload.respostas = (aula.quiz || []).map((_: any, i: number) => (resp[i] != null ? resp[i] : -1));
    setMsg("Enviando…");
    api<any>("aulaConcluir", payload).then((r) => {
      if (r.aprovado === false) { setMsg("Nota " + r.nota + "% — precisa de " + r.min + "%. Revise e tente de novo."); return; }
      setMsg(r.concluiuCurso ? "Curso concluído! Certificado emitido." : "Aula concluída.");
      setResp({});
      return carregar();
    }).catch((e: ApiError) => setMsg(e.message || "Erro"));
  };

  const porMod = (mid: string) => aulas.filter((a) => String(a.modulo_id || "") === mid);
  const semMod = aulas.filter((a) => !mods.some((m) => m.id === a.modulo_id));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <a className="btn" href="#/academia">← Academia</a>
        <Ring pct={pct} />
        <div><h2 style={{ margin: 0, fontSize: 19 }}>{j.curso.titulo}</h2>
          <div className="muted" style={{ fontSize: 12.5 }}>{feitas}/{aulas.length} aulas · {j.curso.carga_h ? j.curso.carga_h + "h" : ""}</div></div>
      </div>
      {j.certificado && <div className="card" style={{ margin: "10px 0", borderColor: "var(--brand)", background: "var(--brand-soft)" }}>🎓 Você concluiu este curso — certificado emitido em {String(j.certificado.emitido || "").slice(0, 10)} e registrado na sua ficha.</div>}

      <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)", alignItems: "start" }}>
        <nav className="w span4" style={{ display: "block" }}>
          <div className="wh" style={{ marginBottom: 6 }}>Conteúdo</div>
          {mods.map((m) => (
            <div key={m.id} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{m.titulo}</div>
              {porMod(m.id).map((a) => <AulaLink key={a.id} a={a} sel={sel} onSel={setSel} />)}
            </div>
          ))}
          {semMod.map((a) => <AulaLink key={a.id} a={a} sel={sel} onSel={setSel} />)}
        </nav>

        <section className="w span8" style={{ display: "block" }}>
          {!aula ? <span className="muted">Curso sem aulas.</span> : (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span className="pill" style={{ background: "var(--brand-soft)", color: "var(--ok)" }}>{aula.tipo}</span>
                <b style={{ fontSize: 15 }}>{aula.titulo}</b>
                {aula.feito && <span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>✓ feito{aula.nota != null && aula.tipo === "quiz" ? " · " + aula.nota + "%" : ""}</span>}
              </div>
              {aula.conteudo && <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>{aula.conteudo}</p>}
              {aula.url && aula.tipo !== "quiz" && <a className="btn" href={aula.url} target="_blank" rel="noreferrer">Abrir {aula.tipo} →</a>}

              {aula.tipo === "quiz" && (aula.quiz || []).length > 0 && (
                <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
                  {(aula.quiz as any[]).map((q: any, i: number) => (
                    <div key={i}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{i + 1}. {q.q}</div>
                      <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                        {(q.opc as string[]).map((o: string, k: number) => (
                          <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, cursor: "pointer" }}>
                            <input type="radio" name={"q" + i} checked={resp[i] === k} onChange={() => setResp((r) => ({ ...r, [i]: k }))} /> {o}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
                <button className="btn primary" onClick={concluir}>{aula.tipo === "quiz" ? "Enviar respostas" : aula.feito ? "Marcar como revisada" : "Concluir aula"}</button>
                {msg && <span style={{ fontSize: 13, color: /precisa|Erro/.test(msg) ? "var(--crit)" : "var(--ok)" }}>{msg}</span>}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function AulaLink({ a, sel, onSel }: { a: any; sel: string; onSel: (id: string) => void }) {
  return (
    <button onClick={() => onSel(a.id)} style={{
      display: "flex", gap: 8, alignItems: "center", width: "100%", textAlign: "left", border: 0, cursor: "pointer",
      background: a.id === sel ? "var(--brand-soft)" : "transparent", color: "inherit", padding: "5px 8px", borderRadius: 7, fontSize: 13,
    }}>
      <span style={{ color: a.feito ? "var(--ok)" : "var(--line)" }}>{a.feito ? "✓" : "○"}</span>
      <span style={{ flex: 1 }}>{a.titulo}</span>
      <span className="muted" style={{ fontSize: 10.5, fontFamily: "var(--fm)" }}>{a.tipo}</span>
    </button>
  );
}
