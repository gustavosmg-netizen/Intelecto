import { useEffect, useMemo, useState } from "react";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api, derivaKpis, type Kpis, type StateResp, ApiError } from "./api";

const LS_KEY = "ce_app_cockpit_ordem";

interface WidgetDef { id: string; span: string; titulo: string; render: (k: Kpis) => JSX.Element; coordOnly?: boolean }

const fmtH = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " h";

const WIDGETS: WidgetDef[] = [
  { id: "horas", span: "span3", titulo: "Horas efetivas", render: (k) => (
    <><div className="big">{fmtH(k.coord ? k.horasEfetivas : k.horasMinhas)}</div>
      <div className="src">lanc · aprovado/lançado{k.coord ? " · últimos 120 dias + pendentes" : " · suas horas"}</div></>
  ) },
  { id: "projetos", span: "span3", titulo: "Projetos abertos", render: (k) => (
    <><div className="big">{k.projetosAbertos}<small> / {k.projetosTotal}</small></div>
      <div className="src">proj · a iniciar, em andamento, em espera</div></>
  ) },
  { id: "pendentes", span: "span3", titulo: "Horas a aprovar", coordOnly: true, render: (k) => (
    <><div className="big" style={{ color: k.pendentes > 0 ? "var(--warn)" : undefined }}>{k.pendentes}</div>
      <div className="src">lanc · situação PENDENTE</div></>
  ) },
  { id: "atalho-fin", span: "span3", titulo: "Financeiro", coordOnly: true, render: () => (
    <><div style={{ fontSize: 14, lineHeight: 1.5 }}>Conciliação do caixa, contratos e margem por projeto.</div>
      <a className="src" style={{ color: "var(--brand)" }} href="/#financeiro">abrir no portal →</a></>
  ) },
  { id: "consistencia", span: "span6", titulo: "Consistência dos dados", coordOnly: true, render: () => (
    <><div style={{ fontSize: 13.5 }}>O Painel de Consistência (Onda 0) acompanha caixa sem centro de custo, contratos coerentes e andamento divergente.</div>
      <a className="src" style={{ color: "var(--brand)" }} href="/#admin">ver no portal →</a></>
  ) },
  { id: "bemvindo", span: "span6", titulo: "Casca nova", render: (k) => (
    <><div style={{ fontSize: 13.5 }}>Você está na casca nova do portal (Onda 2). Arraste os widgets pelo ⠿ para reorganizar — a ordem fica salva neste navegador. Use <b>Ctrl/Cmd+K</b> para buscar.</div>
      <div className="src">{k.coord ? "visão de gestão" : "sua visão"} · {k.slug}</div></>
  ) },
];

function Widget({ def, kpis }: { def: WidgetDef; kpis: Kpis }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: def.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={"w " + def.span + (isDragging ? " dragging" : "")}>
      <div className="wh">
        <span>{def.titulo}</span>
        <span className="grip" aria-label="Arrastar" {...attributes} {...listeners}>⠿</span>
      </div>
      {def.render(kpis)}
    </div>
  );
}

export function Cockpit() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [erro, setErro] = useState<{ msg: string; login: boolean } | null>(null);
  const [ordem, setOrdem] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let vivo = true;
    api<StateResp>("state").then((s) => { if (vivo) setKpis(derivaKpis(s)); })
      .catch((e: unknown) => {
        if (!vivo) return;
        const ae = e as ApiError;
        setErro({ msg: ae?.message || "Erro ao carregar.", login: ae?.status === 401 });
      });
    return () => { vivo = false; };
  }, []);

  const visiveis = useMemo(() => WIDGETS.filter((w) => !w.coordOnly || (kpis && kpis.coord)), [kpis]);

  useEffect(() => {
    if (!kpis) return;
    let salva: string[] = [];
    try { salva = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (_) { /* ignora */ }
    const ids = visiveis.map((w) => w.id);
    const ord = salva.filter((id) => ids.includes(id));
    for (const id of ids) if (!ord.includes(id)) ord.push(id);
    setOrdem(ord);
  }, [kpis, visiveis]);

  if (erro) {
    return (
      <div className="card">
        <p style={{ margin: "0 0 10px" }}>{erro.msg}</p>
        {erro.login
          ? <a className="btn primary" href="/">Ir para o login do portal</a>
          : <a className="btn" href="/">Abrir o portal</a>}
      </div>
    );
  }
  if (!kpis) return <div className="note">Carregando o seu cockpit…</div>;

  const byId = (id: string) => visiveis.find((w) => w.id === id)!;
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrdem((prev) => {
      const next = arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)));
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch (_) { /* ignora */ }
      return next;
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ordem} strategy={rectSortingStrategy}>
        <div className="grid">
          {ordem.map((id) => <Widget key={id} def={byId(id)} kpis={kpis} />)}
        </div>
      </SortableContext>
    </DndContext>
  );
}
