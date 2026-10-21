import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Task, TransactionKind } from "../types";

export type ModalState =
  | { kind: "task"; task?: Task; preset?: Partial<Task> }
  | { kind: "taskDetail"; taskId: string }
  | { kind: "contact"; id?: string }
  | { kind: "process"; id?: string; preset?: { funnelId?: string; stageId?: string } }
  | { kind: "transaction"; id?: string; txKind?: TransactionKind }
  | null;

interface UiState {
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  modal: ModalState;
  toast: string | null;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
  showToast: (msg: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      // Sem preferência salva, segue o tema do sistema.
      theme: typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      sidebarCollapsed: false,
      mobileNavOpen: false,
      modal: null,
      toast: null,
      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNav: (open) => set({ mobileNavOpen: open }),
      openModal: (modal) => set({ modal }),
      closeModal: () => set({ modal: null }),
      showToast: (toast) => {
        clearTimeout(toastTimer);
        set({ toast });
        toastTimer = setTimeout(() => set({ toast: null }), 2800);
      },
    }),
    { name: "escritorio-digital-ui", partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }) },
  ),
);
