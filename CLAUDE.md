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

## Existe um segundo projeto Supabase, de homologação — e reconstruí-lo achou um buraco

Criado em 19/09/2026: `SistemaPaxTaquari-Homologacao` (`rwbqkehwwdbdhcgcfcgf`), mesma região da
produção (`sa-east-1`), plano free, **US$ 0/mês**. Ele existe para destravar o que este arquivo
registra em vários lugares como "deixado de fora por falta de UI logada" — a decomposição dos god
components, a migração para Zod nas telas grandes e os testes de fluxo.

Como apontar o app para lá: `cp .env.homologacao.example .env.local && npm run dev`. Os cinco
usuários semeados e a senha estão no cabeçalho daquele arquivo. **Nenhum dado de produção foi
copiado**: o banco é `supabase/migrations/` + `supabase/seed-homologacao.sql`, e pode ser apagado e
recriado a qualquer momento.

### O replay das migrations é o teste, não a preparação

Reconstruir o schema do zero não é só encher um banco — é a única forma de perguntar se o
repositório ainda descreve a produção. A resposta foi **quase**, e o "quase" é o achado:

```
ERROR: 42883: function public.rls_auto_enable() does not exist
```

`public.rls_auto_enable()` e o event trigger `ensure_rls` existem em produção, mas **nenhuma
migration os criava**. A única que os citava é
`20260910010924_revoke_execute_handle_new_user_e_rls_auto_enable`, que apenas **revoga** `EXECUTE`
deles. Foram criados à mão, fora do histórico — e são justamente a rede que habilita RLS em toda
tabela nova, que este arquivo descreve como "sem `rls_auto_enable` toda tabela criada dali em
diante nasce sem RLS".

Consequência prática: um `supabase db push` contra um banco vazio parava na 55ª migration, e o
ambiente resultante nasceria sem essa rede. A migration `20260919133555` fecha isso — aplicada à
produção como **no-op** conferido antes e depois (mesmo `pg_get_functiondef`, mesma ACL
`{postgres=X/postgres,service_role=X/postgres}`, 1 event trigger, 0 tabelas sem RLS).

**A regra**: o que existe no banco e não existe em migration nenhuma é invisível até alguém tentar
reconstruir. Não dá para achar isso lendo o repositório — só reconstruindo.

### O que o repositório ainda não reconstrói sozinho

Pendência deliberada, e ela tem ordem: a migration nova roda **depois** da `20260910010924`, então
um rebuild do zero ainda para lá. Corrigir exige uma de duas coisas, e as duas são decisão sua:

1. Tornar o `revoke` da `20260910010924` tolerante à ausência da função — **editar migration já
   aplicada**, o que este arquivo proíbe em "uma migration aplicada, um arquivo".
2. Assumir que um rebuild começa criando a função antes do replay, e documentar isso no runbook.

Enquanto nenhuma das duas for escolhida, quem reconstruir precisa criar `rls_auto_enable` à mão
antes de rodar o replay — foi o que se fez aqui.

### O que a comparação provou, e como ela foi feita

Contagem não prova nada: comparar por **digest do conteúdo** prova. Rodando a mesma consulta nos
dois bancos e comparando `md5(string_agg(...))`:

| | produção | homologação |
|---|---|---|
| colunas (645) | `dafa9011…` | `dafa9011…` |
| constraints | `c899b262…` | `c899b262…` |
| índices (143) | `a4aec0d2…` | `a4aec0d2…` |
| policies (58) | `0ba17e1e…` | `0ba17e1e…` |
| RLS ligada por tabela | `78089d69…` | `78089d69…` |
| triggers (13) | `90078b4f…` | `90078b4f…` |
| funções (22) | `ccad392c…` | `fbd80099…` ❌ |

Seis de sete idênticos **byte a byte**. As funções divergiam por duas coisas, ambas cosméticas, e
achá-las exigiu normalizar em camadas — cada camada respondendo a uma pergunta diferente:

- **13 funções da produção têm CRLF dentro do corpo**, os 70 arquivos do repositório estão em LF.
  Ou seja: o que está gravado em produção **não veio desses arquivos** — veio de um editor Windows,
  provavelmente colado no SQL editor do painel.
- **`has_tenant_access` em produção não tem os comentários** que o arquivo da migration traz. Mesma
  lógica, corpo diferente.

Ignorando `\r`, espaços e comentários, as **22 de 22** batem: `has_tenant_access` fecha em
`9386880a…` dos dois lados. O schema é o mesmo; o que diverge é o texto-fonte guardado.

**A regra para a próxima comparação de schema**: normalize em camadas e diga qual camada fez a
diferença sumir. "Os hashes batem" depois de apagar tudo que incomoda não prova nada; o que informa
é *qual* normalização foi necessária — foi ela que revelou que a produção não nasceu do repositório.

### O isolamento foi exercitado com login de verdade

Com os cinco usuários semeados, simulando o JWT real de cada um (`set role authenticated` +
`request.jwt.claims`), contando o que cada um enxerga e tentando uma escrita em `planos_pax`:

| papel | e-mail | associados | parcelas | escreve plano |
|---|---|---|---|---|
| super_admin | `super@` | 4 (as duas empresas) | 24 | sim |
| admin | `admin.pax@` | 3 | 24 | sim |
| admin | `admin.fun@` | **1** | **0** | sim |
| gerente | `gerente.pax@` | 3 | 24 | **42501** |
| funcionario | `func.pax@` | 3 | 24 | **42501** |
| anônimo | — | **0** | — | — |

É a primeira vez que a RLS por módulo da migration `20260919001244` é exercida num banco
reconstruído do zero: o gerente e o funcionário **leem** `planos_pax` e são **recusados** ao gravar,
exatamente como desenhado.

**Um aviso de método**: a primeira rodada desse teste reportou "nenhum admin consegue escrever", e
era defeito do teste — as linhas da rodada anterior tinham ficado gravadas e a segunda tentativa
batia em `23505 duplicate key`, não em RLS. Capturar o `SQLSTATE` em vez de só `true/false` foi o
que separou uma coisa da outra. **Num teste de permissão, guarde o código do erro**: `42501` é a
policy recusando, `23505` é você.

### Decisões da semente

- **`categorias_fornecedor` precisa ser semeada aqui.** O backfill da `20260918010937` roda antes de
  existir qualquer tenant num banco novo, então não semeia nada — a semente refaz a lista modelo.
  É o mesmo motivo pelo qual `centros_custo` fica vazia: o backfill dela depende de já haver plano
  contábil.
- **O plano de contas NÃO é semeado de propósito.** Ele é constante do frontend copiada pela tela
  (`semearPlanoPadrao`); replicá-lo em SQL criaria uma segunda fonte para a mesma lista. Sem conta
  analítica, a isenção do trigger `exige_conta_contabil` vale e o lançamento nasce sem conta — que
  é exatamente o estado de uma empresa nova, e um caminho que vale poder exercitar na tela.
- **`credenciados_procedimentos` tem `valor`, não `valor_acordado`.** O `CREATE TABLE IF NOT EXISTS`
  posterior, que trazia `valor_acordado`/`valor_repasse`, já era inerte quando rodou. A semente
  tropeçou nisso — é o tipo de coisa que só aparece escrevendo contra o schema real.
- **Os CPFs não passam na validação de dígito verificador**, de propósito: ninguém os confunde com
  pessoa real.

### O bug recorrente: campo no TypeScript sem a coluna correspondente no banco

Já aconteceu duas vezes (`documentos_padroes` e `atendimentos`): alguém adiciona um campo opcional
à interface TypeScript, o código já lê/grava esse campo, mas ninguém cria a migration — o Supabase
responde `PGRST204` (coluna não encontrada). Ao adicionar um campo novo a uma interface que é
persistida no Supabase, **sempre** crie a migration na mesma tarefa — nunca depois "quando der
tempo".

**O que tornava isso mudo acabou em 19/09/2026.** Até então `useDocumentosPadroes` respondia ao
`PGRST204` **apagando a coluna que faltava e regravando**, em laço de até 12 tentativas: o
documento era gravado sem o campo, a tela dizia "salvo com sucesso" e o dado do usuário sumia sem
erro nenhum. Era a terceira cópia do mesmo padrão neste repositório, depois do retry que regravava
a guia com `status: 'pendente'` (11/09) e do `resilientSupabaseUpsert` que anulava o
`plano_pax_id` (18/09) — *um retry que muda o dado enviado não é tolerância a falha, é corromper o
registro para conseguir gravá-lo.* Os dois blocos (`criar` e `editar`) passaram a fazer uma
tentativa com um payload e lançar `RecusaDoServidor` com `explicarRecusa`, o par que
`utils/recusaDoServidor.ts` já oferecia. O `PGRST204` é justamente o **único** sinal de que falta
uma migration; engoli-lo escondia o defeito seguinte.

**A cópia que sobra é a de `lib/syncService.ts`** (`resilientSyncUpsert`), deixada de fora pelo
motivo já registrado adiante: a fila apaga a tarefa ao esgotar as tentativas, e fazê-la lançar
trocaria "escrita parcial silenciosa" por "registro criado offline descartado em silêncio".

### Testando um hook que grava

`useDocumentosPadroes.test.tsx` (25 casos) e `useAvisoInadimplencia.test.tsx` (16) são os
primeiros testes de hook do projeto. Quatro decisões valem para o próximo:

- **O mock do Supabase registra a CHAMADA, não só a resposta.** O defeito acima não aparece no
  valor devolvido — aparece em **quantas vezes** o hook tentou gravar e **com qual payload em
  cada tentativa**. Um mock que só devolvesse `{data, error}` não distinguiria "gravou" de
  "gravou depois de jogar fora metade dos campos do usuário". Rodado contra o código anterior, o
  teste reprova com `expected [ … ] to have a length of 1 but got 2` — mede o defeito em vez de
  descrevê-lo, como o de `resilientSupabaseUpsert` já fazia.
- **O IndexedDB falso guarda estado**, pelo mesmo motivo de `caixasService.test.ts`: toda escrita
  deste hook termina chamando `carregarDocumentos`, que relê o store inteiro.
- **No hook de aviso, o teste central é sobre o que ele NÃO faz.** `useAvisoInadimplencia`
  substituiu o `useBackgroundChecks`, que marcava o associado como inadimplente sozinho; por isso
  o primeiro caso do arquivo exige que `saveAssociado` não seja chamado em caminho nenhum,
  inclusive quando a notificação falha. Um teste que só cobrisse a notificação passaria de novo no
  dia em que alguém reintroduzisse a gravação "para adiantar o trabalho do admin".
- **O quirk que ficou documentado, não corrigido**: sem empresa resolvida, `criar` e `editar`
  carimbam o literal `'emp-001'` — a mesma classe de "Nunca invente um `tenant_id`", na variante
  que **esconde** (o modelo nasce invisível para todas as empresas, como o `'system'` da Ata de
  Ocorrências). Só o super_admin alcança esse estado. Recusar a gravação ali é decisão de produto
  sobre quem pode criar modelo sem empresa escolhida, e o mesmo literal está em
  `useItensFunerarios`; há um teste travando o comportamento atual para que a mudança, quando
  vier, seja deliberada.

## Schema drift resolvido — os pares de colunas duplicadas acabaram

**Encerrado em 15/09/2026 (migration `20260915132838`).** Duas tabelas tinham pares de colunas
para o mesmo dado, por terem evoluído em momentos diferentes sem migração da coluna antiga. As 10
colunas legadas foram dropadas; ficaram só as canônicas:

- **`associados`**: saíram `logradouro`, `numero`, `bairro`, `cidade`, `cep`, `uf` e `plano_id`.
  O par canônico é `endereco_*` e `plano_pax_id`.
- **`documentos_padroes`**: saíram `conteudo_html`, `created_at` e `updated_at`. O par canônico é
  `conteudo` e `criado_em`/`atualizado_em`.

