import JSZip from "jszip";
import { brl, fmtDate } from "./format";
import type { Contact, LegalProcess, Settings, User } from "../types";

export const VARIABLES: { key: string; label: string }[] = [
  { key: "cliente.nome", label: "Nome do cliente" },
  { key: "cliente.documento", label: "CPF/CNPJ" },
  { key: "cliente.celular", label: "Celular" },
  { key: "cliente.email", label: "E-mail" },
  { key: "cliente.endereco", label: "Endereço" },
  { key: "cliente.cidade", label: "Cidade/UF" },
  { key: "cliente.profissao", label: "Profissão" },
  { key: "cliente.nascimento", label: "Nascimento" },
  { key: "processo.numero", label: "Nº do processo" },
  { key: "processo.tipo", label: "Tipo de ação" },
  { key: "processo.parte_contraria", label: "Parte contrária" },
  { key: "processo.tribunal", label: "Tribunal" },
  { key: "processo.valor", label: "Valor da causa" },
  { key: "escritorio.nome", label: "Escritório" },
  { key: "escritorio.advogado", label: "Advogado(a)" },
  { key: "escritorio.cidade", label: "Cidade do escritório" },
  { key: "data.hoje", label: "Data de hoje" },
  { key: "data.extenso", label: "Data por extenso" },
];

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function buildContext(opts: { contact?: Contact; process?: LegalProcess; settings: Settings; user: User }) {
  const { contact: c, process: p, settings, user } = opts;
  const now = new Date();
  return {
    "cliente.nome": c?.name ?? "",
    "cliente.documento": c?.document ?? "",
    "cliente.celular": c?.phone ?? "",
    "cliente.email": c?.email ?? "",
    "cliente.endereco": c?.address ?? "",
    "cliente.cidade": c?.city ?? "",
    "cliente.profissao": c?.profession ?? "",
    "cliente.nascimento": c?.birthDate ? fmtDate(c.birthDate) : "",
    "processo.numero": p?.number ?? "",
    "processo.tipo": p ? settings.actionTypes.find((t) => t.id === p.actionTypeId)?.name ?? "" : "",
    "processo.parte_contraria": p?.opposingParty ?? "",
    "processo.tribunal": p?.court ?? "",
    "processo.valor": p ? brl(p.value) : "",
    "escritorio.nome": settings.officeName,
    "escritorio.advogado": user.name,
    "escritorio.cidade": settings.officeCity,
    "data.hoje": fmtDate(now.toISOString()),
    "data.extenso": `${now.getDate()} de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`,
  } as Record<string, string>;
}

/** Troca {{variavel}} pelo valor; variáveis sem valor ficam marcadas como [variavel]. */
export const fillTemplate = (content: string, ctx: Record<string, string>) =>
  content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => (ctx[k] ? ctx[k] : `[${k}]`));

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Gera um .docx simples (Times New Roman 12, justificado) a partir de texto. */
export async function textToDocx(text: string): Promise<Blob> {
  const paras = text.split("\n").map((line) => {
    const title = line.trim() && line.trim() === line.trim().toUpperCase() && /[A-ZÀ-Ú]/.test(line) && line.length < 90;
    return `<w:p><w:pPr><w:jc w:val="${title ? "center" : "both"}"/><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${title ? "<w:b/>" : ""}<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`;
  });
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: "blob" });
}
