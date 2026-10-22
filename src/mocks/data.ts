import { addDays, addMonths, format, setHours, setMinutes, startOfMonth, subDays, subMonths } from "date-fns";
import type {
  Agent, BankAccount, Contact, Funnel, Intimation, LegalProcess, MonitoredTerm, Notification, Partner, Settings, Task, Team, Template, Transaction, User,
} from "../types";

// Gerador determinístico, para os dados de exemplo serem sempre os mesmos.
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const day = (d: Date) => format(d, "yyyy-MM-dd");
const iso = (d: Date) => d.toISOString();
const at = (d: Date, h: number, m = 0) => setMinutes(setHours(d, h), m);

export function buildMockData(now = new Date()) {
  seed = 42;
  const monthStart = startOfMonth(now);

  const users: User[] = [
    { id: "u1", name: "Fernando Oliveira", email: "fernando@escritorio.adv.br", role: "Gestor", pointsGoal: 120, financeAccess: true, active: true, online: true, color: "#2F80ED", teamId: "t1", createdAt: iso(subMonths(now, 14)) },
    { id: "u2", name: "Ana Paula Ribeiro", email: "ana@escritorio.adv.br", role: "Administrador", pointsGoal: 100, financeAccess: true, active: true, online: true, color: "#9B51E0", teamId: "t1", createdAt: iso(subMonths(now, 9)) },
    { id: "u3", name: "Lucas Mendes", email: "lucas@escritorio.adv.br", role: "Colaborador", pointsGoal: 80, financeAccess: false, active: true, online: false, color: "#27AE60", teamId: "t2", createdAt: iso(subMonths(now, 3)) },
  ];
  const teams: Team[] = [
    { id: "t1", name: "Contencioso", memberIds: ["u1", "u2"] },
    { id: "t2", name: "Atendimento", memberIds: ["u3"] },
  ];

  const funnels: Funnel[] = [
    ["Marketing", ["Análise de Resultados", "Planejamento", "Produção", "Promoção", "Relacionamento"]],
    ["Negociação", ["Primeiro contato", "Proposta enviada", "Em negociação", "Contrato assinado"]],
    ["Consultoria", ["Triagem", "Análise", "Parecer", "Entregue"]],
    ["Administrativo", ["Requerimento", "Em análise", "Exigência", "Decisão"]],
    ["Judicial", ["Petição inicial", "Citação", "Instrução", "Sentença"]],
    ["Recursal", ["Recurso interposto", "Contrarrazões", "Julgamento"]],
    ["Execução", ["Cumprimento de sentença", "Penhora", "Pagamento"]],
    ["Financeiro", ["A cobrar", "Em cobrança", "Recebido"]],
    ["Arquivamento", ["A arquivar", "Arquivado"]],
  ].map(([name, stages], i) => ({
    id: `f${i + 1}`,
    name: name as string,
    stages: (stages as string[]).map((s, j) => ({ id: `f${i + 1}s${j + 1}`, name: s })),
  }));

  const actionGroups = [
    { id: "g1", name: "Cível" }, { id: "g2", name: "Consumidor" }, { id: "g3", name: "Previdenciário" },
    { id: "g4", name: "Trabalhista" }, { id: "g5", name: "Administrativo" }, { id: "g6", name: "Família" },
  ];
  const actionTypes = [
    { id: "a1", name: "Reparação de danos (trânsito)", groupId: "g1" },
    { id: "a2", name: "Cobrança", groupId: "g1" },
    { id: "a3", name: "Overbooking / atraso de voo", groupId: "g2" },
    { id: "a4", name: "Negativação indevida", groupId: "g2" },
    { id: "a5", name: "Aposentadoria por idade", groupId: "g3" },
    { id: "a6", name: "BPC/LOAS", groupId: "g3" },
    { id: "a7", name: "Reclamação trabalhista", groupId: "g4" },
    { id: "a8", name: "Nulidade de licitação", groupId: "g5" },
    { id: "a9", name: "Divórcio consensual", groupId: "g6" },
    { id: "a10", name: "Alimentos", groupId: "g6" },
  ];

  const taskTypes = [
    { id: "tt1", name: "Prazo processual", points: 10 },
    { id: "tt2", name: "Audiência", points: 15 },
    { id: "tt3", name: "Petição", points: 8 },
    { id: "tt4", name: "Reunião com cliente", points: 5 },
    { id: "tt5", name: "Diligência", points: 6 },
    { id: "tt6", name: "Retorno ao cliente", points: 3 },
  ];

  const origins = ["Indicação", "Instagram", "Google", "Site", "Parceiro", "Ex-cliente"];
  const names = [
    "Maria Aparecida dos Santos", "João Pedro Almeida", "Carla Fernanda Souza", "Antônio Carlos Lima", "Juliana Martins Rocha",
    "Roberto Silva Nunes", "Patrícia Gomes Freitas", "Marcos Vinícius Teixeira", "Luciana Barbosa Dias", "Rafael Costa Pereira",
    "Sandra Regina Moura", "Diego Henrique Araújo", "Construtora Planalto Ltda.", "Transportes Cerrado ME", "Helena Cristina Vaz",
  ];
  const professions = ["Professora", "Motorista de aplicativo", "Enfermeira", "Aposentado", "Comerciante", "Servidor público", "Autônomo", "Empresário", "Vigilante", "Cabeleireira"];
  const cities = ["Brasília/DF", "Taguatinga/DF", "Ceilândia/DF", "Samambaia/DF", "Águas Claras/DF", "Gama/DF", "Valparaíso de Goiás/GO", "Planaltina/DF"];
  const contacts: Contact[] = names.map((name, i) => {
    const company = name.includes("Ltda") || name.includes(" ME");
    const age = 22 + Math.floor(rnd() * 50);
    const birth = subDays(subMonths(now, age * 12), Math.floor(rnd() * 360));
    const birthDate = i === 2 || i === 9 ? format(now, `${format(birth, "yyyy")}-MM-dd`) : day(birth);
    return {
      id: `c${i + 1}`,
      name,
      document: company ? `${10 + i}.${300 + i}.${400 + i}/0001-${10 + i}` : `${100 + i * 7}.${200 + i * 3}.${300 + i * 11}-${10 + i}`,
      phone: `(61) 9${8100 + i * 37}-${1000 + i * 113}`,
      email: name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + i + "@email.com",
      birthDate: company ? "" : birthDate,
      profession: company ? "Pessoa jurídica" : pick(professions),
      address: `Quadra ${10 + i}, Conjunto ${String.fromCharCode(65 + (i % 6))}, Casa ${i + 2}`,
      city: pick(cities),
      origin: pick(origins),
      createdAt: iso(subDays(now, Math.floor(rnd() * 120) + (i < 4 ? 0 : 20))),
    };
  });

  const partners: Partner[] = [
    { id: "p1", name: "Dra. Beatriz Campos", oab: "OAB/DF 54.321", email: "beatriz@campos.adv.br", phone: "(61) 99876-1234" },
    { id: "p2", name: "Silva & Prado Advogados", oab: "OAB/GO 12.345", email: "contato@silvaprado.adv.br", phone: "(62) 98765-4321" },
  ];

  const opponents = ["Detran-DF", "Companhia Aérea Azul Céu S.A.", "INSS", "Banco Horizonte S.A.", "Distrito Federal", "Operadora Conecta Ltda.", "Seguradora Brasil Vida"];
  const processSpecs: [string, string, number, string, LegalProcess["status"]][] = [
    // funil, tipo de ação, índice da etapa, contato, status
    ["f1", "a3", 0, "c2", "ativo"], ["f1", "a4", 2, "c5", "ativo"],
    ["f2", "a1", 1, "c1", "ativo"], ["f2", "a9", 3, "c7", "fechado"],
    ["f3", "a8", 1, "c13", "ativo"],
    ["f4", "a5", 0, "c4", "ativo"], ["f4", "a6", 2, "c11", "ativo"],
    ["f5", "a1", 0, "c6", "ativo"], ["f5", "a7", 2, "c8", "ativo"], ["f5", "a2", 3, "c14", "ativo"],
    ["f6", "a4", 1, "c10", "ativo"],
    ["f9", "a10", 1, "c9", "arquivado"],
  ];
  const processes: LegalProcess[] = processSpecs.map(([funnelId, actionTypeId, stageIdx, contactId, status], i) => {
    const funnel = funnels.find((f) => f.id === funnelId)!;
    const created = subDays(now, 10 + Math.floor(rnd() * 200));
    const movDays = [3, 45, 12, 1, 60, 8, 35, 20, 5, 95, 2, 40][i];
    const movements = [
      { id: `m${i}a`, date: iso(subDays(created, -2)), text: "Distribuído por sorteio" },
      { id: `m${i}b`, date: iso(subDays(now, movDays + 10)), text: "Conclusos para despacho" },
      { id: `m${i}c`, date: iso(subDays(now, movDays)), text: pick(["Juntada de petição", "Expedida intimação eletrônica", "Decisão interlocutória proferida", "Designada audiência de conciliação", "Citação realizada"]) },
    ];
    const seq = String(700000 + i * 3127).padStart(7, "0");
    return {
      id: `pr${i + 1}`,
      number: `${seq}-${String(10 + i * 7).slice(-2)}.${format(created, "yyyy")}.8.07.${["0001", "0003", "0007", "0009"][i % 4]}`,
      contactIds: [contactId],
      opposingParty: pick(opponents),
      actionGroupId: actionTypes.find((a) => a.id === actionTypeId)!.groupId,
      actionTypeId,
      funnelId,
      stageId: funnel.stages[stageIdx].id,
      responsibleId: users[i % 3].id,
      partnerId: i === 2 || i === 8 ? "p1" : i === 6 ? "p2" : undefined,
      court: pick(["TJDFT", "TJDFT", "TRF1", "TRT10"]),
      value: Math.round(3000 + rnd() * 60000),
      status,
      createdAt: iso(i < 3 ? subDays(now, Math.min(now.getDate() - 1, 3 + i)) : created),
      closedAt: i === 3 || i === 2 ? iso(subDays(now, i)) : i === 7 ? iso(subMonths(now, 1)) : undefined,
      filedAt: funnelId === "f5" ? iso(i === 7 ? subDays(now, 2) : subMonths(created, -1)) : undefined,
      archivedAt: status === "arquivado" ? iso(subDays(now, 4)) : undefined,
      capturedAt: i === 4 || i === 10 ? undefined : iso(subDays(now, movDays)),
      movements,
      documents: [
        { id: `d${i}a`, name: "Procuração.pdf", createdAt: iso(created) },
        { id: `d${i}b`, name: "Contrato de honorários.pdf", createdAt: iso(created) },
      ],
      history: [{ id: `h${i}`, date: iso(created), text: "Processo cadastrado" }],
      unreadHistory: i % 3 === 0,
      outcome: i === 3 ? "ganho" : i === 11 ? "perdido" : undefined,
    };
  });

  const taskTitles = [
    "Réplica à contestação", "Audiência de conciliação", "Protocolar petição inicial", "Reunião de alinhamento", "Juntar CNIS atualizado",
    "Contrarrazões de apelação", "Retornar ligação do cliente", "Cumprimento de sentença", "Emenda à inicial", "Diligência no cartório",
    "Manifestação sobre laudo pericial", "Audiência de instrução", "Enviar proposta de honorários", "Recurso inominado", "Atualizar cálculos",
    "Impugnação ao cumprimento", "Reunião com perito", "Memoriais", "Pedido de tutela de urgência", "Notificação extrajudicial",
    "Embargos de declaração", "Agravo de instrumento", "Petição de habilitação", "Conferir publicação no DJEN", "Requerimento administrativo INSS",
  ];
  const tasks: Task[] = taskTitles.map((title, i) => {
    const type = taskTypes[i % taskTypes.length];
    const dayOfMonth = 1 + ((i * 5 + 3) % 28);
    const date = at(addDays(monthStart, dayOfMonth - 1), 8 + (i % 10), i % 2 ? 30 : 0);
    const deadline = type.id === "tt1" || i % 4 === 0 ? at(addDays(date, 2), 23, 59) : undefined;
    const due = deadline || date;
    const done = due < now ? i % 3 !== 0 : i % 7 === 0;
    const proc = processes[i % processes.length];
    const lateDone = done && i % 5 === 0;
    return {
      id: `tk${i + 1}`,
      title,
      typeId: type.id,
      contactId: proc.contactIds[0],
      processId: i % 6 === 5 ? undefined : proc.id,
      responsibleIds: i % 8 === 0 ? ["u1", "u2"] : [users[i % 3].id],
      date: iso(date),
      deadline: deadline ? iso(deadline) : undefined,
      priority: i % 4 === 1,
      favorite: i % 6 === 2,
      read: i % 3 !== 0,
      points: type.points,
      description: "",
      reminder: "1h",
      status: done ? "concluida" : "pendente",
      completedAt: done ? iso(lateDone ? addDays(due, 1) : due < now ? subDays(due, 0.1) : now) : undefined,
      createdAt: iso(subDays(date, 5)),
    };
  });
  // Algumas tarefas concluídas no mês anterior, para o comparativo dos indicadores.
  for (let i = 0; i < 6; i++) {
    const d = at(addDays(subMonths(monthStart, 1), 3 + i * 4), 10);
    tasks.push({
      id: `tkp${i}`, title: pick(taskTitles), typeId: taskTypes[i % 6].id, contactId: contacts[i].id, responsibleIds: [users[i % 3].id],
      date: iso(d), priority: false, favorite: false, read: true, points: taskTypes[i % 6].points, description: "", reminder: "nenhum",
      status: "concluida", completedAt: iso(d), createdAt: iso(subDays(d, 3)),
    });
  }

  const accounts: BankAccount[] = [
    { id: "b1", name: "Conta Principal", kind: "corrente", initialBalance: 18500 },
    { id: "b2", name: "Dinheiro", kind: "dinheiro", initialBalance: 1200 },
    { id: "b3", name: "Investimentos", kind: "investimento", initialBalance: 42000 },
    { id: "b4", name: "Cartão de crédito", kind: "cartao", initialBalance: 0 },
  ];
  const txSpecs: [Transaction["kind"], string, string, number, number, boolean, string][] = [
    // tipo, descrição, categoria, valor, mês (offset), pago, conta
    ["receita", "Honorários contratuais - parcela 2/6", "Honorários contratuais", 800, 0, false, "b1"],
    ["receita", "Consulta inicial", "Consulta", 350, 0, true, "b1"],
    ["receita", "Honorários de êxito - acordo", "Honorários de êxito", 4200, 0, true, "b1"],
    ["receita", "Honorários contratuais - parcela 1/12", "Honorários contratuais", 208.33, 0, true, "b1"],
    ["receita", "Parecer jurídico", "Consultoria", 1500, 0, false, "b1"],
    ["despesa", "Aluguel da sala", "Aluguel", 2200, 0, true, "b1"],
    ["despesa", "Custas iniciais", "Custas processuais", 185.5, 0, false, "b2"],
    ["despesa", "Assinatura de software jurídico", "Software", 189.9, 0, true, "b4"],
    ["despesa", "Anuidade OAB - parcela", "Impostos e taxas", 98.4, 0, false, "b1"],
    ["despesa", "Internet e telefone", "Despesas fixas", 220, 0, true, "b4"],
    ["receita", "Honorários contratuais - parcela 3/6", "Honorários contratuais", 800, 1, false, "b1"],
    ["receita", "Honorários contratuais - parcela 2/12", "Honorários contratuais", 208.33, 1, false, "b1"],
    ["despesa", "Aluguel da sala", "Aluguel", 2200, 1, false, "b1"],
    ["receita", "Honorários de êxito previstos", "Honorários de êxito", 6500, 2, false, "b1"],
    ["despesa", "Aluguel da sala", "Aluguel", 2200, 2, false, "b1"],
    ["receita", "Honorários contratuais - parcela 4/6", "Honorários contratuais", 800, 3, false, "b1"],
    ["despesa", "Aluguel da sala", "Aluguel", 2200, 3, false, "b1"],
    ["receita", "Consultoria empresarial mensal", "Consultoria", 2500, 4, false, "b1"],
    ["receita", "Honorários contratuais - parcela 1/6", "Honorários contratuais", 800, -1, true, "b1"],
    ["despesa", "Aluguel da sala", "Aluguel", 2200, -1, true, "b1"],
  ];
  const transactions: Transaction[] = txSpecs.map(([kind, description, category, value, m, paid, accountId], i) => {
    const due = addDays(startOfMonth(addMonths(now, m)), (i * 3) % 25 + 2);
    return {
      id: `tx${i + 1}`, kind, description, category, value, dueDate: day(due),
      paidDate: paid ? day(due < now ? due : now) : undefined,
      competence: format(due, "yyyy-MM"), accountId,
      contactId: kind === "receita" ? contacts[i % contacts.length].id : undefined,
    };
  });

  const agents: Agent[] = [
    ["Geral", "Petições, notificações e pareceres de qualquer área.", "#2F80ED", true],
    ["Imobiliário", "Contratos de locação, despejo, usucapião e distratos.", "#F2994A", false],
    ["Responsabilidade civil", "Danos materiais, morais e lucros cessantes.", "#EB5757", true],
    ["Propriedade intelectual", "Marcas, direitos autorais e concorrência desleal.", "#9B51E0", false],
    ["Ambiental", "Licenciamento, autos de infração e TACs.", "#27AE60", false],
    ["Administrativo", "Licitações, servidores e processos administrativos.", "#2D9CDB", false],
    ["Trânsito", "Recursos de multa, CNH e acidentes de trânsito.", "#F2C94C", false],
    ["Família", "Divórcio, guarda, alimentos e inventário.", "#BB6BD9", false],
    ["Saúde", "Planos de saúde, medicamentos e erro médico.", "#6FCF97", false],
    ["Empresarial", "Contratos societários, recuperação e cobrança.", "#56CCF2", false],
  ].map(([area, description, color, active], i) => ({
    id: `ag${i + 1}`, name: `Agente ${area}`, area: area as string, description: description as string, color: color as string, active: active as boolean,
  }));

  const templates: Template[] = [
    {
      id: "tp1", name: "Procuração ad judicia", area: "Geral", updatedAt: iso(subDays(now, 10)),
      content: `PROCURAÇÃO\n\nOUTORGANTE: {{cliente.nome}}, {{cliente.profissao}}, inscrito(a) no CPF/CNPJ nº {{cliente.documento}}, residente em {{cliente.endereco}}, {{cliente.cidade}}, telefone {{cliente.celular}}, e-mail {{cliente.email}}.\n\nOUTORGADO: {{escritorio.advogado}}, advogado.\n\nPODERES: pelo presente instrumento, o(a) outorgante confere ao outorgado os poderes da cláusula ad judicia et extra para o foro em geral, nos termos do art. 105 do Código de Processo Civil, podendo confessar, transigir, desistir, renunciar, receber e dar quitação e substabelecer.\n\n{{escritorio.cidade}}, {{data.extenso}}.\n\n______________________________\n{{cliente.nome}}`,
    },
    {
      id: "tp2", name: "Declaração de hipossuficiência", area: "Geral", updatedAt: iso(subDays(now, 8)),
      content: `DECLARAÇÃO DE HIPOSSUFICIÊNCIA\n\nEu, {{cliente.nome}}, {{cliente.profissao}}, inscrito(a) no CPF nº {{cliente.documento}}, residente em {{cliente.endereco}}, {{cliente.cidade}}, DECLARO, sob as penas da lei, que não possuo condições de arcar com as custas processuais sem prejuízo do meu sustento, para fins de gratuidade da justiça (CF, art. 5º, LXXIV, e CPC, art. 98).\n\n{{escritorio.cidade}}, {{data.extenso}}.\n\n______________________________\n{{cliente.nome}}`,
    },
    {
      id: "tp3", name: "Petição de juntada", area: "Geral", updatedAt: iso(subDays(now, 2)),
      content: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO\n\nProcesso nº {{processo.numero}}\n\n{{cliente.nome}}, já qualificado(a) nos autos da {{processo.tipo}} movida em face de {{processo.parte_contraria}}, vem, por seu advogado, requerer a juntada dos documentos anexos.\n\nNestes termos, pede deferimento.\n\n{{escritorio.cidade}}, {{data.extenso}}.\n\n{{escritorio.advogado}}`,
    },
  ];

  const notifications: Notification[] = [
    { id: "n1", title: "Nova intimação recebida no DJEN", createdAt: iso(subDays(now, 0)), read: false, link: "/intimacoes" },
    { id: "n2", title: "Prazo fatal amanhã: Réplica à contestação", createdAt: iso(subDays(now, 0)), read: false, link: "/atividades" },
    { id: "n3", title: "Ana Paula concluiu \"Audiência de conciliação\"", createdAt: iso(subDays(now, 1)), read: true, link: "/atividades" },
  ];

  const intimations: Intimation[] = [];

  const settings: Settings = {
    officeName: "Escritório Digital",
    officeCity: "Brasília/DF",
    currentUserId: "u1",
    closingGoal: 0,
    accessLogEnabled: false,
    trialEndsAt: iso(addDays(now, 7)),
    funnels,
    actionGroups,
    actionTypes,
    taskTypes,
    origins,
    categories: {
      receita: ["Honorários contratuais", "Honorários de êxito", "Honorários de sucumbência", "Consulta", "Consultoria", "Outras receitas"],
      despesa: ["Aluguel", "Custas processuais", "Software", "Impostos e taxas", "Despesas fixas", "Marketing", "Outras despesas"],
    },
    notifyEmail: true,
    notifyPush: true,
    aiEnabled: true,
    apiKey: "",
    inbox: "",
  };

  return { users, teams, contacts, processes, tasks, transactions, accounts, agents, templates, partners, intimations, notifications, settings, monitoredTerms: [DEFAULT_OAB()], accessLogs: [] };
}

/** OAB monitorada por padrão nas intimações. */
export const DEFAULT_OAB = (): MonitoredTerm => ({ id: "oab_df_70620", term: "OAB/DF 70.620", kind: "OAB", oabUf: "DF", oabNumber: "70620", createdAt: new Date().toISOString() });

export const PUBLIC_LIBRARY: Template[] = [
  ["Notificação extrajudicial", "Cível"], ["Contestação - modelo base", "Cível"], ["Petição inicial - danos morais", "Responsabilidade civil"],
  ["Ação de alimentos", "Família"], ["Divórcio consensual", "Família"], ["Recurso de multa de trânsito", "Trânsito"],
  ["Requerimento de aposentadoria", "Previdenciário"], ["Mandado de segurança - licitação", "Administrativo"],
  ["Ação contra plano de saúde", "Saúde"], ["Contrato de locação residencial", "Imobiliário"], ["Reclamação trabalhista", "Trabalhista"],
  ["Contrato social - LTDA", "Empresarial"],
].map(([name, area], i) => ({
  id: `lib${i + 1}`, name, area, updatedAt: new Date(2026, 8, 1 + i).toISOString(),
  content: `${name.toUpperCase()}\n\n{{cliente.nome}}, inscrito(a) no CPF/CNPJ nº {{cliente.documento}}, residente em {{cliente.endereco}}, {{cliente.cidade}}, vem, por seu advogado {{escritorio.advogado}}, expor e requerer o que segue.\n\nI. DOS FATOS\n[Descreva os fatos.]\n\nII. DO DIREITO\n[Fundamentação.]\n\nIII. DOS PEDIDOS\n[Pedidos.]\n\n{{escritorio.cidade}}, {{data.extenso}}.`,
}));
