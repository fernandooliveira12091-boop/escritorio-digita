import { addDays, addMonths, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { fmtMonth } from "../../lib/format";

interface Props {
  /** Quantidade de eventos por dia (chave yyyy-MM-dd). */
  counts: Record<string, number>;
  selected?: Date;
  onSelect?: (d: Date) => void;
  footer?: ReactNode;
}

export const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

export function MiniCalendar({ counts, selected, onSelect, footer }: Props) {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [sel, setSel] = useState<Date>(selected ?? new Date());
  const start = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = new Date();
  const selCount = counts[dayKey(sel)] || 0;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{fmtMonth(month)}</span>
        <div className="flex">
          <button className="btn-icon h-7 w-7" onClick={() => setMonth(subMonths(month, 1))} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
          <button className="btn-icon h-7 w-7" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span key={i} className="muted font-semibold">{d}</span>
        ))}
        {days.map((d) => {
          const c = counts[dayKey(d)] || 0;
          const isToday = isSameDay(d, today);
          const isSel = isSameDay(d, sel);
          return (
            <button
              key={d.toISOString()}
              onClick={() => { setSel(d); onSelect?.(d); }}
              aria-label={`${format(d, "dd/MM/yyyy")}: ${c} evento(s)`}
              aria-pressed={isSel}
              className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full tabular-nums transition
                ${isToday ? "bg-ink font-semibold text-white dark:bg-white dark:text-ink" : isSel ? "bg-primary-soft text-primary dark:bg-primary/20" : "hover:bg-gray-200 dark:hover:bg-white/10"}
                ${!isSameMonth(d, month) ? "opacity-35" : ""}`}
            >
              {format(d, "d")}
              {c > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{c}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t border-line pt-2 text-xs dark:border-white/10">
        <span className="font-semibold uppercase tracking-wider text-ink-muted dark:text-gray-400">
          {selCount} {selCount === 1 ? "evento" : "eventos"} · {format(sel, "dd/MM")}
        </span>
        {footer}
      </div>
    </div>
  );
}
