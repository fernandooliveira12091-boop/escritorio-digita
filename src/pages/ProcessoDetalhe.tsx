import { ArrowLeft, FileText, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { StatusDot } from "../components/tasks";
import { Avatar, EmptyState, PageHeader, Tabs } from "../components/ui/basics";
import { brl, fmtDate, fmtDateTime, relDateTime, uid } from "../lib/format";
import { daysWithoutMovement, isLatePayment, isStagnant } from "../lib/rules";
import { cloudMode } from "../lib/supabase";
import { atualizarAndamentos } from "../lib/tribunais";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";

type Tab = "dados" | "andamentos" | "tarefas" | "documentos" | "financeiro" | "historico";

export default function ProcessoDetalhe() {
  const { id } = useParams();
  const location = useLocation();
  const { processes, contacts, users, partners, tasks, transactions, settings, addMovement, patch } = useStore();
  const { openModal, showToast } = useUi();
  const hashTab = location.hash.slice(1) as Tab;
  const [tab, setTab] = useState<Tab>(["andamentos", "tarefas", "documentos", "financeiro", "historico"].includes(hashTab) ? hashTab : "dados");
  const [movement, setMovement] = useState("");
  const [docName, setDocName] = useState("");
  const [fetching, setFetching] = useState(false);
  const p = processes.find((x) => x.id === id);
  if (!p) return <EmptyState action={<Link className="link" to="/processos">Voltar para Processos</Link>}>Processo não encontrado.</EmptyState>;

  const client = contacts.find((c) => c.id === p.contactIds[0]);
  const funnel = settings.funnels.find((f) => f.id === p.funnelId);
  const stage = funnel?.stages.find((s) => s.id === p.stageId);
  const resp = users.find((u) => u.id === p.responsibleId);
  const pTasks = tasks.filter((t) => t.processId === p.id).sort((a, b) => a.date.localeCompare(b.date));
  const pTx = transactions.filter((t) => t.processId === p.id || (t.contactId && p.contactIds.includes(t.contactId)));
  const movements = [...p.movements].sort((a, b) => b.date.localeCompare(a.date));

  const info: [string, ReactNode][] = [
    ["Número (CNJ)", <span className="tabular-nums">{p.number || "—"}</span>],
    ["Tribunal", p.court],
    ["Classe (tribunal)", p.className ?? "—"],
    ["Órgão julgador", p.orgao ?? "—"],
    ["Andamentos capturados", p.capturedAt ? `${fmtDateTime(p.capturedAt)}${p.datajudFound === false ? " (não encontrado no DataJud)" : ""}` : "Nunca"],
    ["Grupo de ação", settings.actionGroups.find((g) => g.id === p.actionGroupId)?.name],
    ["Tipo de ação", settings.actionTypes.find((t) => t.id === p.actionTypeId)?.name],
    ["Fase / etapa", `${funnel?.name} › ${stage?.name}`],
    ["Situação", p.status === "ativo" ? "Ativo" : p.status === "fechado" ? "Fechado" : "Arquivado"],
    ["Resultado", p.outcome === "ganho" ? "Ganho" : p.outcome === "perdido" ? "Perdido" : "Em andamento"],
    ["Valor da causa", brl(p.value)],
    ["Cadastro", fmtDate(p.createdAt)],
    ["Ajuizamento", fmtDate(p.filedAt)],
    ["Parceiro", partners.find((x) => x.id === p.partnerId)?.name ?? "—"],
  ];

  return (
    <>
      <Link to="/processos" className="muted inline-flex items-center gap-1 text-sm hover:text-ink"><ArrowLeft size={16} /> Processos</Link>
      <PageHeader
        title={client?.name ?? "Processo"}
        subtitle={<>x {p.opposingParty || "—"} · <span className="tabular-nums">{p.number}</span></>}
        actions={
          <>
            <button className="btn" onClick={() => openModal({ kind: "task", preset: { processId: p.id, contactId: p.contactIds[0] } })}><Plus size={16} /> Tarefa</button>
            <button className="btn-primary" onClick={() => openModal({ kind: "process", id: p.id })}><Pencil size={16} /> Editar</button>
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <span className="chip bg-primary-soft text-primary dark:bg-primary/15">{funnel?.name} › {stage?.name}</span>
        {isStagnant(p) && <span className="chip bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Estagnado há {daysWithoutMovement(p)} dias</span>}
        {resp && <span className="chip bg-card dark:bg-white/10"><Avatar user={resp} size={18} /> {resp.name}</span>}
      </div>
      {p.needsReview && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="flex-1">Este processo foi cadastrado automaticamente a partir de uma intimação do DJEN. Vincule o cliente e confira o tipo de ação.</span>
          <button className="btn" onClick={() => openModal({ kind: "process", id: p.id })}>Completar cadastro</button>
        </div>
      )}
      <Tabs value={tab} onChange={(t) => { setTab(t); if (t === "historico") patch("processes", p.id, { unreadHistory: false }); }} tabs={[
        { id: "dados", label: "Dados e partes" }, { id: "andamentos", label: `Andamentos (${p.movements.length})` }, { id: "tarefas", label: `Tarefas (${pTasks.length})` },
        { id: "documentos", label: `Documentos (${p.documents.length})` }, { id: "financeiro", label: "Financeiro" }, { id: "historico", label: "Histórico" },
      ]} />

      {tab === "dados" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h2 className="h2 mb-3">Dados do processo</h2>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
              {info.map(([k, v]) => <div key={k} className="contents"><dt className="muted">{k}</dt><dd>{v ?? "—"}</dd></div>)}
            </dl>
          </div>
          <div className="card space-y-3">
            <h2 className="h2">Partes</h2>
            <div className="surface p-3">
              <p className="muted text-xs uppercase tracking-wider">Cliente</p>
              <button className="font-medium hover:text-primary" onClick={() => client && openModal({ kind: "contact", id: client.id })}>{client?.name}</button>
              <p className="muted text-xs">{client?.document} · {client?.phone}</p>
            </div>
            <div className="surface p-3">
              <p className="muted text-xs uppercase tracking-wider">Parte contrária</p>
              <p className="font-medium">{p.opposingParty || "—"}</p>
            </div>
          </div>
        </div>
      )}

      {tab === "andamentos" && (
        <div className="card space-y-4">
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!movement.trim()) return; addMovement(p.id, movement.trim()); setMovement(""); showToast("Andamento registrado"); }}>
            <label className="sr-only" htmlFor="mov">Novo andamento</label>
            <input id="mov" className="input flex-1" placeholder="Registrar novo andamento" value={movement} onChange={(e) => setMovement(e.target.value)} />
            <button className="btn-primary">Adicionar</button>
            {cloudMode && (
              <button type="button" className="btn" disabled={fetching} onClick={async () => {
                setFetching(true);
                try {
                  const r = await atualizarAndamentos([p.id]);
                  showToast(r.datajud.erros.length ? `Erro no DataJud: ${r.datajud.erros[0]}` : r.datajud.naoEncontrados.length ? "Processo não encontrado no DataJud (pode levar alguns dias para aparecer)" : r.datajud.atualizados ? "Andamentos novos encontrados" : "Nenhum andamento novo");
                } catch (e) { showToast((e as Error).message); } finally { setFetching(false); }
              }}>
                {fetching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Buscar no DataJud
              </button>
            )}
          </form>
          {p.capturedAt && <p className="muted text-xs">Andamentos do DataJud (CNJ), consultado {relDateTime(p.capturedAt)}. Os dados podem ter alguns dias de atraso em relação ao sistema do tribunal.</p>}
          <ol className="relative space-y-4 border-l-2 border-line pl-5 dark:border-white/10">
            {movements.map((m) => (
              <li key={m.id} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-primary dark:border-[#171A21]" />
                <p className="text-sm font-medium">{m.text}</p>
                <p className="muted text-xs tabular-nums">{fmtDateTime(m.date)}</p>
              </li>
            ))}
            {!movements.length && <li className="muted text-sm">Nenhum andamento registrado.</li>}
          </ol>
        </div>
      )}

      {tab === "tarefas" && (
        <div className="surface overflow-hidden">
          {pTasks.map((t) => (
            <button key={t.id} onClick={() => openModal({ kind: "taskDetail", taskId: t.id })} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-card dark:border-white/5 dark:hover:bg-white/5">
              <StatusDot task={t} />
              <span className="flex-1">{t.title}</span>
              <span className="muted text-xs tabular-nums">{relDateTime(t.deadline ?? t.date)}</span>
            </button>
          ))}
          {!pTasks.length && <EmptyState action={<button className="btn-primary" onClick={() => openModal({ kind: "task", preset: { processId: p.id, contactId: p.contactIds[0] } })}>Nova tarefa</button>}>Nenhuma tarefa vinculada.</EmptyState>}
        </div>
      )}

      {tab === "documentos" && (
        <div className="card space-y-3">
          <form className="flex flex-wrap gap-2" onSubmit={(e) => {
            e.preventDefault();
            if (!docName.trim()) return;
            patch("processes", p.id, { documents: [...p.documents, { id: uid("d"), name: docName.trim(), createdAt: new Date().toISOString() }] });
            setDocName("");
          }}>
            <label className="sr-only" htmlFor="doc">Nome do documento</label>
            <input id="doc" className="input flex-1" placeholder="Nome do documento (ex.: Petição inicial.pdf)" value={docName} onChange={(e) => setDocName(e.target.value)} />
            <button className="btn-primary">Adicionar</button>
          </form>
          <ul className="surface divide-y divide-line dark:divide-white/5">
            {p.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                <FileText size={16} className="text-primary" />
                <span className="flex-1 text-sm">{d.name}</span>
                <span className="muted text-xs">{fmtDate(d.createdAt)}</span>
                <button className="btn-icon h-8 w-8" aria-label={`Remover ${d.name}`} onClick={() => patch("processes", p.id, { documents: p.documents.filter((x) => x.id !== d.id) })}><Trash2 size={14} /></button>
              </li>
            ))}
            {!p.documents.length && <li className="muted px-3 py-6 text-center text-sm">Nenhum documento.</li>}
          </ul>
          <p className="muted text-xs">Para gerar procuração, contrato e outros a partir deste processo, use <Link className="link" to={`/modelos/meus?processo=${p.id}`}>Modelos e IA</Link>.</p>
        </div>
      )}

      {tab === "financeiro" && (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="border-b border-line dark:border-white/10"><th className="th">Vencimento</th><th className="th">Lançamento</th><th className="th">Situação</th><th className="th text-right">Valor</th></tr></thead>
            <tbody>
              {pTx.map((t) => (
                <tr key={t.id} className="cursor-pointer border-b border-line hover:bg-card dark:border-white/5 dark:hover:bg-white/5" onClick={() => openModal({ kind: "transaction", id: t.id })}>
                  <td className="td tabular-nums">{fmtDate(t.dueDate)}</td>
                  <td className="td">{t.description}</td>
                  <td className="td">{t.paidDate ? <span className="chip bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400">Pago</span> : isLatePayment(t) ? <span className="chip bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400">Atrasado</span> : <span className="chip bg-card dark:bg-white/10">Em aberto</span>}</td>
                  <td className={`td text-right tabular-nums ${t.kind === "despesa" ? "text-red-600" : "text-green-600"}`}>{t.kind === "despesa" ? "−" : ""}{brl(t.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pTx.length && <p className="muted py-8 text-center text-sm">Nenhum lançamento deste cliente.</p>}
        </div>
      )}

      {tab === "historico" && (
        <div className="card">
          <ol className="space-y-3">
            {[...p.history].reverse().map((h) => (
              <li key={h.id} className="flex gap-3 text-sm"><span className="muted w-36 shrink-0 tabular-nums">{fmtDateTime(h.date)}</span><span>{h.text}</span></li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
