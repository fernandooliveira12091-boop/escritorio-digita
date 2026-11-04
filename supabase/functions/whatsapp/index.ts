// Função "whatsapp" (Supabase Edge Function): agente de atendimento com IA no WhatsApp oficial (Cloud API da Meta).
//
// Meta → GET  ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…   (confirmação do webhook)
// Meta → POST mensagens recebidas (assinadas com X-Hub-Signature-256)
// Sistema (usuário logado) → POST { action: "status" | "send" | "setAi" | "setAttendant" | "simulate", workspaceId, ... }
// Especialistas (coleção "attendants"): um agente treinado por benefício conduz a triagem com o roteiro dele.
//
// Fluxo: a mensagem do cliente entra na conversa (coleção "conversations"); se a IA estiver ativa, o Claude
// responde, faz a triagem e, com os dados completos, registra o lead: contato, card no funil Marketing do CRM,
// tarefa de retorno e notificação. Pedidos urgentes ou fora do escopo vão para atendimento humano.
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const env = (k: string) => (Deno.env.get(k) ?? "").trim(); // tira espaços e quebras de linha coladas junto
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const GRAPH = `https://graph.facebook.com/${env("WHATSAPP_GRAPH_VERSION") || "v23.0"}`;
const MODEL = "claude-opus-5-5";
const MAX_HISTORY = 40; // mensagens enviadas ao modelo
const MAX_STORED = 300; // mensagens guardadas por conversa

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const nowIso = () => new Date().toISOString();
const rid = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
const digits = (s: string) => (s ?? "").replace(/\D/g, "");
const norm = (s: string) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Doc = Record<string, any> & { id: string };
type Msg = { id: string; from: "cliente" | "ia" | "equipe" | "sistema"; text: string; at: string; waId?: string; by?: string };

// ---------- registros do sistema ----------
async function getCollection(ws: string, collection: string): Promise<Doc[]> {
  const out: Doc[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("records").select("data").eq("workspace_id", ws).eq("collection", collection).range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []).map((r) => r.data as Doc));
    if (!data || data.length < 1000) break;
  }
  return out;
}
async function getDoc(ws: string, collection: string, id: string): Promise<Doc | null> {
  const { data } = await admin.from("records").select("data").eq("workspace_id", ws).eq("collection", collection).eq("id", id).maybeSingle();
  return (data?.data as Doc) ?? null;
}
async function put(ws: string, collection: string, items: Doc[]) {
  if (!items.length) return;
  const rows = items.map((d) => ({ workspace_id: ws, collection, id: d.id, data: d, client_id: "servidor-whatsapp", updated_at: nowIso() }));
  const { error } = await admin.from("records").upsert(rows);
  if (error) throw error;
}

/** Escritório dono do número: WHATSAPP_WORKSPACE_ID, ou o único escritório cadastrado. */
async function resolveWorkspace(): Promise<string | null> {
  if (env("WHATSAPP_WORKSPACE_ID")) return env("WHATSAPP_WORKSPACE_ID");
  const { data } = await admin.from("workspaces").select("id").order("created_at").limit(2);
  return data?.length === 1 ? data[0].id : null;
}

// ---------- WhatsApp Cloud API ----------
async function waSend(to: string, text: string) {
  const res = await fetch(`${GRAPH}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: text.slice(0, 4000), preview_url: false } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? `WhatsApp respondeu ${res.status}`);
  return body?.messages?.[0]?.id as string | undefined;
}
async function waMarkRead(messageId: string) {
  await fetch(`${GRAPH}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  }).catch(() => {});
}

