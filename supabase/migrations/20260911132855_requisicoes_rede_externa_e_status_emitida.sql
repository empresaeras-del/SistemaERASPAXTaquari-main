-- Guia de rede externa não tem credenciado, e a coluna era NOT NULL: o insert morria com
-- 23502 e nenhuma guia de prestador externo jamais foi gravada. A FK continua valendo —
-- com MATCH SIMPLE, NULL a satisfaz —, então guia de credenciado segue amarrada à tabela.
alter table public.requisicoes
  alter column credenciado_id drop not null;

comment on column public.requisicoes.credenciado_id is
  'Credenciado da guia. NULL quando tipo_prestador = ''rede_externa'': aí o prestador é '
  'texto livre em credenciado_nome/credenciado_cnpj_cpf, porque não é cadastro nosso.';

-- O CHECK não conhecia 'emitida', que é o status com que o app cria toda guia
-- (StatusRequisicao = emitida | autorizada | realizada | cancelada). O insert falhava com
-- 23514 e o service reinseria como 'pendente' — a guia nascia com o status trocado, em
-- silêncio, e a tela foi remendada para tratar 'pendente' como 'emitida'.
-- 'pendente' e 'negada' ficam no CHECK: são o que as linhas antigas têm gravado.
alter table public.requisicoes
  drop constraint if exists requisicoes_status_check;

alter table public.requisicoes
  add constraint requisicoes_status_check
  check (status = any (array[
    'emitida'::text,
    'autorizada'::text,
    'realizada'::text,
    'cancelada'::text,
    'pendente'::text,
    'negada'::text
  ]));
