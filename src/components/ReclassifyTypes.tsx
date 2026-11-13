import { FlaskConical, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { exportCsv } from "../lib/files";
import { simulateReclassification, type ReclassifyRow } from "../lib/reclassify";
import { uid } from "../lib/format";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";

/**
 * Correção dos processos do DJEN que receberam o tipo de ação errado.
 * 1) Simular: lista processo, tipo atual e tipo sugerido, sem gravar nada.
 * 2) Aplicar: grava só as linhas marcadas, depois de confirmar.
 */
export function ReclassifyTypes() {
  const { processes, intimations, settings, upsert } = useStore();
  const showToast = useUi((s) => s.showToast);
  const [rows, setRows] = useState<ReclassifyRow[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const simulate = () => {
    const r = simulateReclassification(processes, intimations, settings);
    setRows(r);
    setChecked(new Set(r.filter((x) => x.recommended).map((x) => x.processId)));
    setConfirm(false);
  };
  const visible = useMemo(() => (rows ?? []).filter((r) => showAll || r.changes), [rows, showAll]);
  const toggle = (id: string) => setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const apply = () => {
    if (!rows) return;
    setBusy(true);
    const now = new Date().toISOString();
    let n = 0;
    for (const r of rows.filter((x) => checked.has(x.processId) && x.changes)) {
      const p = processes.find((x) => x.id === r.processId);
      if (!p) continue;
      upsert("processes", {
        ...p,
        actionGroupId: r.suggestedGroupId,
        actionTypeId: r.suggestedTypeId,
        typeReview: !r.sure,
        typeReason: r.reason,
        history: [...p.history, { id: uid("h"), date: now, text: `Tipo de ação corrigido: ${r.currentType} → ${r.suggestedType}${r.sure ? "" : " (revisar)"} – ${r.reason}` }],
      });
      n++;
    }
    setBusy(false);
    setRows(null);
    setConfirm(false);
    showToast(`${n} processo(s) reclassificado(s)`);
  };

  const total = rows?.length ?? 0;
  const changing = rows?.filter((r) => r.changes).length ?? 0;
  const selected = rows?.filter((r) => r.changes && checked.has(r.processId)).length ?? 0;

  return (
    <section className="mt-6 space-y-3 border-t border-line pt-5 dark:border-white/10" aria-labelledby="reclass-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="reclass-title" className="font-semibold">Corrigir tipos de ação dos processos do DJEN</h3>
          <p className="muted text-sm">Recalcula o tipo pela classe, assunto, órgão e partes das publicações. A simulação não grava nada: você revisa a lista e aplica só o que marcar.</p>
        </div>
        <button className="btn" onClick={simulate}><FlaskConical size={16} /> {rows ? "Simular de novo" : "Simular"}</button>
      </div>

      {rows && (
        <>
          <p className="text-sm">
            <b>{total}</b> processo(s) do DJEN · <b>{changing}</b> com tipo diferente do sugerido · <b>{selected}</b> marcado(s) para aplicar.
            {" "}Os desmarcados por padrão têm um tipo que parece escolhido à mão.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Mostrar também os que não mudam</label>
            <button className="link" onClick={() => exportCsv("simulacao-tipos-de-acao", ["Processo", "Tipo atual", "Tipo sugerido", "Seguro", "Motivo", "Aplicar"],
              rows.map((r) => [r.number, r.currentType, r.suggestedType, r.sure ? "sim" : "não (A revisar)", r.reason, r.changes && checked.has(r.processId) ? "sim" : "não"]))}>Exportar simulação (CSV)</button>
          </div>
          <div className="max-h-[420px] overflow-auto rounded-lg border border-line dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-left dark:bg-[#171A21]">
                <tr>
                  <th className="w-8 p-2"><span className="sr-only">Aplicar</span></th>
                  <th className="p-2">Processo</th>
                  <th className="p-2">Tipo atual</th>
                  <th className="p-2">Tipo sugerido</th>
                  <th className="p-2">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line dark:divide-white/5">
                {visible.map((r) => (
                  <tr key={r.processId} className={r.changes ? "" : "muted"}>
                    <td className="p-2">{r.changes && <input type="checkbox" aria-label={`Aplicar no processo ${r.number}`} checked={checked.has(r.processId)} onChange={() => toggle(r.processId)} />}</td>
                    <td className="whitespace-nowrap p-2 tabular-nums">{r.number || "—"}</td>
                    <td className="p-2">{r.currentType}{r.manual && <span className="chip ml-1 bg-card text-[10px] dark:bg-white/10">manual?</span>}</td>
                    <td className={`p-2 font-medium ${r.sure ? "" : "text-amber-700 dark:text-amber-400"}`}>{r.suggestedType}{!r.sure && <span className="chip ml-1 bg-amber-50 text-[10px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">A revisar</span>}</td>
                    <td className="muted p-2 text-xs">{r.reason}</td>
                  </tr>
                ))}
                {!visible.length && <tr><td colSpan={5} className="muted p-4 text-center">Nenhum processo do DJEN precisa de correção.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {confirm ? (
              <>
                <span className="self-center text-sm">Gravar {selected} alteração(ões)? O histórico de cada processo registra a correção.</span>
                <button className="btn" onClick={() => setConfirm(false)}>Voltar</button>
                <button className="btn-primary" disabled={busy} onClick={apply}>{busy && <Loader2 size={16} className="animate-spin" />} Confirmar e gravar</button>
              </>
            ) : (
              <button className="btn-primary" disabled={!selected} onClick={() => setConfirm(true)}>Aplicar {selected} alteração(ões)</button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
