import { format } from "date-fns";
import { useState } from "react";
import { fmtDate, uid } from "../../lib/format";
import { addBusinessDays } from "../../lib/prazos";
import { useCurrentUser, useStore } from "../../store/useStore";
import { useUi } from "../../store/ui";
import type { Task } from "../../types";
import { Field, Modal, Toggle } from "../ui/basics";
import { UserChipSelect } from "../ui/UserChipSelect";

const local = (iso?: string) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");

export function TaskModal({ task, preset }: { task?: Task; preset?: Partial<Task> }) {
  const { users, contacts, processes, settings, upsert, remove } = useStore();
  const me = useCurrentUser();
  const { closeModal, showToast } = useUi();
  const [t, setT] = useState<Task>(
    task ?? {
      id: uid("tk"), title: "", typeId: settings.taskTypes[0]?.id ?? "", responsibleIds: [me.id], date: new Date().toISOString(),
      priority: false, favorite: false, read: true, points: settings.taskTypes[0]?.points ?? 0, description: "", reminder: "1h",
      status: "pendente", createdAt: new Date().toISOString(), ...preset,
    },
  );
  const [calc, setCalc] = useState({ start: format(new Date(), "yyyy-MM-dd"), days: 15 });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (c: Partial<Task>) => setT((x) => ({ ...x, ...c }));

  const save = () => {
    if (!t.title.trim()) return showToast("Informe o título da tarefa");
    if (!t.responsibleIds.length) return showToast("Escolha ao menos um responsável");
    upsert("tasks", t);
    showToast(task ? "Tarefa atualizada" : "Tarefa criada");
    closeModal();
  };

  return (
    <Modal
      title={task ? "Editar tarefa" : "Nova tarefa"}
      onClose={closeModal}
      wide
      footer={
        <>
          {task && (
            <button className={`btn mr-auto ${confirmDelete ? "border-red-600 bg-red-600 text-white" : "text-red-600"}`} onClick={() => (confirmDelete ? (remove("tasks", task.id), closeModal(), showToast("Tarefa excluída")) : setConfirmDelete(true))}>
              {confirmDelete ? "Confirmar exclusão" : "Excluir"}
            </button>
          )}
          <button className="btn" onClick={closeModal}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar</button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título *" className="sm:col-span-2">{(id) => <input id={id} className="input" value={t.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Réplica à contestação" />}</Field>
        <Field label="Tipo">
          {(id) => (
            <select id={id} className="input" value={t.typeId} onChange={(e) => set({ typeId: e.target.value, points: settings.taskTypes.find((x) => x.id === e.target.value)?.points ?? t.points })}>
              {settings.taskTypes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Pontuação">{(id) => <input id={id} type="number" min={0} className="input" value={t.points} onChange={(e) => set({ points: +e.target.value })} />}</Field>
        <Field label="Cliente / partes">
          {(id) => (
            <select id={id} className="input" value={t.contactId ?? ""} onChange={(e) => set({ contactId: e.target.value || undefined })}>
              <option value="">Nenhum</option>
              {[...contacts].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Processo vinculado">
          {(id) => (
            <select id={id} className="input" value={t.processId ?? ""} onChange={(e) => { const p = processes.find((x) => x.id === e.target.value); set({ processId: e.target.value || undefined, contactId: t.contactId ?? p?.contactIds[0] }); }}>
              <option value="">Nenhum</option>
              {processes.map((p) => <option key={p.id} value={p.id}>{p.number} · {contacts.find((c) => c.id === p.contactIds[0])?.name}</option>)}
            </select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <span className="label">Responsáveis *</span>
          <UserChipSelect users={users.filter((u) => u.active)} value={t.responsibleIds} onChange={(ids) => set({ responsibleIds: ids })} placeholder="Nenhum responsável" />
        </div>
        <Field label="Data do compromisso">{(id) => <input id={id} type="datetime-local" className="input" value={local(t.date)} onChange={(e) => e.target.value && set({ date: new Date(e.target.value).toISOString() })} />}</Field>
        <Field label="Prazo fatal">{(id) => <input id={id} type="datetime-local" className="input" value={local(t.deadline)} onChange={(e) => set({ deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />}</Field>
        <div className="card flex flex-wrap items-end gap-3 sm:col-span-2">
          <Field label="Intimação em" className="min-w-[140px] flex-1">{(id) => <input id={id} type="date" className="input" value={calc.start} onChange={(e) => setCalc({ ...calc, start: e.target.value })} />}</Field>
          <Field label="Dias úteis" className="w-28">{(id) => <input id={id} type="number" min={1} className="input" value={calc.days} onChange={(e) => setCalc({ ...calc, days: +e.target.value })} />}</Field>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const d = addBusinessDays(calc.start, calc.days || 1);
              set({ deadline: new Date(`${d}T23:59`).toISOString() });
              showToast(`Prazo fatal: ${fmtDate(d)}`);
            }}
          >
            Calcular prazo fatal
          </button>
          <p className="muted w-full text-xs">Conta dias úteis do TJDFT: exclui fins de semana, feriados de 2026 e o recesso de 20/12 a 20/01 (CPC, arts. 219, 220 e 224).</p>
        </div>
        <div className="flex items-center gap-3">
          <Toggle checked={t.priority} onChange={(v) => set({ priority: v })} label="Prioridade" />
          <span className="text-sm">Prioridade alta</span>
        </div>
        <Field label="Lembrete">
          {(id) => (
            <select id={id} className="input" value={t.reminder} onChange={(e) => set({ reminder: e.target.value as Task["reminder"] })}>
              <option value="nenhum">Sem lembrete</option>
              <option value="15min">15 minutos antes</option>
              <option value="1h">1 hora antes</option>
              <option value="1d">1 dia antes</option>
            </select>
          )}
        </Field>
        <Field label="Descrição" className="sm:col-span-2">{(id) => <textarea id={id} rows={3} className="input" value={t.description} onChange={(e) => set({ description: e.target.value })} />}</Field>
      </div>
    </Modal>
  );
}
