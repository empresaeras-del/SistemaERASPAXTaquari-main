-- Modulo de Plano Contabil por tenant (fase 1: catalogo, sem tocar em lancamentos).
-- Convencao de tenant seguida do resto do schema: tenant_id TEXT, sem FK para tenants,
-- isolamento por RLS via has_tenant_access(). Ver CLAUDE.md.

create table if not exists public.planos_contabeis (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       text not null,
  empresa_id      text,
  codigo          text not null,
  nome            text not null,
  descricao       text,
  vigencia_inicio date not null default current_date,
  vigencia_fim    date,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  criado_por      uuid,
  deleted_at      timestamptz,

  constraint planos_contabeis_codigo_uk   unique (tenant_id, codigo),
  constraint planos_contabeis_vigencia_ck check (vigencia_fim is null or vigencia_fim >= vigencia_inicio),
  -- alvo da FK composta de contas_contabeis: leva o tenant_id junto
  constraint planos_contabeis_tenant_uk   unique (tenant_id, id)
);

comment on table public.planos_contabeis is
  'Plano de contas contabeis de um tenant. O plano modelo NAO e uma linha compartilhada (tenant_id nulo): e uma constante do frontend copiada para linhas do proprio tenant.';
comment on column public.planos_contabeis.tenant_id is
  'Empresa dona do plano. TEXT por convencao do schema (nao ha FK para tenants em lugar nenhum).';

create unique index if not exists planos_contabeis_um_ativo_por_tenant
  on public.planos_contabeis (tenant_id)
  where ativo and deleted_at is null;

create index if not exists idx_planos_contabeis_tenant on public.planos_contabeis (tenant_id);

alter table public.planos_contabeis enable row level security;

drop policy if exists planos_contabeis_tenant_policy on public.planos_contabeis;
create policy planos_contabeis_tenant_policy on public.planos_contabeis
  for all
  using (has_tenant_access(tenant_id))
  with check (has_tenant_access(tenant_id));


create table if not exists public.contas_contabeis (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      text not null,
  empresa_id     text,
  plano_id       uuid not null,
  conta_pai_id   uuid,
  codigo         text not null,
  nome           text not null,
  descricao      text,
  natureza       text not null,
  tipo           text not null,
  nivel          smallint not null default 1,
  ordem_exibicao integer,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  criado_por     uuid,
  deleted_at     timestamptz,

  constraint contas_contabeis_natureza_ck check (natureza in ('receita','despesa')),
  constraint contas_contabeis_tipo_ck     check (tipo in ('sintetica','analitica')),
  constraint contas_contabeis_ciclo1_ck   check (conta_pai_id is null or conta_pai_id <> id),
  constraint contas_contabeis_nivel_ck    check (nivel between 1 and 6),
  constraint contas_contabeis_codigo_uk   unique (tenant_id, plano_id, codigo),

  -- alvos das FKs compostas
  constraint contas_contabeis_plano_id_uk unique (tenant_id, plano_id, id),
  constraint contas_contabeis_natureza_uk unique (tenant_id, natureza, id),

  -- o plano referenciado e obrigatoriamente do mesmo tenant
  constraint contas_contabeis_plano_fk foreign key (tenant_id, plano_id)
    references public.planos_contabeis (tenant_id, id) on delete restrict,

  -- a conta pai e obrigatoriamente do mesmo tenant E do mesmo plano
  constraint contas_contabeis_pai_fk foreign key (tenant_id, plano_id, conta_pai_id)
    references public.contas_contabeis (tenant_id, plano_id, id) on delete restrict
);

comment on table public.contas_contabeis is
  'Contas contabeis em arvore (conta_pai_id). tipo=sintetica e grupo (nao recebe lancamento); tipo=analitica e conta lancavel.';
comment on column public.contas_contabeis.natureza is
  'receita | despesa. Entra na unique (tenant_id, natureza, id) para que a FK do lancamento impeca receita apontar para conta de despesa.';
comment on column public.contas_contabeis.tipo is
  'sintetica = grupo totalizador; analitica = folha lancavel. So analitica pode ser usada em lancamento (validado por trigger na fase 2).';
comment on constraint contas_contabeis_pai_fk on public.contas_contabeis is
  'FK composta: garante que a conta pai pertence ao mesmo tenant e ao mesmo plano, tornando impossivel uma arvore misturando planos ou empresas.';

create index if not exists idx_contas_contabeis_tenant on public.contas_contabeis (tenant_id);
create index if not exists idx_contas_contabeis_plano  on public.contas_contabeis (plano_id);
create index if not exists idx_contas_contabeis_pai    on public.contas_contabeis (conta_pai_id);
create index if not exists idx_contas_contabeis_lancavel
  on public.contas_contabeis (tenant_id, natureza)
  where tipo = 'analitica' and ativo and deleted_at is null;

alter table public.contas_contabeis enable row level security;

drop policy if exists contas_contabeis_tenant_policy on public.contas_contabeis;
create policy contas_contabeis_tenant_policy on public.contas_contabeis
  for all
  using (has_tenant_access(tenant_id))
  with check (has_tenant_access(tenant_id));
