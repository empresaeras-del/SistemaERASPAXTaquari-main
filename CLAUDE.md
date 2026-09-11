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

### O registro excluído que voltava: "ausente no servidor" ≠ "criado offline"

Incidente real de 10/09/2026, relatado da UI: uma receita excluída pelo app (`50be9316`, às
01:16) continuava aparecendo — com as 12 parcelas dela — na tela de Mensalidades de **outras
sessões**. O banco estava certo; o cliente é que ressuscitava.

O merge de todo `getX` fazia:

```ts
if (!remoteMap.has(localItem.id) && !localItem.deleted_at) remoteMap.set(localItem.id, localItem);
```

A intenção estava certa — registro criado offline não pode sumir da tela só porque o servidor
ainda não o conhece. Mas **"ausente na resposta remota" é indistinguível de "excluído no
servidor"**, e as exclusões aqui são *hard delete* (`excluirReceita` faz `.delete()`), sem
deixar lápide. O navegador que excluiu limpou o próprio IndexedDB; os outros nunca souberam, e
IndexedDB é persistente — recarregar a página não resolvia.

**Pior que exibir errado**: `atualizarReceita` e a fila de sync fazem `upsert`, e upsert de
linha inexistente é **INSERT**. Uma sessão com cache velho podia **reinserir no banco** o
registro excluído — e aí ele voltava para todo mundo. Não chegou a acontecer, mas o caminho
estava aberto.

A correção (`utils/mesclagemOfflineFirst.ts`, puro e testado): **a fila de sync é quem sabe a
diferença**. Um registro local ausente no remoto só é preservado se tiver tarefa pendente na
fila — que existe exatamente para guardar o que ainda não subiu. Sem tarefa pendente, foi
excluído em outro lugar: sai da lista **e sai do IndexedDB**, então o cache se cura sozinho no
próximo carregamento online, sem ninguém limpar nada à mão.

Duas salvaguardas, e elas são o que impede a correção de virar perda de dado:

- **Só pode podar quando a busca remota deu certo.** Se o Supabase falhou, "ausente" não
  significa nada e podar apagaria o cache inteiro. Por isso a poda vive dentro do
  `if (!error && data)`.
- **A poda respeita o tenant da consulta.** A consulta filtra por empresa, então registro de
  **outra** empresa está legitimamente fora da resposta — podá-lo apagaria o cache da outra
  empresa a cada troca de empresa na tela.

De passagem, o guard `if (!error && data && data.length > 0)` virou `if (!error && data)` nos
quatro getters de `financeiroService`: **zero linhas é resposta válida, não falha de rede**.
Exigir `length > 0` fazia "a empresa não tem mais nenhum lançamento" cair no ramo de erro e
devolver o cache — exatamente onde o registro excluído sobrevivia.

**Lacuna conhecida, deixada de fora de propósito**: `getAssociados` tem duas tentativas de
busca (com e sem join) e usa `data === null` como sinal de "tentar a próxima", então lá o
resultado vazio legítimo ainda cai no cache local. A mesclagem nova já está aplicada e cobre o
caso comum (empresa com ao menos um associado); reestruturar aquele encadeamento é mudança de
risco próprio e merece passada separada.

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

**Plano de deprecação — passo 1 concluído em 09/09/2026, resultado inverte a suposição inicial**:
o plano abaixo presumia que as colunas legadas talvez já estivessem paradas, sobrando só migrar
dado velho. Não é o caso: `associadosService.ts` (`salvarAssociado`, por volta da linha 391) e
`useDocumentosPadroes.ts` (`criar`/`editar`) gravam as duas colunas de cada par, em todo save,
deliberadamente — não é uma integração externa, é o próprio código-fonte. Conferido direto na
produção (`qigytjkgehwxalhmwpdd`, consulta completa às 3 linhas de `associados` e 6 de
`documentos_padroes` que existem hoje — a base ainda é pequena o bastante pra isso ser exaustivo,
não amostra):

- `logradouro`/`endereco_logradouro`: **0 divergências** nas 3 linhas — o dual-write mantém os dois
  idênticos. Continua vivo; não dá pra passar do passo 1 pra esse par sem antes parar de gravar a
  coluna legada no código (o que é o novo passo 2, não o passo 2 original).
- `conteudo`/`conteudo_html`, `criado_em`/`created_at`, `atualizado_em`/`updated_at`: mesma coisa —
  **0 divergências** nas 6 linhas de `documentos_padroes`. Mesma conclusão.
- `plano_id`: diferente dos outros — **as 3 linhas têm `plano_id IS NULL`**, enquanto
  `plano_pax_id` tem o valor real. `associadosService.ts:288` só grava `plano_id` quando
  `rest.plano_id` já chega preenchido do formulário, o que não acontece (o formulário só popula
  `plano_pax_id`); então a coluna legada é reescrita para `NULL` a cada save, não mantida em
  sincronia. Na prática já está "vazia" — não há dado pra migrar (o passo 2 original é moot pra
  esse caso). **As leituras de `plano_id` foram removidas numa passada isolada** — ver
  "As três leituras de `plano_id`" abaixo.
- Nenhuma function/view/trigger no schema `public` referencia essas colunas (`pg_proc`/
  `information_schema.views` varridos), e não há Edge Functions no projeto — descarta o cenário de
  integração externa escrevendo por fora do app.

Efeito prático: o passo 2 original ("migrar os poucos registros divergentes") não tinha o que fazer —
não havia divergência, o problema era o oposto, dado demais sendo escrito nos dois lugares.

1. ~~Confirmar se as colunas legadas ainda recebem escrita~~ — feito, ver acima.
2. ~~Parar o dual-write no código~~ — feito. `associadosService.ts` (`saveAssociado`) não grava mais
   `logradouro`/`numero`/`bairro`/`cidade`/`cep`/`uf`/`plano_id`, só o par canônico
   `endereco_*`/`plano_pax_id`. `lib/syncService.ts` (fila de sync offline) tinha a mesma duplicação
   isolada em `cidade`/`plano_id` — removida do mesmo jeito, com os nomes legados destruturados pra
   fora do payload em vez de só pararem de ser sobrescritos (evita que um registro antigo na fila
   ainda carregue o valor de antes desta mudança e vaze pro insert via `...assocClean`).
   `useDocumentosPadroes.ts` (`criar`/`editar`) não grava mais `conteudo_html`/`created_at`/
   `updated_at`, só `conteudo`/`criado_em`/`atualizado_em`. As leituras com fallback
   (`assoc.endereco_logradouro || assoc.logradouro`, `item.conteudo || item.conteudo_html`) foram
   mantidas de propósito — é o que faz a coluna legada continuar valendo como alias pra quem ainda
   a lê, agora só-leitura de verdade. A normalização em `getAssociados()` que espelha
   `endereco_logradouro` em `logradouro` no objeto devolvido pro app também ficou — isso não escreve
   no Postgres, só mantém o formato local consistente pra qualquer leitor que acesse o nome antigo.
3. Manter a coluna legada por um ciclo de release como alias somente-leitura (estado atual).
4. Só então dropar a coluna legada, numa migration própria, depois de confirmar nos logs/advisors
   que nada mais a referencia.

Não pule direto para o passo 4 — dropar uma coluna que algo ainda escreve quebra silenciosamente
esse algo mais tarde.

### O passo 3 não deixa a coluna legada como alias — deixa como fotografia

