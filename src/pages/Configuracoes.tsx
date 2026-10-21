import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Avatar, Field, Modal, PageHeader, Tabs, Toggle } from "../components/ui/basics";
import { DataTable, type Column } from "../components/ui/DataTable";
import { fmtDate, uid } from "../lib/format";
import { cloudMode, siteUrl } from "../lib/supabase";
import { inviteEmail } from "../store/sync";
import { useUi } from "../store/ui";
import { useStore } from "../store/useStore";
import type { Role, User } from "../types";

const SECTIONS = {
  usuarios: "Usuários", ia: "Inteligência Artificial", termos: "Termos monitorados", financeiro: "Financeiro", tarefas: "Tarefas", workflow: "Workflow",
  grupos: "Grupos de ação", tipos: "Tipos de ação", etapas: "Etapas", metas: "Metas", origens: "Origem de pessoas", parceiros: "Parceiros",
  caixa: "Caixa de entrada", notificacoes: "Notificações", api: "Integrações e API",
} as const;
type Section = keyof typeof SECTIONS;
const COLORS = ["#2F80ED", "#9B51E0", "#27AE60", "#F2994A", "#EB5757", "#56CCF2"];

/** Lista editável simples: renomear, reordenar, excluir e adicionar. */
function EditableList({ items, onChange, extra, addLabel, canDelete = () => true }: {
  items: { id: string; name: string }[];
  onChange: (items: { id: string; name: string }[]) => void;
  extra?: (id: string) => ReactNode;
  addLabel: string;
  canDelete?: (id: string) => boolean | string;
}) {
  const showToast = useUi((s) => s.showToast);
  const move = (i: number, d: number) => {
    const n = [...items];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    onChange(n);
  };
  return (
    <div className="space-y-2">
      <ul className="surface divide-y divide-line dark:divide-white/5">
        {items.map((it, i) => (
          <li key={it.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="flex flex-col">
              <button className="btn-icon h-5 w-6" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${it.name}`}><ChevronUp size={14} /></button>
              <button className="btn-icon h-5 w-6" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Descer ${it.name}`}><ChevronDown size={14} /></button>
            </div>
            <label className="min-w-[160px] flex-1"><span className="sr-only">Nome</span>
              <input className="input py-1.5" value={it.name} onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)))} />
            </label>
            {extra?.(it.id)}
            <button className="btn-icon" aria-label={`Excluir ${it.name}`} onClick={() => {
              const ok = canDelete(it.id);
              if (ok !== true) return showToast(typeof ok === "string" ? ok : "Não é possível excluir");
              onChange(items.filter((x) => x.id !== it.id));
            }}><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
      <button className="btn" onClick={() => onChange([...items, { id: uid("it"), name: "Novo item" }])}><Plus size={16} /> {addLabel}</button>
    </div>
  );
}