/** Confere a assinatura X-Hub-Signature-256 (HMAC-SHA256 do corpo com o App Secret). */
async function validSignature(raw: string, header: string | null) {
  const secret = env("WHATSAPP_APP_SECRET");
  if (!secret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7);
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/** Texto legível de qualquer tipo de mensagem recebida. */
function textOf(m: any): string {
  switch (m.type) {
    case "text": return m.text?.body ?? "";
    case "button": return m.button?.text ?? "";
    case "interactive": return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
    case "audio": return "[Áudio enviado. O assistente ainda não ouve áudios.]";
    case "image": return `[Imagem enviada${m.image?.caption ? `: ${m.image.caption}` : ""}]`;
    case "document": return `[Documento enviado: ${m.document?.filename ?? "arquivo"}]`;
    case "video": return "[Vídeo enviado]";
    case "location": return "[Localização enviada]";
    case "sticker": return "[Figurinha]";
    default: return `[Mensagem do tipo ${m.type}]`;
  }
}

// ---------- campanhas ----------
/** Identifica a campanha pelo anúncio da Meta (referral.source_id) ou pelo código no texto, como [BPC1]. */
function matchCampaign(campaigns: Doc[], text: string, referral: any): Doc | undefined {
  if (referral?.source_id) {
    const byAd = campaigns.find((c) => String(c.adIds ?? "").split(/[\s,;]+/).filter(Boolean).includes(String(referral.source_id)));
    if (byAd) return byAd;
  }
  const t = norm(text);
  return campaigns.find((c) => c.code && new RegExp(`(^|[^a-z0-9])${norm(c.code).replace(/[^a-z0-9]/g, "")}([^a-z0-9]|$)`).test(t));
}

// ---------- agente ----------
const STATIC_PROMPT = `Você é o assistente virtual do escritório Fernando Oliveira Advocacia e Consultoria Jurídica (Brasília/DF), atendendo pelo WhatsApp pessoas que chegaram por anúncios ou indicação.

Seu trabalho é acolher a pessoa, entender o caso e fazer a triagem para o advogado, nas áreas atendidas:
- Previdenciário (INSS): aposentadorias, BPC/LOAS, auxílio por incapacidade (auxílio-doença), aposentadoria por invalidez, pensão por morte, salário-maternidade, auxílio-acidente, revisões, benefício negado ou cortado.
- Cível e Família: divórcio, guarda, pensão alimentícia, inventário, união estável, indenizações, acidentes de trânsito, contratos, cobranças e problemas de consumo.

Como conduzir:
- Na primeira resposta, cumprimente, diga que é o assistente virtual (uma inteligência artificial) do escritório e pergunte o nome da pessoa, se ainda não souber.
- Escreva como no WhatsApp: mensagens curtas, linguagem simples e acolhedora, no máximo 3 parágrafos curtos, sem markdown, sem listas longas. Faça uma pergunta por vez.
- Colete, ao longo da conversa: nome, cidade/UF, a área e um resumo do caso (o que aconteceu, quando, se já houve pedido no INSS ou processo, se há prazo ou audiência marcada), a urgência e o melhor horário para o advogado retornar.
- Quando tiver nome, área e um resumo suficiente, use a ferramenta registrar_lead. Depois diga que o Dr. Fernando ou a equipe vai entrar em contato pelo WhatsApp, no horário informado, e que a pessoa pode ir separando os documentos (você pode citar quais costumam ser úteis para o tipo de caso, de forma geral).
- Use transferir_para_humano quando: houver prazo correndo, audiência próxima, prisão, liminar de saúde ou outra urgência; a pessoa pedir para falar com o advogado; ela estiver muito angustiada; o assunto estiver fora das áreas atendidas e ela insistir; ou você não souber como seguir.

Regras éticas (Estatuto da OAB, Código de Ética e Provimento 205/2021 do CFOAB) e de privacidade:
- Não dê parecer jurídico, não diga se a pessoa tem ou não direito, não avalie chances e não prometa resultado. Explique que quem analisa o caso é o advogado.
- Não fale de valores de honorários nem de descontos; diga que o advogado explica na conversa.
- Não peça CPF, RG, senhas (como a do Meu INSS), dados bancários ou fotos de documentos pelo chat. Os documentos são tratados com o advogado.
- Não se passe por advogado nem por pessoa. Se perguntarem, confirme que é um assistente virtual com inteligência artificial.
- Se o assunto não for das áreas atendidas, explique com gentileza, registre o lead com a área "Outra" e diga que o advogado avalia se pode ajudar ou indicar um colega.
- Use as informações da pessoa só para este atendimento.`;

/** Ferramentas do agente. A de encaminhar só existe quando há especialistas ativos. */
function buildTools(attendants: Doc[]): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [
  {
    name: "registrar_lead",
    description: "Registra a pessoa como possível cliente no sistema do escritório (contato, card no CRM e tarefa de retorno para o advogado). Use quando já souber o nome, a área e tiver um resumo do caso. Pode ser chamada de novo para atualizar os dados.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome completo ou como a pessoa se apresentou" },
        cidade_uf: { type: "string", description: "Cidade e UF, ou vazio se não informou" },
        area: { type: "string", enum: ["Previdenciário", "Família", "Cível", "Outra"] },
        assunto: { type: "string", description: "Assunto em poucas palavras, ex.: BPC/LOAS negado, divórcio com filhos" },
        resumo: { type: "string", description: "Resumo objetivo do caso para o advogado, em 3 a 6 frases" },
        urgencia: { type: "string", enum: ["baixa", "media", "alta"] },
        melhor_horario: { type: "string", description: "Melhor horário para retorno, ou vazio" },
        beneficio: { type: "string", description: "Benefício ou assunto do especialista que atendeu, ou vazio" },
        triagem: {
          type: "array",
          description: "Cada pergunta do roteiro de triagem com a resposta da pessoa ('não informado' se ela não respondeu). Vazio se não houver roteiro.",
          items: {
            type: "object",
            properties: { pergunta: { type: "string" }, resposta: { type: "string" } },
            required: ["pergunta", "resposta"],
            additionalProperties: false,
          },
        },
      },
      required: ["nome", "cidade_uf", "area", "assunto", "resumo", "urgencia", "melhor_horario", "beneficio", "triagem"],
      additionalProperties: false,
    },
  },
  {
    name: "transferir_para_humano",
    description: "Passa a conversa para a equipe do escritório e desliga as respostas automáticas. Use em urgências, quando a pessoa pedir o advogado ou quando não souber como seguir.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string", description: "Por que a conversa precisa de uma pessoa da equipe" } },
      required: ["motivo"],
      additionalProperties: false,
    },
  },
  ];
  if (attendants.length) {
    tools.push({
      name: "encaminhar_especialista",
      description: `Passa a conversa para o agente especialista no assunto da pessoa. Use assim que entender o assunto (ou se ele mudar). Depois disso, você passa a seguir o roteiro desse especialista. Especialistas disponíveis:\n${attendants.map((a) => `- ${a.id}: ${a.benefit}`).join("\n")}`,
      strict: true,
      input_schema: {
        type: "object",
        properties: { especialista: { type: "string", enum: attendants.map((a) => a.id) } },
        required: ["especialista"],
        additionalProperties: false,
      },
    });
  }
  return tools;
}

