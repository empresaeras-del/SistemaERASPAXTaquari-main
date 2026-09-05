# CLAUDE.md

Guia de arquitetura e convenções para quem (humano ou agente) for mexer neste repositório. Leia
antes de abrir um PR — em especial as seções de schema drift e do padrão de migrations.

## Estrutura do projeto

```
src/
  pages/         Uma página por rota (Associados.tsx, Atendimentos.tsx, DocumentosPadroesPage.tsx...)
  components/    Componentes organizados por domínio (associados/, atendimentos/, documentos/, financeiro/...)
  services/      Acesso a dados: Supabase + fallback IndexedDB (associadosService.ts, financeiroService.ts...)
  hooks/         Hooks que encapsulam um service para uso em componentes (useDocumentosPadroes.ts...)
  utils/         Funções puras (documentoVariaveis.ts, tableGridModel.ts, dateUtils.ts...) — é aqui
                 que a maior parte da cobertura de testes vive, porque são fáceis de testar isoladas
  types/         Interfaces TypeScript por domínio
  config/        Catálogos/configuração estática (documentoVariaveis.config.ts)
  context/       AppContext (estado global: tenant selecionado, isOnline, usuário) e outros providers
  schemas/       Schemas Zod (adoção parcial — ver seção "Validação" abaixo)
supabase/
  migrations/    Migrations SQL, aplicadas via Supabase MCP nas sessões mais recentes
```

## Multi-tenant e RLS

Toda tabela em `public` tem RLS habilitado, com uma política reaproveitando funções centrais:
`has_tenant_access(tenant_id)`, `current_tenant_id()`, `current_user_nivel()`, `is_super_admin()`.
Não escreva uma política nova do zero — reaproveite essas funções, como o resto do schema já faz.

No frontend, o tenant/empresa selecionado vive em `AppContext` (`state.empresaSelecionada`). Um
valor `'all'` significa "sem filtro de tenant" (usado por telas administrativas) — não confunda com
um `tenant_id` real.

## Padrão offline-first

Praticamente todo `service` segue o mesmo formato:

```ts
export const getX = async (isOnline: boolean, tenantId?: string) => {
  if (isOnline) {
    try {
      const { data, error } = await supabase.from('x').select('*')...
      if (!error && data) { for (const item of data) await saveToIDB('x', item); return data; }
    } catch { /* cai para o IDB */ }
  }
  return getAllFromIDB('x'); // fallback local
};
```

Ao adicionar um service novo, siga esse mesmo formato em vez de inventar um novo padrão.

## Supabase: migrations e o cuidado com o histórico de rastreamento

**Contexto histórico (resolvido em 04/09/2026)**: até essa data, os 28 arquivos de migration
anteriores a `20260904130000_documentos_padroes_complete_columns.sql` haviam sido aplicados ao banco
de produção, mas a tabela de controle (`supabase_migrations.schema_migrations`) estava vazia — o
schema real e o histórico rastreado haviam divergido silenciosamente.

Reconciliação feita: cada um dos 28 arquivos foi verificado contra o schema real em produção antes
de qualquer escrita — comparando programaticamente todo `ADD COLUMN`/`CREATE TABLE`/
`CREATE OR REPLACE FUNCTION` de cada arquivo contra `information_schema.columns` e `pg_proc` reais
(cuidando de não considerar como "faltando" uma coluna de um `CREATE TABLE IF NOT EXISTS` que já era
inerte por a tabela ter sido criada antes por outro arquivo — só a **primeira** migration a criar
cada tabela foi validada coluna a coluna). As 28 bateram exatamente com a produção, sem nenhuma
divergência. Só depois disso as 28 versões (extraídas do nome de cada arquivo, ex.
`20260803120000_itens_funerarios.sql` → versão `20260803120000`) foram inseridas em
`supabase_migrations.schema_migrations` via SQL direto (equivalente ao `supabase migration repair
--status applied`, que este ambiente não tem como rodar via CLI por falta de link/autenticação ao
projeto). O rastreamento agora reflete a realidade desde a primeira migration.

