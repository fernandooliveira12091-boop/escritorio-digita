import { supabase } from "./supabase";
import { currentWorkspaceId } from "../store/sync";

export interface DjenResult { intimacoes: number; processosNovos: number; oabs: { oab: string; found: number; novas: number; error?: string }[] }
export interface DatajudResult { consultados: number; atualizados: number; naoEncontrados: string[]; erros: string[] }

/** Chama a função "tribunais" do Supabase (DJEN e DataJud). Os dados novos chegam pela sincronização. */
async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error("A busca nos tribunais funciona no sistema online, com login.");
  const { data, error } = await supabase.functions.invoke("tribunais", { body: { ...body, workspaceId: currentWorkspaceId() } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const detail = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    if (detail?.error) throw new Error(detail.error);
    if (/not found|404/i.test(error.message)) throw new Error("A função “tribunais” ainda não foi publicada no Supabase.");
    throw new Error("Não foi possível falar com o servidor. Tente de novo.");
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const buscarIntimacoes = (days = 30) => call<{ djen: DjenResult; datajud: DatajudResult }>({ action: "sync", days });
export const atualizarAndamentos = (processIds: string[]) => call<{ datajud: DatajudResult }>({ action: "datajud", processIds });