O plano tinha quatro passos, e os quatro estão cumpridos: (1) confirmar que as legadas ainda
recebiam escrita — recebiam, por dual-write deliberado do próprio código; (2) parar o dual-write
(PR #30); (3) manter a legada um ciclo de release como somente-leitura; (4) dropar.

### O que o passo 4 exigiu antes de rodar, e vale como roteiro para a próxima coluna

Um `drop` é irreversível e não avisa. As cinco checagens abaixo foram feitas **antes**, e é a
combinação delas — não uma só — que autorizou:

1. **Nenhuma linha guardava dado só do lado legado.** Verificado par a par, exaustivamente (a base
   tinha 5 associados e 6 documentos). Onde havia divergência, o canônico era **o mais novo**: nos
   6 documentos o `atualizado_em` canônico era ≥ `updated_at` legado. Atenção ao contra-intuitivo:
   **a coluna legada às vezes era maior** (Ata de Tanatopraxia, 16.969 contra 15.581 caracteres) —
   porque o operador tinha encurtado o documento depois que a escrita parou. Maior não é mais
   correto; o que decide é a data, não o tamanho.
2. **Nenhum nome legado viajava ao servidor.** Ver a regra da seção seguinte.
3. **Nada no banco referenciava as 10**: 0 views, 0 índices, 0 constraints, 0 policies, 0 funções.
   O único trigger das duas tabelas mexe em `associados.updated_at` — coluna própria daquela
   tabela, que **não** estava na lista. Nomes parecidos em tabelas diferentes são a armadilha
   central deste passo.
4. **Os logs confirmaram com tráfego real.** 24h, 8.248 requisições, sendo 303 em `/associados` e
   49 em `/documentos_padroes`: **zero** citando coluna legada. É o que nenhuma leitura de código
   prova — um bundle antigo em cache de service worker ainda poderia estar mandando o payload de
   dual-write, e os logs são o único lugar onde isso apareceria.
5. **A fila de sync já estava blindada.** `lib/syncService.ts` desestrutura os 7 nomes legados para
   fora do payload antes do spread — era isso que impedia um registro antigo na fila de mandar
   coluna inexistente depois do drop. Sem essa blindagem (feita na PR #30), o passo 4 teria
   quebrado a sincronização de quem estava offline.

Além disso, o ensaio foi rodado **dentro de uma transação revertida**: dropar as 10, exercitar as
consultas reais do app (o `select *, dependentes(*)` de `getAssociados`, o `select *` dos
documentos) e inserir com o payload canônico dos dois formulários. Só depois a migration foi
aplicada.

**A coluna canônica herda a constraint que a legada sustentava.** `created_at`/`updated_at` eram
`NOT NULL` e `criado_em`/`atualizado_em` não. Dropar sem mais nada removeria em silêncio a garantia
de que todo documento tem data — então as canônicas ganharam `NOT NULL` na mesma migration. **Ao
dropar uma coluna, compare as constraints dos dois lados do par**: a legada pode estar segurando um
invariante que ninguém percebeu que era dela.

### Antes do `drop`, separe o que quebra do que degrada — e saiba que payload de escrita quebra

A regra da PR #46, agora exercida em escala: ao varrer o que referencia uma coluna a ser dropada,
separe o que **quebra** (nome de coluna que viaja ao servidor: `select`, `or`, `eq`, `order`) do
que **degrada em silêncio** (acesso a propriedade em objeto já carregado, que em JavaScript devolve
`undefined`). Só o primeiro grupo bloqueia o `drop`.

O passo 4 acrescentou duas correções a essa regra:

- **Chave de objeto em payload de `insert`/`update`/`upsert` viaja ao servidor.** Sintaticamente é
  propriedade de objeto, igual ao grupo que degrada em silêncio — e é justamente aí que uma
  varredura por forma erra: o payload chega ao Postgres e volta `PGRST204`. O que salvou aqui foi
  os payloads já usarem só chaves canônicas, com os nomes legados aparecendo **apenas do lado
  direito de um `||`**, que é leitura de memória.
- **O ruído do grep é a regra, não a exceção.** As 10 colunas davam **424 ocorrências** no `src/`.
  Nenhuma era bloqueante: `bairro`/`cidade`/`cep`/`numero` são nome **canônico** em outras tabelas
  (credenciados, fornecedores, atendimentos), `created_at` é de `planos_pax` e `contratos`,
  `numero_parcela` casou por substring, e `plano_id` é FK legítima de `planos_pax_faixas`,
  `planos_pax_coberturas`, `credenciados_planos` e `contas_contabeis`. O mesmo vale do lado SQL:
  um `ilike '%coluna%'` sobre `pg_proc` acusou **18 funções suspeitas**; com fronteira de palavra
  sobrou **1**, e essa apontava para outra tabela. **Filtre por tabela e por fronteira de palavra
  antes de contar** — senão o número que você leva para a decisão é ruído puro.

### O fallback deixou de ser fotografia e virou síntese do cliente

O passo 3 tinha reclassificado as leituras com fallback: `item.conteudo || item.conteudo_html`
deixara de ser "o mesmo texto por outro nome" e passara a servir **dado velho**. Com o passo 4 elas
mudam de natureza outra vez, e desta vez ficam inofensivas: a coluna não existe mais, então o lado
direito do `||` é sempre `undefined` e o fallback nunca dispara. Virou ramo morto.

A normalização de `getAssociados()` é o caso interessante. Ela espelha `endereco_logradouro` em
`logradouro` no objeto devolvido ao app, e **continua valendo** — mas deixou de ser "espelhar uma
coluna que existe" para ser **a única fonte dos nomes legados, sintetizada no cliente**. Qualquer
tela que leia `assoc.cidade` segue funcionando por causa dela, e só por causa dela. Não a remova
sem antes varrer os componentes que leem os nomes antigos; essa varredura é passada própria, e
ficou de fora desta.

**Nenhuma linha de `src/` precisou mudar para o drop** — esse era exatamente o objetivo dos passos
2 e 3. Limpar os ramos mortos é cosmético e cabe numa passada posterior, não nesta.
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

## Ata de Ocorrências: o tenant inventado que escondia de todos

Pedido de 15/09/2026: "super_admin vê todos os logs, independente da empresa; admin vê
todos os logs de todos os usuários da própria empresa". A regra já estava escrita na
policy — `has_tenant_access(tenant_id)` faz exatamente isso. **Ela só não valia porque o
dado não deixava.**

Perguntar ao banco antes de reler o componente respondeu em uma consulta: a tabela tinha
**568 linhas e 7 operadores**, a tela mostrava **27 e 1 operador**, e **todo admin, gerente
e funcionário lia ZERO**. As 568 tinham `tenant_id = 'system'` — um literal que não é
empresa nenhuma.

**É o espelho do incidente `empresa_padrao`.** Lá o literal inventado era coringa na RLS e
**vazava** o registro para todas as empresas; aqui ele não casa com nada e **esconde** de
todas. Mesma causa — carimbar um tenant que ninguém determinou —, sintomas opostos, e o
segundo é ainda mais silencioso: ninguém reclama de um log que nunca viu.

Três origens do `'system'`, e nenhuma bastava sozinha (migration `20260915192056`):

- **`DEFAULT 'system'` na própria coluna.** Todo insert que esquecesse o `tenant_id`
  nascia invisível, sem erro. Dropado: com a coluna `NOT NULL` e sem default, esquecer
  agora **falha na hora**.
- **A RPC `registrar_audit` lia `app_metadata.tenant_id`, e o app grava em
  `user_metadata`.** Ela caía no fallback praticamente sempre. Passou a chamar
  `current_tenant_id()` — a mesma função que as policies usam. Reimplementar a leitura do
  JWT foi o que deixou as duas metades discordarem; predicado repetido em dois lugares só
  é corrigido uma vez.
- **`lib/supabase.ts` inicializava `tenantId = 'system'`.** Continua existindo como
  marcador de último caso (documentado no `COMMENT` da coluna), não como destino normal.

**O backfill foi uma decisão de acesso, e por isso foi perguntada.** Das 568, 187
resolviam pelo autor e 25 pelo `tenant_id` que o próprio `detalhes` declara. Sobravam 381
— 368 ações do super_admin (cujo `tenant_id` é `'default'`, também não é empresa) e 13 sem
autor. Atribuí-las à empresa principal daria ao admin dela um histórico bem mais completo,
mas **afirmaria que cada uma daquelas ações foi daquela empresa sem conferência linha a
linha** — e este schema já teve três vazamentos entre empresas. A escolha (do usuário) foi
deixá-las fora de empresa, com o marcador `'system'`, visíveis só ao super_admin; é
reversível, dá para atribuí-las depois. **Preencher um campo que decide quem enxerga o
registro não é reparo de dado, é decisão de acesso** — a mesma lição do perfil reconstruído
a partir do `raw_user_meta_data`.

Resultado conferido em produção, por papel: super_admin **568 logs / 7 operadores**; os
dois admins da PAX e os funcionários dela **203 / 4**; o admin e o gerente da outra empresa
**14 / 2**.

### O escopo sai do nível do usuário, não do seletor de empresa

`utils/escopoAuditoria.ts` (puro e testado) devolve `global`, `empresa` ou `indefinido`.
Três decisões:

- **Para o super_admin, o seletor do topo estreita; para os demais, ele não faz nada.** Um
  admin que escolhesse `'all'` não ganha visão global, e escolher outra empresa não troca a
  dele. Antes isso funcionava **por acidente**: o `AppContext` força
  `empresaSelecionada = user.tenant_id` para quem não é super_admin, então usar o seletor
  dava o resultado certo — e passaria a dar o errado no dia em que alguém mexesse naquele
  `if`. A guarda de verdade continua sendo a RLS; a função existe para a tela **pedir o que
  tem direito** em vez de pedir demais e depender de o banco aparar.
- **O `tenant_id` do próprio super_admin nunca vira filtro.** Ele é `'default'` em
  produção — cair nele transformaria "visão global" em "os logs de uma empresa que não
  existe", ou seja, zero linhas. Há teste travando exatamente isso.
- **Escopo indefinido devolve `null`, nunca `'all'`.** Cair em `'all'` aqui daria visão
  global a quem não conseguiu provar a empresa: o erro exatamente oposto ao pretendido. A
  tela recusa a listagem e diz por quê.

O selo do cabeçalho passou a mostrar o escopo **real** (`VISÃO GLOBAL` / `EMPRESA` /
`SEM ESCOPO`), não o nível de quem olha: um super_admin que escolheu uma empresa está
vendo aquela empresa, e continuar anunciando "Visão Global" ali afirmaria que a lista é
completa quando não é.

### 28 MB num `select('*')`, e o cache servido como se fosse o banco

O segundo defeito é o que fazia a tela mostrar 27 de 568 mesmo para o super_admin, que
sempre teve direito a tudo. `getLogsAuditoria` pedia `select('*')` sem teto, e `detalhes`
é `jsonb`: a ação **"Editar Associado" grava o objeto inteiro do associado** — 76 linhas
com média de **385 mil caracteres** cada, **28 MB**, contra ~100 KB somados das outras 492.
A requisição falhava, o `catch` devolvia o IndexedDB, e a tela exibia o cache **como se
fosse o banco**.

O sintoma que denuncia isso é fácil de ler e fácil de ignorar: **"1 operador no período"**.
Um cache local só tem as ações daquele navegador. Quando um total despencar junto com a
contagem de operadores, **suspeite do cache antes de suspeitar da permissão**.

Duas correções, e a segunda é a que importa:

- **Teto de `LIMITE_LOGS_AUDITORIA = 300`** (~5 MB no pior caso medido; 100 linhas são
  ~1 MB). Quem precisa de mais usa os filtros de período.
- **Recusa do servidor e queda de rede deixaram de terminar igual** — a regra que este
  arquivo já fixa para `saveAtendimento`, valendo agora num caminho de **leitura**.
  `error` devolvido pelo cliente é relançado com a mensagem do servidor; só exceção
  lançada (rede fora) serve o cache. Servir cache calado numa tela de auditoria é pior que
  falhar: ela existe para ser a fonte da verdade sobre o que aconteceu.

### O gravador enxuga o que põe em `detalhes` — e o culpado era um PDF em base64

Fechando a pendência que a correção anterior deixou registrada. O que inchava não era o
registro do associado: era **`associado.documentos[]`, que guarda cada anexo como data URI
em base64**. Um contrato em PDF de 352 KB vira ~470 mil caracteres — e aparece **duas
vezes**, porque `saveAssociado` manda o registro inteiro em `dados_anteriores` **e** em
`dados_novos`. São ~940 KB por save de associado com anexo.

Medido em produção antes de mexer: **31 linhas** carregam anexo embutido, somando **27 MB
de base64 — 97,8% do peso dessas linhas**. Enxugadas, as mesmas linhas cairiam de 28 MB
para **631 KB**.

`utils/detalhesAuditoria.ts` (puro, 18 testes) é chamado dentro de `registrarAuditoria`,
**no funil, não em cada chamador** — os dois que hoje mandam o objeto inteiro
(`associadosService` e `planosService`) são só os que se conhece; o próximo entra coberto
sem precisar lembrar. Quatro decisões:

- **Substituir, não remover.** O anexo vira
  `[arquivo application/pdf · 344 KB · #a3f21b8c]`, e os metadados dele (`nome`, `tipo`,
  `tamanho`) ficam intactos. Some do log o **conteúdo**, não o fato de existir um anexo —
  é isso que mantém a linha auditável. Um diff de dois blocos de base64 de 470 KB lado a
  lado nunca disse a ninguém o que mudou.
- **O descritor carrega uma impressão digital do conteúdo**, e ela não é enfeite:
  `calcularCamposAlterados` compara com `JSON.stringify`, então **dois descritores iguais
  significam "não mudou"**. Sem o hash, trocar um PDF por outro de tamanho parecido sumiria
  do diff — o log passaria a mentir exatamente sobre a coisa que ele existe para registrar.
  É um FNV-1a de 32 bits, síncrono e determinístico; ele responde "é o mesmo arquivo de
  antes?", não "qual é o arquivo". Há teste travando os dois lados: anexos diferentes de
  **mesmo tamanho** acusam mudança, e o mesmo anexo não acusa.
- **O teto total é a última rede, e ela avisa.** Passando de `LIMITE_TOTAL_DETALHES`
  (64 KB), as chaves mais pesadas saem e `_omitido` diz quais foram — `usuario`,
  `usuario_email` e `id` nunca são sacrificados, porque sem eles a linha deixa de valer
  como log. **Encolher em silêncio faria o registro afirmar que está completo sem estar**,
  que é a mesma falha da tela servindo cache como se fosse o banco.
- **A função é idempotente**, e isso não é elegância: o payload passa pelo insert direto,
  pelo fallback da RPC e pelo IndexedDB. Se enxugar duas vezes encurtasse de novo, as três
  cópias divergiriam.

O teste do teto pegou um defeito de verdade na primeira versão: a chave `_omitido` era
acrescentada **depois** do corte e empurrava o payload de volta para cima do limite. **Ao
cortar até caber, conte também o que você vai acrescentar para explicar o corte.**

**Pendência que continua de propósito**: as linhas antigas seguem com os 28 MB. O
enxugamento vale daqui para frente — **reescrever o `detalhes` de linha já gravada é mexer
em trilha de auditoria**, e isso é decisão de produto, não limpeza.


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

## Unicidade de documento é por empresa — a mesma pessoa pode estar em duas

Relato da UI em 11/09/2026: uma empresa não conseguia cadastrar CPF/CNPJ que outra já
tinha. É vazamento entre empresas na direção oposta à dos incidentes anteriores — não
expunha dado de ninguém, mas deixava uma empresa **bloquear o cadastro da outra**, citando
um registro que o operador nem podia abrir (a RLS esconde o de outra empresa). Duas causas
independentes, uma em cada módulo:

- **`credenciados`**: `credenciados_cnpj_cpf_key UNIQUE (cnpj_cpf)` era **global**
  (migration `20260911135652`). Credenciar o mesmo hospital em duas empresas é o caso
  normal, não duplicidade. Virou o índice parcial
  `credenciados_tenant_documento_uk (tenant_id, cnpj_cpf) nulls not distinct where cnpj_cpf is not null`.
- **`associados`**: não há constraint no banco — a guarda é `encontrarAssociadoComCpfDuplicado`,
  e ela varria a lista inteira. A lista vem de `getAssociados(isOnline, empresaSelecionada)`,
  que devolve **todas** as empresas quando a seleção é `'all'` — o estado do super_admin.

Três decisões valem como regra:

- **Índice parcial em vez de constraint de tabela, por duas coisas que a constraint não
  alcança.** `where cnpj_cpf is not null` preserva a regra de "campo opcional grava `NULL`"
  (vários credenciados sem documento na mesma empresa). E `nulls not distinct` fecha o
  buraco do tenant: `credenciados.tenant_id` é **nullable**, e no padrão `NULLS DISTINCT`
  dois registros com tenant nulo e o mesmo documento não colidiriam — a unicidade
  simplesmente não valeria para eles. Como o predicado já exclui documento nulo, o
  `nulls not distinct` age só sobre `tenant_id`. **Ao escopar uma unicidade por
  `tenant_id`, confira se essa coluna é nullable** — senão o escopo tem um fundo falso.
- **Guarda de escrita não reaproveita filtro de leitura.** A tentação era usar
  `registroPertenceAoTenant`, mas ela devolve `true` quando o filtro é `'all'`/vazio ("sem
  filtro"), o que aqui voltaria a casar todas as empresas — reintroduzindo o bug pela porta
  da frente. Sem empresa resolvida, `encontrarAssociadoComCpfDuplicado` **não afirma
  duplicidade**; quem recusa a gravação nesse estado é o `MENSAGEM_TENANT_INDEFINIDO` no
  salvar. As duas funções parecem a mesma pergunta e não são.
- **O `tenantId` é parâmetro obrigatório, não opcional com padrão.** Opcional, um chamador
  novo cairia no comportamento antigo sem nenhum aviso — e foi o `tsc` cobrando os três
  call sites que revelou que o `AssociadoFormModal` tinha o predicado **escrito de novo à
  mão**, no `onChange` do campo de CPF, com o mesmo defeito. É a lição das três leituras de
  `plano_id` valendo de novo: predicado repetido em dois lugares só é corrigido uma vez.

Fora do escopo de propósito: **não foi criada unicidade de CPF de associado no banco**. A
guarda atual só considera associado **ativo** (um CPF pode reaparecer num cadastro
encerrado e reaberto), e um índice único não sabe disso — imporia uma regra mais dura que a
de negócio, quebrando gravação de dado que hoje é legítimo. O `existingCpfs` do
`DependenteFormModal` não entrou porque já é escopado por construção: a lista é a dos
dependentes daquele titular.

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

### Guia de rede externa nunca foi gravada, e o "fallback" escondia o motivo

Relatado da UI logo depois da correção acima, e só apareceu porque ela parou de engolir a
recusa: emitir guia com **Rede Externa** dava erro. Duas constraints, e as duas valem como
lição (migration `20260911132855`):

- **`requisicoes.credenciado_id` era `NOT NULL`.** Guia de rede externa não tem credenciado
  — o prestador é texto livre em `credenciado_nome`/`credenciado_cnpj_cpf` porque não é
  cadastro nosso. O insert morria com `23502` e **nenhuma guia de prestador externo jamais
  foi gravada**. A coluna virou nullable; a FK continua valendo, porque com `MATCH SIMPLE`
  o `NULL` a satisfaz — guia de credenciado segue amarrada a `credenciados`, e isso foi
  verificado com uma tentativa de FK inválida na mesma transação revertida.
- **O `CHECK` de `status` não conhecia `'emitida'`**, que é o status com que o app cria toda
  guia (`StatusRequisicao = emitida | autorizada | realizada | cancelada`). O insert
  falhava com `23514`.

**O segundo é o mais instrutivo, porque tinha um remendo que parecia resiliência.**
`criarRequisicao` reinseria com `status: 'pendente'` quando o primeiro insert falhava. Isso
não é fallback: é gravar a guia com um estado que o operador não escolheu, em silêncio. E o
efeito se espalhou — `RequisicoesPage` acabou cheia de
`r.status === 'emitida' || (r.status as any) === 'pendente'`, com o `as any` denunciando que
o valor gravado não existe no domínio. O remendo foi removido junto com a migration: com o
`CHECK` correto, tentar de novo com outro status só esconderia o erro seguinte.

**A regra**: um retry que muda o dado enviado não é tolerância a falha — é corromper o
registro para conseguir gravá-lo. Se o servidor recusou, ou o payload está errado (corrija
o payload) ou a constraint está errada (corrija a constraint). Reenviar diferente resolve o
insert e cria um defeito que só aparece meses depois, do outro lado da tela.

`'pendente'` e `'negada'` ficaram no `CHECK` novo: é o que as linhas antigas têm gravado, e
tirá-las quebraria o `UPDATE` delas. As duas checagens duplas na tela seguem de propósito
pelo mesmo motivo — um backfill de `'pendente'` para `'emitida'` é decisão de produto sobre
dado existente, não limpeza de código.

### Parcela liquidada é intocável, e a guarda não pode viver só na tela

Pedido de 14/09/2026. Uma parcela recebida não é mais uma previsão: ela tem recibo
impresso, gerou movimentação de caixa e é a **fonte do realizado** no Plano de Contas
(ver "Valores realizados no plano"). Editar o valor ou apagar a linha depois disso desfaz
um número que já foi somado em relatório e entregue ao associado — sem desfazer nada do
resto. O caminho de correção é **estornar** e só então editar ou excluir.

`utils/statusParcela.ts` (puro e testado) concentra a regra, e três coisas valem como
regra geral:

- **Esconder o botão é conveniência; a recusa mora no ponto de escrita.**
  `atualizarParcelaReceber` e `excluirParcelaReceber` lançam
  `MENSAGEM_PARCELA_LIQUIDADA`. Sem isso a "segurança" seria só o botão sumido — e o
  caminho de escrita continua alcançável pela fila de sync, por outra tela e por qualquer
  chamador novo.
- **A checagem usa o status GRAVADO, nunca o que veio no payload.** O formulário de
  edição de parcela tem um **seletor de status**: aceitar o valor enviado deixaria
  qualquer um destravar a parcela mudando exatamente o campo que a protege. Por isso o
  guard lê `existente?.status`, já buscado pela própria função. **Vale para qualquer
  guarda sobre um campo que o próprio formulário edita.**
- **`'recebido'` e `'pago'` são o mesmo estado com dois nomes.** As telas de associado já
  tratavam os dois juntos; a de Contas a Receber olhava só `'recebido'`, então uma parcela
  `'pago'` seguia editável e excluível lá. Quem checa um só deixa metade do caso de fora —
  é o que a função única resolve.

Em Contas a Receber os botões eram `disabled`, não ausentes. Passaram a sumir, com um
cadeado e o motivo no `title`: um botão desabilitado convida ao clique e não explica nada.
A exclusão em massa da aba de mensalidades já estava correta por outro caminho
(`isSelectable` só aceita `pendente`/`vencido`) e não precisou mudar.

**Limite conhecido**: se a parcela não estiver no IndexedDB e o app estiver offline, não há
como ler o status gravado e a guarda deixa passar. `excluirParcelaReceber` ganhou busca
remota quando o cache não tem a linha — é justamente onde falta informação que a guarda
precisava valer.

### O diálogo de confirmação mostra o que será criado

"Deseja gerar a cobrança?" não é confirmação de risco, é **decisão**: para responder, o
operador precisa ver o que vai nascer. `ConfirmOptions` ganhou `resumo`
(linhas `rótulo`/`valor`, com `destaque` para o número que decide) e `aviso` (o bloco
âmbar de cobrança anterior, que antes era concatenado na `message`). Com resumo o diálogo
abre mais largo e troca o ícone de alerta pelo de documento.

Duas decisões:

- **`hoje` é calculado uma vez e usado no resumo E na montagem da cobrança.** O vencimento
  que o operador lê é literalmente o que será gravado, não uma segunda conta feita com
  outro relógio — que perto da meia-noite daria datas diferentes.
- **O `aviso` só renderiza junto do resumo.** Ele vive dentro daquele bloco; deixar isso
  implícito faria um chamador mandar um aviso que some sem erro. Há teste travando os dois
  comportamentos, mais o caso sem `resumo` — todos os outros chamadores do projeto passam
  só `title`/`message` e não podem mudar de aparência.

`ConfirmContext.test.tsx` é o segundo teste de render do projeto e verifica o diálogo
montado de verdade, não uma simulação dele.

## Recebimento de parcela: o que fechava o cadastro, e o comprovante que não saía

Relato da UI em 14/09/2026: "o recebimento não está realizando corretamente e fecha o
respectivo cadastro". **O banco estava certo** — as duas parcelas recebidas do associado do
relato têm `status`, `valor_recebido` e movimentação de caixa correspondentes. Perguntar ao
banco antes de reler o componente (a regra que este arquivo já registra) descartou de saída a
hipótese de falha de gravação e deixou o defeito onde ele estava: na tela.

**O que fechava o cadastro era uma navegação, não um erro.** Sem lote de caixa aberto, o modal
de recebimento mostra "Operação Bloqueada" com o botão "Abrir Lote de Caixa", que fazia
`onClose(); navigate('/financeiro/caixas')`. Esse modal é renderizado **dentro** do
`AssociadoFormModal`: sair da rota desmonta a tela inteira e leva junto o formulário com tudo
que o operador digitou e ainda não salvou — sem aviso, sem erro, e com o recebimento não
realizado. Agora a saída passa por `confirm`, dizendo exatamente o que se perde. **Um
`navigate()` dentro de um modal reaproveitável é sempre uma pergunta**: quem o renderizou pode
ter um formulário aberto por baixo.

**A empresa do caixa vinha errada por dois caminhos independentes**, e os dois são a lição do
`empresa_padrao` valendo de novo:

- `getLoteAbertoAtivo(isOnline, state.empresaSelecionada || 'tenant-default')` — `getLotesCaixa`
  **não filtra** quando recebe `'all'` (`if (tenantId && tenantId !== 'all')`), então um
  super_admin sem empresa escolhida recebia o lote aberto de **outra** empresa, e a
  movimentação caía no caixa dela. Vazamento entre empresas por um filtro que se desliga
  sozinho.
- `tenant_id: state.empresaSelecionada || 'tenant-default'` na movimentação — carimbar um
  tenant que não existe é exatamente o que a seção "Nunca invente um `tenant_id`" proíbe.

Os dois caminhos (aba de Mensalidades e Contas a Receber) passaram a resolver por
`tenantDeEscrita` e a **recusar** com `MENSAGEM_TENANT_INDEFINIDO`. **Ao passar um tenant para
uma função de leitura, saiba se ela trata `'all'` como "sem filtro"** — um valor que desliga o
filtro é seguro numa listagem e é vazamento quando o resultado vira destino de escrita.

### O recibo agora sai sozinho, e é montado com o que acabou de ser recebido

Pedido junto com a correção: toda liquidação — pelo cadastro do associado ou por Contas a
Receber — passa a abrir o comprovante ao final, no `VisualizadorReciboModal` que já existia.
Antes o recibo só existia como reimpressão, num botão da linha: quem acabou de receber tinha
de achar a parcela certa e clicar, e é assim que um recebimento termina sem documento.

Três decisões valem como regra:

- **O recibo nasce da parcela MAIS os dados da baixa, nunca só da parcela.** Logo depois de
  efetivar, a linha que a tela tem em memória ainda é a de antes — `pendente`, sem
  `valor_recebido`, sem data de liquidação. Montar o comprovante a partir dela o imprimiria
  com o campo que mais importa em branco. Por isso `montarReciboDeRecebimento` recebe o
  recebimento separado e o sobrepõe. Há teste travando isso, e outro travando que **R$ 0,00
  não vira o valor de face**: um `||` encadeado trataria zero como ausente.
- **Uma data só alimenta a baixa, a movimentação e o recibo.** Antes cada ponto recalculava
  `new Date(...)`; perto da meia-noite o comprovante deixaria de bater com o lançamento que
  ele comprova. É a mesma decisão do `hoje` único no diálogo de cobrança.
- **A montagem estava escrita duas vezes**, com títulos e fallbacks diferentes entre as duas
  telas. Virou `utils/reciboRecebimento.ts`, puro e testado — a reimpressão pela linha usa a
  mesma função. Predicado repetido em dois lugares só é corrigido uma vez.

### O `<form>` dentro do `<form>` que sobrevivia por duas defesas

`ParcelaRecebimentoModal` tinha um `<form onSubmit={...}>` próprio, e é renderizado dentro do
`<form id="associado-form">` do cadastro. `<form>` dentro de `<form>` é HTML inválido — o React
avisa em toda montagem ("This will cause a hydration error"). Funcionava só porque havia **duas**
defesas: o `stopPropagation()` no handler interno e a guarda
`if (e.target !== e.currentTarget ...)` no `handleSave`. Reproduzido em jsdom: com as duas no
lugar, o cadastro de fato não era submetido — ou seja, **não era essa a causa do relato**, e
dizer que era teria "consertado" o sintoma errado.

Saiu mesmo assim, virando um `<div>` com o botão em `type="button"`: duas defesas para um
aninhamento que não precisa existir é uma que alguém remove sem saber o que ela segurava.
`AssociadoMensalidadesRecebimento.test.tsx` monta a aba dentro do `<form>` real e trava as
quatro coisas de uma vez — que não há `form form` no DOM, que efetivar não submete o cadastro,
que o recibo abre, e que a movimentação nasce com a empresa resolvida.

## O segundo relatório de Contas a Receber: onde está o dinheiro, não quando ele vence

Pedido de 15/09/2026. O relatório que existia lista parcelas em ordem de vencimento — o
que o financeiro confere. O cobrador não usa isso: ele não percorre uma lista cronológica,
escolhe um bairro e faz todas as visitas dali. O relatório novo responde a outra pergunta
sobre **os mesmos filtros** — em que município e em que bairro está concentrado o valor a
receber — e o antigo continua onde estava. O botão "Exportar PDF" virou "Relatórios", com
a escolha explícita entre os dois: trocar um pelo outro tiraria de alguém o relatório que
ele já usa.

`utils/mapaCalorReceber.ts` decide **o quê** (agrupar, medir, ordenar) e cada saída decide
só **como** — prévia em tela, janela de impressão e PDF. Cinco decisões valem como regra:

- **Só parcela em aberto entra na soma; o resto vira nota.** O filtro da tela pode incluir
  recebidas e canceladas — mandar um cobrador a um bairro cujo "calor" é dinheiro que já
  entrou é o erro que este relatório existe para evitar. Elas continuam impressas, como
  rodapé, do mesmo jeito que `foraDoExercicio` na Demonstração Contábil: **o que não entra
  na conta aparece, em vez de sumir**. A parcela sem endereço (ou cujo devedor não foi
  localizado) tem nota própria: ela está no total, porque é dinheiro a receber, e fora das
  zonas, porque não é roteirizável.
- **A cor é relativa à zona mais quente; o número é absoluto.** A primeira versão cortava
  as faixas por participação no total, e **a foto do relatório mostrou o defeito**: com
  cinco bairros o maior tinha 31,6% e nada alcançava "Crítica" — o topo da rampa ficava
  sem uso justamente na linha que o cobrador procura. `faixaPorIntensidade` compara com a
  líder do **mesmo nível** (município com município, bairro com bairro), então a mais
  quente é sempre Crítica, e `participacao` segue impressa ao lado dizendo quanto aquilo é
  do total. São duas perguntas diferentes: a cor responde "onde ir primeiro", o número
  responde "quanto disso é".
- **Uma rampa de um tom só, e a cor nunca vai sozinha.** Magnitude pede rampa sequencial;
  arco-íris faria duas zonas vizinhas parecerem categorias diferentes em vez de mais e
  menos dinheiro. Os quatro passos (`#184f95` → `#86b6ef`) foram validados antes de
  entrar: luminosidade monotônica, degrau visível entre passos e o passo mais claro ainda
  separável do papel. E toda faixa imprime o **rótulo** ao lado da cor — o relatório é
  feito para ser fotocopiado, e em preto e branco a cor não informa nada.
- **Normalizar agrupa, a primeira grafia imprime.** "Coxim", "COXIM" e "coxim - ms " são o
  mesmo município digitado por operadores diferentes; sem `normalizarLocalidade` o
  relatório mostraria três zonas com um terço do dinheiro cada e nenhuma pareceria
  importante. Acento sai da chave porque "SÃO" e "SAO" convivem no mesmo cadastro — mas o
  que vai ao papel é a grafia como foi cadastrada, que é como o cobrador reconhece o lugar.
- **Devedores distintos, não parcelas.** A zona vale pelo número de **visitas** que
  representa; doze parcelas do mesmo associado são uma visita, não doze.

**O resolvedor de associado era o mesmo, e agora é um só.** O relatório antigo montava o
índice e resolvia o dono da parcela inline (id da receita → CPF → nome, nessa ordem de
confiança). O novo precisava exatamente disso; em vez da segunda cópia, o trecho virou
`indiceDeAssociados`/`resolverAssociadoDaParcela` e o relatório antigo passou a chamá-los,
sem mudança de comportamento. `parcelaEmAberto` foi para `utils/statusParcela.ts`, ao lado
de `parcelaLiquidada`: é a terceira vez que este arquivo registra que "em aberto" tem três
nomes neste schema e "liquidada" tem dois.

**Limite conhecido, de propósito**: a tela não passa `receitas` para o relatório antigo
(passa para o novo), então lá a resolução por `associado_id` nunca dispara e sobra o CPF e
o nome. Ligar isso mudaria o que o relatório antigo imprime hoje — é decisão sobre um
relatório em uso, não limpeza de código.

## O upsert que apagava campos para conseguir gravar

Achado na análise de 18/09/2026, corrigido na sequência. `resilientSupabaseUpsert`
(`services/associadosService.ts`) tentava o `upsert` até **8 vezes**, e cada tentativa
removia algo do payload até o Postgres aceitar:

| Recusa do servidor | O que a função fazia |
| --- | --- |
| `PGRST204` / `42703` (coluna inexistente) | `delete currentPayload[coluna]` e tentava de novo |
| `23503` (FK de `plano_pax_id` violada) | **`plano_pax_id = null`** e tentava de novo |
| Qualquer erro citando `empresa_id` | `delete currentPayload.empresa_id` e tentava de novo |

O segundo é o pior: o associado era gravado **sem plano**, a tela dizia "salvo com sucesso" e
o valor da mensalidade perdia a base de cálculo. A única testemunha era um `console.warn`, e
ninguém lê o console de um operador.

**É o mesmo padrão que este repositório já removeu de `criarRequisicao`** em 11/09 — o retry
que regravava a guia com `status: 'pendente'` — e que este arquivo classifica desde então:
*um retry que muda o dado enviado não é tolerância a falha, é corromper o registro para
conseguir gravá-lo.* A cópia em `associadosService` sobreviveu porque ninguém a ligou à
mesma regra.

O teste mede o defeito em vez de descrevê-lo: rodado contra o código antigo, ele reprova com
`expected [...] to have a length of 1 but got 8` — as oito tentativas, cada uma com o payload
mutilado. **Ao corrigir um comportamento silencioso, escreva primeiro o teste que falha
contra o código atual**; é o que separa a correção da intenção de correção.

### Por que a função existia, e por que deixou de ser necessária

Ela era defesa contra o schema drift — o período em que o TypeScript declarava campos que o
banco não tinha. Esse período acabou em 15/09 (as colunas duplicadas foram dropadas, as
migrations estão rastreadas, e a regra "campo novo, migration na mesma tarefa" já vale). O que
restava era uma rede que só escondia o próximo defeito — e o `PGRST204` é justamente o
**único sinal** de que ele existe.

### O que entrou no lugar

`upsertOuFalhar` faz uma tentativa, com um payload, e **lança** na recusa. Três decisões
valem como regra:

- **A recusa é uma classe, não uma string.** `RecusaDoServidor` existe para o chamador
  distinguir recusa de queda de rede — a regra que este arquivo fixa desde `saveAtendimento`,
  e que num `catch` só é impossível de aplicar. Exceção de rede sobe do `await` e vai para o
  IndexedDB e a fila de sync; recusa lança e **não** é enfileirada.
- **Isso corrigiu um enfileiramento duplo que ninguém tinha notado.** O bloco do associado
  enfileirava a recusa *e* lançava, e o `catch` externo enfileirava a **mesma** recusa outra
  vez — duas tarefas de sync por save, ambas destinadas a falhar para sempre com o mesmo
  payload. Enfileirar recusa não é resiliência: só adia a perda.
- **`explicarRecusa` traduz o código do Postgres numa frase acionável.** Repassar só a
  `message` deixa o operador com "violates foreign key constraint", que não diz qual campo
  nem o que fazer. O `PGRST204` passou a dizer o nome da coluna **e** que falta a migration —
  é o aviso que transforma o bug recorrente deste arquivo em algo que se lê na hora.

**Os call sites de dependentes e contratos paravam a recusa num `console.warn`**, então a
correção da função sozinha não apareceria: o `try/catch` foi removido dos dois e a recusa
sobe. O associado já está gravado quando eles rodam, e todo upsert é por `id` com
`onConflict` — salvar de novo depois de corrigir é idempotente, não duplica nada.

A pré-sincronização de `planos_pax` **manteve o `warn`**, e é o único que ficou: se o plano
local não subir, o insert do associado logo abaixo falha na FK e é **esse** erro que chega ao
operador, dizendo que o plano não existe. Antes, era exatamente aqui que o `plano_pax_id`
virava nulo.

**Fora de escopo, de propósito**: `lib/syncService.ts` tem `resilientSyncUpsert`, a **mesma
função copiada** (6 tentativas em vez de 8, as três mesmas mutações). Não foi tocada porque a
fila tem `MAX_RETRIES = 3` e **apaga a tarefa** ao esgotar, com um `console.warn` — fazê-la
lançar trocaria "escrita parcial silenciosa" por "registro criado offline descartado em
silêncio", que não é melhor. Corrigir ali exige antes decidir para onde vai o aviso de uma
tarefa que não sobe, e isso é decisão de produto sobre dado offline, não limpeza de código.

## O domínio do TypeScript e o `CHECK` do Postgres agora são comparados por teste

Fechado em 19/09/2026. Este projeto teve **quatro** defeitos da mesma classe, e os quatro foram
achados um a um, por acaso, quando alguém tentou usar:

| Descoberto | O defeito |
| --- | --- |
| 11/09 | `requisicoes.status` não conhecia `'emitida'` — o status com que o app cria **toda** guia |
| 18/09 | `fornecedores.status` não conhecia `'bloqueado'`, que o formulário oferece desde sempre |
| 18/09 | `fornecedores.tipo_fornecedor` não tinha `CHECK` nenhum: o domínio existia só no TypeScript |
| 19/09 | `contratos.status` recusa `'inadimplente'`, que `saveAssociado` copiava do associado |

`config/dominiosDoBanco.ts` guarda o retrato dos 30 domínios de texto que o Postgres impõe, e
`test/dominiosDoBanco.test.ts` compara com as unions do TypeScript. **O quarto da lista foi
achado pelo próprio teste**, na primeira vez que ele rodou.

### Três decisões do desenho

- **O teste lê o FONTE, não o tipo.** Uma union do TypeScript é apagada na compilação — não há o
  que importar em tempo de execução. A alternativa idiomática seria declarar cada domínio como
  `['a','b'] as const` e derivar o tipo dele; é mais robusto e é uma reescrita de 16 tipos, que
  ficou para outra rodada. Ler por regex é frágil **de propósito controlado**: há um teste que
  exige achar cada union declarada no mapa, então uma regex que pare de casar **reprova** em vez
  de passar vazio. Um guarda que não acha o que deveria checar é um enfeite.
- **O retrato é gerado, não digitado.** O SQL que o produz está no cabeçalho do arquivo, e a saída
  já vem no formato exato das linhas. **Ao criar ou alterar um `CHECK` de domínio, regere o
  retrato na mesma tarefa** — é a regra do campo novo sem migration, na direção contrária.
- **Valor que só existe no banco precisa de motivo escrito.** `requisicoes.status` aceita
  `'pendente'` e `'negada'`, que o TypeScript não declara: são legado das linhas antigas, e tirá-los
  do `CHECK` quebraria o `UPDATE` delas. A exceção é declarada com a frase que explica por quê, e
  há um teste exigindo que o motivo tenha mais de 30 caracteres — **sem isso a exceção vira só um
  jeito de calar o teste**, que é exatamente o que ele existe para impedir.

As duas direções são checadas separadamente porque têm gravidades diferentes: o TypeScript
declarar um valor que o banco recusa **quebra a gravação** (`23514`); o banco aceitar um valor que
o TypeScript não conhece deixa o registro **sem rótulo, fora do filtro e fora dos contadores** —
visível só na coluna crua.

### O defeito que o teste achou: status de associado não é status de contrato

`saveAssociado` montava o payload de `contratos` com `status: associadoToSave.status || 'ativo'` —
**copiando** um domínio no outro. `associados.status` aceita `'inadimplente'`;
`contratos_status_check` não. Conferido em produção, em transação revertida:

```
ANTES  (status copiado: 'inadimplente') -> 23514
DEPOIS (status traduzido: 'ativo')      -> aceito
```

Bastava o operador marcar um associado como inadimplente — opção que o formulário oferece — e
salvar o cadastro. Estava armado e ainda não disparou só porque a produção tem 0 inadimplentes.
Até a PR #77 a recusa morria num `console.warn` no `catch` do contrato: o associado era salvo, o
contrato ficava com o status velho e a tela dizia sucesso.

`utils/statusContrato.ts` traduz em vez de copiar, e **`'inadimplente'` vira contrato `'ativo'`,
não `'inativo'`**: quem deve continua coberto — o contrato está vigente, o que existe é uma
dívida. É a mesma decisão que `associadoSelecionavel` já registra ao manter o inadimplente
escolhível num atendimento. O teste amarra isso ao retrato em vez de repetir a lista: varre
**todos** os valores de `associados.status` e exige que o resultado esteja em `contratos.status`.

`StatusContrato` passou a espelhar o `CHECK` (`ativo | inativo | encerrado | cancelado`) — ela
declarava `'inadimplente'`, que o banco recusa, e não declarava `'cancelado'`, que ele aceita.

### `| string` no fim de uma union anula a union

`TipoFornecedor` era `'produtos' | 'servicos' | 'ambos' | string` — para o compilador, `string`.
Qualquer valor passava, e o teste de domínio não teria como acusar nada. Fazia sentido enquanto o
"Gerenciar" da tela deixava inventar tipo; esse caminho saiu em 18/09 junto com o `CHECK`, então o
`| string` era o que restava da porta aberta.

Ao fechá-la, o `tsc` apontou **exatamente** a fronteira onde um valor legado entra
(`opcoesTipoFornecimento`, que preserva o que já está gravado). A constante canônica ficou tipada
com o domínio estreito e só a lista devolvida ao seletor é larga — **estreite o tipo onde o
domínio vale e alargue onde o legado entra**, em vez de alargar o tipo inteiro.

## A inadimplência virou aviso — ela marcava o cadastro sozinha

Achado na análise de 18/09/2026. `hooks/useBackgroundChecks` rodava no carregamento da
aplicação, **para todo operador que abrisse o sistema**, e mudava o status do associado para
`inadimplente` direto no cadastro:

```ts
if (associado.status === 'ativo' && associado.cpf && overdueMap[associado.cpf] > 2) {
  await saveAssociado({ ...associado, status: 'inadimplente' }, state.isOnline);
}
```

Ninguém decidia. Não havia confirmação, notificação nem aviso na tela; a única marca era um
`console.log`, e ninguém lê o console de um operador. Quem descobria era quem abrisse o
cadastro depois. Como vários operadores abrem o sistema ao mesmo tempo, a gravação ainda
acontecia em concorrência — e `saveAssociado` mexe no contrato junto.

**Estava armado, não inerte.** Conferido em produção antes de mexer: `associados.cpf` e
`parcelas_receber.devedor_cpf_cnpj` estão gravados no mesmo formato (`017.989.211-89`), então
o `overdueMap` casava. Só não disparou porque o máximo hoje é **1** parcela vencida e o
limiar é 3. O primeiro associado a acumular três seria marcado em silêncio.

A regra de negócio é legítima; o que estava errado era ela ser executada sem ninguém no
circuito. **Marcar um cliente como inadimplente é decisão de cobrança, não reparo de dado** —
a mesma lição que o backfill da Ata de Ocorrências já registra sobre preencher um campo que
decide o que o registro significa.

Quatro decisões valem como regra:

- **Detectar e gravar são passos separados.** `utils/inadimplencia.ts` (puro, 20 testes)
  decide **quem**; `hooks/useAvisoInadimplencia` cria a notificação; quem grava é o
  administrador, na tela de Associados, onde o seletor de status já existe. É a mesma divisão
  da cobrança automática de atendimento e requisição: montar a proposta não pode escrever
  nada. **Nenhuma linha do caminho novo escreve em `associados`.**
- **O dono da parcela sai de `resolverAssociadoDaParcela`**, que tenta `associado_id` da
  receita, depois CPF, depois nome. A rotina antiga montava um mapa `cpf → contagem` e
  dependia de os dois lados estarem no mesmo formato — bastava um operador digitar sem
  pontuação para a contagem zerar e o associado **sumir do aviso**, que é o erro mais quieto
  dos dois. `parcelas_receber` não tem `associado_id`; o vínculo é pela receita, e o
  resolvedor que faz isso já existia no relatório de Contas a Receber.
- **"Em aberto" tem três nomes, e a rotina antiga só olhava dois.** Ela filtrava `'pendente'`
  e `'vencido'` e deixava **`'atrasado'`** de fora — justamente o status que significa atraso.
  Por isso a checagem é `parcelaEmAberto`, de `utils/statusParcela.ts`, e não um `||` escrito
  de novo. É a terceira vez que este arquivo registra esse mesmo descuido.
- **A data é comparada como texto.** Para `YYYY-MM-DD` a ordem lexicográfica é a cronológica.
  A rotina antiga concatenava `'T12:00:00'` na data antes de construir o `Date` — o meio-dia
  era a margem que a fazia escapar da armadilha do UTC que este arquivo documenta em
  `anoDaData()`. Comparar texto dispensa a margem. A parcela que vence **hoje** não conta: o
  associado ainda tem o dia.

**O título do aviso é constante e a contagem vive na mensagem**, como no aviso de cadastros
pela metade e pelo mesmo motivo — com o número no título, cada mudança na lista viraria
assunto novo e o aviso renasceria do zero a cada carregamento (foi o que acumulou 24
notificações para um usuário, 22 já apagadas).

`avisoJaEnviado` **saiu de `cadastrosIncompletosService` para `notificacoesService`**: os dois
avisos fazem a mesma pergunta, e `avisoDeCadastrosJaEnviado` passou a ser uma casca que só
fixa o título. A próxima rotina de aviso entra coberta sem copiar o predicado.

**Limitação conhecida, deixada de propósito**: `LIMITE_PARCELAS_VENCIDAS` é constante do
código (3, o mesmo valor do `> 2` antigo), não configuração da empresa — duas empresas com
políticas de cobrança diferentes recebem a mesma régua. Tornar o limiar configurável precisa
de coluna nova e de tela. Por isso ele é **parâmetro da função**, e não literal no corpo: é o
que torna essa passada barata depois.

## Associado com histórico não se exclui — inativa-se

Pedido de 14/09/2026. `softDeleteAssociado` **não é soft coisa nenhuma**: é uma cascata de
hard delete que apaga receitas, **parcelas já recebidas**, atendimentos, requisições,
contratos e dependentes — do IndexedDB *e* do Postgres. Um clique desfazia dinheiro que
entrou no caixa e o registro do velório que a família já usou, deixando só a linha de
auditoria.

A regra nova tem duas metades, e uma sem a outra não vale nada:

- **Recusar a exclusão** quando existe histórico: parcela recebida (dinheiro que virou
  realizado no Plano de Contas) ou atendimento **do titular ou de qualquer dependente**.
- **Oferecer a inativação**, que preserva o histórico e tira o cadastro de circulação.

Quatro decisões valem como regra:

- **A guarda vive antes da primeira linha ser tocada.** `softDeleteAssociado` levanta o
  histórico e lança **antes** da limpeza local — a partir dali não há volta. É a mesma
  escolha de `utils/statusParcela.ts`: esconder o botão é conveniência, a recusa mora no
  ponto de escrita.
- **Falha de consulta não vira "não há histórico".** `getHistoricoImpeditivoAssociado`
  cai para o IndexedDB quando o Supabase falha, em vez de devolver vazio. Uma rede instável
  liberando a exclusão que o banco recusaria seria o pior resultado possível.
- **A recusa é um modal com os registros, não um toast.** O operador pediu para excluir e
  precisa ver **o que existe** para decidir; e o botão de inativar tem de estar ali, senão
  ele tenta de novo achando que errou o clique. A listagem mostra no máximo
  `LIMITE_POR_GRUPO` por bloco, com o total no cabeçalho — doze parcelas de um plano anual
  empurrariam o botão para fora da vista.
- **Inativar é cascata, não um rótulo.** `inativarAssociadoEmCascata` marca o titular e os
  dependentes, põe o contrato em `inativo` e **cancela as parcelas em aberto**
  (`pendente`/`vencido`/`atrasado`). Parcela recebida não é tocada. O cancelamento da
  dívida é decisão de negócio tomada explicitamente: a inativação aqui é tipicamente por
  falecimento, e seguir cobrando mensalidade de quem morreu é o que a função existe para
  evitar.

### Inativar só significa algo se o inativo sumir dos seletores

`utils/selecaoCadastro.ts` (puro e testado) é a segunda metade da regra: enquanto der para
escolher o inativo num atendimento, numa guia ou num contrato, a inativação é decoração.
Aplicado nos quatro seletores — wizard de atendimento (titular e dependentes), Requisições
(titular e dependentes) e wizard de contrato.

Três detalhes que o teste trava:

- **`inadimplente` continua selecionável.** Quem deve é justamente quem precisa ser
  atendido e cobrado; barrar aqui seria negar serviço por atraso — decisão que ninguém
  tomou. Só `inativo` e `encerrado` saem.
- **O dependente depende também do titular.** A cobertura dele vem do plano do titular:
  sem esse segundo teste, inativar o titular deixaria a família inteira selecionável pela
  porta dos fundos.
- **O já selecionado continua visível** (`idJaSelecionado`). Um registro antigo pode
  apontar para quem foi inativado depois, e sumir com ele faria a tela de edição perder a
  seleção — reescrevendo o registro em silêncio ao salvar. É a mesma escolha do seletor de
  conta contábil, que exibe a conta desativada já gravada.

Dois defeitos pré-existentes saíram junto, porque estavam no caminho:

- **`Dependente.status` existia no Postgres e não no TypeScript** — e o payload de
  gravação também não o mandava. Inativar um dependente não tinha onde ficar guardado.
- **`handleInativarDependente` (wizard de atendimento) REMOVIA o dependente** da lista, e
  `saveAssociado` então o apagava do banco: o falecido sumia do cadastro que o próprio
  atendimento referencia. Agora é marcado `inativo`. O `handleInativarTitular` passou a
  usar a cascata — antes só mudava o status e o contrato seguia gerando mensalidade.

`cancelarParcelasEmAbertoDoAssociado` cobre os três nomes de "em aberto". O
`cancelarReceitasPorAtendimento`, mais antigo, filtra só `pendente` — deixa a vencida
cobrável para trás. **Ao filtrar parcela por status, lembre que "em aberto" tem três
nomes neste schema e "liquidada" tem dois.**

### O formulário de edição respeita o status, e diz de quem é o cadastro

Pedido de 14/09/2026, fechando o ciclo da inativação. Duas coisas:

**1. Associado inativo não recebe operação nova.** Três bloqueios no formulário: dependente
novo, contrato (criar e modificar plano) e geração de mensalidades. A regra reaproveita
`associadoSelecionavel` pelo avesso — `cadastroForaDeCirculacao` —, e isso é deliberado:
"não pode ser escolhido num atendimento" e "não pode ganhar dependente novo" são a mesma
pergunta sobre o mesmo estado, e uma segunda lista de status é como as duas metades passam
a discordar na primeira mudança. Há teste cobrando que as duas continuem espelhadas.

A guarda da geração de mensalidades fica em `handleAbrirGeracao`, **o funil**, não só nos
botões: os dois botões do organograma chamam a mesma função, e travar um deixaria o outro
aberto. Gerar mensalidade para quem acabou de ser inativado desfaria, em silêncio, o
cancelamento das parcelas que a inativação tinha acabado de fazer.

**2. O cabeçalho mostra o associado em todas as abas.** São oito abas, e o cabeçalho só
dizia "Editar Associado" — três cliques adiante, nada na tela lembrava de quem era o
cadastro. Agora mostra nome, status, idade, CPF e plano, mais o aviso âmbar que explica
**por que** as ações adiante estão travadas. Campo sem valor não vira "CPF: —": a linha
some, porque um cabeçalho de rótulos vazios ocupa o mesmo espaço sem informar nada.

**A idade é calculada certo.** `idadeEmAnos` desconta o aniversário que ainda não chegou,
ao contrário do `getFullYear() - getFullYear()` que o projeto repetia — que devolve 36 para
quem nasceu em 31/12/1990 no dia 01/01/2026, quando a pessoa tem 35. O cabeçalho nasceu já
com ela; os outros três pontos foram unificados logo depois, ver a seção seguinte.

### A idade agora sai de um lugar só — e o preço foi medido antes, não depois

`idadeEmAnos` passou a ser a única fonte de idade do projeto: `calcularNVidasEIdades`
(`utils/associadoHelpers.ts`), o `valorPlano` do `NovoContratoWizard` e o badge `Na` do card
de dependente chamavam cada um a sua própria subtração de anos. Três cópias do mesmo cálculo
errado, e duas delas alimentam o **valor do plano** — que é o que fez essa correção esperar
uma decisão em vez de entrar junto com o cabeçalho.

**A pergunta que destravou não foi "o cálculo está errado?" (estava), e sim "quanto muda de
preço?".** Medido na produção antes de tocar no código, e a resposta é **zero**, por dois
motivos independentes:

- `planos_pax_faixas` tem **0 linhas**, e `calcularValor` só soma `adicionaisDependentes`
  quando `plano.faixas && plano.faixas.length > 0`. Sem faixa cadastrada, a idade do
  dependente não entra na conta em lugar nenhum.
- Os 4 planos existentes são `individual`, onde a base é `valor_mensalidade * vidas` — a
  contagem de vidas, que esta mudança não toca.

Dos 7 dependentes com data de nascimento, 3 tinham a idade **exibida** um ano a mais
(64→63, 37→36, 15→14). Era isso que a correção mudava: o número na tela, não o boleto.

Duas coisas valem como regra:

- **Medir é mais barato que supor, nos dois sentidos.** A suposição conservadora ("mexe em
  preço, não mexa") tinha segurado três bugs visíveis; a suposição otimista teria mudado
  valor de contrato em produção. O `select` que respondeu levou menos tempo que qualquer um
  dos dois raciocínios.
- **`?? 0` preserva o fallback que já existia** para dependente sem data de nascimento — e
  também para data em formato quebrado, que `idadeEmAnos` recusa e o `new Date()` antigo
  aceitava de vez em quando. Mudar esse `0` mexeria em qual faixa o dependente casa quando
  alguém cadastrar faixas, e isso é outra decisão, de produto. Há teste travando os dois
  casos em `associadoHelpers.test.ts`.

**A próxima cópia é impedida pelo teste, não pela boa vontade**: o cálculo vive em
`utils/resumoAssociado.ts`, com clock injetável (`idadeEmAnos(data, hoje)`) — é o que permite
travar "um dia antes do aniversário" sem depender de quando a suíte roda. Ao precisar de
idade em qualquer tela nova, importe de lá.

## Reativar é fazer contrato novo, não desfazer a inativação

Pedido de 14/09/2026. O assistente (`ReativacaoAssociadoWizard`, cinco etapas) aproveita o
cadastro e os dependentes que já existem — ninguém redigita nada —, mas **o contrato nasce do
zero**: plano escolhido de novo, número e data próprios, mensalidades geradas, e o contrato
anterior arquivado.

A tentação era tratar reativação como simetria da inativação: desfazer o que
`inativarAssociadoEmCascata` fez. **Não pode ser.** Aquela cascata cancelou as parcelas em
aberto, e elas são de um período em que o associado não estava coberto — ressuscitá-las
cobraria mensalidade de quem não teve direito a nada. O contrato antigo, do mesmo jeito, é o
documento que valeu até ali, com o plano e o valor daquela época. Os dois ficam como estão.

A divisão é a de sempre: `utils/reativacaoAssociado.ts` decide **o quê** (puro e testado),
`services/reativacaoService.ts` grava, a tela decide **quando**.

Seis decisões valem como regra:

- **A ordem da gravação é a regra, e por isso mora no service.** Arquivar o contrato vigente
  vem **antes** de criar o novo, porque `saveAssociado` procura o contrato ativo para
  atualizar — com dois ativos ao mesmo tempo ele mexeria no errado. Há teste cobrando a
  ordem das gravações, o que só é possível porque isso não está dentro do componente (o
  `NovoContratoWizard` ainda orquestra tudo no `handleSave`, e lá não dá para testar).
- **O operador escolhe quais dependentes voltam, e a escolha vale dinheiro.**
  `vidasDaReativacao` conta só os marcados, e o valor do plano recalcula na hora. A
  inativação costuma ser por falecimento: reativar a família inteira por padrão sem poder
  desmarcar ninguém cobraria por uma vida que não existe. Todos vêm marcados (a inativação
  foi em cascata), e **ninguém é removido** — o desmarcado fica `inativo`, porque o
  atendimento funerário dele aponta para aquela linha.
- **A taxa de adesão começa em zero e é digitável.** Quem volta não está aderindo pela
  primeira vez; cobrar de novo por omissão seria decisão de preço tomada por descuido. Se a
  empresa cobra readesão, o campo está ali e o valor aparece na projeção antes de gravar.
- **O contrato anterior termina no dia em que o novo começa** — `dataAdesao`, nunca
  `new Date()`. São a mesma coisa no caso comum, e é por isso que a diferença passa
  despercebida: só divergem quando o operador retroage a adesão, e aí `historico_contratos`
  e `contratos.data_fim` contariam histórias diferentes sobre o mesmo intervalo.
- **O histórico recebe o contrato anterior SEMPRE**, não só quando o plano muda — ao
  contrário do `NovoContratoWizard`, que compara `plano_pax_id !== planoId`. Aqui a adesão
  anterior terminou de fato, e readerir ao mesmo plano ainda é um contrato novo.
- **`n_vidas` é reescrito junto.** `MensalidadesGeracaoWizard` lê esse campo e não recalcula
  nada — deixá-lo com a contagem antiga faria a próxima geração avulsa de parcelas cobrar
  pelos dependentes que a reativação acabou de deixar de fora.

A recusa mora no ponto de escrita (`cadastroForaDeCirculacao`, o mesmo predicado dos
seletores): reativar quem já está ativo arquivaria o contrato vigente para criar outro igual,
com as parcelas em aberto cobradas em duplicidade. `inadimplente` não é reativável — ele
nunca saiu de circulação.

### O contrato existente era procurado sem filtro de status

Pré-requisito que a reativação destravou, e que teria quebrado em silêncio: `saveAssociado`
(e o mesmo predicado copiado em `lib/syncService.ts`) buscava o contrato do associado com
`.eq('associado_id', id).maybeSingle()`, **sem filtrar por status**, e descartava o `error`
da consulta. Enquanto cada associado tinha exatamente um contrato, funcionava. Com o
contrato anterior guardado como `inativo` ao lado do novo, a consulta passa a devolver mais
de uma linha, `maybeSingle` não entrega objeto nenhum, e o código cairia no ramo de "não
existe" — **inserindo uma linha nova em `contratos` a cada save do mesmo associado**.

Agora a busca é `.eq('status','ativo').is('deleted_at', null).order(created_at desc).limit(1)`,
e o erro da consulta interrompe a gravação do contrato em vez de virar linha duplicada. **A
regra**: uma consulta que hoje devolve uma linha por acidente do dado — não por constraint —
é uma consulta sem filtro. Antes de passar a criar mais linhas de uma tabela, procure quem a
lê esperando encontrar só uma.

Verificado contra a produção antes do commit, em transação revertida: arquivar o vigente e
inserir o novo deixa o associado com **2 contratos e exatamente 1 ativo**, com as colunas
que o service manda (`taxa_adesao`, `data_fim NULL`). `contratos` não tem unicidade por
`associado_id` — só `numero_contrato`, e essa é **global, não por empresa** (a mesma classe
do `credenciados.cnpj_cpf` que este arquivo já documenta). Não foi mexida: os números são
`CTR-` + 8 caracteres aleatórios, e o único outro gerador é determinístico pelo id do
associado, então não há colisão prática — mas se um dia a numeração passar a ser sequencial
por empresa, essa constraint é a primeira coisa a corrigir.

### A terceira cópia da projeção de parcelas, evitada por pouco

Ao escrever o assistente, a projeção de parcelas foi implementada de novo — e só depois se
viu que `gerarProjecaoParcelas` já existia em `utils/mensalidadesAssociadoHelpers.ts`,
testada, usada pelo wizard de mensalidades avulso; e que o `NovoContratoWizard` tinha uma
**segunda** cópia inline, num `useCallback` de sete dependências. As três faziam a mesma
conta de vencimento.

Ficou a que já existia: a cópia nova foi descartada e o `NovoContratoWizard` passou a chamá-la.
`utils/reativacaoAssociado.ts` apenas a reexporta, para o assistente não precisar saber em
qual módulo ela mora.

**A regra, que este arquivo já registra em outras palavras**: antes de escrever uma função
utilitária, procure por **comportamento**, não pelo nome que você daria a ela. "Projetar
parcelas" não estava em nenhum arquivo chamado `projecao*` — estava dentro dos helpers da aba
de mensalidades do associado, que é onde ela nasceu.

### A etapa de dependentes também inclui — a família muda enquanto o cadastro está parado

Relato da UI em 14/09/2026, com a etapa 2 já funcionando: faltava poder **acrescentar**
dependente ali, não só confirmar quem volta. Nasce neto, casa filho — e mandar o operador
concluir a reativação para só então abrir o cadastro e incluir tem duas consequências, nenhuma
visível na hora: **o contrato nasce com uma vida a menos do que a família tem, e as
mensalidades já geradas cobram o valor errado** até alguém refazer tudo.

O formulário é o `DependenteFormModal` que o cadastro já usa — não um segundo formulário de
dependente. Ele já valida nome/nascimento, já gera id, já recusa CPF duplicado e já conhece a
lista de parentescos; escrever outro seria garantir que as duas telas divergissem na primeira
regra nova. O que a reativação passa é `existingCpfs` com o CPF **do titular mais o dos
dependentes**, porque aqui a família inteira está em edição ao mesmo tempo.

Três decisões valem como regra:

- **Incluído entra marcado.** Quem acabou de digitar alguém quer essa pessoa coberta; nascer
  desmarcado faria o contrato sair sem ela, e nada na tela explicaria por quê.
- **Só o recém-incluído pode ser removido; o já cadastrado só pode ser desmarcado.**
  `podeRemoverDependente` decide pelo `novo`, que vem de comparar o id com os que estavam no
  banco quando a tela abriu (`idsJaCadastrados`, congelado na abertura). Remover um dependente
  já existente faria `saveAssociado` apagá-lo do Postgres — é literalmente o defeito de
  `handleInativarDependente`, que sumia com o falecido do cadastro que o próprio atendimento
  referencia. Sem o `novo`, não há como distinguir um dependente recém-digitado de um que já
  existia e estava ativo, e os dois têm regras opostas.
- **`acrescentarDependente` substitui o de mesmo id** em vez de empilhar — é o que faz a
  mesma função servir para corrigir um nome digitado errado, sem criar uma segunda linha para
  a mesma pessoa.

**A tela ganhou teste de render** (`ReativacaoAssociadoWizard.test.tsx`, o terceiro do projeto
e o primeiro de um componente com hooks próprios): os hooks de dados são mockados e o que se
testa é o assistente montado de verdade — incluir um dependente sobe a contagem de vidas de 2
para 3, remover desfaz, desmarcar baixa para 1, e o último caso vai até o fim e confere o
`valorPlano` que chega ao service (3 vidas × R$ 100 = R$ 300). Esse último é o que importa: sem
ele, a inclusão seria só um número na tela.

Duas coisas do método valem para a próxima mudança de UI aqui:

- **A foto pegou o que o teste não pega.** Montado o componente em jsdom, o HTML foi
  fotografado com o CSS do build (Chromium + puppeteer, como manda a seção "Conferindo a
  impressão de verdade"). Apareceram dois defeitos que nenhuma asserção acusaria: o botão
  "Incluir dependente" quebrava para a linha de baixo, e a etiqueta "Coberto" mudava de
  posição entre as linhas conforme o dependente tivesse ou não botões de ação. A correção do
  segundo é estrutural: **a área de ações é renderizada em toda linha, com largura fixa,
  mesmo vazia** — sem isso, uma coluna recorrente dança de linha em linha.
- **O primeiro dump não mostrou nada, e isso também foi informação.** O seletor procurava o
  campo de nome por `placeholder` contendo "nome", mas o placeholder real é
  `Ex: MARIA SILVA SANTOS`. O formulário nem chegou a validar. Ao dirigir um formulário alheio
  por teste, **leia o markup antes de adivinhar o seletor**.

### O contrato é gerado depois de gravar, com o associado já reativado

A última etapa escolhe o modelo padrão; ao concluir, o documento abre no
`VisualizadorDocumentoPadraoModal` com as variáveis resolvidas — o mesmo caminho do
`ContratoDocumentosGenerator`. Ele é montado a partir do associado **devolvido pelo service**,
não do que estava na tela: montá-lo antes imprimiria o número, o plano e o valor do contrato
que acabou de virar histórico.

Sem modelo escolhido a reativação conclui do mesmo jeito, com um aviso âmbar dizendo que
nenhum contrato será gerado. Travar a conclusão por falta de modelo faria a empresa que ainda
não cadastrou um não conseguir reativar ninguém — a mesma escolha da isenção "empresa sem
conta lançável" da fase 3 do plano contábil.

**`salvarReceita` engole a recusa do Postgres** (`console.error`, grava no IndexedDB, devolve
`void`) — a armadilha que este arquivo documenta em `saveAtendimento`. Corrigir a função
compartilhada mudaria o comportamento de todos os seus chamadores de uma vez e ficou fora
desta rodada; aqui, onde a operação é irreversível, o service **confere** se a receita chegou
ao servidor e, se não chegou, lança uma mensagem específica: o cadastro e o contrato já
foram gravados, as mensalidades não, lance-as em Contas a Receber — **e não repita a
reativação**, ou o associado fica com dois contratos. Um "erro ao reativar" genérico é
exatamente o que produziria essa segunda passada.

## Associado Pessoa Jurídica: o campo que existia na tela e era descartado antes de gravar

Pedido de 17/09/2026: "criar um campo para selecionar a empresa do associado PJ, vinculado a
fornecedores". **O campo já existia** — `AssociadoFormModal` tinha o select de `tipo_pessoa` e, para
PJ, o de empresa conveniada, alimentado por `useFornecedores` e filtrado pela categoria. O que não
existia era tudo depois do clique:

- `associados.fornecedor_id` **não existia no banco** (só `tipo_pessoa`, com `CHECK` e default `'PF'`);
- `saveAssociado` fazia `const { dependentes, fornecedor_id, ...rest } = associado`, desestruturando
  o campo **para fora** do payload, com o comentário "campos não existentes na tabela principal";
- `lib/syncService.ts` fazia o mesmo com a fila de sync.

Resultado: o operador escolhia a empresa, salvava, a tela dizia "sucesso" e o vínculo nunca
existiu. **Não dava nem `PGRST204`** — a armadilha que este arquivo documenta em `documentos_padroes`
e `atendimentos` aparece aqui na forma mais silenciosa de todas, porque o campo nem chegava a ser
enviado. O que confirma que o caminho nunca funcionou: **0 associados PJ em produção**, com 1
fornecedor cadastrado e ele exatamente na categoria de convênios.

**A regra que isto acrescenta**: desestruturar um campo para fora do payload "porque a coluna não
existe" não é sanitização, é perda de dado agendada. Ou a coluna é criada na mesma tarefa (o que a
seção do `PGRST204` já manda), ou o campo sai da interface — deixar os dois lados discordando em
silêncio é o pior dos três estados.

### O vínculo (migration `20260917193736`)

- **FK composta com `tenant_id`**, como manda a seção do plano contábil:
  `(tenant_id, fornecedor_id) → fornecedores (tenant_id, id)`, com a `unique (tenant_id, id)` nova
  do lado referenciado (`fornecedores` só tinha `PRIMARY KEY (id)`). Exercitado em transação
  revertida antes de aplicar: apontar para conveniada de **outra** empresa leva `23503`, e uma FK
  simples por `id` teria deixado passar.
- **`ON DELETE RESTRICT`**: excluir a conveniada não pode desfazer, em cascata e sem aviso, o
  vínculo dos associados dela.
- **Nullable, e a obrigatoriedade é do formulário.** Um `NOT NULL` — ou um
  `CHECK (tipo_pessoa <> 'PJ' OR fornecedor_id IS NOT NULL)` — vale para a linha, não para o
  preenchimento, e quebraria todo cadastro PF no primeiro `UPDATE`. A exigência vive em
  `validarDadosAssociado`. Mesma escolha da fase 3 do plano contábil e dos dados do responsável.
- **Índice parcial de cobertura** `(tenant_id, fornecedor_id) where fornecedor_id is not null` — a
  esmagadora maioria dos associados é PF e nunca terá valor aqui. Conferido em `pg_indexes` por
  **definição** antes de criar, e o advisor `unindexed_foreign_keys` não lista a FK nova.

### O erro de validação precisa saber em que aba mora o campo

`ErroValidacaoAssociado` tinha só `subTab`, e `executarValidacaoOuAlertar` fazia
`setActiveSubTab(erros[0].subTab)`. O campo da empresa fica na aba **Contratos**, não nas sub-abas
de Dados — mandar o operador para uma sub-aba de Dados destacaria um campo que não está lá. O tipo
ganhou `tab` opcional e o hook decide entre os dois. **Ao validar um campo novo, confira se ele mora
na aba que a navegação do erro assume.**

### `utils/empresaVinculada.ts` — o predicado num lugar só

Puro e testado (20 testes), porque quatro lugares precisam da mesma pergunta: cadastro, listagem,
filtro e relatório. Decisões que valem como regra:

- **A categoria saiu do JSX para constante.** `'Convenios Associados'` era literal dentro do
  `filter` do select. Renomear a categoria no cadastro de fornecedores esvaziaria o seletor **em
  silêncio**, e o operador ficaria sem salvar um PJ sem nada na tela explicando por quê — é a lição
  de `resolverContaPorCodigo` (procurar por código, não por nome) valendo para outra chave.
- **A empresa já gravada aparece mesmo desativada**, no cadastro e nas opções do filtro. Sem isso,
  abrir para editar perderia a seleção e salvaria o vínculo vazio; e no filtro os associados dela
  virariam infiltráveis. Mesma escolha do seletor de conta contábil e de `idJaSelecionado`.
- **`vinculoEmpresaParaGravacao` normaliza no ponto de escrita**, e cobre três armadilhas já
  registradas neste arquivo: `''` numa coluna `uuid` é `22P02` (foi o que manteve `atendimentos`
  zerada); cadastro que deixou de ser PJ grava `null`, senão sobra vínculo órfão invisível no
  formulário e visível no filtro; e o retorno é `null`, **nunca `undefined`** — `JSON.stringify`
  descarta chave `undefined` e o `upsert` chegaria sem a coluna, deixando o valor antigo no banco.
- **O nome da empresa é resolvido por id, não guardado no associado.** É o oposto do `categoria`
  dos lançamentos, que é snapshot de propósito: lá o documento precisa dizer o que valia na época;
  aqui é listagem operacional, e a empresa renomeada tem de sair com o nome de hoje.
- **"Somente Pessoa Jurídica" é opção do filtro**, e inclui o PJ que ainda não tem empresa
  escolhida — ele existe e é justamente o cadastro que falta completar. Filtrar só por empresa
  responderia metade da pergunta.

### A coluna do relatório só aparece quando há PJ

`listaTitulares` já era a fonte única das três saídas (prévia, impressão e PDF), então a empresa
entrou lá e os três renderizadores só decidem **como** — o mesmo desenho da Ficha de Cadastro. Duas
decisões:

- **`temAlgumPJ` decide se a coluna existe.** Uma coluna que imprime "—" em todas as linhas gasta
  largura das que informam algo, e a esmagadora maioria dos relatórios aqui é só de pessoa física.
- **As larguras do `columnStyles` do jsPDF são POSICIONAIS.** Com a empresa no índice 5,
  adesão/deps./status passam a 6/7/8; manter o mapa antigo aplicaria a largura da adesão na
  empresa. Há um mapa para cada caso. **Ao inserir coluna no meio de uma tabela do `autoTable`,
  o mapa de larguras muda junto — ele não casa por nome.**

O filtro ativo vai impresso no cabeçalho das três saídas, ao lado de status e busca, e o rótulo é
calculado **uma vez** (`filtroEmpresaLabel`) para os três: recalcular em cada renderizador é como
dois cabeçalhos passam a discordar. Um relatório que não diz por qual empresa foi filtrado afirma
ser a lista completa sem ser.

**Fora de escopo de propósito**: Ficha de Cadastro impressa, carteirinha e as tags `{{...}}` de
documento não mostram a empresa. Nenhuma foi pedida, e a de documento tem regra própria (catálogo e
resolver em sincronia, senão a tag aparece no painel e nunca preenche). O associado PJ também
continua tendo nome e CPF de pessoa: a empresa é o fornecedor vinculado, não o cadastro em si.

### A carteira da conveniada: quem está vinculado e quanto cada um deve, mês a mês

Pedido de 17/09/2026, fechando o ciclo do vínculo: o formulário de fornecedor ganhou a aba
**Associados & Mensalidades**, que só existe para empresa da categoria de convênios. Ela lista os
associados PJ vinculados àquela empresa e, para cada um, quanto de mensalidade foi recebido e
quanto está em aberto em cada mês do exercício.

`utils/carteiraEmpresaConveniada.ts` é puro e testado (20 testes) e decide **o quê**; a aba decide
só **como**. Cinco decisões valem como regra:

- **A competência é o VENCIMENTO para os dois lados — e isso diverge de propósito da Demonstração
  Contábil.** Lá o realizado é datado pela **liquidação**, porque a pergunta é "quanto entrou neste
  exercício". Aqui a pergunta é outra: "a mensalidade de março foi paga?". Datando o recebido pela
  liquidação, uma parcela de março paga em abril sairia da coluna de março **sem entrar como
  aberta** — março mostraria um buraco que não existe. Pelo vencimento, cada parcela aparece
  exatamente uma vez, e recebido + em aberto do mês é o que foi lançado naquele mês. **Ao somar
  dinheiro por período, escreva qual data manda e por quê**; as duas estão sempre disponíveis e
  sempre parecem intercambiáveis.
- **A consulta é escopada pelo tenant do PRÓPRIO fornecedor, não pelo seletor do topo.**
  `getParcelasReceber` trata `'all'` como "sem filtro", e o super_admin costuma estar nesse estado:
  a carteira passaria a somar parcela de outra empresa. `initialData.tenant_id` é preciso e não tem
  o fundo falso. É a lição do lote de caixa valendo num caminho de leitura.
- **A aba usa a categoria SALVA, não a do formulário.** Trocar o select faria a aba piscar enquanto
  se edita, e os associados estão vinculados ao registro como ele está no banco, não como está na
  tela. Sem `id` gravado a aba nem aparece — não há vínculo possível com um cadastro que ainda não
  existe.
- **O que não entra na soma vira nota**: parcela cancelada (existe e não cobra ninguém) e parcela de
  outro exercício. Mesma regra de `foraDoExercicio` na Demonstração Contábil e das parcelas sem
  endereço no mapa de calor. O associado **sem nenhuma parcela também continua na lista**, zerado: a
  carteira é a relação de quem está vinculado, e sumir com ele faria procurar o cadastro que se sabe
  que existe.
- **Zero não é impresso.** Célula sem lançamento é `—`, e um total zerado não vira "R$ 0,00" ao lado
  de um valor real. É a mesma escolha do cabeçalho do associado, que omite a linha do CPF em vez de
  mostrar "CPF: —".

**A categoria de convênios não estava na lista padrão** — existia só porque alguém a criou pelo
"Gerenciar", e essa lista vive no `localStorage` de **cada navegador**. Em outra máquina ela não
aparecia no select, e não havia como cadastrar uma conveniada nova. É a mesma doença que `categoria`
tinha antes do plano contábil e `centros_custo` antes de virar tabela. Corrigido de duas formas:
`CATEGORIA_EMPRESA_CONVENIADA` entrou nas duas listas padrão **e** é acrescentada à lista salva
quando falta. Mover a lista inteira de categorias para tabela ficou para a passada seguinte — que
é a seção abaixo.

### A foto pegou três coisas, e uma delas não era defeito

Fotografado no aninhamento real (o `<form>` do modal de fornecedor, com o CSS do build), como manda
a seção "Conferindo a impressão de verdade" e a lição do `backdrop-filter`:

1. **O modal tinha 768px e a grade tem 12 meses.** A largura serve aos formulários e não a uma
   carteira anual; o modal passou a alargar para `max-w-6xl` **só nessa aba**.
2. **A coluna Total ficava cortada pela rolagem** — justamente a coluna que o operador veio ver.
   Ela passou a ser `sticky right-0`, como o nome já era `sticky left-0`. **Numa tabela larga, as
   duas pontas grudam**: sem isso a rolagem esconde ou a identidade da linha ou o resultado dela.
3. **O seletor de exercício parecia mostrar o ano errado — e não mostrava.** `innerHTML` não
   serializa o `value` que o React põe como **propriedade do DOM**, então o dump exibe a primeira
   `<option>`. Conferido no HTML gerado: não há `selected` em lugar nenhum. **Artefato do método, não
   defeito** — e refutar antes de "corrigir" é a mesma disciplina do `<form>` aninhado que este
   arquivo já registra.

### As categorias de fornecedor viraram tabela — a terceira vez que este schema trata a mesma doença

Migrations `20260918010924` (tabela e vínculo) e `20260918010937` (semeadura). Fecha a pendência
que a seção acima registrou.

**É a mesma doença de `categoria` antes do plano contábil e de `centros_custo` antes de virar
tabela, na variante mais escondida das três**: as outras duas viviam no IndexedDB; esta vivia no
**`localStorage`**, por navegador. Dois operadores da mesma empresa tinham listas diferentes, e uma
categoria criada pelo "Gerenciar" numa máquina não existia em nenhuma outra. Foi exatamente assim
que `Convenios Associados` — a chave de todo o vínculo do associado PJ — ficou invisível para quem
não a tinha criado.

Cinco decisões valem como regra:

- **`fornecedores.categoria` (texto) NÃO é snapshot, e essa é a diferença que decide o desenho.**
  Em `despesas.centro_custo` e no `categoria` dos lançamentos o texto congela o que valia na época,
  porque aquilo é documento histórico. Aqui é classificação operacional: a categoria renomeada tem
  de aparecer com o nome de hoje na listagem, no filtro e no relatório. Então quem manda é
  `categoria_id`, e o texto acompanha — propagado por `propagarNomeParaFornecedores`, **num lugar
  só**. É o mesmo critério que `nomeDaEmpresaDoAssociado` já registra, aplicado na direção
  contrária. **Ao acrescentar uma coluna de nome ao lado de um id, escreva qual dos dois manda e
  o que acontece quando o nome muda** — as duas formas existem neste schema e parecem a mesma.
- **FK composta com `tenant_id`**, como manda a seção do plano contábil:
  `(tenant_id, categoria_id) → categorias_fornecedor (tenant_id, id)`, `ON DELETE RESTRICT`, com a
  `unique (tenant_id, id)` do lado referenciado. Exercitado em transação revertida antes de
  aplicar: apontar para categoria de **outra** empresa leva `23503`, e excluir categoria em uso
  também. Uma FK simples por `id` teria deixado as duas passar.
- **Nullable, e a empresa sem categoria nenhuma cai na lista modelo.** Uma empresa criada depois do
  backfill não tem linha em `categorias_fornecedor`; com `NOT NULL`, ou com um select vazio, ela não
  conseguiria salvar fornecedor nenhum, porque `categoria` é obrigatória no formulário.
  `nomesDeCategoriaParaSelecao` devolve `CATEGORIAS_FORNECEDOR_PADRAO` nesse caso — mesma escolha do
  seletor de centro de custo e da isenção "empresa sem conta lançável" da fase 3: só se exige o que
  é possível cumprir.
- **Nenhum índice avulso por `tenant_id` na tabela nova.** As três `UNIQUE` já começam por ele, e um
  `idx_..._tenant` seria byte a byte redundante — a armadilha da migration `20260910012513`, em que
  `CREATE INDEX IF NOT EXISTS` casou pelo **nome** e nove pares idênticos conviveram por meses.
  Conferido em `pg_indexes` por definição antes de criar.
- **A policy declara `TO authenticated`.** Omitir o `TO` deixa `public`, que inclui `anon`, e
  `has_tenant_access(NULL)` é permissivo por construção (ver "O papel `public` na policy inclui o
  anônimo"). `centros_custo` nasceu sem o `TO` e precisou da migration `20260914134717` para
  consertar; tabela nova já nasce certa.

**O que a migration não consegue trazer, de propósito**: uma categoria que alguém criou pelo
"Gerenciar" e nunca usou em fornecedor nenhum. Ela existia só no `localStorage` daquele navegador,
fora do alcance do SQL — e, por definição, era invisível para todo o resto da empresa. O backfill
semeia o que **aparece em `fornecedores.categoria`** mais a lista modelo, e isso cobre tudo que
alguém além daquele navegador chegou a ver.

**A derivação do código foi para `utils/codigoDeNome.ts`**, compartilhada com
`codigoDeCentroCusto`, porque o `translate()`/`regexp_replace` das migrations gera **exatamente o
mesmo código de propósito**: divergir faz o app criar categoria duplicada em vez de reaproveitar a
que a migration criou. Há teste travando os 12 códigos da lista modelo contra o que o backfill
produziu em produção.

**A foto pegou um defeito que nenhuma asserção acusaria**: a etiqueta `(desativada)` ficava
**dentro** do span com `truncate`, então era a primeira coisa cortada — sumia justamente o que a
linha existe para dizer, e sobrava o nome, que já estava visível. Foi para fora do span, com
`shrink-0`. **Rótulo de estado nunca compartilha a caixa que trunca com o texto variável.**

O modal novo vai ao `document.body` por `createPortal`: é renderizado dentro do `<form>` do
formulário de fornecedor, que por sua vez está dentro de um overlay com `backdrop-blur` — as duas
armadilhas que este arquivo já documenta, resolvidas de uma vez. O teste não procura o conteúdo no
documento (isso passaria nos dois casos): ele exige que o pai do overlay seja o `body` e que
`closest('form')` seja nulo.

**Achado incidental, corrigido junto** (migration `20260918010947`): o `CHECK` de
`fornecedores.status` só conhecia `'ativo'` e `'inativo'`, mas o formulário oferece "Bloqueado /
Suspenso" desde sempre e `StatusFornecedor` declara os três. Salvar um fornecedor bloqueado falhava
com `23514`, e **nenhum fornecedor com esse status jamais existiu**. É a mesma classe do `CHECK` de
`requisicoes.status` que não conhecia `'emitida'` — opção que a tela oferece e o banco recusa. A
diferença é que aqui o erro ao menos chegava ao operador, porque `useFornecedores` lança; lá havia
um retry que gravava com outro status e escondeu o defeito por meses.

**`tipos_fornecimento` era outro defeito, e a correção foi tirar a ação** — ver a seção seguinte.


### O relatório da carteira: a cor tem de sair do dado, nunca da posição

Pedido de 18/09/2026: pôr no papel o que a aba **Associados & Mensalidades** mostra, no padrão
dos relatórios de Associados e Atendimentos. `utils/relatorioCarteiraConveniada.ts` decide
**o quê** e as três saídas — prévia em tela, janela de impressão e `jsPDF` — decidem só **como**,
como manda a seção da Ficha de Cadastro.

**Este módulo não soma nada.** Os totais vêm prontos de `montarCarteiraEmpresaConveniada`, que é
a mesma fonte da tela. Recalcular abriria espaço para o papel discordar do que o operador acabou
de ver, e as duas contas pareceriam igualmente corretas.

Quatro decisões valem como regra:

- **A máscara é a dos relatórios FINANCEIROS** (`mascararDocumento`, `***.537.031-**`), não a do
  relatório cadastral de associados (`mascaraCpfLGPD`, `046.***.***-40`). As duas existem neste
  projeto, e o CLAUDE.md já fixa qual vale para cada classe. Aplicada **na montagem do item**,
  não em cada renderizador: são três saídas lendo o mesmo campo.
- **A cor sai do tipo da parte, nunca do índice da linha dentro da célula.** A primeira versão
  coloria verde a primeira linha e âmbar a segunda — o que acerta só quando a célula tem os dois
  valores. **Num mês que só tinha parcela em aberto, o valor saía verde**, afirmando que o
  dinheiro entrou. Por isso `CelulaRelatorio` ganhou `partes: {texto, tipo}[]` e os renderizadores
  perguntam ao dado. Há teste travando os três casos (só recebido, só aberto, os dois).
- **A largura das colunas mora na função pura, com os 12 meses iguais.** Sem largura declarada o
  navegador dimensiona por conteúdo, e o mês **vazio** encolhe: na primeira foto `Fev` saiu com
  34px contra 74px de `Jan`. Num relatório que se lê varrendo a linha, coluna de mês com largura
  variável desalinha o olho a cada registro. `larguraColuna` alimenta o `<colgroup>` da prévia e
  o da impressão; o índice é posicional, como o `columnStyles` do `autoTable`.
- **A grade mensal não repete o `R$`; o total e o resumo mantêm.** Na grade o símbolo apareceria
  24 vezes por linha sem dizer nada de novo — e, pior, `R$ 120,00` não cabia na largura de uma
  coluna de mês e empurrava a coluna, que era o que impedia os 12 meses de medirem igual. A
  unidade fica na legenda e nos KPIs. Nos totais há espaço, e são os números que alguém copia.

**O texto puro do PDF deriva das mesmas células** (`linhaParaTexto` chama `celulasDaLinha`), em
vez de uma segunda montagem paralela: é assim que as saídas param de discordar na primeira coluna
nova. Há teste cobrando que as duas formas devolvam o mesmo conteúdo, nos dois tipos.

**O emitente é a empresa do tenant do fornecedor**, carregada por `getEmpresaById(tenantId)` — não
a do seletor do topo. Mesma razão pela qual a carteira é consultada por `tenantId`: um cabeçalho
com o CNPJ de outra empresa faria o documento afirmar que foi emitido por quem não o emitiu. Falha
ao carregá-la não bloqueia o relatório — o cabeçalho cai para o nome padrão do sistema, que é
menos informação, não um documento errado.

**As duas saídas foram conferidas no navegador de verdade**, como manda "Conferindo a impressão
de verdade": a prévia fotografada no aninhamento real (dentro do `<form>` e do overlay com
`backdrop-blur`), e o HTML da janela de impressão capturado de um `window.open` dublê e renderizado
no Chromium — 12 meses com 44px cada, sem estouro horizontal, cores distintas para recebido e em
aberto, e o PDF fechando em **uma** página A4 paisagem. Os dois defeitos acima vieram dessa
conferência; nenhum teste de contagem os acusaria.


### O "Gerenciar" que não devia existir: nem toda lista no `localStorage` quer virar tabela

Fechado em 18/09/2026 (migration `20260918185138`). O campo **Tipo de Fornecimento** tinha o mesmo
"Gerenciar" das categorias, sobre a mesma lista guardada no `localStorage` — e a conclusão foi a
oposta: **aqui não há catálogo a manter, e a correção é remover a ação.**

O que separa os dois casos, e é o que vale como regra:

- **Categoria é um catálogo da empresa**: cada empresa tem a sua lista, o operador precisa
  acrescentar, renomear e desativar, e o nome é dado. Virou tabela.
- **Tipo de fornecimento é um domínio fechado de três valores** (`produtos`/`servicos`/`ambos`).
  Os rótulos são cravados no código, o filtro da listagem sempre ofereceu **só esses três** (nunca
  leu a lista do `localStorage`), e os cards de resumo contam `produtos`/`servicos`/`ambos`
  explicitamente. Um quarto valor criado pelo "Gerenciar" nasceria **sem rótulo, fora do filtro e
  fora dos contadores** — visível só na coluna crua da tabela. A lista não era a fonte do domínio;
  era uma cópia editável dele.

**Antes de mover uma lista para tabela, pergunte se alguém precisa editá-la.** Se os valores têm
rótulo, cor ou contador no código, a lista não é catálogo — é um `enum` com uma porta aberta, e a
porta é o defeito.

**O `CHECK` é a outra metade, e sem ele isto seria só o botão sumido.** `fornecedores.tipo_fornecedor`
**não tinha constraint nenhuma** — o domínio existia só no TypeScript. (A seção anterior afirmava
que "a coluna é um domínio fechado"; era o tipo que fechava, não o banco. Conferido em
`pg_constraint`: a tabela só tinha os `CHECK` de `status` e `tipo_pessoa`.) Sem o `CHECK`, a coluna
seguiria aceitando qualquer texto pela fila de sync, por um bundle antigo em cache de service worker
ou por qualquer chamador novo — é a regra que este arquivo já fixa em `utils/statusParcela.ts`:
**esconder o botão é conveniência; a recusa mora no ponto de escrita.**

Ensaiado em transação revertida antes de aplicar: os três valores passam, `'qualquer coisa'` leva
`23514`, `NULL` passa (a coluna é nullable, e um `CHECK` é satisfeito quando a expressão é nula), e
as 2 linhas existentes — ambas `servicos` — validam sob a constraint. Produção não tinha **nenhum**
valor inventado, o que confirma que ninguém chegou a usar aquele "Gerenciar" para valer.

Três coisas menores saíram junto, porque estavam no caminho:

- **`opcoesTipoFornecimento` preserva o valor já gravado fora do domínio.** Um fornecedor vindo do
  IndexedDB de um navegador que usou o "Gerenciar" continua abrindo com a seleção certa; sem isso o
  select perderia o valor e o save gravaria outro tipo em silêncio. Mesma escolha de
  `nomesDeCategoriaParaSelecao` e do seletor de conta contábil. `rotuloTipoFornecimento` segue a
  mesma linha: valor fora do domínio volta como está, em vez de virar vazio.
- **A listagem tinha estado morto.** `FornecedoresPage` declarava `tiposFornecimento`, carregava do
  `localStorage` num `useEffect`... e **nunca usava** — o filtro sempre teve os três `<option>`
  cravados. Ou seja, metade do "catálogo" já não alimentava nada.
- **`ListManageModal` foi removido.** Era o modal genérico que servia as duas listas; sem categoria
  (que ganhou gerenciador próprio) e sem tipos, ficou sem chamador.

Os rótulos, que estavam escritos em quatro lugares com palavras diferentes ("Produtos & Serviços",
"Produtos e Serviços", "Produtos e Serviços (Ambos)"), passaram para
`config/tiposFornecimento.config.ts`, com três formas nomeadas: `rotulo` (formulário), `rotuloCurto`
(card e tabela) e `rotuloFiltro` (o "Apenas ...", que é outra pergunta). **Ao acrescentar um valor
ao domínio, acrescente o `CHECK` na mesma tarefa** — é a regra do campo novo sem migration, na
direção contrária.

**Fora de escopo de propósito**: `FornecedorDetailsModal.getTipoFornecedorBadge` continua com o
próprio `switch`, porque ele carrega também a **cor** de cada tipo, que a config não modela.
Consolidar isso é passada própria, não parte de remover uma ação.


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
    como resolvido — só que das 8 funções que o advisor listava então como chamáveis por `anon`,
    **4** eram auxiliares de RLS, 2 de trigger e 2 não eram nem uma coisa nem outra. Ao
    classificar um alerta como esperado, **diga exatamente quais linhas** ele cobre.

    Estado de 14/09/2026, conferido: **4** funções chamáveis por `anon`, e são exatamente as
    quatro auxiliares de RLS (`has_tenant_access`, `current_tenant_id`, `current_user_nivel`,
    `is_super_admin`). A quinta que ainda aparecia — `get_user_profile()` — saiu na migration
    `20260914134717`; ver "O papel `public` na policy inclui o anônimo" abaixo. Daqui para
    frente, o alerta `anon_security_definer_function_executable` com **contagem 4** é o
    esperado: qualquer número maior é função nova para examinar, não ruído.
### As permissões por módulo passaram a valer no servidor (migration `20260919001244`)

Achado na análise de 18/09/2026. A tela de Configurações concede módulos e submódulos por
usuário, com granularidade fina, e **nada disso chegava ao banco**: das 41 policies, **zero**
consultavam `modulos_permitidos` e apenas 2 (ambas em `users`) consultavam `current_user_nivel()`.
Todas as demais perguntavam uma coisa só — o registro é da sua empresa?

**Provado, não deduzido.** Simulando o JWT real do gerente KAUA (que tem apenas os módulos de
Associados) dentro de transação revertida: ele leu 24 parcelas a receber, 2 receitas, 3
movimentações de caixa e 14 linhas de auditoria, e o **`UPDATE` nas 24 parcelas foi aceito**. A
chave anônima está no bundle — isso é alcançável por qualquer autenticado via `/rest/v1`, sem
passar pela tela que esconde o botão.

#### O mapa completo tabela→módulo era o desenho óbvio, e teria quebrado produção

Vale como regra antes de qualquer mudança de RLS deste tipo: **um módulo é agrupamento de
navegação, não fronteira de dados.** Seis dos catorze arquivos que criam receita/parcela vivem
**fora** das telas de financeiro — gerar mensalidade e receber parcela (dentro do cadastro do
associado), reativar associado, atendimento e contrato com cobrança, e guia com co-participação.

Amarrar `receitas` ao módulo `financeiro` tiraria do KAUA justamente as operações centrais do
módulo que ele **tem**. Conferido usuário a usuário antes de decidir: dos 8, quatro têm o curinga
`'*'` (3 admins + super_admin) e três funcionários têm `associados` **e** `financeiro` — KAUA era
o único afetado, e seria afetado no lugar errado. **Ao apertar RLS, meça quem perde o quê antes
de escolher o corte**; o desenho mais completo não é o que entrega mais segurança se ele derruba
uma operação legítima.

#### O corte que entrou

- **A escrita exige o módulo; a leitura continua por empresa.** Duas policies por tabela:
  `<t>_select_policy` (cmd `SELECT`, empresa) e `<t>_write_policy` (cmd `ALL`, empresa **e**
  módulo). Como policies permissivas são OR, em `SELECT` as duas são avaliadas e o resultado é
  "empresa"; em `INSERT`/`UPDATE`/`DELETE` só a segunda se aplica. Nenhuma tela perde dado que já
  mostrava — e é isso que torna a mudança segura de aplicar sem UI logada para conferir.
- **Só as tabelas em que o módulo é fronteira real**: `planos_pax` (+faixas, +coberturas) →
  `planos`; `credenciados` (+planos, +procedimentos, `procedimentos`, `remessas_faturamento`) →
  `credenciados`; `itens_funerarios`; `fornecedores` e `categorias_fornecedor` → `administracao`;
  `documentos_padroes` → `configuracoes`; `planos_contabeis`, `contas_contabeis` e `centros_custo`
  → `financeiro`. `associados` e o resto do financeiro seguem um domínio só, porque de fato são.
- **`auditoria` passou a ser por NÍVEL e append-only.** Leitura só para `admin`/`super_admin` — a
  regra que a própria tela anuncia desde 15/09, e nenhum funcionário ou gerente tem o módulo
  `auditoria`, então não se tirou nada alcançável. **Sem policy de `UPDATE` nem de `DELETE`**: com
  RLS ligada, o que nenhuma policy permite é negado. Conferido no `src/` antes de fechar — existem
  exatamente um `SELECT` e um `INSERT` sobre a tabela, nada reescreve nem apaga.

#### Três detalhes que valem como regra

- **`DROP` + `CREATE` foi inevitável aqui, e por isso cada `CREATE` declara `TO authenticated`.**
  Este arquivo prefere `ALTER POLICY` justamente para não deixar cair o papel — mas `ALTER` não
  muda o `cmd`, e a mudança **é** o `cmd`. A conferência que fecha o risco é contar depois:
  **0 policies fora de `authenticated`**, de 58.
- **`tem_modulo(text)` recebe um literal constante, não uma coluna** — então, ao contrário de
  `has_tenant_access(tenant_id)`, a chamada não depende da linha e **vai dentro de `(select ...)`**.
  O critério que a seção do `auth_rls_initplan` fixa é "não depender da linha", e um argumento
  constante não cria dependência.
- **Ela é revogada de `PUBLIC` e de `anon`.** Todas as policies que a usam são `TO authenticated`,
  então o anônimo nunca a avalia — e revogar mantém o advisor
  `anon_security_definer_function_executable` em **4**, a contagem que este arquivo fixa como
  esperada. Conferido depois de aplicar: continua 4, e as 4 são as auxiliares de RLS. O advisor de
  `authenticated` subiu de 10 para 11, que é o esperado: a função precisa desse `EXECUTE` para as
  policies serem avaliáveis.

#### Resultado conferido em produção, por usuário

| | escreve plano | escreve fornecedor | escreve associado | lê auditoria |
|---|---|---|---|---|
| 3 admins + super_admin (`'*'`) | sim | sim | sim | 14 / 204 / 204 / 582 |
| GIZELLE (tem `planos` e `administracao`) | sim | sim | sim | **0** |
| PAOLA (tem `administracao`) | **não** | sim | sim | **0** |
| WELLITON (não tem nenhum dos dois) | **não** | **não** | sim | **0** |
| KAUA, gerente (só Associados) | **não** | **não** | **sim** | **0** |

A última coluna da direita é a que importava: **todos continuam gravando associado**, inclusive
KAUA. E as leituras de `planos_pax` e `parcelas_receber` ficaram idênticas às de antes.

**Limite conhecido, de propósito**: a pré-sincronização de `planos_pax` em `saveAssociado` passa a
ser recusada para quem não tem o módulo `planos`. Ela só dispara quando o plano existe **apenas**
no IndexedDB, o que exige tê-lo criado — e criar plano já pede o módulo. Se acontecer, o `warn`
dela cai e a FK do associado devolve a mensagem certa, dizendo que o plano não existe.

### O papel `public` na policy inclui o anônimo — e é o papel que barra, não o predicado

Levantamento de 14/09/2026, pedido como "verificar as pendências de Auth". O que barra quem
não fez login neste schema **não é `has_tenant_access`**: são os papéis. 38 das 41 policies
eram `TO authenticated`, e o `anon` nem chegava a ser avaliado. Três — `planos_contabeis`,
`contas_contabeis` e `centros_custo`, do módulo contábil — eram `TO public`, e **`public`
inclui `anon`**.

Nelas o anônimo chegava ao predicado. Ler, não lia (as três colunas são `NOT NULL` e
`has_tenant_access('<valor>')` é falso sem JWT), mas **o `WITH CHECK` passava**:

```sql
-- a terceira cláusula de has_tenant_access
OR (record_tenant_id IS NULL AND current_tenant_id() IS NULL)
```

Sem login os dois lados são nulos, então `has_tenant_access(NULL)` é **verdadeiro para o
anônimo**. O insert só era recusado pelo `NOT NULL` da coluna — `23502`, não `42501`. Uma
constraint de coluna era a única coisa entre um anônimo e uma escrita. Corrigido na migration
`20260914134717`, pondo as três em `TO authenticated` como as outras 38.

Três coisas valem como regra:

- **Policy nova declara o papel.** Omitir o `TO` deixa `public`, que inclui `anon` — e o
  predicado deste schema não foi escrito para recusar quem não tem JWT. O `TO authenticated`
  é a convenção de 41 das 41 policies agora; ao criar tabela nova, copie isso junto.
- **`has_tenant_access(NULL)` é permissivo por construção, e isso é uma armadilha adormecida.**
  A cláusula existe para o caso "registro global, sem empresa" — legítima para um usuário
  logado sem tenant. Para o anônimo ela vira um curinga. Hoje inofensiva porque nenhuma tabela
  com `tenant_id` nulável tem policy alcançável por `anon`; **11 tabelas deste schema têm
  `tenant_id` nulável**, então a distância entre inofensivo e vazamento é uma policy mal
  declarada.
- **O sintoma de um teste diz qual guarda agiu.** `23502` é a coluna recusando; `42501` é a
  policy. Ao verificar isolamento, insira com um valor **válido** na chave de tenant: com
  `NULL` a constraint responde antes da policy e o teste passa sem provar nada. Foi essa troca
  de `23502` por `42501`, no ensaio revertido, que mostrou que a correção mudou o que precisava
  mudar.

O ensaio seguiu a regra desta seção (permissão cujo caminho de falha é silencioso se testa
dentro do rollback antes de aplicar): depois da mudança o anônimo leva `42501` nas três
tabelas e em `get_user_profile()`, e o admin logado continuava lendo os 2 planos, 58 contas e
7 centros da empresa dele — e 0 da outra.

`get_user_profile()` saiu na mesma migration: era a única `SECURITY DEFINER` chamável por
`anon` fora das quatro auxiliares de RLS. Não era explorável (filtra por `auth.uid()`, devolvia
0 linhas com 7 usuários cadastrados), mas **nenhuma linha do `src/` a chama** — superfície
exposta sem nada do outro lado. Revogada de `PUBLIC` **e** de `anon`, porque a ACL era
`=X/postgres` mais grants explícitos e revogar de um lado só deixaria a herança valendo.

### Chamada sem argumento na policy vai dentro de `(select ...)` — a com argumento não vai

Última pendência de performance da série, aberta desde a 15ª rodada e fechada na migration
`20260915130747`. O advisor `auth_rls_initplan` apontava 7 policies — as 4 de `users` e 3 das 4
de `notificacoes` — em que o Postgres reexecutava `auth.uid()` **uma vez por linha** em vez de
uma vez por consulta. A correção que ele indica é envolver a chamada em `(select ...)`: um
subselect sem referência à linha vira `InitPlan`, avaliado uma única vez.

Três coisas valem como regra:

- **O critério é ter argumento, não ser do schema `auth`.** O advisor só enxerga `auth.<fn>()` e
  `current_setting()`, mas o que decide é outra coisa: uma chamada **sem argumento** não depende
  da linha e pode ser içada. Por isso entraram junto `is_super_admin()` e `current_user_nivel()`,
  que o advisor não lista — e são as caras, porque cada uma é `SECURITY DEFINER` (logo **não
  inlinável** pelo planner) e pode acabar consultando `public.users`. Já
  `has_tenant_access(tenant_id)` recebe a coluna: depende da linha por construção e **fica como
  está**.
- **Inlinar `has_tenant_access` para hoistar o resto seria trocar um custo por um vazamento.** O
  corpo dela é hoistável (`is_super_admin() OR record = current_tenant_id() OR ambos NULL`), e
  copiá-lo para dentro das 7 policies deixaria tudo em `InitPlan`. Mas poria a regra de tenant em
  7 lugares novos, e a próxima mudança nela — já houve uma, a que tirou os coringas — passaria ao
  largo dos 7. **A função continua sendo a fonte única**; o custo por linha que sobra é o preço
  disso, e está medido abaixo.
- **`ALTER POLICY`, nunca `DROP` + `CREATE`.** `ALTER` mexe só em `USING`/`WITH CHECK` e preserva
  `cmd` e `roles` — as 8 seguem `TO authenticated`, a convenção que a seção anterior acabou de
  estabelecer para as 41. Recriar uma policy é a chance de deixar cair o `TO` e voltar a `public`,
  que inclui `anon`.

**O ganho foi medido nos dois extremos, com 2.000 e 20.000 linhas sintéticas inseridas dentro de
uma transação revertida** — a tabela real tem 51 linhas e não responderia nada. Os dois números
importam, e o segundo é o que este arquivo costuma esquecer de registrar:

- Linha que casa numa cláusula içada (é do próprio usuário, ou o usuário é super_admin):
  **2.653 ms → 25 ms** em 20 mil linhas, ~105×.
- Linha que **obriga** `has_tenant_access(tenant_id)` a rodar (mesma empresa, outro usuário):
  **1.361 ms → 808 ms** em 2 mil linhas, só ~1,7×. Os 808 ms restantes são a função por linha, e
  esta correção não os toca.

Ou seja: o advisor ficou zerado e o pior caso continua caro. **Fechar o alerta não é o mesmo que
resolver o problema** — vale lembrar disso antes de marcar o próximo como esperado.

A oitava policy (`notificacoes_insert_policy`) entrou sem estar no advisor: o `WITH CHECK` dela é
**a mesma expressão** do `WITH CHECK` da `notificacoes_update_policy`, que mudou. Em `INSERT` não
há ganho nenhum — o motivo é só não deixar duas cópias do mesmo predicado começarem a divergir.

O ensaio antes de aplicar seguiu o formato das duas rodadas anteriores: dentro de um `rollback`,
as policies novas foram postas no lugar e a visibilidade de `users` e `notificacoes` foi contada
**para os 8 usuários reais, nos 4 níveis** — comparando não só a contagem mas o conjunto de ids.
16 de 16 idênticas, antes e depois. Um timeout no meio do caminho derrubou uma das transações de
medição, e a conferência seguinte (51 linhas, 0 sintéticas, 0 policies alteradas) é o que provou
que o `rollback` de fato aconteceu — **ao ensaiar em produção, confira o desfazimento também
quando o ensaio falha**, não só quando ele termina.

### Pendências de Auth que dependem do painel, não de migration

O advisor `auth_leaked_password_protection` está **aberto e não se resolve por SQL**: é um
toggle em *Authentication → Sign In / Providers → Password*. Ligado, o Supabase recusa senha
que já apareceu em vazamento conhecido (consulta ao HaveIBeenPwned).

Registrado aqui porque o contexto pesa mais que o alerta isolado: em 14/09/2026 o projeto tem
**8 usuários no `auth.users`, nenhum com MFA**, 1 super_admin, e `admin_alterar_senha_usuario`
permite que um admin troque a senha de outro. A senha é a única barreira que existe.

Dois achados operacionais da mesma varredura. O primeiro **foi corrigido**; o segundo fica
para decisão de produto.

**O usuário que autenticava e não existia no app.** `empresa.eras@gmail.com` estava em
`auth.users` desde 17/08, com e-mail confirmado e login em 30/08, **sem linha em
`public.users`** — exatamente o caminho de falha silenciosa que a nota do `handle_new_user`
descreve acima, acontecido de verdade.

A causa saiu do carimbo de hora, não de suposição: o trigger nasceu na migration
`20260817160000`, às **16:00** de 17/08; esse usuário se cadastrou às **15:25:36**, 34 minutos
antes. Ele é o único do projeto anterior ao trigger que ficou sem linha.

E a correção **não exigiu decisão nenhuma**: `raw_user_meta_data` já trazia `nome`, `nivel`
(`admin`) e `tenant_id` (PAX e Funerária Taquari) gravados no cadastro — os mesmos campos que
o trigger lê. A linha foi criada replicando o `INSERT` do próprio `handle_new_user` **a partir
do metadata**, com duas diferenças deliberadas: `created_at` recebeu a data real do cadastro no
Auth em vez de `now()`, para a linha não afirmar que nasceu meses depois; e `empresa_id` ficou
`NULL`, como o trigger deixa (o app só o lê como fallback quando falta `tenant_id`, e o outro
admin da mesma empresa também o tem nulo).

**A regra**: quando um cadastro de Auth aparece sem perfil, o `raw_user_meta_data` costuma
guardar a intenção original — leia dali antes de perguntar qual empresa e qual nível. Escolher
por conta própria é o que transforma um reparo em decisão de acesso.

Conferido depois, simulando o login real (`SET ROLE authenticated` + `sub` no JWT): o perfil
volta `admin`, `current_tenant_id()` é a empresa certa, `is_super_admin()` é falso, ele lê os
2 associados / 24 parcelas / 29 contas da empresa dele e **0 da outra**.

**Ainda aberto**: dois cadastros de 11/09 (`welliton.francisco05@`, `gizelledejesus.1995@`)
estão sem e-mail confirmado e nunca logaram. Aí não há metadata que resolva — é cadastro pela
metade, e cabe decidir se reenvia o convite ou remove. O reenvio deixou de depender de painel:
virou botão na tela (ver a seção seguinte).

### O serviço de e-mail embutido é 2 por hora e só entrega para a organização

Medido em 16/09/2026, depois de dois destravamentos de acesso no mesmo dia. Os três números
abaixo saíram do log do GoTrue, não da documentação, e cada um explica um sintoma que já tinha
sido lido como outra coisa:

- **A cota é de 2 e-mails por hora, e ela é do projeto inteiro.** Dois `mail.send` às 14:27:36 e
  14:29:10 (os dois reenvios de confirmação) foram suficientes para o `/recover` seguinte,
  às 14:36:30, levar `429: email rate limit exceeded`. Quem tentou recuperar a senha não tinha
  mandado e-mail nenhum — pagou pela cota que **outra** operação gastou sete minutos antes.
- **Sem SMTP próprio, o Supabase só entrega para endereços que são membros da organização**;
  os demais falham com *"Email address not authorized"*. É a explicação mais provável para
  `welliton.francisco05@` ter ficado com `confirmation_sent_at` **nulo desde o cadastro de
  11/09** até o reenvio manual de 16/09 — o e-mail do cadastro nunca chegou a sair, e nada na
  tela disse isso.
- **O link de confirmação vence, e isso é outra configuração.** O link gerado às 14:29:10 foi
  clicado quatro vezes entre 20:04 e 20:08 e todas devolveram `email link has expired`: a
  validade é **menor que 5h35**. Trocar de provedor de SMTP não mexe nisso — a expiração fica em
  *Authentication → Providers → Email OTP Expiration*. **Um operador que abre o e-mail no fim do
  expediente clica num link vencido**, e o sintoma na tela é o mesmo de um link inválido.

### `Email not confirmed` significa que a senha estava certa

Regra de diagnóstico que resolveu os dois casos de 16/09 e que não é óbvia pelo nome dos erros:
o GoTrue **confere a senha antes de olhar o estado de confirmação**. Então, em `/token`:

- `400: Invalid login credentials` ⇒ a senha está errada. O estado da confirmação nem foi
  consultado, e insistir em confirmar o e-mail não resolve.
- `400: Email not confirmed` ⇒ **a senha está certa**. Falta só a confirmação.

Foi o que separou os dois casos que pareciam iguais: uma funcionária com 29 tentativas, todas
`Invalid login credentials` e **nenhuma** `Email not confirmed` — senha desconhecida, e o e-mail
já estava confirmado; e um funcionário com três `Email not confirmed` — senha correta, faltava
só o clique que o link vencido não deixava dar. **Antes de redefinir uma senha, leia qual dos
dois erros o log mostra**: redefinir a senha de quem já sabe a senha troca um problema resolvido
por um problema novo.

### Cadastro de usuário pela metade: o sistema tem a informação, faltava alguém perguntar

Pedido de 14/09/2026, depois do reparo acima. Um cadastro nasce em **dois lugares** — a
credencial em `auth.users` e o perfil em `public.users` — e nenhum dos dois avisa quando o
outro não acontece. Os dois estados já aconteceram de verdade e nenhum apareceu em tela
nenhuma: `empresa.eras@gmail.com` autenticou 28 dias sem perfil, e dois convites de 11/09
ficaram sem confirmação. Em ambos o banco sabia; ninguém perguntava.

**A pergunta só existe do lado do servidor.** `auth.users` não é legível por `authenticated`,
e é lá que moram `email_confirmed_at`, `last_sign_in_at` e o `raw_user_meta_data`. Daí a RPC
`listar_cadastros_incompletos()` (migration `20260914141704`), `SECURITY DEFINER` com
`search_path` fixo, revogada de `PUBLIC` **e** de `anon`. Ela mesma decide o escopo — tudo
para super_admin, a empresa para admin, **nada** para os demais níveis —, então o cliente não
tem permissão para checar nem para errar. Ensaiado em transação revertida com os cinco papéis
antes de aplicar: o admin da PAX vê os dois pendentes dele, o admin da outra empresa vê zero,
o `funcionario` vê zero, o super_admin vê tudo, e o anônimo leva `42501` — a policy recusando,
não uma coluna.

Quatro decisões valem como regra:

- **A FK já respondia metade da pergunta.** A primeira versão era um `FULL OUTER JOIN`, para
  também achar "perfil sem credencial". Esse estado é **impossível**: `public.users.id`
  referencia `auth.users(id) ON DELETE CASCADE`. Virou `LEFT JOIN` a partir de `auth.users`.
  Antes de escrever a consulta que procura um estado inconsistente, **veja se alguma
  constraint já o proíbe** — senão o código passa a carregar uma pergunta que o schema fechou.
- **"Nunca acessou" não é pendência**, e isso é o que separa aviso de ruído. Quem tem perfil e
  convite confirmado e ainda não entrou não tem nada faltando *no sistema* — falta ele entrar,
  e não há ação do admin. Listar isso encheria o aviso de linhas sobre as quais não há o que
  fazer, e é assim que se aprende a não ler o aviso. `ja_acessou` continua no tipo como
  **contexto** de uma pendência real.
- **O título do aviso é constante; a contagem vive na mensagem.** Com o número no título, o
  admin resolver um cadastro produziria um assunto novo e a rotina perderia o rastro do aviso
  anterior — voltaria a avisar do zero a cada mudança, que é a armadilha do seeding de
  boas-vindas que este arquivo já registra. `avisoDeCadastrosJaEnviado` compara o conteúdo com
  o **último** aviso do mesmo título, **incluindo os que o admin já apagou**: incluir os
  apagados impede o aviso de renascer a cada carregamento (foi o que acumulou 24 notificações
  para um usuário, 22 já excluídas), e comparar com o último é o que faz um cadastro que
  regride voltar a avisar. Quem dispensou sem resolver continua com a lista completa em
  Configurações → Usuários, que é a superfície durável; a notificação é o toque no ombro.
- **Aqui o offline-first não se aplica, de propósito.** `getCadastrosIncompletos` devolve
  lista vazia offline em vez de ler cache. Guardar isso no IndexedDB espalharia e-mails e
  níveis de acesso por cada navegador, e o cache velho diria "há 2 pendências" depois de as
  duas terem sido resolvidas. **Aviso errado é pior que nenhum**; a resposta honesta offline é
  "não sei".

**O painel fica acima da tabela de usuários, e não é uma coluna dela** — porque o caso mais
grave **não está na tabela**: um cadastro sem perfil não existe em `public.users`, então
nenhuma linha o representa. Foi exatamente assim que `empresa.eras@gmail.com` passou 28 dias
invisível: a tela mostrava tudo certo porque só sabia olhar para onde ele não estava.

Cada linha traz os botões da pendência que ela tem: **Criar perfil** (que lê nome, nível e
empresa do `raw_user_meta_data`, como manda a regra do reparo acima, e grava `created_at` com
a data real da credencial) e **Reenviar convite** (`supabase.auth.resend`, que vale com a
chave pública — não precisa de `service_role`, então o admin resolve da tela em vez de pedir
acesso ao painel do Supabase). As duas **propagam a recusa do servidor**: um "reenviado com
sucesso" sobre um limite de envio estourado faria o admin marcar a pendência como resolvida
enquanto ela continua lá — a armadilha do `saveAtendimento`, de novo.

A foto do painel (jsdom + Chromium com o CSS do build, como manda "Conferindo a impressão de
verdade") pegou dois defeitos que nenhuma asserção acusaria: o cadastro sem nome no convite
imprimia o e-mail **duas vezes** (o identificador cai para o e-mail, e a linha o repetia ao
lado), e a coluna de ações quebrava os rótulos em duas linhas justamente na linha com os dois
botões. A largura fixa da coluna precisa ser dimensionada **pelo caso mais cheio** — senão ela
quebra exatamente onde há mais o que fazer.


### Trocar a própria senha: a sessão aberta não é credencial suficiente

Pedido de 16/09/2026, a partir da área de logoff do topo. O vão foi medido no banco antes
de escrever código, e é maior do que "falta um atalho": das 8 contas, **PAOLA
(`funcionario`) e KAUA (`gerente`) não têm `configuracoes` em `modulos_permitidos`** — para
elas não existia caminho nenhum dentro do app, só o e-mail de recuperação. As outras seis
chegavam pela aba que edita **todo mundo**, que não é onde alguém procura a própria conta.

**A senha atual é a regra central, e ela não existe por hábito de formulário.**
`supabase.auth.updateUser({ password })` não pede a senha antiga: para o servidor, **uma
sessão aberta basta**. Sem a conferência, quem sentar na máquina destravada de um operador
troca a senha dele e o tranca para fora sem saber senha nenhuma — e o sistema roda o dia
inteiro em balcão de atendimento. `alterarPropriaSenha` confere antes, e a recusa mora no
service, não no botão.

Quatro decisões valem como regra:

- **A conferência usa `isolatedSupabase`, e o `signOut` dela leva `scope: 'local'`
  explícito.** Um `signInWithPassword` no cliente principal **substituiria a sessão em
  uso**; por isso o cliente sem persistência, que já existia para o cadastro de usuário não
  deslogar o admin. E o `signOut()` do supabase-js tem **`scope: 'global'` por padrão** —
  revogaria todas as sessões daquele usuário, inclusive a que está usando o sistema naquele
  instante e as dos outros aparelhos. O padrão da biblioteca é justamente o que não se quer
  aqui, então há teste travando o argumento. **Ao chamar `signOut` fora do logout de
  verdade, declare o escopo.**
- **A senha não é aparada em lugar nenhum.** `AuthContext.signIn` manda ao servidor
  exatamente o que foi digitado, sem `trim`; aparar na troca gravaria uma senha diferente da
  que o login vai enviar, e o usuário ficaria trancado para fora **com a senha que ele mesmo
  acabou de escolher**. (`saveUsuario` apara — é inconsistência antiga, do caminho do admin,
  deixada como está de propósito: mexer nela muda o cadastro de usuário, que é outra
  decisão.)
- **O mínimo é 6, igual ao resto do sistema, e a força é dica que nunca bloqueia.** Exigir
  8 aqui recusaria uma senha que um admin pode gravar para o mesmo usuário pela tela de
  Configurações — duas guardas discordando sobre a mesma coisa é como as metades divergem.
  `forcaDaSenha` fica fora do caminho de gravação; quem decide se a troca segue é
  `validarTrocaDeSenha`.
- **Offline recusa, não enfileira.** Uma troca de senha na fila de sync ficaria pendente sem
  ninguém saber, e o operador sairia da tela convencido de que a senha mudou. É a mesma razão
  de `getCadastrosIncompletos` não ler cache: resposta errada é pior que nenhuma.

O e-mail usado na conferência vem de `supabaseUser` (Auth), não de `state.user` (o perfil em
`public.users`): é contra `auth.users` que o `signInWithPassword` roda, e são duas tabelas
que podem discordar. A recusa do servidor chega inteira à tela e **o formulário continua
aberto com o que foi digitado** — um "erro ao alterar" genérico não diz se o problema foi a
senha atual, a política de senha ou a rede. A senha nunca entra em `auditoria.detalhes`; há
teste cobrando isso, não só a intenção.

**A área de logoff virou menu**, e isso troca um clique por dois de propósito: o botão único
deslogava na hora, e ele fica ao lado de telas com formulário aberto. `Alterar minha senha` e
`Sair do sistema` ficam no mesmo lugar onde o usuário já procurava sua conta, e sair continua
passando pela confirmação que já existia.

**A foto pegou dois defeitos que nenhuma asserção acusaria** (jsdom + Chromium com o CSS do
build, como manda "Conferindo a impressão de verdade"): o medidor de força estava desenhado no
fim do formulário, encostado em "Repita a nova senha" — **medindo a nova senha e parecendo
medir a confirmação** —, e o cabeçalho do menu repetia, truncado, o mesmo nome que aparece
inteiro no botão logo acima. O medidor foi para junto do campo que ele mede (com teste
travando a posição, não só o texto) e o cabeçalho ficou só com o e-mail. É a lição do painel
de cadastros pela metade valendo de novo: **não repita ali o identificador que já está na
linha de cima.**


### O predicado da tela precisa ser o mesmo do banco — e a divergência só aparece ao salvar

Descoberto em 16/09/2026, ao redefinir a senha de uma funcionária que não conseguia
entrar. `canChangeUserPassword` liberava **`admin` sobre qualquer nível abaixo de
super_admin**; a RPC `admin_alterar_senha_usuario`, que é quem de fato grava, tem outra
regra:

```sql
IF v_current_nivel = 'super_admin' OR v_current_user_id = target_user_id THEN
```

Ou seja: o admin **via o campo, digitava a senha, salvava e só então** levava
`Permissão negada`. Nada na tela dizia que aquilo não ia dar certo — é a mesma classe do
`empresa_padrao` e do `'system'`: duas metades afirmando coisas diferentes sobre a mesma
pergunta, e quem descobre é o operador, no pior momento.

O frontend foi alinhado ao banco (a decisão foi do usuário; o outro caminho seria mexer na
função, e aí ela precisaria passar a checar `tenant_id`, que hoje não checa — um admin
poderia redefinir senha de usuário de **outra** empresa).

Três coisas valem como regra:

- **Tirar a permissão do predicado não basta: sem uma recusa explícita no ponto de
  escrita, a senha passa a ser DESCARTADA EM SILÊNCIO.** O `saveUsuario` tinha
  `if (próprio) … else if (super_admin || admin) …` e mais nada. Removido o `admin` da
  segunda condição, ele cairia fora dos dois ramos, o `upsert` do cadastro seguiria
  normalmente e a tela diria "usuário salvo com sucesso" — com a senha antiga intacta. É
  a armadilha do `PGRST204` que este arquivo documenta, chegando por outra porta. Por isso
  o guard novo lança `MENSAGEM_SENHA_SEM_PERMISSAO` **antes** dos dois ramos, e há teste
  cobrando que nem a RPC, nem o `updateUser`, nem o `upsert` sejam chamados.
- **O teste compara as duas metades, não repete a regra.** `permissions.test.ts` declara a
  guarda do banco como função e varre **todos os 16 pares de níveis** exigindo igualdade.
  Um teste que só listasse os casos esperados passaria a mentir no dia em que alguém
  mudasse a RPC; este falha se as metades divergirem de novo em qualquer direção.
- **O campo que some precisa dizer por quê.** Antes o ramo era `: null` — para quem não tem
  direito, o campo simplesmente não existia, e o admin voltaria a procurá-lo achando que é
  falha da tela. Agora há uma nota explicando quem redefine e lembrando que o próprio
  usuário troca a dele pelo menu do topo. O texto de ajuda do campo, curiosamente, **já
  descrevia a regra do banco** ("Como Super Admin, você pode redefinir…"): a cópia estava
  certa e o predicado é que era largo.

O `try/catch` que envolvia a RPC saiu junto. Ele reembrulhava o erro em
`err.message || 'Erro ao alterar a senha…'` e continha um `fallback` para `updateUser`
**dentro do ramo em que o alvo nunca é o próprio usuário** — ramo morto que, se algum dia
fosse alcançado, trocaria a senha de quem está logado em vez da senha do alvo.


### `backdrop-filter` no cabeçalho prende o `fixed` do modal — e a foto isolada não vê isso

Relato da UI em 16/09/2026, com a foto da tela: o modal de alterar senha abria **grudado no
topo e cortado** — o título e o campo "Senha atual" ficavam acima da viewport —, e o fundo
escurecido cobria só uma tira no alto da página.

A causa é de CSS, não de React: **um elemento com `backdrop-filter` vira bloco de contenção
para descendentes `position: fixed`** (vale também para `transform`, `filter`, `perspective`,
`contain` e `will-change`). O `<header>` do Topbar é
`bg-bg-base/80 backdrop-blur-xl ... sticky top-0`, e o `AlterarSenhaModal` era renderizado
dentro dele. Resultado: o `fixed inset-0` do modal resolvia contra a faixa de **64px** do
cabeçalho em vez da janela, então `items-center justify-center` centralizava dentro daquela
tira e o resto vazava para fora.

A correção é `createPortal` para o `document.body` — o que a seção "Modal dentro de `<form>`"
já apontava como "a correção estrutural que falta", agora aplicada porque aqui ela é
**necessária**, não higiene. Medido depois, no aninhamento real: overlay `1440×900` (a
viewport inteira) e a caixa em `x=496 / y=186`, exatamente centrada.

**A lição que vale mais é sobre o método.** A foto que este arquivo recomenda pegou dois
defeitos deste mesmo modal antes do merge — e não pegou este, porque foi tirada do
**componente isolado**, montado sozinho em `document.body`. Ali o `fixed` funcionava. O que
quebra não está no componente: está em **quem o monta**.

- **Fotografe o componente no aninhamento em que ele vai viver**, não sozinho. Aqui isso
  significou renderizar o `Topbar` inteiro, abrir o menu, abrir o modal e fotografar
  `document.body.innerHTML` — com o `<header>` e seu `backdrop-blur` presentes.
- **Meça, não só olhe.** `getBoundingClientRect()` do overlay contra `innerWidth/innerHeight`
  responde "está enquadrado?" sem depender de o olho notar um corte.
- **Todo modal `fixed` montado a partir do Topbar ou da Sidebar precisa de portal**, e o
  componente do modal não tem como saber quem vai montá-lo — por isso o portal mora nele.

O teste que trava isso não procura o campo no documento (procurar assim passava nos dois
casos, e foi exatamente esse teste que deixou o defeito passar): ele exige que o overlay
**não** seja descendente do `<header>` e que o pai dele seja o `document.body`. Como o
conteúdo deixou de estar no `container` do `render`, os testes do modal passaram a consultar
o documento — a mudança de seletor é o sinal de que o portal está de fato em uso.


### A tela não dizia quem estava logado, e a senha sumia com a auditoria dizendo que mudou

Descoberto em 16/09/2026 **enquanto se gravava a linha de auditoria** de uma redefinição
feita à mão — o que revelou que a trilha já continha duas linhas afirmando o contrário do
que aconteceu.

`UsuarioFormModal` chamava:

```ts
await saveUsuario(novoUsuario, state.isOnline, senhaUsuario); // sem o 4º argumento
```

e `saveUsuario` decide **como** trocar a senha justamente pelo 4º (`currentUser`): a própria
via `updateUser`, a de outro via RPC. Com ele `undefined`, os dois ramos eram pulados — e o
código seguia para o `upsert` e para `registrarAuditoria`, que gravava
`senha_alterada: Boolean(password && ...)`, ou seja **`true`**. Tela dizia "Usuário salvo com
sucesso", log dizia que a senha mudou, e nada tinha mudado.

**Nunca funcionou.** Não é regressão: o argumento nunca foi passado por essa tela.

Três evidências independentes, e é a combinação que fecha o caso:

1. **Zero chamadas a `admin_alterar_senha_usuario` nos logs de borda** em toda a janela do
   incidente — só `registrar_audit` e `listar_cadastros_incompletos`.
2. **`auth.users.updated_at` intacto** em `14:28:07` depois de duas tentativas (14:25 e
   14:54) que a auditoria registrou como bem-sucedidas.
3. **O call site**, com três argumentos onde a função recebe quatro.

A consequência prática foi uma funcionária sem acesso por horas, com o operador convencido de
já ter resolvido — porque a tela e o log concordavam entre si e ambos estavam errados.

Duas regras:

- **Um parâmetro opcional que decide o COMPORTAMENTO é um parâmetro obrigatório mal
  declarado.** `currentUser?: {...}` deixou o `tsc` calado num call site que esquecia o que
  mais importava. É a mesma lição já registrada em `encontrarAssociadoComCpfDuplicado`
  ("o `tenantId` é parâmetro obrigatório, não opcional com padrão") — e aqui ela custou mais
  caro, porque o caminho pulado ainda auditava sucesso. Ao escrever um service assim, ou o
  parâmetro é obrigatório, ou o caminho "nenhum ramo casou" **lança**.
- **Um teste de call site não pergunta "a função foi chamada"; pergunta com o quê.**
  `UsuarioFormModal.test.tsx` exige `toHaveLength(4)` e confere o usuário no quarto
  argumento. Conferido contra o código sem a correção: reprova com
  `expected [...] to have a length of 4 but got 3`. Um teste que só verificasse a chamada
  passaria nos dois casos — e foi exatamente esse tipo de asserção que deixou o defeito
  atravessar a tela inteira.

O guard de `MENSAGEM_SENHA_SEM_PERMISSAO` (da rodada anterior) já convertia este caso de
perda silenciosa em erro visível, por acidente: sem `currentUser`, `canChangeUserPassword`
devolve `false` e a função lança. A correção do call site é o que faz a tela voltar a
funcionar em vez de só falhar alto.

**As duas linhas falsas na auditoria ficam como estão** — `Editar Usuário` com
`senha_alterada: true` em 14:25:27 e 14:54:13. Reescrever `detalhes` de linha já gravada é
mexer em trilha de auditoria, o que este arquivo já classifica como decisão de produto; e
apagá-las apagaria também o registro de que as tentativas existiram. A linha de 15:06:16
(`Redefinir Senha de Usuário`) é a que descreve a troca que de fato ocorreu.

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

### Quando o service se chama por dentro, o mock precisa de estado (`caixasService`)

`caixasService.test.ts` (77 testes, 19/09/2026) cobriu o último service grande sem nenhuma
asserção — 690 linhas com as duas funções puras do módulo (`gerarCodigoLote`,
`calcularResumoFluxoCaixa`) e todo o caminho offline de lote, movimentação, estorno,
reabertura, exclusão e integração com o financeiro. Três coisas dele valem como regra para o
próximo service:

- **Um `mockResolvedValueOnce` por chamada não sustenta service que se chama por dentro.**
  `registrarMovimentacao` grava a movimentação e em seguida `recalcularTotaisLote` relê
  **todas** as do lote para somar; `estornarMovimentacaoCaixa` marca a linha e recalcula o
  saldo a partir dela. Mockando por chamada, o teste passa a depender da ordem interna das
  leituras e quebra em qualquer refatoração que não muda comportamento nenhum. O que o
  arquivo usa é um **IndexedDB falso com estado de verdade** — um `Map` por store, com
  `getFromIDB`/`getAllFromIDB`/`saveToIDB`/`deleteFromIDB` ligados nele. Aí o encadeamento
  roda inteiro e a asserção é sobre o que **ficou gravado**, que é a pergunta que interessa:
  o estorno de R$ 50 num lote de R$ 100 + 50 + 30 deixa o saldo esperado em R$ 130.
- **Suíte que passa de primeira não provou nada ainda — mute o código e exija que ela
  reprove.** As 77 passaram na primeira execução, o que é tão compatível com "cobre" quanto
  com "não mede". Sete mutações no service (tirar o `!m.estornado` da soma, tirar o filtro de
  `tenant_id`, tirar a checagem de `referencia_id` já processada, fazer a herança de conta
  devolver `null`, aceitar estorno em lote fechado, aceitar segundo lote aberto, parar de
  filtrar por `status` na sincronização) foram cada uma reprovada pela suíte. **A primeira
  tentativa da quarta foi um no-op meu** (`null ?? await f()` devolve `f()`, então o
  comportamento não mudou e a suíte passou) — e o resultado "passou" quase virou a conclusão
  "o teste não cobre". Quando uma mutação não reprova, **confirme primeiro que ela mudou
  mesmo o comportamento**; é o equivalente, do lado do teste, de guardar o `SQLSTATE` num
  teste de permissão.
- **O que o teste trava é a decisão, não a linha.** Os casos com nome longo são os que
  registram uma escolha: o lote `auditado` conta como fechado porque o critério é
  `status !== 'aberto'` (e a soma dos dois contadores tem de bater com o total da lista); a
  saída entra **negativa** nos totais por forma de pagamento porque ali a pergunta é "quanto
  sobrou na gaveta", não "quanto saiu"; `getLotesCaixa` com `'all'` **não filtra**, que é o
  fundo falso que levou a movimentação para o caixa de outra empresa; e a sincronização é
  idempotente por `referencia_id`, senão rodar de novo traz o mesmo recebimento duas vezes.

### O caixa parou de engolir a recusa do servidor — e o invariante virou "ou subiu, ou está na fila"

Corrigido na sequência dos testes acima, que foram o que tornou a mudança barata de fazer.
Os quatro caminhos de escrita do caixa — `abrirLoteCaixa`, `fecharLoteCaixa`,
`registrarMovimentacao` e `estornarMovimentacaoCaixa` — tratavam o `error` devolvido pelo
Supabase com `console.warn`, gravavam no IndexedDB e **não enfileiravam nada**. O registro
ficava preso no navegador de quem operou, a tela dizia sucesso e, no caso do lote, a
**auditoria registrava uma abertura que o servidor havia recusado**. Era a armadilha que este
arquivo documenta desde `saveAtendimento`, no último service que ainda a tinha inteira —
`reabrirLoteCaixa`, no mesmo arquivo, já lançava.

`escreverNoServidor` concentra a distinção: **`error` devolvido é recusa e lança**
(constraint, RLS, `CHECK`, coluna inexistente — repetir amanhã com o mesmo payload dá o
mesmo resultado, então enfileirar só adia a perda); **exceção lançada é rede fora**, e aí o
caso offline-first é legítimo, com cache e fila. A recusa é guardada numa variável e
relançada **fora** do `try`, senão cairia no próprio `catch` que trata rede — o mesmo detalhe
de implementação que `saveAtendimento` já registra.

Quatro decisões valem como regra:

- **O invariante é "ou subiu, ou está na fila", nunca nenhum dos dois** — e há um teste que
  varre os quatro caminhos cobrando exatamente isso, em vez de quatro testes parecidos.
- **A recusa não grava nem no cache.** Antes, o lote recusado existia no IndexedDB daquele
  navegador e em lugar nenhum mais; a tela mostrava fechado um lote que não fechou. Agora o
  estado local continua igual ao do servidor: nada aconteceu dos dois lados.
- **`recalcularTotaisLote` é o único que segue falhando calado, de propósito.**
  `saldo_entradas`/`saldo_saidas`/`saldo_esperado` são **cache derivado** — o fechamento do
  lote os recalcula do zero a partir das movimentações, ignorando o que estiver gravado.
  Lançar ali faria a movimentação que o servidor **já aceitou** ser reportada ao operador
  como se tivesse falhado, que é o erro mais caro dos dois. **Antes de propagar um erro,
  pergunte se o dado é fonte ou é cache dela.**
- **A recusa da movimentação não desfaz a baixa da parcela, e o aviso diz isso.** As duas
  escritas são sequenciais e não há transação entre elas. `utils/avisoLiquidacaoSemCaixa.ts`
  monta a frase única dos três pontos de liquidação: a baixa **valeu**, o valor **não** entra
  no saldo do lote (então a conferência vai acusar diferença), e a saída é "Sincronizar
  Financeiro". Um "Erro ao efetivar recebimento" genérico faria o operador repetir a baixa.

**`RecusaDoServidor` e `explicarRecusa` saíram de `associadosService` para
`utils/recusaDoServidor.ts`**, porque o segundo service precisava da mesma tradução —
copiá-la faria as duas metades divergirem no primeiro código de erro novo.
`associadosService` continua reexportando a classe, que já era parte do contrato dele.

**Dois tenants inventados saíram junto, porque estavam no caminho da correção.** A seção do
recebimento registra que "os dois caminhos passaram a resolver por `tenantDeEscrita`" — eram
os dois de **recebimento**. Contas a **Pagar** tinha o mesmo defeito intacto
(`getLoteAbertoAtivo(..., state.empresaSelecionada || 'tenant-default')`, com `'all'`
desligando o filtro e devolvendo o lote aberto de outra empresa), e `CaixasPage` abria lote
com `state.empresaSelecionada || 'tenant-1'`. Os dois passaram a recusar com
`MENSAGEM_TENANT_INDEFINIDO`. Em Contas a Pagar a movimentação resolve pelo
**`tenant_id` do lote já aberto**, não pelo seletor do topo: é nele que o dinheiro está
saindo, e reler o seletor abriria espaço para os dois discordarem se a seleção mudar entre
abrir o modal e confirmar a baixa.

**O botão "Sincronizar Financeiro" era um `setTimeout`.** `handleSyncFinancials` esperava
1,5s e anunciava "Integração concluída com sucesso!" sem chamar nada —
`sincronizarLancamentosFinanceiros` **não tinha chamador nenhum no app**, e o texto ao lado
afirmava que a integração era "em tempo real", o que é verdade no caminho feliz e deixa de
ser exatamente quando a movimentação falha. Ele agora chama a função de verdade e diz quantos
lançamentos trouxe. **Um botão que relata sucesso sem fazer nada é pior que um botão
ausente**: ele é a razão pela qual ninguém procurou o problema antes.

### Os seis hooks de cadastro, e o harness que eles compartilham

Fechado em 20/09/2026. `useFornecedores` (19), `useItensFunerarios` (18), `useProcedimentos`
(14), `useCredenciados` (14), `usePlanosPax` (17) e o par `useCentrosCusto`/
`useCategoriasFornecedor` (14) passaram a ter teste. `src/test/harnessDeHook.ts` é o IDB falso
com estado + o Supabase que **registra a chamada**, num lugar só: seis cópias do mesmo mock
seriam a duplicação que este arquivo combate em toda outra seção.

Duas armadilhas do harness valem para o próximo:

- **`order()` devolve o próprio builder, não uma Promise.** Há consultas com
  `.order(...).order(...)` no projeto; como o builder é thenable, `await query.order(...)`
  continua resolvendo.
- **O usuário vem de lugares diferentes.** `useItensFunerarios` lê `state.user` do
  `AppContext`; `useFornecedores`, `useProcedimentos`, `useCredenciados` e `usePlanosPax` leem
  de `useAuth()`. Mockar o errado faz todo `criar` falhar com "não autenticado" — e os testes
  que só checam `rejects.toThrow()` passam assim mesmo, vazios.

#### Dois defeitos que os testes acharam, e as correções

- **`useProcedimentos` auditava o que o servidor tinha recusado.** `criar` e `editar` faziam
  `console.warn` e gravavam no IndexedDB, e a chamada a `registrarAuditoria` ficava **fora**
  do `if/else` — então a trilha registrava "Criar Procedimento" para uma criação que não
  aconteceu, e o registro ficava preso no navegador de quem operou. Os três caminhos passaram
  a lançar `RecusaDoServidor`. É a armadilha de `saveAtendimento` de novo, agora num hook.
- **`usePlanosPax` gravava o plano e perdia faixas e coberturas em silêncio.** As tabelas
  filhas só tinham `if (err) console.warn(...)`, nas duas funções. **A faixa etária é o preço
  do plano**: sem linha em `planos_pax_faixas`, `calcularValor` ignora a idade e o plano cobra
  outro valor; sem cobertura, todo item vira "fora da cobertura" no atendimento. E o cache
  local guardava as três juntas, então o navegador de quem criou mostrava o plano certo e o de
  todos os outros, errado. `utils/avisoPlanoIncompleto.ts` monta a frase que diz o que o
  genérico não diz: **o plano existe** (repetir cria um duplicado), o que faltou, e que basta
  abrir e salvar de novo. Mesma escolha de `avisoLiquidacaoSemCaixa`.

#### A co-participação que nunca chegava ao servidor (migration `20260920141609`)

Achado pelo teste do hook e corrigido na sequência. `credenciados_procedimentos` tinha sete
colunas, e **nem `valor_exclusivo` nem `valor_coparticipacao` estavam entre elas** (`id`,
`credenciado_id`, `procedimento_id`, `valor`, `created_at`, `tenant_id`, `empresa_id`).
`vincularProcedimento` mandava as duas no primeiro upsert, levava `PGRST204` **sempre**, e o
"fallback" reenviava sem elas — a quarta cópia do padrão que este arquivo classifica como
*corromper o registro para conseguir gravá-lo*.

Não era risco adormecido: a co-participação digitada em `ProcedimentosCredenciado.tsx` **nunca
chegava ao servidor**. Ficava só no IndexedDB de quem digitou — a tela dele mostrava o número, a
de todos os outros mostrava vazio — e é ela que vira conta a receber quando a guia é emitida.

**Só `valor_coparticipacao` foi criada.** A outra saída seria criar também `valor_exclusivo`, e
ela reintroduziria exatamente o par de colunas duplicadas que a migration `20260915132838`
acabou de eliminar: o hook já grava o valor exclusivo em `valor`, que é a coluna canônica do
preço. Agora o payload leva `valor` + `valor_coparticipacao`, e o nome que não é coluna some do
caminho de escrita — inclusive em `atualizarValorProcedimento`, que o traduz antes de enviar em
vez de mandá-lo para levar `PGRST204`. O `COMMENT` de `valor` registra a decisão para a próxima
pessoa que for tentada a criar `valor_exclusivo` ao lado dela.

**As 29 linhas anteriores ficaram com `0`, e isso está escrito no `COMMENT` da coluna nova**:
não é "sem co-participação", é "nunca gravado". Quem precisar do valor certo tem de reabrir o
credenciado e informar de novo — não há de onde fazer backfill, porque o dado só existiu no
IndexedDB de cada navegador.

Duas coisas do método valem como regra:

- **O teste que travava o defeito virou o teste que trava a correção.** Ele já media o
  comportamento (`tentativas === 2`, segundo payload sem a co-participação) em vez de
  descrevê-lo, então bastou inverter a expectativa: uma tentativa, payload completo, recusa
  lançando. As quatro mutações (voltar a mandar `valor_exclusivo`, trocar o `throw` por
  `warn`, parar de enfileirar sem rede, reintroduzir o reenvio no `atualizar`) reprovam a
  suíte, cada uma no teste correspondente.
- **A tela parou de engolir a mensagem.** `handleVincular` vincula num laço, um procedimento
  por vez; um "Erro ao vincular procedimentos." genérico fazia o operador repetir a seleção
  inteira e revincular o que já tinha subido. A mensagem passou a dizer quantos entraram, em
  qual procedimento parou e o que o servidor recusou.

#### Outros dois quirks travados, não corrigidos

- **`useItensFunerarios.desativar` É `excluir`** (`const desativar = excluir`): o operador
  clica em "desativar" e o item some do banco junto com as coberturas de plano dele, sem
  pergunta e sem volta. E `reativar` faz `editar(id, { ativo: true })`, que não tem linha para
  atualizar depois disso — o par é incoerente.
- **`useFornecedores` não poda o cache com resposta vazia** (`data.length > 0`), a mesma
  condição que o CLAUDE.md já corrigiu em `financeiroService`: zero linhas é resposta válida,
  não falha de rede. Um fornecedor excluído em outra máquina sobrevive no IndexedDB local.
  Podar com segurança exige `utils/mesclagemOfflineFirst.ts`, por onde este hook não passa.

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
