import { differenceInCalendarDays, subDays, subHours } from "date-fns";
import { AlertTriangle, ExternalLink, Loader2, Printer, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Collapsible, Field, Modal, PageHeader, Segmented } from "../components/ui/basics";
import { DataTable, DataTableToolbar, type Column } from "../components/ui/DataTable";
import { UserChipSelect } from "../components/ui/UserChipSelect";
import { fmtDate, fmtDateTime, normalize, relDateTime } from "../lib/format";
import { cloudMode } from "../lib/supabase";
import { buscarIntimacoes } from "../lib/tribunais";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { Intimation, MonitoredTerm } from "../types";

type Period = "hoje" | "3" | "7" | "30" | "90";
const STATUS = { nova: "Nova", lida: "Lida", tratada: "Tratada" } as const;
const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];
const fmtOab = (n: string) => Number(n).toLocaleString("pt-BR");

export default function Intimacoes() {
  const { intimations, monitoredTerms, processes, contacts, users, upsert, remove, patch } = useStore();
  const { openModal, showToast } = useUi();
  const [period, setPeriod] = useState<Period>("30");
  const [resp, setResp] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [court, setCourt] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "publishedAt", dir: "desc" });
  const [termOpen, setTermOpen] = useState(false);
  const [oab, setOab] = useState({ uf: "DF", number: "" });
  const [reading, setReading] = useState<Intimation | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const oabs = monitoredTerms.filter((t) => t.kind === "OAB");
  const lastSync = oabs.map((t) => t.lastSyncAt).filter(Boolean).sort().at(-1);
  const lastError = oabs.find((t) => t.lastError)?.lastError;

  const addOab = () => {
    const number = oab.number.replace(/\D/g, "");
    if (!number) return showToast("Informe o número da OAB");
    const id = `oab_${oab.uf.toLowerCase()}_${number}`;
    if (monitoredTerms.some((t) => t.id === id)) return showToast("Esta OAB já está monitorada");
    const term: MonitoredTerm = { id, term: `OAB/${oab.uf} ${fmtOab(number)}`, kind: "OAB", oabUf: oab.uf, oabNumber: number, createdAt: new Date().toISOString() };
    upsert("monitoredTerms", term);
    setTermOpen(false);
    setOab({ uf: "DF", number: "" });
    showToast(cloudMode ? `OAB/${oab.uf} ${fmtOab(number)} cadastrada. Use “Buscar agora” para trazer as publicações.` : "OAB cadastrada");
  };

  const syncNow = async () => {
    if (!cloudMode) {
      // Modo demonstração: publicações fictícias a partir dos processos de exemplo.
      const texts = ["Fica a parte autora intimada para, no prazo de 15 dias, apresentar réplica à contestação.", "Intimação da sentença. Prazo para recurso: 15 dias úteis.", "Designada audiência de conciliação. Intimem-se as partes.", "Manifeste-se a parte sobre o laudo pericial no prazo de 15 dias.", "Intimação para cumprimento voluntário da sentença (CPC, art. 523)."];
      processes.filter((p) => p.status === "ativo").slice(0, 5).forEach((p, i) =>
        upsert("intimations", { id: `demo_${p.id}`, processId: p.id, number: p.number, court: p.court, publishedAt: subHours(subDays(new Date(), [0, 1, 2, 5, 12][i]), i).toISOString(), text: texts[i], responsibleId: p.responsibleId, status: i < 3 ? "nova" : "lida", source: "demo", oab: oabs[0]?.term }),
      );
      return showToast("Demonstração: publicações fictícias. No sistema online, a busca é feita no DJEN.");
    }
    setBusy(true);
    try {
      const r = await buscarIntimacoes(30);
      const err = r.djen.oabs.find((o) => o.error);
      if (err) showToast(`Erro ao consultar o DJEN: ${err.error}`);
      else showToast(`${r.djen.intimacoes} intimação(ões) nova(s)${r.djen.processosNovos ? `, ${r.djen.processosNovos} processo(s) novo(s) para revisar` : ""}. ${r.datajud.atualizados} processo(s) com andamentos novos.`);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const days = period === "hoje" ? 0 : +period;
  const procOf = (i: Intimation) => processes.find((x) => x.id === i.processId);
  const procName = (i: Intimation) => {
    const p = procOf(i);
    return (p && contacts.find((c) => c.id === p.contactIds[0])?.name) || (p?.needsReview ? "Processo a revisar" : "—");
  };
  const courts = [...new Set(intimations.map((i) => i.court).filter(Boolean))].sort();
  const rows = intimations
    .filter((i) => differenceInCalendarDays(new Date(), new Date(i.publishedAt)) <= days)
    .filter((i) => !resp.length || (i.responsibleId && resp.includes(i.responsibleId)))
    .filter((i) => !status || i.status === status)
    .filter((i) => !court || i.court === court)
    .filter((i) => !search || normalize(`${i.number} ${i.text} ${i.court} ${i.orgao ?? ""} ${procName(i)}`).includes(normalize(search)));

  const columns: Column<Intimation>[] = [
    { key: "proc", header: "Processo", sortValue: procName, render: (i) => <span className={i.status === "nova" ? "font-semibold" : ""}>{procName(i)}{i.orgao && <span className="muted block text-xs font-normal">{i.orgao}</span>}</span> },
    { key: "publishedAt", header: "Publicação", sortValue: (i) => i.publishedAt, render: (i) => <span className="tabular-nums">{fmtDate(i.publishedAt)}</span> },
    { key: "court", header: "Tribunal", sortValue: (i) => i.court, render: (i) => i.court },
    { key: "number", header: "Número do processo", render: (i) => <span className="whitespace-nowrap tabular-nums">{i.number}</span> },
    { key: "resp", header: "Responsável", render: (i) => <Avatar user={users.find((u) => u.id === i.responsibleId)} size={24} /> },
    { key: "status", header: "Situação", sortValue: (i) => i.status, render: (i) => <span className={`chip ${i.status === "nova" ? "bg-primary-soft text-primary dark:bg-primary/15" : i.status === "tratada" ? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-card dark:bg-white/10"}`}>{STATUS[i.status]}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Intimações"
        subtitle="Publicações do Diário de Justiça Eletrônico Nacional (DJEN) das OABs monitoradas, de todos os tribunais que publicam nele."
        actions={
          <>
            <button className="btn" onClick={() => setTermOpen(true)}>Cadastrar OAB</button>
            <button className="btn-primary" onClick={syncNow} disabled={busy || !oabs.length}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} {busy ? "Buscando…" : "Buscar agora"}
            </button>
          </>
        }
      />

      {oabs.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle size={18} />
          <span><b>Nenhuma OAB monitorada.</b> <button className="font-medium underline" onClick={() => setTermOpen(true)}>Clique aqui para começar a monitorar sua OAB</button></span>
        </div>
      ) : (
        <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="muted">Monitorando:</span>
            {oabs.map((t) => (
              <span key={t.id} className="chip border border-line bg-white py-1 dark:border-white/10 dark:bg-[#0F1115]">
                {t.term}
                <button aria-label={confirmRemove === t.id ? `Confirmar: parar de monitorar ${t.term}` : `Parar de monitorar ${t.term}`}
                  className={confirmRemove === t.id ? "rounded bg-red-600 px-1 text-white" : ""}
                  onClick={() => (confirmRemove === t.id ? (remove("monitoredTerms", t.id), setConfirmRemove(null)) : setConfirmRemove(t.id))}>
                  {confirmRemove === t.id ? "Remover?" : <Trash2 size={12} />}
                </button>
              </span>
            ))}
          </div>
          <span className="muted">{lastSync ? `Última busca: ${relDateTime(lastSync)}` : cloudMode ? "Ainda não buscado. A busca automática roda às 7h e às 16h." : "Modo demonstração"}</span>
          {lastError && <span className="text-red-600 dark:text-red-400">Erro na última busca: {lastError}</span>}
        </div>
      )}

      <Collapsible title="Intimações recebidas">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Período" value={period} onChange={setPeriod} options={[{ id: "hoje", label: "Hoje" }, { id: "3", label: "3 dias" }, { id: "7", label: "7 dias" }, { id: "30", label: "30 dias" }, { id: "90", label: "90 dias" }]} />
          <UserChipSelect users={users} value={resp} onChange={setResp} label="Responsável" />
        </div>
        <DataTableToolbar
          search={search}
          onSearch={setSearch}
          filterCount={(status ? 1 : 0) + (court ? 1 : 0)}
          onClearFilters={() => { setStatus(""); setCourt(""); }}
          filterContent={
            <>
              <Field label="Situação">{(id) => <select id={id} className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todas</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
              <Field label="Tribunal">{(id) => <select id={id} className="input" value={court} onChange={(e) => setCourt(e.target.value)}><option value="">Todos</option>{courts.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
            </>
          }
          sortOptions={[{ key: "publishedAt", label: "Publicação" }, { key: "court", label: "Tribunal" }]}
          sort={sort}
          onSort={setSort}
          extra={<button className="btn" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>}
        />
        <DataTable columns={columns} rows={rows} getId={(i) => i.id} selectable sort={sort} onSortChange={setSort}
          emptyText={oabs.length ? "Nenhuma intimação neste período." : undefined}
          onRowClick={(i) => { setReading(i); if (i.status === "nova") patch("intimations", i.id, { status: "lida" }); }} />
      </Collapsible>

      {termOpen && (
        <Modal title="Cadastrar OAB" onClose={() => setTermOpen(false)} footer={<><button className="btn" onClick={() => setTermOpen(false)}>Cancelar</button><button className="btn-primary" onClick={addOab}>Monitorar</button></>}>
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <Field label="UF">{(id) => <select id={id} className="input" value={oab.uf} onChange={(e) => setOab({ ...oab, uf: e.target.value })}>{UFS.map((u) => <option key={u}>{u}</option>)}</select>}</Field>
            <Field label="Número da OAB">{(id) => <input id={id} className="input tabular-nums" inputMode="numeric" placeholder="Ex.: 70620" value={oab.number} onChange={(e) => setOab({ ...oab, number: e.target.value.replace(/\D/g, "").slice(0, 7) })} />}</Field>
            <p className="muted text-xs sm:col-span-2">O sistema busca no DJEN as publicações em que esta OAB foi intimada, em qualquer tribunal que publique no DJEN. Para inscrição suplementar, cadastre a UF e o número dela também.</p>
          </div>
        </Modal>
      )}
      {reading && (
        <Modal title={`Intimação · ${reading.number}`} wide onClose={() => setReading(null)} footer={
          <>
            {procOf(reading) && <Link className="btn mr-auto" to={`/processos/${reading.processId}`} onClick={() => setReading(null)}>Abrir processo</Link>}
            <button className="btn" onClick={() => { const p = procOf(reading); openModal({ kind: "task", preset: { title: "Cumprir intimação", processId: reading.processId, contactId: p?.contactIds[0], description: reading.text.slice(0, 2000) } }); setReading(null); }}>Criar tarefa</button>
            <button className="btn-primary" onClick={() => { patch("intimations", reading.id, { status: "tratada" }); setReading(null); showToast("Intimação marcada como tratada"); }}>Marcar como tratada</button>
          </>
        }>
          <p className="muted mb-3 text-xs">
            {[reading.court, reading.orgao, reading.tipo, `publicada em ${fmtDateTime(reading.publishedAt)}`, reading.oab && `OAB ${reading.oab}`].filter(Boolean).join(" · ")}
          </p>
          {procOf(reading)?.needsReview && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Processo cadastrado automaticamente. Abra o processo e vincule o cliente.</p>}
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{reading.text || "Publicação sem texto."}</p>
          {reading.link && <a className="link mt-3 inline-flex items-center gap-1 text-sm" href={reading.link} target="_blank" rel="noreferrer">Ver documento no tribunal <ExternalLink size={14} /></a>}
        </Modal>
      )}
    </>
  );
}
