import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { format } from "date-fns";
import { ClipboardPaste, Plus, ShieldAlert } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Avatar, Field, Modal, PageHeader } from "../components/ui/basics";
import { DataTableToolbar } from "../components/ui/DataTable";
import { KpiCard } from "../components/ui/KpiCard";
import { titleCase } from "../lib/clients";
import { parseContractsSheet, type ParsedSheet } from "../lib/contractsImport";
import { exportCsv } from "../lib/files";
import { brl, fmtDate, maskDocument, normalize, uid } from "../lib/format";
import { buildInstallments } from "../lib/installments";
import { inMonth } from "../lib/rules";
import { useUi } from "../store/ui";
import { useCurrentUser, useStore } from "../store/useStore";
import type { Contact, Contract, ContractStage, Transaction } from "../types";

const STAGES: { id: ContractStage; label: string; tone: string }[] = [
  { id: "negociacao", label: "Em negociação", tone: "border-t-sky-400" },
  { id: "proposta", label: "Proposta enviada", tone: "border-t-indigo-400" },
  { id: "assinatura", label: "Aguardando assinatura", tone: "border-t-amber-400" },
  { id: "fechado", label: "Contrato fechado", tone: "border-t-green-500" },
  { id: "perdido", label: "Perdido", tone: "border-t-gray-400" },
];
const OPEN: ContractStage[] = ["negociacao", "proposta", "assinatura"];
const AREAS = ["Previdenciário", "Família", "Cível", "Consumidor", "Trabalhista", "Outra"];

function ContractCard({ c, onOpen }: { c: Contract; onOpen: () => void }) {
  const { contacts, users } = useStore();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const client = contacts.find((x) => x.id === c.contactId);
  return (
    <div ref={setNodeRef} style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`surface space-y-1.5 p-3 shadow-sm ${isDragging ? "z-50 opacity-90 shadow-lg ring-2 ring-primary" : ""}`}>
      <div {...listeners} {...attributes} className="cursor-grab space-y-1 active:cursor-grabbing" aria-roledescription="cartão arrastável" aria-label={`Contrato de ${client?.name}. Arraste para mudar de etapa`}>
        <button className="block text-left text-sm font-semibold hover:text-primary" onPointerDown={(e) => e.stopPropagation()} onClick={onOpen}>{client?.name ?? "Cliente"}</button>
        <p className="muted text-xs">{c.title || "Sem tipo de ação"}{client?.document ? ` · ${client.document}` : ""}</p>
        <div className="flex flex-wrap gap-1 pt-0.5">
          {c.value > 0 && <span className="chip bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400">{brl(c.value)}{c.installments > 1 ? ` em ${c.installments}x` : ""}</span>}
          {c.eventDate && <span className="chip bg-card dark:bg-white/10">{c.eventLabel || "Data"}: {fmtDate(c.eventDate)}</span>}
          {c.needsContribution === true && <span className="chip bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Precisa de contribuição</span>}
          {c.partnerValue > 0 && <span className="chip bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">Parceria {brl(c.partnerValue)}</span>}
          {c.stage === "fechado" && !c.financeLaunched && c.value > 0 && <span className="chip bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300">Lançar no financeiro</span>}
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <Avatar user={users.find((u) => u.id === c.responsibleId)} size={20} />
        <span className="muted text-[11px]">{c.signedAt ? `assinado ${fmtDate(c.signedAt)}` : `atualizado ${fmtDate(c.updatedAt)}`}</span>
      </div>
    </div>
  );
}

function Column({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`min-h-[140px] flex-1 space-y-2 rounded-lg p-1 transition ${isOver ? "bg-primary-soft dark:bg-primary/10" : ""}`}>{children}</div>;
}

/** Lança os honorários no Financeiro (receita parcelada) e, se houver, a parceria como despesa. */
function launchFinance(c: Contract, client: Contact | undefined, accountId: string) {
  const s = useStore.getState();
  const base: Transaction = {
    id: uid("tx"), kind: "receita", description: `Honorários - ${c.title || "contrato"} - ${client?.name ?? ""}`.trim(), category: "Honorários contratuais",
    value: c.value, dueDate: c.firstDueDate || format(new Date(), "yyyy-MM-dd"), competence: (c.firstDueDate || format(new Date(), "yyyy-MM-dd")).slice(0, 7), accountId, contactId: c.contactId, processId: c.processId,
  };
  const txs: Transaction[] = c.installments > 1 ? buildInstallments(base, { count: c.installments, valueMode: "total" }) : [base];
  if (c.partnerValue > 0) {
    txs.push({ id: uid("tx"), kind: "despesa", description: `Parceria (indicação) - ${client?.name ?? ""}`, category: "Outras despesas", value: c.partnerValue, dueDate: base.dueDate, competence: base.competence, accountId, contactId: c.contactId });
  }
  txs.forEach((t) => s.upsert("transactions", t));
  return txs.length;
}

