import { useEffect, useState } from "react";
import { AREAS, parseHash } from "./routes";
import { CommandPalette } from "./palette";
import { Cockpit } from "./cockpit";
import { Carteira, Projeto360 } from "./projetos";
import { PipelineBoard, ProjetosBoardLoader } from "./boards";

export function App() {
  const [{ area: rota, sub }, setLoc] = useState(parseHash());
  const [palOpen, setPalOpen] = useState(false);
  const [projView, setProjView] = useState<"lista" | "quadro">("lista");

  useEffect(() => {
    const onHash = () => setLoc(parseHash());
    window.addEventListener("hashchange", onHash);
    if (!location.hash) location.hash = "#/inicio";
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const area = AREAS.find((a) => a.id === rota) || AREAS[0];

  return (
    <>
      <header className="topbar">
        <span className="brand"><span className="dot">I</span> Portal Intelecto</span>
        <nav className="nav">
          {AREAS.map((a) => (
            <a key={a.id} href={"#/" + a.id} className={a.id === rota ? "on" : ""}>{a.label}</a>
          ))}
        </nav>
        <span className="spacer" />
        <button className="kbtn" onClick={() => setPalOpen(true)} aria-label="Buscar">
          Buscar <kbd>Ctrl K</kbd>
        </button>
      </header>

      <main className="wrap">
        {area.id === "projetos" ? (
          sub
            ? <Projeto360 cc={sub} />
            : (<>
                <h1>{area.label}</h1><p className="sub">{area.resumo}</p>
                <div className="ktoggle" style={{ marginBottom: 14 }}>
                  <button className={projView === "lista" ? "on" : ""} onClick={() => setProjView("lista")}>Lista</button>
                  <button className={projView === "quadro" ? "on" : ""} onClick={() => setProjView("quadro")}>Quadro</button>
                </div>
                {projView === "lista" ? <Carteira /> : <ProjetosBoardLoader />}
              </>)
        ) : area.id === "comercial" ? (
          <><h1>{area.label}</h1><p className="sub">Pipeline comercial — mova os negócios entre as fases.</p><PipelineBoard /></>
        ) : area.id === "inicio" ? (
          <><h1>{area.label}</h1><p className="sub">{area.resumo}</p><Cockpit /></>
        ) : (
          <>
            <h1>{area.label}</h1>
            <p className="sub">{area.resumo}</p>
            <div className="card">
              <p style={{ margin: "0 0 6px" }}>Esta área ainda vive no portal atual.</p>
              <p className="muted" style={{ margin: "0 0 14px", fontSize: 14 }}>
                A casca nova está sendo montada por estrangulamento: cada tela migra uma a uma. Enquanto isso, ela abre no portal de hoje.
              </p>
              <a className="btn primary" href={area.legado || "/"}>Abrir “{area.label}” no portal →</a>
            </div>
          </>
        )}
      </main>

      <CommandPalette open={palOpen} onClose={() => setPalOpen(false)} />
    </>
  );
}
