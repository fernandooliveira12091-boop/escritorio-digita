import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Collapsible, Field, Modal } from "../components/ui/basics";
import { DataTable, DataTableToolbar, type Column } from "../components/ui/DataTable";
import { KpiCard } from "../components/ui/KpiCard";
import { useChartTheme } from "../components/ui/chart";
import { exportCsv } from "../lib/files";
import { fmtDate, normalize, uid } from "../lib/format";
import { isOverdue } from "../lib/rules";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { LegalProcess, Partner } from "../types";

export default function Parceiros() {
  const { partners, processes, contacts, tasks, users, settings, upsert } = useStore();
  const { showToast } = useUi();
  const navigate = useNavigate();
  const chart = useChartTheme();
  const [partnerId, setPartnerId] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Partner | null>(null);

  const shared = processes.filter((p) => p.partnerId && (!partnerId || p.partnerId === partnerId));
  const activeShared = shared.filter((p) => p.status === "ativo");
  // Demanda pendente: tarefas abertas dos processos compartilhados. Do escritório, quando há responsável da equipe; do parceiro, quando não há.
  const openTasks = tasks.filter((t) => t.status !== "concluida" && shared.some((p) => p.id === t.processId));
  const officeIds = new Set(users.map((u) => u.id));
  const pendingOffice = openTasks.filter((t) => t.responsibleIds.some((id) => officeIds.has(id)));
  const pendingPartner = openTasks.filter((t) => isOverdue(t));
  const byPhase = settings.funnels.map((f) => ({ name: f.name, value: shared.filter((p) => p.funnelId === f.id).length })).filter((d) => d.value > 0);
  const name = (p: LegalProcess) => contacts.find((c) => c.id === p.contactIds[0])?.name ?? "—";
  const rows = shared.filter((p) => !search || normalize(`${name(p)} ${p.number} ${partners.find((x) => x.id === p.partnerId)?.name}`).includes(normalize(search)));

  const columns: Column<LegalProcess>[] = [
    { key: "parties", header: "Partes", sortValue: name, render: (p) => <span><b className="font-medium">{name(p)}</b><span className="muted block text-xs">x {p.opposingParty}</span></span> },
    { key: "type", header: "Tipo de ação", render: (p) => settings.actionTypes.find((t) => t.id === p.actionTypeId)?.name },
    { key: "number", header: "Número do processo", render: (p) => <span className="whitespace-nowrap tabular-nums">{p.number}</span> },
    { key: "partner", header: "Parceiro", sortValue: (p) => partners.find((x) => x.id === p.partnerId)?.name ?? "", render: (p) => partners.find((x) => x.id === p.partnerId)?.name },
    { key: "date", header: "Data", sortValue: (p) => p.createdAt, render: (p) => <span className="tabular-nums">{fmtDate(p.createdAt)}</span> },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="sr-only">Parceiros</h1>
        <label className="flex items-center gap-2">
          <span className="sr-only">Escolher parceiro</span>
          <select className="input w-auto border-0 bg-transparent p-0 text-sm font-semibold uppercase tracking-wider focus:ring-0 dark:bg-transparent" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">Você e todos os seus parceiros</option>
            {partners.map((p) => <option key={p.id} value={p.id}>Você e {p.name}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard title="Processos compartilhados (ativos)" value={activeShared.length} />
        <KpiCard title="Demanda pendente pelo escritório" value={pendingOffice.length} subtitle="tarefas abertas da sua equipe" />
        <KpiCard title="Demanda pendente pelo parceiro" value={pendingPartner.length} tone={pendingPartner.length ? "danger" : "default"} subtitle="tarefas atrasadas aguardando retorno" />
      </div>
      <div className="card">
        <h2 className="h2 mb-2">Processos compartilhados por fase</h2>
        <div className="h-52">
          <ResponsiveContainer>
            <BarChart data={byPhase} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={chart.grid} />
              <XAxis dataKey="name" tick={{ fill: chart.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: chart.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: chart.cursor }} contentStyle={chart.tooltip} formatter={(v: number) => [v, "Processos"]} />
              <Bar dataKey="value" fill="#9B51E0" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <Collapsible title="Rede">
        <DataTableToolbar
          primary={{ label: "Novo parceiro", onClick: () => setForm({ id: uid("p"), name: "", oab: "", email: "", phone: "" }) }}
          search={search}
          onSearch={setSearch}
          onExport={() => exportCsv("parceiros", ["Cliente", "Número", "Parceiro", "Data"], rows.map((p) => [name(p), p.number, partners.find((x) => x.id === p.partnerId)?.name ?? "", fmtDate(p.createdAt)]))}
        />
        <div className="flex flex-wrap gap-2">
          {partners.map((p) => (
            <button key={p.id} className="chip border border-line bg-white px-3 py-1 dark:border-white/10 dark:bg-[#171A21]" onClick={() => setForm(p)}>{p.name} · {p.oab}</button>
          ))}
        </div>
        <DataTable columns={columns} rows={rows} getId={(p) => p.id} onRowClick={(p) => navigate(`/processos/${p.id}`)} />
      </Collapsible>

      {form && (
        <Modal title={partners.some((p) => p.id === form.id) ? "Editar parceiro" : "Novo parceiro"} onClose={() => setForm(null)} footer={
          <><button className="btn" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-primary" onClick={() => { if (!form.name.trim()) return showToast("Informe o nome"); upsert("partners", form); setForm(null); showToast("Parceiro salvo"); }}>Salvar</button></>
        }>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome ou escritório" className="sm:col-span-2">{(id) => <input id={id} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label="OAB">{(id) => <input id={id} className="input" value={form.oab} onChange={(e) => setForm({ ...form, oab: e.target.value })} />}</Field>
            <Field label="Telefone">{(id) => <input id={id} className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}</Field>
            <Field label="E-mail" className="sm:col-span-2">{(id) => <input id={id} type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
          </div>
        </Modal>
      )}
    </>
  );
}
