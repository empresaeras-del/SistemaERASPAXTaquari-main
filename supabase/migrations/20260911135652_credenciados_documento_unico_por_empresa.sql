-- `credenciados_cnpj_cpf_key UNIQUE (cnpj_cpf)` era global: uma empresa que cadastrasse
-- uma clínica impedia TODAS as outras de cadastrar a mesma, com um 23505 que dizia
-- "já existe um credenciado com este CNPJ/CPF" apontando para um registro que o operador
-- nem podia enxergar (a RLS esconde o de outra empresa). Duplicidade é por empresa.
alter table public.credenciados
  drop constraint if exists credenciados_cnpj_cpf_key;

-- Índice parcial, não constraint de tabela, por duas razões que a constraint não alcança:
--
-- 1. `where cnpj_cpf is not null` preserva a regra de "campo opcional grava NULL": vários
--    credenciados sem documento continuam convivendo na mesma empresa. Uma constraint
--    simples também permitiria isso, mas o predicado deixa a intenção explícita.
-- 2. `nulls not distinct` fecha o buraco do tenant: `tenant_id` é nullable, e no padrão
--    (NULLS DISTINCT) dois registros com tenant nulo e o mesmo documento não colidiriam —
--    a unicidade simplesmente não valeria para eles. Como o predicado já exclui documento
--    nulo, o `nulls not distinct` só age sobre `tenant_id`, que é o que se quer.
create unique index if not exists credenciados_tenant_documento_uk
  on public.credenciados (tenant_id, cnpj_cpf) nulls not distinct
  where cnpj_cpf is not null;

comment on index public.credenciados_tenant_documento_uk is
  'CNPJ/CPF único POR EMPRESA. Empresas diferentes podem credenciar o mesmo prestador — '
  'é o caso normal, não uma duplicidade. Documento em branco grava NULL e fica fora do '
  'índice, então vários credenciados sem documento coexistem na mesma empresa.';
