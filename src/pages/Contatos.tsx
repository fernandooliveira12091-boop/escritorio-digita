import { differenceInYears, format } from "date-fns";
import { Cake, ChevronDown, ChevronRight, MessageCircle } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Field, PageHeader } from "../components/ui/basics";
import { DataTableToolbar, PAGE_SIZES } from "../components/ui/DataTable";
import { KpiCard } from "../components/ui/KpiCard";
import { PALETTE, useChartTheme } from "../components/ui/chart";
import { exportCsv } from "../lib/files";
import { fmtDate, normalize, waLink } from "../lib/format";
import { compare, inMonth } from "../lib/rules";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { Contact } from "../types";

function MiniBars({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const chart = useChartTheme();
  return (
    <div className="card">
      <h2 className="h2 mb-2">{title}</h2>
      <div className="h-48">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke={chart.grid} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: chart.text, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: chart.text, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: chart.cursor }} contentStyle={chart.tooltip} formatter={(v: number) => [v, "Contatos"]} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
              {data.map((d, i) => <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const top = (values: string[], n = 5) =>
  Object.entries(values.reduce<Record<string, number>>((a, v) => ((a[v] = (a[v] || 0) + 1), a), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, value]) => ({ name, value }));

export default function Contatos() {
  const { contacts, processes, settings } = useStore();
  const openModal = useUi((s) => s.openModal);
  const [search, setSearch] = useState("");
  const [kpi, setKpi] = useState<"" | "com" | "sem">("");
  const [birthdays, setBirthdays] = useState(false);
  const [origin, setOrigin] = useState("");
  const [city, setCity] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [pageSize, setPageSize] = useState(50);

  const active = useMemo(() => new Set(processes.filter((p) => p.status === "ativo").flatMap((p) => p.contactIds)), [processes]);
  const now = new Date();
  const ages = contacts.filter((c) => c.birthDate).map((c) => differenceInYears(now, new Date(c.birthDate)));
  const bands = [["18-29", 18, 29], ["30-39", 30, 39], ["40-49", 40, 49], ["50-59", 50, 59], ["60+", 60, 200]] as const;
  const ageData = bands.map(([name, a, b]) => ({ name, value: ages.filter((x) => x >= a && x <= b).length }));
  const isBirthdayMonth = (c: Contact) => !!c.birthDate && c.birthDate.slice(5, 7) === format(now, "MM");

  const rows = contacts
    .filter((c) => (kpi === "com" ? active.has(c.id) : kpi === "sem" ? !active.has(c.id) : true))
    .filter((c) => !birthdays || isBirthdayMonth(c))
    .filter((c) => !origin || c.origin === origin)
    .filter((c) => !city || c.city === city)
    .filter((c) => !search || normalize(`${c.name} ${c.document} ${c.phone} ${c.email} ${c.city}`).includes(normalize(search)))
    .sort((a, b) => {
      const r = sort.key === "createdAt" ? a.createdAt.localeCompare(b.createdAt) : sort.key === "city" ? a.city.localeCompare(b.city) : a.name.localeCompare(b.name, "pt-BR");
      return sort.dir === "asc" ? r : -r;
    });
  const newNow = contacts.filter((c) => inMonth(c.createdAt)).length;
  const newPrev = contacts.filter((c) => inMonth(c.createdAt, 1)).length;
  const toggleSort = (key: string) => setSort(sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  const th = (key: string, label: string) => (
    <th className="th" aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button className="uppercase hover:text-ink dark:hover:text-white" onClick={() => toggleSort(key)}>{label} {sort.key === key ? (sort.dir === "asc" ? "↑" : "↓") : ""}</button>
    </th>
  );

  return (
    <>
      <PageHeader title="Contatos" subtitle="Clientes e pessoas relacionadas aos processos." />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard title="Contatos cadastrados" value={contacts.length} delta={{ ...compare(newNow, newPrev), previous: `${newPrev} novos` }} subtitle={`${newNow} novos este mês`} />
        <KpiCard title="Com processo ativo" value={contacts.filter((c) => active.has(c.id)).length} filter={{ active: kpi === "com", onToggle: () => setKpi(kpi === "com" ? "" : "com") }} />
        <KpiCard title="Sem processo ativo" value={contacts.filter((c) => !active.has(c.id)).length} filter={{ active: kpi === "sem", onToggle: () => setKpi(kpi === "sem" ? "" : "sem") }} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <MiniBars title="Top Origens" data={top(contacts.map((c) => c.origin))} />
        <MiniBars title="Faixa etária" data={ageData} />
        <MiniBars title="Top Profissões" data={top(contacts.map((c) => c.profession).filter(Boolean))} />
      </div>
      <DataTableToolbar
        primary={{ label: "Novo contato", onClick: () => openModal({ kind: "contact" }) }}
        search={search}
        onSearch={setSearch}
        filterCount={(origin ? 1 : 0) + (city ? 1 : 0)}
        onClearFilters={() => { setOrigin(""); setCity(""); }}
        filterContent={
          <>
            <Field label="Origem">{(id) => <select id={id} className="input" value={origin} onChange={(e) => setOrigin(e.target.value)}><option value="">Todas</option>{settings.origins.map((o) => <option key={o}>{o}</option>)}</select>}</Field>
            <Field label="Cidade">{(id) => <select id={id} className="input" value={city} onChange={(e) => setCity(e.target.value)}><option value="">Todas</option>{[...new Set(contacts.map((c) => c.city))].sort().map((c) => <option key={c}>{c}</option>)}</select>}</Field>
          </>
        }
        sortOptions={[{ key: "name", label: "Nome" }, { key: "city", label: "Cidade" }, { key: "createdAt", label: "Data do cadastro" }]}
        sort={sort}
        onSort={setSort}
        onExport={() => exportCsv("contatos", ["Nome", "CPF/CNPJ", "Celular", "E-mail", "Cidade", "Origem", "Cadastro"], rows.map((c) => [c.name, c.document, c.phone, c.email, c.city, c.origin, fmtDate(c.createdAt)]))}
        quickFilters={[{ id: "bday", label: `Aniversariantes de ${format(now, "MM/yyyy")}`, icon: <Cake size={16} />, active: birthdays, onClick: () => setBirthdays(!birthdays) }]}
      />
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line dark:border-white/10">
              <tr>
                <th className="th w-10"><span className="sr-only">Expandir</span></th>
                {th("name", "Nome do cliente")}
                <th className="th">Celular</th>
                {th("city", "Cidade")}
                {th("createdAt", "Data do cadastro")}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, pageSize).map((c) => {
                const open = expanded.includes(c.id);
                const procs = processes.filter((p) => p.contactIds.includes(c.id));
                return (
                  <Fragment key={c.id}>
                    <tr className="cursor-pointer border-b border-line hover:bg-card dark:border-white/5 dark:hover:bg-white/5" onClick={() => openModal({ kind: "contact", id: c.id })}>
                      <td className="td" onClick={(e) => e.stopPropagation()}>
                        <button className="btn-icon h-7 w-7" aria-expanded={open} aria-label={open ? "Recolher detalhes" : "Expandir detalhes"} onClick={() => setExpanded(open ? expanded.filter((x) => x !== c.id) : [...expanded, c.id])}>
                          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="td font-medium">{c.name} {isBirthdayMonth(c) && <Cake size={14} className="ml-1 inline text-pink-500" aria-label="Aniversariante do mês" />}</td>
                      <td className="td" onClick={(e) => e.stopPropagation()}>
                        <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 tabular-nums hover:text-green-600" aria-label={`Abrir WhatsApp de ${c.name}: ${c.phone}`}>
                          <MessageCircle size={15} className="text-green-500" /> {c.phone}
                        </a>
                      </td>
                      <td className="td">{c.city}</td>
                      <td className="td tabular-nums">{fmtDate(c.createdAt)}</td>
                    </tr>
                    {open && (
                      <tr className="border-b border-line bg-card dark:border-white/5 dark:bg-white/5">
                        <td />
                        <td colSpan={4} className="td">
                          <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                            <div><dt className="muted">CPF/CNPJ</dt><dd>{c.document || "—"}</dd></div>
                            <div><dt className="muted">E-mail</dt><dd>{c.email || "—"}</dd></div>
                            <div><dt className="muted">Nascimento</dt><dd>{fmtDate(c.birthDate)}</dd></div>
                            <div><dt className="muted">Profissão</dt><dd>{c.profession || "—"}</dd></div>
                            <div><dt className="muted">Origem</dt><dd>{c.origin}</dd></div>
                            <div><dt className="muted">Processos</dt><dd>{procs.length ? procs.map((p) => p.number).join(", ") : "Nenhum"}</dd></div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <p className="muted py-10 text-center text-sm">Não encontramos nenhum registro.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2 text-xs dark:border-white/10">
          <label className="muted flex items-center gap-2">Registros por página
            <select className="input w-auto py-1" value={pageSize} onChange={(e) => setPageSize(+e.target.value)}>{PAGE_SIZES.map((n) => <option key={n} value={n}>{n.toLocaleString("pt-BR")}</option>)}</select>
          </label>
          <span className="muted tabular-nums">{rows.length ? 1 : 0}-{Math.min(pageSize, rows.length)} de {rows.length}</span>
        </div>
      </div>
    </>
  );
}
