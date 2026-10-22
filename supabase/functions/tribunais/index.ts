// Função "tribunais" (Supabase Edge Function).
// - DJEN (Comunica PJe/CNJ): busca publicações pela OAB monitorada e grava como intimações.
//   Processo que ainda não existe no sistema é cadastrado para revisão.
// - DataJud (API Pública do CNJ): busca classe, órgão julgador e movimentações pelo número do processo.
// Chamadas:
//   pelo sistema (usuário logado):  { action: "djen" | "datajud" | "sync", workspaceId, processIds? }
//   pelo agendamento diário (pg_cron): { action: "cron" } com o cabeçalho x-cron-secret
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
// Chave pública divulgada pelo CNJ na wiki do DataJud. Se o CNJ trocar, cadastre a nova no secret DATAJUD_API_KEY.
const DATAJUD_KEY = Deno.env.get("DATAJUD_API_KEY") ?? "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DJEN_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";
const DATAJUD_URL = "https://api-publica.datajud.cnj.jus.br";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
const digits = (s: string) => (s ?? "").replace(/\D/g, "");
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// ---------- registros do sistema (tabela records) ----------
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

async function getSettings(ws: string): Promise<Doc | null> {
  const { data } = await admin.from("records").select("data").eq("workspace_id", ws).eq("collection", "settings").eq("id", "main").maybeSingle();
  return (data?.data as Doc) ?? null;
}

async function putRecords(ws: string, collection: string, items: Doc[]) {
  for (let i = 0; i < items.length; i += 200) {
    const rows = items.slice(i, i + 200).map((d) => ({ workspace_id: ws, collection, id: d.id, data: d, client_id: "servidor-tribunais", updated_at: nowIso() }));
    const { error } = await admin.from("records").upsert(rows);
    if (error) throw error;
  }
}

// ---------- número CNJ e tribunal ----------
export function maskCNJ(n: string) {
  const d = digits(n);
  if (d.length !== 20) return n;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

const TJ = ["", "tjac", "tjal", "tjap", "tjam", "tjba", "tjce", "tjdft", "tjes", "tjgo", "tjma", "tjmt", "tjms", "tjmg", "tjpa", "tjpb", "tjpr", "tjpe", "tjpi", "tjrj", "tjrn", "tjrs", "tjro", "tjrr", "tjsc", "tjse", "tjsp", "tjto"];
/** Endereço do DataJud para o tribunal do processo, lido do próprio número CNJ (J.TR). */
export function datajudAlias(number: string): string | null {
  const d = digits(number);
  if (d.length !== 20) return null;
  const j = d[13];
  const tr = Number(d.slice(14, 16));
  if (j === "8" && TJ[tr]) return `api_publica_${TJ[tr]}`;
  if (j === "4" && tr >= 1 && tr <= 6) return `api_publica_trf${tr}`;
  if (j === "5" && tr >= 1 && tr <= 24) return `api_publica_trt${tr}`;
  if (j === "6" && tr >= 1) return `api_publica_tre-${["", "ac", "al", "ap", "am", "ba", "ce", "dft", "es", "go", "ma", "mt", "ms", "mg", "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "se", "sp", "to"][tr]}`;
  return null;
}

const stripHtml = (s: string) =>
  (s ?? "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim()
    .slice(0, 20000);

// ---------- DJEN ----------
async function fetchDjen(oab: string, uf: string, from: string, to: string) {
  const items: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = new URL(DJEN_URL);
    url.search = new URLSearchParams({
      numeroOab: oab, ufOab: uf, dataDisponibilizacaoInicio: from, dataDisponibilizacaoFim: to, pagina: String(page), itensPorPagina: "100",
    }).toString();
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.status === 429) { await sleep(5000); page--; continue; }
    if (!res.ok) throw new Error(`DJEN respondeu ${res.status}`);
    const body = await res.json();
    const list = body.items ?? body.content ?? body.data ?? [];
    items.push(...list);
    if (list.length < 100) break;
    await sleep(400);
  }
  return items;
}