Convenção mantida daqui para frente: toda migration nova deve ser aplicada via
`mcp__Supabase__apply_migration` (ou `supabase migration repair` quando for só reconciliar), nunca só
como arquivo `.sql` no repositório sem aplicar — é assim que o histórico rastreado continua
correspondendo à produção.

Ao criar uma migration nova:
1. Prefira aplicá-la via `apply_migration` (Supabase MCP) quando tiver acesso — isso mantém o
   histórico rastreado.
2. Sempre crie também o arquivo `.sql` correspondente em `supabase/migrations/` com timestamp novo,
   para o repositório continuar sendo a documentação de referência.
3. Use `ADD COLUMN IF NOT EXISTS` / `COMMENT ON COLUMN` como nas migrations mais recentes — torna a
   migration idempotente e autodocumentada.

### O bug recorrente: campo no TypeScript sem a coluna correspondente no banco

Já aconteceu duas vezes (`documentos_padroes` e `atendimentos`): alguém adiciona um campo opcional
à interface TypeScript, o código já lê/grava esse campo, mas ninguém cria a migration — o Supabase
responde `PGRST204` (coluna não encontrada) e, como vários services têm uma rotina que descarta
silenciosamente qualquer coluna ausente e tenta salvar de novo (ver `useDocumentosPadroes.ts`), o
dado do usuário é **salvo com sucesso aparente e perdido**, sem erro visível. Ao adicionar um campo
novo a uma interface que é persistida no Supabase, **sempre** crie a migration na mesma tarefa —
nunca depois "quando der tempo".

## Schema drift conhecido — colunas duplicadas

Duas tabelas têm pares de colunas para o mesmo dado, por terem evoluído em momentos diferentes sem
migração da coluna antiga:

- **`associados`**: `endereco_logradouro`/`logradouro`, `endereco_numero`/`numero`,
  `endereco_bairro`/`bairro`, `endereco_cidade`/`cidade`, `endereco_cep`/`cep`,
  `endereco_estado`/`uf`, e `plano_id`/`plano_pax_id`. O código atual lê com fallback
  (`assoc.endereco_logradouro || assoc.logradouro`, ver `utils/documentoVariaveis.ts`), mas grava
  majoritariamente no par `endereco_*`/`plano_pax_id` — trate esse par como o canônico ao escrever
  código novo.
- **`documentos_padroes`**: `conteudo`/`conteudo_html` e `created_at`/`updated_at` convivendo com
  `criado_em`/`atualizado_em`. O par canônico em uso pelo código atual é `conteudo` e
  `criado_em`/`atualizado_em`.

**Plano de deprecação** (ainda não iniciado — item de médio prazo, não execute sem planejamento):
1. Confirmar, consultando o banco real, se as colunas legadas (`logradouro`, `plano_id`,
   `conteudo_html`, `created_at`/`updated_at`) ainda recebem escrita de algum caminho de código ou
   de uma integração externa.
2. Se não recebem, migrar os poucos registros divergentes (`UPDATE ... WHERE canonical IS NULL`)
   para consolidar no par canônico.
3. Manter a coluna legada por um ciclo de release como alias somente-leitura (não remover ainda).
4. Só então dropar a coluna legada, numa migration própria, depois de confirmar nos logs/advisors
   que nada mais a referencia.

Não pule direto para o passo 4 — dropar uma coluna que algo ainda escreve quebra silenciosamente
esse algo mais tarde.

## Módulo de Documentos Padrões

Este é o módulo mais recentemente modernizado — vale como referência de padrão para o resto do
sistema:

- **Variáveis `{{...}}`**: toda a resolução vive em `utils/documentoVariaveis.ts` (uma função pura
  por entidade — `resolverVariaveisAssociado`, `resolverVariaveisAtendimento` etc.) e o catálogo
  correspondente (usado no painel de inserção de variáveis) em
  `config/documentoVariaveis.config.ts`. **As duas fontes precisam ficar em sincronia**: uma tag no
  catálogo que não existe no resolver correspondente nunca vai preencher (já aconteceu com
  requisição e financeiro antes de setembro de 2026).
