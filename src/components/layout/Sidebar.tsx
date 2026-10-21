import {
  BarChart3, Bot, Briefcase, Calendar, CheckSquare, CreditCard, Gift, Handshake, Home, LifeBuoy, PanelLeftClose, PanelLeftOpen, Scale, Settings, Users, Wallet, Bell, X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { BrandLogo } from "../ui/Brand";
import { useUi } from "../../store/ui";

const MAIN = [
  { to: "/home", label: "Meu Painel", icon: Home },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/atividades", label: "Atividades", icon: CheckSquare },
  { to: "/crm", label: "CRM", icon: Briefcase },
  { to: "/contatos", label: "Contatos", icon: Users },
  { to: "/processos", label: "Processos", icon: Scale },
  { to: "/intimacoes", label: "Intimações", icon: Bell },
  { to: "/parceiros", label: "Parceiros", icon: Handshake },
  { to: "/modelos", label: "Modelos e IA", icon: Bot },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
];
const SECONDARY = [
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/conta", label: "Conta e assinatura", icon: CreditCard },
  { to: "/suporte", label: "Suporte", icon: LifeBuoy },
  { to: "/indicar", label: "Indicar o Escritório Digital", icon: Gift },
];

function Logo({ collapsed }: { collapsed: boolean }) {
  return <BrandLogo variant={collapsed ? "mono" : "full"} className={collapsed ? "" : "w-full max-w-[170px]"} />;
}

function Nav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const item = (it: (typeof MAIN)[number]) => (
    <NavLink
      key={it.to}
      to={it.to}
      onClick={onNavigate}
      title={collapsed ? it.label : undefined}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive
            ? "bg-primary-soft text-primary before:absolute before:-left-3 before:top-1.5 before:h-[calc(100%-12px)] before:w-1 before:rounded-r before:bg-primary dark:bg-primary/15"
            : "text-ink-muted hover:bg-gray-100 hover:text-ink dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
        } ${collapsed ? "justify-center px-0" : ""}`
      }
    >
      <it.icon size={18} className="shrink-0" aria-hidden="true" />
      {collapsed ? <span className="sr-only">{it.label}</span> : <span className="truncate">{it.label}</span>}
    </NavLink>
  );
  return (
    <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
      {MAIN.map(item)}
      <hr className="my-3 border-line dark:border-white/10" />
      {SECONDARY.map(item)}
    </nav>
  );
}

export function Sidebar() {
  const { sidebarCollapsed: collapsed, toggleSidebar, mobileNavOpen, setMobileNav } = useUi();
  return (
    <>
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-white transition-[width] dark:border-white/10 dark:bg-[#12151B] lg:flex ${collapsed ? "w-[72px]" : "w-[210px]"}`}>
        <div className={`flex items-center gap-1 ${collapsed ? "flex-col justify-center px-2 pt-3" : "justify-between py-3 pl-3 pr-2"}`}>
          <NavLink to="/home" aria-label="Ir para Meu Painel" className="min-w-0 flex-1"><Logo collapsed={collapsed} /></NavLink>
          <button className="btn-icon h-8 w-8" onClick={toggleSidebar} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} aria-expanded={!collapsed}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <div className={collapsed ? "pt-4" : "pt-1"}>
          <Nav collapsed={collapsed} />
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setMobileNav(false)}>
          <aside role="dialog" aria-modal="true" aria-label="Menu" className="flex h-full w-[260px] flex-col bg-white shadow-xl dark:bg-[#12151B]">
            <div className="flex items-center justify-between gap-2 py-3 pl-3 pr-2">
              <Logo collapsed={false} />
              <button className="btn-icon" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X size={18} /></button>
            </div>
            <Nav collapsed={false} onNavigate={() => setMobileNav(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
