import type { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";
import { uid } from "../lib/format";
import { supabase } from "../lib/supabase";
import { buildMockData } from "../mocks/data";
import type { Settings, User } from "../types";
import { COLLECTION_KEYS, useStore, type CollectionKey, type Collections } from "./useStore";

/**
 * Sincronização com o Supabase.
 * Cada item (tarefa, contato, processo…) é uma linha da tabela `records`.
 * A sincronização observa a store: o que mudou vai para o servidor, e o que
 * outros aparelhos gravam chega pelo canal em tempo real.
 */

export type SyncStatus = "idle" | "saving" | "saved" | "error";
export const useSyncStatus = create<{ status: SyncStatus; error?: string }>(() => ({ status: "idle" }));

const CLIENT_ID = uid("client"); // identifica esta aba, para ignorar o eco das próprias gravações
const SETTINGS = "settings";
type Row = { workspace_id: string; collection: string; id: string; data: unknown; client_id?: string };

let applyingRemote = false;
let stopFns: (() => void)[] = [];
const pendingUpserts = new Map<string, Row>();
const pendingDeletes = new Map<string, { collection: string; id: string }>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let workspaceId = "";

function applyRemote(fn: () => void) {
  applyingRemote = true;
  try {
    fn();
  } finally {
    applyingRemote = false;
  }
}

function queueUpsert(collection: string, id: string, data: unknown) {
  const key = `${collection}/${id}`;
  pendingDeletes.delete(key);
  pendingUpserts.set(key, { workspace_id: workspaceId, collection, id, data, client_id: CLIENT_ID });
  scheduleFlush();
}
function queueDelete(collection: string, id: string) {
  const key = `${collection}/${id}`;
  pendingUpserts.delete(key);
  pendingDeletes.set(key, { collection, id });
  scheduleFlush();
}
function scheduleFlush() {
  useSyncStatus.setState({ status: "saving" });
  clearTimeout(flushTimer);
  // Agrupa a digitação e as mudanças em lote numa só gravação.
  flushTimer = setTimeout(flush, 600);
}

export async function flush() {
  if (!supabase || !workspaceId) return;
  clearTimeout(flushTimer);
  const ups = [...pendingUpserts.values()];
  const dels = [...pendingDeletes.values()];
  pendingUpserts.clear();
  pendingDeletes.clear();
  if (!ups.length && !dels.length) return;
  try {
    for (let i = 0; i < ups.length; i += 500) {
      const { error } = await supabase.from("records").upsert(ups.slice(i, i + 500).map((r) => ({ ...r, updated_at: new Date().toISOString() })));
      if (error) throw error;
    }
    const byCollection = dels.reduce<Record<string, string[]>>((a, d) => ((a[d.collection] ||= []).push(d.id), a), {});
    for (const [collection, ids] of Object.entries(byCollection)) {
      const { error } = await supabase.from("records").delete().eq("workspace_id", workspaceId).eq("collection", collection).in("id", ids);
      if (error) throw error;
    }
    if (!pendingUpserts.size && !pendingDeletes.size) useSyncStatus.setState({ status: "saved", error: undefined });
  } catch (e) {
    // Devolve à fila para tentar de novo na próxima alteração ou em 10 s.
    ups.forEach((r) => !pendingUpserts.has(`${r.collection}/${r.id}`) && pendingUpserts.set(`${r.collection}/${r.id}`, r));
    dels.forEach((d) => !pendingUpserts.has(`${d.collection}/${d.id}`) && pendingDeletes.set(`${d.collection}/${d.id}`, d));
    useSyncStatus.setState({ status: "error", error: (e as Error).message });
    flushTimer = setTimeout(flush, 10_000);
  }
}

type StoreState = ReturnType<typeof useStore.getState>;
function diffAndQueue(state: StoreState, prev: StoreState) {
  for (const key of COLLECTION_KEYS) {
    const cur = state[key] as { id: string }[];
    const old = prev[key] as { id: string }[];
    if (cur === old) continue;
    const oldMap = new Map(old.map((x) => [x.id, x]));
    for (const item of cur) if (oldMap.get(item.id) !== item) queueUpsert(key, item.id, item);
    const curIds = new Set(cur.map((x) => x.id));
    for (const item of old) if (!curIds.has(item.id)) queueDelete(key, item.id);
  }
  if (state.settings !== prev.settings) queueUpsert(SETTINGS, "main", state.settings);
}

const emptyCollections = (): Collections => Object.fromEntries(COLLECTION_KEYS.map((k) => [k, []])) as unknown as Collections;

/** Dados iniciais de um escritório novo: exemplos completos, ou só a estrutura. */
export function initialData(withExamples: boolean, me: { name: string; email: string; authId: string }) {
  const mock = buildMockData();
  const meUser: User = { ...mock.users[0], name: me.name, email: me.email, authId: me.authId };
  if (withExamples) return { ...mock, users: [meUser, ...mock.users.slice(1)], settings: { ...mock.settings, currentUserId: meUser.id } };
  return {
    ...emptyCollections(),
    users: [meUser],
    accounts: mock.accounts.map((a) => ({ ...a, initialBalance: 0 })),
    agents: mock.agents,
    templates: mock.templates,
    settings: { ...mock.settings, currentUserId: meUser.id, trialEndsAt: mock.settings.trialEndsAt } as Settings,
  };
}

/** Liga o usuário logado ao cadastro da equipe (pelo authId ou pelo e-mail do convite). */
function linkCurrentUser(auth: { id: string; email: string; name: string }) {
  const s = useStore.getState();
  let me = s.users.find((u) => u.authId === auth.id) ?? s.users.find((u) => !u.authId && u.email.toLowerCase() === auth.email.toLowerCase());
  if (me && me.authId !== auth.id) {
    me = { ...me, authId: auth.id, active: true };
    s.upsert("users", me);
  }
  if (!me) {
    me = { id: uid("u"), name: auth.name, email: auth.email, role: "Colaborador", pointsGoal: 80, financeAccess: false, active: true, online: true, color: "#56CCF2", authId: auth.id, createdAt: new Date().toISOString() };
    s.upsert("users", me);
  }
  s.setMe(me.id);
}

/** Carrega o escritório do servidor e mantém tudo sincronizado. */
export async function startSync(wsId: string, auth: { id: string; email: string; name: string }, seed?: ReturnType<typeof initialData>) {
  if (!supabase) return;
  stopSync();
  workspaceId = wsId;

  // 1. Carrega todos os registros (em páginas de 1.000).
  const rows: { collection: string; id: string; data: unknown }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("records").select("collection,id,data").eq("workspace_id", wsId).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const loaded = emptyCollections() as unknown as Record<string, unknown[]>;
  let settings: Settings | undefined;
  for (const r of rows) {
    if (r.collection === SETTINGS) settings = r.data as Settings;
    else if (r.collection in loaded) loaded[r.collection].push(r.data);
  }
  const defaults = buildMockData().settings;
  applyRemote(() =>
    useStore.setState({ ...(loaded as unknown as Collections), settings: { ...defaults, ...(settings ?? {}) }, meId: null }),
  );

  // 2. Observa a store e envia as mudanças.
  stopFns.push(useStore.subscribe((state, prev) => { if (!applyingRemote) diffAndQueue(state, prev); }));

  // 3. Escritório recém-criado: grava os dados iniciais (a assinatura acima envia tudo).
  if (seed && rows.length === 0) useStore.setState({ ...seed });
  else if (!settings) queueUpsert(SETTINGS, "main", useStore.getState().settings);

  linkCurrentUser(auth);

  // 4. Recebe em tempo real o que outros aparelhos gravam.
  const channel: RealtimeChannel = supabase
    .channel(`records-${wsId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "records", filter: `workspace_id=eq.${wsId}` }, (payload) => {
      const row = (payload.new && "id" in payload.new ? payload.new : payload.old) as { workspace_id?: string; collection?: string; id?: string; data?: unknown; client_id?: string };
      // Exclusões chegam sem filtro do servidor: confere o escritório aqui.
      if (!row?.collection || !row.id || row.workspace_id !== wsId) return;
      if (payload.eventType !== "DELETE" && row.client_id === CLIENT_ID) return;
      if (pendingUpserts.has(`${row.collection}/${row.id}`)) return; // alteração local ainda não enviada vence
      applyRemote(() => {
        const s = useStore.getState();
        if (row.collection === SETTINGS) {
          if (payload.eventType !== "DELETE") useStore.setState({ settings: { ...s.settings, ...(row.data as Settings) } });
          return;
        }
        const key = row.collection as CollectionKey;
        if (!COLLECTION_KEYS.includes(key)) return;
        const list = s[key] as { id: string }[];
        if (payload.eventType === "DELETE") useStore.setState({ [key]: list.filter((x) => x.id !== row.id) } as Partial<StoreState>);
        else {
          const item = row.data as { id: string };
          useStore.setState({ [key]: list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] } as Partial<StoreState>);
        }
      });
    })
    .subscribe();
  stopFns.push(() => void supabase!.removeChannel(channel));

  const onUnload = () => void flush();
  window.addEventListener("pagehide", onUnload);
  stopFns.push(() => window.removeEventListener("pagehide", onUnload));
  useSyncStatus.setState({ status: "saved" });
}

export function stopSync() {
  stopFns.forEach((f) => f());
  stopFns = [];
}

/** Ao sair: envia o que falta, desliga a sincronização e limpa os dados da tela. */
export async function signOutAndClear() {
  await flush();
  stopSync();
  workspaceId = "";
  applyRemote(() => useStore.setState({ ...emptyCollections(), meId: null }));
  await supabase?.auth.signOut();
}

/** Convida um e-mail para o escritório atual. */
export async function inviteEmail(email: string) {
  if (!supabase || !workspaceId) return { error: null };
  const { error } = await supabase.from("invites").upsert({ workspace_id: workspaceId, email: email.trim().toLowerCase() });
  return { error };
}
