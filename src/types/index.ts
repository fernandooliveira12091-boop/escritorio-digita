export type Role = "Gestor" | "Administrador" | "Colaborador";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  pointsGoal: number;
  financeAccess: boolean;
  active: boolean;
  online: boolean;
  color: string;
  teamId?: string;
  /** Conta de login (Supabase) ligada a este usuário. */
  authId?: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  memberIds: string[];
}

export interface Contact {
  id: string;
  name: string;
  document: string;
  phone: string;
  email: string;
  birthDate: string; // yyyy-MM-dd
  profession: string;
  address: string;
  city: string;
  origin: string;
  campaignId?: string;
  createdAt: string;
}

/** Parte de um processo informada pelo tribunal (polo A = ativo, P = passivo). */
export interface Party {
  nome: string;
  polo: string;
}

export interface Movement {
  id: string;
  date: string;
  text: string;
}

export interface ProcessDocument {
  id: string;
  name: string;
  createdAt: string;
}

export type ProcessStatus = "ativo" | "fechado" | "arquivado";

export interface LegalProcess {
  id: string;
  number: string; // máscara CNJ
  contactIds: string[];
  opposingParty: string;
  actionGroupId: string;
  actionTypeId: string;
  funnelId: string;
  stageId: string;
  responsibleId: string;
  partnerId?: string;
  court: string;
  value: number;
  status: ProcessStatus;
  outcome?: "ganho" | "perdido";
  /** Cadastrado automaticamente (DJEN) e ainda sem cliente vinculado. */
  needsReview?: boolean;
  className?: string;
  orgao?: string;
  /** Partes informadas pelo DJEN, para ajudar a revisar processos cadastrados automaticamente. */
  parties?: string;
  partiesList?: Party[];
  /** Lead vindo de campanha / conversa do WhatsApp. */
  campaignId?: string;
  conversationId?: string;
  /** Resultado da última consulta ao DataJud. */
  datajudFound?: boolean;
  createdAt: string;
  closedAt?: string; // fechamento (contrato assinado)
  filedAt?: string; // ajuizamento
  archivedAt?: string;
  capturedAt?: string; // última captura de andamentos
  movements: Movement[];
  documents: ProcessDocument[];
  history: Movement[];
  unreadHistory: boolean;
}

export type TaskStatus = "pendente" | "concluida";

export interface Task {
  id: string;
  title: string;
  typeId: string;
  contactId?: string;
  processId?: string;
  responsibleIds: string[];
  date: string; // data do compromisso (ISO)
  deadline?: string; // prazo fatal (ISO)
  priority: boolean;
  favorite: boolean;
  read: boolean;
  points: number;
  description: string;
  reminder: "nenhum" | "15min" | "1h" | "1d";
  status: TaskStatus;
  completedAt?: string;
  createdAt: string;
}

export type TransactionKind = "receita" | "despesa" | "transferencia";

export interface Transaction {
  id: string;
  kind: TransactionKind;
  description: string;
  category: string;
  value: number;
  dueDate: string; // vencimento yyyy-MM-dd
  paidDate?: string; // pagamento yyyy-MM-dd
  competence: string; // yyyy-MM
  accountId: string;
  toAccountId?: string;
  contactId?: string;
  processId?: string;
  /** Parcelamento: todas as parcelas de um mesmo lançamento têm o mesmo group. */
  installment?: { group: string; number: number; total: number };
}

export interface BankAccount {
  id: string;
  name: string;
  kind: "corrente" | "dinheiro" | "investimento" | "cartao";
  initialBalance: number;
}

export interface Agent {
  id: string;
  name: string;
  area: string;
  description: string;
  color: string;
  active: boolean;
}

export interface Template {
  id: string;
  name: string;
  area: string;
  content: string;
  updatedAt: string;
}

export interface Partner {
  id: string;
  name: string;
  oab: string;
  email: string;
  phone: string;
}

export interface Intimation {
  id: string;
  processId?: string;
  number: string;
  court: string;
  publishedAt: string;
  text: string;
  responsibleId?: string;
  status: "nova" | "lida" | "tratada";
  source?: "djen" | "demo";
  oab?: string;
  orgao?: string;
  tipo?: string;
  link?: string;
  /** Partes da comunicação (destinatários), ex.: "Fulano x Empresa S.A.". */
  partes?: string;
  partesList?: Party[];
  className?: string;
}

