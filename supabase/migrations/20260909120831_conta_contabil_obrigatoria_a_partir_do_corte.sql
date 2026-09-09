-- Fase 3 do plano contábil, parte 3: a conta passa a ser obrigatória — mas só daqui para frente.
--
-- Por que trigger e não `alter column ... set not null`:
--
--   1. A regra pedida é "obrigatória para lançamento a partir desta data", não "obrigatória
--      sempre". Um NOT NULL vale para a linha, não para o instante em que ela nasceu, e
--      quebraria o lançamento antigo no primeiro UPDATE (corrigir um valor, mudar uma
--      observação) se por qualquer motivo a conta dele estivesse vazia.
--   2. A regra tem duas isenções que dependem de outras tabelas e de outra coluna, e nenhuma
--      cabe num CHECK: suprimento/sangria (transferência de caixa, não é resultado) e empresa
--      que ainda não tem conta analítica da natureza no plano ativo.
--
-- A isenção nº 2 é o que impede a fase 3 de travar o sistema de uma empresa nova: enquanto ela
-- não montar o plano, tudo continua funcionando como antes, com `categoria` de texto livre —
-- exatamente o mesmo fallback que os formulários já mostram desde a fase 2. Só se exige o que
-- é possível cumprir.
--
-- O corte é comparado contra `criado_em`, que o cliente envia (ver `sanitize*ForSupabase`).
-- Isso é deliberado, não um descuido: um lançamento feito offline ontem e sincronizado amanhã
-- carrega o `criado_em` de ontem e entra sem conta, em vez de ser recusado na fila de sync —
-- que seria perda silenciosa de dado do usuário, a armadilha que o CLAUDE.md já documenta.

create or replace function public.exige_conta_contabil()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Início da fase 3. Lançamento anterior a isto é legado e passa sem conta.
  data_corte constant timestamptz := '2026-09-09T00:00:00Z';
  v_origem text;
begin
  if new.conta_contabil_id is not null then
    return new;
  end if;

  if new.criado_em is null or new.criado_em < data_corte then
    return new;
  end if;

  -- Movimentação que só transfere numerário não tem conta de resultado.
  v_origem := to_jsonb(new) ->> 'origem';
  if v_origem in ('suprimento', 'sangria') then
    return new;
  end if;

  -- Empresa sem conta lançável da natureza: não há o que exigir.
  if not exists (
    select 1
      from public.contas_contabeis c
      join public.planos_contabeis p on p.id = c.plano_id and p.tenant_id = c.tenant_id
     where c.tenant_id = new.tenant_id
       and c.natureza = new.natureza_contabil
       and c.tipo = 'analitica'
       and c.ativo and c.deleted_at is null
       and p.ativo and p.deleted_at is null
  ) then
    return new;
  end if;

  raise exception 'Lancamento em % exige conta contabil: a empresa tem plano de contas montado e a classificacao passou a ser obrigatoria em %.',
    tg_table_name, data_corte::date
    using errcode = 'not_null_violation',
          hint = 'Selecione a conta contabil no formulario, ou desative as contas analiticas da natureza para voltar ao modo de categoria livre.';
end;
$$;

comment on function public.exige_conta_contabil() is
  'Fase 3: exige conta_contabil_id em lancamento criado a partir de 2026-09-09. Isenta o legado (por criado_em), suprimento/sangria e empresa sem conta analitica da natureza.';

drop trigger if exists trg_exige_conta_contabil_receitas on public.receitas;
create trigger trg_exige_conta_contabil_receitas
  before insert or update of conta_contabil_id on public.receitas
  for each row execute function public.exige_conta_contabil();

drop trigger if exists trg_exige_conta_contabil_despesas on public.despesas;
create trigger trg_exige_conta_contabil_despesas
  before insert or update of conta_contabil_id on public.despesas
  for each row execute function public.exige_conta_contabil();

drop trigger if exists trg_exige_conta_contabil_movimentacoes_caixa on public.movimentacoes_caixa;
create trigger trg_exige_conta_contabil_movimentacoes_caixa
  before insert or update of conta_contabil_id on public.movimentacoes_caixa
  for each row execute function public.exige_conta_contabil();
