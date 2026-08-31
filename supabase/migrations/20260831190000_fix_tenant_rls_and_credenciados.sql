-- =============================================================================
-- MIGRATION: Correção de RLS Multi-Tenant — Isolamento por Empresa
-- Sistema ERAS PAX Taquari
-- Data: 2026-08-31
-- =============================================================================
-- Objetivo:
--   1. Corrigir has_tenant_access() para não permitir bypass via NULL
--   2. Corrigir RLS de credenciados_planos e credenciados_procedimentos
--      para herdar o tenant do credenciado pai
--   3. Garantir que credenciados sem tenant_id não sejam visíveis
--      para usuários de outras empresas
-- =============================================================================

-- =============================================================================
-- 1. FUNÇÃO has_tenant_access — versão segura sem bypass via NULL
-- =============================================================================
-- A versão anterior permitia que usuários sem tenant_id vissem tudo
-- (cláusula: OR current_tenant_id() IS NULL). Isso é um risco de segurança.
-- A nova versão só faz bypass para super_admin.
-- =============================================================================

CREATE OR REPLACE FUNCTION has_tenant_access(record_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT (
    -- Super-admin vê tudo, sempre
    is_super_admin()
    -- Tenant do registro bate com o tenant do usuário
    OR (
      record_tenant_id IS NOT NULL
      AND current_tenant_id() IS NOT NULL
      AND record_tenant_id = current_tenant_id()
    )
    -- Registros marcados como globais (compartilhados entre empresas)
    OR record_tenant_id IN ('default_tenant', 'empresa_padrao', 'all')
    -- Registros sem tenant_id são acessíveis apenas se o usuário também não tem tenant
    -- (situação de migração de dados antigos, aceita com cautela)
    OR (record_tenant_id IS NULL AND current_tenant_id() IS NULL)
  );
$$;

GRANT EXECUTE ON FUNCTION has_tenant_access(TEXT) TO authenticated, anon;

-- =============================================================================
-- 2. FUNÇÃO is_super_admin — garantir que depende de current_user_nivel()
-- (sem alterações, apenas re-criando para garantir consistência)
-- =============================================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(current_user_nivel() = 'super_admin', false);
$$;

-- =============================================================================
-- 3. CORRIGIR RLS de credenciados_planos
-- Precisa verificar se o credenciado pai pertence ao tenant do usuário
-- =============================================================================
ALTER TABLE credenciados_planos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credenciados_planos_tenant_policy" ON credenciados_planos;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam credenciados_planos" ON credenciados_planos;

-- Política via JOIN com a tabela credenciados para herdar o tenant
CREATE POLICY "credenciados_planos_tenant_policy" ON credenciados_planos
FOR ALL TO authenticated
USING (
  is_super_admin()
  OR EXISTS (
    SELECT 1 FROM credenciados c
    WHERE c.id = credenciados_planos.credenciado_id
      AND has_tenant_access(c.tenant_id)
  )
)
WITH CHECK (
  is_super_admin()
  OR EXISTS (
    SELECT 1 FROM credenciados c
    WHERE c.id = credenciados_planos.credenciado_id
      AND has_tenant_access(c.tenant_id)
  )
);

-- =============================================================================
-- 4. CORRIGIR RLS de credenciados_procedimentos
-- Precisa verificar se o credenciado pai pertence ao tenant do usuário
-- =============================================================================
ALTER TABLE credenciados_procedimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credenciados_procedimentos_tenant_policy" ON credenciados_procedimentos;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam credenciados_procedimentos" ON credenciados_procedimentos;

-- Política via JOIN com a tabela credenciados para herdar o tenant
CREATE POLICY "credenciados_procedimentos_tenant_policy" ON credenciados_procedimentos
FOR ALL TO authenticated
USING (
  is_super_admin()
  OR EXISTS (
    SELECT 1 FROM credenciados c
    WHERE c.id = credenciados_procedimentos.credenciado_id
      AND has_tenant_access(c.tenant_id)
  )
)
WITH CHECK (
  is_super_admin()
  OR EXISTS (
    SELECT 1 FROM credenciados c
    WHERE c.id = credenciados_procedimentos.credenciado_id
      AND has_tenant_access(c.tenant_id)
  )
);

-- =============================================================================
-- 5. GARANTIR que credenciados tem RLS ativa com política correta
-- =============================================================================
ALTER TABLE credenciados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credenciados_tenant_policy" ON credenciados;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam credenciados" ON credenciados;

CREATE POLICY "credenciados_tenant_policy" ON credenciados
FOR ALL TO authenticated
USING (
  deleted_at IS NULL
  AND has_tenant_access(tenant_id)
)
WITH CHECK (
  has_tenant_access(tenant_id)
);

-- =============================================================================
-- 6. ATUALIZAR registros legados de credenciados sem tenant_id
-- Marca como 'default_tenant' para que sejam acessíveis durante migração
-- NOTA: Execute manualmente na produção após verificar quais registros são afetados
-- =============================================================================
-- UPDATE credenciados
-- SET tenant_id = 'default_tenant', empresa_id = 'default_tenant'
-- WHERE tenant_id IS NULL OR tenant_id = '';

-- =============================================================================
-- 7. ÍNDICES para performance das políticas RLS
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_credenciados_tenant_id ON credenciados(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credenciados_empresa_id ON credenciados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_credenciados_deleted_at ON credenciados(deleted_at);
CREATE INDEX IF NOT EXISTS idx_credenciados_planos_credenciado ON credenciados_planos(credenciado_id);
CREATE INDEX IF NOT EXISTS idx_credenciados_proc_credenciado ON credenciados_procedimentos(credenciado_id);
