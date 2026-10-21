import { differenceInHours } from "date-fns";
import { useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Avatar, PageHeader } from "../components/ui/basics";
import { DataTable, DataTableToolbar, type Column } from "../components/ui/DataTable";
import { useChartTheme } from "../components/ui/chart";
import { exportCsv } from "../lib/files";
import { fmtDate, fmtDateTime, normalize, toDate } from "../lib/format";
import { completedOnTime, inMonth, isOverdue, taskDue } from "../lib/rules";
import { useStore } from "../store/useStore";

type Report = "produtividade" | "atrasadas" | "acessos" | "clientes" | "processos" | "ganhos" | "perdidos";
const REPORTS: Record<Report, string> = {
  produtividade: "Produtividade", atrasadas: "Tarefas atrasadas", acessos: "Registros de acesso", clientes: "Novos clientes",
  processos: "Novos processos", ganhos: "Processos ganhos", perdidos: "Processos perdidos",
};
interface Row { id: string; resp: string; client: string; task: string; points: number | string; date: string; done: string }

export default function Relatorios() {
  const { tasks, users, contacts, processes, accessLogs, settings } = useStore();
  const chart = useChartTheme();
  const [side, setSide] = useState<"agilidade" | "produtividade">("agilidade");
  const [report, setReport] = useState<Report>("produtividade");
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");

  const month = tasks.filter((t) => inMonth(t.date) || inMonth(t.completedAt));
  const onTime = month.filter((t) => t.status === "concluida" && completedOnTime(t)).length;
  const lateDone = month.filter((t) => t.status === "concluida" && !completedOnTime(t)).length;
  const pending = month.filter((t) => t.status !== "concluida").length;
  const donut = side === "agilidade"
    ? [{ name: "Concluídas em dia", value: onTime, color: "#9B51E0" }, { name: "Concluídas em atraso", value: lateDone, color: "#F2994A" }, { name: "Pendentes", value: pending, color: "#D1D5DB" }]
    : users.map((u, i) => ({ name: u.name.split(" ")[0], value: month.filter((t) => t.status === "concluida" && t.responsibleIds.includes(u.id)).length, color: ["#9B51E0", "#BB6BD9", "#2F80ED"][i % 3] }));
  const overdue = tasks.filter((t) => isOverdue(t)).sort((a, b) => taskDue(a).localeCompare(taskDue(b)));
  const lateByUser = users.map((u) => ({ u, n: overdue.filter((t) => t.responsibleIds.includes(u.id)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const done = tasks.filter((t) => t.status === "concluida" && t.completedAt);
  const avgDiff = done.length ? done.reduce((s, t) => s + differenceInHours(toDate(taskDue(t)), toDate(t.completedAt!)), 0) / done.length / 24 : 0;
  const lateOnes = done.filter((t) => !completedOnTime(t));
  const avgLate = lateOnes.length ? lateOnes.reduce((s, t) => s + differenceInHours(toDate(t.completedAt!), toDate(taskDue(t))), 0) / lateOnes.length / 24 : 0;

  const uname = (ids: string[]) => users.filter((u) => ids.includes(u.id)).map((u) => u.name).join(", ");
  const cname = (id?: string) => contacts.find((c) => c.id === id)?.name ?? "—";
  const byUser = (ids: string[]) => !userId || ids.includes(userId);
  const rows: Row[] = (() => {
    switch (report) {
      case "produtividade":
        return done.filter((t) => inMonth(t.completedAt) && byUser(t.responsibleIds)).map((t) => ({ id: t.id, resp: uname(t.responsibleIds), client: cname(t.contactId), task: t.title, points: t.points, date: fmtDateTime(t.date), done: fmtDateTime(t.completedAt) }));
      case "atrasadas":
        return overdue.filter((t) => byUser(t.responsibleIds)).map((t) => ({ id: t.id, resp: uname(t.responsibleIds), client: cname(t.contactId), task: t.title, points: t.points, date: fmtDateTime(taskDue(t)), done: "—" }));
      case "acessos":
        return accessLogs.filter((l) => byUser([l.userId])).map((l) => ({ id: l.id, resp: uname([l.userId]), client: "—", task: l.action, points: "—", date: fmtDateTime(l.at), done: "—" }));
      case "clientes":
        return contacts.filter((c) => inMonth(c.createdAt)).map((c) => ({ id: c.id, resp: "—", client: c.name, task: `Origem: ${c.origin}`, points: "—", date: fmtDate(c.createdAt), done: "—" }));
      case "processos":
        return processes.filter((p) => inMonth(p.createdAt) && byUser([p.responsibleId])).map((p) => ({ id: p.id, resp: uname([p.responsibleId]), client: cname(p.contactIds[0]), task: settings.actionTypes.find((a) => a.id === p.actionTypeId)?.name ?? "", points: "—", date: fmtDate(p.createdAt), done: "—" }));
      case "ganhos":
      case "perdidos":
        return processes.filter((p) => p.outcome === (report === "ganhos" ? "ganho" : "perdido") && byUser([p.responsibleId]))
          .map((p) => ({ id: p.id, resp: uname([p.responsibleId]), client: cname(p.contactIds[0]), task: p.number, points: "—", date: fmtDate(p.createdAt), done: fmtDate(p.archivedAt ?? p.closedAt) }));
    }
  })().filter((r) => !search || normalize(`${r.resp} ${r.client} ${r.task}`).includes(normalize(search)));
  const totalPts = rows.reduce((s, r) => s + (typeof r.points === "number" ? r.points : 0), 0);

  const columns: Column<Row>[] = [
    { key: "resp", header: "Responsável", sortValue: (r) => r.resp, render: (r) => r.resp },
    { key: "client", header: "Nome do cliente", sortValue: (r) => r.client, render: (r) => r.client },
    { key: "task", header: report === "acessos" ? "Ação" : report === "processos" || report === "clientes" ? "Detalhe" : "Tarefa", sortValue: (r) => r.task, render: (r) => r.task },
    { key: "points", header: "Pontuação", sortValue: (r) => (typeof r.points === "number" ? r.points : 0), render: (r) => <span className="tabular-nums">{r.points}</span> },
    { key: "date", header: report === "acessos" ? "Data" : "Data compromisso", render: (r) => <span className="tabular-nums">{r.date}</span> },
    { key: "done", header: "Conclusão", render: (r) => <span className="tabular-nums">{r.done}</span> },
  ];

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Indicadores do mês atual." />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card flex gap-4">
          <div role="tablist" aria-orientation="vertical" className="flex flex-col gap-1">
            {(["agilidade", "produtividade"] as const).map((s) => (
              <button key={s} role="tab" aria-selected={side === s} onClick={() => setSide(s)} className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${side === s ? "bg-white text-primary shadow-sm dark:bg-white/10" : "muted hover:text-ink"}`}>
                {s === "agilidade" ? "Agilidade" : "Produtividade"}
              </button>
            ))}
          </div>
          <div className="h-56 min-w-0 flex-1">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="none">
                  {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={chart.tooltip} />
                <Legend wrapperStyle={{ fontSize: 12, color: chart.text }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl bg-primary p-4 text-white">
          <h2 className="h2 mb-3">Tarefas com mais atrasos</h2>
          {overdue.length === 0 ? <p className="py-8 text-center text-white/90">Não há tarefas atrasadas :)</p> : (
            <ul className="space-y-2 text-sm">
              {overdue.slice(0, 6).map((t) => (
                <li key={t.id} className="flex justify-between gap-2 border-b border-white/20 pb-2 last:border-0">
                  <span className="truncate">{t.title}</span>
                  <span className="shrink-0 tabular-nums text-white/80">{Math.max(1, Math.round(differenceInHours(new Date(), toDate(taskDue(t))) / 24))} dia(s)</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card space-y-4">
          <div>
            <h2 className="h2 mb-2">Colaboradores com mais tarefas atrasadas</h2>
            {lateByUser.length === 0 ? <p className="muted text-sm">Ninguém com tarefas atrasadas.</p> : (
              <ul className="space-y-2">{lateByUser.map(({ u, n }) => <li key={u.id} className="flex items-center gap-2 text-sm"><Avatar user={u} size={24} /><span className="flex-1">{u.name}</span><span className="chip bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400">{n}</span></li>)}</ul>
            )}
          </div>
          <div className="border-t border-line pt-3 dark:border-white/10">
            <h3 className="text-sm font-semibold">Agilidade geral</h3>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="muted text-xs">Média de cumprimento</dt><dd className="text-lg font-semibold tabular-nums">{avgDiff >= 0 ? `${avgDiff.toFixed(1)} dias antes` : `${Math.abs(avgDiff).toFixed(1)} dias depois`}</dd></div>
              <div><dt className="muted text-xs">Média de atraso</dt><dd className="text-lg font-semibold tabular-nums">{avgLate.toFixed(1)} dias</dd></div>
            </dl>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Gestão</h2>
        <div className="flex flex-wrap gap-2">
          <label><span className="sr-only">Relatório</span><select className="input w-auto font-medium" value={report} onChange={(e) => setReport(e.target.value as Report)}>{Object.entries(REPORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label><span className="sr-only">Usuário</span><select className="input w-auto" value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Todos os usuários</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        </div>
        {report === "acessos" && !settings.accessLogEnabled && <p className="text-sm text-amber-700 dark:text-amber-400">O registro de acessos está desligado. Ative em Configurações › Usuários.</p>}
        <DataTableToolbar search={search} onSearch={setSearch} onExport={() => exportCsv(`relatorio-${report}`, ["Responsável", "Cliente", "Tarefa", "Pontuação", "Data", "Conclusão"], rows.map((r) => [r.resp, r.client, r.task, r.points, r.date, r.done]))} />
        <DataTable columns={columns} rows={rows} getId={(r) => r.id}
          footer={<div className="border-t border-line bg-card px-4 py-2.5 text-right text-sm font-semibold dark:border-white/10 dark:bg-white/5">Total {totalPts} pontos</div>} />
      </section>
    </>
  );
}
