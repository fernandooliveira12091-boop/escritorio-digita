// Reclassificação do tipo de ação dos processos que vieram do DJEN.
// Só calcula (simulação); quem grava é a tela de Configurações › Tipos de ação, depois da aprovação.
import type { Intimation, LegalProcess, Settings } from "../types";
import { classifyAction, ensureUnclassified, UNCLASSIFIED_TYPE_ID, type Classification } from "../../supabase/functions/_shared/actionType.ts";

export interface ReclassifyRow {
  processId: string;
  number: string;
  currentTypeId: string;
  currentType: string;
  suggestedTypeId: string;
  suggestedType: string;
  suggestedGroupId: string;
  sure: boolean;
  reason: string;
  /** Há diferença entre o atual e o sugerido (tipo ou selo "A revisar"). */
  changes: boolean;
  /** Marcado por padrão: o tipo atual parece o valor automático antigo (e não uma escolha manual). */
  recommended: boolean;
  /** Tipo atual parece escolhido à mão: aparece na lista, mas desmarcado. */
  manual: boolean;
}

/** Processos cadastrados automaticamente pelo DJEN. */
export const isFromDjen = (p: LegalProcess) =>
  p.id.startsWith("pr_djen_") || /DJEN/.test(p.history?.[0]?.text ?? "");

/** O tipo que o código antigo colocava em todo processo do DJEN: primeiro tipo do primeiro grupo. */
export function oldDefaultTypeId(settings: Pick<Settings, "actionGroups" | "actionTypes">): string {
  const group = settings.actionGroups[0];
  return (settings.actionTypes.find((t) => t.groupId === group?.id) ?? settings.actionTypes[0])?.id ?? "";
}

export function simulateReclassification(
  processes: LegalProcess[],
  intimations: Pick<Intimation, "processId" | "text">[],
  settings: Pick<Settings, "actionGroups" | "actionTypes">,
): ReclassifyRow[] {
  const table = ensureUnclassified(settings.actionGroups, settings.actionTypes);
  const typeName = (id: string) => table.actionTypes.find((t) => t.id === id)?.name ?? "—";
  const suspect = oldDefaultTypeId(settings);
  const textsByProcess = new Map<string, string[]>();
  for (const i of intimations) {
    if (!i.processId) continue;
    const list = textsByProcess.get(i.processId) ?? [];
    list.push(String(i.text ?? ""));
    textsByProcess.set(i.processId, list);
  }
  return processes.filter(isFromDjen).map((p) => {
    const c: Classification = classifyAction({
      className: p.className, subjects: p.subjects, orgao: p.orgao, court: p.court,
      parties: p.partiesList, partiesText: p.parties, texts: (textsByProcess.get(p.id) ?? []).slice(-10),
    }, table.actionGroups, table.actionTypes);
    const changes = c.typeId !== p.actionTypeId || c.groupId !== p.actionGroupId || !c.sure !== !!p.typeReview;
    const looksAutomatic = !p.actionTypeId || p.actionTypeId === suspect || p.actionTypeId === UNCLASSIFIED_TYPE_ID || !!p.typeReview;
    return {
      processId: p.id, number: p.number,
      currentTypeId: p.actionTypeId, currentType: typeName(p.actionTypeId),
      suggestedTypeId: c.typeId, suggestedType: typeName(c.typeId), suggestedGroupId: c.groupId,
      sure: c.sure, reason: c.reason, changes,
      recommended: changes && looksAutomatic,
      manual: changes && !looksAutomatic,
    };
  });
}
