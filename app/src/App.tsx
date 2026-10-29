import { useEffect, useState } from "react";
import { AREAS, parseHash } from "./routes";
import { CommandPalette } from "./palette";
import { Cockpit } from "./cockpit";
import { Carteira, Projeto360 } from "./projetos";
import { ProjetosBoardLoader } from "./boards";
import { CrmPipeline } from "./crm";
import { CronogramaLoader } from "./cronograma";
import { MeuTrabalho } from "./meutrabalho";
import { Financeiro } from "./financeiro";
import { Pessoas } from "./pessoas";
import { Administracao } from "./admin";
import { Inteligencia } from "./inteligencia";
import { Vitrine } from "./vitrine";
import { AcademiaCatalogo, CursoPlayer } from "./academia";
import { onApiVerChange } from "./api";

export function App() {
  const [{ area: rota, sub }, setLoc] = useState(parseHash());
  const [palOpen, setPalOpen] = useState(false);
  const [projView, setProjView] = useState<"lista" | "quadro" | "cronograma">("lista");
  const [novaVersao, setNovaVersao] = useState(false); // E-06 — contrato de API mudou sob os pés

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

  // E-06 — se o /api passar a responder com outra versão de contrato, a casca está servida do cache
  // antigo: oferece recarregar em vez de seguir chamando um contrato que mudou.
  useEffect(() => { onApiVerChange(() => setNovaVersao(true)); }, []);

  const area = AREAS.find((a) => a.id === rota) || AREAS[0];

  return (
    <>
      {novaVersao && (
        <div role="alert" style={{ background: "#1f7a3d", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
          <span>Uma versão mais nova do portal está disponível.</span>
          <button className="btn" style={{ background: "#fff", color: "#1f7a3d", border: 0, padding: "4px 10px", borderRadius: 6, cursor: "pointer" }} onClick={() => location.reload()}>Recarregar</button>
        </div>
      )}
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
                  <button className={projView === "cronograma" ? "on" : ""} onClick={() => setProjView("cronograma")}>Cronograma</button>
                </div>
                {projView === "lista" ? <Carteira /> : projView === "quadro" ? <ProjetosBoardLoader /> : <CronogramaLoader />}
              </>)
        ) : area.id === "comercial" ? (
          <><h1>{area.label}</h1><p className="sub">Pipeline comercial: filtre, organize com as suas tags e registre cada contato.</p><CrmPipeline /></>
        ) : area.id === "meu" ? (
          <><h1>{area.label}</h1><p className="sub">Lance e acompanhe as suas horas.</p><MeuTrabalho /></>
        ) : area.id === "financeiro" ? (
          <><h1>{area.label}</h1><p className="sub">Resultado por projeto, caixa e conciliação.</p><Financeiro /></>
        ) : area.id === "pessoas" ? (
          <><h1>{area.label}</h1><p className="sub">Equipe e cargos da casa.</p><Pessoas /></>
        ) : area.id === "admin" ? (
          <><h1>{area.label}</h1><p className="sub">Painel de Consistência e administração.</p><Administracao /></>
        ) : area.id === "inteligencia" ? (
          <><h1>{area.label}</h1><p className="sub">Radar de editais e notícias, e o escritório de IA da casa.</p><Inteligencia /></>
        ) : area.id === "vitrine" ? (
          <><h1>{area.label}</h1><p className="sub">Cases e trabalhos entregues pela casa.</p><Vitrine /></>
        ) : area.id === "academia" ? (
          sub
            ? <CursoPlayer cid={sub} />
            : (<><h1>{area.label}</h1><p className="sub">Cursos, trilhas e certificados da casa.</p><AcademiaCatalogo /></>)
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
