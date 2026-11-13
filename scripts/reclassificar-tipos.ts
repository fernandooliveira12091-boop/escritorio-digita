// Simulação da reclassificação do tipo de ação dos processos do DJEN. NÃO grava nada.
// A gravação é feita no sistema (Configurações › Tipos de ação › Corrigir tipos), depois de revisar a lista.
//
// Uso:
//   node --experimental-strip-types scripts/reclassificar-tipos.ts dados.json            → lista processo a processo
//   node --experimental-strip-types scripts/reclassificar-tipos.ts dados.json --resumo   → só contagens (sem números de processo)
//
//   node --experimental-strip-types scripts/reclassificar-tipos.ts dados.json --resumo --sql saida.sql <workspace>
//       → além do resumo, gera o SQL que grava SÓ as linhas marcadas (usado pelo workflow, depois da aprovação)
//
// dados.json: { "settings": {...}, "processes": [...], "intimations": [{ "processId": "...", "text": "..." }] }
import { readFileSync, writeFileSync } from "node:fs";
import { simulateReclassification } from "../src/lib/reclassify.ts";
import { ensureUnclassified } from "../supabase/functions/_shared/actionType.ts";

const file = process.argv[2];
if (!file) {
  console.error("Informe o arquivo JSON com settings, processes e intimations.");
  process.exit(1);
}
const data = JSON.parse(readFileSync(file, "utf8"));
const rows = simulateReclassification(data.processes ?? [], data.intimations ?? [], data.settings);
const changing = rows.filter((r) => r.changes);

console.log(`Processos do DJEN: ${rows.length}`);
console.log(`Com tipo diferente do sugerido: ${changing.length} (${changing.filter((r) => r.recommended).length} marcados para aplicar, ${changing.filter((r) => r.manual).length} com tipo aparentemente manual)`);
console.log(`Ficariam com tipo seguro: ${rows.filter((r) => r.sure).length} · "A classificar" (A revisar): ${rows.filter((r) => !r.sure).length}`);
console.log("");

if (process.argv.includes("--resumo")) {
  const pairs = new Map<string, number>();
  for (const r of changing) {
    const k = `${r.currentType}  →  ${r.suggestedType}${r.sure ? "" : " (A revisar)"}${r.manual ? "  [manual?]" : ""}`;
    pairs.set(k, (pairs.get(k) ?? 0) + 1);
  }
  console.log("Mudanças (tipo atual → tipo sugerido):");
  for (const [k, n] of [...pairs].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
  const reasons = new Map<string, number>();
  for (const r of changing) {
    const k = r.reason.replace(/^[^:]+: /, "").replace(/\(.*?\)/g, "").trim();
    reasons.set(k, (reasons.get(k) ?? 0) + 1);
  }
  console.log("\nMotivos:");
  for (const [k, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
} else {
  console.log(["Processo", "Tipo atual", "Tipo sugerido", "Aplicar", "Motivo"].join(" | "));
  for (const r of changing) {
    console.log([r.number, r.currentType, `${r.suggestedType}${r.sure ? "" : " (A revisar)"}`, r.recommended ? "sim" : "não (manual?)", r.reason].join(" | "));
  }
}
const sqlAt = process.argv.indexOf("--sql");
if (sqlAt > 0) {
  const out = process.argv[sqlAt + 1];
  const ws = process.argv[sqlAt + 2];
  if (!out || !/^[0-9a-f-]{36}$/i.test(ws ?? "")) {
    console.error("Uso: --sql saida.sql <workspace-uuid>");
    process.exit(1);
  }
  const now = new Date().toISOString();
  const updates = changing.filter((r) => r.recommended).map((r, i) => ({
    id: r.processId,
    current: r.currentTypeId,
    patch: { actionGroupId: r.suggestedGroupId, actionTypeId: r.suggestedTypeId, typeReview: !r.sure, typeReason: r.reason },
    hist: [{ id: `h_reclass_${Date.now()}_${i}`, date: now, text: `Tipo de ação corrigido: ${r.currentType} → ${r.suggestedType}${r.sure ? "" : " (revisar)"} – ${r.reason}` }],
  }));
  const lit = (v: unknown) => `$json$${JSON.stringify(v)}$json$::jsonb`;
  const table = ensureUnclassified(data.settings.actionGroups ?? [], data.settings.actionTypes ?? []);
  // Um único comando (atômico): grava tudo ou nada, e devolve quantos processos foram gravados.
  // Só grava o processo se o tipo ainda for o que a simulação viu (ninguém mudou no meio do caminho).
  const sql = `with u as (select * from jsonb_to_recordset(${lit(updates)}) as x(id text, current text, patch jsonb, hist jsonb)),
s as (${table.changed
    ? `update records set data = data || ${lit({ actionGroups: table.actionGroups, actionTypes: table.actionTypes })}, client_id = 'reclassificacao' where workspace_id = '${ws}' and collection = 'settings' and id = 'main' returning 1`
    : "select 1 where false"}),
p as (update records r set
  data = (r.data || u.patch) || jsonb_build_object('history', coalesce(r.data->'history', '[]'::jsonb) || u.hist, 'unreadHistory', true),
  client_id = 'reclassificacao'
from u
where r.workspace_id = '${ws}' and r.collection = 'processes' and r.id = u.id and coalesce(r.data->>'actionTypeId', '') = u.current
returning r.id)
select (select count(*) from p) as processos_gravados, (select count(*) from s) as tabela_atualizada;`;
  writeFileSync(out, sql);
  console.log(`\nSQL gerado para ${updates.length} processo(s) marcado(s)${table.changed ? ' + inclusão do tipo "A classificar" na tabela' : ""}.`);
} else {
  console.log("\nSimulação: nada foi gravado.");
}
