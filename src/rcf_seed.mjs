// RCFs (Responsabilidades, Cargos e Funções) — conteúdo inicial no MODELO DA CASA.
// - "aprovado": transcritos dos RCFs da Intelecto no Drive (Engenheiro, Analista Ambiental,
//   Estágio em Química), com a data de revisão de cada documento.
// - "rascunho": propostas para os demais cargos ativos, no mesmo padrão, PARA REVISÃO do RH e dos
//   sócios antes de aprovar (aprovar abre a ciência dos ocupantes).
// Semeado só onde o cargo ainda não tem RCF (não sobrescreve o que o RH editou).

const PADRAO_FINAL = [
  "Realizar Benchmarking dos processos da área, buscando inovações e sugerindo melhorias contínuas.",
  "Compartilhar conhecimentos de forma a aprimorar o conhecimento individual e contribuir para o desenvolvimento do time.",
  "Elaborar o plano de desenvolvimento individual, em colaboração com a liderança, comprometendo-se com o seu desenvolvimento pessoal e profissional.",
  "Participar do ciclo de avaliação de desempenho, cumprindo os prazos e as atividades sob sua responsabilidade.",
  "Atuar em conformidade com o código de cultura, políticas, normas e procedimentos internos, além de método e estratégias da Intelecto.",
  "Realizar demais atividades pertinentes ao cargo.",
];
const GESTAO_PLENO = [
  "Gerar os indicadores de gente e gestão, contribuindo com insights, oportunidades de melhoria e planos de ação.",
  "Monitorar e assegurar a realização das reuniões entre gestores e times.",
  "Contribuir na definição de estratégias e planejamento da área, propondo indicadores para monitoramento da eficiência e dos resultados.",
  "Contribuir para a tomada de decisões para assuntos estratégicos que envolvam a área, subsidiando seu parecer com dados, análises de viabilidade, gestão de riscos e retorno sobre investimentos.",
  "Desenvolver procedimentos operacionais padrão (POP) para controle de qualidade dos processos.",
  "Elaborar IT (Instrução de Trabalho) da área.",
];
const m = (item, jr, pl, sr) => ({ item, jr: String(jr), pl: String(pl), sr: String(sr) });
const SOFT = [
  m("Organização e gestão do tempo - capacidade de lidar com múltiplas tarefas e prazos", 1, 2, 3),
  m("Proatividade e iniciativa - identificar problemas e sugerir soluções sem precisar de direcionamento constante", 1, 2, 3),
  m("Trabalho em equipe - saber colaborar com diferentes setores e profissionais", 1, 2, 3),
  m("Comunicação clara e objetiva - essencial para relatórios técnicos e interações com clientes", 1, 2, 3),
  m("Adaptabilidade e aprendizado rápido - importante para lidar com diferentes projetos e tecnologias", 1, 2, 3),
  m("Resolução de problemas - capacidade analítica para lidar com desafios técnicos", 1, 2, 3),
  m("Atenção aos detalhes - fundamental para precisão em medições, cálculos e relatórios", 1, 2, 3),
  m("Comprometimento e responsabilidade - cumprir prazos e ser confiável na execução de tarefas", 1, 2, 3),
  m("Visão sistêmica - entender como o trabalho impacta no projeto como um todo", 1, 2, 3),
  m("Postura profissional e ética - fundamental para lidar com equipe, parceiros e clientes", 1, 2, 3),
];
const CONHEC_TEC = [
  m("Análise de dados - capacidade de estruturar, analisar, apresentar e discutir resultados", 1, 2, 3),
  m("Ferramenta de estatística (matlab, minitab, excel, python, R...)", 1, 2, 3),
  m("Experiência em laboratório - capacidade de realizar e interpretar experimentos", 1, 2, 3),
  m("Word para a escrita de relatórios técnicos e procedimentos de experimentos", 1, 2, 3),
  m("MS Excel ou Google Sheets para estruturação de dados", 1, 2, 3),
  m("MS PowerPoint ou similar (ex.: Canva) para elaboração de apresentações", 1, 2, 2),
  m("Experiência com ferramentas de desenho (CAD, Sketchup, Blender)", 1, 2, 2),
  m("Experiência com ferramentas de mapeamento (QGIS, Google Earth, ArcGIS, IDE-Sisema)", 1, 2, 2),
  m("Ferramentas de plano de ação e planejamento (PDCA, SMART etc.)", 1, 2, 2),
  m("Experiência com tratamento de efluentes", 1, 2, 3),
  m("Experiência com tratamento de resíduos sólidos", 1, 2, 3),
  m("Experiência com geração e aproveitamento de biogás", "-", 1, 2),
  m("Experiência com tratamento de emissões atmosféricas (fontes difusas)", 1, 2, 2),
  m("Carteira de motorista", "-", 1, 2),
  m("Língua portuguesa", 2, 2, 2),
  m("E-mail e WhatsApp", 1, 2, 3),
  m("Internet e ferramentas cloud", 1, 2, 3),
];
const EXIG = { educacao: "Conforme Matriz de Competências", experiencia: "Conforme Matriz de Competências", treinamento: "Conforme Matriz de Competências", habilidade: "Conforme Matriz de Competências" };

