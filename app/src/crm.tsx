import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type CrmResp, type Deal, type CrmTag, type CrmAtividade } from "./api";
import { Board, type Coluna } from "./kanban";
import {
  FASES, faseDeSt, rotuloSt, destinoMovimento, aplicaFiltro, normalizaFiltro, filtroVazio,
  CORES_TAG, TIPOS_ATIVIDADE, type FiltroCrm,
} from "../../src/crm.mjs";

// CRM da casca nova: pipeline arrastável por fase ou por subetapa, tags e filtros salvos POR PESSOA,
// e o painel do negócio com o histórico de atividades e o próximo passo. A regra de filtro e de
// movimento é a mesma do servidor (src/crm.mjs). O cartão NÃO exibe valor em R$ (confidencialidade).

const hojeIso = () => new Date().toISOString().slice(0, 10);
const VAZIO: FiltroCrm = normalizaFiltro({});
const TIPO_LABEL: Record<string, string> = { nota: "Nota", ligacao: "Ligação", reuniao: "Reunião", email: "E-mail", tarefa: "Próximo passo", etapa: "Etapa" };
const fmtData = (iso: string) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "");

type DealItem = Deal & { col: string };
interface FiltroSalvo { id: string; nome: string; filtro: FiltroCrm }

function ErroCard({ e }: { e: ApiError }) {
  const login = e.status === 401;
  return (
    <div className="card">
      <p style={{ margin: "0 0 10px" }}>{e.message}</p>
      <a className={"btn " + (login ? "primary" : "")} href="/">{login ? "Ir para o login do portal" : "Abrir o portal"}</a>
    </div>
  );
}

export function TagChip({ tag, on, onClick }: { tag: CrmTag; on?: boolean; onClick?: () => void }) {
  const cls = "tagc" + (on === false ? " off" : "");
  return onClick
    ? <button type="button" className={cls} data-cor={tag.cor} onClick={onClick} aria-pressed={on}>{tag.nome}</button>
    : <span className={cls} data-cor={tag.cor}>{tag.nome}</span>;
}

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

