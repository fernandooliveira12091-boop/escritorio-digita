import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useUi } from "../../store/ui";
import { useStore } from "../../store/useStore";
import { ModalHost } from "../modals/ModalHost";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

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
        <main id="conteudo" className="mx-auto w-full max-w-[1400px] flex-1 space-y-6 px-4 pb-12 pt-6 sm:px-6">
          <Outlet />
        </main>
      </div>
      <ModalHost />
      <Toast />
    </div>
  );
}
