import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ArrowLeftRight, ChevronLeft, ChevronRight, CreditCard, Landmark, Minus, PiggyBank, Plus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Collapsible, Field } from "../components/ui/basics";
import { DataTable, DataTableToolbar, type Column } from "../components/ui/DataTable";
import { KpiCard } from "../components/ui/KpiCard";
import { useChartTheme } from "../components/ui/chart";
import { exportCsv } from "../lib/files";
import { brl, fmtDate, fmtMonth, normalize, toDate } from "../lib/format";
import { compare, isLatePayment } from "../lib/rules";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { BankAccount, Transaction } from "../types";

type DateKind = "pagamento" | "vencimento" | "competencia" | "fluxo";
const ACCOUNT_ICON = { corrente: Landmark, dinheiro: Wallet, investimento: PiggyBank, cartao: CreditCard };

/** Saldo de uma conta: saldo inicial + lançamentos pagos. */
export function accountBalance(a: BankAccount, txs: Transaction[]) {
  return txs.filter((t) => t.paidDate).reduce((s, t) => {
    if (t.kind === "transferencia") return s + (t.toAccountId === a.id ? t.value : 0) - (t.accountId === a.id ? t.value : 0);
    if (t.accountId !== a.id) return s;
    return s + (t.kind === "receita" ? t.value : -t.value);
  }, a.initialBalance);
}

