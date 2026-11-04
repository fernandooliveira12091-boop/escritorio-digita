import { callFunction } from "./functions";

const OFFLINE = "O atendimento pelo WhatsApp funciona no sistema online, com login.";
const call = <T,>(body: Record<string, unknown>) => callFunction<T>("whatsapp", body, OFFLINE);

export interface WhatsappStatus {
  anthropic: boolean;
  token: boolean;
  phoneNumberId: boolean;
  appSecret: boolean;
  verifyToken: boolean;
  workspaceOk: boolean;
  webhookUrl: string;
}

export const whatsappStatus = () => call<WhatsappStatus>({ action: "status" });
export const sendWhatsapp = (conversationId: string, text: string) => call<{ ok: true }>({ action: "send", conversationId, text });
export const setConversationAi = (conversationId: string, enabled: boolean) => call<{ ok: true }>({ action: "setAi", conversationId, enabled });

/** Link do WhatsApp com a mensagem inicial e o código da campanha, para usar no anúncio. */
export function campaignLink(number: string, code: string) {
  const text = `Olá! Vi o anúncio e gostaria de atendimento. [${code}]`;
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export const setConversationAttendant = (conversationId: string, attendantId: string) => call<{ ok: true }>({ action: "setAttendant", conversationId, attendantId });

export interface SimulationResult {
  reply: string;
  events: string[];
  attendantId: string | null;
  lead: { nome: string; area: string; assunto: string; urgencia: string; beneficio?: string; triagem?: { pergunta: string; resposta: string }[] } | null;
  handedOff: boolean;
}
/** Conversa de teste com um agente: usa a IA de verdade, mas nada é gravado nem enviado pelo WhatsApp. */
export const simulateAgent = (attendantId: string, messages: { from: "cliente" | "ia"; text: string }[]) =>
  callFunction<SimulationResult>("whatsapp", { action: "simulate", attendantId, messages }, "O teste do agente usa a IA do sistema online. Entre com login para testar.");
