import { ArrowLeft, Bot, Loader2, MessageSquareText, Pencil, Plus, RotateCcw, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Field, Modal, PageHeader, Toggle } from "../components/ui/basics";
import { blankAttendant, defaultAttendants } from "../lib/attendants";
import { normalize, uid } from "../lib/format";
import { cloudMode } from "../lib/supabase";
import { simulateAgent, type SimulationResult } from "../lib/whatsapp";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { Attendant } from "../types";

const AREAS: Attendant["area"][] = ["Previdenciário", "Família", "Cível", "Outra"];
const COLORS = ["#EC4899", "#8B5CF6", "#F59E0B", "#2F80ED", "#64748B", "#EF4444", "#10B981", "#0EA5E9"];

export default function AgentesAtendimento() {
  const { attendants, conversations, campaigns, upsert, remove } = useStore();
  const showToast = useUi((s) => s.showToast);
  const [form, setForm] = useState<Attendant | null>(null);
  const [testing, setTesting] = useState<Attendant | null>(null);

  const stats = (a: Attendant) => {
    const convs = conversations.filter((c) => c.attendantId === a.id);
    return { convs: convs.length, leads: convs.filter((c) => c.lead).length, campaigns: campaigns.filter((c) => c.attendantId === a.id).length };
  };
  // Especialistas prontos que ainda não existem (comparando pelo benefício).
  const missing = defaultAttendants().filter((d) => !attendants.some((a) => normalize(a.benefit) === normalize(d.benefit)));
  const addDefaults = () => {
    missing.forEach((d) => upsert("attendants", { ...d, id: uid("att") }));
    showToast(`${missing.length} especialista(s) criado(s). Revise os textos e ajuste ao jeito do escritório.`);
  };

  return (
    <>
      <PageHeader
        title="Agentes de atendimento"
        subtitle="Um agente de IA especialista para cada benefício ou assunto. Os textos de cada um são o treinamento: o que ele sabe, o que pergunta e quando chama a equipe."
        actions={
          <>
            <Link className="btn" to="/atendimento"><ArrowLeft size={16} /> Conversas</Link>
            {attendants.length > 0 && missing.length > 0 && <button className="btn" onClick={addDefaults}><Sparkles size={16} /> Adicionar prontos ({missing.length})</button>}
            <button className="btn-primary" onClick={() => setForm(blankAttendant(uid("att")))}><Plus size={16} /> Novo agente</button>
          </>
        }
      />

      <section className="surface grid gap-4 p-4 text-sm md:grid-cols-3">
        <h2 className="sr-only">Como a conversa chega ao especialista</h2>
        {[
          ["1. Campanha", "Se a pessoa veio de uma campanha com especialista definido, ele atende desde a primeira mensagem."],
          ["2. Palavras-chave", "Senão, o sistema procura as palavras-chave de cada agente nas mensagens (ex.: “grávida”, “BPC”, “pensão por morte”)."],
          ["3. Triagem pela IA", "Sem pista clara, a IA pergunta o assunto e passa a conversa para o especialista certo. A equipe também pode trocar o agente na tela de Conversas."],
        ].map(([t, d]) => (
          <div key={t}><p className="font-semibold">{t}</p><p className="muted">{d}</p></div>
        ))}
      </section>

      {!attendants.length ? (
        <div className="surface">
          <EmptyState action={<button className="btn-primary" onClick={addDefaults}><Sparkles size={16} /> Criar os {missing.length} especialistas prontos</button>}>
            <Bot size={28} className="text-primary" />
            Nenhum agente especialista ainda. Comece pelos prontos (salário-maternidade, BPC/LOAS, auxílio por incapacidade, aposentadoria, pensão por morte, benefício negado, família e cível) e ajuste os textos.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {attendants.map((a) => {
            const s = stats(a);
            const kws = a.keywords.split(",").map((k) => k.trim()).filter(Boolean);
            return (
              <article key={a.id} className={`surface flex flex-col gap-3 p-4 ${a.active ? "" : "opacity-60"}`}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: a.color }} aria-hidden><Bot size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold leading-tight">{a.name || "Agente sem nome"}</h2>
                    <p className="muted text-xs">{a.area} · {a.questions.split("\n").filter((l) => l.trim()).length} perguntas no roteiro</p>
                  </div>
                  <Toggle checked={a.active} onChange={(v) => upsert("attendants", { ...a, active: v, updatedAt: new Date().toISOString() })} label={`${a.active ? "Desativar" : "Ativar"} ${a.name}`} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {kws.slice(0, 6).map((k) => <span key={k} className="chip bg-card text-[11px] dark:bg-white/10">{k}</span>)}
                  {kws.length > 6 && <span className="muted text-[11px]">+{kws.length - 6}</span>}
                  {!kws.length && <span className="muted text-xs">Sem palavras-chave: só recebe conversas encaminhadas pela IA ou por campanha.</span>}
                </div>
                <p className="muted text-xs">{s.convs} conversa(s) · {s.leads} lead(s){s.campaigns ? ` · ${s.campaigns} campanha(s)` : ""}</p>
                <div className="mt-auto flex gap-2">
                  <button className="btn flex-1" onClick={() => setForm(a)}><Pencil size={15} /> Editar treinamento</button>
                  <button className="btn" onClick={() => setTesting(a)}><MessageSquareText size={15} /> Testar</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {form && (
        <AttendantModal
          value={form}
          isNew={!attendants.some((a) => a.id === form.id)}
          onClose={() => setForm(null)}
          onSave={(a) => { upsert("attendants", { ...a, updatedAt: new Date().toISOString() }); setForm(null); showToast("Agente salvo. Ele já vale para as próximas mensagens."); }}
          onDelete={(id) => { remove("attendants", id); setForm(null); showToast("Agente excluído"); }}
          onTest={(a) => { upsert("attendants", { ...a, updatedAt: new Date().toISOString() }); setForm(null); setTesting(a); }}
        />
      )}
      {testing && <TestChat attendant={testing} onClose={() => setTesting(null)} />}
    </>
  );
}

function AttendantModal({ value, isNew, onClose, onSave, onDelete, onTest }: {
  value: Attendant; isNew: boolean; onClose: () => void; onSave: (a: Attendant) => void; onDelete: (id: string) => void; onTest: (a: Attendant) => void;
}) {
  const [a, setA] = useState(value);
  const [confirmDel, setConfirmDel] = useState(false);
  const showToast = useUi((s) => s.showToast);
  const set = <K extends keyof Attendant>(k: K, v: Attendant[K]) => setA({ ...a, [k]: v });
  const valid = () => {
    if (!a.name.trim() || !a.benefit.trim()) { showToast("Preencha o nome do agente e o benefício"); return false; }
    return true;
  };
  const area = (label: string, k: "knowledge" | "questions" | "documents" | "redFlags" | "faq" | "instructions", rows: number, hint: string) => (
    <Field label={label} className="sm:col-span-2">
      {(id) => (
        <>
          <textarea id={id} rows={rows} className="input text-sm" value={a[k]} onChange={(e) => set(k, e.target.value)} aria-describedby={`${id}-h`} />
          <p id={`${id}-h`} className="muted mt-1 text-xs">{hint}</p>
        </>
      )}
    </Field>
  );

  return (
    <Modal title={isNew ? "Novo agente especialista" : a.name} onClose={onClose} wide footer={
      <>
        {!isNew && <button className={`btn mr-auto ${confirmDel ? "border-red-600 bg-red-600 text-white" : "text-red-600"}`} onClick={() => (confirmDel ? onDelete(a.id) : setConfirmDel(true))}>{confirmDel ? "Confirmar exclusão" : "Excluir"}</button>}
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn" onClick={() => valid() && onTest(a)}><MessageSquareText size={15} /> Salvar e testar</button>
        <button className="btn-primary" onClick={() => valid() && onSave(a)}>Salvar</button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do agente">{(id) => <input id={id} className="input" placeholder="Ex.: Especialista em Salário-maternidade" value={a.name} onChange={(e) => set("name", e.target.value)} />}</Field>
        <Field label="Benefício ou assunto">{(id) => <input id={id} className="input" placeholder="Ex.: Salário-maternidade" value={a.benefit} onChange={(e) => set("benefit", e.target.value)} />}</Field>
        <Field label="Área">{(id) => <select id={id} className="input" value={a.area} onChange={(e) => set("area", e.target.value as Attendant["area"])}>{AREAS.map((x) => <option key={x}>{x}</option>)}</select>}</Field>
        <div>
          <span className="label">Cor</span>
          <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label="Cor do agente">
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={a.color === c} aria-label={c} onClick={() => set("color", c)}
                className={`h-7 w-7 rounded-full ${a.color === c ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-[#171A21]" : ""}`} style={{ background: c }} />
            ))}
          </div>
        </div>
        <Field label="Palavras-chave" className="sm:col-span-2">
          {(id) => (
            <>
              <input id={id} className="input" placeholder="gravida, gestante, parto, salario maternidade" value={a.keywords} onChange={(e) => set("keywords", e.target.value)} aria-describedby={`${id}-h`} />
              <p id={`${id}-h`} className="muted mt-1 text-xs">Separadas por vírgula. Acentos e maiúsculas não importam. Quando aparecem na conversa, este agente assume.</p>
            </>
          )}
        </Field>
        {area("Roteiro de triagem", "questions", 6, "Uma pergunta por linha. A IA pergunta uma por vez, com as palavras dela, e pula o que a pessoa já contou. As respostas vão para o card do CRM.")}
        {area("Conhecimento sobre o benefício", "knowledge", 6, "O que o agente precisa saber para entender o caso. Ele nunca usa isso para dizer se a pessoa tem direito: quem avalia é o advogado.")}
        {area("Documentos úteis", "documents", 4, "Um por linha. A IA cita no fim, de forma geral, e não pede para enviar pelo chat.")}
        {area("Quando chamar a equipe", "redFlags", 4, "Situações em que a IA passa a conversa para uma pessoa (prazos, urgências, pedidos para falar com o advogado).")}
        {area("Perguntas frequentes e respostas aprovadas", "faq", 6, "No formato P: pergunta / R: resposta. A IA usa estas respostas quando a pessoa perguntar algo parecido.")}
        {area("Orientações de tom e estilo", "instructions", 2, "Opcional. Ex.: tratar por senhora, ser breve, acolher antes de perguntar.")}
      </div>
    </Modal>
  );
}

type SimMsg = { from: "cliente" | "ia"; text: string };

function TestChat({ attendant, onClose }: { attendant: Attendant; onClose: () => void }) {
  const attendants = useStore((s) => s.attendants);
  const [msgs, setMsgs] = useState<SimMsg[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [current, setCurrent] = useState(attendant.id);
  const [lead, setLead] = useState<SimulationResult["lead"]>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = attendants.find((a) => a.id === current);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    const next = [...msgs, { from: "cliente" as const, text: t }];
    setMsgs(next); setText(""); setBusy(true); setError("");
    try {
      const r = await simulateAgent(current, next);
      if (r.reply) setMsgs([...next, { from: "ia", text: r.reply }]);
      if (r.attendantId) setCurrent(r.attendantId);
      if (r.events.length) setEvents((e) => [...e, ...r.events]);
      if (r.lead) setLead(r.lead);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const reset = () => { setMsgs([]); setEvents([]); setLead(null); setCurrent(attendant.id); setError(""); };

  return (
    <Modal title={`Testar: ${attendant.name}`} onClose={onClose} wide footer={<><button className="btn mr-auto" onClick={reset}><RotateCcw size={15} /> Recomeçar</button><button className="btn" onClick={onClose}>Fechar</button></>}>
      <div className="space-y-3">
        <p className="muted text-sm">Escreva como se fosse um cliente. A resposta vem da IA de verdade, com o treinamento salvo, mas <b>nada é gravado nem enviado pelo WhatsApp</b>.</p>
        {!cloudMode && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">No modo demonstração não há IA conectada. O teste funciona no sistema online, com login.</p>}
        <p className="text-xs">Atendendo agora: <span className="chip text-white" style={{ background: now?.color ?? "#64748B" }}>{now?.name ?? "Triagem geral"}</span></p>
        <div className="max-h-[42vh] min-h-[180px] space-y-2 overflow-y-auto rounded-lg bg-[#F5F6F8] p-3 dark:bg-[#0F1115]" aria-live="polite">
          {!msgs.length && <p className="muted py-8 text-center text-sm">Ex.: “Oi, vi o anúncio. Estou grávida e fui demitida em março.”</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[85%] ${m.from === "cliente" ? "" : "ml-auto"}`}>
              <div className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.from === "cliente" ? "bg-white dark:bg-[#171A21]" : "bg-green-100 text-green-950 dark:bg-green-900/40 dark:text-green-50"}`}>{m.text}</div>
              <p className={`muted mt-0.5 text-[11px] ${m.from === "cliente" ? "" : "text-right"}`}>{m.from === "cliente" ? "Você (como cliente)" : "IA"}</p>
            </div>
          ))}
          {busy && <p className="muted flex items-center justify-end gap-2 text-xs"><Loader2 size={14} className="animate-spin" /> A IA está escrevendo…</p>}
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        {events.length > 0 && <ul className="space-y-1 text-xs">{events.map((e, i) => <li key={i} className="chip bg-card dark:bg-white/10">{e}</li>)}</ul>}
        {lead && (
          <div className="rounded-lg border border-line p-3 text-sm dark:border-white/10">
            <p className="font-semibold">Ficha que iria para o CRM</p>
            <p className="muted">{lead.nome} · {lead.area} · {lead.assunto} · urgência {lead.urgencia}</p>
            {lead.triagem?.length ? <ul className="mt-1 list-disc pl-5">{lead.triagem.map((t, i) => <li key={i}><b>{t.pergunta}</b> {t.resposta}</li>)}</ul> : null}
          </div>
        )}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="sim-text" className="sr-only">Mensagem de teste</label>
          <input id="sim-text" className="input" placeholder="Mensagem do cliente" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-primary" disabled={busy || !text.trim()} aria-label="Enviar mensagem de teste">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
        </form>
      </div>
    </Modal>
  );
}
