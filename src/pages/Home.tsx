import { format } from "date-fns";
import { RefreshCw, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusDot, TaskLine, useTaskColumns, useTaskParties } from "../components/tasks";
import { Avatar, Collapsible, EmptyState, PageHeader, Segmented, Tabs } from "../components/ui/basics";
import { DataTable, DataTableToolbar } from "../components/ui/DataTable";
import { KpiCard } from "../components/ui/KpiCard";
import { dayKey, MiniCalendar } from "../components/ui/MiniCalendar";
import { UserChipSelect } from "../components/ui/UserChipSelect";
import { exportCsv } from "../lib/files";
import { fmtDateTime, normalize, relDateTime } from "../lib/format";
import { compare, inMonth, isOverdue, pointsByUser, STATE_LABEL, taskDue, taskState } from "../lib/rules";
import { useUi } from "../store/ui";
import { useCurrentUser, useStore } from "../store/useStore";
import type { Task } from "../types";

type Tab = "geral" | "lista" | "quadro" | "desempenho" | "config";

function Taskscore() {
  const { users, tasks } = useStore();
  const [mode, setMode] = useState<"mensal" | "diario">("mensal");
  const [trend, setTrend] = useState(false);
  const [tick, setTick] = useState(0);
  const today = format(new Date(), "yyyy-MM-dd");
  const rows = users.filter((u) => u.active).map((u) => {
    const cur = mode === "mensal" ? pointsByUser(tasks, u.id, 0)
      : tasks.filter((t) => t.status === "concluida" && t.responsibleIds.includes(u.id) && t.completedAt?.slice(0, 10) === today).reduce((s, t) => s + t.points, 0);
    const prev = pointsByUser(tasks, u.id, 1);
    const goal = mode === "mensal" ? u.pointsGoal : Math.round(u.pointsGoal / 22);
    return { u, cur, prev, goal };
  });
  const max = Math.max(1, ...rows.flatMap((r) => [r.cur, r.prev, r.goal]));
  return (
    <div className="card space-y-4" key={tick}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h2">Taskscore</h2>
        <div className="flex items-center gap-1">
          <Segmented label="Período" value={mode} onChange={setMode} options={[{ id: "mensal", label: "Mensal" }, { id: "diario", label: "Diário" }]} />
          <button className={`btn-icon ${trend ? "text-primary" : ""}`} onClick={() => setTrend(!trend)} aria-pressed={trend} aria-label="Mostrar tendência"><TrendingUp size={16} /></button>
          <button className="btn-icon" onClick={() => setTick(tick + 1)} aria-label="Atualizar"><RefreshCw size={16} /></button>
        </div>
      </div>
      <div className="space-y-4">
        {rows.map(({ u, cur, prev, goal }) => (
          <div key={u.id} className="grid grid-cols-[minmax(0,140px)_1fr] items-center gap-3">
            <span className="flex min-w-0 items-center gap-2"><Avatar user={u} size={26} /><span className="truncate text-sm">{u.name.split(" ")[0]}</span></span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="relative h-3 flex-1 rounded-full bg-white dark:bg-white/5">
                  <div className="h-3 rounded-full bg-primary" style={{ width: `${(cur / max) * 100}%` }} />
                  <span className="absolute -top-1 h-5 w-0.5 rounded bg-amber-500" style={{ left: `${(goal / max) * 100}%` }} title={`Meta: ${goal} pontos`} />
                </div>
                <span className="w-24 text-right text-xs tabular-nums">{cur} pts{trend && mode === "mensal" ? ` ${cur >= prev ? "↗" : "↘"}` : ""}</span>
              </div>
              {mode === "mensal" && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-white dark:bg-white/5"><div className="h-1.5 rounded-full bg-gray-400" style={{ width: `${(prev / max) * 100}%` }} /></div>
                  <span className="muted w-24 text-right text-xs tabular-nums">{prev} pts</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="muted flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-primary" /> Mês atual</span>
        {mode === "mensal" && <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-gray-400" /> Mês passado</span>}
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-0.5 bg-amber-500" /> Meta</span>
      </div>
    </div>
  );
}

function Board({ tasks }: { tasks: Task[] }) {
  const { completeTask } = useStore();
  const openModal = useUi((s) => s.openModal);
  const parties = useTaskParties();
  const cols = (["pendente", "atrasada", "concluida"] as const).map((st) => ({ st, items: tasks.filter((t) => taskState(t) === st) }));
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cols.map(({ st, items }) => (
        <div key={st} className="card space-y-2">
          <h3 className="flex justify-between text-xs font-semibold uppercase tracking-wider text-ink-muted"><span>{STATE_LABEL[st]}s</span><span>{items.length}</span></h3>
          {items.map((t) => (
            <div key={t.id} className="surface space-y-1 p-3">
              <button className="block text-left text-sm font-medium hover:text-primary" onClick={() => openModal({ kind: "taskDetail", taskId: t.id })}>{t.title}</button>
              <p className="muted truncate text-xs">{parties(t)}</p>
              <div className="flex items-center justify-between text-xs">
                <span className={st === "atrasada" ? "text-red-600" : "muted"}>{relDateTime(taskDue(t))}</span>
                {st !== "concluida" && <button className="link" onClick={() => completeTask(t.id)}>Concluir</button>}
              </div>
            </div>
          ))}
          {!items.length && <p className="muted py-4 text-center text-xs">Nenhuma tarefa.</p>}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { tasks, users, settings, updateSettings, patch } = useStore();
  const me = useCurrentUser();
  const { openModal } = useUi();
  const navigate = useNavigate();
  const columns = useTaskColumns();
  const parties = useTaskParties();
  const [tab, setTab] = useState<Tab>("geral");
  const [kpiFilter, setKpiFilter] = useState<"" | "concluidas" | "pendentes">("");
  const [resp, setResp] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [only, setOnly] = useState<"" | "fav" | "prio" | "late">("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "date", dir: "asc" });

  const mine = useMemo(() => tasks.filter((t) => (resp.length ? t.responsibleIds.some((id) => resp.includes(id)) : true)), [tasks, resp]);
  const doneNow = mine.filter((t) => t.status === "concluida" && inMonth(t.completedAt, 0));
  const donePrev = mine.filter((t) => t.status === "concluida" && inMonth(t.completedAt, 1));
  const pending = mine.filter((t) => t.status !== "concluida");
  const pendingPrev = mine.filter((t) => inMonth(t.date, 1) && (t.status !== "concluida" || !inMonth(t.completedAt, 1)));
  const sumPts = (l: Task[]) => l.reduce((s, t) => s + t.points, 0);
  const goalUsers = resp.length ? users.filter((u) => resp.includes(u.id)) : users.filter((u) => u.active);
  const goal = goalUsers.reduce((s, u) => s + u.pointsGoal, 0);
  const reach = goal ? Math.round((sumPts(doneNow) / goal) * 100) : 0;
  const reachPrev = goal ? Math.round((sumPts(donePrev) / goal) * 100) : 0;

  const listed = mine
    .filter((t) => (kpiFilter === "concluidas" ? t.status === "concluida" && inMonth(t.completedAt) : kpiFilter === "pendentes" ? t.status !== "concluida" : true))
    .filter((t) => (only === "fav" ? t.favorite : only === "prio" ? t.priority : only === "late" ? isOverdue(t) : true))
    .filter((t) => !search || normalize(`${t.title} ${parties(t)}`).includes(normalize(search)));
  const unread = listed.filter((t) => !t.read);
  const read = listed.filter((t) => t.read);
  const eventCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    const k = dayKey(new Date(t.date));
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const kpis = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard title="Tarefas concluídas" value={doneNow.length} delta={{ ...compare(doneNow.length, donePrev.length), previous: donePrev.length }}
        filter={{ active: kpiFilter === "concluidas", onToggle: () => setKpiFilter(kpiFilter === "concluidas" ? "" : "concluidas") }} />
      <KpiCard title="Pontos acumulados" value={sumPts(doneNow)} delta={{ ...compare(sumPts(doneNow), sumPts(donePrev)), previous: `${sumPts(donePrev)} pts` }} />
      <KpiCard title="Tarefas pendentes" value={pending.length} upIsBad delta={{ ...compare(pending.length, pendingPrev.length), previous: pendingPrev.length }}
        filter={{ active: kpiFilter === "pendentes", onToggle: () => setKpiFilter(kpiFilter === "pendentes" ? "" : "pendentes") }}
        link={{ label: "Mostrar tarefas", onClick: () => { setKpiFilter("pendentes"); setTab("lista"); } }} />
      <KpiCard title="Alcance da meta" value={`${reach}%`} delta={{ ...compare(reach, reachPrev), previous: `${reachPrev}%` }}
        subtitle={goal ? `${sumPts(doneNow)} de ${goal} pontos` : "Nenhuma meta definida"} link={{ label: "Configurar meta", onClick: () => setTab("config") }} />
    </div>
  );

  const toolbar = (
    <DataTableToolbar
      primary={{ label: "Nova tarefa", onClick: () => openModal({ kind: "task" }) }}
      search={search}
      onSearch={setSearch}
      sortOptions={[{ key: "date", label: "Data" }, { key: "title", label: "Título" }]}
      sort={sort}
      onSort={setSort}
      onExport={() => exportCsv("tarefas", ["Tarefa", "Partes", "Compromisso", "Prazo fatal", "Situação"], listed.map((t) => [t.title, parties(t), fmtDateTime(t.date), fmtDateTime(t.deadline), STATE_LABEL[taskState(t)]]))}
      quickFilters={[
        { id: "fav", label: "Só favoritas", icon: <span aria-hidden>★</span>, active: only === "fav", onClick: () => setOnly(only === "fav" ? "" : "fav") },
        { id: "prio", label: "Só prioritárias", icon: <span aria-hidden className="font-bold">!</span>, active: only === "prio", onClick: () => setOnly(only === "prio" ? "" : "prio") },
        { id: "late", label: "Só atrasadas", icon: <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-red-500" />, active: only === "late", onClick: () => setOnly(only === "late" ? "" : "late") },
      ]}
    />
  );
  const sortFn = (a: Task, b: Task) => {
    const r = sort.key === "title" ? a.title.localeCompare(b.title) : a.date.localeCompare(b.date);
    return sort.dir === "asc" ? r : -r;
  };

  return (
    <>
      <PageHeader title={`Olá, ${me.name.split(" ")[0]}`} subtitle="Acompanhe suas tarefas, metas e compromissos." actions={<UserChipSelect users={users} value={resp} onChange={setResp} />} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "geral", label: "Visão Geral" }, { id: "lista", label: "Lista" }, { id: "quadro", label: "Quadro" }, { id: "desempenho", label: "Desempenho" }, { id: "config", label: "Configurações" }]} />

      {tab === "geral" && (
        <>
          {kpis}
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_300px]">
            <Taskscore />
            <div className="card space-y-3">
              <h2 className="h2">Atividades concluídas</h2>
              {doneNow.filter((t) => t.responsibleIds.includes(me.id)).length === 0 ? (
                <EmptyState>Você ainda não concluiu nenhuma tarefa este mês</EmptyState>
              ) : (
                <ul className="space-y-2">
                  {doneNow.filter((t) => t.responsibleIds.includes(me.id)).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).slice(0, 7).map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <StatusDot task={t} />
                      <span className="flex-1 truncate">{t.title}</span>
                      <span className="chip bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400">+{t.points}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <MiniCalendar counts={eventCounts} footer={<button className="link" onClick={() => navigate("/agenda")}>Mostrar agenda completa ›</button>} />
          </div>
          <Collapsible title="Compromissos">
            {toolbar}
            <div className="surface overflow-hidden">
              <p className="border-b border-line bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-muted dark:border-white/10 dark:bg-white/5">Não lidas ({unread.length})</p>
              {unread.sort(sortFn).map((t) => <TaskLine key={t.id} task={t} />)}
              {!unread.length && <p className="muted px-3 py-4 text-sm">Nenhum compromisso não lido.</p>}
              <p className="border-y border-line bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-muted dark:border-white/10 dark:bg-white/5">Lidas ({read.length})</p>
              {read.sort(sortFn).slice(0, 15).map((t) => <TaskLine key={t.id} task={t} />)}
              {!read.length && <p className="muted px-3 py-4 text-sm">Não encontramos nenhum registro.</p>}
            </div>
          </Collapsible>
        </>
      )}

      {tab === "lista" && (
        <>
          {toolbar}
          <DataTable columns={columns} rows={[...listed].sort(sortFn)} getId={(t) => t.id} selectable sort={sort} onSortChange={setSort}
            onRowClick={(t) => { patch("tasks", t.id, { read: true }); openModal({ kind: "taskDetail", taskId: t.id }); }} />
        </>
      )}

      {tab === "quadro" && <Board tasks={listed} />}

      {tab === "desempenho" && (
        <>
          {kpis}
          <Taskscore />
        </>
      )}

      {tab === "config" && (
        <div className="card max-w-2xl space-y-4">
          <h2 className="h2">Metas de pontos</h2>
          <p className="muted text-sm">Pontos que cada pessoa deve somar no mês com tarefas concluídas. O alcance da meta compara a soma da equipe com essas metas.</p>
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-3">
              <Avatar user={u} size={28} />
              <span className="flex-1 text-sm">{u.name} <span className="muted">· {u.role}</span></span>
              <input type="number" min={0} className="input w-28" value={u.pointsGoal} onChange={(e) => patch("users", u.id, { pointsGoal: +e.target.value })} aria-label={`Meta de ${u.name}`} />
            </label>
          ))}
          <label className="flex items-center gap-3 border-t border-line pt-4 dark:border-white/10">
            <span className="flex-1 text-sm">Meta de fechamentos do escritório por mês</span>
            <input type="number" min={0} className="input w-28" value={settings.closingGoal} onChange={(e) => updateSettings({ closingGoal: +e.target.value })} />
          </label>
        </div>
      )}
    </>
  );
}
