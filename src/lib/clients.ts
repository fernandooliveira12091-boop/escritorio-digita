import { normalize } from "./format";
import type { Contact, Intimation, LegalProcess, Party } from "../types";

const LOWER = new Set(["da", "de", "do", "das", "dos", "e", "di", "du"]);
const KEEP_UPPER = /^(S\.?A\.?|LTDA\.?|ME|EPP|EIRELI|S\/A|INSS|CEF|BB|CNPJ|CPF|II|III|IV)$/i;

/** "MARIA IVONETE SOUSA MENDES" → "Maria Ivonete Sousa Mendes" (mantém S.A., LTDA, INSS…). */
export function titleCase(name: string) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w, i) => {
      if (KEEP_UPPER.test(w)) return w.toUpperCase();
      const lw = w.toLocaleLowerCase("pt-BR");
      if (i > 0 && LOWER.has(lw)) return lw;
      return lw.charAt(0).toLocaleUpperCase("pt-BR") + lw.slice(1);
    })
    .join(" ");
}

/** Lê "A, B x C" (texto das partes) como lista com polo. */
function parsePartiesText(text?: string): Party[] {
  if (!text) return [];
  const sides = text.split(/\s+x\s+/i);
  const names = (s: string) => s.replace(/\s+e outros$/i, "").split(/,\s+/).map((n) => n.trim()).filter(Boolean);
  if (sides.length >= 2) return [...names(sides[0]).map((nome) => ({ nome, polo: "A" })), ...names(sides[1]).map((nome) => ({ nome, polo: "P" }))];
  return names(sides[0]).map((nome) => ({ nome, polo: "" }));
}

/** Partes conhecidas de um processo: do próprio processo ou das intimações dele. */
export function partiesOfProcess(p: LegalProcess, intimations: Intimation[]): Party[] {
  const mine = intimations.filter((i) => i.processId === p.id || (i.number && i.number === p.number));
  const lists = [p.partiesList, ...mine.map((i) => i.partesList)].filter((l): l is Party[] => !!l?.length);
  const fromText = [parsePartiesText(p.parties), ...mine.map((i) => parsePartiesText(i.partes))];
  const all = [...lists.flat(), ...fromText.flat()];
  const seen = new Set<string>();
  return all.filter((x) => {
    const k = normalize(x.nome);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const findContactByName = (contacts: Contact[], name: string) => contacts.find((c) => normalize(c.name) === normalize(name));

/**
 * Sugestão de cliente: uma parte que já é contato; senão a primeira do polo ativo
 * (quem propõe a ação); senão a primeira parte. O advogado confirma ou troca.
 */
export function suggestClient(parties: Party[], contacts: Contact[]): string | null {
  const existing = parties.find((x) => findContactByName(contacts, x.nome));
  if (existing) return existing.nome;
  return (parties.find((x) => x.polo === "A") ?? parties[0])?.nome ?? null;
}

export const poloLabel = (polo: string) => (polo === "A" ? "polo ativo" : polo === "P" ? "polo passivo" : "parte");
