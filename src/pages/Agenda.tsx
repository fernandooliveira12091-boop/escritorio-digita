import { addDays, addMonths, addWeeks, format, isSameDay, isSameMonth, setHours, startOfDay, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { GoogleCalendarModal } from "../components/GoogleCalendarModal";
import { STATE_STYLE } from "../components/tasks";
import { PageHeader, Segmented } from "../components/ui/basics";
import { UserChipSelect } from "../components/ui/UserChipSelect";
import { fmtMonth, toDate } from "../lib/format";
import { taskState } from "../lib/rules";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { Task } from "../types";

type View = "mes" | "dia" | "semana";
const HOURS = Array.from({ length: 14 }, (_, i) => 7 + i); // 07h–20h

function Pill({ task, field }: { task: Task; field: "date" | "deadline" }) {
  const openModal = useUi((s) => s.openModal);
  const st = taskState(task);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); openModal({ kind: "taskDetail", taskId: task.id }); }}
      className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium ${STATE_STYLE[st].pill}`}
      title={task.title}
    >
      {format(toDate(task[field] ?? task.date), "HH:mm")} {task.title}
    </button>
  );
}

export default function Agenda() {
  const { tasks, users } = useStore();
  const openModal = useUi((s) => s.openModal);
  const [view, setView] = useState<View>("mes");
  const [cursor, setCursor] = useState(new Date());
  const [resp, setResp] = useState<string[]>([]);
  const [field, setField] = useState<"date" | "deadline">("date");
  const [showDone, setShowDone] = useState(true);
  const [googleOpen, setGoogleOpen] = useState(false);

  const visible = useMemo(
    () => tasks.filter((t) => (field === "deadline" ? !!t.deadline : true))
      .filter((t) => showDone || t.status !== "concluida")
      .filter((t) => !resp.length || t.responsibleIds.some((id) => resp.includes(id))),
    [tasks, field, showDone, resp],
  );
  const on = (d: Date) => visible.filter((t) => isSameDay(toDate(t[field] ?? t.date), d)).sort((a, b) => (a[field] ?? "").localeCompare(b[field] ?? ""));
  const newAt = (d: Date) => openModal({ kind: "task", preset: { date: setHours(startOfDay(d), 9).toISOString() } });

  const nav = (dir: 1 | -1) =>
    setCursor(view === "mes" ? (dir > 0 ? addMonths(cursor, 1) : subMonths(cursor, 1)) : view === "semana" ? (dir > 0 ? addWeeks(cursor, 1) : subWeeks(cursor, 1)) : dir > 0 ? addDays(cursor, 1) : subDays(cursor, 1));
  const title = view === "mes" ? fmtMonth(cursor) : view === "semana" ? `Semana de ${format(startOfWeek(cursor), "dd/MM")} a ${format(addDays(startOfWeek(cursor), 6), "dd/MM/yyyy")}` : format(cursor, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const today = new Date();

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Clique em um dia para criar uma tarefa, ou em um compromisso para ver os detalhes."
        actions={<button className="btn" onClick={() => setGoogleOpen(true)}><CalendarPlus size={16} /> Google Agenda</button>}
      />
      {googleOpen && <GoogleCalendarModal onClose={() => setGoogleOpen(false)} />}
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented label="Visão" value={view} onChange={setView} options={[{ id: "mes", label: "Mês" }, { id: "dia", label: "Dia" }, { id: "semana", label: "Semana" }]} />
        <UserChipSelect users={users} value={resp} onChange={setResp} />
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Data exibida</span>
          <select className="input w-auto" value={field} onChange={(e) => setField(e.target.value as "date" | "deadline")}>
            <option value="date">Data do compromisso</option>
            <option value="deadline">Prazo fatal</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Mostrar concluídos</label>
        <div className="flex flex-wrap gap-3 text-xs">
          {(["pendente", "concluida", "atrasada"] as const).map((s) => (
            <span key={s} className={`chip border ${STATE_STYLE[s].pill}`}>{s === "pendente" ? "Pendentes" : s === "concluida" ? "Concluídas" : "Atrasadas"}</span>
          ))}
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-1">
            <button className="btn-icon" onClick={() => nav(-1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
            <button className="btn-icon" onClick={() => nav(1)} aria-label="Próximo"><ChevronRight size={18} /></button>
            <h2 className="ml-2 text-base font-semibold first-letter:uppercase">{title}</h2>
          </div>
          <button className="btn" onClick={() => setCursor(new Date())}>Hoje</button>
        </div>

        {view === "mes" && (
          <div className="overflow-x-auto">
            <div className="grid min-w-[700px] grid-cols-7">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="th border-b border-line text-center dark:border-white/10">{d}</div>)}
              {Array.from({ length: 42 }, (_, i) => addDays(startOfWeek(startOfMonth(cursor)), i)).map((d) => {
                const items = on(d);
                const out = !isSameMonth(d, cursor);
                return (
                  <div key={d.toISOString()} onClick={() => newAt(d)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && newAt(d)} aria-label={`${format(d, "dd/MM/yyyy")}: ${items.length} compromisso(s). Criar tarefa`}
                    className={`min-h-[112px] cursor-pointer space-y-1 border-b border-r border-line p-1.5 hover:bg-card dark:border-white/5 dark:hover:bg-white/5 ${out ? "bg-gray-50/70 dark:bg-black/20" : ""}`}>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs tabular-nums ${isSameDay(d, today) ? "bg-primary font-semibold text-white" : out ? "text-gray-400 dark:text-gray-600" : ""}`}>{format(d, "d")}</span>
                    {items.slice(0, 3).map((t) => <Pill key={t.id} task={t} field={field} />)}
                    {items.length > 3 && (
                      <button className="link block px-1 text-[11px]" onClick={(e) => { e.stopPropagation(); setCursor(d); setView("dia"); }}>+{items.length - 3} mais</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(view === "semana" || view === "dia") && (
          <div className="overflow-x-auto">
            {(() => {
              const days = view === "dia" ? [cursor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));
              return (
                <div className={`grid ${view === "dia" ? "min-w-[360px]" : "min-w-[800px]"}`} style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
                  <div className="border-b border-line dark:border-white/10" />
                  {days.map((d) => (
                    <div key={d.toISOString()} className="border-b border-l border-line p-2 text-center text-xs dark:border-white/10">
                      <span className="muted block uppercase">{format(d, "EEE", { locale: ptBR })}</span>
                      <span className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isSameDay(d, today) ? "bg-primary text-white" : ""}`}>{format(d, "d")}</span>
                    </div>
                  ))}
                  {HOURS.map((h) => (
                    <div key={h} className="contents">
                      <div className="muted border-b border-line pr-2 pt-1 text-right text-[11px] tabular-nums dark:border-white/5">{String(h).padStart(2, "0")}h</div>
                      {days.map((d) => {
                        const items = on(d).filter((t) => {
                          const hr = toDate(t[field] ?? t.date).getHours();
                          return h === 7 ? hr <= 7 : h === 20 ? hr >= 20 : hr === h;
                        });
                        return (
                          <div key={d.toISOString() + h} role="button" tabIndex={0} aria-label={`Criar tarefa em ${format(d, "dd/MM")} às ${h}h`}
                            onClick={() => openModal({ kind: "task", preset: { date: setHours(startOfDay(d), h).toISOString() } })}
                            onKeyDown={(e) => e.key === "Enter" && openModal({ kind: "task", preset: { date: setHours(startOfDay(d), h).toISOString() } })}
                            className="min-h-[48px] space-y-0.5 border-b border-l border-line p-1 hover:bg-card dark:border-white/5 dark:hover:bg-white/5">
                            {items.map((t) => <Pill key={t.id} task={t} field={field} />)}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
