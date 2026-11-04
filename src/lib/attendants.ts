import type { Attendant } from "../types";

type Base = Omit<Attendant, "id" | "active" | "createdAt" | "updatedAt">;

/** Respostas aprovadas que valem para todos os agentes. */
const FAQ_COMUM = `P: Quanto custa? / Quais são os honorários?
R: Quem explica os honorários é o advogado, na conversa, depois de entender o seu caso.
P: Vocês garantem que eu vou ganhar?
R: Nenhum advogado pode garantir resultado. O que o Dr. Fernando faz é analisar o seu caso com cuidado e explicar com clareza os caminhos possíveis.
P: Preciso mandar meus documentos agora?
R: Não precisa mandar por aqui. Depois da conversa com o advogado, ele orienta como entregar os documentos com segurança.`;

const BASE: Base[] = [
  {
    name: "Especialista em Salário-maternidade",
    benefit: "Salário-maternidade",
    area: "Previdenciário",
    color: "#EC4899",
    keywords: "salario maternidade, salario-maternidade, auxilio maternidade, licenca maternidade, gravida, gestante, gestacao, parto, ganhei bebe, bebe nasceu, nenem, adocao, adotei",
    knowledge: `Benefício do INSS pago por parto, adoção, guarda judicial para fins de adoção ou aborto não criminoso.
Pode ser pedido a partir de 28 dias antes do parto. Quem tem carteira assinada em regra recebe pela empresa; os casos que chegam ao escritório costumam ser de desempregadas, MEI e autônomas, trabalhadoras rurais (segurada especial) e pedidos negados.
O advogado avalia principalmente: se a pessoa ainda era segurada do INSS na data do parto (quando terminou o último emprego ou a última contribuição), qual o tipo de segurada (empregada, desempregada, MEI/contribuinte individual, facultativa, rural) e se já houve pedido anterior.
Na trabalhadora rural, o que conta é o trabalho no campo em regime de economia familiar, provado por documentos e testemunhas.`,
    questions: `O bebê já nasceu? Qual a data do parto (ou a data prevista, ou a data da adoção)?
No último ano antes do parto, a senhora trabalhava de carteira assinada, era MEI ou autônoma, trabalhava na roça ou estava desempregada?
Se teve carteira assinada: quando saiu do último emprego e como foi a saída (pediu demissão ou foi demitida)?
Pagava o INSS por conta própria (carnê ou MEI)? Desde quando e está em dia?
Se trabalha na roça: o que planta ou cria, em que cidade, desde quando e com quem trabalha?
Já pediu o salário-maternidade no INSS? Se sim, foi negado? Quando e por qual motivo?`,
    documents: `Certidão de nascimento do bebê (ou termo de guarda/adoção)
Carteira de trabalho e termo de rescisão, se teve emprego
Comprovantes de pagamento do INSS ou do MEI
Na roça: documentos da terra, notas de venda, declaração do sindicato rural, cadastro de agricultor
Carta do INSS, se o pedido foi negado`,
    redFlags: `Pedido negado há menos de 30 dias (prazo de recurso correndo)
Parto há mais de 4 anos e meio
Gestante em situação de risco, violência ou sem nenhuma renda
A pessoa pede para falar com o advogado`,
    faq: FAQ_COMUM,
    instructions: "Trate a cliente por senhora até ela dizer como prefere. Parabenize pelo bebê quando ela contar que já nasceu.",
  },
  {
    name: "Especialista em BPC/LOAS",
    benefit: "BPC/LOAS",
    area: "Previdenciário",
    color: "#8B5CF6",
    keywords: "bpc, loas, beneficio assistencial, amparo assistencial, amparo social, deficiencia, deficiente, pcd, autismo, autista, tea, cadunico, cad unico, 65 anos, idoso sem aposentadoria",
    knowledge: `Benefício assistencial de um salário mínimo por mês para pessoa idosa (65 anos ou mais) ou pessoa com deficiência (impedimento de longo prazo físico, mental, intelectual ou sensorial) de família de baixa renda.
Não é preciso ter contribuído para o INSS. Não paga 13º e não deixa pensão.
O INSS olha a renda por pessoa da família que mora na mesma casa (o critério da lei é de até 1/4 do salário mínimo por pessoa, mas a vulnerabilidade pode ser provada de outras formas) e exige inscrição no CadÚnico atualizada.
Para pessoa com deficiência há avaliação médica e social no INSS.`,
    questions: `O benefício é para quem? Para a própria pessoa ou para um familiar (filho, pai, mãe)?
É por idade (quantos anos tem) ou por deficiência ou doença (qual, desde quando, faz tratamento)?
Quem mora na mesma casa? Alguém tem renda (salário, aposentadoria, pensão, Bolsa Família, bicos)? Mais ou menos quanto?
A família tem CadÚnico? Foi atualizado nos últimos 2 anos?
Já pediu o BPC no INSS? Foi negado ou cortado? Quando e por qual motivo?`,
    documents: `Comprovante do CadÚnico atualizado
Laudos, exames e receitas recentes (para deficiência)
Comprovantes de renda de quem mora na casa
Comprovante de residência
Carta do INSS, se foi negado ou cortado`,
    redFlags: `Pedido negado ou benefício cortado há menos de 30 dias (prazo de recurso correndo)
Benefício cortado e a família ficou sem renda
Situação de extrema necessidade (sem comida, sem remédio)
Avaliação ou perícia marcada para os próximos dias`,
    faq: FAQ_COMUM,
    instructions: "Muitas vezes quem escreve é um familiar ou cuidador. Pergunte o nome de quem vai receber o benefício e de quem está conversando.",
  },
  {
    name: "Especialista em Auxílio por incapacidade",
    benefit: "Auxílio por incapacidade (auxílio-doença) e aposentadoria por invalidez",
    area: "Previdenciário",
    color: "#F59E0B",
    keywords: "auxilio doenca, auxilio-doenca, beneficio por incapacidade, incapacidade, afastado, afastamento, pericia, invalidez, aposentadoria por invalidez, acidente de trabalho, auxilio acidente, sequela, cirurgia, depressao, coluna, hernia, cancer, avc",
    knowledge: `Auxílio por incapacidade temporária (antigo auxílio-doença), aposentadoria por incapacidade permanente (antiga aposentadoria por invalidez) e auxílio-acidente (indenização por sequela que reduz a capacidade de trabalho depois de um acidente).
O advogado avalia: se a pessoa era segurada quando a incapacidade começou, a carência (em regra 12 contribuições, com exceções para acidentes e doenças graves previstas em lei) e a prova da incapacidade por laudos, exames e perícia.
Casos comuns: perícia negada, benefício cortado na "alta programada", pedido de prorrogação e conversão em aposentadoria.`,
    questions: `Qual é a doença ou lesão? Desde quando? O que ela impede de fazer no trabalho?
Qual é o seu trabalho? É de carteira assinada, autônomo, MEI, ou estava sem trabalhar?
Está afastado do trabalho? Desde quando?
Já passou pela perícia do INSS? Qual foi o resultado? Recebia benefício que foi cortado?
Tem laudos, exames e receitas recentes?
Foi acidente? De trabalho ou fora do trabalho?`,
    documents: `Laudos médicos recentes com CID, exames e receitas
Carteira de trabalho e comprovantes de contribuição
CAT (Comunicação de Acidente de Trabalho), se foi acidente de trabalho
Carta do INSS com o resultado da perícia`,
    redFlags: `Perícia marcada para os próximos dias
Benefício cortado e a pessoa sem renda
Decisão do INSS há menos de 30 dias (prazo de recurso correndo)
Acidente de trabalho grave ou risco à saúde`,
    faq: FAQ_COMUM,
    instructions: "Seja paciente: a pessoa pode estar com dor ou abalada. Não comente a gravidade da doença.",
  },
  {
    name: "Especialista em Aposentadoria",
    benefit: "Aposentadoria",
    area: "Previdenciário",
    color: "#2F80ED",
    keywords: "aposentadoria, aposentar, me aposentar, aposentadoria por idade, tempo de contribuicao, aposentadoria especial, aposentadoria rural, insalubre, insalubridade, periculosidade, ppp, cnis, planejamento previdenciario, professor",
    knowledge: `Tipos mais comuns: por idade (urbana e rural), pelas regras de transição da Reforma da Previdência (EC 103/2019) para quem já contribuía antes de nov/2019, especial (trabalho exposto a agentes nocivos, provado por PPP), da pessoa com deficiência e do professor.
O advogado faz a contagem e o planejamento com o CNIS (extrato de contribuições do Meu INSS).
Períodos que costumam faltar no CNIS e aumentam o tempo: trabalho rural, serviço militar, aluno-aprendiz, empregos antigos sem registro no sistema, períodos especiais.`,
    questions: `Quantos anos a pessoa tem?
Ao longo da vida, trabalhou em quê? Teve carteira assinada, foi autônomo, trabalhou na roça?
Trabalhou exposto a barulho, produtos químicos, eletricidade, hospital, ou como vigilante?
Mais ou menos quanto tempo de contribuição acha que tem? Ainda contribui?
Já pediu aposentadoria no INSS? Foi negada? Ou já é aposentado e quer revisar o valor?`,
    documents: `Extrato do CNIS (a pessoa baixa no Meu INSS; nunca peça a senha)
Todas as carteiras de trabalho, inclusive as antigas
Carnês e comprovantes de contribuição
PPP e laudos das empresas, para atividade especial
Documentos de trabalho rural, certificado de reservista`,
    redFlags: `Pedido negado há menos de 30 dias (prazo de recurso correndo)
Pessoa com doença grave
A pessoa pede para falar com o advogado`,
    faq: FAQ_COMUM,
    instructions: "Não faça contas de tempo nem diga se a pessoa já pode se aposentar. Explique que o advogado faz a contagem com o CNIS.",
  },
  {
    name: "Especialista em Pensão por morte",
    benefit: "Pensão por morte",
    area: "Previdenciário",
    color: "#64748B",
    keywords: "pensao por morte, faleceu, falecido, falecida, falecimento, obito, viuva, viuvo, morreu, perdi meu marido, perdi minha esposa",
    knowledge: `Paga aos dependentes de quem morreu sendo segurado do INSS ou aposentado.
Dependentes: cônjuge ou companheiro(a), filhos menores de 21 anos ou inválidos/com deficiência; na falta deles, pais e depois irmãos que dependiam economicamente.
Companheiro(a) precisa provar a união estável. A duração da pensão para cônjuge ou companheiro(a) depende da idade e do tempo de casamento ou união.
Prazo importante: pedido feito em até 90 dias do óbito garante o pagamento desde a data do óbito (180 dias para filhos menores de 16 anos); depois disso, paga a partir do pedido.`,
    questions: `Primeiro, meus sentimentos. Quem faleceu e qual era a sua relação com a pessoa?
Qual foi a data do falecimento?
A pessoa trabalhava, pagava INSS, ou era aposentada ou recebia algum benefício?
Vocês eram casados ou viviam em união estável? Há quanto tempo? Moravam juntos?
Há outros dependentes, como filhos menores ou ex-cônjuge que recebia pensão?
Já pediu a pensão no INSS? Foi negada?`,
    documents: `Certidão de óbito
Certidão de casamento ou provas da união estável (conta conjunta, comprovantes no mesmo endereço, fotos, filhos em comum)
Documentos dos dependentes
Carteira de trabalho ou carta de concessão do benefício de quem faleceu
Carta do INSS, se foi negado`,
    redFlags: `Falecimento há menos de 90 dias: registre com urgência alta
Pedido negado há menos de 30 dias (prazo de recurso correndo)
Conflito entre familiares sobre a pensão`,
    faq: FAQ_COMUM,
    instructions: "Comece com acolhimento. Seja breve e respeitoso; a pessoa está de luto.",
  },
  {
    name: "Especialista em Benefício negado, cortado ou revisão",
    benefit: "Benefício negado, cortado ou revisão",
    area: "Previdenciário",
    color: "#EF4444",
    keywords: "negado, negaram, indeferido, indeferimento, cortado, cortaram, cessado, suspenso, bloqueado, revisao, revisar, recurso, junta de recursos, crps, valor errado",
    knowledge: `Casos de pedido negado (indeferido), benefício cortado (cessado) ou suspenso, e revisão de valor.
Contra a negativa cabe recurso à Junta de Recursos do CRPS em até 30 dias da ciência, ou ação na Justiça, conforme o caso.
Revisões em geral têm prazo de 10 anos contados do primeiro pagamento.
O advogado precisa saber qual é o benefício, a data e o motivo que o INSS deu.`,
    questions: `Qual é o benefício?
Foi negado, cortado, suspenso, ou a pessoa quer revisar o valor?
Quando recebeu a decisão do INSS e qual foi o motivo informado?
Tem a carta ou o comunicado do INSS? (Guarde para mostrar ao advogado.)
Já fez recurso ou entrou na Justiça?`,
    documents: `Carta ou comunicado do INSS com a decisão
Número do benefício (NB), se tiver
Documentos que foram entregues no pedido`,
    redFlags: `Decisão recebida há menos de 30 dias: prazo de recurso correndo, transfira para a equipe
Benefício cortado e a pessoa sem renda`,
    faq: FAQ_COMUM,
    instructions: "",
  },
  {
    name: "Especialista em Família",
    benefit: "Família (divórcio, pensão alimentícia, guarda, inventário)",
    area: "Família",
    color: "#10B981",
    keywords: "divorcio, divorciar, separacao, separar, guarda, pensao alimenticia, alimentos, visitas, uniao estavel, inventario, heranca, partilha, testamento",
    knowledge: `Divórcio e dissolução de união estável (com ou sem acordo), guarda e convivência, pensão alimentícia (fixar, revisar ou cobrar), reconhecimento de união estável, inventário e partilha.
Pontos que o advogado avalia: se há acordo entre as partes, filhos menores ou incapazes, bens a dividir, se já existe processo, e urgências.
Em situação de violência doméstica, a prioridade é a segurança: em perigo imediato, a pessoa deve ligar 190; a Central de Atendimento à Mulher é o 180.`,
    questions: `Qual é a situação: divórcio, pensão, guarda, inventário ou outra?
Existe acordo com a outra parte ou não?
Há filhos menores? Quais as idades?
Há bens para dividir (casa, carro, dinheiro)?
Já existe algum processo? Tem audiência marcada?`,
    documents: `Certidão de casamento ou provas da união
Certidão de nascimento dos filhos
Documentos dos bens
Para inventário: certidão de óbito e documentos dos bens deixados`,
    redFlags: `Violência doméstica ou risco à pessoa ou às crianças (oriente a ligar 190 se houver perigo imediato e transfira)
Audiência marcada nos próximos dias
Prisão ou ameaça de prisão por pensão
Citação recebida com prazo correndo`,
    faq: FAQ_COMUM,
    instructions: "Mantenha neutralidade: não comente a conduta da outra parte.",
  },
  {
    name: "Especialista em Cível e Consumidor",
    benefit: "Cível e consumidor (indenizações, bancos, planos de saúde)",
    area: "Cível",
    color: "#0EA5E9",
    keywords: "indenizacao, danos morais, banco, emprestimo, consignado, desconto indevido, desconto no beneficio, nome sujo, negativado, serasa, spc, plano de saude, cirurgia negada, voo, companhia aerea, acidente de transito, batida, cobranca indevida, golpe, pix",
    knowledge: `Indenizações, acidentes de trânsito, cobranças indevidas, nome negativado, golpes e fraudes bancárias, empréstimos consignados e descontos no benefício do INSS não autorizados, negativas de plano de saúde, problemas com companhias aéreas e contratos.
Pontos que o advogado avalia: o que aconteceu e quando, contra quem, o prejuízo, as provas e se a pessoa já tentou resolver (protocolos, reclamações).`,
    questions: `O que aconteceu e quando?
Contra quem é o problema (banco, empresa, plano de saúde, pessoa)?
Teve prejuízo em dinheiro? Mais ou menos quanto?
Já tentou resolver? Tem número de protocolo ou reclamação?
Tem provas, como contratos, extratos, prints ou comprovantes? (Guarde para mostrar ao advogado.)
Já existe processo ou algum prazo?`,
    documents: `Contratos, extratos e comprovantes
Prints de conversas e e-mails
Protocolos de atendimento e reclamações
Boletim de ocorrência, em golpes e acidentes`,
    redFlags: `Plano de saúde negou cirurgia, internação ou tratamento urgente
Audiência marcada ou citação com prazo correndo
Golpe acontecendo agora (oriente a avisar o banco imediatamente e transfira)`,
    faq: FAQ_COMUM,
    instructions: "",
  },
];

export function defaultAttendants(): Attendant[] {
  const now = new Date().toISOString();
  return BASE.map((a, i) => ({ ...a, id: `att${i + 1}`, active: true, createdAt: now, updatedAt: now }));
}

export function blankAttendant(id: string): Attendant {
  const now = new Date().toISOString();
  return { id, name: "", benefit: "", area: "Previdenciário", keywords: "", knowledge: "", questions: "", documents: "", redFlags: "", faq: FAQ_COMUM, instructions: "", active: true, color: "#2F80ED", createdAt: now, updatedAt: now };
}
