import { useEffect, useMemo, useState } from "react";
import { api, ApiError, fmtBRL, type CrmTag } from "./api";
import { Board, type Coluna } from "./kanban";
import { TagChip } from "./crm";
import { CORES_TAG } from "../../src/crm.mjs";
import {
  COLUNAS_FIN, situacaoFluxo, transicaoFin, aplicaFiltroFin, normalizaFiltroFin, filtroFinVazio, type FiltroFin,
} from "../../src/fin.mjs";

// Quadro de contas a pagar e a receber (base: `fluxo`). Arrastar baixa, cancela ou reabre; clicar
// seleciona para as ações em lote (baixar, reabrir, cancelar, categoria, CC, tag). Tags e filtros
// salvos são POR PESSOA; a categoria é da casa. A regra de situação/transição é a do servidor
// (src/fin.mjs). Baixar/reabrir/cancelar pedem a senha de novo (ação sensível, reauth).

interface Fluxo { id: string; tipo: string; categoria: string; descricao: string; cc: string; valor: number; data_prev: string; data_real: string; status: string; origem: string }
interface QuadroResp {
  ok: true; fluxos: Fluxo[]; tags: CrmTag[]; itemTags: Record<string, string[]>; categorias: string[];
  projetos: { cc: string; projeto: string }[]; podeEditar: boolean; eu: string;
}
interface FiltroSalvo { id: string; nome: string; filtro: FiltroFin }
type Item = Fluxo & { col: string };

const hojeIso = () => new Date().toISOString().slice(0, 10);
const VAZIO: FiltroFin = normalizaFiltroFin({});
const POR_COLUNA = 80; // teto de cartões renderizados por coluna (o resto fica no total)
const fmtData = (iso: string) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(2, 4) : "sem data");
const OP_LABEL: Record<string, string> = { baixar: "Baixado", reabrir: "Reaberto", cancelar: "Cancelado", categoria: "Categoria aplicada" };

