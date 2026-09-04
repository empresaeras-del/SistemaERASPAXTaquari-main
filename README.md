# Sistema ERAS PAX Taquari

Sistema de gestão para assistência funerária: associados e dependentes, planos PAX, contratos,
atendimentos (incluindo dados de óbito), rede credenciada, financeiro (contas a pagar/receber,
caixa, faturamento) e emissão de documentos padronizados.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: [Supabase](https://supabase.com) (Postgres + Auth + Storage), com Row Level Security
  multi-tenant em todas as tabelas
- **Offline-first**: toda tela tem fallback para IndexedDB (`idb-keyval`), sincronizando com o
  Supabase quando online
- **Editor de documentos**: Jodit (rich text) + editor de tabelas próprio (`utils/tableGridModel.ts`)
- **PWA**: instalável, com service worker (`vite-plugin-pwa`)
- **Monitoramento**: Sentry (`@sentry/react`)

## Como rodar localmente

```bash
npm install
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev             # http://localhost:3000
```

### Variáveis de ambiente

Veja `.env.example` para a lista completa e onde configurar cada uma em produção (Vercel/Netlify/
Docker). As obrigatórias são `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. **Nunca** comite um
`.env` com chaves reais — o `.gitignore` já bloqueia isso.

## Scripts disponíveis

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (porta 3000) |
| `npm run build` | Build de produção (`dist/`) |
| `npm run preview` | Serve o build de produção localmente |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run format` / `npm run format:check` | Prettier |
| `npm test` | Roda a suíte de testes uma vez (Vitest) |
| `npm run test:watch` | Vitest em modo watch |
| `npm run test:ui` | Vitest com UI interativa |

CI (`.github/workflows/ci.yml`) roda `typecheck`, `lint` e `build` em todo PR/push para `main`.

## Testes

A suíte de testes usa [Vitest](https://vitest.dev) + Testing Library (`jsdom`). Arquivos de teste
ficam ao lado do código que testam (`*.test.ts`). A cobertura hoje é deliberadamente focada nos
módulos de maior risco de regressão silenciosa — o motor de edição de tabelas dos Documentos
Padrões (`utils/tableGridModel.ts`), a resolução de variáveis `{{...}}` dos documentos
(`utils/documentoVariaveis.ts`), a sanitização de HTML (`utils/sanitizeHtml.ts`) e as funções de
normalização do financeiro (`services/financeiroService.ts`). Ainda não há testes de componente/UI;
ao adicionar uma tela nova ou mexer numa dessas áreas, adicione um teste correspondente.

## Banco de dados (Supabase)

As migrations vivem em `supabase/migrations/`, mas o histórico de rastreamento
(`supabase_migrations.schema_migrations`) só passou a corresponder de fato ao banco de produção a
partir de setembro de 2026 — migrations anteriores a essa data foram aplicadas fora do fluxo
rastreado. Veja `CLAUDE.md` para os detalhes e o que isso implica ao criar uma migration nova.

## Documentação para quem for mexer no código

`CLAUDE.md` descreve a arquitetura, convenções do projeto, pontos de atenção conhecidos (drift de
schema, colunas duplicadas) e o plano de deprecação em andamento. Leia antes de abrir um PR.
