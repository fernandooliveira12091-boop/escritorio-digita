import { CalendarPlus, CheckCircle2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { googleCalendarLink } from "../../lib/calendar";
import { fmtDateTime } from "../../lib/format";
import { STATE_LABEL, taskState } from "../../lib/rules";
import { useStore } from "../../store/useStore";
import { useUi } from "../../store/ui";
import { Avatar, Modal } from "../ui/basics";
import { STATE_STYLE, useTaskParties } from "../tasks";

export function TaskDetail({ taskId }: { taskId: string }) {
  const { tasks, users, processes, settings, completeTask, remove } = useStore();
  const { closeModal, openModal, showToast } = useUi();
  const parties = useTaskParties();
  const [confirm, setConfirm] = useState(false);
  const t = tasks.find((x) => x.id === taskId);
  if (!t) return null;
  const st = taskState(t);
  const proc = processes.find((p) => p.id === t.processId);
  const rows: [string, ReactNode][] = [
    ["Tipo", settings.taskTypes.find((x) => x.id === t.typeId)?.name ?? "—"],
    ["Partes", parties(t) || "—"],
    ["Processo", proc ? <Link className="link" to={`/processos/${proc.id}`} onClick={closeModal}>{proc.number}</Link> : "—"],
    ["Data do compromisso", fmtDateTime(t.date)],
    ["Prazo fatal", fmtDateTime(t.deadline)],
    ["Pontuação", `${t.points} pontos`],
    ["Concluída em", fmtDateTime(t.completedAt)],
  ];
  const gDetails = [
    settings.taskTypes.find((x) => x.id === t.typeId)?.name,
    parties(t) && `Partes: ${parties(t)}`,
    proc && `Processo: ${proc.number}${proc.court ? ` (${proc.court})` : ""}`,
    t.deadline && `Prazo fatal: ${fmtDateTime(t.deadline)}`,
    t.description,
  ].filter(Boolean).join("\n");
  return (
    <Modal
      title={t.title}
      onClose={closeModal}
      footer={
        <>
          <button className={`btn mr-auto ${confirm ? "border-red-600 bg-red-600 text-white" : "text-red-600"}`} onClick={() => (confirm ? (remove("tasks", t.id), closeModal(), showToast("Tarefa excluída")) : setConfirm(true))}>
            <Trash2 size={16} /> {confirm ? "Confirmar exclusão" : "Excluir"}
          </button>
          <button className="btn" onClick={() => openModal({ kind: "task", task: t })}><Pencil size={16} /> Editar</button>
          {t.status === "concluida" ? (
            <button className="btn" onClick={() => { completeTask(t.id, false); showToast("Tarefa reaberta"); }}><RotateCcw size={16} /> Reabrir</button>
          ) : (
            <button className="btn-primary" onClick={() => { completeTask(t.id); showToast(`Concluída: +${t.points} pontos`); closeModal(); }}><CheckCircle2 size={16} /> Concluir</button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <span className={`chip border ${STATE_STYLE[st].pill}`}>{STATE_LABEL[st]}</span>
        <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
          <dt className="muted">Responsáveis</dt>
          <dd className="flex flex-wrap gap-2">
            {users.filter((u) => t.responsibleIds.includes(u.id)).map((u) => (
              <span key={u.id} className="flex items-center gap-1.5"><Avatar user={u} size={22} /> {u.name}</span>
            ))}
          </dd>
        </dl>
        {t.description && <p className="card whitespace-pre-wrap text-sm">{t.description}</p>}
        <div className="flex flex-wrap gap-2 border-t border-line pt-4 dark:border-white/10">
          <a className="btn" target="_blank" rel="noreferrer" href={googleCalendarLink({ title: `${t.title}${parties(t) ? ` - ${parties(t)}` : ""}`, start: t.date, details: gDetails })}>
            <CalendarPlus size={16} /> Adicionar ao Google Agenda
          </a>
          {t.deadline && (
            <a className="btn" target="_blank" rel="noreferrer" href={googleCalendarLink({ title: `PRAZO FATAL: ${t.title}${parties(t) ? ` - ${parties(t)}` : ""}`, start: t.deadline, allDay: true, details: gDetails })}>
              <CalendarPlus size={16} /> Prazo fatal no Google Agenda
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}