const PLENO_TEC = [
  "Supervisionar ensaios de laboratório, testes e operações industriais, garantindo qualidade e confiabilidade dos resultados",
  "Coordenar projetos de implantação de sistemas de tratamento de efluentes e mitigação de impactos ambientais",
  "Liderar atividades de licenciamento ambiental e atendimento a condicionantes",
  "Realizar contato técnico com clientes para levantamento de necessidades e suporte especializado",
  "Participar da elaboração de orçamentos e planejamento de projetos ambientais",
  "Desenvolver propostas técnicas e estudos de viabilidade econômica para novos projetos",
  "Modelar, analisar e interpretar resultados de modelagem de processos ambientais",
  "Atuar na interface com órgãos ambientais e regulatórios para aprovação de projetos",
  "Participar de reuniões técnicas e comerciais",
  "Propor e implementar melhorias nos processos e tecnologias ambientais adotados pela empresa",
  ...GESTAO_PLENO, ...PADRAO_FINAL,
];
const SENIOR_TEC = [
  "Liderar a equipe técnica, definindo diretrizes estratégicas para os projetos ambientais",
  "Desenvolver e validar novas tecnologias e metodologias para tratamento de efluentes e mitigação de impactos ambientais",
  "Gerenciar múltiplos projetos, garantindo cumprimento de prazos e metas financeiras",
  "Atuar como especialista técnico em reuniões com clientes, órgãos reguladores e parceiros estratégicos",
  "Elaborar planejamento estratégico para otimização de processos e redução de custos",
  "Acompanhar tendências do setor e propor novas tecnologias para adoção pela empresa",
  "Representar a empresa em eventos, congressos e reuniões com stakeholders",
  "Definir indicadores de desempenho ambiental e eficiência dos processos",
  "Conduzir treinamentos internos e mentorias para o desenvolvimento da equipe técnica",
  "Garantir conformidade ambiental e regulatória dos projetos implementados",
  "Apoiar a gestão na supervisão da realização das atividades do time, validando entregas.",
  "Realizar demais atividades pertinentes ao cargo.",
];