Parar o dual-write não congela os dois lados juntos: congela **só o legado**, e o canônico segue.
Conferido em produção em 10/09, e a primeira divergência já existe: em `documentos_padroes`, a
linha "Ata de Tanatopraxia" — a **única das 6 salva depois da PR #30** — tem `conteudo` com 15.581
caracteres contra 16.969 em `conteudo_html`, e `atualizado_em` de 09/09 contra `updated_at` de
24/08. As outras 5 continuam idênticas só porque ninguém as tocou desde então. Em `associados` a
divergência ainda não apareceu porque a única linha salva depois da PR #30 não teve o endereço
alterado.

Isso não é defeito — é a prova de que o passo 2 funcionou. Mas reclassifica as leituras com
fallback que o passo 3 mantém de propósito: `item.conteudo || item.conteudo_html` deixou de ser
"o mesmo texto por outro nome". Se o lado canônico vier vazio, o que a tela mostra é a versão de
**antes** de a escrita parar. Ao manter um fallback assim, saiba que ele serve dado velho, não um
sinônimo — e prefira `?? ` a `||` se string vazia for um valor legítimo do campo.

### As três leituras de `plano_id`, e por que só duas eram bloqueantes

O passo 4 desse par estava descrito como "esperar um ciclo de release sem nada referenciar a
coluna". A precondição não estava cumprida: **duas consultas iam ao Postgres pedindo `plano_id`**,
e um `drop` as quebraria na hora com `42703 column does not exist`, não em silêncio meses depois:

- `hooks/usePlanosPax.ts` (`verificarVinculosPlano`) — `.or('plano_pax_id.eq.X,plano_id.eq.X')`;
- `hooks/usePlanosAnalytics.ts` — `plano_id` na lista do `.select(...)`.

A terceira era o filtro do cache do IndexedDB, na mesma função da primeira
(`a.plano_pax_id === planoId || a.plano_id === planoId`). Essa **não** quebraria: acessar
propriedade inexistente em JavaScript devolve `undefined`, sem erro. As três saíram juntas mesmo
assim, porque as duas da `verificarVinculosPlano` são o mesmo predicado escrito em dois lugares —
deixar metade tornaria a função incoerente consigo mesma.

**A regra que vale para a próxima**: ao varrer o que ainda referencia uma coluna a ser dropada,
separe o que **quebra** (qualquer nome de coluna que viaja para o servidor — `select`, `or`, `eq`,
`order`) do que **degrada em silêncio** (acesso a propriedade em objeto já carregado). Só o
primeiro grupo bloqueia o `drop`; e é o segundo que uma varredura por `grep` tende a misturar com
ele.

`verificarVinculosPlano` é a guarda que impede excluir um plano com associado vinculado, então
estreitá-la é mudança de comportamento — e foi por isso que a remoção só valeu depois de conferir
que o ramo legado não podia casar nada: as 3 linhas de `associados` têm `plano_id IS NULL`, e
`plano_id.eq.<uuid>` nunca casa `NULL` de qualquer forma. `lib/syncService.ts` continua
destruturando `plano_id` para fora do payload de escrita, e isso **não** sai: é o que impede um
registro antigo na fila de mandar a coluna legada num insert — e passa a ser o que impede um erro
de coluna inexistente depois do `drop`.

## Plano contábil: a FK que carrega o `tenant_id` dentro dela

`planos_contabeis` e `contas_contabeis` (migration `20260909021132`) são o catálogo de contas
de receita e despesa de cada empresa — a substituição do `categoria` de texto livre dos
lançamentos, que até então só existia no IndexedDB do navegador via `useOptions`.

Duas decisões deste módulo valem como referência para tabelas novas:

- **A conta é uma árvore, não duas tabelas.** `contas_contabeis.conta_pai_id` aponta para a
  própria tabela; `tipo` distingue `sintetica` (grupo, não recebe lançamento) de `analitica`
  (folha lançável). Isso aceita 3+ níveis sem migration nova, e o relatório por grupo é um
  `WITH RECURSIVE` sobre uma tabela só.