- **Editor de tabelas**: `utils/tableGridModel.ts` implementa uma grade de ocupação (o modelo padrão
  para lidar com `colspan`/`rowspan` em merge/split/insert/delete de linhas e colunas). Mude com
  cuidado e sempre com teste — é código com bastante superfície de casos-limite (ver
  `tableGridModel.test.ts`).
- **CSS de impressão**: compartilhado entre o visualizador e a página de modelos via
  `utils/documentoPrintStyles.ts` — não duplique o `<style>` de novo se precisar mexer na impressão.
- **Sanitização**: todo `dangerouslySetInnerHTML` de conteúdo de documento passa por
  `utils/sanitizeHtml.ts` (DOMPurify). Se adicionar um novo ponto de renderização de HTML de
  documento, sanitize também.
- **Assinatura com posição livre**: `assinatura_config` (JSONB, `{x, y, largura, altura, pagina}` em
  % da página) no registro do documento; drag-and-drop via `react-rnd` em
  `VisualizadorDocumentoPadraoModal.tsx`.

## Validação (Zod)

Adoção parcial: `FornecedorFormModal.tsx`, `ItemFunerarioForm.tsx`, `PlanoPaxForm.tsx`,
`contratoSchema.ts`, `ContasPagarFormPage.tsx`, `ContasReceberFormPage.tsx` já usam
Zod + `react-hook-form` + `@hookform/resolvers`. `schemas/atendimentoSchema.ts` segue um padrão mais
leve — `schema.safeParse()` chamado direto num handler existente, sem migrar o componente inteiro
para `react-hook-form` — útil quando o formulário já é grande e usa `useState` disperso
(`NovoAtendimentoWizard.tsx`): dá para validar de forma estruturada e testável sem reescrever a tela
toda de uma vez. Associados, Credenciados, Usuários e Configurações ainda validam só com `if`/HTML
`required` — ao mexer numa dessas telas, prefira extrair um schema Zod para o que você está
tocando em vez de adicionar mais um `if`.

Decomposição de "god component" (seção acima) e migração completa de validação para Zod nas telas
grandes restantes foram deliberadamente deixadas de fora desta rodada: ambas exigem clicar na UI
real (login) para confirmar que nada quebrou, e este ambiente não tem esse acesso. Antes de
encarar uma delas, garanta acesso a um ambiente onde dá para testar interativamente — não faça às
cegas num arquivo sem cobertura de teste.

## "God components" conhecidos

Alguns arquivos concentram dados + validação + UI num único componente grande demais para revisar
ou testar com conforto: `components/associados/AssociadoMensalidadesTab.tsx`,
`services/financeiroService.ts`, `pages/Configuracoes.tsx`, `pages/Auditoria.tsx`.
`pages/Associados.tsx` saiu dessa lista — ver "Associados.tsx: decomposição concluída" abaixo.

Uma rodada de decomposição **parcial** foi feita sem acesso a UI logada (este ambiente não tem
`.env` com credenciais reais de Supabase, então não dá para clicar na tela e confirmar visualmente
que nada quebrou). Por isso, o escopo dessa rodada foi deliberadamente limitado ao que dá para
validar sem navegador: extrair a **lógica pura** (validação, filtro/ordenação, cálculo, formatação)
de dentro de cada componente para funções isoladas em `utils/`, com testes Vitest cobrindo cada uma,
**sem tocar no JSX/estrutura visual**. O comportamento é preservado byte-a-byte — cada função foi
relocada, não reescrita — e onde uma mesma lógica estava duplicada em dois lugares (ex: cálculo de
diff de auditoria em texto vs. em tela, `formatCurrency` copiado em ~60 arquivos, `formatAgencia`/
`formatConta` idênticas), a duplicação foi consolidada numa única fonte.

Resultado (linhas antes → depois, só com essa extração):

