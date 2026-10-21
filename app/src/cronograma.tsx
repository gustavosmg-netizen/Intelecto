import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type StateResp, type Proj } from "./api";

// Cronograma (gantt) com ARRASTE DE PRAZO. Arrastar o corpo da barra desloca início e previsto
// juntos; as bordas mudam só uma das datas. A mudança vai por setproj {cc, inicio?, previsto?},
// que é AUDITADA no servidor (alterado_por/em + trilha `projeto_gestao`). Só a coordenação arrasta.

const DAY = 86400000;
const PXD = 5; // pixels por dia
const toDays = (s?: string): number | null => (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) ? Math.floor(Date.parse(s + "T00:00:00Z") / DAY) : null;
const fromDays = (d: number): string => new Date(d * DAY).toISOString().slice(0, 10);
const hoje = Math.floor(Date.now() / DAY);

interface Barra { cc: string; projeto: string; ini: number; fim: number }
type Modo = "move" | "ini" | "fim";

function ErroCard({ e }: { e: ApiError }) {
  const login = e.status === 401;
  return <div className="card"><p style={{ margin: "0 0 10px" }}>{e.message}</p><a className={"btn " + (login ? "primary" : "")} href="/">{login ? "Ir para o login do portal" : "Abrir o portal"}</a></div>;
}

export function CronogramaLoader() {
  const [st, setSt] = useState<StateResp | null>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  useEffect(() => { api<StateResp>("state").then(setSt).catch((e: unknown) => setErro(e as ApiError)); }, []);
  if (erro) return <ErroCard e={erro} />;
  if (!st) return <div className="note">Carregando o cronograma…</div>;
  const proj = (st.proj || []).filter((p) => (p.registro || "ATIVO") === "ATIVO");
  return <Cronograma proj={proj} coord={!!st.coord} />;
}

export function Cronograma({ proj, coord }: { proj: Proj[]; coord: boolean }) {
  // barras: projetos com início e previsto válidos; previsto >= início.
  const [barras, setBarras] = useState<Barra[]>([]);
  const [msg, setMsg] = useState("");
  const drag = useRef<{ cc: string; modo: Modo; x0: number; ini0: number; fim0: number } | null>(null);
  const semData = useMemo(() => proj.filter((p) => toDays((p as any).inicio) == null || toDays((p as any).previsto) == null), [proj]);

  useEffect(() => {
    const bs: Barra[] = [];
    for (const p of proj) {
      const ini = toDays((p as any).inicio); const fim = toDays((p as any).previsto);
      if (ini != null && fim != null) bs.push({ cc: p.cc, projeto: p.projeto, ini, fim: Math.max(fim, ini) });
    }
    bs.sort((a, b) => a.ini - b.ini);
    setBarras(bs);
  }, [proj]);

  const win = useMemo(() => {
    if (!barras.length) return { ini: hoje - 30, fim: hoje + 120 };
    let lo = Math.min(...barras.map((b) => b.ini), hoje);
    let hi = Math.max(...barras.map((b) => b.fim), hoje);
    lo -= 10; hi += 20;
    return { ini: lo, fim: hi };
  }, [barras]);
  const totalDias = win.fim - win.ini;
  const largura = totalDias * PXD;
  const xDe = (d: number) => (d - win.ini) * PXD;

  const meses = useMemo(() => {
    const out: { x: number; lbl: string }[] = [];
    const d = new Date(win.ini * DAY); d.setUTCDate(1);
    while (Math.floor(d.getTime() / DAY) <= win.fim) {
      const dd = Math.floor(d.getTime() / DAY);
      out.push({ x: xDe(dd), lbl: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }) });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return out;
  }, [win.ini, win.fim]);

  const onDown = (e: React.PointerEvent, b: Barra, modo: Modo) => {
    if (!coord) return;
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { cc: b.cc, modo, x0: e.clientX, ini0: b.ini, fim0: b.fim };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dd = Math.round((e.clientX - d.x0) / PXD);
    setBarras((bs) => bs.map((b) => {
      if (b.cc !== d.cc) return b;
      if (d.modo === "move") return { ...b, ini: d.ini0 + dd, fim: d.fim0 + dd };
      if (d.modo === "ini") return { ...b, ini: Math.min(d.ini0 + dd, b.fim) };
      return { ...b, fim: Math.max(d.fim0 + dd, b.ini) };
    }));
  };
  const onUp = () => {
    const d = drag.current; if (!d) { return; }
    drag.current = null;
    const b = barras.find((x) => x.cc === d.cc); if (!b) return;
    const mudouIni = b.ini !== d.ini0, mudouFim = b.fim !== d.fim0;
    if (!mudouIni && !mudouFim) return;
    const payload: any = { cc: d.cc };
    if (mudouIni) payload.inicio = fromDays(b.ini);
    if (mudouFim) payload.previsto = fromDays(b.fim);
    setMsg("Salvando prazo…");
    api("setproj", payload).then(() => setMsg("Prazo atualizado (" + (mudouIni ? "início " + fromDays(b.ini) + " " : "") + (mudouFim ? "previsto " + fromDays(b.fim) : "") + ")."))
      .catch((e: ApiError) => {
        setBarras((bs) => bs.map((x) => (x.cc === d.cc ? { ...x, ini: d.ini0, fim: d.fim0 } : x)));
        setMsg(e.message || "Erro ao salvar; desfeito.");
      });
  };

  return (
    <>
      <p className="muted" style={{ fontSize: 13.5, margin: "0 0 10px" }}>
        {coord ? "Arraste a barra para mover o projeto no tempo; as bordas ajustam só o início ou o previsto. A mudança é salva e auditada." : "Linha do tempo dos projetos (só a coordenação ajusta prazos)."}
        {msg ? <b style={{ marginLeft: 8 }}>{msg}</b> : null}
      </p>
      {barras.length === 0 ? (
        <div className="note">Nenhum projeto com início e previsto definidos para montar a linha do tempo.</div>
      ) : (
        <div className="gant">
          <div className="gant-row gant-head">
            <div className="gant-name">Projeto</div>
            <div className="gant-months" style={{ width: largura }}>
              {meses.map((m, i) => <div key={i} className="gant-mo" style={{ left: m.x }}>{m.lbl}</div>)}
            </div>
          </div>
          {barras.map((b) => (
            <div className="gant-row" key={b.cc}>
              <div className="gant-name" title={b.cc + " · " + b.projeto}>{b.projeto}</div>
              <div className="gant-track" style={{ width: largura }} onPointerMove={onMove} onPointerUp={onUp}>
                {meses.map((m, i) => <div key={i} className="gant-grid" style={{ left: m.x }} />)}
                <div className="gant-today" style={{ left: xDe(hoje) }} title="hoje" />
                <div className={"gant-bar" + (coord ? "" : " ro")} style={{ left: xDe(b.ini), width: Math.max(14, (b.fim - b.ini) * PXD) }}
                  onPointerDown={(e) => onDown(e, b, "move")}>
                  {coord && <div className="hdl" onPointerDown={(e) => onDown(e, b, "ini")} title="ajustar início" />}
                  <span className="lbl">{fromDays(b.ini).slice(5)} → {fromDays(b.fim).slice(5)}</span>
                  {coord && <div className="hdl" onPointerDown={(e) => onDown(e, b, "fim")} title="ajustar previsto" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {semData.length > 0 && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          {semData.length} projeto(s) sem início/previsto definidos ficam fora da linha do tempo. Defina as datas no Projeto 360.
        </p>
      )}
    </>
  );
}