const ENGENHEIRO = {
  status: "aprovado", revisao: "2025-02-21", subordinacao: "Coordenadores de projetos",
  missao: "Gestão de projetos: pesquisa e desenvolvimento de processos e produtos de tratamento de efluentes e emissões atmosféricas difusas.",
  indicadores: ["Indicador de produtividade da função (planejado x entregas semanais da equipe)", "SLA de contratação"],
  niveis: {
    jr: ["Realização de ensaios laboratoriais e testes de tratabilidade", "Realização de ensaios de potencial bioquímico de metano",
      "Elaborar relatórios técnicos e laudos com base nos dados dos ensaios", "Auxiliar na implantação de tecnologias ambientais para tratamento de efluentes e supressão de poeira",
      "Acompanhar e analisar dados de campo e de clientes para apoiar estudos técnicos", "Acompanhar atividades de licenciamento ambiental e atendimento a condicionantes",
      "Auxiliar na elaboração de propostas técnicas e comerciais para clientes", "Apoiar a modelagem de processos ambientais e análise de dados",
      "Manter atualizados os registros de ensaios, medições e análises", "Acompanhar testes industriais e operações de campo sob supervisão",
      "Participar de reuniões técnicas e elaborar atas e documentos de suporte", ...PADRAO_FINAL],
    pl: PLENO_TEC, sr: SENIOR_TEC,
  },
  conhecimentos: CONHEC_TEC, soft: SOFT, exigencias: EXIG,
};
const ANALISTA = {
  status: "aprovado", revisao: "2026-04-27", subordinacao: "Coordenadores de projetos",
  missao: "Gestão de processos e projetos ambientais com atuação direta em trabalhos na área de resíduos sólidos urbanos e industriais. Apoio no planejamento e execução de experimentos e na elaboração de documentos (relatórios, projetos, especificação técnica, orçamentos, propostas) relacionados ao tratamento de resíduos. Atuação em projetos de pesquisa e desenvolvimento de processos e produtos na área de tecnologia ambiental.",
  indicadores: ["Indicador de produtividade da função (projetos planejados x projetos executados x desenvoltura em equipe)", "SLA de contratação"],
  niveis: {
    jr: ["Realização de caracterização de amostras de resíduos e subprodutos", "Realização de ensaios de potencial bioquímico de metano",
      "Operação de biodigestores internos e acompanhamento assistido dos projetos externos da empresa", "Manejo de resíduo, ensaios com o biofertilizante e com o biogás",
      "Interpretar e elaborar relatórios técnicos e laudos com base nos dados dos ensaios", "Auxiliar na implantação de tecnologias ambientais para tratamento de resíduos",
      "Acompanhar e analisar dados de campo e de clientes para apoiar estudos técnicos", "Acompanhar atividades de licenciamento ambiental e atendimento a condicionantes",
      "Auxiliar na orçamentação, bem como na elaboração de propostas técnicas e comerciais para clientes", "Apoiar a modelagem de processos ambientais e análise de dados",
      "Manter atualizados os registros de ensaios, medições e análises", "Acompanhar testes industriais e operações de campo sob supervisão",
      "Participar de reuniões técnicas e elaborar atas e documentos de suporte", ...PADRAO_FINAL],
    pl: PLENO_TEC, sr: SENIOR_TEC,
  },
  conhecimentos: CONHEC_TEC, soft: SOFT, exigencias: EXIG,
};
const ESTAGIO_QUIMICA = {
  status: "aprovado", revisao: "2026-04-27", subordinacao: "Coordenadores de projetos",
  missao: "Execução rotineira de boas práticas de laboratório (organização, verificação e calibração de equipamentos, manutenção de inventários de vidrarias, equipamentos, soluções, produtos químicos e demais itens). Apoio no preparo de amostras, execução e registros dos ensaios de laboratório, além da interpretação e documentação por meio de relatórios técnicos e apresentações.",
  indicadores: ["Indicador de produtividade da função (projetos planejados x projetos executados x desenvoltura em equipe x nota para boas práticas da equipe)", "SLA de contratação"],
  niveis: {
    jr: ["Organização do laboratório", "Calibração de equipamentos", "Manutenção de inventários", "Preparo de soluções",
      "Preparo de pastilhas e outros reagentes químicos não perigosos", "Operação de biodigestores", "Execução de ensaios laboratoriais com resíduos sólidos e efluentes",
      "Manter atualizados os registros de ensaios, medições e análises", "Participar de reuniões técnicas e elaborar atas e documentos de suporte", ...PADRAO_FINAL],
    pl: PLENO_TEC, sr: SENIOR_TEC,
  },
  conhecimentos: CONHEC_TEC, soft: SOFT, exigencias: EXIG,
};

const rascunho = (subordinacao, missao, indicadores, jr, pl, sr, conhecimentos, exig) => ({
  status: "rascunho", revisao: "", subordinacao, missao, indicadores,
  niveis: { jr: [...jr, ...PADRAO_FINAL], pl: [...pl, ...GESTAO_PLENO, ...PADRAO_FINAL], sr: [...sr, "Realizar demais atividades pertinentes ao cargo."] },
  conhecimentos, soft: SOFT, exigencias: exig || EXIG,
});