export default function Financeiro() {
  const { transactions, accounts, contacts, settings, patch } = useStore();
  const { openModal } = useUi();
  const chart = useChartTheme();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [accountId, setAccountId] = useState("");
  const [dateKind, setDateKind] = useState<DateKind>("vencimento");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ kind: "", category: "", status: "" });
  const [kpi, setKpi] = useState<"" | "receita" | "despesa" | "atrasados">("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "dueDate", dir: "asc" });

  const ym = format(month, "yyyy-MM");
  const prevYm = format(subMonths(month, 1), "yyyy-MM");
  const sumOf = (l: Transaction[]) => l.reduce((s, t) => s + t.value, 0);
  const byDue = (k: Transaction["kind"], m: string) => transactions.filter((t) => t.kind === k && t.dueDate.slice(0, 7) === m);
  const recPrev = sumOf(byDue("receita", ym));
  const recReal = sumOf(byDue("receita", ym).filter((t) => t.paidDate));
  const desPrev = sumOf(byDue("despesa", ym));
  const desReal = sumOf(byDue("despesa", ym).filter((t) => t.paidDate));
  const late = transactions.filter((t) => isLatePayment(t));
  const balance = accounts.reduce((s, a) => s + accountBalance(a, transactions), 0);

  const chartData = Array.from({ length: 5 }, (_, i) => {
    const m = format(addMonths(new Date(), i), "yyyy-MM");
    return { name: fmtMonth(addMonths(new Date(), i)).slice(0, 3), Receitas: sumOf(byDue("receita", m)), Despesas: sumOf(byDue("despesa", m)) };
  });

  const dateOf = (t: Transaction) =>
    dateKind === "pagamento" ? t.paidDate : dateKind === "competencia" ? `${t.competence}-01` : dateKind === "fluxo" ? t.paidDate ?? t.dueDate : t.dueDate;
  const inPeriod = (t: Transaction) => {
    const d = dateOf(t);
    if (!d) return false;
    const x = toDate(d);
    return x >= startOfMonth(month) && x <= endOfMonth(month);
  };
  const rows = useMemo(
    () => transactions
      .filter(inPeriod)
      .filter((t) => !accountId || t.accountId === accountId || t.toAccountId === accountId)
      .filter((t) => (kpi === "atrasados" ? isLatePayment(t) : kpi ? t.kind === kpi : true))
      .filter((t) => !filters.kind || t.kind === filters.kind)
      .filter((t) => !filters.category || t.category === filters.category)
      .filter((t) => !filters.status || (filters.status === "pago" ? !!t.paidDate : filters.status === "aberto" ? !t.paidDate : isLatePayment(t)))
      .filter((t) => !search || normalize(`${t.description} ${t.category} ${contacts.find((c) => c.id === t.contactId)?.name ?? ""}`).includes(normalize(search))),
    [transactions, month, accountId, dateKind, kpi, filters, search, contacts],
  );
  const signed = (t: Transaction) => (t.kind === "despesa" ? -t.value : t.kind === "receita" ? t.value : 0);
  const total = rows.reduce((s, t) => s + signed(t), 0);
  const paidTotal = rows.filter((t) => t.paidDate).reduce((s, t) => s + signed(t), 0);

  const columns: Column<Transaction>[] = [
    { key: "dueDate", header: "Vencimento", sortValue: (t) => t.dueDate, render: (t) => <span className={`tabular-nums ${isLatePayment(t) ? "font-medium text-red-600 dark:text-red-400" : ""}`}>{fmtDate(t.dueDate)}</span> },
    {
      key: "paidDate", header: "Pagamento", sortValue: (t) => t.paidDate ?? "",
      render: (t) => t.paidDate ? <span className="tabular-nums">{fmtDate(t.paidDate)}</span> : (
        <button className="link text-xs" onClick={(e) => { e.stopPropagation(); patch("transactions", t.id, { paidDate: format(new Date(), "yyyy-MM-dd") }); }}>
          {t.kind === "receita" ? "Marcar recebido" : "Marcar pago"}
        </button>
      ),
    },
    { key: "competence", header: "Competência", sortValue: (t) => t.competence, render: (t) => <span className="tabular-nums">{t.competence.split("-").reverse().join("/")}</span> },
    {
      key: "description", header: "Lançamento", sortValue: (t) => t.description,
      render: (t) => <span><span className="font-medium">{t.description}</span><span className="muted block text-xs">{[contacts.find((c) => c.id === t.contactId)?.name, accounts.find((a) => a.id === t.accountId)?.name].filter(Boolean).join(" · ")}</span></span>,
    },
    { key: "category", header: "Categoria", sortValue: (t) => t.category, render: (t) => <span className="chip bg-card dark:bg-white/10">{t.category}</span> },
    {
      key: "value", header: "Valor", sortValue: signed, className: "text-right",
      render: (t) => <span className={`whitespace-nowrap font-medium tabular-nums ${t.kind === "despesa" ? "text-red-600 dark:text-red-400" : t.kind === "receita" ? "text-green-600 dark:text-green-400" : "text-ink-muted"}`}>{t.kind === "despesa" ? "− " : t.kind === "transferencia" ? "⇄ " : ""}{brl(t.value)}</span>,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="h1">Financeiro</h1></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Saldo" value={brl(balance)} tone={balance < 0 ? "danger" : "default"} subtitle="Soma das contas bancárias" />
        <KpiCard title="Receita mensal prevista" value={brl(recPrev)} delta={{ ...compare(recPrev, sumOf(byDue("receita", prevYm))), previous: brl(sumOf(byDue("receita", prevYm))) }}
          subtitle={`Realizada: ${brl(recReal)}`} filter={{ active: kpi === "receita", onToggle: () => setKpi(kpi === "receita" ? "" : "receita") }} />
        <KpiCard title="Despesa mensal prevista" value={brl(desPrev)} tone="danger" upIsBad delta={{ ...compare(desPrev, sumOf(byDue("despesa", prevYm))), previous: brl(sumOf(byDue("despesa", prevYm))) }}
          subtitle={`Realizada: ${brl(desReal)}`} filter={{ active: kpi === "despesa", onToggle: () => setKpi(kpi === "despesa" ? "" : "despesa") }} />
        <KpiCard title="Pagamentos atrasados" value={brl(sumOf(late))} tone={late.length ? "danger" : "default"} subtitle={`${late.length} lançamento(s)`}
          filter={{ active: kpi === "atrasados", onToggle: () => setKpi(kpi === "atrasados" ? "" : "atrasados") }} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card">
          <h2 className="h2 mb-2">Receitas x Despesas <span className="muted text-xs font-normal">por vencimento, próximos 5 meses</span></h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={chart.grid} />
                <XAxis dataKey="name" tick={{ fill: chart.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chart.text, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR")} mil` : String(v))} />
                <Tooltip cursor={{ fill: chart.cursor }} contentStyle={chart.tooltip} formatter={(v: number) => brl(v)} />
                <Legend wrapperStyle={{ fontSize: 12, color: chart.text }} />
                <Bar dataKey="Receitas" fill="#2F80ED" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Despesas" fill="#EB5757" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card space-y-4">
          <div className="flex gap-2">
            <button className="btn flex-1 border-green-600 bg-green-600 text-white hover:bg-green-700 dark:border-green-600 dark:bg-green-600" onClick={() => openModal({ kind: "transaction", txKind: "receita" })}>Nova receita <Plus size={16} /></button>
            <button className="btn border-red-600 bg-red-600 px-3 text-white hover:bg-red-700 dark:border-red-600 dark:bg-red-600" onClick={() => openModal({ kind: "transaction", txKind: "despesa" })} aria-label="Nova despesa"><Minus size={16} /></button>
            <button className="btn px-3" onClick={() => openModal({ kind: "transaction", txKind: "transferencia" })} aria-label="Nova transferência"><ArrowLeftRight size={16} /></button>
          </div>
          <div>
            <h3 className="label uppercase tracking-wider">Contas bancárias</h3>
            <ul className="space-y-1">
              {accounts.map((a) => {
                const Icon = ACCOUNT_ICON[a.kind];
                const b = accountBalance(a, transactions);
                return (
                  <li key={a.id}>
                    <button onClick={() => setAccountId(accountId === a.id ? "" : a.id)} aria-pressed={accountId === a.id}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white dark:hover:bg-white/5 ${accountId === a.id ? "bg-white ring-1 ring-primary dark:bg-white/5" : ""}`}>
                      <Icon size={18} className="text-ink-muted" />
                      <span className="flex-1 text-sm">{a.name}</span>
                      <span className={`text-sm font-medium tabular-nums ${b < 0 ? "text-red-600" : ""}`}>{brl(b)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <Collapsible title="Lançamentos">
        <div className="flex flex-wrap items-center gap-2">
          <label><span className="sr-only">Conta</span>
            <select className="input w-auto" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Todas as contas</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label><span className="sr-only">Tipo de data</span>
            <select className="input w-auto" value={dateKind} onChange={(e) => setDateKind(e.target.value as DateKind)}>
              <option value="pagamento">Data de pagamento</option>
              <option value="vencimento">Data de vencimento</option>
              <option value="competencia">Competência</option>
              <option value="fluxo">Fluxo de caixa</option>
            </select>
          </label>
          <div className="flex items-center">
            <button className="btn-icon" onClick={() => setMonth(subMonths(month, 1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
            <span className="w-36 text-center text-sm font-semibold">{fmtMonth(month)}</span>
            <button className="btn-icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês"><ChevronRight size={18} /></button>
          </div>
        </div>
        <DataTableToolbar
          search={search}
          onSearch={setSearch}
          filterCount={Object.values(filters).filter(Boolean).length}
          onClearFilters={() => setFilters({ kind: "", category: "", status: "" })}
          filterContent={
            <>
              <Field label="Tipo">{(id) => <select id={id} className="input" value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })}><option value="">Todos</option><option value="receita">Receitas</option><option value="despesa">Despesas</option><option value="transferencia">Transferências</option></select>}</Field>
              <Field label="Categoria">{(id) => <select id={id} className="input" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">Todas</option>{[...settings.categories.receita, ...settings.categories.despesa].map((c) => <option key={c}>{c}</option>)}</select>}</Field>
              <Field label="Situação">{(id) => <select id={id} className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Todas</option><option value="pago">Pagos</option><option value="aberto">Em aberto</option><option value="atrasado">Atrasados</option></select>}</Field>
            </>
          }
          sortOptions={[{ key: "dueDate", label: "Vencimento" }, { key: "value", label: "Valor" }, { key: "description", label: "Lançamento" }]}
          sort={sort}
          onSort={setSort}
          onExport={() => exportCsv(`lancamentos-${ym}`, ["Vencimento", "Pagamento", "Competência", "Lançamento", "Categoria", "Tipo", "Valor"],
            rows.map((t) => [fmtDate(t.dueDate), fmtDate(t.paidDate), t.competence, t.description, t.category, t.kind, signed(t).toFixed(2).replace(".", ",")]))}
        />
        <DataTable columns={columns} rows={rows} getId={(t) => t.id} selectable sort={sort} onSortChange={setSort} onRowClick={(t) => openModal({ kind: "transaction", id: t.id })}
          footer={
            <div className="flex flex-wrap justify-end gap-x-8 gap-y-1 border-t border-line bg-card px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5">
              <span>Total do período filtrado: <b className={`tabular-nums ${total < 0 ? "text-red-600" : ""}`}>{brl(total)}</b></span>
              <span>Saldo (realizado): <b className="tabular-nums">{brl(paidTotal)}</b></span>
              <span>Previsto (em aberto): <b className="tabular-nums">{brl(total - paidTotal)}</b></span>
            </div>
          } />
      </Collapsible>
    </>
  );
}
