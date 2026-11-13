// Simulação da reclassificação do tipo de ação dos processos do DJEN. NÃO grava nada.
// A gravação é feita no sistema (Configurações › Tipos de ação › Corrigir tipos), depois de revisar a lista.
//
// Uso:
//   node --experimental-strip-types scripts/reclassificar-tipos.ts dados.json            → lista processo a processo
//   node --experimental-strip-types scripts/reclassificar-tipos.ts dados.json --resumo   → só contagens (sem números de processo)
//
// dados.json: { "settings": {...}, "processes": [...], "intimations": [{ "processId": "...", "text": "..." }] }
import { readFileSync } from "node:fs";
import { simulateReclassification } from "../src/lib/reclassify.ts";

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
console.log("\nSimulação: nada foi gravado.");
