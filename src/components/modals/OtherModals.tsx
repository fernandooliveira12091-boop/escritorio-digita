import { format } from "date-fns";
import { useState } from "react";
import { maskCNJ, maskDocument, maskPhone, uid } from "../../lib/format";
import { useCurrentUser, useStore } from "../../store/useStore";
import { useUi } from "../../store/ui";
import type { Contact, LegalProcess, Transaction, TransactionKind } from "../../types";
import { Field, Modal } from "../ui/basics";

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button className={`btn mr-auto ${armed ? "border-red-600 bg-red-600 text-white" : "text-red-600"}`} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? "Confirmar exclusão" : "Excluir"}
    </button>
  );
}

export function ContactModal({ id }: { id?: string }) {
  const { contacts, settings, upsert, remove } = useStore();
  const { closeModal, showToast } = useUi();
  const existing = contacts.find((c) => c.id === id);
  const [c, setC] = useState<Contact>(
    existing ?? { id: uid("c"), name: "", document: "", phone: "", email: "", birthDate: "", profession: "", address: "", city: "", origin: settings.origins[0] ?? "", createdAt: new Date().toISOString() },
  );
  const set = (x: Partial<Contact>) => setC((v) => ({ ...v, ...x }));
  const save = () => {
    if (!c.name.trim()) return showToast("Informe o nome do contato");
    upsert("contacts", c);
    showToast(existing ? "Contato atualizado" : "Contato cadastrado");
    closeModal();
  };
  return (
    <Modal
      title={existing ? "Editar contato" : "Novo contato"}
      onClose={closeModal}
      footer={
        <>
          {existing && <DeleteButton onConfirm={() => { remove("contacts", existing.id); closeModal(); showToast("Contato excluído"); }} />}
          <button className="btn" onClick={closeModal}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar</button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome *" className="sm:col-span-2">{(i) => <input id={i} className="input" value={c.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
        <Field label="CPF/CNPJ">{(i) => <input id={i} className="input" inputMode="numeric" value={c.document} onChange={(e) => set({ document: maskDocument(e.target.value) })} />}</Field>
        <Field label="Celular">{(i) => <input id={i} className="input" inputMode="tel" value={c.phone} onChange={(e) => set({ phone: maskPhone(e.target.value) })} placeholder="(61) 90000-0000" />}</Field>
        <Field label="E-mail">{(i) => <input id={i} type="email" className="input" value={c.email} onChange={(e) => set({ email: e.target.value })} />}</Field>
        <Field label="Data de nascimento">{(i) => <input id={i} type="date" className="input" value={c.birthDate} onChange={(e) => set({ birthDate: e.target.value })} />}</Field>
        <Field label="Profissão">{(i) => <input id={i} className="input" value={c.profession} onChange={(e) => set({ profession: e.target.value })} />}</Field>
        <Field label="Origem">
          {(i) => (
            <select id={i} className="input" value={c.origin} onChange={(e) => set({ origin: e.target.value })}>
              {settings.origins.map((o) => <option key={o}>{o}</option>)}
            </select>
          )}
        </Field>
        <Field label="Endereço" className="sm:col-span-2">{(i) => <input id={i} className="input" value={c.address} onChange={(e) => set({ address: e.target.value })} />}</Field>
        <Field label="Cidade/UF">{(i) => <input id={i} className="input" value={c.city} onChange={(e) => set({ city: e.target.value })} placeholder="Brasília/DF" />}</Field>
      </div>
    </Modal>
  );
}

export function ProcessModal({ id, preset }: { id?: string; preset?: { funnelId?: string; stageId?: string } }) {
  const { processes, contacts, users, partners, settings, upsert, remove } = useStore();
  const me = useCurrentUser();
  const { closeModal, showToast } = useUi();
  const existing = processes.find((p) => p.id === id);
  const firstFunnel = settings.funnels.find((f) => f.id === preset?.funnelId) ?? settings.funnels[0];
  const [p, setP] = useState<LegalProcess>(
    existing ?? {
      id: uid("pr"), number: "", contactIds: [], opposingParty: "", actionGroupId: settings.actionGroups[0]?.id ?? "", actionTypeId: settings.actionTypes[0]?.id ?? "",
      funnelId: firstFunnel.id, stageId: preset?.stageId ?? firstFunnel.stages[0]?.id ?? "", responsibleId: me.id, court: "TJDFT", value: 0, status: "ativo",
      createdAt: new Date().toISOString(), movements: [], documents: [], history: [{ id: uid("h"), date: new Date().toISOString(), text: "Processo cadastrado" }], unreadHistory: false,
    },
  );
  const set = (x: Partial<LegalProcess>) => setP((v) => ({ ...v, ...x }));
  const funnel = settings.funnels.find((f) => f.id === p.funnelId);
  const save = () => {
    if (!p.contactIds.length) return showToast("Escolha o cliente");
    upsert("processes", { ...p, needsReview: p.contactIds.length ? false : p.needsReview });
    showToast(existing ? "Processo atualizado" : "Processo cadastrado");
    closeModal();
  };
  return (
    <Modal
      title={existing ? "Editar processo" : "Novo processo"}
      onClose={closeModal}
      wide
      footer={
        <>
          {existing && <DeleteButton onConfirm={() => { remove("processes", existing.id); closeModal(); showToast("Processo excluído"); }} />}
          <button className="btn" onClick={closeModal}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar</button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente *">
          {(i) => (
            <select id={i} className="input" value={p.contactIds[0] ?? ""} onChange={(e) => set({ contactIds: e.target.value ? [e.target.value] : [] })}>
              <option value="">Escolha…</option>
              {[...contacts].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Parte contrária">{(i) => <input id={i} className="input" value={p.opposingParty} onChange={(e) => set({ opposingParty: e.target.value })} />}</Field>
        <Field label="Número do processo (CNJ)">{(i) => <input id={i} className="input tabular-nums" inputMode="numeric" placeholder="0000000-00.0000.0.00.0000" value={p.number} onChange={(e) => set({ number: maskCNJ(e.target.value) })} />}</Field>
        <Field label="Tribunal">{(i) => <input id={i} className="input" value={p.court} onChange={(e) => set({ court: e.target.value })} />}</Field>
        <Field label="Grupo de ação">
          {(i) => (
            <select id={i} className="input" value={p.actionGroupId} onChange={(e) => set({ actionGroupId: e.target.value, actionTypeId: settings.actionTypes.find((a) => a.groupId === e.target.value)?.id ?? "" })}>
              {settings.actionGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Tipo de ação">
          {(i) => (
            <select id={i} className="input" value={p.actionTypeId} onChange={(e) => set({ actionTypeId: e.target.value })}>
              {settings.actionTypes.filter((a) => a.groupId === p.actionGroupId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Fase (funil)">
          {(i) => (
            <select id={i} className="input" value={p.funnelId} onChange={(e) => set({ funnelId: e.target.value, stageId: settings.funnels.find((f) => f.id === e.target.value)?.stages[0]?.id ?? "" })}>
              {settings.funnels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Etapa">
          {(i) => (
            <select id={i} className="input" value={p.stageId} onChange={(e) => set({ stageId: e.target.value })}>
              {funnel?.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Responsável">
          {(i) => (
            <select id={i} className="input" value={p.responsibleId} onChange={(e) => set({ responsibleId: e.target.value })}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Parceiro">
          {(i) => (
            <select id={i} className="input" value={p.partnerId ?? ""} onChange={(e) => set({ partnerId: e.target.value || undefined })}>
              <option value="">Nenhum</option>
              {partners.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Valor da causa (R$)">{(i) => <input id={i} type="number" min={0} step="0.01" className="input" value={p.value} onChange={(e) => set({ value: +e.target.value })} />}</Field>
        <Field label="Situação">
          {(i) => (
            <select id={i} className="input" value={p.status} onChange={(e) => {
              const status = e.target.value as LegalProcess["status"];
              const nowIso = new Date().toISOString();
              set({ status, closedAt: status === "fechado" ? p.closedAt ?? nowIso : p.closedAt, archivedAt: status === "arquivado" ? p.archivedAt ?? nowIso : p.archivedAt });
            }}>
              <option value="ativo">Ativo</option>
              <option value="fechado">Fechado (contrato assinado)</option>
              <option value="arquivado">Arquivado</option>
            </select>
          )}
        </Field>
        <Field label="Resultado">
          {(i) => (
            <select id={i} className="input" value={p.outcome ?? ""} onChange={(e) => set({ outcome: (e.target.value || undefined) as LegalProcess["outcome"] })}>
              <option value="">Em andamento</option>
              <option value="ganho">Ganho</option>
              <option value="perdido">Perdido</option>
            </select>
          )}
        </Field>
        <Field label="Data de ajuizamento">{(i) => <input id={i} type="date" className="input" value={p.filedAt ? format(new Date(p.filedAt), "yyyy-MM-dd") : ""} onChange={(e) => set({ filedAt: e.target.value ? new Date(`${e.target.value}T12:00`).toISOString() : undefined })} />}</Field>
      </div>
    </Modal>
  );
}

export function TransactionModal({ id, txKind }: { id?: string; txKind?: TransactionKind }) {
  const { transactions, accounts, contacts, settings, upsert, remove } = useStore();
  const { closeModal, showToast } = useUi();
  const existing = transactions.find((t) => t.id === id);
  const kind0 = existing?.kind ?? txKind ?? "receita";
  const today = format(new Date(), "yyyy-MM-dd");
  const [t, setT] = useState<Transaction>(
    existing ?? {
      id: uid("tx"), kind: kind0, description: "", category: kind0 === "transferencia" ? "Transferência" : settings.categories[kind0 === "despesa" ? "despesa" : "receita"][0],
      value: 0, dueDate: today, competence: today.slice(0, 7), accountId: accounts[0]?.id ?? "", toAccountId: kind0 === "transferencia" ? accounts[1]?.id : undefined,
      paidDate: kind0 === "transferencia" ? today : undefined,
    },
  );
  const set = (x: Partial<Transaction>) => setT((v) => ({ ...v, ...x }));
  const label = t.kind === "receita" ? "receita" : t.kind === "despesa" ? "despesa" : "transferência";
  const save = () => {
    if (!t.description.trim() && t.kind !== "transferencia") return showToast("Informe a descrição");
    if (!(t.value > 0)) return showToast("Informe um valor maior que zero");
    if (t.kind === "transferencia" && t.accountId === t.toAccountId) return showToast("Escolha contas diferentes");
    upsert("transactions", { ...t, description: t.description || "Transferência entre contas" });
    showToast(existing ? "Lançamento atualizado" : `${label[0].toUpperCase() + label.slice(1)} lançada`);
    closeModal();
  };
  return (
    <Modal
      title={existing ? `Editar ${label}` : `Nova ${label}`}
      onClose={closeModal}
      footer={
        <>
          {existing && <DeleteButton onConfirm={() => { remove("transactions", existing.id); closeModal(); showToast("Lançamento excluído"); }} />}
          <button className="btn" onClick={closeModal}>Cancelar</button>
          <button className={t.kind === "despesa" ? "btn border-red-600 bg-red-600 text-white hover:bg-red-700" : t.kind === "receita" ? "btn border-green-600 bg-green-600 text-white hover:bg-green-700" : "btn-primary"} onClick={save}>Salvar</button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!existing && (
          <Field label="Tipo" className="sm:col-span-2">
            {(i) => (
              <select id={i} className="input" value={t.kind} onChange={(e) => {
                const k = e.target.value as TransactionKind;
                set({ kind: k, category: k === "transferencia" ? "Transferência" : settings.categories[k][0], toAccountId: k === "transferencia" ? accounts.find((a) => a.id !== t.accountId)?.id : undefined });
              }}>
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
                <option value="transferencia">Transferência</option>
              </select>
            )}
          </Field>
        )}
        <Field label="Descrição" className="sm:col-span-2">{(i) => <input id={i} className="input" value={t.description} onChange={(e) => set({ description: e.target.value })} />}</Field>
        <Field label="Valor (R$) *">{(i) => <input id={i} type="number" min={0} step="0.01" className="input" value={t.value || ""} onChange={(e) => set({ value: +e.target.value })} />}</Field>
        {t.kind !== "transferencia" ? (
          <Field label="Categoria">
            {(i) => (
              <select id={i} className="input" value={t.category} onChange={(e) => set({ category: e.target.value })}>
                {settings.categories[t.kind as "receita" | "despesa"].map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
          </Field>
        ) : <div />}
        <Field label={t.kind === "transferencia" ? "Conta de origem" : "Conta"}>
          {(i) => (
            <select id={i} className="input" value={t.accountId} onChange={(e) => set({ accountId: e.target.value })}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </Field>
        {t.kind === "transferencia" ? (
          <Field label="Conta de destino">
            {(i) => (
              <select id={i} className="input" value={t.toAccountId} onChange={(e) => set({ toAccountId: e.target.value })}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </Field>
        ) : (
          <Field label="Cliente">
            {(i) => (
              <select id={i} className="input" value={t.contactId ?? ""} onChange={(e) => set({ contactId: e.target.value || undefined })}>
                <option value="">Nenhum</option>
                {[...contacts].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </Field>
        )}
        <Field label="Vencimento">{(i) => <input id={i} type="date" className="input" value={t.dueDate} onChange={(e) => set({ dueDate: e.target.value, competence: t.competence || e.target.value.slice(0, 7) })} />}</Field>
        <Field label="Competência">{(i) => <input id={i} type="month" className="input" value={t.competence} onChange={(e) => set({ competence: e.target.value })} />}</Field>
        <Field label="Pagamento (deixe vazio se ainda não foi pago)" className="sm:col-span-2">{(i) => <input id={i} type="date" className="input" value={t.paidDate ?? ""} onChange={(e) => set({ paidDate: e.target.value || undefined })} />}</Field>
      </div>
    </Modal>
  );
}
