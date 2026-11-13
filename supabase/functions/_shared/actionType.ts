// Classificação do tipo de ação a partir dos dados do DJEN/DataJud.
// Usado pela função "tribunais" (servidor) e pelo sistema (reclassificação dos processos já cadastrados).
// Sem dependências: roda em Deno, no navegador e no Node.
//
// Regra de ouro: só escolhe um tipo quando há evidência específica (classe, assunto ou expressão
// inequívoca no texto) e ela não contradiz a área indicada pelas partes/órgão. Na dúvida, "A classificar".

export const UNCLASSIFIED_GROUP_ID = "g_aclassificar";
export const UNCLASSIFIED_TYPE_ID = "a_aclassificar";
export const UNCLASSIFIED_NAME = "A classificar";

export interface Named { id: string; name: string }
export interface TypeRow extends Named { groupId: string }
export interface PartyRow { nome: string; polo?: string }

export interface ClassifyInput {
  className?: string;
  /** Assuntos (DataJud) ou extraídos do texto ("Assunto: ..."). */
  subjects?: string[];
  orgao?: string;
  court?: string;
  parties?: PartyRow[];
  /** Texto livre das partes, quando não há a lista. */
  partiesText?: string;
  /** Textos das publicações. */
  texts?: string[];
}

export interface Classification {
  groupId: string;
  typeId: string;
  /** true = correspondência segura; false = gravar "A classificar" e marcar "A revisar". */
  sure: boolean;
  /** Área identificada (mesmo sem tipo seguro). */
  area?: Area;
  reason: string;
}

type Area = "previdenciario" | "consumidor" | "familia" | "trabalhista" | "civel";

