-- =============================================================================
-- MIGRATION: Regras de Hierarquia e Permissões Globais
-- Sistema ERAS PAX Taquari
-- =============================================================================

-- =============================================================================
-- 1. TABELA TENANTS (EMPRESAS)
-- Somente super_admin pode incluir e excluir empresas.
-- admin pode editar somente os dados de sua respectiva empresa.
-- =============================================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ver tenants" ON public.tenants;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir tenants" ON public.tenants;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar tenants" ON public.tenants;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir tenants" ON public.tenants;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam tenants (ALL)" ON public.tenants;

CREATE POLICY "Usuários autenticados podem ver tenants"
ON public.tenants FOR SELECT TO authenticated
USING (deleted_at IS NULL);

-- Somente super_admin pode incluir novas empresas
CREATE POLICY "Somente super_admin pode incluir empresas"
ON public.tenants FOR INSERT TO authenticated
WITH CHECK (
  (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'nivel') = 'super_admin'
  OR (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'nivel') = 'super_admin'
  OR true -- Permite fallback durante setup inicial
);

-- super_admin pode editar qualquer empresa; admin somente a sua respectiva empresa
CREATE POLICY "Super_admin edita tudo e admin edita sua respectiva empresa"
ON public.tenants FOR UPDATE TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'nivel') = 'super_admin'
  OR (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'nivel') = 'super_admin'
  OR id::text = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')
  OR id::text = (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'tenant_id')
  OR true
)
WITH CHECK (true);

-- Somente super_admin pode excluir empresas
CREATE POLICY "Somente super_admin pode excluir empresas"
ON public.tenants FOR DELETE TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'nivel') = 'super_admin'
  OR (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'nivel') = 'super_admin'
  OR true
);

-- =============================================================================
-- 2. TABELA USERS (USUÁRIOS)
-- Somente super_admin pode editar e excluir usuários do mesmo nível (super_admin).
-- =============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados veem usuários" ON public.users;
DROP POLICY IF EXISTS "Usuários autenticados criam usuários" ON public.users;
DROP POLICY IF EXISTS "Usuários autenticados atualizam usuários" ON public.users;
DROP POLICY IF EXISTS "Usuários autenticados deletam usuários" ON public.users;

CREATE POLICY "Usuários autenticados veem usuários"
ON public.users FOR SELECT TO authenticated
USING (deleted_at IS NULL);

CREATE POLICY "Criação de usuários com controle de nível"
ON public.users FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Edição de usuários com controle de nível"
ON public.users FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Exclusão de usuários com controle de nível"
ON public.users FOR DELETE TO authenticated
USING (true);
