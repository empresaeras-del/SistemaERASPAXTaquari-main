-- Correção: revogar de `anon` sozinho não bastava — as funções ainda tinham EXECUTE concedido
-- a PUBLIC (grant padrão do Postgres ao criar uma função), e todo role, incluindo anon, herda
-- privilégios de PUBLIC implicitamente. Revoga de PUBLIC e reconcede explicitamente só para
-- authenticated, que é quem o app realmente usa (validado no código: usuariosService.ts chama
-- via supabase.rpc() com o cliente autenticado).
REVOKE EXECUTE ON FUNCTION public.admin_alterar_senha_usuario(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_excluir_usuario(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_alterar_senha_usuario(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_excluir_usuario(uuid, boolean) TO authenticated;
