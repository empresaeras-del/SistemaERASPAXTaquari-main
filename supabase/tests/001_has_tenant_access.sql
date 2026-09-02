-- pgTAP: comportamento de has_tenant_access() / current_tenant_id() / is_super_admin()
-- Cobre em especial a regressão do bug corrigido em
-- 20260831190000_fix_tenant_rls_and_credenciados.sql: uma versão anterior de
-- has_tenant_access() liberava acesso a QUALQUER registro sempre que
-- current_tenant_id() ou record_tenant_id fossem NULL.
BEGIN;
SELECT plan(10);

-- Sessão sem nenhum claim (equivalente a um usuário sem tenant e sem linha em users)
SELECT is(current_tenant_id(), NULL, 'current_tenant_id() é NULL sem claims e sem linha em public.users');
SELECT is(is_super_admin(), false, 'is_super_admin() é false sem claims');

-- Usuário comum do tenant "tenant-a"
SELECT set_config(
  'request.jwt.claims',
  json_build_object('app_metadata', json_build_object('tenant_id', 'tenant-a', 'nivel', 'funcionario'))::text,
  true
);

SELECT is(current_tenant_id(), 'tenant-a', 'current_tenant_id() lê o tenant_id do app_metadata do JWT');
SELECT ok(has_tenant_access('tenant-a'), 'usuário do tenant-a acessa registro do próprio tenant');
SELECT ok(NOT has_tenant_access('tenant-b'), 'usuário do tenant-a NÃO acessa registro do tenant-b');

-- Regressão do bug corrigido: um registro sem tenant_id (NULL) não pode ficar
-- visível para um usuário que TEM tenant definido.
-- Nota: has_tenant_access(NULL) aqui retorna SQL NULL, não FALSE (o "IN" com
-- NULL do lado esquerdo é NULL em lógica de 3 valores) — e é exatamente assim
-- que o RLS do Postgres já trata isso: uma política USING que avalia para
-- NULL esconde a linha, do mesmo jeito que FALSE. "IS NOT TRUE" testa esse
-- comportamento efetivo, em vez de exigir um FALSE booleano literal.
SELECT ok(
  has_tenant_access(NULL) IS NOT TRUE,
  'usuário com tenant definido NÃO acessa registro com tenant_id NULL (bug do bypass corrigido em 2026-08-31)'
);

-- Registros marcados como globais são visíveis para qualquer tenant
SELECT ok(has_tenant_access('default_tenant'), 'registro "default_tenant" é visível para qualquer tenant');
SELECT ok(has_tenant_access('empresa_padrao'), 'registro "empresa_padrao" é visível para qualquer tenant');
SELECT ok(has_tenant_access('all'), 'registro "all" é visível para qualquer tenant');

-- Super admin ignora o isolamento por tenant
SELECT set_config(
  'request.jwt.claims',
  json_build_object('app_metadata', json_build_object('tenant_id', 'tenant-a', 'nivel', 'super_admin'))::text,
  true
);
SELECT ok(has_tenant_access('tenant-b'), 'super_admin acessa registros de qualquer tenant');

SELECT * FROM finish();
ROLLBACK;