const TECNICO_LAB = rascunho("Coordenação Técnica",
  "Responder pela rotina analítica e pelas boas práticas do laboratório: preparo e execução de ensaios de tratabilidade, caracterização de efluentes e resíduos, operação de biodigestores e ensaios de potencial bioquímico de metano, garantindo rastreabilidade, segurança e qualidade dos resultados que embasam relatórios e projetos da casa.",
  ["Ensaios entregues no prazo x programados", "Retrabalho por não conformidade de ensaio", "Nota de boas práticas de laboratório (auditoria interna)", "Inventário e calibração em dia"],
  ["Executar ensaios laboratoriais (jar-test, sólidos, DQO, pH, turbidez, sedimentação) conforme procedimento", "Preparar soluções, reagentes e amostras",
    "Operar biodigestores e conduzir ensaios de BMP", "Calibrar e verificar equipamentos e registrar no controle", "Manter inventário de vidrarias, reagentes e equipamentos",
    "Registrar dados brutos e resultados de forma rastreável", "Seguir normas de segurança e descarte de resíduos químicos"],
  ["Planejar a programação semanal de ensaios com a coordenação", "Interpretar resultados e redigir a seção de resultados dos relatórios técnicos",
    "Elaborar e revisar POPs e ITs do laboratório", "Orientar estagiários na execução dos ensaios", "Interface com laboratórios externos (envio de amostras, laudos)"],
  ["Responder tecnicamente pelo laboratório perante clientes e auditorias", "Validar métodos analíticos e propor novos ensaios", "Definir e acompanhar indicadores de qualidade analítica"],
  [m("Execução de ensaios físico-químicos de efluentes e resíduos", 1, 2, 3), m("Ensaios de tratabilidade (jar-test, coagulação/floculação, sedimentação)", 1, 2, 3),
    m("Operação de biodigestores e ensaios de BMP", 1, 2, 3), m("Boas práticas de laboratório, segurança química e descarte", 2, 2, 3),
    m("Calibração e verificação de equipamentos", 1, 2, 3), m("Planilhas e registro de dados (Excel/Sheets)", 1, 2, 3), m("Redação de resultados e relatórios técnicos", 1, 2, 3)],
  { educacao: "Técnico ou superior em Química, Química Industrial ou áreas afins", experiencia: "Rotina de laboratório analítico (conforme nível)", treinamento: "Boas práticas de laboratório; segurança química; POPs da casa", habilidade: "Rigor de registro e atenção a detalhes" });

const ELETRICISTA = rascunho("Coordenação Técnica / Operações",
  "Executar instalações e manutenções elétricas e de automação dos protótipos, plantas-piloto e sistemas de tratamento montados pela casa, garantindo segurança (NR-10), funcionamento e documentação das intervenções.",
  ["Montagens e manutenções concluídas no prazo", "Ocorrências de segurança (meta zero)", "Retrabalho em instalações"],
  ["Executar instalações elétricas de baixa tensão em painéis, bombas, misturadores e instrumentos", "Montar e testar quadros de comando e partida",
    "Realizar manutenção preventiva e corretiva", "Ler diagramas e esquemas elétricos", "Cumprir NR-10 e procedimentos de bloqueio e etiquetagem", "Registrar as intervenções"],
  ["Especificar materiais elétricos e listas de compra", "Integrar instrumentação e automação simples (CLP, inversores, sensores)", "Apoiar o comissionamento em campo", "Orientar auxiliares"],
  ["Responder tecnicamente pelas instalações elétricas dos projetos", "Elaborar diagramas e documentação as built", "Definir padrões de montagem e segurança"],
  [m("Instalações elétricas de baixa tensão", 2, 2, 3), m("Quadros de comando, partidas e inversores", 1, 2, 3), m("Leitura de diagramas elétricos", 1, 2, 3),
    m("NR-10 e segurança em eletricidade", 2, 3, 3), m("Instrumentação e automação (CLP, sensores)", "-", 1, 2), m("Carteira de motorista", "-", 1, 2)],
  { educacao: "Curso técnico em Eletrotécnica ou equivalente", experiencia: "Instalações e manutenção elétrica (conforme nível)", treinamento: "NR-10 (obrigatório); NR-35 quando aplicável", habilidade: "Segurança e organização na execução" });