function Chips({ label, opcoes, sel, onChange }: { label: string; opcoes: { id: string; label: string }[]; sel: string[]; onChange: (v: string[]) => void }) {
  if (!opcoes.length) return null;
  const alterna = (id: string) => onChange(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  return (
    <div className="fgrp" role="group" aria-label={label}>
      <span className="flbl">{label}</span>
      {opcoes.map((o) => (
        <button key={o.id} type="button" className={"chip" + (sel.includes(o.id) ? " on" : "")} aria-pressed={sel.includes(o.id)} onClick={() => alterna(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function ContasQuadro() {
  const [d, setD] = useState<QuadroResp | null>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  const [msg, setMsg] = useState("");
  const [filtro, setFiltro] = useState<FiltroFin>(VAZIO);
  const [salvos, setSalvos] = useState<FiltroSalvo[]>([]);
  const [salvoSel, setSalvoSel] = useState("");
  const [abrirFiltros, setAbrirFiltros] = useState(false);
  const [abrirTags, setAbrirTags] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [cat, setCat] = useState("");
  const [cc, setCc] = useState("");
  const [tagLote, setTagLote] = useState("");
  const [novaTag, setNovaTag] = useState({ nome: "", cor: "azul" });

  const carregar = () => api<QuadroResp>("finQuadro").then(setD).catch((e: unknown) => setErro(e as ApiError));
  const carregarSalvos = () => api<{ filtros: FiltroSalvo[] }>("filtroList", { modulo: "financeiro" }).then((r) => setSalvos(r.filtros || [])).catch(() => setSalvos([]));
  useEffect(() => { carregar(); carregarSalvos(); }, []);

  const hoje = hojeIso();
  const fluxos = d?.fluxos || [];
  const visiveis = useMemo(() => aplicaFiltroFin(fluxos, filtro, { itemTags: d?.itemTags || {}, hoje }), [fluxos, filtro, d, hoje]);

  if (erro) return <div className="card"><p style={{ margin: 0 }}>{erro.message}</p></div>;
  if (!d) return <div className="note">Carregando as contas…</div>;

  const pode = d.podeEditar;
  const set = (patch: Partial<FiltroFin>) => { setFiltro((f) => ({ ...f, ...patch })); setSalvoSel(""); };
  const falha = (e: ApiError) => setMsg(e.message || "Erro.");

  // Totais do recorte (R$ — o Financeiro é o único módulo onde valor circula).
  const soma = (pred: (f: Fluxo) => boolean) => visiveis.filter(pred).reduce((s, f) => s + (Number(f.valor) || 0), 0);
  const aberto = (f: Fluxo) => f.status === "previsto";
  const kReceber = soma((f) => aberto(f) && f.tipo === "entrada");
  const kPagar = soma((f) => aberto(f) && f.tipo === "saida");
  const kVencidoR = soma((f) => situacaoFluxo(f, hoje) === "vencido" && f.tipo === "entrada");
  const kVencidoP = soma((f) => situacaoFluxo(f, hoje) === "vencido" && f.tipo === "saida");

  // Itens por coluna: abertas pela data mais próxima; pagas/canceladas pelas mais recentes.
  const porCol: Record<string, Item[]> = {};
  for (const f of visiveis) { const c = situacaoFluxo(f, hoje); (porCol[c] = porCol[c] || []).push({ ...f, col: c }); }
  const chave = (f: Fluxo) => String(f.data_real || f.data_prev || "");
  let ocultos = 0;
  const itens: Item[] = [];
  for (const c of COLUNAS_FIN) {
    const l = (porCol[c.id] || []).sort((a, b) => (c.id === "realizado" || c.id === "cancelado" ? chave(b).localeCompare(chave(a)) : chave(a).localeCompare(chave(b))));
    ocultos += Math.max(0, l.length - POR_COLUNA);
    itens.push(...l.slice(0, POR_COLUNA));
  }
  const colunas: Coluna[] = COLUNAS_FIN.map((c) => ({ id: c.id, label: c.label }));

  const lote = (op: string, ids: string[], extra: Record<string, unknown> = {}) =>
    api<{ n: number }>("fluxoLote", { op, ids, ...extra })
      .then((r) => { setMsg(OP_LABEL[op] + ": " + r.n + " lançamento(s)."); setSel([]); carregar(); })
      .catch(falha);

  const onMove = (id: string, col: string) => {
    const f = fluxos.find((x) => x.id === id);
    if (!f) return;
    const op = transicaoFin(situacaoFluxo(f, hoje), col);
    if (!op) { setMsg("Entre colunas em aberto a posição vem do vencimento: edite a data no lançamento."); return; }
    lote(op, [id]);
  };
  const alternaSel = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const aplicarSalvo = (id: string) => { setSalvoSel(id); const s = salvos.find((x) => x.id === id); setFiltro(s ? normalizaFiltroFin(s.filtro) : VAZIO); };
  const salvarFiltro = () => {
    const atual = salvos.find((x) => x.id === salvoSel);
    const nome = window.prompt(atual ? "Atualizar o filtro salvo (ou dê outro nome para criar um novo):" : "Nome do filtro:", atual ? atual.nome : "");
    if (!nome) return;
    const id = atual && atual.nome === nome.trim() ? atual.id : "";
    api<{ filtro: FiltroSalvo }>("filtroSet", { modulo: "financeiro", id, nome, filtro })
      .then((r) => { setMsg("Filtro salvo."); carregarSalvos(); setSalvoSel(r.filtro.id); }).catch(falha);
  };
  const excluirFiltro = () => {
    const s = salvos.find((x) => x.id === salvoSel);
    if (!s || !window.confirm("Excluir o filtro “" + s.nome + "”?")) return;
    api("filtroDel", { modulo: "financeiro", id: s.id }).then(() => { setSalvoSel(""); carregarSalvos(); }).catch(falha);
  };
  const criaTag = () => api("finTagSet", novaTag).then(() => { setNovaTag({ ...novaTag, nome: "" }); carregar(); }).catch(falha);
  const excluiTag = (t: CrmTag) => { if (window.confirm("Excluir a tag “" + t.nome + "” de todos os seus lançamentos?")) api("finTagDel", { id: t.id }).then(carregar).catch(falha); };
  const marcaTag = (on: boolean) => api("fluxoTag", { tag: tagLote, ids: sel, on }).then(() => { setMsg((on ? "Tag aplicada" : "Tag removida") + " em " + sel.length + " lançamento(s)."); carregar(); }).catch(falha);
  const defineCc = () => api<{ n: number }>("fluxoCc", { ids: sel, cc }).then((r) => { setMsg("CC " + (cc || "removido") + " em " + r.n + " lançamento(s)."); setSel([]); carregar(); }).catch(falha);

  const nFiltros = (filtro.tipo ? 1 : 0) + filtro.situacoes.length + filtro.ccs.length + filtro.categorias.length + filtro.tags.length + (filtro.de || filtro.ate ? 1 : 0);
  const ccsOpc = [{ id: "(sem CC)", label: "Sem CC" }, ...Array.from(new Set(fluxos.map((f) => f.cc).filter(Boolean))).sort().map((c) => ({ id: c, label: c }))];

  return (
    <>
      <div className="kpis-fin">
        <div className="kfin"><span>A receber em aberto</span><b style={{ color: "var(--ok)" }}>{fmtBRL(kReceber)}</b>{kVencidoR ? <small className="late">{fmtBRL(kVencidoR)} vencido</small> : null}</div>
        <div className="kfin"><span>A pagar em aberto</span><b style={{ color: "var(--crit)" }}>{fmtBRL(kPagar)}</b>{kVencidoP ? <small className="late">{fmtBRL(kVencidoP)} vencido</small> : null}</div>
        <div className="kfin"><span>Saldo previsto do recorte</span><b>{fmtBRL(kReceber - kPagar)}</b></div>
      </div>

      <div className="crm-bar">
        <div className="ktoggle">
          {[["", "Tudo"], ["entrada", "A receber"], ["saida", "A pagar"]].map(([id, l]) => (
            <button key={id} className={filtro.tipo === id ? "on" : ""} onClick={() => set({ tipo: id })}>{l}</button>
          ))}
        </div>
        <input className="inp" type="search" placeholder="Buscar descrição, categoria, CC…" value={filtro.q} onChange={(e) => set({ q: e.target.value })} aria-label="Buscar lançamentos" />
        <button type="button" className={"btn" + (abrirFiltros || nFiltros ? " primary" : "")} onClick={() => setAbrirFiltros((v) => !v)} aria-expanded={abrirFiltros}>Filtros{nFiltros ? " (" + nFiltros + ")" : ""}</button>
        <select className="inp" value={salvoSel} onChange={(e) => aplicarSalvo(e.target.value)} aria-label="Filtros salvos">
          <option value="">Filtros salvos…</option>
          {salvos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <button type="button" className="btn" onClick={salvarFiltro} disabled={filtroFinVazio(filtro)} title="Salvar o filtro atual com um nome (só você vê)">Salvar filtro</button>
        {salvoSel ? <button type="button" className="btn" onClick={excluirFiltro}>Excluir</button> : null}
        {!filtroFinVazio(filtro) ? <button type="button" className="btn" onClick={() => { setFiltro(VAZIO); setSalvoSel(""); }}>Limpar</button> : null}
        <button type="button" className="btn" onClick={() => setAbrirTags((v) => !v)} aria-expanded={abrirTags}>Minhas tags</button>
      </div>

      {abrirFiltros && (
        <div className="card crm-filtros">
          <Chips label="Situação" opcoes={COLUNAS_FIN.map((c) => ({ id: c.id, label: c.label }))} sel={filtro.situacoes} onChange={(v) => set({ situacoes: v })} />
          <Chips label="Categoria" opcoes={d.categorias.map((c) => ({ id: c, label: c }))} sel={filtro.categorias} onChange={(v) => set({ categorias: v })} />
          <Chips label="Centro de custo" opcoes={ccsOpc} sel={filtro.ccs} onChange={(v) => set({ ccs: v })} />
          <Chips label="Minhas tags" opcoes={d.tags.map((t) => ({ id: t.id, label: t.nome }))} sel={filtro.tags} onChange={(v) => set({ tags: v })} />
          <div className="fgrp">
            <span className="flbl">Período</span>
            <input className="inp" type="date" value={filtro.de} onChange={(e) => set({ de: e.target.value })} aria-label="De" />
            <span className="muted">até</span>
            <input className="inp" type="date" value={filtro.ate} onChange={(e) => set({ ate: e.target.value })} aria-label="Até" />
          </div>
        </div>
      )}

      {abrirTags && (
        <div className="card crm-filtros">
          <div className="ktags">
            {d.tags.map((t) => <span key={t.id} className="tagedit"><TagChip tag={t} /><button type="button" className="linkb" onClick={() => excluiTag(t)} aria-label={"Excluir " + t.nome}>excluir</button></span>)}
            {!d.tags.length && <span className="muted" style={{ fontSize: 12.5 }}>Nenhuma tag ainda. Só você vê as suas.</span>}
          </div>
          <div className="row">
            <input className="inp" placeholder="Nova tag" maxLength={30} value={novaTag.nome} onChange={(e) => setNovaTag({ ...novaTag, nome: e.target.value })} aria-label="Nome da nova tag" />
            <select className="inp mini" value={novaTag.cor} onChange={(e) => setNovaTag({ ...novaTag, cor: e.target.value })} aria-label="Cor da nova tag">
              {CORES_TAG.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" className="btn" disabled={!novaTag.nome.trim()} onClick={criaTag}>Criar tag</button>
          </div>
        </div>
      )}

      {sel.length > 0 && (
        <div className="lote-bar" role="region" aria-label="Ações em lote">
          <b>{sel.length} selecionado(s)</b>
          {pode && <>
            <button type="button" className="btn" onClick={() => lote("baixar", sel)}>Baixar</button>
            <button type="button" className="btn" onClick={() => lote("reabrir", sel)}>Reabrir</button>
            <button type="button" className="btn" onClick={() => { if (window.confirm("Cancelar " + sel.length + " lançamento(s)?")) lote("cancelar", sel); }}>Cancelar</button>
            <span className="row">
              <input className="inp" list="fin-cats" placeholder="Categoria" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria para aplicar" />
              <datalist id="fin-cats">{d.categorias.map((c) => <option key={c} value={c} />)}</datalist>
              <button type="button" className="btn" disabled={!cat.trim()} onClick={() => lote("categoria", sel, { categoria: cat })}>Aplicar</button>
            </span>
            <span className="row">
              <select className="inp" value={cc} onChange={(e) => setCc(e.target.value)} aria-label="Centro de custo para aplicar">
                <option value="">Sem CC</option>
                {d.projetos.map((p) => <option key={p.cc} value={p.cc}>{p.cc} · {p.projeto}</option>)}
              </select>
              <button type="button" className="btn" onClick={defineCc}>Definir CC</button>
            </span>
          </>}
          {d.tags.length > 0 && (
            <span className="row">
              <select className="inp" value={tagLote} onChange={(e) => setTagLote(e.target.value)} aria-label="Tag para aplicar">
                <option value="">Tag…</option>
                {d.tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <button type="button" className="btn" disabled={!tagLote} onClick={() => marcaTag(true)}>Marcar</button>
              <button type="button" className="btn" disabled={!tagLote} onClick={() => marcaTag(false)}>Desmarcar</button>
            </span>
          )}
          <button type="button" className="linkb" onClick={() => setSel([])}>Limpar seleção</button>
        </div>
      )}

      <p className="muted" style={{ fontSize: 13.5, margin: "6px 0 10px" }}>
        {visiveis.length} de {fluxos.length} lançamento(s)
        {pode ? " · arraste para Pagas/recebidas para baixar; clique para selecionar." : " · clique para selecionar e aplicar as suas tags."}
        {ocultos ? ` · ${ocultos} não exibido(s): refine o filtro.` : ""}
        <button type="button" className="linkb" style={{ marginLeft: 8 }} onClick={() => setSel(itens.map((i) => i.id))}>Selecionar os exibidos</button>
        {msg ? <b style={{ marginLeft: 8 }}>{msg}</b> : null}
      </p>

      <Board<Item>
        colunas={colunas}
        itens={itens}
        podeMover={pode}
        onMove={onMove}
        onOpen={(f) => alternaSel(f.id)}
        renderCard={(f) => {
          const tags = (d.itemTags[f.id] || []).map((id) => d.tags.find((t) => t.id === id)).filter(Boolean) as CrmTag[];
          const marcado = sel.includes(f.id);
          return (
            <div className={marcado ? "fsel" : ""}>
              <div className="kt" style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                <input type="checkbox" checked={marcado} readOnly tabIndex={-1} aria-label="Selecionado" style={{ margin: 0 }} />
                <span style={{ flex: 1 }}>{f.descricao || "(sem descrição)"}</span>
              </div>
              <div className="fval" style={{ color: f.tipo === "entrada" ? "var(--ok)" : "var(--crit)" }}>{f.tipo === "entrada" ? "+ " : "− "}{fmtBRL(f.valor)}</div>
              <div className="km">
                <span>{f.status === "realizado" ? (f.tipo === "entrada" ? "recebido " : "pago ") + fmtData(f.data_real) : "vence " + fmtData(f.data_prev)}</span>
                {f.cc ? <span>{f.cc}</span> : <span className="ktag" style={{ color: "var(--warn)" }}>sem CC</span>}
                {f.categoria ? <span>{f.categoria}</span> : null}
              </div>
              {tags.length ? <div className="ktags">{tags.map((t) => <TagChip key={t.id} tag={t} />)}</div> : null}
            </div>
          );
        }}
      />
    </>
  );
}
