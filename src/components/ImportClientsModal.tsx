import { useMemo, useState } from "react";
import { findContactByName, partiesOfProcess, poloLabel, suggestClient, titleCase } from "../lib/clients";
import { normalize, uid } from "../lib/format";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { Contact, LegalProcess } from "../types";
import { EmptyState, Modal } from "./ui/basics";

const ORIGIN = "Processos (DJEN)";
const SKIP = "__pular";
const OTHER = "__outro";

/** Processos ainda sem cliente vinculado. */
export const processesWithoutClient = (processes: LegalProcess[]) => processes.filter((p) => !p.contactIds.length);

/**
 * Cadastra clientes a partir das partes dos processos (vindas do DJEN) e já vincula
 * cada cliente ao processo. O DJEN não diz qual parte é o cliente: o sistema sugere
 * e o advogado confirma.
 */
export function ImportClientsModal({ onClose }: { onClose: () => void }) {
  const { processes, intimations, contacts, settings, upsert, updateSettings } = useStore();
  const showToast = useUi((s) => s.showToast);

  const rows = useMemo(
    () => processesWithoutClient(processes)
      .map((p) => ({ p, parties: partiesOfProcess(p, intimations) }))
      .sort((a, b) => Number(!!b.p.needsReview) - Number(!!a.p.needsReview) || b.p.createdAt.localeCompare(a.p.createdAt)),
    [], // calculada ao abrir: não muda enquanto o advogado escolhe

  );
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map(({ p, parties }) => [p.id, suggestClient(parties, contacts) ?? SKIP])),
  );
  const [other, setOther] = useState<Record<string, string>>({});

  const chosenName = (id: string) => (choice[id] === OTHER ? (other[id] ?? "").trim() : choice[id] === SKIP ? "" : choice[id]);
  const selected = rows.filter(({ p }) => chosenName(p.id));
  const newNames = new Set(selected.map(({ p }) => normalize(chosenName(p.id))).filter((n) => !contacts.some((c) => normalize(c.name) === n)));

  const save = () => {
    const created: Contact[] = [];
    const contactFor = (name: string) => {
      const found = findContactByName([...contacts, ...created], name);
      if (found) return found;
      const c: Contact = { id: uid("c"), name: titleCase(name), document: "", phone: "", email: "", birthDate: "", profession: "", address: "", city: "", origin: ORIGIN, createdAt: new Date().toISOString() };
      created.push(c);
      return c;
    };
    for (const { p, parties } of selected) {
      const name = chosenName(p.id);
      const client = contactFor(name);
      const mine = parties.find((x) => normalize(x.nome) === normalize(name));
      // Parte contrária: o outro polo; sem polo conhecido, as demais partes.
      const others = parties.filter((x) => normalize(x.nome) !== normalize(name) && (!mine?.polo || !x.polo || x.polo !== mine.polo));
      const opposing = p.opposingParty || others.map((x) => titleCase(x.nome)).slice(0, 3).join(", ") + (others.length > 3 ? " e outros" : "");
      upsert("processes", {
        ...p,
        contactIds: [client.id],
        opposingParty: opposing,
        needsReview: false,
        history: [...p.history, { id: uid("h"), date: new Date().toISOString(), text: `Cliente vinculado: ${client.name}` }],
      });
    }
    created.forEach((c) => upsert("contacts", c));
    if (created.length && !settings.origins.includes(ORIGIN)) updateSettings({ origins: [...settings.origins, ORIGIN] });
    showToast(`${selected.length} processo(s) vinculados${created.length ? `, ${created.length} cliente(s) novo(s). Complete CPF e telefone em Contatos` : ""}.`);
    onClose();
  };

  return (
    <Modal
      title="Cadastrar clientes a partir dos processos"
      onClose={onClose}
      wide
      footer={
        <>
          <span className="muted mr-auto self-center text-sm">
            {selected.length} processo(s) · {newNames.size} cliente(s) novo(s)
          </span>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={!selected.length} onClick={save}>Cadastrar e vincular</button>
        </>
      }
    >
      {rows.length === 0 ? (
        <EmptyState>Todos os processos já têm cliente vinculado.</EmptyState>
      ) : (
        <div className="space-y-4">
          <p className="muted text-sm">
            O DJEN informa as partes, mas não qual delas é o seu cliente. O sistema sugere a parte que já está cadastrada ou, se não houver, a do polo ativo. Confira cada processo, troque se precisar e clique em <b>Cadastrar e vincular</b>. A outra parte vira a parte contrária.
          </p>
          {rows.map(({ p, parties }) => (
            <fieldset key={p.id} className="card space-y-2">
              <legend className="sr-only">Cliente do processo {p.number}</legend>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium tabular-nums">{p.number || "Sem número"}</span>
                <span className="muted text-xs">{[p.court, p.className].filter(Boolean).join(" · ")}</span>
              </div>
              {parties.map((x) => {
                const exists = findContactByName(contacts, x.nome);
                return (
                  <label key={x.nome} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name={`cli_${p.id}`} className="h-4 w-4 accent-primary" checked={choice[p.id] === x.nome} onChange={() => setChoice({ ...choice, [p.id]: x.nome })} />
                    <span>{titleCase(x.nome)}</span>
                    <span className="muted text-xs">({poloLabel(x.polo)})</span>
                    {exists && <span className="chip bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400">já cadastrado</span>}
                  </label>
                );
              })}
              {!parties.length && <p className="muted text-xs">O DJEN não informou as partes deste processo. Digite o nome do cliente abaixo ou pule.</p>}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name={`cli_${p.id}`} className="h-4 w-4 accent-primary" checked={choice[p.id] === OTHER} onChange={() => setChoice({ ...choice, [p.id]: OTHER })} />
                Outro nome:
                <input className="input py-1" value={other[p.id] ?? ""} aria-label={`Nome do cliente do processo ${p.number}`}
                  onFocus={() => setChoice({ ...choice, [p.id]: OTHER })} onChange={(e) => setOther({ ...other, [p.id]: e.target.value })} />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name={`cli_${p.id}`} className="h-4 w-4 accent-primary" checked={choice[p.id] === SKIP} onChange={() => setChoice({ ...choice, [p.id]: SKIP })} />
                <span className="muted">Pular este processo</span>
              </label>
            </fieldset>
          ))}
        </div>
      )}
    </Modal>
  );
}
