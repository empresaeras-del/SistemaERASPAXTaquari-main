-- As funções admin_alterar_senha_usuario e admin_excluir_usuario já validam internamente
-- (auth.uid() + nivel do usuário) e são chamadas pelo app via cliente autenticado — por isso
-- mantemos EXECUTE para `authenticated`. Não há motivo legítimo para o role `anon` (não
-- autenticado) sequer tentar chamá-las; revogar aqui é defesa em profundidade, redundante com
-- a validação interna mas alinhada à recomendação do security advisor do Supabase.
-- Achado alto do Diagnóstico ERAS PAX de 04/09/2026 — Fase 1.
--
-- Nota: revogar apenas de `anon` não bastava — as funções também tinham EXECUTE concedido a
-- PUBLIC (grant padrão do Postgres ao criar uma função), e todo role, incluindo anon, herda
-- privilégios de PUBLIC implicitamente. É preciso revogar de PUBLIC e reconceder explicitamente
-- só para authenticated.
REVOKE EXECUTE ON FUNCTION public.admin_alterar_senha_usuario(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_excluir_usuario(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_alterar_senha_usuario(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_excluir_usuario(uuid, boolean) TO authenticated;
