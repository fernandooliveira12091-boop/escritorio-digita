type DownloadsApi = { save: (r: { filename: string; data: Blob | string }) => Promise<unknown> };
type ClaudeHost = { use?: (name: string) => Promise<unknown> };

/**
 * Salva um arquivo. Dentro do claude.ai usa a capacidade de downloads da página;
 * no navegador comum, um link de download.
 */
export async function saveFile(filename: string, data: Blob | string): Promise<boolean> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (host?.use) {
    const dl = (await host.use("downloads").catch(() => null)) as DownloadsApi | null;
    if (dl) {
      try {
        await dl.save({ filename, data });
        return true;
      } catch {
        return false;
      }
    }
  }
  const blob = typeof data === "string" ? new Blob([data], { type: "text/plain;charset=utf-8" }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Exporta linhas como CSV (separador ";" e BOM, que é como o Excel em português abre). */
export function exportCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + [header, ...rows].map((r) => r.map(esc).join(";")).join("\n");
  return saveFile(filename.endsWith(".csv") ? filename : filename + ".csv", csv);
}
