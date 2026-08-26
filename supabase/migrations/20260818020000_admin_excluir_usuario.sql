-- =============================================================================
-- MIGRATION: Função RPC para exclusão segura de usuários (Soft Delete & Auth Sync)
-- Permite ao Super Admin ou Admin autorizado excluir/desativar usuários
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_excluir_usuario(
  target_user_id UUID,
  hard_delete BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_current_user_id UUID;
  v_current_nivel TEXT;
  v_current_tenant_id TEXT;
  v_target_nivel TEXT;
  v_target_tenant_id TEXT;
BEGIN
  v_current_user_id := auth.uid();

  -- Impede auto-exclusão
  IF v_current_user_id = target_user_id THEN
    RAISE EXCEPTION 'Não é permitido excluir o próprio usuário conectado.';
  END IF;

  -- Obtém dados do usuário solicitante
  SELECT nivel, tenant_id INTO v_current_nivel, v_current_tenant_id
  FROM public.users
  WHERE id = v_current_user_id;

  -- Fallback para JWT claims se não encontrou na tabela
  IF v_current_nivel IS NULL THEN
    v_current_nivel := COALESCE(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'nivel'),
      (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'nivel')
    );
  END IF;

  IF v_current_tenant_id IS NULL THEN
    v_current_tenant_id := COALESCE(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'),
      (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'tenant_id')
    );
  END IF;

  -- Obtém dados do usuário alvo
  SELECT nivel, tenant_id INTO v_target_nivel, v_target_tenant_id
  FROM public.users
  WHERE id = target_user_id;

  -- Validação de permissões
  IF v_current_nivel = 'super_admin' THEN
    -- Super admin tem permissão total
    NULL;
  ELSIF v_current_nivel = 'admin' THEN
    -- Admin só pode excluir usuários do mesmo tenant e não pode excluir outros admins ou super_admins
    IF v_target_nivel IN ('super_admin', 'admin') THEN
      RAISE EXCEPTION 'Permissão negada. Somente o Super Admin pode excluir administradores.';
    END IF;

    IF v_target_tenant_id IS DISTINCT FROM v_current_tenant_id THEN
      RAISE EXCEPTION 'Permissão negada. Você só pode excluir usuários da sua respectiva empresa.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Permissão negada. Apenas administradores podem excluir usuários.';
  END IF;

  IF hard_delete THEN
    -- Exclusão definitiva
    DELETE FROM public.users WHERE id = target_user_id;
    BEGIN
      DELETE FROM auth.users WHERE id = target_user_id;
    EXCEPTION WHEN OTHERS THEN
      -- Silencia se não conseguir deletar de auth.users diretamente
      NULL;
    END;
    RETURN jsonb_build_object('success', true, 'message', 'Usuário excluído definitivamente com sucesso.');
  ELSE
    -- Soft delete (padrão)
    UPDATE public.users
    SET deleted_at = NOW(),
        status = 'inativo',
        updated_at = NOW()
    WHERE id = target_user_id;

    -- Desativa acesso no auth.users (ban)
    BEGIN
      UPDATE auth.users
      SET banned_until = '2999-01-01 00:00:00+00'::TIMESTAMPTZ,
          updated_at = NOW()
      WHERE id = target_user_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object('success', true, 'message', 'Usuário desativado/excluído com sucesso.');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_excluir_usuario(UUID, BOOLEAN) TO authenticated;