function Users() {
  const { users, teams, settings, upsert, patch, updateSettings } = useStore();
  const showToast = useUi((s) => s.showToast);
  const [tab, setTab] = useState<"colab" | "times">("colab");
  const [status, setStatus] = useState<"ativos" | "inativos">("ativos");
  const [role, setRole] = useState<"" | Role>("");
  const [form, setForm] = useState<User | null>(null);
  const rows = users.filter((u) => (status === "ativos" ? u.active : !u.active)).filter((u) => !role || u.role === role);
  const columns: Column<User>[] = [
    { key: "name", header: "Nome", sortValue: (u) => u.name, render: (u) => <span className="flex items-center gap-3"><Avatar user={u} size={30} online={u.online} /><span><b className="font-medium">{u.name}</b><span className="muted block text-xs">{u.email}</span></span></span> },
    { key: "role", header: "Perfil", sortValue: (u) => u.role, render: (u) => <span>{u.role}{cloudMode && !u.authId && <span className="chip ml-2 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Convite pendente</span>}</span> },
    { key: "goal", header: "Meta de pontos", sortValue: (u) => u.pointsGoal, render: (u) => <span className="tabular-nums">{u.pointsGoal}</span> },
    { key: "fin", header: "Acesso financeiro", render: (u) => <span onClick={(e) => e.stopPropagation()}><Toggle checked={u.financeAccess} onChange={(v) => patch("users", u.id, { financeAccess: v })} label={`Acesso financeiro de ${u.name}`} /></span> },
    { key: "created", header: "Cadastro", sortValue: (u) => u.createdAt, render: (u) => <span className="tabular-nums">{fmtDate(u.createdAt)}</span> },
  ];
  return (
    <div className="space-y-4">
      <label className="card flex items-center justify-between gap-3">
        <span><b className="text-sm font-semibold">Habilitar registro de acessos</b><span className="muted block text-xs">Guarda cada página aberta por cada usuário. Veja em Relatórios › Registros de acesso.</span></span>
        <Toggle checked={settings.accessLogEnabled} onChange={(v) => updateSettings({ accessLogEnabled: v })} label="Habilitar registro de acessos" />
      </label>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "colab", label: "Colaboradores" }, { id: "times", label: "Times" }]} />
      {tab === "colab" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={() => setForm({ id: uid("u"), name: "", email: "", role: "Colaborador", pointsGoal: 80, financeAccess: false, active: true, online: false, color: COLORS[users.length % COLORS.length], createdAt: new Date().toISOString() })}>
              <Plus size={16} /> Adicionar novo usuário
            </button>
            <label><span className="sr-only">Situação</span><select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as "ativos" | "inativos")}><option value="ativos">Ativos</option><option value="inativos">Inativos</option></select></label>
            <label><span className="sr-only">Perfil</span><select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value as Role | "")}><option value="">Todos os perfis</option><option>Gestor</option><option>Administrador</option><option>Colaborador</option></select></label>
          </div>
          <DataTable columns={columns} rows={rows} getId={(u) => u.id} onRowClick={setForm} />
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((t) => (
            <div key={t.id} className="card space-y-3">
              <label className="block"><span className="sr-only">Nome do time</span><input className="input font-semibold" value={t.name} onChange={(e) => upsert("teams", { ...t, name: e.target.value })} /></label>
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={t.memberIds.includes(u.id)} onChange={(e) => upsert("teams", { ...t, memberIds: e.target.checked ? [...t.memberIds, u.id] : t.memberIds.filter((x) => x !== u.id) })} />
                  <Avatar user={u} size={22} /> {u.name}
                </label>
              ))}
            </div>
          ))}
          <button className="btn h-full min-h-[120px] border-dashed" onClick={() => upsert("teams", { id: uid("t"), name: "Novo time", memberIds: [] })}><Plus size={16} /> Novo time</button>
        </div>
      )}
      {form && (
        <Modal title={users.some((u) => u.id === form.id) ? "Editar usuário" : "Novo usuário"} onClose={() => setForm(null)} footer={
          <><button className="btn" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-primary" onClick={async () => {
              if (!form.name.trim() || !form.email.trim()) return showToast("Informe nome e e-mail");
              const isNew = !users.some((u) => u.id === form.id);
              if (cloudMode && isNew && !form.authId) {
                const { error } = await inviteEmail(form.email);
                if (error) return showToast("Não foi possível enviar o convite. Tente de novo.");
              }
              upsert("users", { ...form, email: form.email.trim().toLowerCase() });
              setForm(null);
              showToast(cloudMode && isNew ? `Convite criado. Peça para a pessoa criar a conta com ${form.email.trim()} em ${siteUrl()}` : "Usuário salvo");
            }}>Salvar</button></>
        }>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2">{(id) => <input id={id} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label="E-mail" className="sm:col-span-2">{(id) => <input id={id} type="email" className="input" disabled={!!form.authId} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
            {cloudMode && !users.some((u) => u.id === form.id) && <p className="muted text-xs sm:col-span-2">A pessoa recebe acesso ao escritório quando criar a conta com este e-mail na tela de login.</p>}
            <Field label="Perfil">{(id) => <select id={id} className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}><option>Gestor</option><option>Administrador</option><option>Colaborador</option></select>}</Field>
            <Field label="Meta de pontos">{(id) => <input id={id} type="number" min={0} className="input" value={form.pointsGoal} onChange={(e) => setForm({ ...form, pointsGoal: +e.target.value })} />}</Field>
            <label className="flex items-center gap-2 text-sm"><Toggle checked={form.financeAccess} onChange={(v) => setForm({ ...form, financeAccess: v })} label="Acesso financeiro" /> Acesso financeiro</label>
            <label className="flex items-center gap-2 text-sm"><Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Ativo" /> Usuário ativo</label>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SectionBody({ section }: { section: Section }) {
  const s = useStore();
  const { settings, updateSettings, processes, users, patch, monitoredTerms, remove, upsert } = s;
  const showToast = useUi((x) => x.showToast);
  const [funnelId, setFunnelId] = useState(settings.funnels[0]?.id);
  const card = (title: string, desc: string, children: ReactNode) => (
    <div className="card max-w-3xl space-y-4"><div><h2 className="h2">{title}</h2><p className="muted text-sm">{desc}</p></div>{children}</div>
  );

  switch (section) {
    case "usuarios":
      return <Users />;
    case "etapas": {
      const funnel = settings.funnels.find((f) => f.id === funnelId) ?? settings.funnels[0];
      return card("Etapas", "As etapas de cada fase viram as colunas do CRM.", (
        <>
          <Tabs value={funnel.id} onChange={setFunnelId} tabs={settings.funnels.map((f) => ({ id: f.id, label: f.name }))} />
          <EditableList items={funnel.stages} addLabel="Adicionar etapa"
            canDelete={(id) => !processes.some((p) => p.stageId === id) || "Há processos nesta etapa. Mova-os antes de excluir."}
            onChange={(stages) => updateSettings({ funnels: settings.funnels.map((f) => (f.id === funnel.id ? { ...f, stages } : f)) })} />
          <p className="muted text-xs">As fases (abas do CRM) também podem ser renomeadas:</p>
          <EditableList items={settings.funnels.map(({ id, name }) => ({ id, name }))} addLabel="Adicionar fase"
            canDelete={(id) => !processes.some((p) => p.funnelId === id) || "Há processos nesta fase."}
            onChange={(list) => updateSettings({ funnels: list.map((x) => ({ ...(settings.funnels.find((f) => f.id === x.id) ?? { stages: [{ id: uid("st"), name: "Nova etapa" }] }), id: x.id, name: x.name })) })} />
        </>
      ));
    }
    case "grupos":
      return card("Grupos de ação", "Áreas do direito em que o escritório atua. Aparecem nos cartões do CRM.", (
        <EditableList items={settings.actionGroups} addLabel="Adicionar grupo" onChange={(actionGroups) => updateSettings({ actionGroups })}
          canDelete={(id) => !processes.some((p) => p.actionGroupId === id) || "Há processos neste grupo."} />
      ));
    case "tipos":
      return card("Tipos de ação", "Cada tipo pertence a um grupo de ação.", (
        <EditableList
          items={settings.actionTypes}
          addLabel="Adicionar tipo"
          canDelete={(id) => !processes.some((p) => p.actionTypeId === id) || "Há processos com este tipo."}
          onChange={(list) => updateSettings({ actionTypes: list.map((x) => ({ ...x, groupId: settings.actionTypes.find((a) => a.id === x.id)?.groupId ?? settings.actionGroups[0]?.id ?? "" })) })}
          extra={(id) => (
            <label><span className="sr-only">Grupo</span>
              <select className="input w-auto py-1.5" value={settings.actionTypes.find((a) => a.id === id)?.groupId} onChange={(e) => updateSettings({ actionTypes: settings.actionTypes.map((a) => (a.id === id ? { ...a, groupId: e.target.value } : a)) })}>
                {settings.actionGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
        />
      ));
    case "tarefas":
      return card("Tipos de tarefa", "A pontuação de cada tipo alimenta o Taskscore e os relatórios.", (
        <EditableList
          items={settings.taskTypes}
          addLabel="Adicionar tipo de tarefa"
          onChange={(list) => updateSettings({ taskTypes: list.map((x) => ({ ...x, points: settings.taskTypes.find((t) => t.id === x.id)?.points ?? 5 })) })}
          extra={(id) => (
            <label className="flex items-center gap-1 text-sm"><input type="number" min={0} className="input w-20 py-1.5" aria-label="Pontos" value={settings.taskTypes.find((t) => t.id === id)?.points ?? 0}
              onChange={(e) => updateSettings({ taskTypes: settings.taskTypes.map((t) => (t.id === id ? { ...t, points: +e.target.value } : t)) })} /> pts</label>
          )}
        />
      ));
    case "metas":
      return card("Metas", "Meta mensal de pontos por usuário e meta de fechamentos do escritório.", (
        <>
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-3"><Avatar user={u} size={28} /><span className="flex-1 text-sm">{u.name}</span>
              <input type="number" min={0} className="input w-28" aria-label={`Meta de pontos de ${u.name}`} value={u.pointsGoal} onChange={(e) => patch("users", u.id, { pointsGoal: +e.target.value })} /></label>
          ))}
          <label className="flex items-center gap-3 border-t border-line pt-4 dark:border-white/10"><span className="flex-1 text-sm font-medium">Meta de fechamentos por mês</span>
            <input type="number" min={0} className="input w-28" value={settings.closingGoal} onChange={(e) => updateSettings({ closingGoal: +e.target.value })} /></label>
        </>
      ));
    case "origens":
      return card("Origem de pessoas", "Como os clientes chegam ao escritório. Alimenta o gráfico Top Origens.", (
        <EditableList items={settings.origins.map((o) => ({ id: o, name: o }))} addLabel="Adicionar origem" onChange={(l) => updateSettings({ origins: l.map((x) => x.name) })} />
      ));
    case "financeiro":
      return card("Financeiro", "Categorias de receitas e despesas.", (
        <div className="grid gap-6 md:grid-cols-2">
          {(["receita", "despesa"] as const).map((k) => (
            <div key={k}><h3 className="mb-2 text-sm font-semibold">{k === "receita" ? "Receitas" : "Despesas"}</h3>
              <EditableList items={settings.categories[k].map((c) => ({ id: c, name: c }))} addLabel="Adicionar categoria" onChange={(l) => updateSettings({ categories: { ...settings.categories, [k]: l.map((x) => x.name) } })} />
            </div>
          ))}
        </div>
      ));
    case "termos":
      return card("Termos monitorados", "OABs e nomes buscados nas publicações do DJEN.", (
        <>
          <ul className="surface divide-y divide-line dark:divide-white/5">
            {monitoredTerms.map((t) => <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm"><span className="flex-1">{t.kind}: {t.term}</span><button className="btn-icon" aria-label={`Remover ${t.term}`} onClick={() => remove("monitoredTerms", t.id)}><Trash2 size={16} /></button></li>)}
            {!monitoredTerms.length && <li className="muted px-3 py-4 text-sm">Nenhum termo monitorado. Adicione em Intimações.</li>}
          </ul>
        </>
      ));
    case "parceiros":
      return card("Parceiros", "Escritórios e advogados com quem você divide processos.", (
        <EditableList items={s.partners} addLabel="Adicionar parceiro" onChange={(l) => { s.partners.filter((p) => !l.some((x) => x.id === p.id)).forEach((p) => remove("partners", p.id)); l.forEach((x) => upsert("partners", { ...(s.partners.find((p) => p.id === x.id) ?? { oab: "", email: "", phone: "" }), id: x.id, name: x.name })); }}
          canDelete={(id) => !processes.some((p) => p.partnerId === id) || "Há processos compartilhados com este parceiro."} />
      ));
    case "ia":
      return card("Inteligência Artificial", "Os agentes de IA redigem minutas. Todo texto gerado deve ser revisado pelo advogado responsável.", (
        <label className="flex items-center justify-between gap-3 text-sm">Permitir o uso de agentes de IA pela equipe<Toggle checked={settings.aiEnabled} onChange={(v) => updateSettings({ aiEnabled: v })} label="Permitir IA" /></label>
      ));
    case "notificacoes":
      return card("Notificações", "Como você quer ser avisado sobre prazos e intimações.", (
        <>
          <label className="flex items-center justify-between gap-3 text-sm">Avisos por e-mail<Toggle checked={settings.notifyEmail} onChange={(v) => updateSettings({ notifyEmail: v })} label="Avisos por e-mail" /></label>
          <label className="flex items-center justify-between gap-3 text-sm">Avisos no navegador<Toggle checked={settings.notifyPush} onChange={(v) => updateSettings({ notifyPush: v })} label="Avisos no navegador" /></label>
        </>
      ));
    case "caixa":
      return card("Caixa de entrada", "Endereço para encaminhar e-mails que viram tarefas.", (
        <Field label="E-mail de encaminhamento">{(id) => <input id={id} className="input" placeholder="tarefas@seuescritorio.adv.br" value={settings.inbox} onChange={(e) => updateSettings({ inbox: e.target.value })} />}</Field>
      ));
    case "api":
      return card("Integrações e API", "Chave para integrar com outros sistemas.", (
        <div className="flex flex-wrap gap-2">
          <input className="input flex-1 font-mono" readOnly value={settings.apiKey || "Nenhuma chave gerada"} aria-label="Chave da API" />
          <button className="btn" onClick={() => { updateSettings({ apiKey: `ed_${crypto.randomUUID().replace(/-/g, "")}` }); showToast("Nova chave gerada"); }}>Gerar nova chave</button>
        </div>
      ));
    case "workflow":
      return card("Workflow", "Automação entre etapas do CRM.", (
        <p className="text-sm">Ao mover um processo para <b>Negociação › Contrato assinado</b>, o processo passa a contar como fechamento do mês. Ao mover para <b>Arquivamento</b>, ele é marcado como arquivado.</p>
      ));
  }
}

export default function Configuracoes() {
  const [params, setParams] = useSearchParams();
  const section = (params.get("secao") as Section) in SECTIONS ? (params.get("secao") as Section) : "usuarios";
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Seções de configuração" className="flex gap-1 overflow-x-auto lg:flex-col">
          {(Object.entries(SECTIONS) as [Section, string][]).map(([k, v]) => (
            <button key={k} onClick={() => setParams({ secao: k })} aria-current={section === k ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium ${section === k ? "bg-primary-soft text-primary dark:bg-primary/15" : "text-ink-muted hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"}`}>
              {v}
            </button>
          ))}
        </nav>
        <div className="min-w-0"><SectionBody section={section} /></div>
      </div>
    </>
  );
}
