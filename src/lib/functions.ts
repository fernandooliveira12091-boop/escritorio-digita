import { supabase } from "./supabase";
import { currentWorkspaceId } from "../store/sync";

/** Chama uma função do Supabase com o login do usuário e o escritório atual. Os dados novos chegam pela sincronização. */
export async function callFunction<T>(name: string, body: Record<string, unknown>, offlineMessage: string): Promise<T> {
  if (!supabase) throw new Error(offlineMessage);
  const { data, error } = await supabase.functions.invoke(name, { body: { ...body, workspaceId: currentWorkspaceId() } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const detail = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    if (detail?.error) throw new Error(detail.error);
    if (/not found|404/i.test(error.message)) throw new Error(`A função “${name}” ainda não foi publicada no Supabase.`);
    throw new Error("Não foi possível falar com o servidor. Tente de novo.");
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
