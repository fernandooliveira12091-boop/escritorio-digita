import { ArrowDownRight, ArrowUpRight, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  value: ReactNode;
  /** Comparativo mês atual x mês anterior. */
  delta?: { pct: number; up: boolean; previous: ReactNode };
  /** Inverte as cores quando subir é ruim (ex.: atrasos). */
  upIsBad?: boolean;
  tone?: "default" | "danger" | "success";
  link?: { label: string; onClick: () => void };
  /** Seta ▾ que filtra a tabela abaixo. */
  filter?: { active: boolean; onToggle: () => void };
  subtitle?: ReactNode;
}

export function KpiCard({ title, value, delta, upIsBad, tone = "default", link, filter, subtitle }: Props) {
  const good = delta ? (upIsBad ? !delta.up : delta.up) : true;
  return (
    <div className={`card flex min-w-0 flex-col gap-1 ${filter?.active ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="muted text-sm font-medium">{title}</span>
        {filter && (
          <button className="btn-icon -m-1.5 h-7 w-7" onClick={filter.onToggle} aria-pressed={filter.active} aria-label={`Filtrar tabela por: ${title}`}>
            <ChevronDown size={16} className={filter.active ? "text-primary" : ""} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-2xl font-semibold tabular-nums ${tone === "danger" ? "text-red-600 dark:text-red-400" : tone === "success" ? "text-green-600 dark:text-green-400" : ""}`}>{value}</span>
        {delta && (
          <span className={`chip ${good ? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"}`}>
            {delta.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta.pct)}%
          </span>
        )}
      </div>
      {delta && <span className="muted text-xs">vs mês anterior: {delta.previous}</span>}
      {subtitle && <span className="muted text-xs">{subtitle}</span>}
      {link && (
        <button className="link mt-auto self-start pt-1 text-xs" onClick={link.onClick}>
          {link.label}
        </button>
      )}
    </div>
  );
}
