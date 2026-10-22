import { addMonths, format } from "date-fns";
import { toDate, uid } from "./format";
import type { Transaction } from "../types";

export interface InstallmentPlan {
  count: number;
  /** "total": o valor informado é dividido entre as parcelas; "parcela": cada parcela tem o valor informado. */
  valueMode: "total" | "parcela";
}

/**
 * Gera as parcelas de um lançamento, uma por mês a partir do vencimento da 1ª.
 * Cada parcela vence (e conta) no próprio mês. Os centavos que sobram da divisão
 * ficam na 1ª parcela, para a soma bater exatamente com o total.
 * Só a 1ª parcela herda a data de pagamento.
 */
export function buildInstallments(base: Transaction, plan: InstallmentPlan): Transaction[] {
  const count = Math.max(1, Math.min(120, Math.floor(plan.count)));
  const totalCents = Math.round(base.value * 100) * (plan.valueMode === "parcela" ? count : 1);
  const each = Math.floor(totalCents / count);
  const first = totalCents - each * (count - 1);
  const group = uid("parc");
  const start = toDate(base.dueDate);
  const desc = base.description.trim();
  return Array.from({ length: count }, (_, i) => {
    const due = addMonths(start, i); // 31/01 + 1 mês = 28/02 (último dia do mês)
    const dueDate = format(due, "yyyy-MM-dd");
    return {
      ...base,
      id: i === 0 ? base.id : uid("tx"),
      description: `${desc} - parcela ${i + 1}/${count}`,
      value: (i === 0 ? first : each) / 100,
      dueDate,
      competence: dueDate.slice(0, 7),
      paidDate: i === 0 ? base.paidDate : undefined,
      installment: { group, number: i + 1, total: count },
    };
  });
}