const MONTAGEM = rascunho("Coordenação Técnica / Operações",
  "Montar protótipos, plantas-piloto e equipamentos de tratamento (tanques, tubulações, estruturas e suportes) a partir de desenhos e orientações da engenharia, com qualidade, segurança e no prazo.",
  ["Montagens concluídas no prazo", "Retrabalho por erro de montagem", "Ocorrências de segurança (meta zero)"],
  ["Montar estruturas, tanques e tubulações conforme desenho", "Executar cortes, furações, soldas e acabamentos sob orientação",
    "Organizar ferramentas, oficina e almoxarifado", "Usar EPIs e seguir procedimentos de segurança", "Registrar o andamento das montagens"],
  ["Interpretar desenhos e listas de materiais", "Planejar a sequência de montagem e o material necessário", "Executar testes de estanqueidade e funcionamento", "Orientar auxiliares"],
  ["Responder pela oficina e pelo padrão de montagem", "Propor melhorias de fabricação e de custo", "Apoiar a engenharia na viabilidade construtiva"],
  [m("Leitura de desenhos técnicos", 1, 2, 3), m("Montagem mecânica e hidráulica (PVC, PEAD, aço)", 1, 2, 3), m("Solda e caldeiraria", "-", 2, 3),
    m("Ferramentas manuais e elétricas", 2, 2, 3), m("Segurança na oficina e EPIs", 2, 3, 3)],
  { educacao: "Ensino médio; curso técnico ou profissionalizante desejável", experiencia: "Montagem mecânica/hidráulica (conforme nível)", treinamento: "Segurança na oficina; NR-12 quando aplicável", habilidade: "Capricho e precisão na execução" });

const coord = (area, missao, indicadores, resp, conhec) => rascunho("Sócios / Direção", missao, indicadores, [], resp, [
  "Definir a estratégia da área junto aos sócios", "Representar a área perante clientes, parceiros e órgãos", "Desenvolver líderes e sucessores na área",
], conhec, { educacao: "Superior completo na área; pós-graduação desejável", experiencia: "Gestão na área " + area, treinamento: "Conforme Matriz de Competências", habilidade: "Liderança, negociação e visão de negócio" });

const COORD_TECNICA = coord("técnica",
  "Coordenar a carteira técnica da casa (P&D, estudos de tratabilidade e projetos de engenharia), garantindo qualidade técnica, prazos, uso eficiente das horas da equipe e o cumprimento do macroprocesso e dos gates de liberação.",
  ["Projetos entregues no prazo x programados", "Horas gastas x horas contratadas por projeto", "Aprovação no Crivo A-F na primeira revisão", "Satisfação do cliente técnico"],
  ["Planejar e distribuir as demandas técnicas e as horas da equipe", "Revisar e liberar entregáveis (memoriais, relatórios, pranchas)", "Acompanhar andamento, riscos e consumo de horas dos projetos",
    "Apoiar o comercial em escopo técnico, estimativa de horas e propostas", "Conduzir rituais da equipe (planejamento semanal, revisões)", "Desenvolver tecnicamente a equipe"],
  [m("Gestão de projetos (escopo, prazo, horas, riscos)", "-", 2, 3), m("Domínio técnico em tratamento de efluentes e resíduos", "-", 3, 3), m("Revisão técnica e normativa (NBR, CONAMA)", "-", 2, 3), m("Estimativa de horas e orçamentação técnica", "-", 2, 3)]);
const COORD_COMERCIAL = coord("comercial",
  "Gerar e converter oportunidades em contratos rentáveis, conduzindo o funil comercial do lead ao contrato assinado, com propostas alinhadas à engenharia e ao financeiro.",
  ["Leads qualificados por mês", "Propostas enviadas e taxa de conversão", "Receita contratada x meta", "Tempo médio do funil"],
  ["Prospectar e qualificar leads", "Conduzir o funil no CRM do portal (etapas, próximos passos, atividades)", "Elaborar propostas com a coordenação técnica (escopo e horas)",
    "Negociar condições e fechar contratos", "Manter o relacionamento e o pós-venda com clientes", "Reportar previsão de vendas aos sócios"],
  [m("Prospecção e negociação B2B", "-", 2, 3), m("CRM e gestão de funil", "-", 2, 3), m("Leitura técnica de escopo ambiental", "-", 2, 2), m("Elaboração de propostas comerciais", "-", 2, 3)]);