async function syncDjen(ws: string, days = 30) {
  const [terms, intimations, processes, users, settings] = await Promise.all([
    getCollection(ws, "monitoredTerms"), getCollection(ws, "intimations"), getCollection(ws, "processes"),
    getCollection(ws, "users"), getSettings(ws),
  ]);
  const known = new Set(intimations.map((i) => i.id));
  const byNumber = new Map(processes.filter((p) => p.number).map((p) => [digits(p.number), p]));
  const owner = users.find((u) => u.role === "Gestor" && u.active !== false) ?? users[0];
  const funnels: any[] = settings?.funnels ?? [];
  const judicial = funnels.find((f) => f.name === "Judicial") ?? funnels[0];
  const group = settings?.actionGroups?.[0];
  const type = settings?.actionTypes?.find((t: any) => t.groupId === group?.id) ?? settings?.actionTypes?.[0];

  const newIntimations: Doc[] = [];
  const newProcesses: Doc[] = [];
  const updatedTerms: Doc[] = [];
  const summary: { oab: string; found: number; novas: number; error?: string }[] = [];
  const today = new Date();

  for (const term of terms.filter((t) => t.kind === "OAB" && t.oabNumber && t.oabUf)) {
    // Repete os 2 últimos dias da busca anterior, para não perder publicações tardias.
    const start = term.lastSyncAt ? new Date(new Date(term.lastSyncAt).getTime() - 2 * 864e5) : new Date(today.getTime() - days * 864e5);
    try {
      const items = await fetchDjen(digits(term.oabNumber), String(term.oabUf).toUpperCase(), ymd(start), ymd(today));
      let novas = 0;
      for (const it of items) {
        const id = `djen_${it.id ?? it.hash}`;
        if (known.has(id)) continue;
        known.add(id);
        const raw = it.numeroprocessocommascara ?? it.numero_processo ?? it.numeroProcesso ?? "";
        const number = maskCNJ(String(raw));
        let proc = byNumber.get(digits(number));
        if (!proc && digits(number).length === 20 && judicial) {
          proc = {
            id: `pr_djen_${digits(number)}`, number, contactIds: [], opposingParty: "", actionGroupId: group?.id ?? "", actionTypeId: type?.id ?? "",
            funnelId: judicial.id, stageId: judicial.stages?.[0]?.id ?? "", responsibleId: owner?.id ?? "", court: it.siglaTribunal ?? "", value: 0,
            status: "ativo", createdAt: nowIso(), movements: [], documents: [], unreadHistory: true, needsReview: true,
            className: it.nomeClasse ?? undefined, orgao: it.nomeOrgao ?? undefined,
            history: [{ id: `h_${Date.now()}_${novas}`, date: nowIso(), text: `Cadastrado automaticamente a partir de publicação no DJEN (OAB ${term.oabUf} ${term.oabNumber})` }],
          };
          byNumber.set(digits(number), proc);
          newProcesses.push(proc);
        }
        const published = it.data_disponibilizacao ?? it.dataDisponibilizacao ?? ymd(today);
        newIntimations.push({
          id, processId: proc?.id, number, court: it.siglaTribunal ?? "", publishedAt: new Date(`${String(published).slice(0, 10)}T12:00:00-03:00`).toISOString(),
          text: stripHtml(it.texto ?? ""), responsibleId: proc?.responsibleId ?? owner?.id, status: "nova", source: "djen",
          oab: `${term.oabUf} ${term.oabNumber}`, orgao: it.nomeOrgao ?? "", tipo: it.tipoComunicacao ?? it.tipoDocumento ?? "", link: it.link ?? "",
        });
        novas++;
      }
      updatedTerms.push({ ...term, lastSyncAt: nowIso(), lastCount: novas, lastError: null });
      summary.push({ oab: `${term.oabUf} ${term.oabNumber}`, found: items.length, novas });
    } catch (e) {
      updatedTerms.push({ ...term, lastError: (e as Error).message, lastErrorAt: nowIso() });
      summary.push({ oab: `${term.oabUf} ${term.oabNumber}`, found: 0, novas: 0, error: (e as Error).message });
    }
  }

  await putRecords(ws, "processes", newProcesses);
  await putRecords(ws, "intimations", newIntimations);
  await putRecords(ws, "monitoredTerms", updatedTerms);
  if (newIntimations.length) {
    await putRecords(ws, "notifications", [{
      id: `n_djen_${Date.now()}`, title: `${newIntimations.length} nova(s) intimação(ões) no DJEN${newProcesses.length ? `, ${newProcesses.length} processo(s) novo(s) para revisar` : ""}`,
      createdAt: nowIso(), read: false, link: "/intimacoes",
    }]);
  }
  return { intimacoes: newIntimations.length, processosNovos: newProcesses.length, oabs: summary, processIds: newProcesses.map((p) => p.id) };
}

// ---------- DataJud ----------
const parseDataHora = (s: string) => {
  if (/^\d{14}$/.test(s)) return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}-03:00`).toISOString();
  const d = new Date(s);
  return isNaN(d.getTime()) ? nowIso() : d.toISOString();
};

async function fetchDatajud(number: string) {
  const alias = datajudAlias(number);
  if (!alias) return { hits: [], alias: null };
  const res = await fetch(`${DATAJUD_URL}/${alias}/_search`, {
    method: "POST",
    headers: { Authorization: `APIKey ${DATAJUD_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { match: { numeroProcesso: digits(number) } }, size: 10 }),
  });
  if (res.status === 429) throw new Error("DataJud limitou as consultas. Tente mais tarde.");
  if (!res.ok) throw new Error(`DataJud respondeu ${res.status}`);
  const body = await res.json();
  return { hits: (body.hits?.hits ?? []).map((h: any) => h._source), alias };
}

