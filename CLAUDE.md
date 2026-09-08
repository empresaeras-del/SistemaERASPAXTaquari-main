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

### Nunca invente um `tenant_id` (o caso `empresa_padrao`)

Até 08/09/2026, `has_tenant_access()` devolvia verdadeiro para três valores de `tenant_id`
— `'default_tenant'`, `'empresa_padrao'` e `'all'` — para **qualquer** usuário autenticado de
**qualquer** empresa, com a intenção de marcar "registros globais, compartilhados". Ao mesmo tempo,
o frontend usava dois deles com outro sentido: eram o fallback de "empresa ainda não selecionada"
(`state.empresaSelecionada || 'empresa_padrao'`). Somados, um registro criado sem empresa escolhida
— uma conta a pagar, uma receita, uma entrada de auditoria — **nascia legível e gravável por todas
as empresas**, sem erro e sem nada visível na tela. Só um super_admin chegava nesse estado (para os
demais níveis o `AppContext` força `empresaSelecionada = user.tenant_id`), o que tornava o problema
ainda mais silencioso: quem criava o registro enxergava tudo de qualquer forma.

Regras que passaram a valer:

- **Toda resolução de tenant passa por `utils/tenant.ts`** — `tenantDeEscrita()` para um registro
  novo, `tenantDeRegistroExistente()` quando é preciso reaproveitar o de um registro, e
  `registroPertenceAoTenant()` no filtro do caminho offline dos services. Não escreva um novo
  encadeamento `x || y || 'algum_literal'` à mão.
- **Quando não dá para determinar a empresa, recuse a gravação** com
  `MENSAGEM_TENANT_INDEFINIDO`, em vez de carimbar um valor de fallback. Um erro visível na hora é
  melhor que um registro compartilhado em silêncio.
- **Não acrescente valores coringa a `has_tenant_access`.** Para um catálogo realmente global, use
  uma cláusula própria na policy da tabela, como `procedimentos` já faz
  (`tenant_id IS NULL OR has_tenant_access(tenant_id)`). O `COMMENT` da função registra isso.
- `'all'` continua sendo o único marcador de transmissão a todos, usado pelas notificações. Ele
  nunca é gravado como tenant de um registro de negócio.

Sobra do estado anterior, deliberadamente não mexida: várias telas ainda passam
`state.empresaSelecionada || 'default_tenant'` como **filtro de leitura**. Depois da correção esse
valor não casa com nada — o resultado é uma lista vazia, não a lista de todo mundo —, então não é
mais ambíguo, só verboso.

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
3. **Nomeie o arquivo com a versão que o banco registrou**, não com o timestamp que você escolheu.
   O `apply_migration` grava a versão do *servidor* no momento da aplicação, que quase nunca é a do
   nome do arquivo. Consulte `supabase_migrations.schema_migrations` depois de aplicar e renomeie.
   Isso não é cosmético: o CLI compara as versões dos arquivos com a tabela de controle, então um
   arquivo com versão que não existe lá seria **reaplicado** num `supabase db push`.
4. **Uma migration aplicada, um arquivo.** Se uma migration se mostrar insuficiente e você aplicar
   uma correção, crie um arquivo novo para ela — não edite o arquivo da primeira para "consertá-la".
   O par `20260904123956_revoke_anon_admin_functions` / `20260904124031_revoke_public_admin_functions`
   é exatamente esse caso: revogar de `anon` não bastava, e por um tempo a correção existia só no
   banco, com o SQL enfiado dentro do arquivo da primeira. O arquivo passou a mentir sobre o que
   aquela migration aplicou, e a segunda ficou sem registro nenhum. Guardar o passo insuficiente
   separado também preserva a lição de por que ele não funcionou.
5. Use `ADD COLUMN IF NOT EXISTS` / `COMMENT ON COLUMN` como nas migrations mais recentes — torna a
   migration idempotente e autodocumentada.

Para conferir se os dois lados batem, compare **por nome**, não por número: a versão diverge por
construção quando o arquivo não foi renomeado, e comparar por número produz falso alarme (foi o que
aconteceu na conferência de 08/09 — 7 "divergências" que, por nome, eram 1).

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

## Campo opcional com `UNIQUE`: grave `NULL`, nunca string vazia

