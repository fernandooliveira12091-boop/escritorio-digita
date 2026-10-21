import { differenceInCalendarDays, endOfMonth, isWithinInterval, startOfMonth, subMonths } from "date-fns";
import type { LegalProcess, Task, Transaction } from "../types";
import { toDate } from "./format";

/** Prazo que vale para o atraso: o prazo fatal, se houver; senão a data do compromisso. */
export const taskDue = (t: Task) => t.deadline || t.date;

/** Atrasada: o prazo já passou e a tarefa não foi concluída. */
export const isOverdue = (t: Task, now = new Date()) => t.status !== "concluida" && toDate(taskDue(t)) < now;

export type TaskState = "pendente" | "concluida" | "atrasada";
export const taskState = (t: Task, now = new Date()): TaskState =>
  t.status === "concluida" ? "concluida" : isOverdue(t, now) ? "atrasada" : "pendente";

export const STATE_LABEL: Record<TaskState, string> = { pendente: "Pendente", concluida: "Concluída", atrasada: "Atrasada" };

/** Concluída em dia: concluída até o prazo. */
export const completedOnTime = (t: Task) => !!t.completedAt && toDate(t.completedAt) <= toDate(taskDue(t));

/** Estagnado: processo ativo sem movimentação há mais de 30 dias. */
export const lastMovementDate = (p: LegalProcess) =>
  p.movements.length ? p.movements.map((m) => m.date).sort().at(-1)! : p.createdAt;
export const daysWithoutMovement = (p: LegalProcess, now = new Date()) => differenceInCalendarDays(now, toDate(lastMovementDate(p)));
export const isStagnant = (p: LegalProcess, now = new Date()) => p.status === "ativo" && daysWithoutMovement(p, now) > 30;

export const monthRange = (offset = 0, base = new Date()) => {
  const d = subMonths(base, offset);
  return { start: startOfMonth(d), end: endOfMonth(d) };
};
export const inMonth = (s: string | undefined, offset = 0, base = new Date()) =>
  !!s && isWithinInterval(toDate(s), monthRange(offset, base));

/** Compara mês atual x mês anterior e devolve a variação percentual. */
export const compare = (current: number, previous: number) => {
  const pct = previous === 0 ? (current === 0 ? 0 : 100) : Math.round(((current - previous) / previous) * 100);
  return { current, previous, pct, up: current >= previous };
};

/** Pontos de tarefas concluídas, por usuário, num mês (offset 0 = atual). */
export const pointsByUser = (tasks: Task[], userId: string, offset = 0) =>
  tasks
    .filter((t) => t.status === "concluida" && t.responsibleIds.includes(userId) && inMonth(t.completedAt, offset))
    .reduce((s, t) => s + t.points, 0);

export const isPaid = (t: Transaction) => !!t.paidDate;
export const isLatePayment = (t: Transaction, now = new Date()) =>
  t.kind !== "transferencia" && !t.paidDate && differenceInCalendarDays(now, toDate(t.dueDate)) > 0;
