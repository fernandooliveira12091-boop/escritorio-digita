import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTaskColumns, useTaskParties } from "../components/tasks";
import { Field, PageHeader } from "../components/ui/basics";
import { DataTable, DataTableToolbar } from "../components/ui/DataTable";
import { dayKey, MiniCalendar } from "../components/ui/MiniCalendar";
import { UserChipSelect } from "../components/ui/UserChipSelect";
import { useChartTheme } from "../components/ui/chart";
import { exportCsv } from "../lib/files";
import { fmtDateTime, normalize } from "../lib/format";
import { inMonth, isOverdue, STATE_LABEL, taskState } from "../lib/rules";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";

export default function Atividades() {
  const { tasks, users, settings, patch } = useStore();
  const openModal = useUi((s) => s.openModal);
  const columns = useTaskColumns();
  const parties = useTaskParties();
  const chart = useChartTheme();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "date", dir: "asc" });
  const [filters, setFilters] = useState({ status: "", typeId: "", resp: [] as string[] });
  const [only, setOnly] = useState<"" | "fav" | "prio" | "late">("");
  const [day, setDay] = useState<string>("");

  const pend = tasks.filter((t) => t.status !== "concluida" && !isOverdue(t)).length;
  const late = tasks.filter((t) => isOverdue(t)).length;
  const solved = tasks.filter((t) => t.status === "concluida" && inMonth(t.completedAt)).length;
  const data = [
    { name: "Pendentes", value: pend, color: "#2F80ED" },
    { name: "Atrasadas", value: late, color: "#EB5757" },
    { name: "Resolvidas no mês", value: solved, color: "#27AE60" },
  ];

  const rows = useMemo(
    () => tasks
      .filter((t) => !filters.status || taskState(t) === filters.status)
      .filter((t) => !filters.typeId || t.typeId === filters.typeId)
      .filter((t) => !filters.resp.length || t.responsibleIds.some((id) => filters.resp.includes(id)))
      .filter((t) => (only === "fav" ? t.favorite : only === "prio" ? t.priority : only === "late" ? isOverdue(t) : true))
      .filter((t) => !day || dayKey(new Date(t.date)) === day)
      .filter((t) => !search || normalize(`${t.title} ${parties(t)}`).includes(normalize(search))),
    [tasks, filters, only, day, search, parties],
  );
  const counts = tasks.reduce<Record<string, number>>((a, t) => ((a[dayKey(new Date(t.date))] = (a[dayKey(new Date(t.date))] || 0) + 1), a), {});
  const filterCount = (filters.status ? 1 : 0) + (filters.typeId ? 1 : 0) + (filters.resp.length ? 1 : 0);

  return (
    <>
      <PageHeader title="Atividades" subtitle="Tarefas, prazos e compromissos do escritório." />
      <div className="grid gap-4 lg:grid-cols-[1fr_220px_300px]">
        <div className="card">
          <h2 className="h2 mb-2">Atividade</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={chart.grid} />
                <XAxis dataKey="name" tick={{ fill: chart.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: chart.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: chart.cursor }} contentStyle={chart.tooltip} formatter={(v: number) => [v, "Tarefas"]} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {data.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card flex flex-col justify-center">
          <h2 className="h2">Produtividade</h2>
          <span className="mt-4 text-5xl font-semibold tabular-nums">{pend + late}</span>
          <span className="muted text-sm">tarefas pendentes</span>
          {late > 0 && <span className="mt-2 text-sm text-red-600 dark:text-red-400">{late} atrasada(s)</span>}
        </div>
        <MiniCalendar counts={counts} onSelect={(d) => setDay(dayKey(d) === day ? "" : dayKey(d))} footer={day ? <button className="link" onClick={() => setDay("")}>Ver todos os dias</button> : undefined} />
      </div>

      <DataTableToolbar
        primary={{ label: "Nova tarefa", onClick: () => openModal({ kind: "task" }) }}
        search={search}
        onSearch={setSearch}
        filterCount={filterCount}
        onClearFilters={() => setFilters({ status: "", typeId: "", resp: [] })}
        filterContent={
          <>
            <Field label="Situação">
              {(id) => (
                <select id={id} className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  <option value="">Todas</option>
                  {Object.entries(STATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              )}
            </Field>
            <Field label="Tipo de tarefa">
              {(id) => (
                <select id={id} className="input" value={filters.typeId} onChange={(e) => setFilters({ ...filters, typeId: e.target.value })}>
                  <option value="">Todos</option>
                  {settings.taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </Field>
            <div>
              <span className="label">Responsáveis</span>
              <UserChipSelect users={users} value={filters.resp} onChange={(resp) => setFilters({ ...filters, resp })} />
            </div>
          </>
        }
        sortOptions={[{ key: "date", label: "Data compromisso" }, { key: "deadline", label: "Prazo fatal" }, { key: "title", label: "Tarefa" }]}
        sort={sort}
        onSort={setSort}
        onExport={() => exportCsv("atividades", ["Tarefa", "Partes", "Data compromisso", "Prazo fatal", "Responsável", "Situação", "Pontos"],
          rows.map((t) => [t.title, parties(t), fmtDateTime(t.date), fmtDateTime(t.deadline), users.filter((u) => t.responsibleIds.includes(u.id)).map((u) => u.name).join(", "), STATE_LABEL[taskState(t)], t.points]))}
        quickFilters={[
          { id: "fav", label: "Só favoritas", icon: <span aria-hidden>★</span>, active: only === "fav", onClick: () => setOnly(only === "fav" ? "" : "fav") },
          { id: "prio", label: "Só prioritárias", icon: <span aria-hidden className="font-bold">!</span>, active: only === "prio", onClick: () => setOnly(only === "prio" ? "" : "prio") },
          { id: "late", label: "Só atrasadas", icon: <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-red-500" />, active: only === "late", onClick: () => setOnly(only === "late" ? "" : "late") },
        ]}
      />
      <DataTable columns={columns} rows={rows} getId={(t) => t.id} selectable sort={sort} onSortChange={setSort}
        onRowClick={(t) => { patch("tasks", t.id, { read: true }); openModal({ kind: "taskDetail", taskId: t.id }); }} />
    </>
  );
}
