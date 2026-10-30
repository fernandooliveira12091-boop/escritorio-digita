# Escritório Digital

Sistema de gestão para escritórios de advocacia, em português do Brasil.

- **Com Supabase configurado** (arquivo `.env`): exige login, e os dados ficam no banco, sincronizados entre aparelhos e colegas.
- **Sem Supabase** (apague o `.env`): modo demonstração, com dados de exemplo no `localStorage` do navegador.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # gera dist/ (site estático)
npm run typecheck
```

## Stack

React 18 + TypeScript + Vite, React Router (HashRouter), Tailwind CSS, Zustand (com `persist`), Recharts, date-fns (pt-BR), lucide-react, dnd-kit e JSZip (geração de .docx).

## Estrutura

```
src/
  components/
    layout/   Sidebar, Header (busca global com "/"), Layout (rodapé, chat, toasts)
    ui/       KpiCard, DataTable + DataTableToolbar, MiniCalendar, UserChipSelect, Modal, Drawer, Tabs…
    modals/   Nova tarefa, detalhe da tarefa, contato, processo, receita/despesa/transferência
    tasks.tsx colunas e linhas de tarefa (☐ ★ ! ●)
  pages/      uma tela por rota (/home, /agenda, /atividades, /crm, /contatos, /processos, …)
  store/      useStore (dados + ações) e ui (tema, menu, modais)
  mocks/      dados de exemplo gerados a partir da data de hoje
  lib/        regras de negócio, formatação, prazos (feriados TJDFT 2026), documentos, CSV, IA
  types/      tipos do domínio
```

## Regras de negócio (src/lib/rules.ts)

- **Atrasada**: o prazo fatal (ou a data do compromisso, quando não há prazo) já passou e a tarefa não foi concluída.
- **Pontos**: concluir uma tarefa soma a pontuação dela para cada responsável (Taskscore, metas e relatórios).
- **Estagnado**: processo ativo sem andamento há mais de 30 dias.
- **KPIs**: comparam o mês atual com o anterior.
- **Workflow**: mover um processo para "Contrato assinado" conta como fechamento do mês; mover para "Arquivamento" arquiva.
- **Prazo fatal em dias úteis**: o modal de tarefa calcula com o calendário do TJDFT 2026 (Portaria Conjunta 105/2025) e o recesso de 20/12 a 20/01.

## Agentes de IA

Dentro do claude.ai, os agentes usam o Claude para redigir as peças. Fora dele, geram um rascunho estruturado para o advogado completar. Em produção, troque `src/lib/ai.ts` por uma chamada ao seu backend.

## Restaurar os dados de exemplo

Conta e assinatura › Restaurar dados de exemplo.

## Publicar online (GitHub Pages)

O workflow `.github/workflows/deploy.yml` gera o site e publica a cada push na branch `main`.
Na primeira vez, no GitHub: **Settings › Pages › Build and deployment › Source: GitHub Actions**.
O endereço fica `https://<seu-usuario>.github.io/<nome-do-repositorio>/`.

## Login e banco de dados (Supabase)

1. No Supabase, abra **SQL Editor › New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
2. Em **Authentication › URL Configuration**, coloque o endereço do site em **Site URL** e em **Redirect URLs**.
3. O `.env` tem a URL do projeto e a chave publicável. A chave secreta (`service_role` / `sb_secret_…`) nunca vai no código.

Como funciona:

- Cada item (tarefa, contato, processo…) é uma linha da tabela `records`, separada por escritório (`workspace_id`).
- As regras de acesso do banco (RLS) só deixam membros do escritório lerem e gravarem os dados dele.
- Quem entra pela primeira vez cria o escritório. Colegas são convidados em **Configurações › Usuários** e ganham acesso quando criam a conta com o e-mail convidado.
- As alterações são enviadas em lote (`src/store/sync.ts`) e chegam aos outros aparelhos em tempo real.

## Busca nos tribunais (DJEN e DataJud)

A função `supabase/functions/tribunais` roda no Supabase:

- **DJEN (Comunica PJe/CNJ)**: busca as publicações das OABs monitoradas (Intimações › Cadastrar OAB) e grava como intimações. Processo que ainda não existe no sistema é cadastrado com a marca "A revisar".
- **DataJud (API Pública do CNJ)**: traz classe, órgão julgador e movimentações pelo número do processo. O tribunal é identificado pelo próprio número CNJ (TJDFT, TJMA, TRF1, TRTs…).
- Roda sozinha às 7h e às 16h (pg_cron) e também pelo botão "Buscar agora".

Instalação:

1. Supabase › **Edge Functions** › **Deploy a new function** › **Via Editor**, nome `tribunais`, cole `supabase/functions/tribunais/index.ts` e publique. Nos detalhes da função, desligue **Enforce JWT verification** (a função confere o login sozinha).
2. **Edge Functions › Secrets**: crie `CRON_SECRET` com um valor aleatório.
3. **SQL Editor**: rode `supabase/tribunais.sql` trocando `COLE_AQUI_O_SEGREDO` pelo mesmo valor.

Se o CNJ trocar a chave pública do DataJud, crie o secret `DATAJUD_API_KEY` com a nova.

## Google Agenda

- **Assinatura (.ics)**: Agenda › Google Agenda gera um endereço pessoal que se cola no Google Agenda (Outras agendas › Do URL). Mostra compromissos (1 hora) e prazos fatais (dia inteiro), só os seus ou do escritório todo. O Google atualiza essas agendas a cada algumas horas.
- **Botão "Adicionar ao Google Agenda"**: dentro de cada compromisso, abre o Google Agenda com o evento preenchido.

Instalação: publique a função `supabase/functions/agenda` (nome `agenda`, com **Enforce JWT verification** desligado, porque o Google acessa sem login) e rode `supabase/agenda.sql` no SQL Editor.

## Configuração automática do Supabase (GitHub Actions)

O workflow `.github/workflows/supabase.yml` roda os scripts do banco e publica as funções `tribunais` e `agenda` sempre que algo muda em `supabase/` (ou pelo botão **Run workflow**). Ele precisa dos segredos do repositório `SUPABASE_ACCESS_TOKEN` (token da conta Supabase) e `CRON_SECRET` (senha do agendamento).
