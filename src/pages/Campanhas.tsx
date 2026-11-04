import { format } from "date-fns";
import { Copy, MessageCircle, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Field, Modal, PageHeader } from "../components/ui/basics";
import { DataTable, type Column } from "../components/ui/DataTable";
import { KpiCard } from "../components/ui/KpiCard";
import { brl, fmtDate, uid } from "../lib/format";
import { campaignLink } from "../lib/whatsapp";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { Campaign, CampaignChannel } from "../types";

const CHANNEL: Record<CampaignChannel, string> = { meta: "Instagram/Facebook", tiktok: "TikTok", google: "Google", outro: "Outro" };
const STATUS = { ativa: "Ativa", pausada: "Pausada", encerrada: "Encerrada" } as const;

/** Código curto e único para o link do WhatsApp, a partir do nome da campanha. */
function suggestCode(name: string, taken: string[]) {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3) || "CMP";
  for (let i = 1; ; i++) if (!taken.includes(`${base}${i}`)) return `${base}${i}`;
}

export default function Campanhas() {
  const { campaigns, conversations, processes, settings, attendants, upsert, remove } = useStore();
  const showToast = useUi((s) => s.showToast);
  const [form, setForm] = useState<Campaign | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const number = settings.agent?.whatsappNumber ?? "";

  const stats = (c: Campaign) => {
    const convs = conversations.filter((x) => x.campaignId === c.id);
    const leads = convs.filter((x) => x.lead).length;
    const cards = processes.filter((p) => p.campaignId === c.id);
    const contracts = cards.filter((p) => p.closedAt || p.status === "fechado").length;
    return { convs: convs.length, leads, contracts, cpl: leads ? c.budget / leads : 0 };
  };
  const totals = campaigns.reduce((t, c) => { const s = stats(c); return { budget: t.budget + c.budget, convs: t.convs + s.convs, leads: t.leads + s.leads, contracts: t.contracts + s.contracts }; }, { budget: 0, convs: 0, leads: 0, contracts: 0 });

  const copy = (text: string, msg: string) => navigator.clipboard?.writeText(text).then(() => showToast(msg), () => showToast("Selecione o link e copie com Ctrl+C"));
  const newCampaign = (): Campaign => ({
    id: uid("cp"), name: "", channel: "meta", code: "", area: "Previdenciário", budget: 0, startDate: format(new Date(), "yyyy-MM-dd"), endDate: "",
    status: "ativa", adIds: "", notes: "", createdAt: new Date().toISOString(),
  });

  const columns: Column<Campaign>[] = [
    { key: "name", header: "Campanha", sortValue: (c) => c.name, render: (c) => <span><b className="font-medium">{c.name}</b><span className="muted block text-xs">{CHANNEL[c.channel]} · {c.area}</span></span> },
    { key: "status", header: "Situação", sortValue: (c) => c.status, render: (c) => <span className={`chip ${c.status === "ativa" ? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-card dark:bg-white/10"}`}>{STATUS[c.status]}</span> },
    { key: "period", header: "Período", sortValue: (c) => c.startDate, render: (c) => <span className="tabular-nums">{fmtDate(c.startDate)}{c.endDate ? ` a ${fmtDate(c.endDate)}` : ""}</span> },
    { key: "budget", header: "Verba", sortValue: (c) => c.budget, render: (c) => <span className="tabular-nums">{brl(c.budget)}</span> },
    { key: "convs", header: "Conversas", sortValue: (c) => stats(c).convs, render: (c) => <span className="tabular-nums">{stats(c).convs}</span> },
    { key: "leads", header: "Leads", sortValue: (c) => stats(c).leads, render: (c) => <span className="tabular-nums">{stats(c).leads}</span> },
    { key: "contracts", header: "Contratos", sortValue: (c) => stats(c).contracts, render: (c) => <span className="tabular-nums">{stats(c).contracts}</span> },
    { key: "cpl", header: "Custo por lead", sortValue: (c) => stats(c).cpl, render: (c) => <span className="tabular-nums">{stats(c).leads ? brl(stats(c).cpl) : "—"}</span> },
    {
      key: "link", header: "Link do WhatsApp",
      render: (c) => (
        <span onClick={(e) => e.stopPropagation()}>
          <button className="btn py-1 text-xs" disabled={!number} title={number ? "" : "Informe o número em Configurações › Agente de IA no WhatsApp"} onClick={() => copy(campaignLink(number, c.code), "Link copiado. Use no botão do anúncio.")}>
            <Copy size={14} /> [{c.code}]
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Campanhas"
        subtitle="Cada campanha tem um link do WhatsApp com um código. Quem clica no anúncio chega ao agente de IA, e o lead aparece aqui, no Atendimento e no CRM."
        actions={
          <>
            <Link className="btn" to="/atendimento"><MessageCircle size={16} /> Atendimento</Link>
            <button className="btn-primary" onClick={() => { setForm(newCampaign()); setConfirmDel(false); }}><Plus size={16} /> Nova campanha</button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Verba das campanhas" value={brl(totals.budget)} subtitle={`${campaigns.filter((c) => c.status === "ativa").length} campanha(s) ativa(s)`} />
        <KpiCard title="Conversas no WhatsApp" value={totals.convs} subtitle="vindas de campanhas" />
        <KpiCard title="Leads" value={totals.leads} subtitle={totals.leads ? `custo médio ${brl(totals.budget / totals.leads)}` : "triagem completa pela IA"} />
        <KpiCard title="Contratos" value={totals.contracts} tone={totals.contracts ? "success" : "default"} subtitle={totals.leads ? `${Math.round((totals.contracts / totals.leads) * 100)}% dos leads` : "cards fechados no CRM"} />
      </div>

      <DataTable columns={columns} rows={campaigns} getId={(c) => c.id} onRowClick={(c) => { setForm(c); setConfirmDel(false); }}
        emptyText="Nenhuma campanha. Clique em Nova campanha para gerar o link do anúncio." />

      <div className="card space-y-2 text-sm">
        <h2 className="h2">Como usar nos anúncios</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li><b>Instagram/Facebook:</b> crie o anúncio com o objetivo de mensagens para o WhatsApp, ou com um botão que abre o link da campanha. Para a Meta identificar o anúncio sozinha, cole o ID do anúncio na campanha.</li>
          <li><b>TikTok:</b> use o link da campanha como destino do anúncio ou no link da bio. O código entre colchetes, como [DIV1], identifica de onde o cliente veio.</li>
          <li>O contrato conta quando o card do lead no CRM é marcado como fechado (etapa “Contrato assinado” ou situação “Fechado”).</li>
        </ol>
        <p className="muted text-xs">Lembrete: a publicidade da advocacia deve ser informativa, sem promessa de resultado nem captação indevida de clientela (Provimento 205/2021 do CFOAB).</p>
      </div>

      {form && (
        <Modal title={campaigns.some((c) => c.id === form.id) ? "Editar campanha" : "Nova campanha"} onClose={() => setForm(null)} wide footer={
          <>
            {campaigns.some((c) => c.id === form.id) && (
              <button className={`btn mr-auto ${confirmDel ? "border-red-600 bg-red-600 text-white" : "text-red-600"}`} onClick={() => (confirmDel ? (remove("campaigns", form.id), setForm(null), showToast("Campanha excluída")) : setConfirmDel(true))}>
                {confirmDel ? "Confirmar exclusão" : "Excluir"}
              </button>
            )}
            <button className="btn" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-primary" onClick={() => {
              if (!form.name.trim()) return showToast("Informe o nome da campanha");
              const code = (form.code || suggestCode(form.name, campaigns.filter((c) => c.id !== form.id).map((c) => c.code))).toUpperCase().replace(/[^A-Z0-9]/g, "");
              if (campaigns.some((c) => c.id !== form.id && c.code === code)) return showToast(`O código ${code} já é usado por outra campanha`);
              upsert("campaigns", { ...form, code });
              setForm(null);
              showToast(`Campanha salva. Código [${code}]`);
            }}>Salvar</button>
          </>
        }>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da campanha" className="sm:col-span-2">{(id) => <input id={id} className="input" placeholder="Ex.: BPC/LOAS - Instagram novembro" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label="Canal">{(id) => <select id={id} className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as CampaignChannel })}>{Object.entries(CHANNEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
            <Field label="Área">{(id) => <select id={id} className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}><option>Previdenciário</option><option>Família</option><option>Cível</option><option>Outra</option></select>}</Field>
            <Field label="Código (vai no link do WhatsApp)">{(id) => <input id={id} className="input font-mono uppercase" placeholder={form.name ? suggestCode(form.name, campaigns.map((c) => c.code)) : "Gerado ao salvar"} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })} />}</Field>
            <Field label="Verba total (R$)">{(id) => <input id={id} type="number" min={0} step="0.01" className="input" value={form.budget || ""} onChange={(e) => setForm({ ...form, budget: +e.target.value })} />}</Field>
            <Field label="Início">{(id) => <input id={id} type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />}</Field>
            <Field label="Fim">{(id) => <input id={id} type="date" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />}</Field>
            <Field label="Situação">{(id) => <select id={id} className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Campaign["status"] })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
            <Field label="Agente que atende">{(id) => <select id={id} className="input" value={form.attendantId ?? ""} onChange={(e) => setForm({ ...form, attendantId: e.target.value || undefined })}><option value="">Automático (pelo assunto)</option>{attendants.filter((a) => a.active || a.id === form.attendantId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}</Field>
            <Field label="IDs dos anúncios da Meta (opcional)">{(id) => <input id={id} className="input font-mono" placeholder="Separados por vírgula" value={form.adIds} onChange={(e) => setForm({ ...form, adIds: e.target.value })} />}</Field>
            <Field label="Observações" className="sm:col-span-2">{(id) => <textarea id={id} rows={2} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}</Field>
          </div>
        </Modal>
      )}
    </>
  );
}
