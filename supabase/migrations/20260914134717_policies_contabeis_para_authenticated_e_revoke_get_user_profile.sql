-- Fecha o único caminho em que o papel `anon` era avaliado por uma policy deste schema,
-- e revoga uma função SECURITY DEFINER que ninguém chama.
--
-- ## As três policies `TO public`
--
-- 38 das 41 policies do schema são `TO authenticated` — é o PAPEL que barra quem não fez
-- login, não o predicado. As três tabelas do módulo contábil nasceram `TO public`, e
-- `public` inclui `anon`: nelas o anônimo chegava a ser avaliado por
-- `has_tenant_access(tenant_id)`.
--
-- Ler, ele não lia: as três colunas são `NOT NULL` e `has_tenant_access('<valor>')` é falso
-- sem login. Mas **o `WITH CHECK` passava**: `has_tenant_access(NULL)` devolve VERDADEIRO
-- para o anônimo, porque a terceira cláusula da função é
-- `(record_tenant_id IS NULL AND current_tenant_id() IS NULL)` e os dois lados são nulos sem
-- JWT. O insert só era recusado pelo `NOT NULL` da coluna (`23502`) — uma constraint de
-- coluna era a única coisa entre um anônimo e uma escrita.
--
-- Isso não vazava nada hoje, e é justamente por isso que merecia correção agora: 11 tabelas
-- deste schema já têm `tenant_id` nulável, e no dia em que alguém afrouxar essa coluna, ou
-- copiar uma destas policies para uma tabela nulável, a porta abre sem nenhum aviso.
--
-- Exercitado em transação revertida antes de aplicar (a regra do CLAUDE.md para permissão
-- cujo caminho de falha é silencioso): depois da mudança o anônimo passa a levar `42501`
-- da POLICY — não mais `23502` da coluna — e o admin logado continua lendo os 2 planos,
-- 58 contas e 7 centros da empresa dele, e 0 da outra.
ALTER POLICY planos_contabeis_tenant_policy ON public.planos_contabeis TO authenticated;
ALTER POLICY contas_contabeis_tenant_policy ON public.contas_contabeis TO authenticated;
ALTER POLICY centros_custo_tenant_policy    ON public.centros_custo    TO authenticated;

-- ## `get_user_profile()`
--
-- É a única SECURITY DEFINER chamável por `anon` que NÃO é auxiliar de RLS (as quatro que
-- são — has_tenant_access, current_tenant_id, current_user_nivel, is_super_admin — não podem
-- perder EXECUTE, como o CLAUDE.md registra e uma transação revertida já comprovou).
--
-- Ela filtra por `auth.uid()`, então devolvia 0 linhas para o anônimo mesmo com 7 usuários
-- cadastrados — não era explorável. Sai porque **nenhuma linha do `src/` a chama**: é
-- superfície exposta sem nada do outro lado.
--
-- Revoga de PUBLIC **e** de anon: a ACL era `=X/postgres` mais grants explícitos, então
-- revogar só de `anon` deixaria o grant implícito de PUBLIC valendo por herança — a lição do
-- par `revoke_anon_admin_functions`/`revoke_public_admin_functions`.
REVOKE EXECUTE ON FUNCTION public.get_user_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_profile() FROM anon;
