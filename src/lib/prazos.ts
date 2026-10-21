import { addDays, format } from "date-fns";
import { toDate } from "./format";

/** Feriados do TJDFT em 2026 (Portaria Conjunta 105, de 17/12/2025, art. 2º). */
export const FERIADOS_TJDFT_2026: Record<string, string> = {
  "2026-01-01": "Confraternização Universal",
  "2026-02-16": "Carnaval", "2026-02-17": "Carnaval", "2026-02-18": "Quarta-feira de Cinzas",
  "2026-04-01": "Semana Santa", "2026-04-02": "Semana Santa", "2026-04-03": "Sexta-feira da Paixão",
  "2026-04-04": "Semana Santa", "2026-04-05": "Páscoa",
  "2026-04-20": "Ponto facultativo", "2026-04-21": "Tiradentes",
  "2026-05-01": "Dia do Trabalho",
  "2026-06-04": "Corpus Christi", "2026-06-05": "Ponto facultativo",
  "2026-08-10": "Ponto facultativo", "2026-08-11": "Dia do Magistrado",
  "2026-09-07": "Independência do Brasil",
  "2026-10-12": "Nossa Senhora Aparecida",
  "2026-10-30": "Dia do Servidor Público (transferido)",
  "2026-11-01": "Todos os Santos", "2026-11-02": "Finados",
  "2026-11-15": "Proclamação da República", "2026-11-20": "Consciência Negra",
  "2026-12-07": "Ponto facultativo", "2026-12-08": "Dia da Justiça",
  "2026-12-24": "Véspera de Natal", "2026-12-25": "Natal", "2026-12-31": "Véspera de Ano-Novo",
};

const key = (d: Date) => format(d, "yyyy-MM-dd");
/** Recesso forense (CPC, art. 220): 20/12 a 20/01. */
const inRecess = (d: Date) => {
  const md = format(d, "MM-dd");
  return md >= "12-20" || md <= "01-20";
};
export const isBusinessDay = (d: Date) => {
  const w = d.getDay();
  return w !== 0 && w !== 6 && !FERIADOS_TJDFT_2026[key(d)] && !inRecess(d);
};

/** Prazo em dias úteis (CPC, arts. 219 e 224): exclui o dia do começo. */
export const addBusinessDays = (start: string, days: number) => {
  let d = toDate(start);
  let n = 0;
  while (n < days) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) n++;
  }
  return key(d);
};