export const norm = (s: string) =>
  ` ${String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

const AREA_GROUP: Record<Area, RegExp> = {
  previdenciario: /^ previd/,
  consumidor: /^ consum/,
  familia: /^ famil/,
  trabalhista: /^ trabalh/,
  civel: /^ civel/,
};

const AREA_LABEL: Record<Area, string> = {
  previdenciario: "Previdenciário", consumidor: "Consumidor", familia: "Família", trabalhista: "Trabalhista", civel: "Cível",
};

/**
 * Conceitos reconhecíveis. `evidence` procura nos dados do processo; `type` procura o tipo correspondente
 * na tabela de Tipos de ação do escritório. `textOk`: a expressão é específica o bastante para valer
 * mesmo quando aparece só no texto da publicação (e não na classe/assunto).
 */
const CONCEPTS: { key: string; area: Area; evidence: RegExp; type: RegExp; textOk: boolean }[] = [
  { key: "auxílio por incapacidade", area: "previdenciario", evidence: / auxilio doenca | auxilio por incapacidade | incapacidade temporaria | beneficio por incapacidade /, type: / auxilio doenca | incapacidade temporaria | auxilio por incapacidade /, textOk: true },
  { key: "aposentadoria por invalidez", area: "previdenciario", evidence: / aposentadoria por invalidez | incapacidade permanente /, type: / invalidez | incapacidade permanente /, textOk: true },
  { key: "auxílio-acidente", area: "previdenciario", evidence: / auxilio acidente /, type: / auxilio acidente /, textOk: true },
  { key: "BPC/LOAS", area: "previdenciario", evidence: / beneficio assistencial | loas | bpc | amparo assistencial | amparo social /, type: / bpc | loas | assistencial /, textOk: true },
  { key: "salário-maternidade", area: "previdenciario", evidence: / salario maternidade /, type: / maternidade /, textOk: true },
  { key: "pensão por morte", area: "previdenciario", evidence: / pensao por morte /, type: / pensao por morte /, textOk: true },
  { key: "aposentadoria especial", area: "previdenciario", evidence: / aposentadoria especial /, type: / aposentadoria especial /, textOk: true },
  { key: "aposentadoria por tempo de contribuição", area: "previdenciario", evidence: / aposentadoria por tempo | tempo de contribuicao /, type: / tempo de contribuicao /, textOk: true },
  { key: "aposentadoria por idade", area: "previdenciario", evidence: / aposentadoria por idade | aposentadoria rural | aposentadoria hibrida /, type: / aposentadoria por idade /, textOk: true },
  // "alimentos" sozinho é ambíguo no texto; vale pela classe/assunto ou por expressões completas.
  { key: "alimentos", area: "familia", evidence: / alimentos /, type: / alimentos /, textOk: false },
  { key: "alimentos", area: "familia", evidence: / acao de alimentos | pensao alimenticia | execucao de alimentos | oferta de alimentos | revisional de alimentos | exoneracao de alimentos /, type: / alimentos /, textOk: true },
  { key: "divórcio", area: "familia", evidence: / divorcio /, type: / divorcio /, textOk: true },
  { key: "guarda", area: "familia", evidence: / guarda de menor | guarda unilateral | guarda compartilhada | regulamentacao de visitas /, type: / guarda | visita /, textOk: true },
  { key: "união estável", area: "familia", evidence: / uniao estavel /, type: / uniao estavel /, textOk: true },
  { key: "inventário", area: "familia", evidence: / inventario | arrolamento /, type: / inventario | arrolamento /, textOk: false },
  { key: "atraso/cancelamento de voo", area: "consumidor", evidence: / atraso de voo | voo atrasado | cancelamento de voo | voo cancelado | overbooking | preterição de embarque | pretericao de embarque /, type: / atraso | cancelamento | overbooking /, textOk: true },
  { key: "extravio de bagagem", area: "consumidor", evidence: / extravio de bagagem | bagagem extraviada | dano a bagagem /, type: / bagagem /, textOk: true },
  { key: "negativação indevida", area: "consumidor", evidence: / negativacao | inscricao indevida | cadastro de inadimplentes | cadastros de inadimplentes | protesto indevido /, type: / negativa /, textOk: true },
  { key: "acidente de trânsito", area: "civel", evidence: / acidente de transito | colisao de veiculo | acidente automobilistico /, type: / transito /, textOk: true },
  { key: "cobrança", area: "civel", evidence: / cobranca | monitoria /, type: / cobranca | monitoria /, textOk: false },
  { key: "reclamação trabalhista", area: "trabalhista", evidence: / reclamacao trabalhista | acao trabalhista /, type: / trabalhista /, textOk: false },
];

/** Qualificadores opostos: um tipo "consensual" não recebe um caso "litigioso", e vice-versa. */
const OPPOSITES: [RegExp, RegExp][] = [[/ consensual /, / litigios[oa] /], [/ urbana /, / rural /], [/ concessao /, / revisao /]];
const contradicts = (typeName: string, evidence: string) =>
  OPPOSITES.some(([a, b]) => (a.test(typeName) && b.test(evidence) && !a.test(evidence)) || (b.test(typeName) && a.test(evidence) && !b.test(evidence)));

const AIRLINES = / latam | tam linhas | gol linhas | azul linhas | linhas aereas | transportes aereos | airlines | airline | air france | tap air | tap transportes | avianca | iberia | aerolineas | passaredo | voepass | emirates | klm | lufthansa | air europa | qatar airways /;

/** Extrai "Assunto: ..." de textos de intimação, quando o tribunal informa. */
export function subjectsFromText(text: string): string[] {
  const out: string[] = [];
  for (const m of String(text ?? "").matchAll(/assuntos?\s*:\s*([^\n\r;|]{3,120})/gi)) out.push(m[1].trim());
  return out;
}

/** Área do direito pelas partes e pelo órgão. */
function detectArea(input: ClassifyInput): { area?: Area; reason?: string } {
  const partyNames = (input.parties ?? []).map((p) => ({ n: norm(p.nome), passive: /^ ?p/.test(norm(p.polo ?? "")) }));
  const partiesBlob = norm(`${partyNames.map((p) => p.n).join(" ")} ${input.partiesText ?? ""}`);
  const orgao = norm(input.orgao ?? "");
  const court = norm(input.court ?? "");
  if (/ inss | instituto nacional do seguro social /.test(partiesBlob)) return { area: "previdenciario", reason: "INSS é parte" };
  if (/ vara de familia | vara da familia | familia e orfaos | familia e sucessoes /.test(orgao)) return { area: "familia", reason: "Vara de Família" };
  if (AIRLINES.test(partiesBlob)) return { area: "consumidor", reason: "companhia aérea é parte" };
  if (/ vara do trabalho /.test(orgao) || /^ trt/.test(court)) return { area: "trabalhista", reason: "Justiça do Trabalho" };
  return {};
}

export function classifyAction(input: ClassifyInput, groups: Named[], types: TypeRow[]): Classification {
  const realTypes = types.filter((t) => t.id !== UNCLASSIFIED_TYPE_ID);
  const groupOf = (area: Area) => groups.find((g) => AREA_GROUP[area].test(norm(g.name)));
  const { area: hintArea, reason: hintReason } = detectArea(input);

  const strong = norm([input.className, ...(input.subjects ?? []), ...subjectsFromText((input.texts ?? []).join("\n"))].filter(Boolean).join(" | "));
  const text = norm((input.texts ?? []).join(" ").slice(0, 20000));

  // Tipos candidatos: { tipo, de onde veio a evidência }
  const found = new Map<string, { type: TypeRow; strong: boolean; concept: string; area: Area }>();
  const conceptAreas: { area: Area; strong: boolean; concept: string }[] = [];
  for (const c of CONCEPTS) {
    const inStrong = c.evidence.test(strong);
    const inText = c.textOk && c.evidence.test(text);
    if (!inStrong && !inText) continue;
    conceptAreas.push({ area: c.area, strong: inStrong, concept: c.key });
    const g = groupOf(c.area);
    const source = inStrong ? strong : text;
    const candidates = realTypes.filter((t) => c.type.test(norm(t.name)) && (!g || t.groupId === g.id) && !contradicts(norm(t.name), source));
    for (const t of candidates) {
      const prev = found.get(t.id);
      if (!prev || (inStrong && !prev.strong)) found.set(t.id, { type: t, strong: inStrong, concept: c.key, area: c.area });
    }
  }
  // Nome do tipo escrito por extenso na classe/assunto (tipos que o escritório criou).
  for (const t of realTypes) {
    const n = norm(t.name.replace(/\(.*?\)/g, " "));
    if (n.trim().length >= 8 && strong.includes(n) && !found.has(t.id)) {
      const g = groups.find((x) => x.id === t.groupId);
      const area = (Object.keys(AREA_GROUP) as Area[]).find((a) => g && AREA_GROUP[a].test(norm(g.name)));
      if (area) found.set(t.id, { type: t, strong: true, concept: t.name, area });
    }
  }

  // Área final: a das partes/órgão manda; sem ela, a do conceito mais forte (se não houver conflito).
  let area = hintArea;
  let areaReason = hintReason;
  if (!area) {
    const areas = new Set(conceptAreas.filter((c) => c.strong).map((c) => c.area));
    const pool = areas.size ? areas : new Set(conceptAreas.map((c) => c.area));
    if (pool.size === 1) {
      area = [...pool][0];
      areaReason = `${conceptAreas.find((c) => c.area === area)!.concept} na classe/assunto/texto`;
    }
  }

  let candidates = [...found.values()].filter((f) => !area || f.area === area);
  if (candidates.some((c) => c.strong)) candidates = candidates.filter((c) => c.strong);
  const distinct = [...new Map(candidates.map((c) => [c.type.id, c])).values()];

  const areaGroup = area ? groupOf(area) : undefined;
  if (distinct.length === 1) {
    const c = distinct[0];
    const where = c.strong ? "na classe/assunto" : "no texto da publicação";
    return {
      groupId: c.type.groupId, typeId: c.type.id, sure: true, area,
      reason: `${c.type.name}: "${c.concept}" ${where}${hintReason ? `; ${hintReason}` : ""}`,
    };
  }
  const why = distinct.length > 1
    ? `mais de um tipo possível (${distinct.map((d) => d.type.name).join(", ")})`
    : area
      ? `área ${AREA_LABEL[area]} (${areaReason}), mas sem tipo correspondente na tabela de Tipos de ação`
      : "sem classe, assunto ou parte que indique o tipo";
  return { groupId: areaGroup?.id ?? UNCLASSIFIED_GROUP_ID, typeId: UNCLASSIFIED_TYPE_ID, sure: false, area, reason: why };
}

/** Garante o grupo e o tipo "A classificar" na tabela (no fim da lista, para nunca virar o "primeiro"). */
export function ensureUnclassified<G extends Named, T extends TypeRow>(groups: G[], types: T[]): { actionGroups: G[]; actionTypes: T[]; changed: boolean } {
  let changed = false;
  let actionGroups = groups;
  let actionTypes = types;
  if (!groups.some((g) => g.id === UNCLASSIFIED_GROUP_ID)) {
    actionGroups = [...groups, { id: UNCLASSIFIED_GROUP_ID, name: UNCLASSIFIED_NAME } as G];
    changed = true;
  }
  if (!types.some((t) => t.id === UNCLASSIFIED_TYPE_ID)) {
    actionTypes = [...types, { id: UNCLASSIFIED_TYPE_ID, name: UNCLASSIFIED_NAME, groupId: UNCLASSIFIED_GROUP_ID } as T];
    changed = true;
  }
  return { actionGroups, actionTypes, changed };
}
