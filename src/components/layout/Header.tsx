import { Bell, Briefcase, CheckSquare, ChevronDown, LogOut, Menu, Moon, Plus, Search, Sun, User as UserIcon, Users, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { normalize, relDateTime } from "../../lib/format";
import { useUi } from "../../store/ui";
import { useCurrentUser, useStore } from "../../store/useStore";
import { Avatar, Dropdown, MenuItem } from "../ui/basics";

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const { contacts, processes, tasks } = useStore();
  const navigate = useNavigate();
  const openModal = useUi((s) => s.openModal);

  // A tecla "/" foca a busca (fora de campos de texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const n = normalize(q.trim());
    if (n.length < 2) return [];
    const c = contacts.filter((x) => normalize(`${x.name} ${x.document} ${x.phone}`).includes(n)).slice(0, 5)
      .map((x) => ({ id: x.id, icon: Users, label: x.name, sub: "Contato", go: () => openModal({ kind: "contact", id: x.id }) }));
    const p = processes.filter((x) => normalize(`${x.number} ${x.opposingParty} ${contacts.find((k) => k.id === x.contactIds[0])?.name ?? ""}`).includes(n)).slice(0, 5)
      .map((x) => ({ id: x.id, icon: Briefcase, label: x.number, sub: `Processo · ${contacts.find((k) => k.id === x.contactIds[0])?.name ?? ""}`, go: () => navigate(`/processos/${x.id}`) }));
    const t = tasks.filter((x) => normalize(x.title).includes(n)).slice(0, 5)
      .map((x) => ({ id: x.id, icon: CheckSquare, label: x.title, sub: `Tarefa · ${relDateTime(x.date)}`, go: () => openModal({ kind: "taskDetail", taskId: x.id }) }));
    return [...c, ...p, ...t];
  }, [q, contacts, processes, tasks, navigate, openModal]);

  return (
    <div className="relative w-full max-w-md">
      <label className="relative block">
        <span className="sr-only">Pesquisar contatos, processos e tarefas</span>
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={ref}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => e.key === "Escape" && (setQ(""), ref.current?.blur())}
          placeholder="Digite / para pesquisar"
          className="input rounded-full bg-card pl-10 dark:bg-[#171A21]"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="global-search-results"
        />
      </label>
      {open && q.trim().length >= 2 && (
        <div id="global-search-results" role="listbox" className="absolute left-0 right-0 z-40 mt-2 max-h-96 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#171A21]">
          {results.length === 0 && <p className="muted px-3 py-4 text-sm">Nada encontrado para “{q}”.</p>}
          {results.map((r) => (
            <button key={r.id} role="option" aria-selected="false" onMouseDown={(e) => e.preventDefault()} onClick={() => { r.go(); setQ(""); setOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-white/10">
              <r.icon size={16} className="shrink-0 text-ink-muted" />
              <span className="min-w-0">
                <span className="block truncate text-sm">{r.label}</span>
                <span className="muted block truncate text-xs">{r.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { theme, toggleTheme, openModal, setMobileNav, showToast } = useUi();
  const user = useCurrentUser();
  const { notifications, patch } = useStore();
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white/90 px-4 backdrop-blur dark:border-white/10 dark:bg-[#0F1115]/90 sm:gap-3">
      <button className="btn-icon lg:hidden" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu size={20} /></button>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button
          role="switch"
          aria-checked={theme === "dark"}
          aria-label="Modo escuro"
          onClick={toggleTheme}
          className="relative hidden h-8 w-14 items-center rounded-full bg-card px-1 dark:bg-white/10 sm:inline-flex"
        >
          <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition dark:bg-[#0F1115] ${theme === "dark" ? "translate-x-6" : ""}`}>
            {theme === "dark" ? <Moon size={14} /> : <Sun size={14} className="text-amber-500" />}
          </span>
        </button>
        <button className="btn-icon sm:hidden" onClick={toggleTheme} aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}>
          {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <Dropdown
          label="Notificações"
          trigger={() => (
            <button className="btn-icon relative" aria-label={`Notificações: ${unread} não lidas`}>
              <Bell size={18} />
              {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
            </button>
          )}
        >
          {(close) => (
            <div className="w-72">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Notificações</p>
              {notifications.length === 0 && <p className="muted px-3 py-4 text-sm">Nenhuma notificação.</p>}
              {[...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((n) => (
                <MenuItem key={n.id} onClick={() => { patch("notifications", n.id, { read: true }); close(); n.link && navigate(n.link); }}>
                  <span className={`mt-1 h-2 w-2 shrink-0 self-start rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`} />
                  <span>
                    <span className={`block text-sm ${n.read ? "" : "font-semibold"}`}>{n.title}</span>
                    <span className="muted text-xs">{relDateTime(n.createdAt)}</span>
                  </span>
                </MenuItem>
              ))}
            </div>
          )}
        </Dropdown>

        <Dropdown label="Adicionar" trigger={() => <button className="btn-primary"><Plus size={16} /><span className="hidden sm:inline">Adicionar</span><ChevronDown size={14} /></button>}>
          {(close) => (
            <>
              <MenuItem onClick={() => { openModal({ kind: "task" }); close(); }}><CheckSquare size={16} /> Nova tarefa</MenuItem>
              <MenuItem onClick={() => { openModal({ kind: "contact" }); close(); }}><Users size={16} /> Novo contato</MenuItem>
              <MenuItem onClick={() => { openModal({ kind: "process" }); close(); }}><Briefcase size={16} /> Novo processo</MenuItem>
              <MenuItem onClick={() => { openModal({ kind: "transaction", txKind: "receita" }); close(); }}><Wallet size={16} /> Nova receita/despesa</MenuItem>
            </>
          )}
        </Dropdown>

        <Dropdown
          label="Menu do usuário"
          trigger={() => (
            <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-white/10">
              <Avatar user={user} size={30} />
              <span className="hidden text-sm md:inline">Olá, {user.name.split(" ")[0]}</span>
              <ChevronDown size={14} className="hidden md:inline" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem onClick={() => { navigate("/perfil"); close(); }}><UserIcon size={16} /> Meu perfil</MenuItem>
              <MenuItem danger onClick={() => { close(); showToast("Sessão encerrada (demonstração)"); }}><LogOut size={16} /> Sair</MenuItem>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
