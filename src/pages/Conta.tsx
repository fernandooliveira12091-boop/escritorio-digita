import { LifeBuoy } from "lucide-react";
import { useState } from "react";
import { Avatar, Field, PageHeader } from "../components/ui/basics";
import { cloudMode } from "../lib/supabase";
import { useUi } from "../store/ui";
import { useCurrentUser, useStore } from "../store/useStore";

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
