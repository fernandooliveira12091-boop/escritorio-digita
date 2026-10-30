import { addDays, addHours, format } from "date-fns";
import { supabase } from "./supabase";
import { currentWorkspaceId } from "../store/sync";

const gDateTime = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Link que abre o Google Agenda com o evento já preenchido (o usuário só confirma). */
export function googleCalendarLink(opts: { title: string; start: string; allDay?: boolean; details?: string; location?: string }) {
  const start = new Date(opts.start);
  const dates = opts.allDay
    ? `${format(start, "yyyyMMdd")}/${format(addDays(start, 1), "yyyyMMdd")}`
    : `${gDateTime(start)}/${gDateTime(addHours(start, 1))}`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: opts.title, dates, ctz: "America/Sao_Paulo" });
  if (opts.details) params.set("details", opts.details);
  if (opts.location) params.set("location", opts.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Endereço da agenda (.ics) para assinar no Google Agenda. */
export const feedUrl = (token: string, escopo: "meus" | "todos") =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agenda?token=${token}&escopo=${escopo}`;

const newToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Token pessoal deste usuário neste escritório; cria um se ainda não existir. */
export async function getOrCreateFeedToken(): Promise<string> {
  if (!supabase) throw new Error("A agenda para o Google funciona no sistema online, com login.");
  const { data: auth } = await supabase.auth.getUser();
  const ws = currentWorkspaceId();
  if (!auth.user || !ws) throw new Error("Entre no sistema para gerar o endereço.");
  const { data, error } = await supabase.from("calendar_feeds").select("token").eq("workspace_id", ws).eq("user_id", auth.user.id).limit(1);
  if (error) throw new Error(error.message.includes("calendar_feeds") ? "Falta rodar o arquivo supabase/agenda.sql no Supabase." : error.message);
  if (data?.[0]) return data[0].token as string;
  const token = newToken();
  const { error: insErr } = await supabase.from("calendar_feeds").insert({ token, workspace_id: ws, user_id: auth.user.id });
  if (insErr) throw new Error(insErr.message);
  return token;
}

/** Revoga o endereço atual (quem tinha o link antigo para de receber) e cria outro. */
export async function regenerateFeedToken(): Promise<string> {
  if (!supabase) throw new Error("Indisponível no modo demonstração.");
  const { data: auth } = await supabase.auth.getUser();
  const ws = currentWorkspaceId();
  if (!auth.user || !ws) throw new Error("Entre no sistema para gerar o endereço.");
  const { error } = await supabase.from("calendar_feeds").delete().eq("workspace_id", ws).eq("user_id", auth.user.id);
  if (error) throw new Error(error.message);
  return getOrCreateFeedToken();
}
