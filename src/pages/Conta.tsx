import { Copy, LifeBuoy, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Avatar, Field, PageHeader } from "../components/ui/basics";
import { cloudMode } from "../lib/supabase";
import { useUi } from "../store/ui";
import { useCurrentUser, useStore } from "../store/useStore";

const SUPPORT = {
  whatsapp: "+55 61 99165-8755",
  whatsappLink: "https://wa.me/5561991658755",
  email: "fernandoolliveiradv@gmail.com",
};

export function Suporte() {
  const showToast = useUi((s) => s.showToast);
  const user = useCurrentUser();
  const message = `Olá! Aqui é ${user.name}. Tenho uma dúvida sobre o Escritório Digital: `;
  const copy = (text: string) =>
    navigator.clipboard?.writeText(text).then(() => showToast("Copiado"), () => showToast("Selecione o texto para copiar"));
  return (
    <>
      <PageHeader title="Suporte" subtitle="Dúvidas sobre o sistema, problemas de acesso ou sugestões: fale com o responsável pelo Escritório Digital." />
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <div className="card flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <MessageCircle className="text-green-600" />
            <span><span className="muted block text-xs">WhatsApp</span><b className="tabular-nums select-all">{SUPPORT.whatsapp}</b></span>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn border-green-600 bg-green-600 text-white hover:bg-green-700 dark:border-green-600 dark:bg-green-600 dark:hover:bg-green-700" href={`${SUPPORT.whatsappLink}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
            <button className="btn" onClick={() => copy(SUPPORT.whatsapp)}><Copy size={16} /> Copiar</button>
          </div>
        </div>
        <div className="card flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Mail className="text-primary" />
            <span className="min-w-0"><span className="muted block text-xs">E-mail</span><b className="block truncate select-all">{SUPPORT.email}</b></span>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href={`mailto:${SUPPORT.email}?subject=${encodeURIComponent("Suporte - Escritório Digital")}&body=${encodeURIComponent(message)}`}>Enviar e-mail</a>
            <button className="btn" onClick={() => copy(SUPPORT.email)}><Copy size={16} /> Copiar</button>
          </div>
        </div>
      </div>
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
