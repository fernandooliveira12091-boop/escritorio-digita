import { AlertCircle, Star } from "lucide-react";
import { useMemo } from "react";
import { relDateTime, fmtDateTime } from "../lib/format";
import { STATE_LABEL, taskDue, taskState, type TaskState } from "../lib/rules";
import { useStore } from "../store/useStore";
import { useUi } from "../store/ui";
import type { Task } from "../types";
import { AvatarStack } from "./ui/basics";
import type { Column } from "./ui/DataTable";

export const STATE_STYLE: Record<TaskState, { dot: string; pill: string }> = {
  pendente: { dot: "bg-blue-500", pill: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30" },
  concluida: { dot: "bg-green-500", pill: "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30" },
  atrasada: { dot: "bg-red-500", pill: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30" },
};

export function StatusDot({ task }: { task: Task }) {
  const st = taskState(task);
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATE_STYLE[st].dot}`} title={STATE_LABEL[st]} aria-label={STATE_LABEL[st]} />;
}

/** Nomes das partes de uma tarefa: cliente e parte contrária do processo. */
export function useTaskParties() {
  const contacts = useStore((s) => s.contacts);
  const processes = useStore((s) => s.processes);
  return useMemo(() => {
    const byContact = new Map(contacts.map((c) => [c.id, c.name]));
    const byProcess = new Map(processes.map((p) => [p.id, p]));
    return (t: Task) => {
      const p = t.processId ? byProcess.get(t.processId) : undefined;
      const client = t.contactId ? byContact.get(t.contactId) : p ? byContact.get(p.contactIds[0]) : undefined;
      return [client, p?.opposingParty].filter(Boolean).join(" x ");
    };
  }, [contacts, processes]);
}

export function TaskFlags({ task }: { task: Task }) {
  const patch = useStore((s) => s.patch);
  return (
    <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-white/10"
        aria-pressed={task.favorite}
        aria-label={task.favorite ? "Remover dos favoritos" : "Marcar como favorita"}
        onClick={() => patch("tasks", task.id, { favorite: !task.favorite })}
      >
        <Star size={15} className={task.favorite ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"} />
      </button>
      <button
        className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-white/10"
        aria-pressed={task.priority}
        aria-label={task.priority ? "Remover prioridade" : "Marcar como prioritária"}
        onClick={() => patch("tasks", task.id, { priority: !task.priority })}
      >
        <AlertCircle size={15} className={task.priority ? "text-red-500" : "text-gray-300 dark:text-gray-600"} />
      </button>
    </span>
  );
}

export function useTaskColumns(): Column<Task>[] {
  const users = useStore((s) => s.users);
  const parties = useTaskParties();
  return [
    { key: "flags", header: <span className="sr-only">Favorita e prioridade</span>, render: (t) => <TaskFlags task={t} />, className: "w-14" },
    { key: "status", header: <span className="sr-only">Situação</span>, render: (t) => <StatusDot task={t} />, sortValue: (t) => taskState(t), className: "w-6" },
    {
      key: "title", header: "Tarefa", sortValue: (t) => t.title,
      render: (t) => <span className={`font-medium ${t.status === "concluida" ? "text-ink-muted line-through dark:text-gray-500" : ""} ${t.read ? "" : "font-semibold"}`}>{t.title}</span>,
    },
    { key: "parties", header: "Partes", sortValue: (t) => parties(t), render: (t) => <span className="muted">{parties(t) || "—"}</span> },
    { key: "date", header: "Data compromisso", sortValue: (t) => t.date, render: (t) => <span className="tabular-nums">{fmtDateTime(t.date)}</span> },
    {
      key: "deadline", header: "Prazo fatal", sortValue: (t) => t.deadline || "",
      render: (t) => <span className={`tabular-nums ${taskState(t) === "atrasada" && t.deadline ? "font-medium text-red-600 dark:text-red-400" : ""}`}>{fmtDateTime(t.deadline)}</span>,
    },
    { key: "resp", header: "Responsável", render: (t) => <AvatarStack users={users.filter((u) => t.responsibleIds.includes(u.id))} /> },
  ];
}

/** Linha compacta de compromisso (Meu Painel). */
export function TaskLine({ task }: { task: Task }) {
  const users = useStore((s) => s.users);
  const parties = useTaskParties();
  const openModal = useUi((s) => s.openModal);
  const patch = useStore((s) => s.patch);
  const due = taskDue(task);
  return (
    <div className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0 hover:bg-card dark:border-white/5 dark:hover:bg-white/5">
      <TaskFlags task={task} />
      <StatusDot task={task} />
      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => { patch("tasks", task.id, { read: true }); openModal({ kind: "taskDetail", taskId: task.id }); }}
      >
        <span className={`block truncate ${task.read ? "" : "font-semibold"}`}>{task.title}</span>
        <span className="muted block truncate text-xs">{parties(task) || "Sem partes vinculadas"}</span>
      </button>
      <span className={`whitespace-nowrap text-xs tabular-nums ${taskState(task) === "atrasada" ? "text-red-600 dark:text-red-400" : "muted"}`}>{relDateTime(due)}</span>
      <AvatarStack users={users.filter((u) => task.responsibleIds.includes(u.id))} size={22} />
    </div>
  );
}
