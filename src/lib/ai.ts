import type { Agent, ChatMessage } from "../types";

type SampleFn = ((input: { role: "user" | "assistant"; content: string }[], opts?: { onText?: (e: { text: string }) => void }) => Promise<{ text: string }>);
type ClaudeHost = { use?: (name: string) => Promise<unknown> };

let samplePromise: Promise<SampleFn | null> | null = null;
/** Acesso ao Claude quando o sistema roda dentro do claude.ai; fora dele, null. */
export function getSample() {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (!host?.use) return Promise.resolve(null);
  samplePromise ??= host.use("sample").then((s) => (s as SampleFn) ?? null).catch(() => null);
  return samplePromise;
}

const instructions = (agent: Agent) =>
  `Você é o ${agent.name}, assistente jurídico de um escritório de advocacia brasileiro, especialista em ${agent.area} (${agent.description}). ` +
  "Escreva em português do Brasil, com linguagem técnica e clara, citando a legislação brasileira aplicável (CF, CPC, CC, CDC, CLT e leis especiais) e só jurisprudência que você tenha certeza de que existe. " +
  "Quando pedirem uma peça, entregue o texto completo e estruturado (endereçamento, qualificação com campos entre colchetes, fatos, direito, pedidos, valor da causa, fecho). " +
  "Não use markdown com asteriscos; use títulos em caixa alta. Ao final, lembre em uma linha que o texto deve ser revisado pelo advogado responsável.";

export async function askAgent(agent: Agent, history: ChatMessage[], onText: (t: string) => void): Promise<string> {
  const sample = await getSample();
  if (sample) {
    const msgs = history.map((m) => ({ role: m.role, content: m.text }));
    msgs[0] = { role: "user", content: `${instructions(agent)}\n\nPedido: ${msgs[0].content}` };
    const r = await sample(msgs, { onText: (e) => onText(e.text) });
    return r.text;
  }
  // Fora do claude.ai: rascunho estruturado para o advogado completar.
  const ask = history.filter((m) => m.role === "user").at(-1)?.text ?? "";
  const text = `MINUTA: ${ask.toUpperCase().slice(0, 80)}\n\nEXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA ___\n\n[NOME DO CLIENTE], [qualificação], vem, por seu advogado, propor a presente ação em face de [PARTE CONTRÁRIA], pelos fatos e fundamentos a seguir.\n\nI. DOS FATOS\n[Descreva os fatos relacionados a: ${ask}]\n\nII. DO DIREITO\n[Fundamentação na área de ${agent.area}.]\n\nIII. DOS PEDIDOS\na) [pedido principal];\nb) a condenação da parte ré nas custas e honorários.\n\nDá-se à causa o valor de R$ [valor].\n\nNestes termos, pede deferimento.\n\n[Cidade], [data].\n\n[Advogado(a)] – OAB/[UF] [número]\n\nObservação: este é um rascunho de estrutura. Para o texto completo gerado pelo agente, abra o sistema dentro do claude.ai.`;
  onText(text);
  return text;
}
