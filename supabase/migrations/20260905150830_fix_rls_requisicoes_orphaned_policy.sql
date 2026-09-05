-- =============================================================================
-- MIGRATION: Fechamento de RLS — requisicoes (policy permissiva órfã)
-- Sistema ERAS PAX Taquari
-- Data: 2026-09-05
-- =============================================================================
-- CONTEXTO
-- Auditoria de pg_policies em produção (motivada pelo mesmo padrão de bug já
-- corrigido em 20260903120000 para associados/dependentes/contratos/
-- contas_bancarias/fornecedores/receitas/parcelas_receber/despesas/
-- parcelas_pagar) encontrou o mesmo problema em 'requisicoes', que não estava
-- na lista de tabelas cobertas por aquela migration:
--
--   "Usuários autenticados gerenciam requisições" FOR ALL USING(true) WITH CHECK(true)
--   "requisicoes_tenant_policy"                    FOR ALL USING(has_tenant_access(tenant_id))
--
-- As duas coexistem. Policies permissivas do mesmo comando são combinadas com
-- OR no Postgres: a policy aberta (USING true) prevalece sobre a restritiva,
-- desativando o isolamento multi-tenant por completo para 'requisicoes' —
-- qualquer usuário autenticado, de qualquer tenant, podia ler/criar/editar/
-- excluir requisições (com dados de associado, paciente, CPF, procedimentos e
-- valores) de qualquer empresa.
--
-- Mesma correção: remove dinamicamente todas as policies hoje ativas na
-- tabela (via pg_policies) antes de recriar exatamente uma, no mesmo padrão
-- tenant_id + has_tenant_access() já usado no resto do schema.
-- =============================================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'requisicoes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.requisicoes', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE requisicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requisicoes_tenant_policy" ON requisicoes
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

CREATE INDEX IF NOT EXISTS idx_requisicoes_tenant_id ON requisicoes(tenant_id);
