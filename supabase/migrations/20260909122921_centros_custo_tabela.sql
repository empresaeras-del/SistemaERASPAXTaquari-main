-- Fase 4, parte 2: centro de custo deixa de ser texto livre e vira tabela do tenant.
--
-- É a mesma troca que o plano contábil fez com `categoria`: até aqui a lista de centros de
-- custo vivia só no IndexedDB do navegador (`useOptions('centros_custo', ...)`), o que
-- significa que ela era **por dispositivo**, não por empresa — dois operadores da mesma
-- empresa podiam ter listas diferentes, e o valor gravado em `despesas.centro_custo` era
-- só o texto que o select daquele navegador oferecia.
--
-- Mesmas duas decisões do plano contábil, pelos mesmos motivos:
--   * `unique (tenant_id, id)` do lado referenciado, para a FK de `despesas` poder ser
--     composta e levar o `tenant_id` junto — uma FK simples por `id` deixaria uma despesa
--     apontar para centro de custo de outra empresa em silêncio (ver CLAUDE.md, PRs #13/#14/#23);
--   * `despesas.centro_custo` (texto) continua existindo como **snapshot** do nome no momento
--     do lançamento, ao lado do id — mesmo padrão de `categoria`/`conta_contabil_id` e de
--     `fornecedor_nome`/`fornecedor_id`.

create table if not exists public.centros_custo (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null,
  empresa_id    text,
  codigo        text not null,
  nome          text not null,
  descricao     text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por    uuid,
  deleted_at    timestamptz,

  constraint centros_custo_codigo_uk unique (tenant_id, codigo),
  constraint centros_custo_nome_uk   unique (tenant_id, nome),
  -- alvo da FK composta de despesas: leva o tenant_id junto
  constraint centros_custo_tenant_uk unique (tenant_id, id)
);

comment on table public.centros_custo is
  'Centros de custo de um tenant. Substitui a lista que existia so no IndexedDB do navegador (useOptions), que era por dispositivo e nao por empresa.';
comment on column public.centros_custo.tenant_id is
  'Empresa dona do centro de custo. TEXT por convencao do schema (nao ha FK para tenants em lugar nenhum).';

create index if not exists idx_centros_custo_tenant on public.centros_custo (tenant_id);

alter table public.centros_custo enable row level security;

drop policy if exists centros_custo_tenant_policy on public.centros_custo;
create policy centros_custo_tenant_policy on public.centros_custo
  for all
  using (has_tenant_access(tenant_id))
  with check (has_tenant_access(tenant_id));

-- ── Ligação com despesas ────────────────────────────────────────────────────────────────
alter table public.despesas
  add column if not exists centro_custo_id uuid;

comment on column public.despesas.centro_custo_id is
  'Centro de custo da despesa. Nulo em despesa anterior a fase 4 que nao tinha centro de custo preenchido.';
comment on column public.despesas.centro_custo is
  'Snapshot do nome do centro de custo no momento do lancamento — escrito uma vez, nunca re-sincronizado. Agrupar relatorio e papel de centro_custo_id.';

alter table public.despesas
  drop constraint if exists despesas_centro_custo_fk;
alter table public.despesas
  add constraint despesas_centro_custo_fk
  foreign key (tenant_id, centro_custo_id)
  references public.centros_custo (tenant_id, id)
  on delete restrict;

-- Índice de cobertura na ordem das colunas da FK (a lição da PR #32).
create index if not exists idx_despesas_centro_custo
  on public.despesas (tenant_id, centro_custo_id);