async function syncDatajud(ws: string, opts: { processIds?: string[]; limit?: number }) {
  const processes = await getCollection(ws, "processes");
  let list = processes.filter((p) => p.status !== "arquivado" && datajudAlias(p.number ?? ""));
  if (opts.processIds?.length) list = processes.filter((p) => opts.processIds!.includes(p.id) && datajudAlias(p.number ?? ""));
  // Primeiro os nunca consultados, depois os consultados há mais tempo.
  list.sort((a, b) => (a.capturedAt ?? "").localeCompare(b.capturedAt ?? ""));
  list = list.slice(0, opts.limit ?? 40);

  const updated: Doc[] = [];
  const result = { consultados: 0, atualizados: 0, naoEncontrados: [] as string[], erros: [] as string[] };
  for (const p of list) {
    try {
      const { hits } = await fetchDatajud(p.number);
      result.consultados++;
      if (!hits.length) {
        result.naoEncontrados.push(p.number);
        updated.push({ ...p, capturedAt: nowIso(), datajudFound: false });
        continue;
      }
      const seen = new Set<string>();
      const fromDatajud: Doc[] = [];
      for (const h of hits) {
        for (const m of h.movimentos ?? []) {
          const date = parseDataHora(m.dataHora ?? "");
          const key = `${m.codigo}_${date}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const extra = (m.complementosTabelados ?? []).map((c: any) => c.nome ?? c.descricao).filter(Boolean).join("; ");
          fromDatajud.push({ id: `dj_${key}`, date, text: `${m.nome ?? "Movimentação"}${extra ? ` (${extra})` : ""}`, source: "datajud" });
        }
      }
      const manual = (p.movements ?? []).filter((m: Doc) => !String(m.id).startsWith("dj_"));
      const before = (p.movements ?? []).filter((m: Doc) => String(m.id).startsWith("dj_")).length;
      const first = hits[0];
      const next: Doc = {
        ...p,
        movements: [...manual, ...fromDatajud].sort((a, b) => a.date.localeCompare(b.date)),
        capturedAt: nowIso(),
        datajudFound: true,
        court: p.court || first.tribunal || "",
        className: first.classe?.nome ?? p.className,
        orgao: first.orgaoJulgador?.nome ?? p.orgao,
        filedAt: p.filedAt ?? (first.dataAjuizamento ? parseDataHora(first.dataAjuizamento) : undefined),
      };
      if (fromDatajud.length > before) {
        next.unreadHistory = true;
        next.history = [...(p.history ?? []), { id: `h_dj_${Date.now()}`, date: nowIso(), text: `${fromDatajud.length - before} andamento(s) novo(s) pelo DataJud` }];
        result.atualizados++;
      }
      updated.push(next);
    } catch (e) {
      result.erros.push(`${p.number}: ${(e as Error).message}`);
    }
    await sleep(250);
  }
  await putRecords(ws, "processes", updated);
  return result;
}

// ---------- entrada ----------
async function isMember(userId: string, ws: string) {
  const { data } = await admin.from("members").select("user_id").eq("workspace_id", ws).eq("user_id", userId).maybeSingle();
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));

    if (body.action === "cron") {
      if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "não autorizado" }, 401);
      const { data: wss } = await admin.from("workspaces").select("id");
      const out: Record<string, unknown> = {};
      for (const w of wss ?? []) {
        const djen = await syncDjen(w.id, 7);
        const datajud = await syncDatajud(w.id, { limit: 60 });
        out[w.id] = { djen, datajud };
      }
      return json(out);
    }

    const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: auth } = await admin.auth.getUser(jwt);
    if (!auth?.user) return json({ error: "Entre no sistema para buscar nos tribunais." }, 401);
    const ws = String(body.workspaceId ?? "");
    if (!ws || !(await isMember(auth.user.id, ws))) return json({ error: "Sem acesso a este escritório." }, 403);

    if (body.action === "djen") return json({ djen: await syncDjen(ws, Number(body.days) || 30) });
    if (body.action === "datajud") return json({ datajud: await syncDatajud(ws, { processIds: body.processIds, limit: body.processIds?.length ? 20 : 40 }) });
    if (body.action === "sync") {
      const djen = await syncDjen(ws, Number(body.days) || 30);
      const datajud = await syncDatajud(ws, { limit: 30 });
      return json({ djen, datajud });
    }
    return json({ error: "ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
