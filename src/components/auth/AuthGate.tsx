import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { siteUrl, supabase } from "../../lib/supabase";
import { initialData, startSync } from "../../store/sync";
import { BrandLogo } from "../ui/Brand";
import { useUi } from "../../store/ui";

type Phase = "loading" | "signedOut" | "recovery" | "noWorkspace" | "ready" | "error";

const authName = (s: Session) => (s.user.user_metadata?.name as string | undefined) || s.user.email?.split("@")[0] || "Usuário";

/** Traduz as mensagens de erro mais comuns do login. */
function ptError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (m.includes("user already registered")) return "Já existe uma conta com este e-mail. Use “Entrar” ou “Esqueci minha senha”.";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  return msg;
}

function Shell({ children }: { children: ReactNode }) {
  const theme = useUi((s) => s.theme);
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); }, [theme]);
  return (
    <main className="flex min-h-full items-center justify-center bg-card px-4 py-10 dark:bg-[#0F1115]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-4">
          <BrandLogo className="w-full max-w-[240px]" />
          <span className="muted text-xs font-medium uppercase tracking-[0.2em]">Escritório Digital</span>
        </div>
        <div className="surface space-y-5 p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<"entrar" | "criar" | "esqueci">("entrar");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    const email = f.email.trim();
    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: f.password });
        if (error) throw error;
      } else if (mode === "criar") {
        if (f.password.length < 8) throw new Error("Password should be at least 8 characters");
        const { data, error } = await supabase.auth.signUp({ email, password: f.password, options: { data: { name: f.name.trim() }, emailRedirectTo: siteUrl() } });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, text: `Enviamos um link de confirmação para ${email}. Abra o e-mail, confirme e depois entre aqui.` });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() });
        if (error) throw error;
        setMsg({ ok: true, text: `Se houver uma conta com ${email}, enviamos um link para criar uma nova senha.` });
      }
    } catch (err) {
      setMsg({ ok: false, text: ptError((err as Error).message) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-lg font-semibold">{mode === "entrar" ? "Entrar" : mode === "criar" ? "Criar conta" : "Recuperar senha"}</h1>
        <p className="muted text-sm">{mode === "entrar" ? "Acesse os dados do seu escritório." : mode === "criar" ? "Use o e-mail em que você recebeu o convite, se for o caso." : "Enviaremos um link para o seu e-mail."}</p>
      </div>
      {mode === "criar" && (
        <div><label htmlFor="name" className="label">Seu nome</label><input id="name" className="input" autoComplete="name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      )}
      <div><label htmlFor="email" className="label">E-mail</label><input id="email" type="email" className="input" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      {mode !== "esqueci" && (
        <div>
          <label htmlFor="password" className="label">Senha{mode === "criar" ? " (mínimo 8 caracteres)" : ""}</label>
          <input id="password" type="password" className="input" autoComplete={mode === "criar" ? "new-password" : "current-password"} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
      )}
      {msg && <p role="alert" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800 dark:bg-green-500/15 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"}`}>{msg.text}</p>}
      <button className="btn-primary w-full" disabled={busy || !f.email || (mode !== "esqueci" && !f.password)}>
        {busy && <Loader2 size={16} className="animate-spin" />}
        {mode === "entrar" ? "Entrar" : mode === "criar" ? "Criar conta" : "Enviar link"}
      </button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        {mode !== "entrar" && <button type="button" className="link" onClick={() => { setMode("entrar"); setMsg(null); }}>Já tenho conta</button>}
        {mode !== "criar" && <button type="button" className="link" onClick={() => { setMode("criar"); setMsg(null); }}>Criar conta</button>}
        {mode !== "esqueci" && <button type="button" className="link" onClick={() => { setMode("esqueci"); setMsg(null); }}>Esqueci minha senha</button>}
      </div>
    </form>
  );
}

function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (password.length < 8) return setMsg("A senha precisa ter pelo menos 8 caracteres.");
      setBusy(true);
      const { error } = await supabase!.auth.updateUser({ password });
      setBusy(false);
      if (error) return setMsg(ptError(error.message));
      onDone();
    }}>
      <h1 className="text-lg font-semibold">Criar nova senha</h1>
      <div><label htmlFor="np" className="label">Nova senha (mínimo 8 caracteres)</label><input id="np" type="password" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {msg && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-300">{msg}</p>}
      <button className="btn-primary w-full" disabled={busy}>Salvar nova senha</button>
    </form>
  );
}

function CreateWorkspace({ session, onCreated }: { session: Session; onCreated: (id: string, withExamples: boolean) => void }) {
  const [name, setName] = useState("");
  const [examples, setExamples] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const { data, error } = await supabase!.rpc("create_workspace", { ws_name: name });
      setBusy(false);
      if (error) return setMsg(ptError(error.message));
      onCreated(data as string, examples);
    }}>
      <div>
        <h1 className="text-lg font-semibold">Bem-vindo, {authName(session).split(" ")[0]}</h1>
        <p className="muted text-sm">Crie o seu escritório. Se um colega já usa o sistema, peça que ele convide o e-mail {session.user.email} em Configurações › Usuários e entre de novo.</p>
      </div>
      <div><label htmlFor="ws" className="label">Nome do escritório</label><input id="ws" className="input" placeholder="Ex.: Fernando Oliveira Advocacia" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={examples} onChange={(e) => setExamples(e.target.checked)} />
        <span>Começar com dados de exemplo<span className="muted block text-xs">Contatos, processos e tarefas fictícios para conhecer o sistema. Dá para excluir depois.</span></span>
      </label>
      {msg && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-300">{msg}</p>}
      <button className="btn-primary w-full" disabled={busy || !name.trim()}>{busy && <Loader2 size={16} className="animate-spin" />} Criar escritório</button>
      <button type="button" className="link block w-full text-center text-sm" onClick={() => supabase!.auth.signOut()}>Sair e usar outra conta</button>
    </form>
  );
}