| Arquivo | Antes | Depois | Utils extraídos |
|---|---|---|---|
| `pages/Associados.tsx` | 3110 | 2855 (nesta rodada) | `utils/associadoValidation.ts`, `utils/associadoHelpers.ts` |
| `components/associados/AssociadoMensalidadesTab.tsx` | 1843 | 1794 | `utils/mensalidadesAssociadoHelpers.ts`, `formatCurrency` em `utils/formatters.ts` |
| `services/financeiroService.ts` | 1661 | 1661* | *não decomposto (ver nota abaixo) — só ganhou testes para os 3 `sanitize*ForSupabase` que ainda não tinham |
| `pages/Configuracoes.tsx` | 1641 | 1622 | `utils/configuracoesHelpers.ts` |
| `pages/Auditoria.tsx` | 1564 | 1266 | `utils/auditoriaHelpers.ts` |

**Por que `financeiroService.ts` não foi decomposto**: ao contrário dos outros quatro, é um service
de acesso a dados (async, Supabase + IndexedDB + fila de sync), não um componente com lógica pura
misturada — quase todo o arquivo já segue o padrão offline-first documentado acima, então não havia
lógica pura relevante para extrair além das 4 funções `sanitize*ForSupabase` (uma já tinha teste, as
outras três ganharam agora). Fisicamente dividir o arquivo em módulos menores (`receitasService.ts`,
`despesasService.ts`...) é uma mudança estrutural de risco bem maior — o arquivo é importado por
~15 outros — e foi deixada de fora desta rodada por não caber no critério "validável sem UI".

**Achado incidental**: a extração de `getActionConfig` em `Auditoria.tsx` revelou dois quirks
pré-existentes de classificação (não introduzidos por esta extração, confirmados contra
`origin/main` antes de mexer, e preservados de propósito): a checagem de "criação" vem antes da de
"atualização" no código original, então uma ação como "Reabertura de Caixa" cai em `create` (por
conter "abertura") em vez de `update`; e "Fechamento de Caixa" cai em `finance` (por conter "caixa")
em vez de `update`. Documentado nos testes (`auditoriaHelpers.test.ts`) em vez de corrigido às cegas
— mudar a ordem das checagens é uma decisão de produto (qual categoria deveria "vencer"), não uma
limpeza de código.

**Ainda não decomposto nesta rodada** (fica para quando houver acesso a UI logada para verificar
visualmente): a estrutura JSX/renderização de `AssociadoMensalidadesTab.tsx`, `Configuracoes.tsx` e
`Auditoria.tsx` continua nos arquivos originais — a extração acima reduziu o tamanho e a superfície
de lógica não testada, mas não quebrou esses três em subcomponentes menores. Isso segue sendo o
próximo passo para eles, quando um ambiente com credenciais reais de Supabase estiver disponível
para navegar as telas depois da mudança. `Associados.tsx` já não se enquadra mais aqui — ver abaixo.

### Associados.tsx: decomposição concluída

Numa rodada posterior à extração de lógica pura acima, `pages/Associados.tsx` recebeu a
decomposição de JSX/estrutura visual que a rodada anterior tinha deixado pendente — não é mais
"ainda não decomposto". Estado atual:

- `pages/Associados.tsx`: 271 linhas — só monta o layout a partir do hook de estado e dos
  componentes abaixo, sem lógica própria.
- `hooks/useAssociadosState.ts`: 640 linhas — concentra o estado (filtros, ordenação, seleção,
  modais) e as chamadas a `usePlanosPax`/serviços que antes viviam dentro da página.
- `components/associados/`: 19 componentes dedicados (~9.990 linhas somadas) — tabelas
  (`AssociadosListTable.tsx`, `AssociadosListGrid.tsx`), modais (`AssociadoFormModal.tsx`,
  `AssociadoDetailsModal.tsx`, `DependenteFormModal.tsx`, `ParcelaRecebimentoModal.tsx`,
  `CarteirinhaAssociadoModal.tsx`...), abas (`AssociadoAtendimentosTab.tsx`,
  `AssociadoRequisicoesTab.tsx`, `AssociadoResumoFinanceiroTab.tsx`,
  `AssociadoMensalidadesTab.tsx`) e utilitários de tela (`AssociadosToolbar.tsx`,
  `RegrasCalculoInfo.tsx`, `RelatorioAssociadosModal.tsx`).

