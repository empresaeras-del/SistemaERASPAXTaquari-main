-- Fase 3 do plano contábil, parte 1: a movimentação de caixa também aponta para a conta.
--
-- Diferença em relação a `receitas`/`despesas` (fase 2): ali a natureza é constante da tabela
-- ("receita" numa, "despesa" na outra). Aqui ela depende da linha: `tipo = 'entrada'` é
-- receita, `tipo = 'saida'` é despesa. Por isso `natureza_contabil` é preenchida por trigger
-- a partir de `tipo` e travada por CHECK — o app não precisa (nem consegue) mandar outro valor.

alter table public.movimentacoes_caixa
  add column if not exists conta_contabil_id uuid,
  add column if not exists natureza_contabil text;

comment on column public.movimentacoes_caixa.conta_contabil_id is
  'Conta analítica do plano contábil do tenant. Nula em movimentação anterior à fase 3 e em suprimento/sangria (transferência de caixa, não é resultado).';
comment on column public.movimentacoes_caixa.natureza_contabil is
  'Derivada de `tipo` por trigger (entrada => receita, saida => despesa). Existe só para viajar dentro da FK composta; não é dado de negócio.';

-- Linhas que já existem: deriva a natureza antes de tornar a coluna obrigatória.
update public.movimentacoes_caixa
   set natureza_contabil = case when tipo = 'entrada' then 'receita' else 'despesa' end
 where natureza_contabil is null;

create or replace function public.define_natureza_movimentacao_caixa()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.natureza_contabil := case when new.tipo = 'entrada' then 'receita' else 'despesa' end;
  return new;
end;
$$;

comment on function public.define_natureza_movimentacao_caixa() is
  'Mantém movimentacoes_caixa.natureza_contabil sempre coerente com tipo, para a FK composta não depender de o cliente mandar o valor certo.';

drop trigger if exists trg_define_natureza_movimentacao_caixa on public.movimentacoes_caixa;
create trigger trg_define_natureza_movimentacao_caixa
  before insert or update of tipo, natureza_contabil on public.movimentacoes_caixa
  for each row execute function public.define_natureza_movimentacao_caixa();

alter table public.movimentacoes_caixa
  alter column natureza_contabil set not null;

alter table public.movimentacoes_caixa
  drop constraint if exists movimentacoes_caixa_natureza_contabil_ck;
alter table public.movimentacoes_caixa
  add constraint movimentacoes_caixa_natureza_contabil_ck
  check (natureza_contabil = case when tipo = 'entrada' then 'receita' else 'despesa' end);

-- Mesma FK composta da fase 2: tenant e natureza viajam dentro da chave, então o banco
-- recusa sozinho conta de outra empresa e entrada de caixa em conta de despesa.
alter table public.movimentacoes_caixa
  drop constraint if exists movimentacoes_caixa_conta_contabil_fk;
alter table public.movimentacoes_caixa
  add constraint movimentacoes_caixa_conta_contabil_fk
  foreign key (tenant_id, natureza_contabil, conta_contabil_id)
  references public.contas_contabeis (tenant_id, natureza, id)
  on delete restrict;

-- Índice de cobertura na ordem das colunas da FK (a lição da PR #32).
create index if not exists idx_movimentacoes_caixa_conta_contabil
  on public.movimentacoes_caixa (tenant_id, natureza_contabil, conta_contabil_id);

-- Reaproveita o trigger da fase 2: só olha new.conta_contabil_id, serve para qualquer tabela.
drop trigger if exists trg_valida_conta_lancavel_movimentacoes_caixa on public.movimentacoes_caixa;
create trigger trg_valida_conta_lancavel_movimentacoes_caixa
  before insert or update of conta_contabil_id on public.movimentacoes_caixa
  for each row execute function public.valida_conta_lancavel();
