-- A lista de categorias de fornecedor deixa de viver no localStorage do navegador e vira
-- tabela da empresa.
--
-- É a terceira vez que este schema trata a mesma doença, e a mais escondida das três: o
-- `categoria` de texto livre dos lançamentos (resolvido pelo plano contábil) morava no
-- IndexedDB; os centros de custo (migration 20260909122921) também; as categorias de
-- fornecedor moravam no **localStorage**, por navegador. Duas consequências que ninguém via:
-- dois operadores da mesma empresa tinham listas diferentes, e uma categoria criada pelo
-- "Gerenciar" numa máquina não existia em nenhuma outra — foi exatamente assim que
-- 'Convenios Associados', a chave do vínculo com o associado PJ, ficou invisível para quem
-- não a tinha criado.
--
-- As decisões seguem as do plano contábil e dos centros de custo, pelos mesmos motivos:
--   * `unique (tenant_id, id)` do lado referenciado, para a FK de `fornecedores` poder ser
--     composta e levar o `tenant_id` junto — uma FK simples por `id` deixaria um fornecedor
--     apontar para categoria de outra empresa em silêncio (CLAUDE.md, PRs #13/#14/#23);
--   * `fornecedores.categoria` (texto) continua existindo, mas **não como snapshot**: aqui é
--     classificação operacional, não documento histórico, então ela acompanha a categoria
--     quando esta é renomeada. Quem renomeia atualiza os dois, num lugar só
--     (`renomearCategoria`, no service). É a mesma distinção que `nomeDaEmpresaDoAssociado` já
--     registra: id manda, e a listagem sai com o nome de hoje.
--   * policy `TO authenticated` declarada explicitamente — omitir o `TO` deixa `public`, que
--     inclui `anon`, e `has_tenant_access(NULL)` é permissivo por construção (migration
--     20260914134717).

create table if not exists public.categorias_fornecedor (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null,
  codigo        text not null,
  nome          text not null,
  descricao     text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por    uuid,
  deleted_at    timestamptz,

  constraint categorias_fornecedor_codigo_uk unique (tenant_id, codigo),
  constraint categorias_fornecedor_nome_uk   unique (tenant_id, nome),
  -- alvo da FK composta de fornecedores: leva o tenant_id junto
  constraint categorias_fornecedor_tenant_uk unique (tenant_id, id)
);

comment on table public.categorias_fornecedor is
  'Categorias de fornecedor de um tenant. Substitui a lista que vivia no localStorage de cada navegador (chave categorias_fornecedores), que era por dispositivo e nao por empresa.';
comment on column public.categorias_fornecedor.tenant_id is
  'Empresa dona da categoria. TEXT por convencao do schema (nao ha FK para tenants em lugar nenhum).';
comment on column public.categorias_fornecedor.codigo is
  'Derivado do nome (sem acento, maiusculas, hifen no lugar de simbolo) — mesma regra de codigoDeNome() no frontend. Nao muda quando a categoria e renomeada: e por ele que quem exportou relatorio reconhece a categoria.';

-- Nenhum índice avulso por `tenant_id`: as três UNIQUE acima já começam por ele, e um
-- `idx_..._tenant` seria byte a byte redundante. É a armadilha da migration 20260910012513
-- (nove pares idênticos porque `CREATE INDEX IF NOT EXISTS` casa pelo NOME, nunca pela
-- definição).

alter table public.categorias_fornecedor enable row level security;

drop policy if exists categorias_fornecedor_tenant_policy on public.categorias_fornecedor;
create policy categorias_fornecedor_tenant_policy on public.categorias_fornecedor
  for all
  to authenticated
  using (has_tenant_access(tenant_id))
  with check (has_tenant_access(tenant_id));

-- ── Ligação com fornecedores ────────────────────────────────────────────────────────────
alter table public.fornecedores
  add column if not exists categoria_id uuid;

comment on column public.fornecedores.categoria_id is
  'Categoria do fornecedor. Nulo em fornecedor de empresa que ainda nao montou a lista — nesse caso a tela cai na lista modelo do frontend, como o seletor de centro de custo ja fazia.';
comment on column public.fornecedores.categoria is
  'Nome da categoria. NAO e snapshot: acompanha categorias_fornecedor.nome quando ela e renomeada (ver renomearCategoria no categoriasFornecedorService). Quem manda e categoria_id.';

alter table public.fornecedores
  drop constraint if exists fornecedores_categoria_fk;
alter table public.fornecedores
  add constraint fornecedores_categoria_fk
  foreign key (tenant_id, categoria_id)
  references public.categorias_fornecedor (tenant_id, id)
  on delete restrict;

-- Índice de cobertura na ordem das colunas da FK (a lição da PR #32 e do advisor
-- `unindexed_foreign_keys`).
create index if not exists idx_fornecedores_categoria
  on public.fornecedores (tenant_id, categoria_id);