// ---------- especialistas ----------
/** Escolhe o especialista: o que já conduz a conversa, o da campanha ou o que tiver mais palavras-chave nas mensagens. */
function chooseAttendant(conv: Doc, campaign: Doc | undefined, attendants: Doc[]): Doc | undefined {
  const byId = (id?: string) => (id ? attendants.find((a) => a.id === id) : undefined);
  const current = byId(conv.attendantId) ?? byId(campaign?.attendantId);
  if (current) return current;
  const text = ` ${norm(conv.messages.filter((m: Msg) => m.from === "cliente").map((m: Msg) => m.text).join(" ")).replace(/[^a-z0-9]+/g, " ")} `;
  const scored = attendants
    .map((a) => ({ a, n: String(a.keywords ?? "").split(",").map((k) => norm(k).replace(/[^a-z0-9]+/g, " ").trim()).filter(Boolean).filter((k) => text.includes(` ${k} `)).length }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n);
  if (!scored.length || (scored[1] && scored[1].n === scored[0].n)) return undefined; // empate: a IA decide
  return scored[0].a;
}

/** Texto que "treina" o agente no benefício (escrito pelo escritório na tela Agentes de atendimento). */
function specialistPrompt(a: Doc): string {
  const block = (title: string, text?: string) => (text && String(text).trim() ? `\n\n${title}\n${String(text).trim()}` : "");
  return `ESPECIALISTA NESTE ATENDIMENTO: ${a.name} (${a.benefit}, área ${a.area}).
Você está conduzindo agora um atendimento sobre ${a.benefit}. Siga as regras gerais acima e o roteiro abaixo.`
    + block("Conhecimento de apoio (para entender o caso e fazer as perguntas certas; nunca use para dizer se a pessoa tem direito):", a.knowledge)
    + block("Roteiro de triagem (uma pergunta por vez, com suas palavras; pule o que a pessoa já respondeu):", a.questions)
    + block("Documentos que costumam ser úteis (cite de forma geral, no fim; a pessoa não deve enviar pelo chat):", a.documents)
    + block("Use transferir_para_humano (ou registre com urgência alta, quando indicado) se:", a.redFlags)
    + block("Perguntas frequentes com respostas aprovadas pelo escritório (use estas respostas):", a.faq)
    + block("Orientações do escritório para este atendimento:", a.instructions)
    + `\n\nAo usar registrar_lead, preencha "beneficio" com "${a.benefit}" e "triagem" com cada pergunta do roteiro e a resposta da pessoa ("não informado" se ela não respondeu).
Se o assunto da pessoa for outro, use encaminhar_especialista (se houver um especialista adequado) ou siga a triagem geral.`;
}

/** Histórico da conversa no formato da API: cliente = user; IA e equipe = assistant; turnos seguidos do mesmo lado são unidos. */
function toApiMessages(messages: Msg[]): Anthropic.MessageParam[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages.slice(-MAX_HISTORY)) {
    if (m.from === "sistema") continue;
    const role = m.from === "cliente" ? "user" : "assistant";
    const text = m.from === "equipe" ? `(mensagem enviada por uma pessoa da equipe) ${m.text}` : m.text;
    const last = out.at(-1);
    if (last && last.role === role) last.content += `\n${text}`;
    else out.push({ role, content: text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

interface Ctx {
  ws: string; conv: Doc; settings: Doc | null; campaign?: Doc; attendants: Doc[];
  /** Simulação (tela de teste): nada é gravado; as ações ficam registradas aqui. */
  simulation?: string[];
}

async function registerLead(ctx: Ctx, input: any): Promise<string> {
  const { ws, conv, settings, campaign } = ctx;
  const triagem: { pergunta: string; resposta: string }[] = Array.isArray(input.triagem) ? input.triagem : [];
  conv.lead = {
    nome: input.nome, cidade: input.cidade_uf, area: input.area, assunto: input.assunto, resumo: input.resumo, urgencia: input.urgencia,
    melhorHorario: input.melhor_horario, beneficio: input.beneficio || undefined, triagem: triagem.length ? triagem : undefined, at: nowIso(),
  };
  if (ctx.simulation) {
    ctx.simulation.push(`Lead registrado (simulação): ${input.nome} · ${input.area} · ${input.assunto} · urgência ${input.urgencia}`);
    return "Lead registrado. A equipe foi avisada.";
  }
  const [contacts, users] = await Promise.all([getCollection(ws, "contacts"), getCollection(ws, "users")]);
  const taskTypes: any[] = settings?.taskTypes ?? [];
  const owner = users.find((u) => u.role === "Gestor" && u.active !== false) ?? users[0];
  const origin = campaign ? `WhatsApp - ${campaign.name}` : "WhatsApp";
  let contact = contacts.find((c) => conv.contactId === c.id) ?? contacts.find((c) => digits(c.phone).endsWith(digits(conv.phone).slice(-11)));
  const cidade = String(input.cidade_uf ?? "").trim();
  contact = {
    ...(contact ?? { id: rid("c"), document: "", email: "", birthDate: "", profession: "", address: "", createdAt: nowIso() }),
    name: contact?.name || input.nome,
    phone: contact?.phone || `+${conv.phone}`,
    city: contact?.city || cidade,
    origin: contact?.origin || origin,
    campaignId: contact?.campaignId ?? campaign?.id,
  } as Doc;

  // Card no funil Marketing do CRM (um por conversa; atualizado se a IA registrar de novo).
  const funnels: any[] = settings?.funnels ?? [];
  const marketing = funnels.find((f) => norm(f.name) === "marketing") ?? funnels[0];
  const groups: any[] = settings?.actionGroups ?? [];
  const areaGroup = groups.find((g) => norm(g.name).startsWith(norm(input.area).slice(0, 6))) ?? groups[0];
  const types = (settings?.actionTypes ?? []).filter((t: any) => t.groupId === areaGroup?.id);
  const ben = norm(input.beneficio || input.assunto || "");
  const type = types.find((t: any) => ben && (ben.includes(norm(t.name)) || norm(t.name).includes(ben))) ?? types[0];
  const existingCard = conv.processId ? await getDoc(ws, "processes", conv.processId) : null;
  const summary = `Lead do WhatsApp${campaign ? ` (campanha ${campaign.name})` : ""}. ${input.assunto}. Urgência: ${input.urgencia}. Retorno: ${input.melhor_horario || "não informado"}.\n${input.resumo}${triagem.length ? `\n\nTriagem${input.beneficio ? ` (${input.beneficio})` : ""}:\n${triagem.map((t) => `- ${t.pergunta} ${t.resposta}`).join("\n")}` : ""}`;
  const card: Doc = existingCard
    ? { ...existingCard, history: [...(existingCard.history ?? []), { id: rid("h"), date: nowIso(), text: `Triagem atualizada pela IA: ${summary}` }], unreadHistory: true }
    : {
      id: rid("pr"), number: "", contactIds: [contact.id], opposingParty: "", actionGroupId: areaGroup?.id ?? "", actionTypeId: type?.id ?? "",
      funnelId: marketing?.id ?? "", stageId: marketing?.stages?.[0]?.id ?? "", responsibleId: owner?.id ?? "", court: "", value: 0, status: "ativo",
      createdAt: nowIso(), movements: [], documents: [], unreadHistory: true, campaignId: campaign?.id, conversationId: conv.id,
      history: [{ id: rid("h"), date: nowIso(), text: summary }],
    };

  const retorno = taskTypes.find((t) => norm(t.name).includes("retorno")) ?? taskTypes[0];
  const due = new Date();
  due.setHours(due.getHours() + (input.urgencia === "alta" ? 1 : 4));
  const tasks: Doc[] = conv.leadTaskId ? [] : [{
    id: rid("tk"), title: `Retornar lead do WhatsApp: ${input.nome}`, typeId: retorno?.id ?? "", contactId: contact.id, processId: card.id,
    responsibleIds: owner ? [owner.id] : [], date: due.toISOString(), priority: input.urgencia === "alta", favorite: false, read: false,
    points: retorno?.points ?? 3, description: summary, reminder: "1h", status: "pendente", createdAt: nowIso(),
  }];

  await put(ws, "contacts", [contact]);
  await put(ws, "processes", [card]);
  await put(ws, "tasks", tasks);
  await put(ws, "notifications", [{ id: rid("n"), title: `Novo lead no WhatsApp: ${input.nome} (${input.area}${input.urgencia === "alta" ? ", urgente" : ""})`, createdAt: nowIso(), read: false, link: "/atendimento" }]);
  conv.contactId = contact.id;
  conv.processId = card.id;
  if (tasks[0]) conv.leadTaskId = tasks[0].id;
  conv.name = conv.name || input.nome;
  return "Lead registrado. A equipe foi avisada.";
}

async function handOff(ctx: Ctx, motivo: string): Promise<string> {
  if (ctx.simulation) {
    ctx.simulation.push(`Passaria para a equipe: ${motivo}`);
    ctx.conv.aiPaused = true;
    return "Conversa transferida. Avise a pessoa que alguém da equipe vai responder em breve.";
  }
  ctx.conv.aiPaused = true;
  ctx.conv.status = "humano";
  ctx.conv.handoffReason = motivo;
  ctx.conv.messages.push({ id: rid("m"), from: "sistema", text: `Conversa passada para a equipe: ${motivo}`, at: nowIso() } satisfies Msg);
  await put(ctx.ws, "notifications", [{ id: rid("n"), title: `WhatsApp: ${ctx.conv.name || ctx.conv.phone} precisa de atendimento humano (${motivo})`, createdAt: nowIso(), read: false, link: "/atendimento" }]);
  return "Conversa transferida. Avise a pessoa que alguém da equipe vai responder em breve.";
}

function routeTo(ctx: Ctx, id: string): string {
  const a = ctx.attendants.find((x) => x.id === id);
  if (!a) return "Especialista não encontrado. Siga a triagem geral.";
  if (ctx.conv.attendantId !== a.id) {
    ctx.conv.attendantId = a.id;
    if (ctx.simulation) ctx.simulation.push(`Encaminhada para: ${a.name}`);
    else ctx.conv.messages.push({ id: rid("m"), from: "sistema", text: `Atendimento direcionado para ${a.name}`, at: nowIso() } satisfies Msg);
  }
  return `Pronto. Agora você é o ${a.name}. Continue a conversa seguindo o roteiro dele, sem repetir o que a pessoa já respondeu e sem anunciar a troca.`;
}

/** Gera a resposta da IA (com até 4 rodadas de ferramentas) e devolve o texto para enviar. */
async function agentReply(ctx: Ctx): Promise<string> {
  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  const agent = ctx.settings?.agent ?? {};
  const dynamic = [
    `Data e hora agora (Brasília): ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
    agent.officeHours && `Horário de atendimento da equipe: ${agent.officeHours}.`,
    ctx.campaign && `A pessoa chegou pela campanha "${ctx.campaign.name}"${ctx.campaign.area ? `, sobre ${ctx.campaign.area}` : ""}. Use isso para contextualizar, sem citar o nome da campanha.`,
    ctx.conv.referral?.headline && `Anúncio clicado: "${ctx.conv.referral.headline}".`,
    ctx.conv.lead && `Lead já registrado: ${JSON.stringify(ctx.conv.lead)}. Não repita perguntas já respondidas.`,
    agent.instructions && `Instruções do escritório: ${agent.instructions}`,
  ].filter(Boolean).join("\n");

  const messages = toApiMessages(ctx.conv.messages);
  if (!messages.length) return "";
  const tools = buildTools(ctx.attendants);
  // Já tem especialista (conversa, campanha ou palavras-chave)? Ele conduz desde a primeira resposta.
  const first = chooseAttendant(ctx.conv, ctx.campaign, ctx.attendants);
  if (first && ctx.conv.attendantId !== first.id) routeTo(ctx, first.id);
  let finalText = "";
  for (let round = 0; round < 5; round++) {
    const specialist = ctx.attendants.find((a) => a.id === ctx.conv.attendantId);
    const system: any[] = [{ type: "text", text: STATIC_PROMPT, cache_control: { type: "ephemeral" } }];
    if (specialist) system.push({ type: "text", text: specialistPrompt(specialist), cache_control: { type: "ephemeral" } });
    else if (ctx.attendants.length) system.push({ type: "text", text: "Ainda não há especialista neste atendimento. Descubra o assunto da pessoa e use encaminhar_especialista assim que possível." });
    system.push({ type: "text", text: dynamic });
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      // @ts-ignore parâmetro de fallback do lado do servidor (forma "default"); a tipagem do SDK pode não ter
      fallbacks: "default",
      output_config: { effort: "low" },
      system,
      tools,
      messages,
    });
    if (response.stop_reason === "refusal") {
      await handOff(ctx, "a IA não pôde responder a esta mensagem");
      return agent.handoffMessage || "Obrigado pela mensagem! Vou passar sua conversa para a equipe do escritório, que responde por aqui em breve.";
    }
    const text = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    if (text) finalText = text;
    const toolUses = response.content.filter((b: any) => b.type === "tool_use") as any[];
    if (response.stop_reason !== "tool_use" || !toolUses.length) break;
    messages.push({ role: "assistant", content: response.content as any });
    const results: any[] = [];
    for (const tu of toolUses) {
      let result: string;
      try {
        result = tu.name === "registrar_lead" ? await registerLead(ctx, tu.input)
          : tu.name === "transferir_para_humano" ? await handOff(ctx, String(tu.input?.motivo ?? ""))
          : tu.name === "encaminhar_especialista" ? routeTo(ctx, String(tu.input?.especialista ?? ""))
          : "Ferramenta desconhecida.";
        results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: tu.id, content: `Erro: ${(e as Error).message}`, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return finalText;
}

// ---------- mensagens recebidas ----------
async function handleInbound(ws: string, value: any) {
  const settings = await getDoc(ws, "settings", "main");
  const campaigns = (await getCollection(ws, "campaigns")).filter((c) => c.status !== "encerrada");
  const attendants = (await getCollection(ws, "attendants")).filter((a) => a.active !== false);
  const names = new Map((value.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name]));

  for (const m of value.messages ?? []) {
    const phone = String(m.from);
    const convId = `wa_${phone}`;
    const conv: Doc = (await getDoc(ws, "conversations", convId)) ?? {
      id: convId, channel: "whatsapp", phone, name: names.get(phone) ?? "", status: "ia", aiPaused: settings?.agent?.enabled === false,
      messages: [], createdAt: nowIso(),
    };
    if (conv.messages.some((x: Msg) => x.waId === m.id)) continue; // a Meta reenviou: já tratada
    const text = textOf(m);
    conv.name = conv.name || (names.get(phone) as string) || "";
    conv.messages.push({ id: rid("m"), from: "cliente", text, at: new Date(Number(m.timestamp) * 1000 || Date.now()).toISOString(), waId: m.id } satisfies Msg);
    conv.lastInboundAt = nowIso();
    conv.lastMessageAt = nowIso();
    if (m.referral && !conv.referral) conv.referral = { sourceId: m.referral.source_id, sourceType: m.referral.source_type, sourceUrl: m.referral.source_url, headline: m.referral.headline, ctwaClid: m.referral.ctwa_clid };
    let campaign = conv.campaignId ? campaigns.find((c) => c.id === conv.campaignId) : undefined;
    if (!campaign) {
      campaign = matchCampaign(campaigns, text, m.referral);
      if (campaign) conv.campaignId = campaign.id;
    }
    waMarkRead(m.id);

    const aiOn = !conv.aiPaused && settings?.agent?.enabled !== false && env("ANTHROPIC_API_KEY");
    if (aiOn) {
      try {
        const reply = await agentReply({ ws, conv, settings, campaign, attendants });
        if (reply) {
          const waId = await waSend(phone, reply);
          conv.messages.push({ id: rid("m"), from: "ia", text: reply, at: nowIso(), waId } satisfies Msg);
          conv.lastMessageAt = nowIso();
        }
      } catch (e) {
        conv.messages.push({ id: rid("m"), from: "sistema", text: `A IA não respondeu (${(e as Error).message}). Responda pela tela de Atendimento.`, at: nowIso() } satisfies Msg);
        conv.status = "humano";
        await put(ws, "notifications", [{ id: rid("n"), title: `WhatsApp: a IA não respondeu ${conv.name || phone}. Responda pela tela de Atendimento.`, createdAt: nowIso(), read: false, link: "/atendimento" }]);
      }
    } else if (conv.messages.filter((x: Msg) => x.from === "cliente").length === 1) {
      await put(ws, "notifications", [{ id: rid("n"), title: `Nova conversa no WhatsApp: ${conv.name || phone}`, createdAt: nowIso(), read: false, link: "/atendimento" }]);
    }
    conv.messages = conv.messages.slice(-MAX_STORED);
    await put(ws, "conversations", [conv]);
  }
}

// ---------- entrada ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);

  // Confirmação do webhook pela Meta.
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && env("WHATSAPP_VERIFY_TOKEN") && url.searchParams.get("hub.verify_token") === env("WHATSAPP_VERIFY_TOKEN");
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("Token de verificação inválido", { status: 403 });
  }

  const raw = await req.text();

  // Evento da Meta: confere a assinatura, responde na hora e processa em segundo plano.
  if (req.headers.has("x-hub-signature-256")) {
    if (!(await validSignature(raw, req.headers.get("x-hub-signature-256")))) return new Response("assinatura inválida", { status: 401 });
    const payload = JSON.parse(raw || "{}");
    const work = (async () => {
      const ws = await resolveWorkspace();
      if (!ws) return console.error("WhatsApp: defina WHATSAPP_WORKSPACE_ID (há mais de um escritório).");
      for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
        if (change.field === "messages" && change.value?.messages?.length) await handleInbound(ws, change.value).catch((e) => console.error("WhatsApp:", e));
      }
    })();
    // @ts-ignore EdgeRuntime existe no Supabase
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work); else await work;
    return new Response("ok", { status: 200 });
  }

  // Chamadas do sistema (usuário logado e membro do escritório).
  try {
    const body = JSON.parse(raw || "{}");
    const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: auth } = await admin.auth.getUser(jwt);
    if (!auth?.user) return json({ error: "Entre no sistema." }, 401);
    const ws = String(body.workspaceId ?? "");
    const { data: member } = await admin.from("members").select("user_id").eq("workspace_id", ws).eq("user_id", auth.user.id).maybeSingle();
    if (!member) return json({ error: "Sem acesso a este escritório." }, 403);

    if (body.action === "status") {
      const target = await resolveWorkspace();
      // Testa a chave da IA de verdade (listar modelos não gasta créditos).
      let anthropic = false, anthropicError = "";
      if (!env("ANTHROPIC_API_KEY")) anthropicError = "não cadastrada";
      else {
        const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": env("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01" } }).catch(() => null);
        anthropic = !!r?.ok;
        if (!anthropic) anthropicError = r?.status === 401 ? "a Anthropic recusou a chave (inválida ou apagada)" : r?.status === 403 ? "a chave não tem permissão" : `erro ${r?.status ?? "de rede"}`;
      }
      return json({
        anthropic, anthropicError, token: !!env("WHATSAPP_TOKEN"), phoneNumberId: !!env("WHATSAPP_PHONE_NUMBER_ID"),
        appSecret: !!env("WHATSAPP_APP_SECRET"), verifyToken: !!env("WHATSAPP_VERIFY_TOKEN"), workspaceOk: target === ws, workspaceId: ws,
        webhookUrl: `${env("SUPABASE_URL")}/functions/v1/whatsapp`,
      });
    }

    // Teste de um agente: conversa de mentira, nada é gravado nem enviado.
    if (body.action === "simulate") {
      if (!env("ANTHROPIC_API_KEY")) return json({ error: "Falta a chave da Anthropic (segredo ANTHROPIC_API_KEY)." }, 400);
      const settings = await getDoc(ws, "settings", "main");
      const all = await getCollection(ws, "attendants");
      const attendants = all.filter((a) => a.active !== false || a.id === body.attendantId);
      const history = (Array.isArray(body.messages) ? body.messages : []).slice(-MAX_HISTORY);
      const conv: Doc = {
        id: "simulacao", phone: "5561900000000", name: "", status: "ia", aiPaused: false, attendantId: body.attendantId || undefined,
        messages: history.map((m: any) => ({ id: rid("m"), from: m.from === "cliente" ? "cliente" : "ia", text: String(m.text ?? "").slice(0, 4000), at: nowIso() })),
      };
      const simulation: string[] = [];
      let reply: string;
      try {
        reply = await agentReply({ ws, conv, settings, attendants, simulation });
      } catch (e) {
        const st = (e as any)?.status;
        return json({ error: st === 401 ? "A Anthropic recusou a chave da IA (ANTHROPIC_API_KEY). Crie uma chave nova no console da Anthropic, atualize o segredo no GitHub e rode o workflow “Configurar Supabase”." : st === 400 && /credit/i.test(String((e as Error).message)) ? "A conta da Anthropic está sem créditos (console.anthropic.com → Billing)." : `A IA não respondeu: ${(e as Error).message}` }, 400);
      }
      return json({ reply, events: simulation, attendantId: conv.attendantId ?? null, lead: conv.lead ?? null, handedOff: !!conv.aiPaused });
    }

    const conv = await getDoc(ws, "conversations", String(body.conversationId ?? ""));
    if (!conv) return json({ error: "Conversa não encontrada." }, 404);

    if (body.action === "setAttendant") {
      const a = body.attendantId ? (await getCollection(ws, "attendants")).find((x) => x.id === body.attendantId) : undefined;
      conv.attendantId = a?.id;
      conv.messages.push({ id: rid("m"), from: "sistema", text: a ? `Atendimento direcionado para ${a.name}` : "Atendimento voltou para a triagem geral.", at: nowIso() } satisfies Msg);
      await put(ws, "conversations", [conv]);
      return json({ ok: true });
    }

    if (body.action === "setAi") {
      conv.aiPaused = !body.enabled;
      conv.status = body.enabled ? "ia" : "humano";
      conv.messages.push({ id: rid("m"), from: "sistema", text: body.enabled ? "IA reativada nesta conversa." : "Atendimento assumido pela equipe. A IA não responde até ser reativada.", at: nowIso() } satisfies Msg);
      await put(ws, "conversations", [conv]);
      return json({ ok: true });
    }

    if (body.action === "send") {
      const text = String(body.text ?? "").trim();
      if (!text) return json({ error: "Escreva a mensagem." }, 400);
      // Fora de 24 h da última mensagem do cliente, a Meta só aceita modelos aprovados.
      if (!conv.lastInboundAt || Date.now() - new Date(conv.lastInboundAt).getTime() > 24 * 3600e3) {
        return json({ error: "Já passaram 24 horas da última mensagem do cliente. Pela regra do WhatsApp, só é possível responder depois que ele escrever de novo (ou com um modelo aprovado pela Meta)." }, 400);
      }
      const waId = await waSend(conv.phone, text);
      const user = (await getCollection(ws, "users")).find((u) => u.authId === auth.user!.id);
      conv.messages.push({ id: rid("m"), from: "equipe", text, at: nowIso(), waId, by: user?.name } satisfies Msg);
      conv.lastMessageAt = nowIso();
      if (!conv.aiPaused) { conv.aiPaused = true; conv.status = "humano"; }
      await put(ws, "conversations", [conv]);
      return json({ ok: true });
    }
    return json({ error: "ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
