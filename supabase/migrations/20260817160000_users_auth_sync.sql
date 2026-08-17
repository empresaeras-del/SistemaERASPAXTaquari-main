-- =============================================================================
-- MIGRATION: Autenticação e Gestão de Usuários (Users & Auth Sync)
-- Sistema ERAS PAX Taquari
-- =============================================================================

-- 1. Garante colunas na tabela public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS modulos_permitidos TEXT[] NOT NULL DEFAULT ARRAY['*'];
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Habilita RLS na tabela users com políticas completas para autenticados
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem próprio perfil ou admin vê todos" ON public.users;
DROP POLICY IF EXISTS "Apenas super_admin pode criar usuários" ON public.users;
DROP POLICY IF EXISTS "Admin pode atualizar usuários do seu tenant" ON public.users;
DROP POLICY IF EXISTS "Usuários autenticados veem usuários" ON public.users;
DROP POLICY IF EXISTS "Usuários autenticados criam usuários" ON public.users;
DROP POLICY IF EXISTS "Usuários autenticados atualizam usuários" ON public.users;
DROP POLICY IF EXISTS "Usuários autenticados deletam usuários" ON public.users;

CREATE POLICY "Usuários autenticados veem usuários"
ON public.users FOR SELECT TO authenticated
USING (deleted_at IS NULL);

CREATE POLICY "Usuários autenticados criam usuários"
ON public.users FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados atualizam usuários"
ON public.users FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Usuários autenticados deletam usuários"
ON public.users FOR DELETE TO authenticated
USING (true);

-- 3. Atualiza a função trigger para capturar metadados do signUp (user_metadata)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, tenant_id, nome, email, nivel, modulos_permitidos, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'tenant_id', NEW.raw_app_meta_data->>'tenant_id', 'default'),
    COALESCE(NEW.raw_user_meta_data->>'nome', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nivel', NEW.raw_app_meta_data->>'nivel', 'funcionario'),
    ARRAY['*'],
    'ativo'
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, public.users.nome),
    tenant_id = CASE WHEN EXCLUDED.tenant_id <> 'default' THEN EXCLUDED.tenant_id ELSE public.users.tenant_id END,
    nivel = COALESCE(EXCLUDED.nivel, public.users.nivel),
    status = 'ativo',
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Garante trigger ativo em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
