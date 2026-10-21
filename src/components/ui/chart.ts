import { useUi } from "../../store/ui";

/** Cores dos gráficos que acompanham o tema claro/escuro. */
export function useChartTheme() {
  const dark = useUi((s) => s.theme === "dark");
  return {
    text: dark ? "#9CA3AF" : "#6B7280",
    grid: dark ? "rgba(255,255,255,0.08)" : "#E5E7EB",
    cursor: dark ? "rgba(255,255,255,0.05)" : "rgba(17,24,39,0.04)",
    tooltip: {
      background: dark ? "#171A21" : "#FFFFFF",
      border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "#E5E7EB"}`,
      borderRadius: 8,
      color: dark ? "#F3F4F6" : "#111827",
      fontSize: 12,
    },
  };
}

export const PALETTE = ["#2F80ED", "#9B51E0", "#27AE60", "#F2994A", "#EB5757", "#56CCF2", "#BB6BD9", "#F2C94C"];