Ao mexer em telas de associados, a lógica de estado agora mora em `useAssociadosState.ts`, e cada
pedaço de UI no componente correspondente acima — não espere mais encontrar isso dentro de
`Associados.tsx`. Um efeito colateral dessa divisão: props que atravessam vários componentes
precisam ter o tipo alinhado em cada um deles (ex.: `planos` é `PlanoPaxResumo[]`, não `PlanoPax[]`,
tanto em `AssociadosListTable.tsx` quanto em `AssociadosListGrid.tsx`, porque é isso que
`useAssociadosState.ts` de fato expõe) — um mismatch aqui só aparece no `tsc`, não no lint nem em
runtime.

## Segurança

- Funções `SECURITY DEFINER` sensíveis (`admin_alterar_senha_usuario`, `admin_excluir_usuario`) só
  têm `EXECUTE` concedido a `authenticated` — nunca reconceda a `PUBLIC`/`anon` sem necessidade real
  (lembre que revogar de `anon` sozinho não basta: revogue de `PUBLIC` também, senão o grant padrão
  do Postgres continua valendo por herança).
- Toda função nova `SECURITY DEFINER` deve fixar `search_path` (`SET search_path = public, pg_temp`)
  — sem isso, o linter de segurança do Supabase acusa `function_search_path_mutable`.
- HTML de documento (conteúdo editável por usuário) sempre passa por `sanitizeDocumentoHtml` antes
  de `dangerouslySetInnerHTML` — é a única forma de HTML não confiável no sistema hoje.

## Testes

Ver `README.md`. Ao mexer num arquivo de `utils/` ou numa função pura de `services/`, adicione ou
atualize o teste correspondente — é o único jeito de saber se uma mudança quebrou algo, já que não
há suíte de testes de componente/UI ainda.

## Performance: bibliotecas pesadas em `services/` usados pelo shell do app

Achado real desta sessão: `requisicoesService.ts` e `faturamentoService.ts` são importados pelo
hook de notificações (`hooks/useNotifications.ts`), usado no `Topbar` — ou seja, em toda página
autenticada, desde o primeiro carregamento. Os dois arquivos tinham um `import jsPDF from 'jspdf'`
no topo, usado por **uma única função de geração de PDF** cada — isso bastava para o bundle inicial
carregar ~1,3&nbsp;MB de bibliotecas de PDF/editor mesmo antes do usuário navegar para qualquer
lugar que realmente precisasse delas (confirmado via `dist/index.html`: apareciam como
`modulepreload` já na primeira carga). A correção foi trocar o import estático por um dinâmico,
escopado dentro da própria função:

```ts
export const gerarPDFAlgumaCoisa = async (...) => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  // ...
};
```

**Regra geral**: se um `service` mistura funções "sempre necessárias" (fetch/CRUD, usadas por hooks
globais como notificações) com funções que usam uma biblioteca pesada só ocasionalmente (gerar PDF,
processar imagem grande etc.), a biblioteca pesada deve ser importada dinamicamente dentro da função
que a usa — nunca no topo do arquivo. Um `import` estático no topo entra no grafo de dependências de
qualquer coisa que importe qualquer função do arquivo, mesmo que essa função nunca toque a
biblioteca. Ao adicionar uma função nova que usa `jspdf`, `jodit` ou outra dependência grande a um
service já usado por um hook "global", siga esse padrão desde o início.

Depois de qualquer mudança de bundling, confirme o resultado real (não confie só no tamanho dos
chunks) — rode `npm run build` e inspecione `dist/index.html`: só bibliotecas realmente necessárias
no primeiro paint devem aparecer como `modulepreload`.
