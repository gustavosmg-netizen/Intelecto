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

const inp: React.CSSProperties = { width: "100%", padding: "7px 10px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", color: "var(--ink)", font: "inherit" };
const lbl: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--muted)", margin: "8px 0 3px" };

// -------- Catálogo --------
export function AcademiaCatalogo() {
  const [j, setJ] = useState<any>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  const [novoTit, setNovoTit] = useState("");
  const [msg, setMsg] = useState("");
  const carregar = () => api<any>("academia").then(setJ).catch((e: unknown) => setErro(e as ApiError));
  useEffect(() => { carregar(); }, []);
  if (erro) return <ErroCard e={erro} />;
  if (!j) return <div className="note">Carregando a Academia…</div>;
  const cursos: any[] = j.cursos || []; const certs: any[] = j.certificados || [];
  const criar = () => {
    if (novoTit.trim().length < 3) { setMsg("Dê um título ao curso."); return; }
    setMsg("Criando…");
    api<any>("cursoSet", { titulo: novoTit.trim(), publicado: 0 }).then((r) => { location.hash = "#/academia/" + encodeURIComponent(r.cid); }).catch((e: ApiError) => setMsg(e.message || "Erro"));
  };
  return (
    <>
      {j.coord && (
        <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...inp, flex: 1, minWidth: 180 }} placeholder="Novo curso — título" value={novoTit} onChange={(e) => setNovoTit(e.target.value)} />
          <button className="btn primary" onClick={criar}>+ Novo curso</button>
          {msg && <span style={{ fontSize: 13, color: "var(--muted)" }}>{msg}</span>}
        </div>
      )}
      {cursos.length === 0 ? (
        <div className="note">Nenhum curso {j.coord ? "criado" : "publicado"} ainda.</div>
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
  const [editando, setEditando] = useState(false);

  const carregar = () => api<any>("cursoDetalhe", { cid }).then((r) => {
    setJ(r);
    setSel((s) => s || (r.aulas && r.aulas[0] ? r.aulas[0].id : ""));
  }).catch((e: unknown) => setErro(e as ApiError));
  useEffect(() => { setJ(null); setSel(""); carregar(); }, [cid]);

  if (erro) return (<><a className="btn" href="#/academia" style={{ marginBottom: 12 }}>← Academia</a><ErroCard e={erro} /></>);
  if (!j) return <div className="note">Carregando o curso…</div>;

  if (editando && j.coord) return <CursoEditor j={j} onSair={() => { setEditando(false); carregar(); }} />;

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
        <div><h2 style={{ margin: 0, fontSize: 19 }}>{j.curso.titulo}{j.curso.publicado ? "" : " (rascunho)"}</h2>
          <div className="muted" style={{ fontSize: 12.5 }}>{feitas}/{aulas.length} aulas · {j.curso.carga_h ? j.curso.carga_h + "h" : ""}</div></div>
        {j.coord && <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setEditando(true)}>Editar curso</button>}
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
              {/* D-5 — vídeo self-hosted (R2): o <video> busca pela rota por ID da aula (gated, com Range). */}
              {aula.tipo === "video" && aula.temVideo && (
                <video controls preload="metadata" style={{ width: "100%", maxHeight: 420, borderRadius: 8, background: "#000", marginTop: 10 }} src={"/academia/video/" + encodeURIComponent(aula.id)} />
              )}
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

// -------- Autoria (coordenação) --------
function CursoEditor({ j, onSair }: { j: any; onSair: () => void }) {
  const cid = j.curso.cid;
  const [d, setD] = useState<any>(j);
  const [c, setC] = useState<any>({ ...j.curso });
  const [msg, setMsg] = useState("");
  const [novoMod, setNovoMod] = useState("");
  const [aula, setAula] = useState<any>(null); // aula em edição (ou nova)
  const reload = () => api<any>("cursoDetalhe", { cid }).then((r) => { setD(r); setC({ ...r.curso }); });

  const salvarCurso = () => {
    setMsg("Salvando curso…");
    api("cursoSet", { cid, titulo: c.titulo, resumo: c.resumo, categoria: c.categoria, cargo_alvo: c.cargo_alvo, carga_h: Number(c.carga_h) || 0, ordem: Number(c.ordem) || 0, publicado: c.publicado ? 1 : 0 })
      .then(() => { setMsg("Curso salvo."); return reload(); }).catch((e: ApiError) => setMsg(e.message || "Erro"));
  };
  const addModulo = () => {
    if (novoMod.trim().length < 2) return;
    api("moduloSet", { curso_id: cid, titulo: novoMod.trim(), ordem: (d.modulos || []).length }).then(() => { setNovoMod(""); return reload(); }).catch((e: ApiError) => setMsg(e.message || "Erro"));
  };
  const salvarAula = () => {
    if (!aula || String(aula.titulo || "").trim().length < 2) { setMsg("Dê um título à aula."); return; }
    const payload: any = { curso_id: cid, id: aula.id || "", modulo_id: aula.modulo_id || "", titulo: aula.titulo, tipo: aula.tipo, conteudo: aula.conteudo || "", url: aula.url || "", video_key: aula.video_key || "", ordem: Number(aula.ordem) || 0, min_nota: Number(aula.min_nota) || 70 };
    if (aula.tipo === "quiz") payload.quiz = (aula.quiz || []).filter((q: any) => String(q.q || "").trim()).map((q: any) => ({ q: q.q, opc: (q.opc || []).filter((o: string) => String(o).trim()), correta: Number(q.correta) || 0 }));
    setMsg("Salvando aula…");
    api("aulaSet", payload).then(() => { setMsg("Aula salva."); setAula(null); return reload(); }).catch((e: ApiError) => setMsg(e.message || "Erro"));
  };

  const mods: any[] = d.modulos || []; const aulas: any[] = d.aulas || [];
  const novaAula = () => setAula({ titulo: "", tipo: "texto", conteudo: "", url: "", video_key: "", modulo_id: mods[0]?.id || "", ordem: aulas.length, min_nota: 70, quiz: [] });

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <button className="btn" onClick={onSair}>← Voltar ao curso</button>
        <b style={{ fontSize: 16 }}>Autoria — {c.titulo || cid}</b>
        {msg && <span style={{ fontSize: 13, color: /Erro|título/.test(msg) ? "var(--crit)" : "var(--ok)", marginLeft: "auto" }}>{msg}</span>}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(12,1fr)", alignItems: "start" }}>
        <section className="w span6" style={{ display: "block" }}>
          <div className="wh" style={{ marginBottom: 6 }}>Dados do curso</div>
          <label style={lbl}>Título</label><input style={inp} value={c.titulo || ""} onChange={(e) => setC({ ...c, titulo: e.target.value })} />
          <label style={lbl}>Resumo</label><textarea style={{ ...inp, minHeight: 60 }} value={c.resumo || ""} onChange={(e) => setC({ ...c, resumo: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={lbl}>Categoria</label><input style={inp} value={c.categoria || ""} onChange={(e) => setC({ ...c, categoria: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Cargo-alvo</label><input style={inp} value={c.cargo_alvo || ""} onChange={(e) => setC({ ...c, cargo_alvo: e.target.value })} /></div>
            <div style={{ maxWidth: 90 }}><label style={lbl}>Carga (h)</label><input style={inp} type="number" min="0" step="0.5" value={c.carga_h || 0} onChange={(e) => setC({ ...c, carga_h: e.target.value })} /></div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 14 }}>
            <input type="checkbox" checked={!!c.publicado} onChange={(e) => setC({ ...c, publicado: e.target.checked })} /> Publicado (visível para a equipe)
          </label>
          <button className="btn primary" style={{ marginTop: 10 }} onClick={salvarCurso}>Salvar curso</button>

          <div className="wh" style={{ margin: "18px 0 6px" }}>Módulos</div>
          {mods.map((m) => <div key={m.id} style={{ fontSize: 13.5, padding: "3px 0", borderBottom: "1px solid var(--line)" }}>{m.titulo}</div>)}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input style={inp} placeholder="Novo módulo" value={novoMod} onChange={(e) => setNovoMod(e.target.value)} />
            <button className="btn" onClick={addModulo}>+ módulo</button>
          </div>
        </section>

        <section className="w span6" style={{ display: "block" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="wh">Aulas ({aulas.length})</div>
            <button className="btn sm" onClick={novaAula}>+ nova aula</button>
          </div>
          {aulas.map((a) => (
            <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
              <span className="muted" style={{ fontSize: 10.5, fontFamily: "var(--fm)", minWidth: 40 }}>{a.tipo}</span>
              <span style={{ flex: 1 }}>{a.titulo}</span>
              <button className="btn sm" onClick={() => setAula({ ...a, quiz: a.quiz || [] })}>editar</button>
            </div>
          ))}

          {aula && (
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{aula.id ? "Editar aula" : "Nova aula"}</div>
              <label style={lbl}>Título</label><input style={inp} value={aula.titulo} onChange={(e) => setAula({ ...aula, titulo: e.target.value })} />
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}><label style={lbl}>Tipo</label>
                  <select style={inp} value={aula.tipo} onChange={(e) => setAula({ ...aula, tipo: e.target.value })}>
                    {["texto", "video", "pdf", "quiz"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                <div style={{ flex: 1 }}><label style={lbl}>Módulo</label>
                  <select style={inp} value={aula.modulo_id} onChange={(e) => setAula({ ...aula, modulo_id: e.target.value })}>
                    <option value="">—</option>{mods.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                  </select></div>
              </div>
              {aula.tipo !== "quiz" && <><label style={lbl}>Conteúdo (texto)</label><textarea style={{ ...inp, minHeight: 70 }} value={aula.conteudo} onChange={(e) => setAula({ ...aula, conteudo: e.target.value })} /></>}
              {(aula.tipo === "video" || aula.tipo === "pdf") && <><label style={lbl}>URL do {aula.tipo} (embed externo)</label><input style={inp} value={aula.url} onChange={(e) => setAula({ ...aula, url: e.target.value })} placeholder="https://… (YouTube, Vimeo, Drive)" /></>}
              {aula.tipo === "video" && <><label style={lbl}>Vídeo hospedado (chave no R2)</label><input style={inp} value={aula.video_key || ""} onChange={(e) => setAula({ ...aula, video_key: e.target.value })} placeholder="ex.: cursos/portal/intro.mp4" /><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>Suba o arquivo ao bucket <code>portal-intelecto-video</code> (ver docs/VIDEO_ACADEMIA.md) e informe a chave. Toca embutido, com seek, servido de forma privada.</div></>}
              {aula.tipo === "quiz" && <QuizBuilder quiz={aula.quiz || []} onChange={(q) => setAula({ ...aula, quiz: q })} />}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn primary" onClick={salvarAula}>Salvar aula</button>
                <button className="btn" onClick={() => setAula(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function QuizBuilder({ quiz, onChange }: { quiz: any[]; onChange: (q: any[]) => void }) {
  const set = (qs: any[]) => onChange(qs);
  const addQ = () => set([...quiz, { q: "", opc: ["", ""], correta: 0 }]);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={lbl as any}>Perguntas</div>
      {quiz.map((q: any, i: number) => (
        <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <input style={inp} placeholder={"Pergunta " + (i + 1)} value={q.q} onChange={(e) => { const n = [...quiz]; n[i] = { ...q, q: e.target.value }; set(n); }} />
          {(q.opc || []).map((o: string, k: number) => (
            <div key={k} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 5 }}>
              <input type="radio" name={"correta-" + i} checked={Number(q.correta) === k} onChange={() => { const n = [...quiz]; n[i] = { ...q, correta: k }; set(n); }} title="correta" />
              <input style={{ ...inp, padding: "5px 8px" }} value={o} placeholder={"Opção " + (k + 1)} onChange={(e) => { const n = [...quiz]; const opc = [...q.opc]; opc[k] = e.target.value; n[i] = { ...q, opc }; set(n); }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="btn sm" onClick={() => { const n = [...quiz]; n[i] = { ...q, opc: [...q.opc, ""] }; set(n); }}>+ opção</button>
            <button className="btn sm" onClick={() => set(quiz.filter((_: any, x: number) => x !== i))}>remover pergunta</button>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Marque o círculo da alternativa correta.</div>
        </div>
      ))}
      <button className="btn sm" onClick={addQ}>+ pergunta</button>
    </div>
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
