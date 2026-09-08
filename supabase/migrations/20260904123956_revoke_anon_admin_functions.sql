-- As funções admin_alterar_senha_usuario e admin_excluir_usuario já validam internamente
-- (auth.uid() + nivel do usuário) e são chamadas pelo app via cliente autenticado — por isso
-- mantemos EXECUTE para `authenticated`. Não há motivo legítimo para o role `anon` (não
-- autenticado) sequer tentar chamá-las; revogar aqui é defesa em profundidade, redundante com
-- a validação interna mas alinhada à recomendação do security advisor do Supabase.
-- Achado alto do Diagnóstico ERAS PAX de 04/09/2026 — Fase 1.
--
-- ATENÇÃO: esta migration, sozinha, NÃO fecha o acesso. Revogar de `anon` não basta, porque
-- as funções também têm EXECUTE concedido a PUBLIC (grant padrão do Postgres ao criar uma
-- função) e todo role, incluindo anon, herda privilégios de PUBLIC implicitamente.
-- Quem fecha de fato é a migration seguinte, 20260904124031_revoke_public_admin_functions.sql.
-- As duas ficam separadas de propósito: é assim que foram aplicadas em produção, e apagar o
-- passo insuficiente esconderia a lição de que revogar de `anon` isoladamente não tem efeito.
REVOKE EXECUTE ON FUNCTION public.admin_alterar_senha_usuario(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_excluir_usuario(uuid, boolean) FROM anon;
