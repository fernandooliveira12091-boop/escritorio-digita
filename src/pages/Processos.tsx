import { differenceInCalendarDays, isToday } from "date-fns";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, Field, PageHeader } from "../components/ui/basics";
import { DataTable, DataTableToolbar, type Column } from "../components/ui/DataTable";
import { KpiCard } from "../components/ui/KpiCard";
import { useChartTheme } from "../components/ui/chart";
import { exportCsv } from "../lib/files";
import { fmtDate, normalize, toDate } from "../lib/format";
import { compare, inMonth, lastMovementDate } from "../lib/rules";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { LegalProcess } from "../types";

const VIEWS = {
  todos: "Todos os processos",
  ativos: "Processos ativos",
  mov30: "Movimentados nos últimos 30 dias",
  mov7: "Movimentados nos últimos 7 dias",
  movHoje: "Movimentados hoje",
  nunca: "Nunca capturados",
  sem30: "Não movimentados há +30 dias",
  sem45: "Não movimentados há +45 dias",
  sem90: "Não movimentados há +90 dias",
  fechMes: "Fechamentos no mês",
  ajuizMes: "Ajuizados no mês",
  arqMes: "Arquivados no mês",
} as const;
type ViewKey = keyof typeof VIEWS;

export default function Processos() {
  const { processes, contacts, settings, users } = useStore();
  const openModal = useUi((s) => s.openModal);
  const navigate = useNavigate();
  const chart = useChartTheme();
  const [view, setView] = useState<ViewKey>("todos");
  const [search, setSearch] = useState("");
  const [kpi, setKpi] = useState<"" | "ativos" | "fech" | "arq">("");
  const [respId, setRespId] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "createdAt", dir: "desc" });

  const name = (p: LegalProcess) => contacts.find((c) => c.id === p.contactIds[0])?.name ?? "—";
  const typeName = (p: LegalProcess) => settings.actionTypes.find((t) => t.id === p.actionTypeId)?.name ?? "—";
  const lastMov = (p: LegalProcess) => [...p.movements].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const daysSince = (p: LegalProcess) => differenceInCalendarDays(new Date(), toDate(lastMovementDate(p)));

  const byView = (p: LegalProcess) => {
    switch (view) {
      case "ativos": return p.status === "ativo";
      case "mov30": return daysSince(p) <= 30;
      case "mov7": return daysSince(p) <= 7;
      case "movHoje": return !!lastMov(p) && isToday(toDate(lastMov(p)!.date));
      case "nunca": return !p.capturedAt;
      case "sem30": return daysSince(p) > 30;
      case "sem45": return daysSince(p) > 45;
      case "sem90": return daysSince(p) > 90;
      case "fechMes": return inMonth(p.closedAt);
      case "ajuizMes": return inMonth(p.filedAt);
      case "arqMes": return inMonth(p.archivedAt);
      default: return true;
    }
  };
  const rows = processes
    .filter(byView)
    .filter((p) => (kpi === "ativos" ? p.status === "ativo" : kpi === "fech" ? inMonth(p.closedAt) : kpi === "arq" ? inMonth(p.archivedAt) : true))
    .filter((p) => !respId || p.responsibleId === respId)
    .filter((p) => !search || normalize(`${name(p)} ${p.opposingParty} ${p.number} ${typeName(p)}`).includes(normalize(search)));

  const active = processes.filter((p) => p.status === "ativo").length;
  const activePrev = processes.filter((p) => p.status === "ativo" && !inMonth(p.createdAt)).length;
  const closings = processes.filter((p) => inMonth(p.closedAt)).length;
  const closingsPrev = processes.filter((p) => inMonth(p.closedAt, 1)).length;
  const archived = processes.filter((p) => inMonth(p.archivedAt)).length;
  const archivedPrev = processes.filter((p) => inMonth(p.archivedAt, 1)).length;
  const phases = settings.funnels.filter((f) => !["Financeiro", "Arquivamento"].includes(f.name));
  const volume = phases.map((f) => ({ name: f.name, value: processes.filter((p) => p.funnelId === f.id && p.status !== "arquivado").length }));

  const columns: Column<LegalProcess>[] = [
    { key: "parties", header: "Partes", sortValue: name, render: (p) => <span><b className="font-medium">{p.needsReview && !p.contactIds.length ? "Cliente não vinculado" : name(p)}</b>{p.needsReview && <span className="chip ml-2 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">A revisar</span>}<span className="muted block text-xs">x {p.opposingParty || "—"}</span></span> },
    { key: "type", header: "Tipo de ação", sortValue: typeName, render: typeName },
    { key: "number", header: "Número do processo", sortValue: (p) => p.number, render: (p) => <span className="whitespace-nowrap tabular-nums">{p.number || "—"}</span> },
    { key: "createdAt", header: "Data cadastro", sortValue: (p) => p.createdAt, render: (p) => <span className="tabular-nums">{fmtDate(p.createdAt)}</span> },
    { key: "last", header: "Último andamento", render: (p) => <span className="muted">{lastMov(p)?.text ?? "—"}</span> },
    { key: "lastDate", header: "Data andamento", sortValue: (p) => lastMovementDate(p), render: (p) => <span className="tabular-nums">{fmtDate(lastMov(p)?.date)}</span> },
  ];

  return (
    <>
      <PageHeader title="Processos" subtitle="Todos os processos e casos do escritório." />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard title="Processos ativos" value={active} delta={{ ...compare(active, activePrev), previous: activePrev }} filter={{ active: kpi === "ativos", onToggle: () => setKpi(kpi === "ativos" ? "" : "ativos") }} />
        <KpiCard title="Fechamentos" value={closings} delta={{ ...compare(closings, closingsPrev), previous: closingsPrev }} filter={{ active: kpi === "fech", onToggle: () => setKpi(kpi === "fech" ? "" : "fech") }} />
        <KpiCard title="Arquivados este mês" value={archived} upIsBad delta={{ ...compare(archived, archivedPrev), previous: archivedPrev }} filter={{ active: kpi === "arq", onToggle: () => setKpi(kpi === "arq" ? "" : "arq") }} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card">
          <h2 className="h2 mb-2">Volume por fase</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={volume} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={chart.grid} />
                <XAxis dataKey="name" tick={{ fill: chart.text, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={{ fill: chart.text, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: chart.cursor }} contentStyle={chart.tooltip} formatter={(v: number) => [v, "Processos"]} />
                <Bar dataKey="value" fill="#2F80ED" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2 className="h2">Meta de fechamentos</h2>
          {settings.closingGoal > 0 ? (
            <div className="mt-6 space-y-3">
              <p className="text-4xl font-semibold tabular-nums">{closings}<span className="muted text-lg"> / {settings.closingGoal}</span></p>
              <div className="h-2.5 rounded-full bg-white dark:bg-white/10"><div className="h-2.5 rounded-full bg-green-500" style={{ width: `${Math.min(100, (closings / settings.closingGoal) * 100)}%` }} /></div>
              <p className="muted text-sm">{Math.round((closings / settings.closingGoal) * 100)}% da meta do mês</p>
            </div>
          ) : (
            <EmptyState action={<button className="btn-primary" onClick={() => navigate("/configuracoes?secao=metas")}>Configurar meta</button>}>
              Nenhuma meta de fechamentos definida.
            </EmptyState>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="sr-only">Visão</span>
          <select className="input w-auto font-medium" value={view} onChange={(e) => setView(e.target.value as ViewKey)}>
            {Object.entries(VIEWS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="flex-1">
          <DataTableToolbar
            primary={{ label: "Novo processo", onClick: () => openModal({ kind: "process" }) }}
            search={search}
            onSearch={setSearch}
            filterCount={respId ? 1 : 0}
            onClearFilters={() => setRespId("")}
            filterContent={<Field label="Responsável">{(id) => <select id={id} className="input" value={respId} onChange={(e) => setRespId(e.target.value)}><option value="">Todos</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}</Field>}
            sortOptions={[{ key: "createdAt", label: "Data cadastro" }, { key: "lastDate", label: "Data andamento" }, { key: "parties", label: "Partes" }]}
            sort={sort}
            onSort={setSort}
            onExport={() => exportCsv("processos", ["Cliente", "Parte contrária", "Tipo de ação", "Número", "Cadastro", "Último andamento", "Data andamento"],
              rows.map((p) => [name(p), p.opposingParty, typeName(p), p.number, fmtDate(p.createdAt), lastMov(p)?.text ?? "", fmtDate(lastMov(p)?.date)]))}
          />
        </div>
      </div>
      <DataTable columns={columns} rows={rows} getId={(p) => p.id} selectable sort={sort} onSortChange={setSort} onRowClick={(p) => navigate(`/processos/${p.id}`)} />
    </>
  );
}
