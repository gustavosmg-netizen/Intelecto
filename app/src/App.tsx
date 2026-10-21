import { useEffect, useState } from "react";
import { AREAS, rotaAtual } from "./routes";
import { CommandPalette } from "./palette";
import { Cockpit } from "./cockpit";

export function App() {
  const [rota, setRota] = useState(rotaAtual());
  const [palOpen, setPalOpen] = useState(false);

  useEffect(() => {
    const onHash = () => setRota(rotaAtual());
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
        <h1>{area.label}</h1>
        <p className="sub">{area.resumo}</p>

        {area.id === "inicio" ? (
          <Cockpit />
        ) : (
          <div className="card">
            <p style={{ margin: "0 0 6px" }}>Esta área ainda vive no portal atual.</p>
            <p className="muted" style={{ margin: "0 0 14px", fontSize: 14 }}>
              A casca nova está sendo montada por estrangulamento: cada tela migra uma a uma. Enquanto isso, ela abre no portal de hoje.
            </p>
            <a className="btn primary" href={area.legado || "/"}>Abrir “{area.label}” no portal →</a>
          </div>
        )}
      </main>

      <CommandPalette open={palOpen} onClose={() => setPalOpen(false)} />
    </>
  );
}
