# Escritório Digital

Sistema de gestão para escritórios de advocacia, em português do Brasil. Funciona sem backend: os dados de exemplo ficam salvos no `localStorage` do navegador.

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
