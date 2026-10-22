import { LifeBuoy, Mail, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { Avatar, Field, PageHeader } from "../components/ui/basics";
import { cloudMode } from "../lib/supabase";
import { useUi } from "../store/ui";
import { useCurrentUser, useStore } from "../store/useStore";

function ContactForm() {
  const showToast = useUi((s) => s.showToast);
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", message: "" });
  if (sent) return <div className="card max-w-xl"><p className="font-semibold">Mensagem enviada.</p><p className="muted text-sm">Respondemos por e-mail em até 1 dia útil.</p><button className="link mt-2 text-sm" onClick={() => { setSent(false); setF({ name: "", email: "", phone: "", message: "" }); }}>Enviar outra</button></div>;
  return (
    <form className="card max-w-xl space-y-4" onSubmit={(e) => { e.preventDefault(); if (!f.name.trim() || !f.email.trim()) return showToast("Preencha nome e e-mail"); setSent(true); }}>
      <Field label="Seu nome">{(id) => <input id={id} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-mail">{(id) => <input id={id} type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Telefone">{(id) => <input id={id} className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
      </div>
      <Field label="Como podemos ajudar?">{(id) => <textarea id={id} rows={4} className="input" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />}</Field>
      <button className="btn-primary">Enviar mensagem</button>
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
      <ContactForm />
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
        <Field label="E-mail">{(id) => <input id={id} type="email" className="input" disabled={cloudMode} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        {cloudMode && <p className="muted text-xs">O e-mail é o da sua conta de acesso.</p>}
        <button className="btn-primary">Salvar</button>
      </form>
      <p className="muted flex items-center gap-2 text-sm"><LifeBuoy size={16} /> Para trocar de perfil de acesso, fale com um gestor do escritório.</p>
    </>
  );
}