export interface MonitoredTerm {
  id: string;
  term: string;
  kind: "OAB" | "Nome";
  oabUf?: string;
  oabNumber?: string;
  lastSyncAt?: string;
  lastCount?: number;
  lastError?: string | null;
  createdAt: string;
}

export interface Stage {
  id: string;
  name: string;
}

export interface Funnel {
  id: string;
  name: string;
  stages: Stage[];
}

export interface ActionGroup {
  id: string;
  name: string;
}

export interface ActionType {
  id: string;
  name: string;
  groupId: string;
}

export interface TaskType {
  id: string;
  name: string;
  points: number;
}

export interface Notification {
  id: string;
  title: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

export interface AccessLog {
  id: string;
  userId: string;
  at: string;
  action: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export type ContractStage = "negociacao" | "proposta" | "assinatura" | "fechado" | "perdido";

/** Contrato de honorários, acompanhado em quadro da negociação até a assinatura. */
export interface Contract {
  id: string;
  contactId: string;
  /** Tipo de ação ou serviço, ex.: Salário-maternidade. */
  title: string;
  area: string;
  stage: ContractStage;
  /** Honorários contratados (valor total). */
  value: number;
  installments: number;
  firstDueDate: string;
  /** Valor pago (ou a pagar) a parceiro que indicou o cliente. */
  partnerValue: number;
  partnerId?: string;
  /** Data importante do caso (ex.: data do parto) e o nome dela. */
  eventDate: string;
  eventLabel: string;
  /** Previdenciário: o cliente precisa pagar contribuição antes do pedido? null = não informado. */
  needsContribution: boolean | null;
  processId?: string;
  responsibleId: string;
  signedAt?: string;
  lostReason?: string;
  financeLaunched?: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignChannel = "meta" | "tiktok" | "google" | "outro";

/** Campanha de anúncios. O código vai no link do WhatsApp ([BPC1]) para identificar de onde veio o lead. */
export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  code: string;
  area: string;
  budget: number;
  startDate: string;
  endDate: string;
  status: "ativa" | "pausada" | "encerrada";
  /** IDs dos anúncios da Meta (clique para WhatsApp), separados por vírgula. */
  adIds: string;
  notes: string;
  createdAt: string;
}

export interface ChatMsg {
  id: string;
  from: "cliente" | "ia" | "equipe" | "sistema";
  text: string;
  at: string;
  waId?: string;
  by?: string;
}

/** Conversa do WhatsApp. Escrita só pelo servidor (função whatsapp); o sistema lê e pede ações. */
export interface Conversation {
  id: string;
  channel: "whatsapp";
  phone: string;
  name: string;
  status: "ia" | "humano";
  aiPaused: boolean;
  messages: ChatMsg[];
  lastInboundAt?: string;
  lastMessageAt?: string;
  campaignId?: string;
  referral?: { sourceId?: string; sourceType?: string; sourceUrl?: string; headline?: string };
  contactId?: string;
  processId?: string;
  handoffReason?: string;
  lead?: { nome: string; cidade: string; area: string; assunto: string; resumo: string; urgencia: "baixa" | "media" | "alta"; melhorHorario: string; at: string };
  createdAt: string;
}

export interface AgentSettings {
  enabled: boolean;
  whatsappNumber: string;
  officeHours: string;
  instructions: string;
  handoffMessage: string;
}

export interface Settings {
  officeName: string;
  officeCity: string;
  currentUserId: string;
  closingGoal: number;
  accessLogEnabled: boolean;
  trialEndsAt: string;
  funnels: Funnel[];
  actionGroups: ActionGroup[];
  actionTypes: ActionType[];
  taskTypes: TaskType[];
  origins: string[];
  categories: { receita: string[]; despesa: string[] };
  notifyEmail: boolean;
  notifyPush: boolean;
  aiEnabled: boolean;
  apiKey: string;
  inbox: string;
  agent?: AgentSettings;
}
