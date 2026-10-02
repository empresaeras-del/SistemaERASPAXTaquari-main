-- Ajuste manual, por associado, do limite de vidas do plano coletivo e do valor da
-- mensalidade -- sem alterar o plano, que continua servindo todos os outros associados.
--
-- Medido na producao antes de criar: os 3 planos coletivos tem limite_vidas = 2 e 11 dos 16
-- associados ativos EXCEDEM esse limite (ate 7 vidas). O limite do plano, como esta, nao
-- descreve o negocio: o acordo real e por familia.

alter table public.associados
  add column if not exists limite_vidas_personalizado integer,
  add column if not exists valor_mensalidade_exclusivo numeric(12,2);

comment on column public.associados.limite_vidas_personalizado is
  'Limite de vidas acordado SO para este associado, sobrepondo planos_pax.limite_vidas. NULL = usa o do plano. Vale apenas para plano coletivo (no individual nao ha limite). Resolvido por utils/limiteVidasColetivo.ts, nunca lido direto.';

comment on column public.associados.valor_mensalidade_exclusivo is
  'Valor CHEIO da mensalidade acordado so para este associado, sobrepondo o calculo do plano. NULL = usa o calculo (individual: valor x vidas; coletivo: valor base). Zero e valor valido (cortesia), por isso a ausencia e NULL e nao 0. Quem manda e esta coluna; associados.valor_plano passa a ser o SNAPSHOT do resultado, como categoria ao lado de conta_contabil_id.';

-- Limite personalizado negativo ou zero nao e acordo, e dado quebrado: um zero aqui
-- esconderia todas as vidas do associado atras do aviso de excesso.
alter table public.associados
  drop constraint if exists associados_limite_vidas_personalizado_check;
alter table public.associados
  add constraint associados_limite_vidas_personalizado_check
  check (limite_vidas_personalizado is null or limite_vidas_personalizado >= 1);

-- Mensalidade negativa viraria receita negativa no caixa -- a mesma recusa que
-- utils/valorParcelaManual.ts ja aplica ao valor digitado por parcela.
alter table public.associados
  drop constraint if exists associados_valor_mensalidade_exclusivo_check;
alter table public.associados
  add constraint associados_valor_mensalidade_exclusivo_check
  check (valor_mensalidade_exclusivo is null or valor_mensalidade_exclusivo >= 0);
