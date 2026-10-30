// Função "agenda" (Supabase Edge Function): agenda do escritório no formato iCalendar (.ics),
// para assinar no Google Agenda (Outras agendas › Do URL), Outlook ou Apple Calendar.
// Endereço: /functions/v1/agenda?token=<token>&escopo=meus|todos
// O token é pessoal (tabela calendar_feeds) e funciona como senha: quem tem o endereço vê a agenda.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://fernandooliveira12091-boop.github.io/escritorio-digita/";
const TZ = "America/Sao_Paulo";

type Doc = Record<string, any> & { id: string };

async function getCollection(ws: string, collection: string): Promise<Doc[]> {
  const out: Doc[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("records").select("data").eq("workspace_id", ws).eq("collection", collection).range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []).map((r) => r.data as Doc));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// ---------- iCalendar ----------
const esc = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Data (yyyymmdd) no fuso de Brasília, para eventos de dia inteiro. */
const localDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d).replace(/-/g, "");
const nextDay = (yyyymmdd: string) => {
  const d = new Date(`${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
};
/** Quebra linhas em 75 bytes, como manda a RFC 5545. */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = ch;
    } else cur += ch;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const escopo = url.searchParams.get("escopo") === "todos" ? "todos" : "meus";
  if (token.length < 20) return new Response("Endereço de agenda inválido.", { status: 404 });

  const { data: feed } = await admin.from("calendar_feeds").select("workspace_id,user_id").eq("token", token).maybeSingle();
  if (!feed) return new Response("Endereço de agenda inválido ou revogado.", { status: 404 });
  // Quem gerou o endereço precisa continuar no escritório.
  const { data: member } = await admin.from("members").select("user_id").eq("workspace_id", feed.workspace_id).eq("user_id", feed.user_id).maybeSingle();
  if (!member) return new Response("Acesso revogado.", { status: 404 });

  const [tasks, users, contacts, processes, settingsRows] = await Promise.all([
    getCollection(feed.workspace_id, "tasks"), getCollection(feed.workspace_id, "users"),
    getCollection(feed.workspace_id, "contacts"), getCollection(feed.workspace_id, "processes"),
    getCollection(feed.workspace_id, "settings"),
  ]);
  const me = users.find((u) => u.authId === feed.user_id);
  const types = new Map((settingsRows[0]?.taskTypes ?? []).map((t: any) => [t.id, t.name]));
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));
  const procById = new Map(processes.map((p) => [p.id, p]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const since = Date.now() - 60 * 864e5; // últimos 60 dias e tudo o que vem pela frente

  const list = tasks
    .filter((t) => escopo === "todos" || (me && (t.responsibleIds ?? []).includes(me.id)))
    .filter((t) => new Date(t.deadline ?? t.date).getTime() >= since);

  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Escritorio Digital//Agenda//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(escopo === "todos" ? "Escritório Digital (todo o escritório)" : `Escritório Digital - ${me?.name ?? "minha agenda"}`)}`,
    `X-WR-TIMEZONE:${TZ}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  const stamp = utc(new Date());

  for (const t of list) {
    const proc = t.processId ? procById.get(t.processId) : undefined;
    const client = contactName.get(t.contactId) ?? (proc ? contactName.get(proc.contactIds?.[0]) : undefined);
    const parties = [client, proc?.opposingParty].filter(Boolean).join(" x ");
    const done = t.status === "concluida";
    const details = [
      types.get(t.typeId) && `Tipo: ${types.get(t.typeId)}`,
      parties && `Partes: ${parties}`,
      proc?.number && `Processo: ${proc.number}${proc.court ? ` (${proc.court})` : ""}`,
      (t.responsibleIds ?? []).length && `Responsável: ${(t.responsibleIds ?? []).map((id: string) => userName.get(id)).filter(Boolean).join(", ")}`,
      t.description,
      `Abrir no sistema: ${SITE_URL}`,
    ].filter(Boolean).join("\n");
    const prefix = done ? "✓ " : "";

    // Compromisso: na data e hora marcadas, com 1 hora de duração.
    const start = new Date(t.date);
    lines.push(
      "BEGIN:VEVENT", `UID:${t.id}@escritorio-digital`, `DTSTAMP:${stamp}`,
      `DTSTART:${utc(start)}`, `DTEND:${utc(new Date(start.getTime() + 3600e3))}`,
      fold(`SUMMARY:${esc(prefix + t.title + (parties ? ` - ${parties}` : ""))}`),
      fold(`DESCRIPTION:${esc(details)}`),
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE", "END:VEVENT",
    );

    // Prazo fatal: evento de dia inteiro no dia do prazo.
    if (t.deadline) {
      const day = localDay(new Date(t.deadline));
      lines.push(
        "BEGIN:VEVENT", `UID:${t.id}-prazo@escritorio-digital`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay(day)}`,
        fold(`SUMMARY:${esc(`${prefix}PRAZO FATAL: ${t.title}${parties ? ` - ${parties}` : ""}`)}`),
        fold(`DESCRIPTION:${esc(details)}`),
        "TRANSP:TRANSPARENT", "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="escritorio-digital.ics"',
      "Cache-Control": "no-store",
    },
  });
});
