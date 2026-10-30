import { Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { feedUrl, getOrCreateFeedToken, regenerateFeedToken } from "../lib/calendar";
import { cloudMode } from "../lib/supabase";
import { useUi } from "../store/ui";
import { Modal, Segmented } from "./ui/basics";

/** Gera o endereço pessoal da agenda (.ics) e explica como assinar no Google Agenda. */
export function GoogleCalendarModal({ onClose }: { onClose: () => void }) {
  const showToast = useUi((s) => s.showToast);
  const [escopo, setEscopo] = useState<"meus" | "todos">("meus");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(cloudMode);
  const [error, setError] = useState("");
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => {
    if (!cloudMode) return;
    getOrCreateFeedToken().then(setToken).catch((e) => setError((e as Error).message)).finally(() => setBusy(false));
  }, []);

  const url = token ? feedUrl(token, escopo) : "";
  const copy = () =>
    navigator.clipboard?.writeText(url).then(() => showToast("Endereço copiado"), () => showToast("Selecione o endereço e copie com Ctrl+C"));

  return (
    <Modal title="Ver a agenda no Google Agenda" onClose={onClose} wide footer={<button className="btn-primary" onClick={onClose}>Fechar</button>}>
      {!cloudMode ? (
        <p className="text-sm">Esta função usa o servidor do sistema e funciona no sistema online, com login. No modo demonstração, use o botão “Adicionar ao Google Agenda” dentro de cada compromisso.</p>
      ) : (
        <div className="space-y-5 text-sm">
          <p>Os compromissos e prazos fatais do sistema passam a aparecer no seu Google Agenda, no computador e no celular. O Google atualiza essas agendas sozinho, em geral <b>a cada algumas horas</b>. Para um compromisso aparecer na hora, use o botão “Adicionar ao Google Agenda” dentro dele.</p>

          <div className="space-y-2">
            <span className="label">O que aparece no Google Agenda</span>
            <Segmented label="O que aparece" value={escopo} onChange={setEscopo} options={[{ id: "meus", label: "Só os meus" }, { id: "todos", label: "Todo o escritório" }]} />
            <p className="muted text-xs">{escopo === "meus" ? "Compromissos e prazos em que você é responsável." : "Compromissos e prazos de todos os usuários do escritório."}</p>
          </div>

          <div className="space-y-2">
            <span className="label">Seu endereço da agenda</span>
            {busy ? (
              <p className="muted flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Gerando endereço…</p>
            ) : error ? (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700 dark:bg-red-500/15 dark:text-red-300">{error}</p>
            ) : (
              <div className="flex gap-2">
                <input className="input font-mono text-xs" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Endereço da agenda" />
                <button className="btn shrink-0" onClick={copy}><Copy size={16} /> Copiar</button>
              </div>
            )}
            <p className="muted text-xs">Este endereço é pessoal e funciona como uma senha: quem tiver o link vê a agenda. Não compartilhe.</p>
          </div>

          <ol className="card list-decimal space-y-1.5 pl-8">
            <li>Clique em <b>Copiar</b> acima.</li>
            <li>Abra o <a className="link inline-flex items-center gap-1" href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noreferrer">Google Agenda › Adicionar agenda por URL <ExternalLink size={12} /></a> no computador.</li>
            <li>Cole o endereço em <b>URL da agenda</b> e clique em <b>Adicionar agenda</b>.</li>
            <li>Pronto: a agenda “Escritório Digital” aparece em <b>Outras agendas</b>, e no celular também, com a mesma conta Google.</li>
          </ol>

          {token && (
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 dark:border-white/10">
              <p className="muted flex-1 text-xs">Se o endereço vazou, gere outro. O antigo para de funcionar e será preciso adicionar o novo no Google Agenda.</p>
              <button className={`btn ${confirmNew ? "border-red-600 bg-red-600 text-white" : ""}`} onClick={async () => {
                if (!confirmNew) return setConfirmNew(true);
                setBusy(true);
                try { setToken(await regenerateFeedToken()); showToast("Novo endereço gerado. Adicione-o no Google Agenda."); }
                catch (e) { setError((e as Error).message); }
                finally { setBusy(false); setConfirmNew(false); }
              }}>
                <RefreshCw size={16} /> {confirmNew ? "Confirmar: gerar novo endereço" : "Gerar novo endereço"}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
