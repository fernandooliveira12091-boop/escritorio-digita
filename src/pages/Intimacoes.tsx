import { differenceInCalendarDays, subDays, subHours } from "date-fns";
import { AlertTriangle, Printer, Trash2 } from "lucide-react";
import { useState } from "react";
import { Avatar, Collapsible, Field, Modal, PageHeader, Segmented } from "../components/ui/basics";
import { DataTable, DataTableToolbar, type Column } from "../components/ui/DataTable";
import { UserChipSelect } from "../components/ui/UserChipSelect";
import { fmtDate, fmtDateTime, normalize, uid } from "../lib/format";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { Intimation } from "../types";

type Period = "hoje" | "3" | "7" | "30";
const STATUS = { nova: "Nova", lida: "Lida", tratada: "Tratada" } as const;

export default function Intimacoes() {
  const { intimations, monitoredTerms, processes, contacts, users, upsert, remove, patch } = useStore();
  const { openModal, showToast } = useUi();
  const [period, setPeriod] = useState<Period>("30");
  const [resp, setResp] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "publishedAt", dir: "desc" });
  const [termOpen, setTermOpen] = useState(false);
  const [term, setTerm] = useState({ term: "", kind: "OAB" as "OAB" | "Nome" });
  const [reading, setReading] = useState<Intimation | null>(null);

  const addTerm = () => {
    if (!term.term.trim()) return showToast("Informe a OAB ou o nome a monitorar");
    upsert("monitoredTerms", { id: uid("mt"), term: term.term.trim(), kind: term.kind, createdAt: new Date().toISOString() });
    // Demonstração: a primeira busca traz publicações dos processos já cadastrados.
    if (!intimations.length) {
      const texts = ["Fica a parte autora intimada para, no prazo de 15 dias, apresentar réplica à contestação.", "Intimação da sentença. Prazo para recurso: 15 dias úteis.", "Designada audiência de conciliação. Intimem-se as partes.", "Manifeste-se a parte sobre o laudo pericial no prazo de 15 dias.", "Intimação para cumprimento voluntário da sentença (CPC, art. 523)."];
      processes.filter((p) => p.status === "ativo").slice(0, 5).forEach((p, i) =>
        upsert("intimations", { id: uid("in"), processId: p.id, number: p.number, court: p.court, publishedAt: subHours(subDays(new Date(), [0, 1, 2, 5, 12][i]), i).toISOString(), text: texts[i], responsibleId: p.responsibleId, status: i < 3 ? "nova" : "lida" }),
      );
    }
    setTermOpen(false);
    setTerm({ term: "", kind: "OAB" });
    showToast("Termo monitorado. Publicações do DJEN aparecem abaixo.");
  };

  const days = period === "hoje" ? 0 : +period;
  const rows = intimations
    .filter((i) => differenceInCalendarDays(new Date(), new Date(i.publishedAt)) <= days)
    .filter((i) => !resp.length || (i.responsibleId && resp.includes(i.responsibleId)))
    .filter((i) => !status || i.status === status)
    .filter((i) => !search || normalize(`${i.number} ${i.text} ${i.court}`).includes(normalize(search)));
  const procName = (i: Intimation) => {
    const p = processes.find((x) => x.id === i.processId);
    return p ? contacts.find((c) => c.id === p.contactIds[0])?.name ?? "—" : "—";
  };

  const columns: Column<Intimation>[] = [
    { key: "proc", header: "Processo", sortValue: procName, render: (i) => <span className={i.status === "nova" ? "font-semibold" : ""}>{procName(i)}</span> },
    { key: "publishedAt", header: "Publicação", sortValue: (i) => i.publishedAt, render: (i) => <span className="tabular-nums">{fmtDate(i.publishedAt)}</span> },
    { key: "court", header: "Tribunal", sortValue: (i) => i.court, render: (i) => i.court },
    { key: "number", header: "Número do processo", render: (i) => <span className="whitespace-nowrap tabular-nums">{i.number}</span> },
    { key: "resp", header: "Responsável", render: (i) => <Avatar user={users.find((u) => u.id === i.responsibleId)} size={24} /> },
    { key: "status", header: "Situação", sortValue: (i) => i.status, render: (i) => <span className={`chip ${i.status === "nova" ? "bg-primary-soft text-primary dark:bg-primary/15" : i.status === "tratada" ? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-card dark:bg-white/10"}`}>{STATUS[i.status]}</span> },
  ];

  return (
    <>
      <PageHeader title="Intimações" subtitle="Publicações do Diário de Justiça Eletrônico Nacional (DJEN) dos termos monitorados." actions={<button className="btn-primary" onClick={() => setTermOpen(true)}>Monitorar termo</button>} />

      {monitoredTerms.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle size={18} />
          <span><b>Nenhum termo monitorado.</b> <button className="font-medium underline" onClick={() => setTermOpen(true)}>Clique aqui para começar a monitorar sua OAB</button></span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="muted">Monitorando:</span>
          {monitoredTerms.map((t) => (
            <span key={t.id} className="chip bg-card dark:bg-white/10">{t.kind}: {t.term}
              <button aria-label={`Parar de monitorar ${t.term}`} onClick={() => remove("monitoredTerms", t.id)}><Trash2 size={12} /></button>
            </span>
          ))}
        </div>
      )}

      <Collapsible title="Intimações recebidas">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Período" value={period} onChange={setPeriod} options={[{ id: "hoje", label: "Hoje" }, { id: "3", label: "3 dias" }, { id: "7", label: "7 dias" }, { id: "30", label: "30 dias" }]} />
          <UserChipSelect users={users} value={resp} onChange={setResp} label="Responsável" />
        </div>
        <DataTableToolbar
          search={search}
          onSearch={setSearch}
          filterCount={status ? 1 : 0}
          onClearFilters={() => setStatus("")}
          filterContent={<Field label="Situação">{(id) => <select id={id} className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todas</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>}
          sortOptions={[{ key: "publishedAt", label: "Publicação" }, { key: "court", label: "Tribunal" }]}
          sort={sort}
          onSort={setSort}
          extra={<button className="btn" onClick={() => showToast("A impressão fica disponível ao abrir o sistema fora desta visualização")}><Printer size={16} /> Imprimir</button>}
        />
        <DataTable columns={columns} rows={rows} getId={(i) => i.id} selectable sort={sort} onSortChange={setSort}
          onRowClick={(i) => { setReading(i); if (i.status === "nova") patch("intimations", i.id, { status: "lida" }); }} />
      </Collapsible>

      {termOpen && (
        <Modal title="Monitorar termo" onClose={() => setTermOpen(false)} footer={<><button className="btn" onClick={() => setTermOpen(false)}>Cancelar</button><button className="btn-primary" onClick={addTerm}>Monitorar</button></>}>
          <div className="space-y-4">
            <Field label="Tipo">{(id) => <select id={id} className="input" value={term.kind} onChange={(e) => setTerm({ ...term, kind: e.target.value as "OAB" | "Nome" })}><option value="OAB">Número da OAB</option><option value="Nome">Nome do advogado</option></select>}</Field>
            <Field label={term.kind === "OAB" ? "OAB (ex.: DF 70.620)" : "Nome como aparece nas publicações"}>{(id) => <input id={id} className="input" value={term.term} onChange={(e) => setTerm({ ...term, term: e.target.value })} />}</Field>
            <p className="muted text-xs">Nesta demonstração, as publicações são simuladas a partir dos processos cadastrados.</p>
          </div>
        </Modal>
      )}
      {reading && (
        <Modal title={`Intimação · ${reading.number}`} onClose={() => setReading(null)} footer={
          <>
            <button className="btn" onClick={() => { const p = processes.find((x) => x.id === reading.processId); openModal({ kind: "task", preset: { title: "Cumprir intimação", processId: reading.processId, contactId: p?.contactIds[0], description: reading.text } }); setReading(null); }}>Criar tarefa</button>
            <button className="btn-primary" onClick={() => { patch("intimations", reading.id, { status: "tratada" }); setReading(null); showToast("Intimação marcada como tratada"); }}>Marcar como tratada</button>
          </>
        }>
          <p className="muted mb-3 text-xs">{reading.court} · publicada em {fmtDateTime(reading.publishedAt)}</p>
          <p className="text-sm leading-relaxed">{reading.text}</p>
        </Modal>
      )}
    </>
  );
}
