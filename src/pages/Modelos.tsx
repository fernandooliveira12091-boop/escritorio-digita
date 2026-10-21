import { ArrowLeft, BookOpen, Bot, Copy, Download, FileText, Plus, Save, Send, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { EmptyState, Field, PageHeader } from "../components/ui/basics";
import { askAgent, getSample } from "../lib/ai";
import { buildContext, fillTemplate, textToDocx, VARIABLES } from "../lib/documents";
import { saveFile } from "../lib/files";
import { fmtDate, initials, normalize, uid } from "../lib/format";
import { PUBLIC_LIBRARY } from "../mocks/data";
import { useUi } from "../store/ui";
import { useCurrentUser, useStore } from "../store/useStore";
import type { Agent, ChatMessage, Template } from "../types";

type Section = "agentes" | "meus" | "biblioteca";

function SubNav({ value }: { value: Section }) {
  const items: { id: Section; label: string; icon: typeof Bot; to: string }[] = [
    { id: "agentes", label: "Agentes Jurídicos IA", icon: Bot, to: "/modelos" },
    { id: "meus", label: "Meus modelos", icon: FileText, to: "/modelos/meus" },
    { id: "biblioteca", label: "Biblioteca pública", icon: BookOpen, to: "/modelos/biblioteca" },
  ];
  return (
    <nav aria-label="Modelos e IA" className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((it) => (
        <Link key={it.id} to={it.to} aria-current={value === it.id ? "page" : undefined}
          className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${value === it.id ? "bg-primary-soft text-primary dark:bg-primary/15" : "text-ink-muted hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"}`}>
          <it.icon size={16} /> {it.label}
        </Link>
      ))}
    </nav>
  );
}

function AgentAvatar({ agent, size = 44 }: { agent: Agent; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-xl font-semibold text-white" style={{ width: size, height: size, background: agent.color }} aria-hidden="true">
      {initials(agent.area)}
    </span>
  );
}

function Agents() {
  const { agents, patch } = useStore();
  const showToast = useUi((s) => s.showToast);
  const navigate = useNavigate();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {agents.map((a) => (
        <div key={a.id} className="card flex items-start gap-4">
          <AgentAvatar agent={a} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{a.name}</h3>
              <span className={`chip text-[10px] font-semibold uppercase tracking-wider ${a.active ? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400"}`}>{a.active ? "Ativo" : "Não contratado"}</span>
            </div>
            <p className="muted text-sm">{a.description}</p>
            {a.active ? (
              <button className="btn-primary" onClick={() => navigate(`/modelos/agentes/${a.id}`)}><Bot size={16} /> Abrir agente</button>
            ) : (
              <button className="btn" onClick={() => { patch("agents", a.id, { active: true }); showToast(`${a.name} contratado`); }}><ShoppingCart size={16} /> Contratar agente</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentChat({ agent }: { agent: Agent }) {
  const { upsert } = useStore();
  const showToast = useUi((s) => s.showToast);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { getSample().then((s) => setLive(!!s)); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  const send = async (prompt = text) => {
    if (!prompt.trim() || busy) return;
    const history: ChatMessage[] = [...msgs, { role: "user", text: prompt.trim() }];
    setMsgs([...history, { role: "assistant", text: "Escrevendo…" }]);
    setText("");
    setBusy(true);
    try {
      const out = await askAgent(agent, history, (t) => setMsgs([...history, { role: "assistant", text: t }]));
      setMsgs([...history, { role: "assistant", text: out }]);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setMsgs([...history, { role: "assistant", text: code === "rate_limited" ? "Muitos pedidos seguidos. Espere um pouco e tente de novo." : "Não foi possível gerar a resposta agora. Tente de novo." }]);
    } finally {
      setBusy(false);
    }
  };
  const suggestions = [`Petição inicial de ${agent.area.toLowerCase()} com pedido de tutela de urgência`, "Notificação extrajudicial para a parte contrária", "Lista de documentos que devo pedir ao cliente"];

  return (
    <div className="surface flex h-[calc(100vh-260px)] min-h-[480px] flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 dark:border-white/10">
        <Link to="/modelos" className="btn-icon" aria-label="Voltar para os agentes"><ArrowLeft size={18} /></Link>
        <AgentAvatar agent={agent} size={36} />
        <div className="min-w-0">
          <p className="font-semibold">{agent.name}</p>
          <p className="muted truncate text-xs">{live === false ? "Modo rascunho: abra no claude.ai para respostas geradas por IA" : agent.description}</p>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {!msgs.length && (
          <EmptyState>
            <Bot size={28} className="text-primary" />
            Descreva o caso e a peça que você precisa.
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => <button key={s} className="btn text-xs" onClick={() => send(s)}>{s}</button>)}
            </div>
          </EmptyState>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[90%] ${m.role === "user" ? "ml-auto" : ""}`}>
            <div className={`whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-white" : "bg-card dark:bg-white/5"}`}>{m.text}</div>
            {m.role === "assistant" && !busy && i === msgs.length - 1 && (
              <div className="mt-1 flex flex-wrap gap-1">
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => navigator.clipboard?.writeText(m.text).then(() => showToast("Texto copiado"), () => showToast("Selecione o texto para copiar"))}><Copy size={14} /> Copiar</button>
                <button className="btn-ghost px-2 py-1 text-xs" onClick={async () => saveFile(`${agent.name} - minuta.docx`, await textToDocx(m.text))}><Download size={14} /> Baixar .docx</button>
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { upsert("templates", { id: uid("tp"), name: msgs[i - 1]?.text.slice(0, 60) || "Minuta", area: agent.area, content: m.text, updatedAt: new Date().toISOString() }); showToast("Salvo em Meus modelos"); }}><Save size={14} /> Salvar como modelo</button>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="flex gap-2 border-t border-line p-3 dark:border-white/10" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor="agent-input" className="sr-only">Mensagem para o agente</label>
        <textarea id="agent-input" rows={2} className="input resize-none" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: Petição inicial contra companhia aérea por cancelamento de voo, cliente perdeu conexão…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn-primary self-end" disabled={busy || !text.trim()} aria-label="Enviar"><Send size={16} /></button>
      </form>
    </div>
  );
}

function MyTemplates() {
  const { templates, contacts, processes, settings, upsert, remove } = useStore();
  const user = useCurrentUser();
  const showToast = useUi((s) => s.showToast);
  const [params] = useSearchParams();
  const [selId, setSelId] = useState(templates[0]?.id ?? "");
  const [contactId, setContactId] = useState("");
  const [processId, setProcessId] = useState(params.get("processo") ?? "");
  const [confirmDel, setConfirmDel] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const tpl = templates.find((t) => t.id === selId);
  const proc = processes.find((p) => p.id === processId);
  const contact = contacts.find((c) => c.id === (contactId || proc?.contactIds[0]));
  const ctx = useMemo(() => buildContext({ contact, process: proc, settings, user }), [contact, proc, settings, user]);
  const output = tpl ? fillTemplate(tpl.content, ctx) : "";
  const missing = tpl ? [...new Set([...tpl.content.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).filter((k) => !ctx[k]))] : [];

  const update = (c: Partial<Template>) => tpl && upsert("templates", { ...tpl, ...c, updatedAt: new Date().toISOString() });
  const insertVar = (key: string) => {
    const el = areaRef.current;
    if (!el || !tpl) return;
    const tag = `{{${key}}}`;
    const v = tpl.content.slice(0, el.selectionStart) + tag + tpl.content.slice(el.selectionEnd);
    update({ content: v });
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = el.selectionStart + tag.length; });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        <button className="btn-primary w-full" onClick={() => { const t = { id: uid("tp"), name: "Novo modelo", area: "Geral", content: "", updatedAt: new Date().toISOString() }; upsert("templates", t); setSelId(t.id); }}><Plus size={16} /> Novo modelo</button>
        <ul className="surface divide-y divide-line overflow-hidden dark:divide-white/5">
          {templates.map((t) => (
            <li key={t.id}>
              <button onClick={() => { setSelId(t.id); setConfirmDel(false); }} className={`block w-full px-3 py-2.5 text-left ${t.id === selId ? "bg-primary-soft dark:bg-primary/15" : "hover:bg-card dark:hover:bg-white/5"}`}>
                <span className={`block truncate text-sm ${t.id === selId ? "font-semibold text-primary" : "font-medium"}`}>{t.name}</span>
                <span className="muted text-xs">{t.area} · {fmtDate(t.updatedAt)}</span>
              </button>
            </li>
          ))}
          {!templates.length && <li className="muted p-4 text-sm">Nenhum modelo.</li>}
        </ul>
      </div>
      {tpl ? (
        <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
          <div className="card min-w-0 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <Field label="Nome do modelo">{(id) => <input id={id} className="input" value={tpl.name} onChange={(e) => update({ name: e.target.value })} />}</Field>
              <Field label="Área">{(id) => <input id={id} className="input" value={tpl.area} onChange={(e) => update({ area: e.target.value })} />}</Field>
            </div>
            <div>
              <span className="label">Inserir variável no cursor</span>
              <div className="flex flex-wrap gap-1">
                {VARIABLES.map((v) => <button key={v.key} type="button" className="chip border border-line bg-white font-mono text-[11px] hover:border-primary dark:border-white/10 dark:bg-[#0F1115]" title={v.label} onClick={() => insertVar(v.key)}>{`{{${v.key}}}`}</button>)}
              </div>
            </div>
            <Field label="Texto do modelo">{(id) => <textarea id={id} ref={areaRef} rows={18} className="input font-mono text-[13px] leading-relaxed" value={tpl.content} onChange={(e) => update({ content: e.target.value })} />}</Field>
            <button className={`btn ${confirmDel ? "border-red-600 bg-red-600 text-white" : "text-red-600"}`} onClick={() => (confirmDel ? (remove("templates", tpl.id), setSelId(templates.find((t) => t.id !== tpl.id)?.id ?? ""), setConfirmDel(false)) : setConfirmDel(true))}>
              <Trash2 size={16} /> {confirmDel ? "Confirmar exclusão" : "Excluir modelo"}
            </button>
          </div>
          <div className="card min-w-0 space-y-3">
            <h2 className="h2">Gerar documento</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="A partir do processo">{(id) => <select id={id} className="input" value={processId} onChange={(e) => setProcessId(e.target.value)}><option value="">Nenhum</option>{processes.map((p) => <option key={p.id} value={p.id}>{p.number} · {contacts.find((c) => c.id === p.contactIds[0])?.name}</option>)}</select>}</Field>
              <Field label="Ou do contato">{(id) => <select id={id} className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}><option value="">{proc ? "Cliente do processo" : "Nenhum"}</option>{[...contacts].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</Field>
            </div>
            {missing.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">Sem dados para: {missing.map((m) => `{{${m}}}`).join(", ")}. Eles aparecem entre colchetes no documento.</p>}
            <div className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-white p-5 font-serif text-[14px] leading-relaxed text-gray-900 dark:border-white/10">{output || "O documento aparece aqui."}</div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={!output} onClick={async () => saveFile(`${tpl.name}${contact ? ` - ${contact.name}` : ""}.docx`, await textToDocx(output))}><Download size={16} /> Baixar .docx</button>
              <button className="btn" disabled={!output} onClick={() => navigator.clipboard?.writeText(output).then(() => showToast("Texto copiado"), () => showToast("Selecione o texto para copiar"))}><Copy size={16} /> Copiar texto</button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState>Crie um modelo ou copie um da biblioteca pública.</EmptyState>
      )}
    </div>
  );
}

function Library() {
  const { upsert } = useStore();
  const showToast = useUi((s) => s.showToast);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const areas = [...new Set(PUBLIC_LIBRARY.map((t) => t.area))].sort();
  const rows = PUBLIC_LIBRARY.filter((t) => (!area || t.area === area) && (!q || normalize(t.name).includes(normalize(q))));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <label className="min-w-[200px] flex-1 sm:max-w-xs"><span className="sr-only">Buscar modelo</span><input className="input" placeholder="Buscar modelo" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label><span className="sr-only">Área</span><select className="input w-auto" value={area} onChange={(e) => setArea(e.target.value)}><option value="">Todas as áreas</option>{areas.map((a) => <option key={a}>{a}</option>)}</select></label>
      </div>
      <ul className="surface divide-y divide-line dark:divide-white/5">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <FileText size={18} className="text-primary" />
            <span className="min-w-0 flex-1"><span className="block font-medium">{t.name}</span><span className="muted text-xs">{t.area}</span></span>
            <button className="btn" onClick={() => { upsert("templates", { ...t, id: uid("tp"), updatedAt: new Date().toISOString() }); showToast("Copiado para Meus modelos"); navigate("/modelos/meus"); }}>Usar modelo</button>
          </li>
        ))}
        {!rows.length && <li className="muted p-6 text-center text-sm">Não encontramos nenhum registro.</li>}
      </ul>
    </div>
  );
}

export default function Modelos({ section }: { section: Section }) {
  const { agentId } = useParams();
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  return (
    <>
      <PageHeader title="Modelos e IA" subtitle="Agentes que redigem peças, seus modelos com variáveis e a biblioteca pública." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <SubNav value={section} />
        <div className="min-w-0">
          {section === "agentes" && (agent ? (agent.active ? <AgentChat agent={agent} /> : <EmptyState action={<Link className="link" to="/modelos">Ver agentes</Link>}>Este agente ainda não foi contratado.</EmptyState>) : <Agents />)}
          {section === "meus" && <MyTemplates />}
          {section === "biblioteca" && <Library />}
        </div>
      </div>
    </>
  );
}
