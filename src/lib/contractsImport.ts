import { normalize } from "./format";

/** Uma linha da planilha já interpretada. */
export interface ImportedRow {
  name: string;
  document: string;
  phone: string;
  title: string;
  signed: boolean | null;
  eventDate: string; // yyyy-MM-dd
  needsContribution: boolean | null;
  partnerValue: number;
  value: number;
  notes: string;
}

export interface ParsedSheet {
  rows: ImportedRow[];
  eventLabel: string;
  /** Colunas com senha, descartadas de propósito. */
  ignoredSecretColumns: string[];
  unknownColumns: string[];
}

type Field = keyof ImportedRow;

/** Reconhece a coluna pelo título (sem acento, sem diferenciar maiúsculas). */
function fieldFor(header: string): Field | "secret" | null {
  const h = normalize(header).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (/senha|password/.test(h)) return "secret";
  if (/^(cliente|nome|nome do cliente|contratante)$/.test(h)) return "name";
  if (/^(cpf|cnpj|cpf cnpj|documento)/.test(h)) return "document";
  if (/telefone|celular|whatsapp/.test(h)) return "phone";
  if (/contrato assinado|assinado|assinou/.test(h)) return "signed";
  if (/contribuic/.test(h)) return "needsContribution";
  if (/parceri|indicac/.test(h)) return "partnerValue";
  if (/honorar|valor do contrato|valor total/.test(h)) return "value";
  if (/^data|parto|nascimento do bebe|evento/.test(h)) return "eventDate";
  if (/tipo|acao|assunto|servico|beneficio/.test(h)) return "title";
  if (/obs|anotac/.test(h)) return "notes";
  return null;
}

const yesNo = (v: string): boolean | null => {
  const n = normalize(v).trim();
  if (/^(sim|s|yes|x|ok)$/.test(n)) return true;
  if (/^(nao|n|no)$/.test(n)) return false;
  return null;
};

/** "1.234,56", "R$ 100", "150" → número. */
const money = (v: string) => {
  const s = v.replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : 0;
};

/** "28/12/2026" ou "2026-12-28" → "2026-12-28". */
const date = (v: string) => {
  const t = v.trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};

/** Separa as linhas em células (tabulação ao colar do Excel; ";" ou "," em CSV). */
function splitRows(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  return lines.map((l) => l.split(sep).map((c) => c.replace(/^"(.*)"$/, "$1").trim()));
}

/** "DATA DO PARTO" → "Data do parto". */
const sentenceCase = (s: string) => {
  const t = s.trim().toLocaleLowerCase("pt-BR");
  return t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1);
};

/** Lê a planilha colada. A primeira linha precisa ter os títulos das colunas. */
export function parseContractsSheet(text: string): ParsedSheet {
  const [header = [], ...body] = splitRows(text);
  const map = header.map(fieldFor);
  const eventIdx = map.indexOf("eventDate");
  const rows: ImportedRow[] = [];
  for (const cells of body) {
    const r: ImportedRow = { name: "", document: "", phone: "", title: "", signed: null, eventDate: "", needsContribution: null, partnerValue: 0, value: 0, notes: "" };
    map.forEach((f, i) => {
      const v = cells[i] ?? "";
      if (!f || f === "secret" || !v) return; // senha nunca é lida
      if (f === "signed") r.signed = yesNo(v);
      else if (f === "needsContribution") r.needsContribution = yesNo(v);
      else if (f === "partnerValue") r.partnerValue = money(v);
      else if (f === "value") r.value = money(v);
      else if (f === "eventDate") r.eventDate = date(v);
      else r[f] = v as never;
    });
    if (r.name.trim()) rows.push(r);
  }
  return {
    rows,
    eventLabel: eventIdx >= 0 ? sentenceCase(header[eventIdx]) : "",
    ignoredSecretColumns: header.filter((_, i) => map[i] === "secret"),
    unknownColumns: header.filter((h, i) => h && map[i] === null),
  };
}
