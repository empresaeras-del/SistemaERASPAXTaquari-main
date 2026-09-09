-- Fase 4, parte 1: o plano passa a ser por empresa **e exercício**.
--
-- Até aqui `planos_contabeis_um_ativo_por_tenant` garantia um plano ativo por empresa, ponto.
-- A regra vira "um plano ativo por empresa e exercício": a empresa mantém o plano de 2026
-- intacto — com os lançamentos de 2026 pendurados nele — e monta o de 2027 ao lado.
--
-- `exercicio` é o ano contábil, e não uma faixa de datas, de propósito: `vigencia_inicio` /
-- `vigencia_fim` já existem para quem precisar do intervalo exato, mas o que precisa ser
-- único e comparável é o ano. Um inteiro faz isso sem ambiguidade de fuso ou de borda.
--
-- Nada nas FKs muda: `contas_contabeis` referencia `(tenant_id, plano_id)`, e o plano já
-- identifica o exercício. Uma conta pertence a um plano, logo a um exercício, por construção.

alter table public.planos_contabeis
  add column if not exists exercicio integer;

-- Os planos que já existem são do exercício corrente, o único que houve até agora.
update public.planos_contabeis
   set exercicio = extract(year from vigencia_inicio)::integer
 where exercicio is null;

alter table public.planos_contabeis
  alter column exercicio set not null;

alter table public.planos_contabeis
  alter column exercicio set default extract(year from current_date)::integer;

alter table public.planos_contabeis
  drop constraint if exists planos_contabeis_exercicio_ck;
alter table public.planos_contabeis
  add constraint planos_contabeis_exercicio_ck
  check (exercicio between 1900 and 2200);

comment on column public.planos_contabeis.exercicio is
  'Ano contabil do plano. Uma empresa tem no maximo um plano ativo por exercicio; o plano do ano anterior segue existindo, com os lancamentos daquele ano apontando para as contas dele.';

-- A unicidade passa a ser por (empresa, exercício). O índice antigo impediria a empresa de
-- ter 2026 e 2027 ativos ao mesmo tempo, que é justamente o que esta migration habilita.
drop index if exists public.planos_contabeis_um_ativo_por_tenant;

create unique index if not exists planos_contabeis_um_ativo_por_exercicio
  on public.planos_contabeis (tenant_id, exercicio)
  where ativo and deleted_at is null;

create index if not exists idx_planos_contabeis_tenant_exercicio
  on public.planos_contabeis (tenant_id, exercicio);
