-- =============================================================================
-- MIGRATION: Correções de RLS e Auditoria (Prioridade Alta)
-- Sistema ERAS PAX Taquari
-- Data: 2026-08-18
-- =============================================================================

-- 1. Corrige RLS da tabela users (Filtra por tenant e restringe visão global)
DROP POLICY IF EXISTS "Usuários autenticados veem usuários" ON public.users;

CREATE POLICY "Usuários autenticados veem usuários"
ON public.users FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    id = auth.uid() OR
    has_tenant_access(tenant_id)
  )
);

-- 2. Consolida políticas RLS da tabela tenants
DROP POLICY IF EXISTS "Usuários autenticados gerenciam tenants (ALL)" ON public.tenants;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam tenants" ON public.tenants;

-- Mantém as políticas granulares de SELECT, INSERT, UPDATE e DELETE definidas em 20260817150000

-- 3. Corrige registrar_audit RPC para ignorar user_id externo
CREATE OR REPLACE FUNCTION registrar_audit(
  user_id   TEXT,
  acao      TEXT,
  detalhes  JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id TEXT;
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  
  -- Tenta obter tenant_id do JWT
  BEGIN
    v_tenant_id := (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id');
  EXCEPTION WHEN OTHERS THEN
    v_tenant_id := 'system';
  END;

  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    v_tenant_id := 'system';
  END IF;

  INSERT INTO auditoria (tenant_id, usuario_id, acao, detalhes)
  VALUES (v_tenant_id, COALESCE(v_uid::TEXT, 'system'), acao, COALESCE(detalhes, '{}'::jsonb));
END;
$$;