`credenciados.cnpj_cpf` (opcional desde a migration `20260908182307`) é o primeiro caso disso no
projeto, mas o padrão vale para qualquer coluna futura que seja ao mesmo tempo opcional e
`UNIQUE`. O Postgres trata cada `NULL` como distinto dos demais para fins de unicidade — vários
registros sem valor coexistem normalmente —, mas duas strings vazias (`''`) são iguais entre si e
colidem. Se o formulário salvar `''` no lugar de `NULL` quando o campo fica em branco, o *segundo*
registro sem valor falha com uma violação de `UNIQUE` que parece dizer "já existe um igual a este",
quando não existe nenhum de verdade — só o valor vazio duplicado. Normalize no ponto de escrita
(`valor.trim() || null`), não na coluna.

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
  Leia a seção "Impressão" abaixo antes de mexer: esse arquivo tem regras que não são óbvias.
- **Sanitização**: todo `dangerouslySetInnerHTML` de conteúdo de documento passa por
  `utils/sanitizeHtml.ts` (DOMPurify). Se adicionar um novo ponto de renderização de HTML de
  documento, sanitize também.
- **Assinatura com posição livre**: `assinatura_config` (JSONB) no registro do documento;
  drag-and-drop via `react-rnd` em `VisualizadorDocumentoPadraoModal.tsx`. As conversões de
  coordenada são funções puras em `utils/assinaturaPosicao.ts` — ver "Impressão" abaixo.

### Impressão: três regras que já foram quebradas

