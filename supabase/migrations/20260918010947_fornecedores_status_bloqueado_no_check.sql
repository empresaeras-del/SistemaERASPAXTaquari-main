-- O formulário de fornecedor oferece "Bloqueado / Suspenso" desde sempre, e
-- `StatusFornecedor` no TypeScript declara os três valores — mas o CHECK do banco só conhecia
-- 'ativo' e 'inativo'. Salvar um fornecedor bloqueado falhava com 23514, e nenhum fornecedor
-- com esse status jamais existiu.
--
-- É a mesma classe do CHECK de `requisicoes.status` que não conhecia 'emitida' (migration
-- 20260911132855): opção que a tela oferece e o banco recusa. Aqui o erro ao menos chega ao
-- operador — `useFornecedores` lança —, ao contrário daquele caso, em que havia um retry que
-- gravava com outro status e escondia o defeito por meses.
--
-- Verificado em transação revertida antes de aplicar: `update ... set status = 'bloqueado'`
-- levava 23514 / fornecedores_status_check.

alter table public.fornecedores
  drop constraint if exists fornecedores_status_check;
alter table public.fornecedores
  add constraint fornecedores_status_check
  check (status = any (array['ativo'::text, 'inativo'::text, 'bloqueado'::text]));