const COORD_FINANCEIRA = coord("financeira",
  "Garantir a saúde financeira da casa: caixa, contas a pagar e a receber, conciliação, custos por projeto, impostos e relatórios para os sócios.",
  ["Conciliação do caixa em dia (lançamentos sem CC)", "Inadimplência e prazo médio de recebimento", "Margem por projeto apurada no mês", "Fechamento mensal no prazo"],
  ["Lançar e conciliar o fluxo de caixa com centro de custo", "Controlar contas a pagar e a receber e parcelas de contrato", "Manter custos fixos e custo/hora atualizados no portal",
    "Apurar resultado por projeto e por cliente", "Interface com contabilidade e obrigações fiscais", "Fechar o resumo executivo mensal"],
  [m("Rotinas financeiras e conciliação", "-", 2, 3), m("Custos e apropriação por projeto", "-", 2, 3), m("Tributos do regime da empresa", "-", 2, 3), m("Planilhas e sistemas financeiros", "-", 2, 3)]);
const COORD_ADM_RH = coord("administrativa e de RH",
  "Cuidar das pessoas e da estrutura administrativa: quadro, cargos (RCF), contratos e acordos, onboarding, desenvolvimento e rotinas administrativas.",
  ["RCFs aprovados e com ciência em dia", "Contratos e acordos sem vencimento sem tratativa", "Onboarding concluído no prazo", "Turnover e clima"],
  ["Manter o quadro, os cargos e os RCFs atualizados no portal", "Gerir contratos, acordos e vencimentos dos colaboradores", "Conduzir admissões, desligamentos e onboarding",
    "Organizar o ciclo de avaliação de desempenho e os PDIs", "Rotinas administrativas e de compras da sede"],
  [m("Gestão de pessoas e legislação trabalhista básica", "-", 2, 3), m("Estruturação de cargos e competências", "-", 2, 3), m("Rotinas administrativas", "-", 2, 3)]);
const COORD_JURIDICA = coord("jurídica",
  "Proteger a casa juridicamente: contratos com clientes, fornecedores e colaboradores, propriedade intelectual e conformidade.",
  ["Contratos revisados no prazo", "Pendências jurídicas abertas", "Riscos contratuais mapeados"],
  ["Elaborar e revisar contratos (clientes, fornecedores, PJ, NDA)", "Acompanhar obrigações contratuais e prazos", "Orientar sobre propriedade intelectual e confidencialidade", "Apoiar licitações e editais"],
  [m("Direito contratual e empresarial", "-", 3, 3), m("Propriedade intelectual", "-", 2, 3), m("Licitações e editais", "-", 2, 3)]);
const SOCIOS = rascunho("—",
  "Definir a estratégia, a cultura e os rumos da Intelecto e da CSTR, garantindo resultado, sustentabilidade financeira e desenvolvimento das pessoas.",
  ["Receita e margem consolidadas", "Cumprimento do planejamento estratégico", "Indicadores de pessoas e clima"],
  [], ["Aprovar estratégia, orçamento e investimentos", "Acompanhar resultado por área e por projeto", "Assumir interinamente funções vagas (comercial, financeiro)"],
  ["Representar a empresa perante clientes estratégicos, parceiros e investidores", "Aprovar RCFs, políticas e a estrutura organizacional", "Desenvolver as lideranças"],
  [m("Gestão estratégica e financeira", "-", 3, 3), m("Liderança e cultura", "-", 3, 3), m("Negociação estratégica", "-", 3, 3)],
  { educacao: "—", experiencia: "—", treinamento: "—", habilidade: "Visão estratégica e liderança" });

/** cid -> RCF (formato normalizaRcf). */
export const RCF_SEED = {
  engenheiro_jr: ENGENHEIRO, engenheiro_pl: ENGENHEIRO, engenheiro_sr: ENGENHEIRO,
  analista: ANALISTA, estagiario: ESTAGIO_QUIMICA,
  tecnico_lab: TECNICO_LAB, eletricista: ELETRICISTA, montagem: MONTAGEM,
  coord_tecnica: COORD_TECNICA, coord_comercial: COORD_COMERCIAL, coord_financeira: COORD_FINANCEIRA,
  coord_adm_rh: COORD_ADM_RH, coord_juridica: COORD_JURIDICA, socios: SOCIOS,
};
