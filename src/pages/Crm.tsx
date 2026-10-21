import { DndContext, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ArrowDownLeft, CheckSquare, DollarSign, FileText, Folder, History, Hourglass, MoreVertical, Plus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Dropdown, MenuItem, PageHeader, Tabs } from "../components/ui/basics";
import { DataTableToolbar } from "../components/ui/DataTable";
import { UserChipSelect } from "../components/ui/UserChipSelect";
import { exportCsv } from "../lib/files";
import { brl, normalize, uid } from "../lib/format";
import { inMonth, isStagnant } from "../lib/rules";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { LegalProcess } from "../types";

function Card({ p }: { p: LegalProcess }) {
  const { contacts, users, settings, patch } = useStore();
  const { openModal } = useUi();
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: p.id });
  const client = contacts.find((c) => c.id === p.contactIds[0]);
  const group = settings.actionGroups.find((g) => g.id === p.actionGroupId);
  const type = settings.actionTypes.find((t) => t.id === p.actionTypeId);
  const resp = users.find((u) => u.id === p.responsibleId);
  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`surface space-y-2 p-3 shadow-sm ${isDragging ? "z-50 opacity-90 shadow-lg ring-2 ring-primary" : ""}`}
    >
      <div {...listeners} {...attributes} className="cursor-grab space-y-1 active:cursor-grabbing" aria-label={`Processo de ${client?.name}. Arraste para mudar de etapa`} aria-roledescription="cartão arrastável">
        <button className="block text-left text-sm font-semibold hover:text-primary" onPointerDown={(e) => e.stopPropagation()} onClick={() => navigate(`/processos/${p.id}`)}>{client?.name ?? "Sem cliente"}</button>
        <p className="muted text-xs">{group?.name}</p>
        <p className="text-xs">{type?.name}</p>
        {isStagnant(p) && <span className="chip bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"><Hourglass size={11} /> Estagnado</span>}
      </div>
      <div className="flex items-center justify-between border-t border-line pt-2 dark:border-white/5">
        <Avatar user={resp} size={22} />
        <div className="flex items-center">
          <button className="btn-icon h-7 w-7" aria-label="Adicionar tarefa" onClick={() => openModal({ kind: "task", preset: { processId: p.id, contactId: p.contactIds[0] } })}><CheckSquare size={14} /></button>
          <button className="btn-icon h-7 w-7" aria-label={`Documentos (${p.documents.length})`} onClick={() => navigate(`/processos/${p.id}#documentos`)}><FileText size={14} /></button>
          <button className="btn-icon relative h-7 w-7" aria-label={p.unreadHistory ? "Histórico (há novidades)" : "Histórico"} onClick={() => { patch("processes", p.id, { unreadHistory: false }); navigate(`/processos/${p.id}#historico`); }}>
            <History size={14} />
            {p.unreadHistory && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Column({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`min-h-[120px] flex-1 space-y-2 rounded-lg p-1 transition ${isOver ? "bg-primary-soft dark:bg-primary/10" : ""}`}>{children}</div>;
}

export default function Crm() {
  const { processes, contacts, users, settings, moveProcess, updateSettings } = useStore();
  const { openModal, showToast } = useUi();
  const [funnelId, setFunnelId] = useState(settings.funnels[0]?.id);
  const [resp, setResp] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [onlyStagnant, setOnlyStagnant] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const funnel = settings.funnels.find((f) => f.id === funnelId) ?? settings.funnels[0];
  const filtered = useMemo(
    () => processes
      .filter((p) => !resp.length || resp.includes(p.responsibleId))
      .filter((p) => !onlyStagnant || isStagnant(p))
      .filter((p) => !search || normalize(`${contacts.find((c) => c.id === p.contactIds[0])?.name} ${p.number} ${p.opposingParty}`).includes(normalize(search))),
    [processes, resp, search, contacts, onlyStagnant],
  );
  const inFunnel = filtered.filter((p) => p.funnelId === funnel.id);
  const receivedThisMonth = filtered.filter((p) => inMonth(p.createdAt));
  const stagnant = filtered.filter((p) => isStagnant(p));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const p = processes.find((x) => x.id === e.active.id);
    if (p && p.stageId !== e.over.id) {
      moveProcess(p.id, funnel.id, String(e.over.id));
      showToast(`Movido para ${funnel.stages.find((s) => s.id === e.over!.id)?.name}`);
    }
  };
  const setStages = (stages: typeof funnel.stages) => updateSettings({ funnels: settings.funnels.map((f) => (f.id === funnel.id ? { ...f, stages } : f)) });

  return (
    <>
      <PageHeader title="CRM" subtitle="Arraste os cartões entre as etapas para atualizar o andamento." actions={<button className="btn-primary" onClick={() => openModal({ kind: "process", preset: { funnelId: funnel.id } })}><Plus size={16} /> Novo processo</button>} />
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5"><Folder size={16} className="text-primary" /> <b className="tabular-nums">{inFunnel.length}</b> {inFunnel.length === 1 ? "Processo" : "Processos"}</span>
        <span className="flex items-center gap-1.5"><ArrowDownLeft size={16} className="text-green-600" /> <b className="tabular-nums">{receivedThisMonth.length}</b> Recebido(s) este mês</span>
        <span className="flex items-center gap-1.5"><DollarSign size={16} className="text-green-600" /> <b className="tabular-nums">{brl(inFunnel.reduce((s, p) => s + p.value, 0))}</b></span>
        <button className={`flex items-center gap-1.5 ${onlyStagnant ? "text-amber-600" : ""}`} onClick={() => setOnlyStagnant(!onlyStagnant)} aria-pressed={onlyStagnant}
          title="Estagnado: processo ativo sem movimentação há mais de 30 dias. Clique para filtrar.">
          <Hourglass size={16} className="text-amber-500" /> <b className="tabular-nums">{stagnant.length}</b> Estagnado(s) <span className="muted" aria-hidden>(?)</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <UserChipSelect users={users} value={resp} onChange={setResp} />
        <div className="flex-1">
          <DataTableToolbar search={search} onSearch={setSearch} onExport={() => exportCsv(`crm-${funnel.name}`, ["Cliente", "Grupo", "Tipo de ação", "Etapa", "Responsável", "Valor"],
            inFunnel.map((p) => [contacts.find((c) => c.id === p.contactIds[0])?.name ?? "", settings.actionGroups.find((g) => g.id === p.actionGroupId)?.name ?? "", settings.actionTypes.find((t) => t.id === p.actionTypeId)?.name ?? "", funnel.stages.find((s) => s.id === p.stageId)?.name ?? "", users.find((u) => u.id === p.responsibleId)?.name ?? "", p.value]))}
            filterContent={<label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={onlyStagnant} onChange={(e) => setOnlyStagnant(e.target.checked)} /> Só processos estagnados</label>}
            filterCount={onlyStagnant ? 1 : 0} onClearFilters={() => setOnlyStagnant(false)} />
        </div>
      </div>
      <Tabs value={funnel.id} onChange={setFunnelId} tabs={settings.funnels.map((f) => ({ id: f.id, label: `${f.name} (${filtered.filter((p) => p.funnelId === f.id).length})` }))} />

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          <div className="flex min-h-[420px] items-start gap-4">
            {funnel.stages.map((st) => {
              const items = inFunnel.filter((p) => p.stageId === st.id);
              return (
                <div key={st.id} className="card flex w-72 shrink-0 flex-col gap-2 p-3">
                  <div className="flex items-center justify-between gap-2 px-1">
                    {renaming === st.id ? (
                      <input autoFocus className="input py-1" defaultValue={st.name} aria-label="Nome da etapa"
                        onBlur={(e) => { setStages(funnel.stages.map((s) => (s.id === st.id ? { ...s, name: e.target.value || s.name } : s))); setRenaming(null); }}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
                    ) : (
                      <h3 className="truncate text-sm font-semibold">{st.name} <span className="muted ml-1 font-normal tabular-nums">{items.length}</span></h3>
                    )}
                    <Dropdown label={`Opções da etapa ${st.name}`} trigger={() => <button className="btn-icon h-7 w-7" aria-label={`Opções da etapa ${st.name}`}><MoreVertical size={16} /></button>}>
                      {(close) => (
                        <>
                          <MenuItem onClick={() => { openModal({ kind: "process", preset: { funnelId: funnel.id, stageId: st.id } }); close(); }}>Adicionar processo aqui</MenuItem>
                          <MenuItem onClick={() => { setRenaming(st.id); close(); }}>Renomear etapa</MenuItem>
                          <MenuItem danger onClick={() => {
                            close();
                            if (items.length) return showToast("Mova os processos antes de excluir a etapa");
                            setStages(funnel.stages.filter((s) => s.id !== st.id));
                          }}>Excluir etapa</MenuItem>
                        </>
                      )}
                    </Dropdown>
                  </div>
                  <Column id={st.id}>
                    {items.map((p) => <Card key={p.id} p={p} />)}
                    {!items.length && <p className="muted py-6 text-center text-xs">Arraste um cartão para cá</p>}
                  </Column>
                </div>
              );
            })}
            <button className="btn w-64 shrink-0 border-dashed" onClick={() => { const id = uid("st"); setStages([...funnel.stages, { id, name: "Nova etapa" }]); setRenaming(id); }}>
              <Plus size={16} /> Adicionar outra etapa
            </button>
          </div>
        </div>
      </DndContext>
    </>
  );
}