export function CrmPipeline() {
  const [dados, setDados] = useState<CrmResp | null>(null);
  const [erro, setErro] = useState<ApiError | null>(null);
  const [msg, setMsg] = useState("");
  const [filtro, setFiltro] = useState<FiltroCrm>(VAZIO);
  const [salvos, setSalvos] = useState<FiltroSalvo[]>([]);
  const [salvoSel, setSalvoSel] = useState("");
  const [vista, setVista] = useState<"fases" | "subetapas">("fases");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = () => api<CrmResp>("crm").then(setDados).catch((e: unknown) => setErro(e as ApiError));
  const carregarSalvos = () => api<{ filtros: FiltroSalvo[] }>("filtroList", { modulo: "crm" }).then((r) => setSalvos(r.filtros || [])).catch(() => setSalvos([]));
  useEffect(() => { carregar(); carregarSalvos(); }, []);

  const deals = dados?.deals || [];
  const tags = dados?.tags || [];
  const dealTags = dados?.dealTags || {};
  const prox = dados?.prox || {};
  const hoje = hojeIso();

  const visiveis = useMemo(() => aplicaFiltro(deals, filtro, { dealTags, prox, hoje }), [deals, filtro, dealTags, prox, hoje]);

  if (erro) return <ErroCard e={erro} />;
  if (!dados) return <div className="note">Carregando o CRM…</div>;

  const podeGerir = !!dados.podeGerir;
  const colunas: Coluna[] = vista === "fases"
    ? FASES.map((f) => ({ id: "fase:" + f.id, label: f.label }))
    : Array.from({ length: 21 }, (_, i) => ({ id: "st:" + (i + 1), label: rotuloSt(i + 1) }));
  const itens: DealItem[] = visiveis
    .filter((d) => faseDeSt(d.st))
    .map((d) => ({ ...d, col: vista === "fases" ? "fase:" + faseDeSt(d.st) : "st:" + d.st }));
  const foraDoFunil = deals.filter((d) => !faseDeSt(d.st)).length;

  const owners = Array.from(new Set(deals.map((d) => String(d.owner || "")).filter(Boolean))).sort().map((o) => ({ id: o, label: o }));
  const temps = Array.from(new Set(deals.map((d) => String(d.temp || "")).filter(Boolean))).sort().map((o) => ({ id: o, label: o }));
  const pris = Array.from(new Set(deals.map((d) => String(d.pri || "")).filter(Boolean))).sort().map((o) => ({ id: o, label: o }));
  const set = (patch: Partial<FiltroCrm>) => { setFiltro((f) => ({ ...f, ...patch })); setSalvoSel(""); };

  const onMove = (id: string, col: string) => {
    const antes = dados;
    const d = deals.find((x) => x.id === id);
    if (!d) return;
    const novo = destinoMovimento(d.st, col);
    if (novo === d.st) return;
    setDados({ ...dados, deals: deals.map((x) => (x.id === id ? { ...x, st: novo } : x)) });
    setMsg("Movendo…");
    api("crmDealStage", { id, alvo: col }).then(() => setMsg("Movido para " + rotuloSt(novo) + "."))
      .catch((e: ApiError) => { setDados(antes); setMsg(e.message || "Erro ao mover; desfeito."); });
  };

  const aplicarSalvo = (id: string) => {
    setSalvoSel(id);
    const s = salvos.find((x) => x.id === id);
    setFiltro(s ? normalizaFiltro(s.filtro) : VAZIO);
  };
  const salvarFiltro = () => {
    const atual = salvos.find((x) => x.id === salvoSel);
    const nome = window.prompt(atual ? "Atualizar o filtro salvo (ou dê outro nome para criar um novo):" : "Nome do filtro:", atual ? atual.nome : "");
    if (!nome) return;
    const id = atual && atual.nome === nome.trim() ? atual.id : "";
    api<{ filtro: FiltroSalvo }>("filtroSet", { modulo: "crm", id, nome, filtro })
      .then((r) => { setMsg("Filtro salvo."); carregarSalvos(); setSalvoSel(r.filtro.id); })
      .catch((e: ApiError) => setMsg(e.message));
  };
  const excluirFiltro = () => {
    const s = salvos.find((x) => x.id === salvoSel);
    if (!s || !window.confirm("Excluir o filtro “" + s.nome + "”?")) return;
    api("filtroDel", { modulo: "crm", id: s.id }).then(() => { setSalvoSel(""); carregarSalvos(); setMsg("Filtro excluído."); }).catch((e: ApiError) => setMsg(e.message));
  };

  const nFiltros = (filtro.owners.length + filtro.fases.length + filtro.tags.length + filtro.temp.length + filtro.pri.length + (filtro.prazo ? 1 : 0));

  return (
    <>
      <div className="crm-bar">
        <input className="inp" type="search" placeholder="Buscar empresa, contato, cidade, CC…" value={filtro.q}
          onChange={(e) => set({ q: e.target.value })} aria-label="Buscar no CRM" />
        <button type="button" className={"btn" + (mostrarFiltros || nFiltros ? " primary" : "")} onClick={() => setMostrarFiltros((v) => !v)} aria-expanded={mostrarFiltros}>
          Filtros{nFiltros ? " (" + nFiltros + ")" : ""}
        </button>
        <select className="inp" value={salvoSel} onChange={(e) => aplicarSalvo(e.target.value)} aria-label="Filtros salvos">
          <option value="">Filtros salvos…</option>
          {salvos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <button type="button" className="btn" onClick={salvarFiltro} disabled={filtroVazio(filtro)} title="Salvar o filtro atual com um nome (só você vê)">Salvar filtro</button>
        {salvoSel ? <button type="button" className="btn" onClick={excluirFiltro}>Excluir</button> : null}
        {!filtroVazio(filtro) ? <button type="button" className="btn" onClick={() => { setFiltro(VAZIO); setSalvoSel(""); }}>Limpar</button> : null}
        <span className="spacer" />
        <div className="ktoggle">
          <button className={vista === "fases" ? "on" : ""} onClick={() => setVista("fases")}>Fases</button>
          <button className={vista === "subetapas" ? "on" : ""} onClick={() => setVista("subetapas")}>Subetapas</button>
        </div>
      </div>

      {mostrarFiltros && (
        <div className="card crm-filtros">
          <Chips label="Responsável" opcoes={owners} sel={filtro.owners} onChange={(v) => set({ owners: v })} />
          <Chips label="Fase" opcoes={FASES.map((f) => ({ id: f.id, label: f.label }))} sel={filtro.fases} onChange={(v) => set({ fases: v })} />
          <Chips label="Minhas tags" opcoes={tags.map((t) => ({ id: t.id, label: t.nome }))} sel={filtro.tags} onChange={(v) => set({ tags: v })} />
          <Chips label="Temperatura" opcoes={temps} sel={filtro.temp} onChange={(v) => set({ temp: v })} />
          <Chips label="Prioridade" opcoes={pris} sel={filtro.pri} onChange={(v) => set({ pri: v })} />
          <div className="fgrp">
            <span className="flbl">Próximo passo</span>
            {[["", "Todos"], ["atrasado", "Atrasado"], ["semana", "Nos próximos 7 dias"], ["sem", "Sem próximo passo"]].map(([id, l]) => (
              <button key={id} type="button" className={"chip" + (filtro.prazo === id ? " on" : "")} aria-pressed={filtro.prazo === id} onClick={() => set({ prazo: id })}>{l}</button>
            ))}
          </div>
          {!tags.length && <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>Você ainda não tem tags. Abra um negócio e crie a primeira; só você vê as suas.</p>}
        </div>
      )}

      <p className="muted" style={{ fontSize: 13.5, margin: "0 0 10px" }}>
        {visiveis.length} de {deals.length} negócio(s)
        {podeGerir ? " · arraste o cartão para mover; clique para abrir." : " · clique no cartão para ver o histórico."}
        {foraDoFunil ? ` · ${foraDoFunil} fora do funil (leads).` : ""}
        {msg ? <b style={{ marginLeft: 8 }}>{msg}</b> : null}
      </p>

      <Board<DealItem>
        colunas={colunas}
        itens={itens}
        podeMover={podeGerir}
        onMove={onMove}
        onOpen={(d) => setAberto(d.id)}
        renderCard={(d) => {
          const p = prox[d.id];
          const atrasado = p && p.prazo < hoje;
          const minhas = (dealTags[d.id] || []).map((id) => tags.find((t) => t.id === id)).filter(Boolean) as CrmTag[];
          return (
            <>
              <div className="kt">{d.co || "(sem nome)"}</div>
              <div className="km">
                {d.owner ? <span>{d.owner}</span> : null}
                {d.pri ? <span className="ktag" style={{ color: d.pri === "Alta" ? "var(--crit)" : d.pri === "Média" ? "var(--warn)" : "var(--muted)" }}>{d.pri}</span> : null}
                {d.temp ? <span className="ktag" style={{ color: "var(--muted)" }}>{d.temp}</span> : null}
                {vista === "fases" ? <span>{rotuloSt(d.st).split(" · ")[1]}</span> : null}
              </div>
              {minhas.length ? <div className="ktags">{minhas.map((t) => <TagChip key={t.id} tag={t} />)}</div> : null}
              {p ? <div className={"kprox" + (atrasado ? " late" : "")}>{atrasado ? "Atrasado · " : ""}{fmtData(p.prazo)}: {p.texto.slice(0, 70)}</div> : null}
            </>
          );
        }}
      />

      {aberto && deals.some((d) => d.id === aberto) && (
        <DealPainel
          deal={deals.find((d) => d.id === aberto)!}
          dados={dados}
          onClose={() => setAberto(null)}
          onChange={carregar}
          onMover={(alvo) => onMove(aberto, alvo)}
        />
      )}
    </>
  );
}

function DealPainel({ deal, dados, onClose, onChange, onMover }: {
  deal: Deal; dados: CrmResp; onClose: () => void; onChange: () => void; onMover: (alvo: string) => void;
}) {
  const [ativ, setAtiv] = useState<CrmAtividade[] | null>(null);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ tipo: "ligacao", texto: "", data: hojeIso(), prazo: "", resp: dados.eu || "" });
  const [novaTag, setNovaTag] = useState({ nome: "", cor: "verde" });
  const [gerTags, setGerTags] = useState(false);
  const podeGerir = !!dados.podeGerir;
  const tags = dados.tags || [];
  const minhas = (dados.dealTags || {})[deal.id] || [];

  const carregar = () => api<{ atividades: CrmAtividade[] }>("crmAtividades", { deal: deal.id }).then((r) => setAtiv(r.atividades || [])).catch((e: ApiError) => setMsg(e.message));
  useEffect(() => { carregar(); }, [deal.id]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const falha = (e: ApiError) => setMsg(e.message || "Erro.");
  const alternaTag = (id: string) => api("crmDealTag", { deal: deal.id, tag: id, on: !minhas.includes(id) }).then(onChange).catch(falha);
  const criaTag = () => api<{ tag: CrmTag }>("crmTagSet", novaTag)
    .then((r) => api("crmDealTag", { deal: deal.id, tag: r.tag.id, on: true }))
    .then(() => { setNovaTag({ nome: "", cor: novaTag.cor }); onChange(); }).catch(falha);
  const renomeia = (t: CrmTag) => {
    const nome = window.prompt("Novo nome da tag:", t.nome);
    if (nome) api("crmTagSet", { id: t.id, nome, cor: t.cor }).then(onChange).catch(falha);
  };
  const recolore = (t: CrmTag, cor: string) => api("crmTagSet", { id: t.id, nome: t.nome, cor }).then(onChange).catch(falha);
  const excluiTag = (t: CrmTag) => { if (window.confirm("Excluir a tag “" + t.nome + "” de todos os seus negócios?")) api("crmTagDel", { id: t.id }).then(onChange).catch(falha); };

  const registra = () => {
    api("crmAtividadeSet", { deal: deal.id, ...form })
      .then(() => { setForm({ ...form, texto: "", prazo: "" }); setMsg("Registrado."); carregar(); onChange(); })
      .catch(falha);
  };
  const marcaFeita = (a: CrmAtividade) => api("crmAtividadeFeita", { id: a.id, feito: !Number(a.feito) }).then(() => { carregar(); onChange(); }).catch(falha);
  const exclui = (a: CrmAtividade) => { if (window.confirm("Excluir esta atividade?")) api("crmAtividadeDel", { id: a.id }).then(() => { carregar(); onChange(); }).catch(falha); };

  return (
    <div className="drawer-bg" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={"Negócio " + (deal.co || deal.id)} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-h">
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{deal.co || "(sem nome)"}</div>
            <div className="muted" style={{ fontSize: 13 }}>{rotuloSt(deal.st)}{deal.owner ? " · " + deal.owner : ""}</div>
          </div>
          <button type="button" className="btn" onClick={onClose} aria-label="Fechar">Fechar</button>
        </div>

        {podeGerir && (
          <label className="fld">
            <span>Subetapa</span>
            <select className="inp" value={deal.st} onChange={(e) => onMover("st:" + e.target.value)}>
              {Array.from({ length: 21 }, (_, i) => <option key={i + 1} value={i + 1}>{rotuloSt(i + 1)}</option>)}
            </select>
          </label>
        )}

        <dl className="ddl">
          {deal.contact ? (<><dt>Contato</dt><dd>{deal.contact}{deal.role ? " · " + deal.role : ""}</dd></>) : null}
          {deal.email ? (<><dt>E-mail</dt><dd>{deal.email}</dd></>) : null}
          {deal.phone ? (<><dt>Telefone</dt><dd>{deal.phone}</dd></>) : null}
          {deal.city ? (<><dt>Cidade</dt><dd>{deal.city}</dd></>) : null}
          {deal.seg ? (<><dt>Segmento</dt><dd>{deal.seg}</dd></>) : null}
          {deal.prod ? (<><dt>Serviço</dt><dd>{deal.prod}</dd></>) : null}
          {deal.cc ? (<><dt>Centro de custo</dt><dd>{deal.cc}</dd></>) : null}
        </dl>

        <section className="dsec">
          <div className="dsec-h"><b>Minhas tags</b><button type="button" className="linkb" onClick={() => setGerTags((v) => !v)}>{gerTags ? "Concluir" : "Gerenciar"}</button></div>
          <div className="ktags">
            {tags.map((t) => gerTags
              ? (<span key={t.id} className="tagedit">
                  <TagChip tag={t} onClick={() => renomeia(t)} />
                  <select className="inp mini" value={t.cor} onChange={(e) => recolore(t, e.target.value)} aria-label={"Cor de " + t.nome}>
                    {CORES_TAG.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="button" className="linkb" onClick={() => excluiTag(t)} aria-label={"Excluir " + t.nome}>excluir</button>
                </span>)
              : <TagChip key={t.id} tag={t} on={minhas.includes(t.id)} onClick={() => alternaTag(t.id)} />)}
            {!tags.length && <span className="muted" style={{ fontSize: 12.5 }}>Nenhuma tag ainda.</span>}
          </div>
          <div className="row">
            <input className="inp" placeholder="Nova tag" maxLength={30} value={novaTag.nome} onChange={(e) => setNovaTag({ ...novaTag, nome: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter" && novaTag.nome.trim()) criaTag(); }} aria-label="Nome da nova tag" />
            <select className="inp mini" value={novaTag.cor} onChange={(e) => setNovaTag({ ...novaTag, cor: e.target.value })} aria-label="Cor da nova tag">
              {CORES_TAG.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" className="btn" disabled={!novaTag.nome.trim()} onClick={criaTag}>Criar e marcar</button>
          </div>
        </section>

        <section className="dsec">
          <div className="dsec-h"><b>Atividades</b></div>
          {podeGerir && (
            <div className="atv-form">
              <div className="row">
                <select className="inp" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} aria-label="Tipo de atividade">
                  {TIPOS_ATIVIDADE.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                </select>
                {form.tipo === "tarefa"
                  ? <input className="inp" type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} aria-label="Prazo" />
                  : <input className="inp" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} aria-label="Data" />}
                {form.tipo === "tarefa" && <input className="inp" placeholder="Responsável" value={form.resp} onChange={(e) => setForm({ ...form, resp: e.target.value })} aria-label="Responsável" />}
              </div>
              <textarea className="inp" rows={2} placeholder={form.tipo === "tarefa" ? "O que precisa ser feito" : "O que aconteceu"} value={form.texto}
                onChange={(e) => setForm({ ...form, texto: e.target.value })} aria-label="Descrição" />
              <button type="button" className="btn primary" disabled={form.texto.trim().length < 2 || (form.tipo === "tarefa" && !form.prazo)} onClick={registra}>Registrar</button>
            </div>
          )}
          {msg && <p className="muted" style={{ fontSize: 13 }}><b>{msg}</b></p>}
          {!ativ ? <div className="note">Carregando…</div> : !ativ.length ? <p className="muted" style={{ fontSize: 13 }}>Sem atividades registradas.</p> : (
            <ul className="atv">
              {ativ.map((a) => {
                const tarefa = a.tipo === "tarefa";
                const feito = !!Number(a.feito);
                const late = tarefa && !feito && a.prazo && a.prazo < hojeIso();
                return (
                  <li key={a.id} className={"atv-i t-" + a.tipo + (feito ? " feito" : "")}>
                    <div className="atv-m">
                      <span className="ktag">{TIPO_LABEL[a.tipo] || a.tipo}</span>
                      <span>{tarefa ? (late ? "Atrasado · " : "Prazo ") + fmtData(a.prazo) : fmtData(a.data || a.criado.slice(0, 10))}</span>
                      <span>· {a.autor}{tarefa && a.resp ? " → " + a.resp : ""}</span>
                    </div>
                    <div className={late ? "late" : ""}>{a.texto}</div>
                    {podeGerir && (
                      <div className="atv-a">
                        {tarefa && <button type="button" className="linkb" onClick={() => marcaFeita(a)}>{feito ? "Reabrir" : "Marcar como feito"}</button>}
                        {a.tipo !== "etapa" && a.autor === dados.eu && <button type="button" className="linkb" onClick={() => exclui(a)}>Excluir</button>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
