import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useUi } from "../../store/ui";
import { useStore } from "../../store/useStore";
import { ModalHost } from "../modals/ModalHost";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ me: false, text: "Olá! Como podemos ajudar com o Escritório Digital?" }]);
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { me: true, text }, { me: false, text: "Recebemos sua mensagem. Um consultor responde em instantes, em horário comercial." }]);
    setText("");
  };
  return (
    <div className="fixed bottom-[calc(16px+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div role="dialog" aria-label="Chat com o suporte" className="surface flex h-96 w-[min(320px,calc(100vw-32px))] flex-col shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 dark:border-white/10">
            <span className="font-semibold">Suporte</span>
            <button className="btn-icon h-8 w-8" onClick={() => setOpen(false)} aria-label="Fechar chat"><X size={16} /></button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
            {msgs.map((m, i) => (
              <p key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.me ? "ml-auto bg-primary text-white" : "bg-card dark:bg-white/10"}`}>{m.text}</p>
            ))}
          </div>
          <form className="flex gap-2 border-t border-line p-2 dark:border-white/10" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label className="sr-only" htmlFor="chat-input">Mensagem</label>
            <input id="chat-input" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva sua mensagem" />
            <button className="btn-primary px-3" aria-label="Enviar"><Send size={16} /></button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen(!open)} className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary-hover" aria-label={open ? "Fechar chat" : "Abrir chat com o suporte"} aria-expanded={open}>
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}

function Toast() {
  const toast = useUi((s) => s.toast);
  if (!toast) return null;
  return (
    <div role="status" className="fixed bottom-[calc(24px+env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-ink">
      {toast}
    </div>
  );
}

export function Layout() {
  const { theme, sidebarCollapsed } = useUi();
  const location = useLocation();
  const log = useStore((s) => s.log);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  useEffect(() => {
    log(`Acessou ${location.pathname}`);
    window.scrollTo(0, 0);
  }, [location.pathname, log]);

  return (
    <div className="flex min-h-full" style={{ ["--sidebar-w" as string]: sidebarCollapsed ? "72px" : "210px" }}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-white focus:px-3 focus:py-2">Pular para o conteúdo</a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="conteudo" className="mx-auto w-full max-w-[1400px] flex-1 space-y-6 px-4 pb-24 pt-6 sm:px-6">
          <Outlet />
        </main>
      </div>
      <ChatWidget />
      <ModalHost />
      <Toast />
    </div>
  );
}
