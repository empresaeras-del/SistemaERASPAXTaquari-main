-- Envolve em (select ...) toda chamada SEM ARGUMENTO das policies de users e
-- notificacoes, para o Postgres avalia-la uma vez por consulta (InitPlan) em vez
-- de uma vez por linha. Fecha as 7 ocorrencias do advisor auth_rls_initplan.
--
-- O que NAO muda: has_tenant_access(tenant_id) recebe a coluna, depende da linha
-- e por isso nao pode ser icada. Inlinar o corpo dela aqui hoistaria o custo, mas
-- copiaria a regra de tenant para dentro de 7 policies -- exatamente o predicado
-- repetido em dois lugares que este schema ja pagou caro. Fica como esta.
--
-- ALTER POLICY (e nao DROP/CREATE) preserva cmd e roles de cada policy: as 8
-- continuam TO authenticated, como manda a convencao das 41.

alter policy users_select_policy on public.users
  using (
    deleted_at is null
    and (
      (select is_super_admin())
      or id = (select auth.uid())
      or has_tenant_access(tenant_id)
    )
  );

alter policy users_insert_policy on public.users
  with check (
    (select is_super_admin())
    or id = (select auth.uid())
    or has_tenant_access(tenant_id)
  );

alter policy users_update_policy on public.users
  using (
    (select is_super_admin())
    or id = (select auth.uid())
    or ((select current_user_nivel()) = any (array['admin','gerente']) and has_tenant_access(tenant_id))
  )
  with check (
    (select is_super_admin())
    or id = (select auth.uid())
    or ((select current_user_nivel()) = any (array['admin','gerente']) and has_tenant_access(tenant_id))
  );

alter policy users_delete_policy on public.users
  using (
    (select is_super_admin())
    or (
      (select current_user_nivel()) = 'admin'
      and has_tenant_access(tenant_id)
      and id <> (select auth.uid())
    )
  );

alter policy notificacoes_select_policy on public.notificacoes
  using (
    (select is_super_admin())
    or usuario_id = (select auth.uid())::text
    or (tenant_id is not null and has_tenant_access(tenant_id))
  );

alter policy notificacoes_update_policy on public.notificacoes
  using (
    (select is_super_admin())
    or usuario_id = (select auth.uid())::text
    or (tenant_id is not null and has_tenant_access(tenant_id))
  )
  with check (
    (select is_super_admin())
    or (tenant_id is not null and has_tenant_access(tenant_id))
  );

alter policy notificacoes_delete_policy on public.notificacoes
  using (
    (select is_super_admin())
    or usuario_id = (select auth.uid())::text
    or (tenant_id is not null and has_tenant_access(tenant_id))
  );

-- Esta oitava NAO estava no advisor: o WITH CHECK dela nao tem auth.<fn>() direta.
-- Entra porque e a MESMA expressao do WITH CHECK da notificacoes_update_policy
-- acima; deixar so uma das duas com (select ...) e como as duas metades de um
-- predicado repetido comecam a divergir.
alter policy notificacoes_insert_policy on public.notificacoes
  with check (
    (select is_super_admin())
    or (tenant_id is not null and has_tenant_access(tenant_id))
  );