- **O isolamento por empresa está na chave, não na revisão de código.** As FKs são compostas
  e levam o `tenant_id` junto: `contas_contabeis (tenant_id, plano_id) → planos_contabeis
  (tenant_id, id)`, e a conta pai referencia `(tenant_id, plano_id, id)`. Uma FK simples por
  `id` garantiria só que a linha existe — apontar para conta de outra empresa passaria no
  banco em silêncio. Como este schema já teve três incidentes de vazamento entre empresas
  (PRs #13, #14 e #23), a regra aqui é: **quando uma tabela nova referencia outra tabela
  multi-tenant, use FK composta com `tenant_id`**, e declare a `unique (tenant_id, id)` do
  lado referenciado para viabilizá-la. Na fase 2 a mesma técnica impede que uma receita
  aponte para conta de despesa, incluindo `natureza` na chave.

As sete constraints foram verificadas contra o banco real antes do commit, com um bloco
`DO $$` que tenta cada violação e aborta no fim (`RAISE EXCEPTION` ⇒ rollback), sem deixar
dado de teste em produção — vale repetir esse padrão ao criar tabela nova com constraint não
trivial, em vez de confiar que o DDL faz o que promete.

O plano modelo (`config/planoContabilPadrao.config.ts`) é **constante do frontend copiada**
para linhas do tenant no momento da semeadura — não é linha com `tenant_id IS NULL`
compartilhada entre empresas. É o oposto do que causou o incidente `empresa_padrao`: cada
empresa vira dona das próprias contas. A ordem do array importa (pai antes das filhas, porque
`semearPlanoPadrao` resolve `conta_pai_id` pelo código do pai já inserido) e está travada por
teste em `planoContabilTree.test.ts`.

### Fase 2: os lançamentos apontam para a conta (migration `20260909112853`)

`receitas` e `despesas` ganharam `conta_contabil_id` (nullable) e `natureza_contabil`
(constante, garantida por `CHECK`). Três coisas dessa fase valem como regra geral:

- **A natureza viaja dentro da FK.** A chave é
  `(tenant_id, natureza_contabil, conta_contabil_id) → contas_contabeis (tenant_id, natureza, id)`.
  Com isso o banco recusa, sozinho, tanto conta de outra empresa quanto **receita em conta de
  despesa** — sem trigger e sem validação na aplicação. A coluna `natureza_contabil` existe
  só para isso; não é dado de negócio.
- **Nullable é o que preserva o legado.** Com `MATCH SIMPLE` (o padrão), uma FK composta é
  satisfeita se qualquer coluna da chave for `NULL`, então todo lançamento anterior continua
  válido sem exceção na constraint. A coluna só vira obrigatória na fase 3, depois do backfill,
  em migration própria.
- **O trigger `valida_conta_lancavel` checa `tipo`, mas de propósito não checa `ativo`.**
  Desativar uma conta é decisão sobre lançamentos futuros; se `ativo` entrasse na validação,
  editar um lançamento antigo (corrigir um valor, mudar uma observação) passaria a falhar
  depois que a conta fosse desativada. O filtro por `ativo` pertence ao seletor da tela — e o
  seletor, por isso mesmo, ainda exibe a conta já gravada mesmo desativada, senão abrir o
  lançamento para editar apagaria a classificação dele.

### Fase 3: a conta vira obrigatória — mas só daqui para frente (migrations `20260909120635`, `20260909120746`, `20260909120831`)

Três coisas mudaram, e as três têm uma decisão de projeto por trás:

- **A obrigatoriedade é um trigger, não um `NOT NULL`.** A regra é "lançamento criado a partir
  de 09/09/2026 precisa de conta", e um `NOT NULL` vale para a linha, não para o instante em que
  ela nasceu — quebraria o lançamento antigo no primeiro `UPDATE`. Além disso a regra tem duas
  isenções que nenhum `CHECK` alcança, porque dependem de outra tabela e de outra coluna:
  suprimento/sangria e empresa sem conta analítica da natureza. `exige_conta_contabil()` cobre
  as três tabelas (`receitas`, `despesas`, `movimentacoes_caixa`) com uma função só.
- **A isenção "empresa sem conta lançável" é o que impede a fase 3 de travar empresa nova.**
  Enquanto a empresa não montar o plano, tudo segue como antes, com `categoria` de texto livre —
  o mesmo fallback que os formulários já mostram desde a fase 2. Só se exige o que é possível
  cumprir. **Ao criar regra obrigatória nova, prefira esse formato** a um `NOT NULL` que assume
  que todo tenant já está no estado novo.
- **O corte compara `criado_em`, que o cliente envia** (ver `sanitize*ForSupabase`). É
  deliberado: um lançamento feito offline ontem e sincronizado amanhã carrega o `criado_em` de
  ontem e entra sem conta, em vez de ser recusado na fila de sync — que seria perda silenciosa
  de dado, a armadilha que este arquivo já documenta. Confiar no relógio do cliente aqui é o
  preço de não perder o lançamento offline, não um descuido.

**Os caminhos automáticos.** Cinco lugares criam lançamento sem passar por formulário nenhum —
`NovoAtendimentoWizard`, `RequisicoesPage` (co-participação), `MensalidadesGeracaoWizard`,
`NovoContratoWizard` e `faturamentoService` (repasse ao credenciado). Todos passaram a resolver
a conta por **código** (`CODIGO_CONTA_*` em `config/planoContabilPadrao.config.ts`) via
`resolverContaLancamento`, que se apoia na função pura `resolverContaPorCodigo` — código pedido
→ conta de sobra da natureza → primeira analítica → `null`. Procurar por código, e não por nome,
é o que faz a empresa que renomeou a conta continuar funcionando. **Ao criar um caminho novo que
grave receita ou despesa, resolva a conta assim** — não repita um literal de `categoria`.

**Movimentações de caixa entraram, mas nenhuma tela ganhou seletor** — e isso é o resultado
certo, não uma pendência. Das quatro origens que o app de fato produz, `contas_receber` e
`contas_pagar` **herdam** a conta do lançamento que as originou (em `registrarMovimentacao`,
num lugar só, em vez de nos 3 pontos de chamada), porque a receita já foi classificada quando
nasceu e a movimentação é a liquidação dela — perguntar de novo ao operador abriria espaço para
o mesmo valor cair em duas contas no relatório. `suprimento` e `sangria` são **isentas**:
transferir numerário entre caixa e banco não é receita nem despesa, e classificá-las inflaria o
resultado do exercício. A origem `avulso` existe no tipo mas não tem produtor no código — se um
dia ganhar tela, é ela que precisa do seletor.

Em `movimentacoes_caixa` a `natureza_contabil` não é constante como em `receitas`/`despesas`:
depende de `tipo` (`entrada` => receita, `saida` => despesa). Por isso é preenchida por trigger
e travada por `CHECK` — o valor que o cliente mandar é sobrescrito, e a FK composta continua
valendo sem depender de o app acertar.

**O backfill classificou o legado por `categoria`**, em quatro degraus: nome da conta igual à
categoria, mapa de sinônimos das categorias antigas do `useOptions`, conta de sobra da natureza,
primeira analítica. Rodou sobre as 8 linhas que existiam (5 receitas, 1 despesa, 2 movimentações)
e não sobrou nenhuma sem conta. O mapa de sinônimos cobre as categorias legadas, não só as que
apareciam em produção — a base ainda é pequena, mas o arquivo serve de documentação de para onde
cada categoria antiga foi.

No frontend, `categoria` continua `NOT NULL` e passou a ser o **snapshot do nome da conta** no
momento do lançamento — escrito uma vez, nunca re-sincronizado se a conta for renomeada, e
nunca usado para agrupar relatório (isso é papel de `conta_contabil_id`). É o mesmo padrão que
o schema já usa em `associado_nome`/`fornecedor_nome` ao lado dos respectivos ids, e **não** é o
dual-write removido na PR #30: a diferença está em quem lê o campo depois.

`components/financeiro/SeletorContaContabil.tsx` é usado pelas duas telas de lançamento e
recebe as contas **por props**, sem chamar `usePlanoContabil` por dentro — a tela já precisa do
hook para saber se a empresa tem plano, e um hook no componente carregaria plano e contas duas
vezes por formulário aberto. Empresa que ainda não montou o plano continua vendo o seletor de
categoria antigo: `categoria` é `NOT NULL`, então remover o campo travaria o formulário dela.

### Fase 4: exercício, código imposto e centro de custo como tabela

**O plano é por empresa E exercício** (migrations `20260909122831` e `20260909122900`).
`planos_contabeis.exercicio` é um `integer` — o ano contábil —, e o índice único de plano
ativo passou de `(tenant_id)` para `(tenant_id, exercicio)`. Duas coisas valem como regra:

- **`getPlanoAtivo` cai para o exercício mais recente quando o pedido não existe**, em vez de
  devolver `null`. Sem essa queda, na virada do ano toda empresa perderia o plano de um dia
  para o outro, os lançamentos voltariam a nascer sem classificação (a isenção do trigger
  `exige_conta_contabil` passaria a valer) e nada apareceria na tela. Quem avisa que falta
  montar o exercício novo é a tela do plano, com o botão de copiar — não o silêncio.
- **Duplicar copia, nunca move.** `duplicarPlanoParaExercicio` cria ids novos e **remapeia
  `conta_pai_id` do id antigo para o novo**, percorrendo as contas em ordem de código (pai
  antes das filhas). Copiar mantendo o `conta_pai_id` de origem penduraria as contas de 2027
  nas de 2026 — e a FK composta `(tenant_id, plano_id, conta_pai_id)` recusaria de qualquer
  forma. O plano do ano fechado continua intacto, com os lançamentos daquele ano nele: é isso
  que faz o relatório de um exercício encerrado continuar batendo depois.
- **A ação de duplicar fica sempre disponível, e o exercício de destino é digitável.** A
  primeira versão só mostrava o botão quando `plano.exercicio < ano corrente` — condição que
  **nunca é verdadeira** enquanto a empresa está no ano em que montou o plano. Na prática o
  botão só apareceria em 1º de janeiro, exatamente quando já é tarde: os lançamentos do ano
  novo já teriam começado a cair no plano do ano anterior pela queda de `getPlanoAtivo`, em
  silêncio. **Preparar o exercício seguinte é trabalho de dezembro** — a ação não pode depender
  de o problema já ter acontecido. O destino sugerido vem de `proximoExercicioLivre`
  (`utils/exerciciosContabeis.ts`, puro e testado) e o aviso âmbar de "falta o exercício
  corrente" virou informativo, não mais o único caminho para a ação.

A primeira migration desta parte **ficou incompleta e a segunda corrige**: soltar a unicidade
do plano ativo para `(tenant, exercício)` não bastava, porque `planos_contabeis_codigo_uk
unique (tenant_id, codigo)` continuava barrando o mesmo código em dois exercícios — duplicar
"PADRAO" de 2026 para 2027 falhava no insert. Arquivo separado de propósito (ver "uma
migration aplicada, um arquivo"): é o segundo par assim no repositório, depois de
`revoke_anon`/`revoke_public`. **Ao afrouxar uma unicidade, verifique todas as outras chaves
da tabela** — a que sobra costuma reimpor exatamente o que você acabou de liberar.

**Codificação imposta.** O campo de código no formulário de conta é `readOnly`: o valor vem de
`proximoCodigo(contas, paiCodigo)` a partir da conta pai escolhida. Código livre deixava criar
`3.1.01` dentro de `4.2` — a árvore desenhada pelos códigos discordava da árvore real de
`conta_pai_id`, e o relatório por grupo saía errado sem aviso. O código de uma conta que já
existe também não muda: é por ele que quem exportou relatório reconhece a conta.

**Centro de custo virou tabela** (`centros_custo`, migrations `20260909122921` e
`20260909122939`). Era a mesma doença que `categoria` tinha antes do plano contábil: a lista
vivia em `useOptions('centros_custo')`, ou seja, **no IndexedDB de cada navegador** — dois
operadores da mesma empresa podiam ter listas diferentes, e a despesa guardava só o texto que
aquele navegador oferecia. Agora é linha da empresa, com `unique (tenant_id, id)` do lado
referenciado e FK composta `(tenant_id, centro_custo_id)` em `despesas`. `despesas.centro_custo`
(texto) continua como **snapshot** do nome ao lado do id — mesmo par de
`categoria`/`conta_contabil_id`, e pelo mesmo motivo.

O código do centro é derivado do nome (`codigoDeCentroCusto`, puro e testado), não uma
sequência numérica: centro de custo não tem hierarquia, e `ADMINISTRATIVO` diz o que é num
relatório exportado enquanto `03` não diz nada. **A função em TypeScript e o `translate()` do
backfill em SQL geram o mesmo código de propósito**, e há teste travando os seis do modelo —
se divergirem, o app cria um centro duplicado em vez de reaproveitar o que a migration criou.

Empresa sem nenhum centro cadastrado continua vendo o select antigo do `useOptions`, pelo
mesmo motivo do seletor de categoria: `centro_custo` nunca foi obrigatório, e trocar a lista
por um seletor vazio tiraria uma opção que a tela tinha.

O **cadastro** dos centros vive em `components/financeiro/CentrosCustoModal.tsx`, aberto pelo
"Gerenciar" do formulário de despesa. Ele chama `useCentrosCusto` por dentro — ao contrário de
`SeletorContaContabil`, que recebe por props — porque é um gerenciador aberto sob demanda, uma
instância por vez, que precisa recarregar a própria lista depois de cada gravação; passar isso
por props obrigaria a tela a saber de salvar/desativar/reativar, que não é assunto dela. Não há
excluir: desativar tira do seletor de lançamentos novos sem tocar nas despesas que já usam o
centro (a FK é `ON DELETE RESTRICT` de qualquer forma).

### Valores realizados no plano: a fonte é a parcela, nunca parcela + caixa

A tela do Plano de Contas mostra, à frente de cada conta, o **realizado** e o **previsto** do
exercício, e o botão "Demonstração Contábil" tira o mesmo número em prévia, impressão e PDF.
Quatro decisões deste módulo valem como regra:

- **Um recebimento produz dois registros, e só um pode ser somado.** A parcela muda de status
  (ganha `data_pagamento` e `valor_recebido`) **e** nasce uma linha em `movimentacoes_caixa`
  com a conta herdada do lançamento (ver `registrarMovimentacao`). Somar as duas fontes
  contaria o mesmo dinheiro duas vezes em toda conta liquidada pelo caixa. A fonte escolhida é
  a **parcela**: ela existe para todo lançamento (a movimentação só aparece quando a
  liquidação passa por um caixa aberto), é quem carrega o valor efetivamente recebido/pago, e
  é a mesma base que as telas de Contas a Receber e a Pagar já mostram — o relatório bate com
  o que o operador vê. Ao somar dinheiro em relatório novo, escolha **uma** fonte e escreva
  por que; as duas estão sempre disponíveis e sempre parecem complementares.
- **Previsto e realizado têm datas diferentes, de propósito.** Previsto é a parcela lançada,
  pelo valor de face e pelo **vencimento**; realizado é a parcela liquidada, pelo valor
  efetivamente pago e pela **data da liquidação**. Uma parcela que vence em dezembro e é paga
  em janeiro é prevista num exercício e realizada no outro — que é o que um demonstrativo por
  exercício precisa dizer.
- **O ano vem do texto da data, nunca de `new Date()`.** `new Date('2026-01-01')` é meia-noite
  **UTC**; em UTC-3 isso é 31/12/2025, e todo lançamento de 1º de janeiro cairia no exercício
  anterior. `anoDaData()` lê os quatro primeiros dígitos e pronto.
- **O que não entra na soma aparece como nota, não some.** `foraDoExercicio` (conta deste
  plano, data em outro ano) e `naoClassificado` (lançamento legado, ou conta de outro plano)
  são devolvidos pela agregação e impressos no rodapé da tela e do relatório. Não é detalhe:
  na produção de hoje o tenant principal tem R$ 1.370 previstos em 2026 e **R$ 1.652 fora
  dele** — as prestações seguintes dos parcelamentos. Sem a nota, esse dinheiro simplesmente
  não apareceria em lugar nenhum, e o operador concluiria que o sistema perdeu lançamento.

A conta zerada continua na árvore e no relatório (com o filtro "somente contas com movimento"
desmarcado): o plano é a **estrutura**, e uma linha faltando faz procurar a conta que se sabe
que existe. O total de uma sintética é a soma das descendentes — nunca algo lançado nela, que
o trigger `valida_conta_lancavel` não permite.

A divisão é a mesma da Ficha de Cadastro: `utils/demonstracaoContabil.ts` decide **o quê**
(agregação, rollup, achatamento em linhas) e cada renderizador decide só **como** — tela,
`utils/demonstracaoContabilImpressao.ts` (janela de impressão) e o `jsPDF` do modal. `jspdf` e
`jspdf-autotable` entram por **import dinâmico** dentro do handler, não no topo: confirmado no
`dist/index.html` que não viram `modulepreload` e que o chunk da rota ficou em ~39 KB.

`achatarArvore` (em `planoContabilTree.ts`) virou genérica no nó (`<T extends { filhas: T[] }>`)
para a tela conseguir achatar `ContaComValores` sem perder os valores na assinatura.

### Filtrar lançamento por classificação: a parcela não sabe, o pai sabe

As telas de Contas a Receber e a Pagar listam **parcelas**, e a classificação (conta contábil,
centro de custo) está no **lançamento pai**. As duas telas já carregam `receitas`/`despesas`
junto das parcelas, então o filtro é uma junção em memória — e ela mora em
`utils/filtrosClassificacao.ts`, não nas páginas, porque as duas fariam a mesma coisa e porque
é a única parte disso que dá para testar sem navegador.

Duas decisões que valem para qualquer filtro derivado assim:

- **Índice, não varredura.** `indicePorLancamento` monta um `Map` id → classificação uma vez
  por render, em vez de cada parcela procurar o pai na lista inteira.
- **Com filtro ativo, a parcela órfã fica de fora.** Se o pai não for encontrado (não
  carregado, ou lançamento legado sem classificação), ela não casa. Deixá-la passar faria uma
  parcela sem classificação nenhuma aparecer em *qualquer* filtro escolhido — o oposto de
  filtrar. Sem filtro, tudo casa, inclusive ela.

As opções dos seletores incluem conta e centro **desativados** de propósito: um lançamento
antigo pode apontar para um deles, e sem a opção na lista ele viraria infiltrável.

## Índice novo em tabela que já existe: procure por definição, não por nome

Nove tabelas ficaram meses com **dois índices byte a byte idênticos** sobre `tenant_id`
(`idx_<tabela>_tenant`, do schema original de 17/08, e `idx_<tabela>_tenant_id`, das migrations de
correção de RLS de 31/08, 03/09 e 05/09). Removidos na migration `20260910012513`.

A causa é uma armadilha que vale para qualquer índice futuro: **`CREATE INDEX IF NOT EXISTS` casa
pelo nome, nunca pela definição.** As migrations de RLS acrescentaram "um índice de cobertura para
o predicado da policy" com o nome que lhes pareceu natural; o `IF NOT EXISTS` não viu conflito
algum, porque o nome era mesmo novo — e o índice equivalente que já existia continuou lá. Cada
cópia extra custa escrita e espaço sem devolver nada em leitura.

Antes de adicionar índice a uma tabela que já existe, consulte `pg_indexes`/`pg_get_indexdef` e
compare a **definição**. E ao desempatar um par assim, três sinais decidem qual fica, de
preferência apontando para o mesmo lado: qual é o original, qual o planner realmente usa
(`pg_stat_user_indexes.idx_scan` — nos 9 pares o curto ganhava em todos, e em quatro deles o longo
estava zerado) e qual é a convenção majoritária do schema.

Confira também, antes de dropar, que nenhum dos dois é `UNIQUE`/`PRIMARY` nem tem constraint
dependente (`pg_constraint.conindid`) — aí não seria um duplicado descartável, seria a estrutura
que sustenta a constraint.

## Campo opcional com `UNIQUE`: grave `NULL`, nunca string vazia

`credenciados.cnpj_cpf` (opcional desde a migration `20260908182307`) é o primeiro caso disso no
projeto, mas o padrão vale para qualquer coluna futura que seja ao mesmo tempo opcional e
`UNIQUE`. O Postgres trata cada `NULL` como distinto dos demais para fins de unicidade — vários
registros sem valor coexistem normalmente —, mas duas strings vazias (`''`) são iguais entre si e
colidem. Se o formulário salvar `''` no lugar de `NULL` quando o campo fica em branco, o *segundo*
registro sem valor falha com uma violação de `UNIQUE` que parece dizer "já existe um igual a este",
quando não existe nenhum de verdade — só o valor vazio duplicado. Normalize no ponto de escrita
(`valor.trim() || null`), não na coluna.

## Atendimentos: os dados do responsável pelo falecido

`atendimentos` ganhou oito colunas de responsável (migration `20260910183445`):
`responsavel_nome`/`cpf`/`rg`/`parentesco`/`endereco`/`contato`/`nacionalidade`/`observacoes`.
Quatro decisões deste bloco valem como regra:

- **A obrigatoriedade é do formulário, não da coluna.** As oito são `nullable`. A regra pedida é
  "cliente externo precisa preencher", e um `NOT NULL` vale para a linha, não para o tipo de
  cliente nem para o instante em que ela nasceu — quebraria todo atendimento anterior a 10/09/2026
  no primeiro `UPDATE`. A exigência vive em `responsavelExternoSchema`
  (`schemas/atendimentoSchema.ts`), checado no `handleNext` da etapa 1. É a mesma escolha da fase 3
  do plano contábil, e pelo mesmo motivo.
- **O titular não pode ser responsável por si mesmo.** Quando o atendimento é de associado, o bloco
  vem preenchido do cadastro do titular — **exceto** quando o falecido é o próprio titular. Aí
  `dadosResponsavelDoAssociado` (`utils/responsavelAtendimento.ts`, pura e testada) devolve tudo em
  branco e a tela mostra um aviso pedindo quem responde. Preencher ali produziria um documento
  afirmando que o morto assinou como responsável pelo próprio velório — errado, e **errado em
  silêncio**, porque todos os campos apareceriam preenchidos e ninguém teria motivo para conferir.
  Ao preencher um formulário a partir de outro cadastro, pergunte antes se existe um caso em que a
  origem não pode ser o destino.
- **Campo apagado grava `null`, nunca `undefined`.** `responsavelParaGravacao` normaliza vazio para
  `null` — e isso não é preciosismo com o `''` (a lição de `credenciados.cnpj_cpf`), é o caminho de
  **edição**: `JSON.stringify` descarta chave `undefined`, então o `upsert` chegaria ao Postgres sem
  a coluna e o valor antigo continuaria lá. O operador apagaria o campo na tela, salvaria, e o dado
  velho seguiria no banco sem nenhum erro. `null` é o que de fato limpa; no insert equivale a
  omitir. **Vale para qualquer campo opcional editável deste schema** — e o caminho de
  `falecido_cpf` em `AtendimentoDetailsModal` ainda tem o defeito antigo, não corrigido aqui por ser
  outro campo e outra decisão.
- **`nacionalidade` nunca é preenchida automaticamente**: não existe essa coluna em `associados`.
  Carimbar "BRASILEIRA" seria escrever no documento um dado que ninguém afirmou.

As tags `{{responsavel_*}}` entraram no resolver e no catálogo, com os aliases
`{{atendimento_responsavel_*}}` seguindo a convenção que o resolver já usava. E o par ganhou o
guarda que faltava: `documentoVariaveis.test.ts` agora falha se alguma tag do módulo Atendimento
existir no catálogo sem resolver — o sintoma dessa divergência é mudo (a tag aparece no painel, o
operador a usa no modelo, e ela nunca preenche), e este arquivo já registra duas ocorrências dela.

## A cobrança automática virou pergunta (atendimento e requisição)

Até 11/09/2026, finalizar um atendimento com item fora da cobertura, ou emitir uma guia com
co-participação, **criava a conta a receber sozinho**, no meio do salvamento. Não havia como
registrar um atendimento de cortesia, nem corrigir o endereço de uma guia, sem gerar cobrança —
e na reedição a guia cobrava **de novo**, em silêncio, a cada save. Agora o operador é perguntado,
e a resposta "não" finaliza o cadastro sem receita nenhuma.

Cinco decisões deste bloco valem como regra:

- **Montar e gravar são passos separados** (`utils/cobrancaAutomatica.ts`, puro e testado). A
  pergunta precisa mostrar o valor **antes** de existir registro, e a recusa precisa ser tão
  barata quanto a confirmação — o que só é possível se montar a proposta não escrever nada. É a
  mesma divisão da Ficha de Cadastro e da Demonstração Contábil: a função pura decide **o quê**,
  a tela decide **quando**.
- **Os dois fluxos tinham a mesma regra escrita duas vezes, com datas diferentes.** Atendimento
  usava `format(new Date(), 'yyyy-MM-dd')` (data local) e requisição usava `.toISOString()` (UTC):
  uma guia emitida às 21h em UTC-3 nascia datada de **amanhã**, a do atendimento não. Unificado em
  `dataLocalISO`. Vale a lição que este arquivo já registra em `anoDaData()`: **o ano e o dia vêm
  do relógio local, nunca de `toISOString()`**.
- **A obrigatoriedade é do operador, não da coluna.** Nenhum `NOT NULL`, nenhuma trava: só a
  pergunta. `deveOferecerCobranca` suprime a pergunta quando não há valor a cobrar — perguntar
  "deseja cobrar R$ 0,00?" treina a responder sem ler, e é assim que uma pergunta útil vira ruído.
- **A falha da cobrança não desfaz o cadastro.** O atendimento (ou a guia) já está gravado quando a
  pergunta aparece; se `salvarReceita` falhar, o `toast` diz exatamente isso — "foi salvo, mas a
  cobrança não pôde ser gerada" — e aponta Contas a Receber. Um erro genérico faria o operador
  cadastrar tudo de novo, duplicando o registro que deu certo. O `finally` leva as duas respostas
  e o erro ao mesmo destino (`finalizarEmissao`/`seguirParaPerguntaDeStatus`): fechar a tela não
  pode depender do caminho feliz.
- **`ConfirmContext` ganhou `onCancel`** porque "não" passou a ter trabalho próprio (avisar e
  finalizar), e não só fechar o diálogo. Ele fecha **antes** de executar o callback — o `onCancel`
  pode abrir outro diálogo, como abre no wizard de atendimento — e engole a exceção do callback em
  `console.error`: um erro ali não pode deixar o modal preso na tela.

### O vínculo `receitas.requisicao_id` existe para a pergunta, não para o relatório

Migration `20260911124654`. A guia só sabia que tinha cobrado pelo texto da descrição
(`Co-participação - Guia X`), o que nenhuma consulta pode usar como chave. Sem o vínculo, a
pergunta na reedição seria feita às cegas — e é justamente na reedição que o operador precisa
saber que já cobrou.

- **FK composta com `tenant_id`**, como manda a seção do plano contábil:
  `(tenant_id, requisicao_id) → requisicoes (tenant_id, id)`, com a `unique (tenant_id, id)` nova
  do lado referenciado. `receitas.atendimento_id`, mais antigo, **não tem FK nenhuma** — o
  precedente do arquivo não é o que vale, a regra atual é.
- **`ON DELETE SET NULL (requisicao_id)`** — a lista de colunas (PG 15+; o servidor é 17.6) é
  obrigatória aqui: um `SET NULL` sem ela tentaria anular também o `tenant_id`, que é `NOT NULL`,
  e o delete falharia. E `SET NULL` é a escolha certa contra `CASCADE` porque excluir a guia
  (que é *hard delete*) não pode levar junto um **registro financeiro** que talvez já tenha sido
  recebido: a cobrança sobrevive, órfã do vínculo.
- **Receita cancelada não conta no aviso** (`avisoCobrancaExistente`). Ela existe no banco e não
  cobra ninguém; avisar sobre ela faria o operador desistir de uma cobrança legítima achando que
  duplicaria.
- **O aviso é enriquecimento, não pré-requisito**: a consulta vive em `try/catch` e, se falhar, a
  pergunta vai sem ele. Bloquear a pergunta por causa do aviso trocaria uma informação a menos por
  um cadastro travado.

`getReceitasPorRequisicao` segue o padrão offline-first e **de propósito não tem o fallback por
texto da descrição** que `getReceitasPorAtendimento` tem: aqui existe chave de verdade, e casar
por texto voltaria a ser o que esta coluna veio substituir.

### A tabela `atendimentos` estava vazia, e ninguém sabia

Relato da UI em 11/09/2026: ao recusar a cobrança, o atendimento também não era
registrado. A recusa não tinha nada a ver — **nenhum atendimento nunca chegou ao
Postgres**. A tabela tinha zero linhas em produção. A pergunta nova só deu a alguém motivo
para olhar.

São dois defeitos empilhados, e o de cima é o que escondia o de baixo:

- **O payload era inválido.** O formulário inicializa cada campo com `''`, e era isso que
  ia para colunas `date`/`timestamptz` (`falecido_data_nascimento`, `data_obito`,
  `data_velorio`, `data_sepultamento`) — `22007 invalid input syntax for type date: ""`. O
  caso mais escondido era o de **cliente externo**: `falecidoId` nunca sai de `''` e ia
  para `dependente_id`, que é `uuid` — `22P02`. Um campo em branco derrubava o insert
  inteiro. `sanitizeAtendimentoForSupabase` normaliza `''` para `NULL` no ponto de escrita,
  como já mandavam as seções de `credenciados.cnpj_cpf` e do responsável — **a regra já
  estava escrita neste arquivo; o que faltou foi aplicá-la às colunas de data e uuid**.
- **A recusa virava sucesso.** `saveAtendimento` tratava `error` do Supabase com
  `console.warn`, seguia para o IndexedDB e devolvia `void`. A tela dizia "Atendimento
  registrado com sucesso!", e como `getAtendimentos` devolve o que vem do servidor quando a
  busca funciona, o registro sumia da lista no recarregamento seguinte — sem erro em lugar
  nenhum. É exatamente a armadilha do `PGRST204` que este arquivo já documentava, com outra
  causa e sem ninguém para notar.

**A regra que vale daqui para frente: recusa do Postgres e queda de rede não podem terminar
igual.** São indistinguíveis num `catch` só, e tratá-las juntas é o que produz perda
silenciosa:

- **Exceção lançada** (rede fora, fetch abortado) é o caso offline-first legítimo: vai para
  o IndexedDB **e para a fila de sync** — é a fila que distingue "criado offline" de
  "excluído no servidor", como a seção do registro que voltava já explica.
- **`error` devolvido pelo cliente** é recusa: constraint, RLS, coluna inexistente. Repetir
  amanhã dá o mesmo resultado, então enfileirar só adia a perda. A função **lança**, o
  formulário continua aberto com tudo preenchido, e o operador pode corrigir.

`criarRequisicao` e `atualizarRequisicao` tinham o mesmo `console.error` seguido de
`saveToIDB` e `registrarAuditoria` — auditando como emitida uma guia que o servidor
recusara. Passaram a lançar do mesmo jeito. Nos dois módulos o `toast` de erro agora
carrega a mensagem do servidor: um genérico "Erro ao registrar" não diz se o problema é do
preenchimento, da permissão ou da rede, e sem isso só resta tentar de novo igual.

Detalhe de implementação que vale lembrar: nos três casos a recusa é guardada numa variável
e relançada **depois** do `catch`. Lançar de dentro do `try` cairia no próprio `catch` que
trata rede — e o erro voltaria a ser engolido, agora por um caminho novo.

**O diagnóstico veio do banco, não da leitura do código.** Três hipóteses plausíveis sobre
o diálogo de confirmação (fechar pelo backdrop, z-index, `onCancel` não disparando) foram
descartadas em minutos por um `select` que mostrou a tabela vazia e por dois inserts numa
transação revertida que devolveram o `SQLSTATE` exato. **Quando o sintoma é "não gravou",
pergunte ao banco antes de reler o componente.**

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
   O editor Jodit entrou nesse alinhamento junto com o resto (as margens já vinham do documento
   pelo `iframeStyle`; a **orientação** era o que faltava) — ver a seção seguinte.

### O editor também é uma etapa do enquadramento — inclusive a orientação

Por um tempo o editor foi descrito aqui como "a única etapa fora do alinhamento, com paddings
próprios no `iframeStyle`". Metade disso já não era verdade: as margens do documento alimentavam
o `iframeStyle` desde a PR #17. **O que continuava fixo era o papel**: `210mm × 297mm` cravado em
quatro lugares do caminho de edição (o `style` e o `iframeStyle` do `editorConfig`, o painel
"Pré-visualização A4" e as miniaturas), além das réguas (21 cm / 29,7 cm) e da regra
`.a4-simulated` no `index.css`. Um documento em paisagem — orientação que o visualizador já
gravava — era editado numa folha retrato e só mostrava o enquadramento certo depois de salvo e
reaberto no visualizador. Três coisas dessa correção valem como regra:

- **`orientacao` é propriedade do documento, como `margens`** — e por isso é lida no
  `handleOpenForm` e vai no payload do save, do mesmo jeito. O editor ganhou o mesmo seletor
  Retrato/Paisagem que o visualizador já tinha: sem ele, um documento novo nasceria sempre retrato
  e não haveria como ver o enquadramento correto enquanto se escreve.
- **O que entra nas dependências do `editorConfig` tem de ser primitivo.** Trocar a identidade do
  objeto `config` remonta o Jodit (perdendo cursor e histórico), então as deps são
  `larguraFolhaMm`/`alturaFolhaMm` — números derivados de `larguraPapelMm`/`alturaPapelMm` — e
  nunca o objeto do documento.
- **`.a4-simulated` passou a receber as medidas por variáveis CSS** (`--a4-largura`,
  `--a4-altura`, `--a4-margem-topo`, `--a4-margem-base`), com os valores antigos como padrão. O
  gradiente que simula as faixas de margem e a quebra a cada folha era `297mm` cravado; em
  paisagem ele desenharia a quebra no lugar errado. Quem não passa nada (`PrintPreviewModal`)
  continua exatamente como antes.

A miniatura deixou de usar escala fixa (`scale(0.24)`): a folha é reduzida até caber na largura da
coluna (192px, a antiga `w-48`) e a altura da caixa sai da proporção do papel. Em retrato isso dá
os mesmos 192×272px de antes — a mudança é que paisagem também fecha, em vez de ser cortada.
`DocumentoMiniaturasPreview.test.tsx` trava esses números.

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

## Máscara de CPF/CNPJ nos relatórios

`utils/mascaraDocumento.ts` mascara documento em **saída impressa** — os relatórios de Contas a
Receber, Contas a Pagar e Auditoria. A regra é `***.537.031-**` para CPF e
`**.***.000/0001-**` para CNPJ: some o prefixo e, principalmente, os **dígitos verificadores**,
que são o que permite validar um palpite. O bloco do meio fica visível para quem lê conseguir
conferir contra um documento que já tem em mãos.

O ponto de aplicação importa: **mascare onde o item do relatório é montado, não em cada
renderizador**. Os dois relatórios financeiros têm três saídas (prévia em tela, HTML de
impressão e PDF) lendo o mesmo campo — `devedorCpfCnpj` e `credorDoc` —, então mascarar na
montagem cobre as três e não dá para esquecer uma. É a mesma lição da Ficha de Cadastro: uma
função pura decide **o quê**, cada renderizador decide só **como**.

Três decisões deliberadas:

- **O CNPJ da própria empresa, no cabeçalho, não é mascarado.** É a identificação do emitente
  no próprio documento e é dado público; mascarar tornaria o relatório inútil como comprovante.
- **Valor que não é documento volta intacto.** `credor_cpf_cnpj` é texto livre e às vezes
  guarda um nome ("ASSESSORIA JURIDICA PAX"); sem 11 ou 14 dígitos, `mascararDocumento` devolve
  o original. Mascarar às cegas embaralharia informação legítima.
- **Na auditoria a decisão vem do nome do campo**, porque o log guarda o registro inteiro de
  qualquer tabela (`dados_anteriores`/`dados_novos`). `mascararValorDeCampo(key, val)` mascara
  quando a chave contém `cpf`/`cnpj` — assim um telefone de 11 dígitos não vira CPF por acaso.
  A tela e o texto/CSV/PDF usam a **mesma** função (`valorDoDiffParaTexto` e
  `formatValueDisplay`), inclusive no `title` do tooltip, que é por onde o número voltaria
  inteiro sem ninguém notar.

**Fora do escopo, de propósito**: o "Ver JSON bruto" e o "Copiar JSON" da tela de Auditoria
mostram o payload sem máscara. É o que eles existem para fazer, e não entram em relatório
nenhum — se um dia a regra tiver de valer ali também, é decisão de produto, não de limpeza.

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

## Modal dentro de `<form>`: botão sem `type` é `submit`, e isso salva a tela de fora

Relato da UI em 10/09/2026: abrir um documento — recibo ou documento padrão — dentro do
cadastro do associado **fechava o cadastro e salvava**. Não era o abrir: era o primeiro clique
dentro do visualizador, inclusive no **X de fechar**.

O mecanismo é do HTML, não do React: `<button>` sem atributo `type` dentro de um `<form>` vale
`type="submit"`. `AssociadoFormModal` tem um `<form onSubmit={handleSave}>` que embrulha todas as
abas, e os visualizadores são renderizados **dentro** dele — `AssociadoMensalidadesTab` →
`VisualizadorReciboModal`, `ContratoDocumentosGenerator` → `VisualizadorDocumentoPadraoModal`.
Ser `position: fixed` e parecer uma janela à parte não muda nada: o que importa é a posição no
DOM. Cada botão de zoom, orientação e fechar submetia o formulário do associado.

Reproduzido antes de corrigir, em jsdom: montar `<form onSubmit={spy}>` com o visualizador
dentro e clicar nos botões da barra dispara o `onSubmit` **6 vezes**. Os testes
(`VisualizadorReciboModal.test.tsx`, `VisualizadorDocumentoPadraoModal.test.tsx`) ficaram nesse
formato — eles montam a aninhagem real, não uma simulação dela.

**A regra**: em componente que possa ser renderizado dentro de um formulário — e um modal
reaproveitável sempre pode —, **todo `<button>` declara `type` explicitamente**. `type="button"`
para ação, `type="submit"` só para o botão que de fato envia aquele formulário.

**A classe inteira foi varrida em seguida** (PR seguinte à #48): 447 botões em 75 arquivos
ganharam `type` explícito, e `src/test/botoesDeclaramType.test.ts` passou a falhar se algum
`<button>` do `src/` ficar sem ele — nomeando arquivo e linha. É o guarda que faz esta seção valer
para o código que ainda não foi escrito.

Três coisas dessa varredura valem como método para a próxima mudança mecânica em massa:

- **A checagem que autorizou o `type="button"` cego foi a de risco inverso.** O perigo não era
  deixar de corrigir: era marcar como `button` algum que **devia** submeter. Classificando os 447,
  **nenhum** estava dentro de um `<form>` do próprio arquivo (todo submit existente já declarava
  `type="submit"`) e só **um** não tinha `onClick` — um botão "Filtros" inerte em
  `ProcedimentosPage`, fora de qualquer formulário. Sem essa contagem, a alternativa seria revisar
  447 botões a olho.
- **A transformação foi provada antes de ser aplicada.** Um `difflib` sobre cada arquivo cobrou que
  toda mudança fosse inserção de uma linha `type="button"` ou troca 1:1 cujo único delta é
  ` type="button"` — qualquer deleção reprovava. Foi assim que a **primeira** versão do script foi
  pega: quando a tag de abertura não fechava dentro da janela de 40 linhas, ela pulava uma linha e
  **apagava** código. O caso que disparou isso foi um `<button>` citado dentro de um comentário
  JSDoc, que o detector ingênuo tratou como JSX. Ao varrer JSX com regex, **comentário não é código
  e tag que não fecha se deixa em paz**.
- **`createPortal` continua sendo a correção estrutural**, e agora é a única que falta: portal tira
  o modal do DOM do formulário, então nem um botão sem `type` conseguiria submeter (o borbulhar de
  evento do React atravessa a árvore de componentes, mas `submit` é comportamento nativo do DOM e
  não atravessa). Não foi feito porque muda a montagem de modais usados em várias telas, sem UI
  logada para conferir — e, com o guarda de teste no lugar, deixou de ser urgente.

### Mensalidades do associado saem em ordem de vencimento

A lista chegava na ordem em que o Postgres devolveu as linhas — que não é ordem nenhuma — e a
tela mostrava 6/12, 11/12, 1/12, 5/12. `ordenarParcelasPorVencimento`
(`utils/mensalidadesAssociadoHelpers.ts`, pura e testada) ordena por `data_vencimento` e desempata
por `numero_parcela`; `filtrarParcelasTabela` passou a devolver ordenado, e o organograma recebe a
mesma lista já ordenada.

**Compara o texto da data, não `new Date()`** — para `YYYY-MM-DD` a ordem lexicográfica é a
cronológica, e comparar texto evita de saída a armadilha que este arquivo já documenta em
`anoDaData()`: `new Date('2027-01-01')` é meia-noite UTC, que em UTC-3 é 31/12/2026. Aqui isso não
inverteria a ordem (todas as datas deslocam junto), mas o hábito é o que impede o próximo cálculo
de derrapar. Parcela sem vencimento vai para o fim: é dado quebrado, não deve encabeçar a lista.

A ordenação **não** usa `useMemo`, e isso é deliberado: o trecho fica depois de um `return`
condicional no componente, e um hook ali quebraria a ordem dos hooks entre renders (o
`react-hooks/rules-of-hooks` do eslint pega — foi assim que a primeira versão foi corrigida antes
do commit).

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
- **Função de trigger não deve ter `EXECUTE` para `PUBLIC`/`anon`/`authenticated`.** Ela nasce com
  esse grant (padrão do Postgres + o que o Supabase concede ao schema `public`) e aparece exposta
  em `/rest/v1/rpc/`, o que os advisors acusam. Não é explorável — o Postgres recusa a chamada
  direta com "trigger functions can only be called as triggers" —, mas revogue mesmo assim
  (migration `20260909171259`): **o trigger continua disparando, porque o `EXECUTE` só é verificado
  na chamada direta, nunca na invocação pelo trigger** (verificado como `authenticated`, com JWT
  real, antes e depois). Revogue de `PUBLIC` **e** dos dois papéis: aqui coexistiam o grant
  implícito de PUBLIC e grants explícitos, então revogar de um lado só não resolve — é a lição do
  par `revoke_anon`/`revoke_public` valendo nas duas direções. As duas últimas do schema
  (`handle_new_user`, o trigger de cadastro em `auth.users`, e `rls_auto_enable`, o event trigger
  que habilita RLS em toda tabela nova) foram fechadas na migration `20260910010924`.
  **Nessas duas o risco da correção era maior que o da exposição** — não são do módulo contábil:
  sem `handle_new_user` o usuário novo entra em `auth.users` e nunca ganha linha em
  `public.users` (cadastra e não consegue usar o sistema); sem `rls_auto_enable` toda tabela
  criada dali em diante nasce sem RLS. Por isso a revogação foi **exercitada antes de ser
  aplicada**, numa transação revertida que revoga e então dispara os dois gatilhos de verdade —
  `insert` em `auth.users` (⇒ `public.users` foi de 4 para 5) e `create table` (⇒
  `relrowsecurity = true`). **Ao revogar permissão de algo cujo caminho de falha é silencioso,
  teste a revogação dentro do rollback antes de aplicá-la** — é mais barato que descobrir pelo
  primeiro cadastro que não funcionou.
- **Uma função `SECURITY DEFINER` que ESCREVE não pode ter `EXECUTE` para `anon`.** É diferente
  do caso das funções de trigger acima, que não são exploráveis: `registrar_audit(user_id, acao,
  detalhes)` era chamável de verdade por quem não fez login, via `/rest/v1/rpc/`, com os três
  parâmetros vindo inteiros do chamador — e, por ser `SECURITY DEFINER`, gravando por cima da RLS
  de `auditoria`. Revogado na migration `20260910005709`. Duas lições:
  - **Verifique gravando, não chamando.** A função lê `auth.uid()`, que sem login é nulo, e era
    plausível que ela desistisse em silêncio. Não desistia: contagem antes/depois em transação
    revertida mostrou 484 → 485 linhas. "A chamada foi aceita" e "a linha entrou" são perguntas
    diferentes.
  - **Cuidado com o rótulo "esperado".** Este achado ficou meses escondido atrás da conclusão
    (correta) de que as auxiliares de RLS não podem perder o `EXECUTE`. Aquela conclusão foi
    registrada como "os advisors restantes", no plural amplo, e o bloco inteiro passou a ser lido
    como resolvido — só que das 8 funções que o advisor lista como chamáveis por `anon`, **4** são
    auxiliares de RLS, 2 são de trigger e 2 não são nem uma coisa nem outra. Ao classificar um
    alerta como esperado, **diga exatamente quais linhas** ele cobre.
- **Não revogue `EXECUTE` das funções usadas pelas policies de RLS** (`has_tenant_access`,
  `current_tenant_id`, `current_user_nivel`, `is_super_admin`), mesmo que os advisors as apontem.
  A expressão de uma policy é avaliada com as permissões de quem consulta: sem `EXECUTE` em
  `has_tenant_access`, um `SELECT` em `receitas` como `authenticated` falha com
  "permission denied for function has_tenant_access" — comprovado em transação revertida. Para
  essas, o alerta é esperado nesta arquitetura, não uma pendência em aberto.
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

### Bundle do editor Jodit em `DocumentosPadroesPage` — avaliado em 09/09/2026, não vale a pena mexer

`DocumentosPadroesPage.tsx` já é seu próprio chunk de rota (não entra no `modulepreload` inicial —
o problema aqui não é o mesmo do `jspdf`/`jspdf-autotable` acima), mas é o maior chunk do build
(~964&nbsp;KB / ~252&nbsp;KB gzip). A hipótese óbvia era que o array `buttons` do `editorConfig`
(as ~24 ferramentas de fato mostradas na toolbar) determinasse quais dos ~66 plugins do Jodit entram
no bundle. **Não determina.** `jodit-react` importa `jodit/esm/plugins/all.js` (todos os plugins)
dentro do próprio pacote, incondicionalmente — isso está em
`node_modules/jodit-react/build/esm/chunk-*.mjs`, fora do controle de qualquer config passada pelo
app. Mudar `buttons` muda só o que aparece na toolbar, não o que é baixado.

Medido com `esbuild` (bundle isolado, fora do build real, só pra comparar): o core do Jodit sozinho
(sem plugin nenhum) já minifica pra ~618&nbsp;KB — é a maior parte do peso. Um bundle só com os
~30 plugins que os 24 botões configurados de fato precisam (mapeados um a um: `bold` cobre
itálico/sublinhado/tachado, `table`+`select-cells`+`resize-cells`+`resizer` pro editor de tabela,
`image`+`image-processor`+`image-properties` pra imagem, etc., mais os plugins de edição básica que
não têm botão — `paste`, `clipboard`, `hotkeys`, `enter`, `backspace`...) deu ~732&nbsp;KB minificado
(~206&nbsp;KB gzip) contra ~817&nbsp;KB (~232&nbsp;KB gzip) do `all.js` — uma economia de ~11%, não
o corte grande que a suposição inicial sugeria. Os únicos plugins individualmente pesados que sobram
sem uso são `ai-assistant` (~17&nbsp;KB) e `speech-recognize` (~16&nbsp;KB); o resto (`search`,
`spellcheck`, `symbols`, `video`, `media`, `file`, `mobile`, `print`, `preview`, `about`, `stat`,
`iframe`, `powered-by-jodit`) soma pouco.

**Conclusão: não vale o risco.** Pra colher esse ~11% seria preciso abandonar o wrapper
`jodit-react` (testado, mantido, usado por qualquer app Jodit+React) e escrever um componente
próprio instanciando `Jodit` do pacote core à mão, cherry-pickando plugins — sem cobertura de teste
de UI pra esse editor especificamente (é o mesmo módulo do editor de tabelas com bastante superfície
de casos-limite documentado acima) e sem acesso a login real pra clicar e confirmar que nada quebrou
(mesma limitação de sempre neste ambiente). O chunk já está fora do carregamento inicial, que era o
problema que a regra geral desta seção resolve; isso aqui é só o peso de navegar pra essa página
específica. Não reabra este item sem uma vitória bem maior que ~25&nbsp;KB gzip do outro lado da
balança, ou sem acesso a um ambiente pra testar o editor de verdade depois da troca.
