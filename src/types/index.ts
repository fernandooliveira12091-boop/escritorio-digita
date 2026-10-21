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
  createdAt: string;
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
}

export interface MonitoredTerm {
  id: string;
  term: string;
  kind: "OAB" | "Nome";
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
}
