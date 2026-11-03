import { callFunction } from "./functions";

export interface DjenResult { intimacoes: number; processosNovos: number; partesCompletadas?: number; oabs: { oab: string; found: number; novas: number; error?: string }[] }
export interface DatajudResult { consultados: number; atualizados: number; naoEncontrados: string[]; erros: string[] }

const call = <T,>(body: Record<string, unknown>) => callFunction<T>("tribunais", body, "A busca nos tribunais funciona no sistema online, com login.");

/** Busca no DJEN. full = histórico dos últimos "days" dias; sem full, só o que é novo desde a última busca. */
export const buscarIntimacoes = (days = 30, full = false) => call<{ djen: DjenResult; datajud: DatajudResult }>({ action: "sync", days, full });
export const atualizarAndamentos = (processIds: string[]) => call<{ datajud: DatajudResult }>({ action: "datajud", processIds });
