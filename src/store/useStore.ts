import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildMockData } from "../mocks/data";
import type {
  AccessLog, Agent, BankAccount, Contact, Intimation, LegalProcess, MonitoredTerm, Notification, Partner, Settings, Task, Team, Template, Transaction, User,
} from "../types";
import { uid } from "../lib/format";
import { cloudMode } from "../lib/supabase";

export interface Collections {
  users: User[];
  teams: Team[];
  contacts: Contact[];
  processes: LegalProcess[];
  tasks: Task[];
  transactions: Transaction[];
  accounts: BankAccount[];
  agents: Agent[];
  templates: Template[];
  partners: Partner[];
  intimations: Intimation[];
  notifications: Notification[];
  monitoredTerms: MonitoredTerm[];
  accessLogs: AccessLog[];
}
export type CollectionKey = keyof Collections;
export const COLLECTION_KEYS: CollectionKey[] = [
  "users", "teams", "contacts", "processes", "tasks", "transactions", "accounts", "agents", "templates", "partners", "intimations", "notifications", "monitoredTerms", "accessLogs",
];
type Item<K extends CollectionKey> = Collections[K][number];

interface State extends Collections {
  settings: Settings;
  /** Usuário logado neste aparelho (não é compartilhado com a equipe). */
  meId: string | null;
  setMe: (id: string | null) => void;
  upsert: <K extends CollectionKey>(key: K, item: Item<K>) => void;
  remove: <K extends CollectionKey>(key: K, id: string) => void;
  removeMany: <K extends CollectionKey>(key: K, ids: string[]) => void;
  patch: <K extends CollectionKey>(key: K, id: string, changes: Partial<Item<K>>) => void;
  updateSettings: (changes: Partial<Settings>) => void;
  completeTask: (id: string, done?: boolean) => void;
  moveProcess: (id: string, funnelId: string, stageId: string) => void;
  addMovement: (processId: string, text: string) => void;
  log: (action: string) => void;
  resetDemo: () => void;
}

const now = () => new Date().toISOString();

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...buildMockData(),
      meId: null,
      setMe: (meId) => set({ meId }),

      upsert: (key, item) =>
        set((s) => {
          const list = s[key] as { id: string }[];
          const exists = list.some((x) => x.id === item.id);
          return { [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] } as Partial<State>;
        }),
      remove: (key, id) => set((s) => ({ [key]: (s[key] as { id: string }[]).filter((x) => x.id !== id) }) as Partial<State>),
      removeMany: (key, ids) => set((s) => ({ [key]: (s[key] as { id: string }[]).filter((x) => !ids.includes(x.id)) }) as Partial<State>),
      patch: (key, id, changes) =>
        set((s) => ({ [key]: (s[key] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...changes } : x)) }) as Partial<State>),
      updateSettings: (changes) => set((s) => ({ settings: { ...s.settings, ...changes } })),

      // Concluir soma os pontos ao(s) responsável(is): o Taskscore lê completedAt e points.
      completeTask: (id, done = true) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: done ? "concluida" : "pendente", completedAt: done ? now() : undefined } : t)),
        })),

      moveProcess: (id, funnelId, stageId) => {
        const s = get();
        const funnel = s.settings.funnels.find((f) => f.id === funnelId);
        const stage = funnel?.stages.find((st) => st.id === stageId);
        set({
          processes: s.processes.map((p) =>
            p.id === id
              ? {
                  ...p,
                  funnelId,
                  stageId,
                  history: [...p.history, { id: uid("h"), date: now(), text: `Movido para ${funnel?.name} › ${stage?.name}` }],
                  unreadHistory: true,
                  archivedAt: funnel?.name === "Arquivamento" ? now() : p.archivedAt,
                  // Workflow: chegar em "Contrato assinado" conta como fechamento do mês.
                  closedAt: stage?.name === "Contrato assinado" && !p.closedAt ? now() : p.closedAt,
                  status: funnel?.name === "Arquivamento" ? "arquivado" : p.status === "arquivado" ? "ativo" : p.status,
                }
              : p,
          ),
        });
      },

      addMovement: (processId, text) =>
        set((s) => ({
          processes: s.processes.map((p) =>
            p.id === processId ? { ...p, movements: [...p.movements, { id: uid("m"), date: now(), text }], capturedAt: now() } : p,
          ),
        })),

      log: (action) => {
        const s = get();
        if (!s.settings.accessLogEnabled) return;
        set({ accessLogs: [{ id: uid("log"), userId: s.meId ?? s.settings.currentUserId, at: now(), action }, ...s.accessLogs].slice(0, 500) });
      },

      resetDemo: () => set({ ...buildMockData() }),
    }),
    {
      name: "escritorio-digital-v1",
      version: 1,
      // Com login, os dados vêm do servidor e não ficam guardados no navegador.
      storage: createJSONStorage(() => (cloudMode ? { getItem: () => null, setItem: () => {}, removeItem: () => {} } : localStorage)),
      partialize: (s) => { const { meId: _me, ...rest } = s; return rest; },
    },
  ),
);

/** Usuário logado. */
export const useCurrentUser = () =>
  useStore((s) => s.users.find((u) => u.id === (s.meId ?? s.settings.currentUserId)) ?? s.users[0] ?? FALLBACK_USER);

const FALLBACK_USER: User = { id: "-", name: "Usuário", email: "", role: "Colaborador", pointsGoal: 0, financeAccess: false, active: true, online: true, color: "#2F80ED", createdAt: new Date(0).toISOString() };
