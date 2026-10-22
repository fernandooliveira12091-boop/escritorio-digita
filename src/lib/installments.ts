import { addMonths, format } from "date-fns";
import { toDate, uid } from "./format";
import type { Transaction } from "../types";

export interface InstallmentPlan {
  count: number;
  /** "total": o valor informado é dividido entre as parcelas; "parcela": cada parcela tem o valor informado. */
  valueMode: "total" | "parcela";
  /** Entrada opcional, lançada à parte (ex.: paga na assinatura do contrato). */
  entry?: { value: number; date: string; paid: boolean };
}

/**
 * Gera as parcelas de um lançamento, uma por mês a partir do vencimento da 1ª.
 * Cada parcela vence (e conta) no próprio mês. Os centavos que sobram da divisão
 * ficam na 1ª parcela, para a soma bater exatamente com o total.
 * Com entrada: ela vira um lançamento próprio ("… - entrada"), na data dela; no modo
 * "total" as parcelas dividem o que sobra depois da entrada. Sem entrada, só a 1ª
 * parcela herda a data de pagamento.
 */
export function buildInstallments(base: Transaction, plan: InstallmentPlan): Transaction[] {
  const count = Math.max(1, Math.min(120, Math.floor(plan.count)));
  const entryCents = plan.entry && plan.entry.value > 0 ? Math.round(plan.entry.value * 100) : 0;
  const totalCents = plan.valueMode === "parcela" ? Math.round(base.value * 100) * count : Math.max(0, Math.round(base.value * 100) - entryCents);
  const each = Math.floor(totalCents / count);
  const first = totalCents - each * (count - 1);
  const group = uid("parc");
  const start = toDate(base.dueDate);
  const desc = base.description.trim();
  const parcels = Array.from({ length: count }, (_, i) => {
    const due = addMonths(start, i); // 31/01 + 1 mês = 28/02 (último dia do mês)
    const dueDate = format(due, "yyyy-MM-dd");
    return {
      ...base,
      id: i === 0 && !entryCents ? base.id : uid("tx"),
      description: `${desc} - parcela ${i + 1}/${count}`,
      value: (i === 0 ? first : each) / 100,
      dueDate,
      competence: dueDate.slice(0, 7),
      paidDate: i === 0 && !entryCents ? base.paidDate : undefined,
      installment: { group, number: i + 1, total: count },
    };
  });
  if (!entryCents || !plan.entry) return parcels;
  const entry: Transaction = {
    ...base,
    description: `${desc} - entrada`,
    value: entryCents / 100,
    dueDate: plan.entry.date,
    competence: plan.entry.date.slice(0, 7),
    paidDate: plan.entry.paid ? plan.entry.date : undefined,
    installment: { group, number: 0, total: count },
  };
  return [entry, ...parcels];
}
