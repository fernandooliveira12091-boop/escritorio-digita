import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (v: number) => brlFmt.format(v || 0);
export const num = (v: number) => (v || 0).toLocaleString("pt-BR");

export const toDate = (s: string | Date) => (typeof s === "string" ? parseISO(s) : s);
export const fmtDate = (s?: string) => (s ? format(toDate(s), "dd/MM/yyyy", { locale: ptBR }) : "—");
export const fmtDateTime = (s?: string) => (s ? format(toDate(s), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—");
export const fmtMonth = (d: Date) => {
  const s = format(d, "MMMM yyyy", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "Hoje 19:05", "Amanhã 09:00", "Ontem 14:00" ou "dd/MM/yyyy HH:mm". */
export const relDateTime = (s?: string) => {
  if (!s) return "—";
  const d = toDate(s);
  const h = format(d, "HH:mm");
  if (isToday(d)) return `Hoje ${h}`;
  if (isTomorrow(d)) return `Amanhã ${h}`;
  if (isYesterday(d)) return `Ontem ${h}`;
  return fmtDateTime(s);
};

export const initials = (name: string) =>
  name
    .split(" ")
    .filter((p) => p.length > 2 || p === p.toUpperCase())
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || name.slice(0, 2).toUpperCase();

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/** Máscara CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO */
export const maskCNJ = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 20);
  const parts = [d.slice(0, 7), d.slice(7, 9), d.slice(9, 13), d.slice(13, 14), d.slice(14, 16), d.slice(16, 20)];
  let out = parts[0];
  if (parts[1]) out += "-" + parts[1];
  if (parts[2]) out += "." + parts[2];
  if (parts[3]) out += "." + parts[3];
  if (parts[4]) out += "." + parts[4];
  if (parts[5]) out += "." + parts[5];
  return out;
};

export const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, (_, a, b, c) => (a ? `(${a}` : "") + (a.length === 2 ? ") " : "") + b + (c ? "-" + c : ""));
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};

export const maskDocument = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};

export const waLink = (phone: string) => `https://wa.me/55${phone.replace(/\D/g, "")}`;