/** Exige login antes de mostrar o sistema. Sem Supabase configurado, mostra direto (modo demonstração). */
export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(supabase ? "loading" : "ready");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");

  const enter = async (s: Session, created?: { id: string; withExamples: boolean }) => {
    setPhase("loading");
    try {
      let wsId = created?.id;
      if (!wsId) {
        const { data, error: err } = await supabase!.rpc("accept_invites");
        if (err) throw err;
        wsId = (data as string[] | null)?.[0];
      }
      if (!wsId) return setPhase("noWorkspace");
      const auth = { id: s.user.id, email: s.user.email ?? "", name: authName(s) };
      await startSync(wsId, auth, created ? initialData(created.withExamples, { ...auth, authId: s.user.id }) : undefined);
      setPhase("ready");
    } catch (e) {
      const m = (e as Error).message ?? "";
      setError(m.includes("does not exist") || m.includes("schema cache")
        ? "O banco de dados ainda não foi configurado. Rode o arquivo supabase/schema.sql no SQL Editor do Supabase."
        : ptError(m));
      setPhase("error");
    }
  };

  useEffect(() => {
    if (!supabase) return;
    const clean = () => {
      // Remove ?code=… do endereço depois do login por link (confirmação ou nova senha).
      if (location.search.includes("code=")) history.replaceState(null, "", siteUrl() + location.hash);
    };
    supabase.auth.getSession().then(({ data }) => {
      clean();
      setSession(data.session);
      if (data.session) enter(data.session);
      else setPhase("signedOut");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setPhase("recovery");
      else if (event === "SIGNED_IN" && s) setPhase((p) => (p === "signedOut" ? (enter(s), "loading") : p));
      else if (event === "SIGNED_OUT") setPhase("signedOut");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (phase === "ready") return <>{children}</>;
  if (phase === "loading") return <Shell><p className="muted flex items-center justify-center gap-2 py-6 text-sm"><Loader2 size={18} className="animate-spin" /> Carregando…</p></Shell>;
  if (phase === "recovery") return <Shell><NewPassword onDone={() => session && enter(session)} /></Shell>;
  if (phase === "noWorkspace" && session) return <Shell><CreateWorkspace session={session} onCreated={(id, withExamples) => enter(session, { id, withExamples })} /></Shell>;
  if (phase === "error") return (
    <Shell>
      <p role="alert" className="text-sm">{error}</p>
      <div className="flex gap-2"><button className="btn-primary" onClick={() => session ? enter(session) : setPhase("signedOut")}>Tentar de novo</button><button className="btn" onClick={() => supabase!.auth.signOut()}>Sair</button></div>
    </Shell>
  );
  return <Shell><LoginForm /></Shell>;
}
