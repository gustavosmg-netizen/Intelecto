// As 10 áreas do alvo (navegação por trabalho, não por tabela). Cada rota tem endereço próprio
// (#/<id>) — resolve o "nenhuma tela tem endereço" do laudo. Nesta primeira fatia da Onda 2 só o
// cockpit está implementado na casca nova; as demais apontam para o portal atual (estrangulamento).
export interface Area {
  id: string;
  label: string;
  icon: string;
  resumo: string;
  // destino legado no portal atual (/), enquanto a tela não foi migrada. null = já é da casca nova.
  legado: string | null;
}

export const AREAS: Area[] = [
  { id: "inicio", label: "Início", icon: "◧", resumo: "Cockpit por papel, com widgets que você organiza.", legado: null },
  { id: "meu", label: "Meu trabalho", icon: "☑", resumo: "Minhas horas, aprovações, agenda e cursos.", legado: "/" },
  { id: "projetos", label: "Projetos", icon: "▤", resumo: "Carteira e a página do Projeto 360.", legado: "/" },
  { id: "comercial", label: "Comercial", icon: "◆", resumo: "Leads, pipeline, propostas e contratos.", legado: "/" },
  { id: "financeiro", label: "Financeiro", icon: "$", resumo: "Resultado por projeto, caixa e conciliação.", legado: "/" },
  { id: "pessoas", label: "Pessoas", icon: "☺", resumo: "Equipe, cargos, capacidade e fichas.", legado: "/" },
  { id: "academia", label: "Academia", icon: "✦", resumo: "Cursos, trilhas, biblioteca e certificados.", legado: "/" },
  { id: "inteligencia", label: "Inteligência", icon: "✵", resumo: "Daily Brief, agentes e assistente do portal.", legado: "/" },
  { id: "vitrine", label: "Vitrine & Marca", icon: "▲", resumo: "Cases, portfólio e ativos da marca.", legado: "/" },
  { id: "admin", label: "Administração", icon: "⚙", resumo: "Cadastros, permissões, consistência e auditoria.", legado: "/" },
];

export function rotaAtual(): string {
  return parseHash().area;
}

// Rota com sub-caminho: #/<area>/<sub> (ex.: #/projetos/1.25.2.3 abre o Projeto 360 daquele CC).
// É o que dá ENDEREÇO próprio a cada projeto — o laudo apontava a ausência disso.
export function parseHash(): { area: string; sub: string | null } {
  const raw = (location.hash || "#/inicio").replace(/^#\//, "");
  const path = raw.split("?")[0];
  const segs = path.split("/").filter(Boolean);
  const area = AREAS.some((a) => a.id === segs[0]) ? segs[0] : "inicio";
  const sub = segs[1] ? decodeURIComponent(segs[1]) : null;
  return { area, sub };
}
