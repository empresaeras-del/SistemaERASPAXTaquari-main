-- Fase 2 do plano contabil: os lancamentos passam a apontar para a conta contabil.
--
-- conta_contabil_id nasce NULLABLE de proposito: todo lancamento ja existente continua
-- valido. Com MATCH SIMPLE (padrao do Postgres) a FK composta e satisfeita se QUALQUER
-- coluna da chave for NULL, entao nao ha excecao a abrir para o legado. A coluna so vira
-- obrigatoria na fase 3, em migration propria, depois do backfill.
--
-- natureza_contabil e uma coluna constante ('receita' em receitas, 'despesa' em despesas),
-- garantida por CHECK. Ela existe unicamente para viajar dentro da FK composta: com ela na
-- chave, o proprio banco impede uma receita apontar para conta de despesa, sem trigger.

alter table public.receitas
  add column if not exists conta_contabil_id uuid,
  add column if not exists natureza_contabil text not null default 'receita';

alter table public.despesas
  add column if not exists conta_contabil_id uuid,
  add column if not exists natureza_contabil text not null default 'despesa';

alter table public.receitas
  drop constraint if exists receitas_natureza_contabil_ck,
  add constraint receitas_natureza_contabil_ck check (natureza_contabil = 'receita');

alter table public.despesas
  drop constraint if exists despesas_natureza_contabil_ck,
  add constraint despesas_natureza_contabil_ck check (natureza_contabil = 'despesa');

-- A FK leva tenant_id e natureza dentro dela: barra conta de outra empresa E conta de
-- natureza errada. Alvo: contas_contabeis_natureza_uk (tenant_id, natureza, id).
alter table public.receitas
  drop constraint if exists receitas_conta_contabil_fk,
  add constraint receitas_conta_contabil_fk
    foreign key (tenant_id, natureza_contabil, conta_contabil_id)
    references public.contas_contabeis (tenant_id, natureza, id) on delete restrict;

alter table public.despesas
  drop constraint if exists despesas_conta_contabil_fk,
  add constraint despesas_conta_contabil_fk
    foreign key (tenant_id, natureza_contabil, conta_contabil_id)
    references public.contas_contabeis (tenant_id, natureza, id) on delete restrict;

-- Indices de cobertura das FKs compostas, nas colunas da chave e na ordem dela.
-- (Licao da fase 1: um indice so em conta_contabil_id nao serve de prefixo.)
create index if not exists idx_receitas_conta_contabil
  on public.receitas (tenant_id, natureza_contabil, conta_contabil_id);
create index if not exists idx_despesas_conta_contabil
  on public.despesas (tenant_id, natureza_contabil, conta_contabil_id);

comment on column public.receitas.conta_contabil_id is
  'Conta contabil analitica do plano do tenant. NULL enquanto o lancamento for legado (a classificacao dele segue so em categoria).';
comment on column public.receitas.natureza_contabil is
  'Constante "receita", garantida por CHECK. Existe para viajar dentro da FK composta e impedir que uma receita aponte para conta de despesa.';
comment on column public.despesas.conta_contabil_id is
  'Conta contabil analitica do plano do tenant. NULL enquanto o lancamento for legado (a classificacao dele segue so em categoria).';
comment on column public.despesas.natureza_contabil is
  'Constante "despesa", garantida por CHECK. Existe para viajar dentro da FK composta e impedir que uma despesa aponte para conta de receita.';

-- "So conta analitica recebe lancamento" e uma regra entre tabelas: CHECK nao alcanca
-- (so enxerga a propria linha) e a FK nao expressa. Dai o trigger.
--
-- Ele checa tipo, mas NAO checa ativo, de proposito: desativar uma conta e uma decisao
-- sobre lancamentos futuros. Se 'ativo' entrasse aqui, editar um lancamento antigo
-- (corrigir um valor, mudar uma observacao) passaria a falhar depois que a conta fosse
-- desativada. O filtro por ativo pertence ao seletor da tela, nao a integridade do dado.
create or replace function public.valida_conta_lancavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.conta_contabil_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.contas_contabeis c
     where c.id = new.conta_contabil_id
       and c.tipo = 'analitica'
       and c.deleted_at is null
  ) then
    raise exception
      'Conta contabil % nao e analitica (ou foi excluida): so conta analitica recebe lancamento.',
      new.conta_contabil_id
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

comment on function public.valida_conta_lancavel() is
  'Impede lancamento em conta sintetica (grupo). Nao valida "ativo" de proposito: conta desativada nao pode invalidar a edicao de lancamento antigo que ja a usava.';

drop trigger if exists receitas_valida_conta_lancavel on public.receitas;
create trigger receitas_valida_conta_lancavel
  before insert or update of conta_contabil_id on public.receitas
  for each row execute function public.valida_conta_lancavel();

drop trigger if exists despesas_valida_conta_lancavel on public.despesas;
create trigger despesas_valida_conta_lancavel
  before insert or update of conta_contabil_id on public.despesas
  for each row execute function public.valida_conta_lancavel();
