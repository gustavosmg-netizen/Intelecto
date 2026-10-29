import { useState, type ReactNode } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";

// Board de kanban reutilizável. Colunas são zonas de solta; cartões são arrastáveis. Soltar um
// cartão sobre uma coluna chama onMove(itemId, colId). Sem ordenação intra-coluna (os cartões são
// ordenados pelos dados), o que mantém o arraste simples e robusto no toque e no teclado.
export interface Coluna { id: string; label: string }
export interface Item { id: string; col: string }

function Cartao({ id, children, onOpen }: { id: string; children: ReactNode; onOpen?: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  // O arraste só começa após 6 px (activationConstraint), então um clique simples abre o cartão.
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onOpen}
      onKeyDown={(e) => { if (onOpen && e.key === "Enter") onOpen(); }}
      className="kcard" style={{ opacity: isDragging ? 0.3 : 1, touchAction: "none" }}>
      {children}
    </div>
  );
}
function Coluna({ id, label, count, children }: { id: string; label: string; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={"kcol" + (isOver ? " over" : "")}>
      <div className="kcol-h"><span>{label}</span><span className="kcol-n">{count}</span></div>
      <div className="kcol-b">{children}</div>
    </div>
  );
}

export function Board<T extends Item>({
  colunas, itens, renderCard, onMove, podeMover, onOpen,
}: {
  colunas: Coluna[];
  itens: T[];
  renderCard: (it: T) => ReactNode;
  onMove: (id: string, col: string) => void;
  podeMover: boolean;
  onOpen?: (it: T) => void;
}) {
  const [arrastando, setArrastando] = useState<T | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const porCol = (c: string) => itens.filter((i) => i.col === c);

  const onStart = (e: DragStartEvent) => setArrastando(itens.find((i) => i.id === e.active.id) || null);
  const onEnd = (e: DragEndEvent) => {
    setArrastando(null);
    const { active, over } = e;
    if (!over) return;
    const item = itens.find((i) => i.id === active.id);
    if (item && item.col !== String(over.id)) onMove(String(active.id), String(over.id));
  };

  const grade = (
    <div className="kboard">
      {colunas.map((c) => (
        <Coluna key={c.id} id={c.id} label={c.label} count={porCol(c.id).length}>
          {porCol(c.id).map((it) => podeMover
            ? <Cartao key={it.id} id={it.id} onOpen={onOpen ? () => onOpen(it) : undefined}>{renderCard(it)}</Cartao>
            : <div key={it.id} className="kcard" role={onOpen ? "button" : undefined} tabIndex={onOpen ? 0 : undefined}
                onClick={onOpen ? () => onOpen(it) : undefined}
                onKeyDown={(e) => { if (onOpen && e.key === "Enter") onOpen(it); }}>{renderCard(it)}</div>)}
          {porCol(c.id).length === 0 && <div className="kempty">—</div>}
        </Coluna>
      ))}
    </div>
  );

  if (!podeMover) return grade;

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd}>
      {grade}
      <DragOverlay>{arrastando ? <div className="kcard kdrag">{renderCard(arrastando)}</div> : null}</DragOverlay>
    </DndContext>
  );
}
