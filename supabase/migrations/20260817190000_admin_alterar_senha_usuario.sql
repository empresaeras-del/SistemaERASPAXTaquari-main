-- =============================================================================
-- MIGRATION: Função RPC para alteração de senha de usuários (Supabase Auth)
-- Permite ao Super Admin ou ao próprio usuário alterar a senha
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION admin_alterar_senha_usuario(
  target_user_id UUID,
  new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_current_user_id UUID;
  v_current_nivel TEXT;
BEGIN
  v_current_user_id := auth.uid();
  
  -- Obtém o nível do usuário solicitante na tabela public.users ou via JWT
  v_current_nivel := current_user_nivel();

  -- Se for super_admin OU se for o próprio usuário
  IF v_current_nivel = 'super_admin' OR v_current_user_id = target_user_id THEN
    -- Validação do tamanho mínimo exigido pelo Supabase Auth
    IF LENGTH(new_password) < 6 THEN
      RAISE EXCEPTION 'A nova senha deve ter no mínimo 6 caracteres.';
    END IF;

    -- Atualiza a senha criptografada em auth.users
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf')),
        updated_at = NOW()
    WHERE id = target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Senha alterada com sucesso.');
  ELSE
    RAISE EXCEPTION 'Permissão negada. Apenas Super Administradores ou o próprio usuário podem alterar esta senha.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_alterar_senha_usuario(UUID, TEXT) TO authenticated;
