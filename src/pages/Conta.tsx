import { differenceInCalendarDays } from "date-fns";
import { Check, Gift, LifeBuoy, Mail, MessageCircle, Phone, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Avatar, Field, PageHeader } from "../components/ui/basics";
import { brl, fmtDate } from "../lib/format";
import { useUi } from "../store/ui";
import { useCurrentUser, useStore } from "../store/useStore";

const PLANS = [
  { id: "solo", name: "Solo", price: 89.9, users: "1 usuário", features: ["Agenda e prazos", "Contatos e processos", "Financeiro", "Modelos de documentos"] },
  { id: "escritorio", name: "Escritório", price: 199.9, users: "Até 5 usuários", features: ["Tudo do Solo", "CRM com funis", "Taskscore e metas", "Monitoramento de intimações", "2 agentes de IA"], featured: true },
  { id: "banca", name: "Banca", price: 449.9, users: "Usuários ilimitados", features: ["Tudo do Escritório", "Parceiros e processos compartilhados", "Todos os agentes de IA", "API e integrações", "Gerente de conta"] },
];

export function Conta() {
  const { settings, updateSettings, resetDemo } = useStore();
  const showToast = useUi((s) => s.showToast);
  const [confirmReset, setConfirmReset] = useState(false);
  const left = Math.max(0, differenceInCalendarDays(new Date(settings.trialEndsAt), new Date()));
  return (
    <>
      <PageHeader title="Conta e assinatura" />
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Período de teste</p>
          <p className="muted text-sm">Restam {left} dias. Termina em {fmtDate(settings.trialEndsAt)}.</p>
        </div>
        <div className="h-2 w-48 rounded-full bg-white dark:bg-white/10"><div className="h-2 rounded-full bg-primary" style={{ width: `${((14 - left) / 14) * 100}%` }} /></div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.id} className={`surface flex flex-col gap-4 p-5 ${p.featured ? "ring-2 ring-primary" : ""}`}>
            <div>
              {p.featured && <span className="chip mb-2 bg-primary-soft text-primary dark:bg-primary/15">Mais escolhido</span>}
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="muted text-sm">{p.users}</p>
            </div>
            <p><span className="text-3xl font-semibold tabular-nums">{brl(p.price)}</span><span className="muted text-sm"> /mês</span></p>
            <ul className="flex-1 space-y-2 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-green-600" /> {f}</li>)}</ul>
            <button className={p.featured ? "btn-primary" : "btn"} onClick={() => { updateSettings({ trialEndsAt: new Date(Date.now() + 365 * 864e5).toISOString() }); showToast(`Plano ${p.name} contratado (demonstração)`); }}>Contratar {p.name}</button>
          </div>
        ))}
      </div>
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold">Dados de demonstração</p><p className="muted text-sm">Volta todos os registros ao estado inicial. Tudo o que você cadastrou será apagado deste navegador.</p></div>
        <button className={`btn ${confirmReset ? "border-red-600 bg-red-600 text-white" : "text-red-600"}`} onClick={() => (confirmReset ? (resetDemo(), setConfirmReset(false), showToast("Dados restaurados")) : setConfirmReset(true))}>
          <RotateCcw size={16} /> {confirmReset ? "Confirmar: apagar e restaurar" : "Restaurar dados de exemplo"}
        </button>
      </div>
    </>
  );
}

function ContactForm({ kind }: { kind: "suporte" | "indicar" }) {
  const showToast = useUi((s) => s.showToast);
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", message: "" });
  if (sent) return <div className="card max-w-xl"><p className="font-semibold">{kind === "suporte" ? "Mensagem enviada." : "Indicação registrada."}</p><p className="muted text-sm">{kind === "suporte" ? "Respondemos por e-mail em até 1 dia útil." : `Avisaremos quando ${f.name.split(" ")[0]} criar a conta.`}</p><button className="link mt-2 text-sm" onClick={() => { setSent(false); setF({ name: "", email: "", phone: "", message: "" }); }}>Enviar outra</button></div>;
  return (
    <form className="card max-w-xl space-y-4" onSubmit={(e) => { e.preventDefault(); if (!f.name.trim() || !f.email.trim()) return showToast("Preencha nome e e-mail"); setSent(true); }}>
      <Field label={kind === "suporte" ? "Seu nome" : "Nome de quem você indica"}>{(id) => <input id={id} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-mail">{(id) => <input id={id} type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Telefone">{(id) => <input id={id} className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
      </div>
      <Field label={kind === "suporte" ? "Como podemos ajudar?" : "Mensagem (opcional)"}>{(id) => <textarea id={id} rows={4} className="input" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />}</Field>
      <button className="btn-primary">{kind === "suporte" ? "Enviar mensagem" : "Enviar indicação"}</button>
    </form>
  );
}

export function Suporte() {
  return (
    <>
      <PageHeader title="Suporte" subtitle="Fale com a nossa equipe." />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-3"><MessageCircle className="text-green-600" /><span className="text-sm">WhatsApp<br /><b>(61) 4000-0000</b></span></div>
        <div className="card flex items-center gap-3"><Mail className="text-primary" /><span className="text-sm">E-mail<br /><b>suporte@escritoriodigital.app</b></span></div>
        <div className="card flex items-center gap-3"><Phone className="text-ink-muted" /><span className="text-sm">Horário<br /><b>Seg. a sex., 8h às 18h</b></span></div>
      </div>
      <ContactForm kind="suporte" />
    </>
  );
}

export function Indicar() {
  return (
    <>
      <PageHeader title="Indicar o Escritório Digital" subtitle="Indique um colega. Quando ele contratar, você ganha 1 mês grátis." />
      <div className="card flex max-w-xl items-center gap-3"><Gift className="text-primary" /><p className="text-sm">Cada indicação que virar assinatura vale um mês grátis no seu plano, sem limite.</p></div>
      <ContactForm kind="indicar" />
    </>
  );
}

export function Perfil() {
  const user = useCurrentUser();
  const { patch } = useStore();
  const showToast = useUi((s) => s.showToast);
  const [f, setF] = useState({ name: user.name, email: user.email });
  return (
    <>
      <PageHeader title="Meu perfil" />
      <form className="card max-w-xl space-y-4" onSubmit={(e) => { e.preventDefault(); patch("users", user.id, f); showToast("Perfil atualizado"); }}>
        <div className="flex items-center gap-3"><Avatar user={user} size={56} /><div><p className="font-semibold">{user.name}</p><p className="muted text-sm">{user.role}</p></div></div>
        <Field label="Nome">{(id) => <input id={id} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="E-mail">{(id) => <input id={id} type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <button className="btn-primary">Salvar</button>
      </form>
      <p className="muted flex items-center gap-2 text-sm"><LifeBuoy size={16} /> Para trocar de perfil de acesso, fale com um gestor do escritório.</p>
    </>
  );
}
