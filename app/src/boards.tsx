import { useEffect, useState } from "react";
import { api, ApiError, MACRO, faseDeSt, type CrmResp, type Deal, type StateResp, type Proj } from "./api";
import { Board, type Coluna } from "./kanban";

function ErroCard({ e }: { e: ApiError }) {
  const login = e.status === 401;
  return (
    <div className="card">
      <p style={{ margin: "0 0 10px" }}>{e.message}</p>
      <a className={"btn " + (login ? "primary" : "")} href="/">{login ? "Ir para o login do portal" : "Abrir o portal"}</a>
    </div>
  );
}

// -------- Pipeline comercial: deals por macro-fase, arrastáveis (crmDealStage) --------
type DealItem = Deal & { col: string };

export function PipelineBoard() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [podeGerir, setPodeGerir] = useState(false);
  const [erro, setErro] = useState<ApiError | null>(null);
  const [msg, setMsg] = useState("");

  const carregar = () => {
    api<CrmResp>("crm").then((r) => { setDeals(r.deals || []); setPodeGerir(!!r.podeGerir); })
      .catch((e: unknown) => setErro(e as ApiError));
  };
  useEffect(() => { carregar(); }, []);

  if (erro) return <ErroCard e={erro} />;
  if (!deals) return <div className="note">Carregando o pipeline…</div>;

  const colunas: Coluna[] = MACRO.map((m) => ({ id: m.id, label: m.label }));
  const itens: DealItem[] = deals
    .map((d) => ({ ...d, col: faseDeSt(d.st) || "" }))
    .filter((d) => d.col);
  const candidatos = deals.filter((d) => faseDeSt(d.st) == null).length;

  const onMove = (id: string, col: string) => {
    const base = MACRO.find((m) => m.id === col)?.base ?? 0;
    const antes = deals;
    setDeals((ds) => (ds || []).map((d) => (d.id === id ? { ...d, st: base } : d)));
    setMsg("Movendo…");
    api("crmDealStage", { id, st: base }).then(() => setMsg("Movido."))
      .catch((e: ApiError) => { setDeals(antes); setMsg(e.message || "Erro ao mover; desfeito."); });
  };

  return (
    <>
      <p className="muted" style={{ fontSize: 13.5, margin: "0 0 10px" }}>
        {podeGerir ? "Arraste os cartões entre as fases para mover o negócio no funil." : "Visão do funil (sem permissão para mover)."}
        {candidatos > 0 ? ` · ${candidatos} lead(s) candidato(s) ainda fora do funil.` : ""}
        {msg ? <b style={{ marginLeft: 8 }}>{msg}</b> : null}
      </p>
      <Board<DealItem>
        colunas={colunas}
        itens={itens}
        podeMover={podeGerir}
        onMove={onMove}
        renderCard={(d) => (
          <>
            <div className="kt">{d.co || "(sem nome)"}</div>
            <div className="km">
              {d.owner ? <span>{d.owner}</span> : null}
              {d.pri ? <span className="ktag" style={{ color: d.pri === "Alta" ? "var(--crit)" : d.pri === "Média" ? "var(--warn)" : "var(--muted)" }}>{d.pri}</span> : null}
              {d.temp ? <span className="ktag" style={{ color: "var(--muted)" }}>{d.temp}</span> : null}
              {d.city ? <span>{d.city}</span> : null}
            </div>
          </>
        )}
      />
    </>
  );
}

// -------- Carteira de projetos por status, arrastável (setproj) --------
const STATUS_COLS: Coluna[] = [
  { id: "A INICIAR", label: "A iniciar" },
  { id: "EM ANDAMENTO", label: "Em andamento" },
  { id: "EM ESPERA", label: "Em espera" },
  { id: "CONCLUÍDO", label: "Concluído" },
  { id: "CANCELADO", label: "Cancelado" },
];
type ProjItem = { id: string; col: string; projeto: string; cliente?: string };

export function ProjetosBoard({ proj, coord }: { proj: Proj[]; coord: boolean }) {
  const [lista, setLista] = useState<Proj[]>(proj);
  const [msg, setMsg] = useState("");
  useEffect(() => setLista(proj), [proj]);

  const itens: ProjItem[] = lista.map((p) => ({ id: p.cc, col: String(p.status || "A INICIAR").toUpperCase(), projeto: p.projeto, cliente: p.cliente }));

  const onMove = (cc: string, col: string) => {
    const antes = lista;
    setLista((ls) => ls.map((p) => (p.cc === cc ? { ...p, status: col } : p)));
    setMsg("Salvando…");
    api("setproj", { cc, status: col }).then(() => setMsg("Status atualizado."))
      .catch((e: ApiError) => { setLista(antes); setMsg(e.message || "Erro; desfeito."); });
  };

  return (
    <>
      <p className="muted" style={{ fontSize: 13.5, margin: "0 0 10px" }}>
        {coord ? "Arraste um projeto para mudar o status." : "Visão por status (só a coordenação muda arrastando)."}
        {msg ? <b style={{ marginLeft: 8 }}>{msg}</b> : null}
      </p>
      <Board<ProjItem>
        colunas={STATUS_COLS}
        itens={itens}
        podeMover={coord}
        onMove={onMove}
        renderCard={(p) => (
          <a href={"#/projetos/" + encodeURIComponent(p.id)} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="kt">{p.projeto}</div>
            <div className="km"><span style={{ fontFamily: "var(--fm)" }}>{p.id}</span>{p.cliente ? <span>· {p.cliente}</span> : null}</div>
          </a>
        )}
      />
    </>
  );
}

// Carrega o estado e entrega o quadro de projetos (usado na área Projetos, modo "Quadro").
export function ProjetosBoardLoader() {
  const [st, setSt] = useState<StateResp | null>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  useEffect(() => {
    api<StateResp>("state").then(setSt).catch((e: unknown) => setErro(e as ApiError));
  }, []);
  if (erro) return <ErroCard e={erro} />;
  if (!st) return <div className="note">Carregando o quadro…</div>;
  const proj = (st.proj || []).filter((p) => (p.registro || "ATIVO") === "ATIVO");
  return <ProjetosBoard proj={proj} coord={!!st.coord} />;
}