A impressão de um documento abre uma janela nova (`window.open('')`) e escreve nela o
`innerHTML` da folha do visualizador mais o CSS de `documentoPrintStyles.ts`. Essa janela é um
documento à parte, e três consequências disso já produziram bugs reais (corrigidos em setembro/2026,
PRs #16 e #17):

1. **Não existe Tailwind dentro da janela de impressão.** Nenhuma classe utilitária que vier no
   `innerHTML` corresponde a regra alguma lá: `absolute`, `flex`, `items-center`, `max-h-full`,
   `w-4/5`, `text-xs` — todas inertes. Só vale o que o CSS gerado nomeia explicitamente
   (`.doc-header`, `.doc-content`, `.doc-footer`, `.signature-line`, `.doc-assinatura-livre`,
   tabelas). Foi assim que a assinatura de posição livre imprimia sem `position: absolute`: os
   `left`/`top` inline viravam inertes, a altura percentual colapsava e a imagem saía no tamanho
   natural do arquivo — um carimbo digitalizado de 26cm no meio do contrato. **Ao renderizar
   qualquer coisa nova que vá para a impressão, dê a ela uma classe própria e escreva a regra em
   `documentoPrintStyles.ts`; não confie em `className` do Tailwind.**

2. **A folha do visualizador não vai junto — só o conteúdo dela.** A folha é
   `position: relative` e serve de âncora para o `position: absolute` da assinatura, mas quem chega
   na impressão é `.doc-container`, que a substitui. Por isso `.doc-container` é
   `position: relative` no CSS de impressão. Se remover esse `relative`, a assinatura volta a ser
   posicionada contra a caixa da página.

3. **A margem é do documento, e uma fonte só alimenta tudo.** `documento.margens` (JSONB
   `{top,bottom,left,right}` em mm) define, ao mesmo tempo: o `@page { margin }` da impressão, o
   `padding` da folha do visualizador, a área de referência do arrastar da assinatura e as margens
   da exportação em PDF. Enquanto esses valores divergiam (160mm de área útil no editor, 170mm no
   visualizador, 180mm na impressão), o texto refluía entre as etapas e a paginação da tela não
   correspondia à impressa. Use sempre `margensOu(documento?.margens)` de `utils/assinaturaPosicao.ts`
   para normalizar — a coluna é jsonb livre e pode vir nula ou parcial.
   **Lacuna conhecida**: o editor Jodit ainda desenha a própria folha com paddings no `iframeStyle`
   e é a única etapa fora desse alinhamento.

**Coordenadas da assinatura** (`utils/assinaturaPosicao.ts`): são milímetros a partir do canto
superior esquerdo da área útil **de uma página**, mais o índice da página (`AssinaturaConfigV2`).
O formato antigo (`AssinaturaConfigV1`) usava porcentagens da folha contínua inteira do
visualizador — que cresce com o documento — e por isso nunca sobrevivia à paginação; ele é lido e
convertido na abertura do documento, usando as medidas reais da folha, e nada mais grava nele.
O passo entre páginas é `alturaUtilMm(orientacao, margens)`, não uma constante: mudar as margens
muda o passo. Se precisar mexer aqui, as funções são puras e testadas em `assinaturaPosicao.test.ts`
— mude com teste.

`orientacao` também é propriedade do documento (persistida ao trocar na barra do visualizador), não
preferência de sessão.

### A mesma regra vale fora deste módulo: outras impressões do sistema

A ausência de Tailwind na janela de impressão (regra 1 acima) não é exclusiva dos Documentos
Padrões — vale para **qualquer** `window.open('').document.write(...)`. A Ficha de Cadastro do
Associado (`AssociadoDetailsModal` → `FichaCadastroModal.tsx`) e o Recibo de Pagamento
(`VisualizadorReciboModal.tsx`) seguem o mesmo padrão: uma prévia em tela com Tailwind (com zoom,
para conferir antes de imprimir/exportar), uma janela de impressão à parte com CSS próprio escrito
à mão, e exportação em PDF via `jsPDF` + `jspdf-autotable` (múltiplas tabelas em sequência, cada
uma com `startY: y` e `y = (doc as any).lastAutoTable.finalY + margem` para a próxima — ver
`requisicoesService.ts` e `faturamentoService.ts` para mais exemplos desse encadeamento).

Na Ficha de Cadastro, os três renderizadores (prévia em tela, HTML de impressão, PDF) leem os
mesmos dados de `utils/fichaCadastroAssociado.ts` — funções puras e testadas
(`montarSecoesFicha`, `montarDependentesFicha`, `montarHtmlImpressaoFicha`) — em vez de cada um
remontar os campos à mão. Foi assim que apareceu um bug do template antigo: o rótulo prometia
"Cidade/UF" mas só a cidade era interpolada, o UF nunca aparecia. Ao adicionar um documento
imprimível novo com mais de um formato de saída, vale seguir esse desenho: uma função pura que
decide **o quê** mostrar, e cada renderizador decide só **como**.

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
| `services/financeiroService.ts` | 1661 | 1661* | *não decomposto (ver nota abaixo) — ganhou teste para as 4 `sanitize*ForSupabase` e, numa rodada posterior, para o caminho offline de 6 funções assíncronas (ver "Testes" abaixo) |
| `pages/Configuracoes.tsx` | 1641 | 1622 | `utils/configuracoesHelpers.ts` |
| `pages/Auditoria.tsx` | 1564 | 1266 | `utils/auditoriaHelpers.ts` |

**Por que `financeiroService.ts` não foi decomposto**: ao contrário dos outros quatro, é um service
de acesso a dados (async, Supabase + IndexedDB + fila de sync), não um componente com lógica pura
misturada — quase todo o arquivo já segue o padrão offline-first documentado acima, então não havia
lógica pura relevante para extrair além das 4 funções `sanitize*ForSupabase` — hoje todas testadas,
junto com o caminho offline de boa parte das funções assíncronas do arquivo (ver "Testes" abaixo).
Fisicamente dividir o arquivo em módulos menores (`receitasService.ts`,
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

## Menu lateral (`components/layout/Sidebar.tsx`)

O menu passou por um redesenho em três entregas (setembro/2026). Nenhuma funcionalidade mudou —
rotas, filtro por permissão, submenus, badges, recolher/expandir e a ordem persistida continuam como
estavam —, mas quatro convenções do arquivo passaram a valer:

- **Itens pertencem a uma seção.** `NavItem` tem um campo obrigatório `group`
  (`'operacao' | 'cadastros' | 'sistema'`), e a lista é renderizada agrupada, com rótulo por seção
  (`navGroups` define os rótulos e a ordem das seções). Ao adicionar um item novo a
  `defaultNavItems`, escolha o `group` — o `tsc` cobra. Uma seção cujos itens sejam todos barrados
  por permissão não renderiza rótulo nem separador.
- **Arrastar identifica o item por `id`, nunca por índice.** A lista renderizada é filtrada por
  permissão (`hasModuleAccess`), então o índice na tela não corresponde ao de `navItems` — usar o
  índice reordenava o item errado para qualquer usuário sem acesso a algum módulo (bug real,
  corrigido nessa rodada). Como cada item pertence a uma seção, `handleDragOver` ignora um alvo de
  outro `group`: reordenar vale dentro da seção. O formato persistido em IndexedDB
  (`sidebar_menu_order`) não mudou — segue a lista achatada de ids.
- **O tooltip do modo recolhido vai para o `body` via `createPortal`.** A lista de itens tem
  `overflow-x-hidden`, que cortaria um tooltip posicionado à direita do menu. Como a posição vem de
  `getBoundingClientRect()` (coordenadas de viewport), o tooltip é dispensado ao rolar a lista e ao
  expandir o menu. Não volte a usar o atributo `title` aqui: além de ~1s de espera, ele é renderizado
  pelo sistema operacional, fora do tema.
- **Submenu anima com `grid-rows-[0fr] → [1fr]`, não com `max-height`.** A versão anterior usava
  `max-h-40` (160px) e "Associados", com 4 subitens, já estava no limite — um quinto seria cortado
  sem nenhum aviso. O wrapper é `grid` e o filho é `min-h-0 overflow-hidden`.

O estado ativo tem um vocabulário só: fundo `#3B82F6/15` mais um trilho de 3px na borda esquerda,
igual para item e subitem. O item-pai perde o fundo quando o submenu está aberto (o trilho passa a
marcar o subitem ativo) — se mexer nisso, mantenha os dois casos coerentes.

Lacuna conhecida, **pré-existente e não corrigida**: o item-pai de submenu é um `div` com `onClick`,
sem `role` nem `tabIndex` — não dá para acioná-lo pelo teclado. Corrigir muda comportamento, não só
estética; ficou fora das entregas de redesenho.

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
atualize o teste correspondente — é o critério mínimo para saber se uma mudança quebrou algo.

**Mockando services offline-first**: os primeiros testes de `services/` cobriam só funções puras
(`sanitize*ForSupabase` em `financeiroService.ts`). Para testar as funções assíncronas que seguem o
padrão offline-first (ver seção acima), mocka-se `../lib/idb` com `vi.mock` — e, quando a função
também grava auditoria ou enfileira sync, `../lib/syncService` e `../lib/supabase` — e testa-se só o
caminho `isOnline=false`: é ali que mora a lógica de negócio de verdade (filtro por `tenant_id`,
fallback de valores, transições de status), sem precisar de rede real nem de IndexedDB de verdade.
Ver `financeiroService.test.ts` (`getParcelasReceber`, `registrarRecebimento`,
`estornarRecebimento`...), `requisicoesService.test.ts` e `faturamentoService.test.ts` como
referência do padrão ao testar um service novo.

**Conferindo a impressão de verdade**: o CSS de impressão não é observável por teste unitário — só
dá para checar que a string gerada contém a regra certa (é o que `documentoPrintStyles.test.ts` faz).
O que o navegador realmente produz precisa de um navegador. Este ambiente tem Chromium pré-instalado
em `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` e `puppeteer` já nas dependências: dá para
montar o HTML com `montarHtmlImpressaoDocumento()`, `page.setContent()`, `page.pdf()` e então medir
posições no DOM ou inspecionar o PDF resultante (contar `/Type /Pages /Count`, ou localizar um
elemento por uma cor única no content stream de cada página). Foi assim que se descobriu que a
assinatura imprimia com `position: static` — um diagnóstico feito só pela leitura do código tinha
chegado ao mecanismo errado. Vale o esforço sempre que a mudança for sobre o que sai no papel; não é
teste de suíte, é verificação pontual antes do commit.

**Primeiro teste de componente**: `AssociadoFormModal.test.tsx` é o primeiro teste de render do
projeto, com `@testing-library/react` (já era devDependency havia tempo, mas nunca tinha sido usada).
Componentes que recebem todo o estado via props e não têm hooks próprios — o estado mora num hook
externo, como `useAssociadosState.ts` para os de associados — são os mais baratos de testar assim:
dá para isolar o que renderiza incondicionalmente (cabeçalho, avisos, botões) passando um valor de
controle (ex. `activeTab: '__nenhuma_aba__'`) que não bate com nenhum caso conhecido, sem precisar
simular os dados de cada aba/seção condicional. Ainda não existe suíte de teste de UI além desse
smoke test — ao testar um componente grande "orientado a props" na mesma linha, vale seguir o mesmo
padrão em vez de tentar renderizar a árvore inteira de uma vez.

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