export default function Contratos() {
  const { contracts, contacts, users, partners, processes, accounts, upsert, remove } = useStore();
  const me = useCurrentUser();
  const showToast = useUi((s) => s.showToast);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Contract | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const name = (c: Contract) => contacts.find((x) => x.id === c.contactId)?.name ?? "";
  const list = useMemo(() => contracts.filter((c) => !search || normalize(`${name(c)} ${c.title} ${contacts.find((x) => x.id === c.contactId)?.document ?? ""}`).includes(normalize(search))),
    [contracts, contacts, search]);
  const open = contracts.filter((c) => OPEN.includes(c.stage));
  const closedMonth = contracts.filter((c) => c.stage === "fechado" && inMonth(c.signedAt));
  const partnerDue = contracts.filter((c) => c.stage === "fechado").reduce((s, c) => s + c.partnerValue, 0);
  const sum = (l: Contract[]) => l.reduce((s, c) => s + c.value, 0);

  const move = (c: Contract, stage: ContractStage) => {
    if (c.stage === stage) return;
    upsert("contracts", { ...c, stage, signedAt: stage === "fechado" ? c.signedAt ?? new Date().toISOString() : stage === "perdido" ? c.signedAt : undefined, updatedAt: new Date().toISOString() });
    if (stage === "fechado") showToast(c.value > 0 && !c.financeLaunched ? "Contrato fechado. Abra o card para lançar os honorários no Financeiro." : "Contrato fechado");
  };
  const onDragEnd = (e: DragEndEvent) => {
    const c = contracts.find((x) => x.id === e.active.id);
    if (c && e.over) move(c, e.over.id as ContractStage);
  };
  const blank = (): Contract => ({
    id: uid("ct"), contactId: "", title: "", area: "Previdenciário", stage: "negociacao", value: 0, installments: 1, firstDueDate: format(new Date(), "yyyy-MM-dd"),
    partnerValue: 0, eventDate: "", eventLabel: "", needsContribution: null, responsibleId: me.id, notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });

  return (
    <>
      <PageHeader
        title="Contratos"
        subtitle="Contratos de honorários da negociação até a assinatura. Arraste os cards entre as etapas."
        actions={<button className="btn-primary" onClick={() => setForm(blank())}><Plus size={16} /> Novo contrato</button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Em negociação" value={open.length} subtitle={`${brl(sum(open))} em honorários`} />
        <KpiCard title="Fechados no mês" value={closedMonth.length} tone={closedMonth.length ? "success" : "default"} subtitle={brl(sum(closedMonth))} />
        <KpiCard title="Total fechado" value={contracts.filter((c) => c.stage === "fechado").length} subtitle={brl(sum(contracts.filter((c) => c.stage === "fechado")))} />
        <KpiCard title="Parcerias (contratos fechados)" value={brl(partnerDue)} subtitle="valores de indicação" />
      </div>
      <DataTableToolbar
        search={search}
        onSearch={setSearch}
        onExport={() => exportCsv("contratos", ["Cliente", "CPF", "Tipo de ação", "Etapa", "Honorários", "Parcelas", "Parceria", "Data importante", "Precisa de contribuição", "Assinado em"],
          list.map((c) => { const cl = contacts.find((x) => x.id === c.contactId); return [cl?.name ?? "", cl?.document ?? "", c.title, STAGES.find((s) => s.id === c.stage)?.label ?? "", c.value, c.installments, c.partnerValue, c.eventDate ? `${c.eventLabel} ${fmtDate(c.eventDate)}` : "", c.needsContribution === null ? "" : c.needsContribution ? "sim" : "não", fmtDate(c.signedAt)]; }))}
        extra={<button className="btn" onClick={() => setImportOpen(true)}><ClipboardPaste size={16} /> Colar planilha</button>}
      />

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          <div className="flex min-h-[420px] items-start gap-4">
            {STAGES.map((st) => {
              const items = list.filter((c) => c.stage === st.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
              return (
                <div key={st.id} className={`card flex w-72 shrink-0 flex-col gap-2 border-t-4 p-3 ${st.tone}`}>
                  <div className="flex items-baseline justify-between px-1">
                    <h2 className="text-sm font-semibold">{st.label} <span className="muted font-normal tabular-nums">{items.length}</span></h2>
                    <span className="muted text-xs tabular-nums">{brl(sum(items))}</span>
                  </div>
                  <Column id={st.id}>
                    {items.map((c) => <ContractCard key={c.id} c={c} onOpen={() => setForm(c)} />)}
                    {!items.length && <p className="muted py-6 text-center text-xs">Arraste um card para cá</p>}
                  </Column>
                  {st.id === "negociacao" && <button className="btn border-dashed text-xs" onClick={() => setForm(blank())}><Plus size={14} /> Novo contrato</button>}
                </div>
              );
            })}
          </div>
        </div>
      </DndContext>

      {form && <ContractModal key={form.id} initial={form} onClose={() => setForm(null)} isNew={!contracts.some((c) => c.id === form.id)}
        onSave={(c, launch) => {
          const finalStage = c.stage;
          const saved: Contract = { ...c, signedAt: finalStage === "fechado" ? c.signedAt ?? new Date().toISOString() : finalStage === "perdido" ? c.signedAt : undefined, updatedAt: new Date().toISOString() };
          if (launch) {
            const n = launchFinance(saved, contacts.find((x) => x.id === saved.contactId), accounts[0]?.id ?? "");
            saved.financeLaunched = true;
            showToast(`Contrato salvo e ${n} lançamento(s) criado(s) no Financeiro`);
          } else showToast("Contrato salvo");
          upsert("contracts", saved);
          setForm(null);
        }}
        onDelete={(id) => { remove("contracts", id); setForm(null); showToast("Contrato excluído"); }}
        users={users} partners={partners} processes={processes} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </>
  );
}

function ContractModal({ initial, isNew, onClose, onSave, onDelete, users, partners, processes }: {
  initial: Contract; isNew: boolean; onClose: () => void; onSave: (c: Contract, launchFinance: boolean) => void; onDelete: (id: string) => void;
  users: ReturnType<typeof useStore.getState>["users"]; partners: ReturnType<typeof useStore.getState>["partners"]; processes: ReturnType<typeof useStore.getState>["processes"];
}) {
  const { contacts, upsert } = useStore();
  const showToast = useUi((s) => s.showToast);
  const [c, setC] = useState(initial);
  const [newClient, setNewClient] = useState({ name: "", document: "" });
  const [launch, setLaunch] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (x: Partial<Contract>) => setC((v) => ({ ...v, ...x }));
  const canLaunch = c.stage === "fechado" && !c.financeLaunched && c.value > 0;

  const save = () => {
    let contactId = c.contactId;
    if (contactId === "__novo") {
      if (!newClient.name.trim()) return showToast("Informe o nome do cliente");
      const ct: Contact = { id: uid("c"), name: titleCase(newClient.name), document: newClient.document, phone: "", email: "", birthDate: "", profession: "", address: "", city: "", origin: "Contratos", createdAt: new Date().toISOString() };
      upsert("contacts", ct);
      contactId = ct.id;
    }
    if (!contactId) return showToast("Escolha o cliente");
    onSave({ ...c, contactId }, launch && canLaunch);
  };

  return (
    <Modal title={isNew ? "Novo contrato" : "Contrato"} onClose={onClose} wide footer={
      <>
        {!isNew && <button className={`btn mr-auto ${confirmDel ? "border-red-600 bg-red-600 text-white" : "text-red-600"}`} onClick={() => (confirmDel ? onDelete(c.id) : setConfirmDel(true))}>{confirmDel ? "Confirmar exclusão" : "Excluir"}</button>}
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={save}>Salvar</button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente *">
          {(id) => (
            <select id={id} className="input" value={c.contactId} onChange={(e) => set({ contactId: e.target.value })}>
              <option value="">Escolha…</option>
              <option value="__novo">+ Cadastrar cliente novo</option>
              {[...contacts].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((x) => <option key={x.id} value={x.id}>{x.name}{x.document ? ` · ${x.document}` : ""}</option>)}
            </select>
          )}
        </Field>
        <Field label="Etapa">{(id) => <select id={id} className="input" value={c.stage} onChange={(e) => set({ stage: e.target.value as ContractStage })}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>}</Field>
        {c.contactId === "__novo" && (
          <>
            <Field label="Nome do cliente novo">{(id) => <input id={id} className="input" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />}</Field>
            <Field label="CPF">{(id) => <input id={id} className="input" inputMode="numeric" value={newClient.document} onChange={(e) => setNewClient({ ...newClient, document: maskDocument(e.target.value) })} />}</Field>
          </>
        )}
        <Field label="Tipo de ação ou serviço">{(id) => <input id={id} className="input" list="tipos-contrato" placeholder="Ex.: Salário-maternidade" value={c.title} onChange={(e) => set({ title: e.target.value })} />}</Field>
        <datalist id="tipos-contrato">{["Salário-maternidade", "BPC/LOAS", "Aposentadoria por idade", "Auxílio por incapacidade", "Pensão por morte", "Divórcio consensual", "Alimentos", "Inventário", "Indenização"].map((t) => <option key={t} value={t} />)}</datalist>
        <Field label="Área">{(id) => <select id={id} className="input" value={c.area} onChange={(e) => set({ area: e.target.value })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>}</Field>
        <Field label="Honorários (valor total, R$)">{(id) => <input id={id} type="number" min={0} step="0.01" className="input" value={c.value || ""} onChange={(e) => set({ value: +e.target.value })} />}</Field>
        <Field label="Parcelas">{(id) => <input id={id} type="number" min={1} max={60} className="input" value={c.installments} onChange={(e) => set({ installments: Math.max(1, Math.min(60, +e.target.value || 1)) })} />}</Field>
        <Field label="Vencimento da 1ª parcela">{(id) => <input id={id} type="date" className="input" value={c.firstDueDate} onChange={(e) => set({ firstDueDate: e.target.value })} />}</Field>
        <Field label="Valor da parceria / indicação (R$)">{(id) => <input id={id} type="number" min={0} step="0.01" className="input" value={c.partnerValue || ""} onChange={(e) => set({ partnerValue: +e.target.value })} />}</Field>
        <Field label="Parceiro (opcional)">{(id) => <select id={id} className="input" value={c.partnerId ?? ""} onChange={(e) => set({ partnerId: e.target.value || undefined })}><option value="">Nenhum</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}</Field>
        <Field label="Data importante (nome)">{(id) => <input id={id} className="input" list="rotulos-data" placeholder="Ex.: Data do parto" value={c.eventLabel} onChange={(e) => set({ eventLabel: e.target.value })} />}</Field>
        <datalist id="rotulos-data">{["Data do parto", "Data do requerimento (DER)", "Data da audiência", "Data do óbito"].map((t) => <option key={t} value={t} />)}</datalist>
        <Field label="Data">{(id) => <input id={id} type="date" className="input" value={c.eventDate} onChange={(e) => set({ eventDate: e.target.value })} />}</Field>
        <Field label="Precisa de contribuição?">{(id) => <select id={id} className="input" value={c.needsContribution === null ? "" : c.needsContribution ? "sim" : "nao"} onChange={(e) => set({ needsContribution: e.target.value === "" ? null : e.target.value === "sim" })}><option value="">Não informado</option><option value="sim">Sim</option><option value="nao">Não</option></select>}</Field>
        <Field label="Responsável">{(id) => <select id={id} className="input" value={c.responsibleId} onChange={(e) => set({ responsibleId: e.target.value })}>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}</Field>
        <Field label="Processo vinculado (opcional)">{(id) => <select id={id} className="input" value={c.processId ?? ""} onChange={(e) => set({ processId: e.target.value || undefined })}><option value="">Nenhum</option>{processes.filter((p) => !c.contactId || p.contactIds.includes(c.contactId)).map((p) => <option key={p.id} value={p.id}>{p.number || "Sem número"} · {p.court}</option>)}</select>}</Field>
        {c.stage === "perdido" && <Field label="Motivo da perda" className="sm:col-span-2">{(id) => <input id={id} className="input" value={c.lostReason ?? ""} onChange={(e) => set({ lostReason: e.target.value })} />}</Field>}
        <Field label="Observações" className="sm:col-span-2">{(id) => <textarea id={id} rows={2} className="input" value={c.notes} onChange={(e) => set({ notes: e.target.value })} />}</Field>
        {canLaunch && (
          <label className="card flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={launch} onChange={(e) => setLaunch(e.target.checked)} />
            <span>Lançar no <b>Financeiro</b> ao salvar: {c.installments > 1 ? `${c.installments} parcelas de honorários` : "honorários"} a partir de {fmtDate(c.firstDueDate)}{c.partnerValue > 0 ? ` e a parceria de ${brl(c.partnerValue)} como despesa` : ""}.</span>
          </label>
        )}
        {c.financeLaunched && <p className="muted text-xs sm:col-span-2">Honorários já lançados no Financeiro. <Link className="link" to="/financeiro">Abrir Financeiro</Link></p>}
      </div>
    </Modal>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const { contacts, upsert } = useStore();
  const me = useCurrentUser();
  const showToast = useUi((s) => s.showToast);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("Previdenciário");

  const read = (t: string) => {
    setText(t);
    const p = t.trim() ? parseContractsSheet(t) : null;
    setParsed(p);
    if (p && !title && /parto/i.test(p.eventLabel)) setTitle("Salário-maternidade");
  };
  const doImport = () => {
    if (!parsed?.rows.length) return;
    const created: Contact[] = [];
    let n = 0;
    for (const r of parsed.rows) {
      const doc = r.document.replace(/\D/g, "");
      let client = [...contacts, ...created].find((c) => (doc && c.document.replace(/\D/g, "") === doc) || normalize(c.name) === normalize(r.name));
      if (!client) {
        client = { id: uid("c"), name: titleCase(r.name), document: r.document ? maskDocument(r.document) : "", phone: r.phone, email: "", birthDate: "", profession: "", address: "", city: "", origin: "Planilha de contratos", createdAt: new Date().toISOString() };
        created.push(client);
        upsert("contacts", client);
      }
      const now = new Date().toISOString();
      upsert("contracts", {
        id: uid("ct"), contactId: client.id, title: r.title || title, area, stage: r.signed === true ? "fechado" : r.signed === false ? "negociacao" : "negociacao",
        value: r.value, installments: 1, firstDueDate: format(new Date(), "yyyy-MM-dd"), partnerValue: r.partnerValue, eventDate: r.eventDate, eventLabel: r.eventDate ? parsed.eventLabel : "",
        needsContribution: r.needsContribution, responsibleId: me.id, notes: r.notes, signedAt: r.signed ? now : undefined, createdAt: now, updatedAt: now,
      } satisfies Contract);
      n++;
    }
    showToast(`${n} contrato(s) importado(s)${created.length ? `, ${created.length} cliente(s) novo(s) em Contatos` : ""}`);
    onClose();
  };

  return (
    <Modal title="Colar planilha de contratos" onClose={onClose} wide footer={
      <>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={!parsed?.rows.length} onClick={doImport}>Importar {parsed?.rows.length || ""} contrato(s)</button>
      </>
    }>
      <div className="space-y-4">
        <p className="text-sm">No Excel, selecione a tabela <b>com a linha de títulos</b> (Cliente, CPF, Contrato assinado, Data do parto, Precisa de contribuição, Valor pago da parceria, Honorário), copie (Ctrl+C) e cole abaixo (Ctrl+V).</p>
        <label className="block"><span className="sr-only">Planilha colada</span><textarea rows={6} className="input font-mono text-xs" placeholder="Cole aqui" value={text} onChange={(e) => read(e.target.value)} /></label>
        {parsed && (
          <>
            {parsed.ignoredSecretColumns.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <ShieldAlert size={18} className="shrink-0" />
                A coluna “{parsed.ignoredSecretColumns.join(", ")}” foi descartada: senhas não são guardadas no sistema. Recomendo apagá-la também da planilha.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo de ação (para linhas sem essa coluna)">{(id) => <input id={id} className="input" placeholder="Ex.: Salário-maternidade" value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
              <Field label="Área">{(id) => <select id={id} className="input" value={area} onChange={(e) => setArea(e.target.value)}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>}</Field>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead><tr className="border-b border-line dark:border-white/10">{["Cliente", "CPF", "Etapa", parsed.eventLabel || "Data", "Contribuição", "Parceria", "Honorários"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody>
                  {parsed.rows.map((r, i) => (
                    <tr key={i} className="border-b border-line dark:border-white/5">
                      <td className="td">{titleCase(r.name)}</td><td className="td tabular-nums">{r.document}</td>
                      <td className="td">{r.signed ? "Contrato fechado" : "Em negociação"}</td><td className="td tabular-nums">{fmtDate(r.eventDate)}</td>
                      <td className="td">{r.needsContribution === null ? "—" : r.needsContribution ? "Sim" : "Não"}</td>
                      <td className="td tabular-nums">{r.partnerValue ? brl(r.partnerValue) : "—"}</td><td className="td tabular-nums">{r.value ? brl(r.value) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!parsed.rows.length && <p className="text-sm text-red-600">Não encontrei linhas com cliente. Confira se a primeira linha colada tem os títulos das colunas.</p>}
            {parsed.unknownColumns.length > 0 && <p className="muted text-xs">Colunas não usadas: {parsed.unknownColumns.join(", ")}.</p>}
            <p className="muted text-xs">Clientes que já existem (mesmo CPF ou nome) são reaproveitados; os outros são cadastrados em Contatos.</p>
          </>
        )}
      </div>
    </Modal>
  );
}
