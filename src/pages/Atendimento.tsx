import { ArrowLeft, Bot, ExternalLink, Loader2, Megaphone, Send, User, UserCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, PageHeader, Segmented } from "../components/ui/basics";
import { normalize, relDateTime, waLink } from "../lib/format";
import { cloudMode } from "../lib/supabase";
import { sendWhatsapp, setConversationAi, setConversationAttendant } from "../lib/whatsapp";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { Conversation } from "../types";

const SEEN_KEY = "escritorio-digital-atendimento-vistas";
const readSeen = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}"); } catch { return {}; }
};
const lastText = (c: Conversation) => [...c.messages].reverse().find((m) => m.from !== "sistema")?.text ?? "";
const fmtPhone = (p: string) => p.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
const within24h = (c: Conversation) => !!c.lastInboundAt && Date.now() - new Date(c.lastInboundAt).getTime() < 24 * 3600e3;
const URG = { alta: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300", media: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", baixa: "bg-card dark:bg-white/10" };

export default function Atendimento() {
  const { conversations, campaigns, contacts, attendants } = useStore();
  const showToast = useUi((s) => s.showToast);
  const [filter, setFilter] = useState<"todas" | "humano" | "ia" | "leads">("todas");
  const [search, setSearch] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [seen, setSeen] = useState(readSeen);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const list = useMemo(
    () => [...conversations]
      .filter((c) => filter === "todas" || (filter === "leads" ? !!c.lead : c.status === filter))
      .filter((c) => !search || normalize(`${c.name} ${c.phone} ${c.lead?.nome ?? ""} ${c.lead?.assunto ?? ""}`).includes(normalize(search)))
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt)),
    [conversations, filter, search],
  );
  const conv = conversations.find((c) => c.id === selId) ?? null;
  const campaign = campaigns.find((c) => c.id === conv?.campaignId);
  const unread = (c: Conversation) => c.messages.filter((m) => m.from === "cliente" && m.at > (seen[c.id] ?? "")).length;
  const needsHuman = conversations.filter((c) => c.status === "humano").length;

  // Ao abrir uma conversa, marca como vista neste aparelho e rola até o fim.
  useEffect(() => {
    if (!conv) return;
    const next = { ...readSeen(), [conv.id]: conv.lastMessageAt ?? new Date().toISOString() };
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* armazenamento indisponível */ }
    setSeen(next);
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conv?.id, conv?.messages.length]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (!cloudMode) return showToast("No modo demonstração as conversas são só exemplos. No sistema online, a mensagem sai pelo WhatsApp.");
    setBusy(true);
    try { await fn(); showToast(ok); return true; } catch (e) { showToast((e as Error).message); return false; } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader
        title="Atendimento"
        subtitle="Conversas do WhatsApp atendidas pelo agente de IA. Assuma a conversa quando quiser falar direto com o cliente."
        actions={<><Link className="btn" to="/atendimento/agentes"><Bot size={16} /> Agentes por benefício</Link><Link className="btn" to="/campanhas"><Megaphone size={16} /> Campanhas</Link></>}
      />
      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[340px_1fr]">
        <aside className={`surface flex min-w-0 flex-col overflow-hidden ${conv ? "hidden lg:flex" : "flex"}`}>
          <div className="space-y-2 border-b border-line p-3 dark:border-white/10">
            <label className="block"><span className="sr-only">Buscar conversa</span><input className="input" placeholder="Buscar por nome, telefone ou assunto" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
            <Segmented label="Filtrar conversas" value={filter} onChange={setFilter} options={[{ id: "todas", label: "Todas" }, { id: "humano", label: `Equipe${needsHuman ? ` (${needsHuman})` : ""}` }, { id: "ia", label: "IA" }, { id: "leads", label: "Leads" }]} />
          </div>
          <ul className="flex-1 divide-y divide-line overflow-y-auto dark:divide-white/5">
            {list.map((c) => {
              const n = unread(c);
              return (
                <li key={c.id}>
                  <button onClick={() => setSelId(c.id)} className={`flex w-full gap-3 px-3 py-3 text-left hover:bg-card dark:hover:bg-white/5 ${c.id === selId ? "bg-primary-soft dark:bg-primary/15" : ""}`}>
                    <span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${c.status === "humano" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" : "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"}`} aria-hidden>
                      {c.status === "humano" ? <User size={16} /> : <Bot size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate ${n ? "font-semibold" : "font-medium"}`}>{c.lead?.nome || c.name || fmtPhone(c.phone)}</span>
                        <span className="muted shrink-0 text-[11px]">{relDateTime(c.lastMessageAt ?? c.createdAt)}</span>
                      </span>
                      <span className="muted block truncate text-xs">{lastText(c)}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {c.status === "humano" && <span className="chip bg-amber-50 text-[10px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Aguardando equipe</span>}
                        {(() => { const a = attendants.find((x) => x.id === c.attendantId); return a ? <span className="chip text-[10px] text-white" style={{ background: a.color }}>{a.benefit.split(" (")[0]}</span> : null; })()}
                        {c.lead && <span className="chip bg-green-50 text-[10px] text-green-700 dark:bg-green-500/15 dark:text-green-300">Lead: {c.lead.area}</span>}
                        {n > 0 && <span className="chip bg-primary text-[10px] text-white">{n} nova(s)</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!list.length && <li><EmptyState>{conversations.length ? "Nenhuma conversa neste filtro." : "As conversas do WhatsApp aparecem aqui assim que o agente estiver ligado."}</EmptyState></li>}
          </ul>
        </aside>

        <section className={`surface min-w-0 flex-col overflow-hidden ${conv ? "flex" : "hidden lg:flex"}`}>
          {!conv ? (
            <EmptyState><Bot size={28} className="text-primary" />Escolha uma conversa para ver as mensagens.</EmptyState>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 dark:border-white/10">
                <button className="btn-icon lg:hidden" onClick={() => setSelId(null)} aria-label="Voltar para a lista"><ArrowLeft size={18} /></button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{conv.lead?.nome || conv.name || fmtPhone(conv.phone)}</p>
                  <p className="muted truncate text-xs">
                    {fmtPhone(conv.phone)}{campaign ? ` · campanha ${campaign.name}` : conv.referral?.headline ? ` · anúncio "${conv.referral.headline}"` : ""}
                  </p>
                </div>
                <label className="w-full sm:w-52">
                  <span className="sr-only">Agente especialista desta conversa</span>
                  <select className="input py-1.5 text-sm" value={conv.attendantId ?? ""} disabled={busy}
                    onChange={(e) => { const id = e.target.value; const a = attendants.find((x) => x.id === id); run(() => setConversationAttendant(conv.id, id), a ? `Conversa com ${a.name}` : "Conversa na triagem geral"); }}>
                    <option value="">Agente: triagem geral</option>
                    {attendants.filter((a) => a.active || a.id === conv.attendantId).map((a) => <option key={a.id} value={a.id}>Agente: {a.benefit.split(" (")[0]}</option>)}
                  </select>
                </label>
                <a className="btn" href={waLink(conv.phone.replace(/^55/, ""))} target="_blank" rel="noreferrer"><ExternalLink size={16} /> WhatsApp</a>
                {conv.status === "ia" ? (
                  <button className="btn" disabled={busy} onClick={() => run(() => setConversationAi(conv.id, false), "Você assumiu a conversa. A IA parou de responder.")}><UserCheck size={16} /> Assumir conversa</button>
                ) : (
                  <button className="btn" disabled={busy} onClick={() => run(() => setConversationAi(conv.id, true), "IA reativada nesta conversa.")}><Bot size={16} /> Devolver para a IA</button>
                )}
              </header>

              {conv.lead && (
                <div className="space-y-1 border-b border-line bg-card px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>Triagem da IA:</b> <span>{conv.lead.area} · {conv.lead.assunto}</span>
                    <span className={`chip ${URG[conv.lead.urgencia]}`}>Urgência {conv.lead.urgencia === "media" ? "média" : conv.lead.urgencia}</span>
                    {conv.lead.cidade && <span className="muted">{conv.lead.cidade}</span>}
                    {conv.lead.melhorHorario && <span className="muted">Retorno: {conv.lead.melhorHorario}</span>}
                  </div>
                  <p className="muted">{conv.lead.resumo}</p>
                  {conv.lead.triagem?.length ? (
                    <details className="pt-1">
                      <summary className="cursor-pointer text-xs font-medium">Respostas da triagem{conv.lead.beneficio ? ` (${conv.lead.beneficio})` : ""}</summary>
                      <dl className="mt-1 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                        {conv.lead.triagem.map((t, i) => <div key={i}><dt className="font-medium">{t.pergunta}</dt><dd className="muted">{t.resposta}</dd></div>)}
                      </dl>
                    </details>
                  ) : null}
                  <div className="flex flex-wrap gap-3 pt-1 text-xs">
                    {conv.processId && <Link className="link" to={`/processos/${conv.processId}`}>Abrir card no CRM</Link>}
                    {conv.contactId && contacts.some((c) => c.id === conv.contactId) && <Link className="link" to="/contatos">Ver contato</Link>}
                  </div>
                </div>
              )}

              <div className="flex-1 space-y-2 overflow-y-auto bg-[#F5F6F8] p-4 dark:bg-[#0F1115]" aria-live="polite">
                {conv.messages.map((m) =>
                  m.from === "sistema" ? (
                    <p key={m.id} className="muted mx-auto max-w-md text-center text-xs">{m.text} · {relDateTime(m.at)}</p>
                  ) : (
                    <div key={m.id} className={`max-w-[80%] ${m.from === "cliente" ? "" : "ml-auto"}`}>
                      <div className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.from === "cliente" ? "bg-white dark:bg-[#171A21]" : m.from === "ia" ? "bg-green-100 text-green-950 dark:bg-green-900/40 dark:text-green-50" : "bg-primary text-white"}`}>
                        {m.text}
                      </div>
                      <p className={`muted mt-0.5 text-[11px] ${m.from === "cliente" ? "" : "text-right"}`}>
                        {m.from === "ia" ? "IA" : m.from === "equipe" ? m.by || "Equipe" : "Cliente"} · {relDateTime(m.at)}
                      </p>
                    </div>
                  ),
                )}
                <div ref={endRef} />
              </div>

              <form className="space-y-2 border-t border-line p-3 dark:border-white/10" onSubmit={async (e) => {
                e.preventDefault();
                if (!text.trim()) return;
                if (await run(() => sendWhatsapp(conv.id, text.trim()), "Mensagem enviada")) setText("");
              }}>
                {!within24h(conv) && <p className="text-xs text-amber-700 dark:text-amber-300">Já passaram 24 horas da última mensagem do cliente. Pela regra do WhatsApp, só dá para responder quando ele escrever de novo.</p>}
                {conv.status === "ia" && <p className="muted text-xs">Ao enviar uma mensagem, você assume a conversa e a IA para de responder.</p>}
                <div className="flex gap-2">
                  <label htmlFor="wa-text" className="sr-only">Mensagem</label>
                  <textarea id="wa-text" rows={2} className="input resize-none" placeholder="Escreva a mensagem para o cliente" value={text} onChange={(e) => setText(e.target.value)} disabled={!within24h(conv)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
                  <button className="btn-primary self-end" disabled={busy || !text.trim() || !within24h(conv)} aria-label="Enviar">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}
