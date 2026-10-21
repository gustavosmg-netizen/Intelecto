import { useEffect, useMemo, useRef, useState } from "react";
import { AREAS } from "./routes";

// Paleta de comando (Ctrl/Cmd+K): busca as áreas e navega por teclado. Resolve o "buscar tudo"
// que o portal atual não tem. Fácil estender para ações (lançar horas, abrir projeto) depois.
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const itens = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = AREAS.map((a) => ({ id: a.id, label: a.label, icon: a.icon, hint: a.resumo }));
    if (!t) return base;
    return base.filter((i) => (i.label + " " + i.hint).toLowerCase().includes(t));
  }, [q]);

  useEffect(() => {
    if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);
  useEffect(() => { if (sel >= itens.length) setSel(Math.max(0, itens.length - 1)); }, [itens, sel]);

  if (!open) return null;

  const go = (id: string) => { location.hash = "#/" + id; onClose(); };

  return (
    <div className="pal-ovl" onClick={onClose}>
      <div className="pal" role="dialog" aria-label="Buscar" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          placeholder="Buscar área ou ação…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(itens.length - 1, s + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            else if (e.key === "Enter" && itens[sel]) go(itens[sel].id);
          }}
        />
        <ul>
          {itens.length === 0 && <li className="muted">Nada encontrado.</li>}
          {itens.map((i, idx) => (
            <li key={i.id} className={idx === sel ? "sel" : ""} onMouseEnter={() => setSel(idx)} onClick={() => go(i.id)}>
              <span className="ic">{i.icon}</span>
              <span>{i.label}</span>
              <span className="d">{i.hint}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
