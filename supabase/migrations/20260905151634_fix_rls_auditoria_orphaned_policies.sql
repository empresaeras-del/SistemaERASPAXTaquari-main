-- =============================================================================
-- MIGRATION: Fechamento de RLS — auditoria (policies permissivas órfãs)
-- Sistema ERAS PAX Taquari
-- Data: 2026-09-05
-- =============================================================================
-- CONTEXTO
-- Mesma classe de bug já corrigida em 20260903120000 (9 tabelas) e em
-- 20260905150830 (requisicoes): 20260817120000 criou duas policies amplas em
-- 'auditoria' — "Usuários autenticados podem inserir auditoria" (INSERT,
-- WITH CHECK true) e "Admin pode ler auditoria" (SELECT, checa só o claim JWT
-- de nível, sem checar tenant_id). Um dia depois, 20260818010000 criou
-- "auditoria_tenant_policy" (FOR ALL, has_tenant_access(tenant_id)) — a
-- policy correta — mas não removeu as duas antigas. Policies permissivas do
-- mesmo comando se combinam com OR no Postgres, então:
--
--  - INSERT: qualquer usuário autenticado podia gravar uma linha de auditoria
--    com tenant_id de QUALQUER empresa (spoofing do log de outra empresa),
--    porque a policy de INSERT aberta (WITH CHECK true) prevalecia sobre a
--    de auditoria_tenant_policy.
--  - SELECT: has_tenant_access() já inclui bypass para is_super_admin()
--    internamente, então a policy "Admin pode ler auditoria" era redundante
--    para super_admin — mas para 'admin'/'gerente' (não super_admin), ela dava
--    leitura de auditoria de TODAS as empresas, sem checar tenant nenhum,
--    fora do padrão has_tenant_access usado no resto do schema.
--
-- Correção: mesmo padrão das migrations anteriores — remove dinamicamente
-- todas as policies hoje ativas na tabela antes de recriar exatamente uma,
-- cobrindo INSERT/SELECT/UPDATE/DELETE via has_tenant_access(tenant_id).
-- =============================================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auditoria'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.auditoria', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria_tenant_policy" ON auditoria
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

CREATE INDEX IF NOT EXISTS idx_auditoria_tenant_id ON auditoria(tenant_id);
