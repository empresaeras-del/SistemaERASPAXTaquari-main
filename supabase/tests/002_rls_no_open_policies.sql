-- pgTAP: nenhuma tabela multi-tenant pode ter uma política de RLS totalmente
-- aberta (USING ou WITH CHECK = true) convivendo com sua política de tenant.
--
-- Isso é exatamente o padrão de bug que este arquivo existe para prevenir:
-- o Postgres combina políticas permissivas com OR, então basta UMA política
-- sem checagem de tenant para anular o isolamento inteiro da tabela — mesmo
-- que exista, ao lado dela, uma política corretamente restrita. Já aconteceu
-- mais de uma vez neste projeto (ver 20260902020000_fix_open_rls_policies_tenant_leak.sql).
--
-- Este teste é uma varredura automática, não uma lista fixa de tabelas: ele
-- pega toda tabela com coluna tenant_id e falha se alguma política sua tiver
-- USING ou WITH CHECK literalmente "true".
BEGIN;
SELECT plan(1);

SELECT is(
  COALESCE(array_agg(DISTINCT p.tablename || '.' || p.policyname ORDER BY p.tablename || '.' || p.policyname), ARRAY[]::text[]),
  ARRAY[]::text[],
  'nenhuma política totalmente aberta (USING/WITH CHECK = true) em tabela com coluna tenant_id'
)
FROM pg_policies p
JOIN information_schema.columns c
  ON c.table_schema = p.schemaname
 AND c.table_name = p.tablename
 AND c.column_name = 'tenant_id'
WHERE p.schemaname = 'public'
  AND (p.qual = 'true' OR p.with_check = 'true');

SELECT * FROM finish();
ROLLBACK;
