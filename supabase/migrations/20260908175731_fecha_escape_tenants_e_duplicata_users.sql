-- Fecha os dois achados de severidade baixa do Raio-X de 08/09/2026: um usuário sem
-- tenant no claim conseguia enxergar e criar empresas, e `users` tinha uma policy de
-- SELECT duplicada.
--
-- ## tenants: a concessão "sem tenant, sem restrição" nunca tinha uso legítimo
--
-- tenants_select_policy e tenants_insert_policy liberavam acesso sempre que
-- current_tenant_id() IS NULL -- pensada, pelo comentário original, como uma concessão
-- "de migração" para um usuário sem tenant ainda atribuído.
--
-- Essa situação não existe no fluxo real do sistema: handle_new_user() sempre grava
-- tenant_id com um valor (o do metadata, ou 'default' como último recurso) -- nunca NULL --
-- e hoje, em produção, 0 linhas de `users` têm tenant_id nulo. A única forma de um usuário
-- autenticado cair em current_tenant_id() IS NULL seria um estado de dado corrompido, não
-- um passo do cadastro. E o próprio frontend só mostra a aba de gerenciar empresas
-- (Configuracoes.tsx, ConfigEmpresasTab) para nivel === 'super_admin' -- criar/listar tenant
-- já era, na intenção do produto, uma operação de super_admin.
--
-- A concessão então não abria nada que o app precisasse; só dava a qualquer usuário nesse
-- estado a capacidade de listar todas as empresas e criar empresas novas via API direta,
-- contornando o gate da tela.
--
-- ## users: policy de SELECT duplicada, sem brecha mas arriscada de manter
--
-- "Usuários autenticados veem usuários" e users_select_policy eram, na prática, a mesma
-- regra -- has_tenant_access() já embute is_super_admin() internamente, então o
-- `is_super_admin() OR` extra em users_select_policy não muda o resultado. Sem brecha, mas
-- é o mesmo formato do achado crítico da PR #14 (policy antiga convivendo com a nova) --
-- vale remover para a próxima varredura de pg_policies não ter que reconferir se é inócua.

DROP POLICY IF EXISTS tenants_select_policy ON public.tenants;
CREATE POLICY tenants_select_policy ON public.tenants
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (is_super_admin() OR (id)::text = current_tenant_id())
  );

DROP POLICY IF EXISTS tenants_insert_policy ON public.tenants;
CREATE POLICY tenants_insert_policy ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Usuários autenticados veem usuários" ON public.users;
