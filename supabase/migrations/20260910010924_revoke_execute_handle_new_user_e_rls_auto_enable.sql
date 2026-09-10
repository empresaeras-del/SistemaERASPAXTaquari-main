-- Fecha as duas últimas funções de trigger expostas como RPC.
--
-- `handle_new_user()` (trigger `on_auth_user_created` em auth.users) e `rls_auto_enable()`
-- (event trigger `ensure_rls` em ddl_command_end) nasceram com EXECUTE para PUBLIC/anon/
-- authenticated — o grant padrão do Postgres mais o que o Supabase concede ao schema
-- `public` — e por isso aparecem nos advisors de segurança como chamáveis sem login.
--
-- NÃO SÃO EXPLORÁVEIS, e isso foi verificado antes de classificar: o Postgres recusa a
-- chamada direta de função de trigger e de event trigger com SQLSTATE 0A000
-- ("trigger functions can only be called as triggers"). Esta migration fecha superfície
-- exposta; não corrige brecha aberta. É a mesma higiene da `20260909171259`, que cobriu as
-- três funções de trigger do módulo contábil e deixou estas duas de fora por não serem
-- dele.
--
-- O RISCO REAL DA CORREÇÃO NÃO É DE SEGURANÇA — é quebrar algo em silêncio, e aqui vale
-- mais do que valia lá, porque estas duas não são do módulo contábil:
--   * `handle_new_user` é o CAMINHO DE CADASTRO: sem ele, um usuário novo entra em
--     auth.users e nunca ganha a linha correspondente em public.users — cadastra e não
--     consegue usar o sistema, sem erro visível no ato.
--   * `rls_auto_enable` é a REDE DE SEGURANÇA DO RLS: sem ele, toda tabela criada dali em
--     diante nasce sem RLS habilitado. Uma regressão que só apareceria numa auditoria
--     futura, meses depois.
--
-- Por isso a revogação foi testada ANTES de ser aplicada, dentro de uma transação revertida
-- (revoke + exercício dos dois gatilhos + RAISE EXCEPTION):
--   * inserção real em auth.users => public.users foi de 4 para 5 linhas: o trigger de
--     cadastro disparou normalmente;
--   * `create table` em public => relrowsecurity = true na tabela nova: o event trigger
--     disparou normalmente.
-- Confirma, agora nestes dois casos, que o EXECUTE só é verificado na chamada direta e
-- nunca na invocação pelo gatilho.
--
-- Revoga de PUBLIC **e** dos papéis: aqui coexistem o grant implícito de PUBLIC
-- (`=X/postgres` na ACL) e grants explícitos para anon/authenticated, então revogar de um
-- lado só deixaria o outro de pé — a lição do par revoke_anon/revoke_public.

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

comment on function public.handle_new_user() is
  'Trigger de auth.users (on_auth_user_created): cria/atualiza a linha correspondente em public.users. Função de trigger — NÃO deve ter EXECUTE para PUBLIC/anon/authenticated; o gatilho dispara sem depender desse grant (verificado com inserção real em transação revertida).';

comment on function public.rls_auto_enable() is
  'Event trigger (ensure_rls, ddl_command_end): habilita RLS automaticamente em toda tabela nova do schema public. Função de event trigger — NÃO deve ter EXECUTE para PUBLIC/anon/authenticated; o gatilho dispara sem depender desse grant (verificado com CREATE TABLE em transação revertida).';
