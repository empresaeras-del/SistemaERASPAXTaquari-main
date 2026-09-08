-- Fecha a injeção de notificações entre empresas — e remove o último valor coringa.
--
-- ## O buraco
--
-- As quatro policies de `notificacoes` aceitavam três escapes que nenhuma cláusula
-- qualificava por tenant:
--
--   * `usuario_id = 'all'`  — sem checar a empresa de quem lê
--   * `tenant_id IS NULL`
--   * `tenant_id = 'all'`
--
-- No INSERT isso significava que **qualquer usuário autenticado** podia criar uma
-- notificação que aparecia no sino de todas as empresas, com título, mensagem e link
-- livres. E o UPDATE tinha `WITH CHECK (true)`: quem podia editar uma notificação da
-- própria empresa podia reescrevê-la para o escopo global pela mesma porta.
--
-- ## A premissa errada da migration anterior
--
-- A 20260908123443 manteve `record_tenant_id = 'all'` em `has_tenant_access()` sob a
-- justificativa de que era "o marcador de transmissão das notificações". A conferência
-- feita agora mostra que essa transmissão não existe:
--
--   notificações com usuario_id = 'all' ....... 0
--   notificações com tenant_id IS NULL ........ 0
--   notificações com tenant_id = 'all' ........ 5
--
-- E as 5 são o mesmo "Bem-vindo ao Sistema", duplicado, endereçado a um único usuário —
-- resíduo do seeding inicial, não uma transmissão. Nenhuma funcionalidade depende do
-- coringa; ele só fazia a caixa de entrada de um usuário aparecer para as outras empresas.
-- Por isso 'all' sai também de has_tenant_access, completando o que a migration anterior
-- deixou pela metade por uma razão que não se sustentava.
--
-- Nenhuma outra tabela tem registros com tenant_id = 'all' (varrido antes de aplicar), então
-- a mudança na função não esconde nenhuma linha de nenhum outro lugar.
--
-- ## O que continua funcionando
--
-- * Notificação endereçada a mim: visível onde quer que eu esteja (`usuario_id = auth.uid()`).
-- * Notificação da minha empresa, inclusive com escopo `usuario_id = 'all'`: visível para
--   quem é daquela empresa — o escopo "todos da minha empresa" sobrevive, agora qualificado.
-- * super_admin continua vendo tudo.

CREATE OR REPLACE FUNCTION public.has_tenant_access(record_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $function$
  SELECT (
    -- Super-admin vê tudo, sempre
    is_super_admin()
    -- Tenant do registro bate com o tenant do usuário
    OR (
      record_tenant_id IS NOT NULL
      AND current_tenant_id() IS NOT NULL
      AND record_tenant_id = current_tenant_id()
    )
    -- Registros sem tenant_id são acessíveis apenas se o usuário também não tem tenant
    -- (situação de migração de dados antigos, aceita com cautela)
    OR (record_tenant_id IS NULL AND current_tenant_id() IS NULL)
  );
$function$;

COMMENT ON FUNCTION public.has_tenant_access(text) IS
  'Criterio central de acesso por tenant, usado por todas as policies de public. '
  'NAO acrescente valores coringa aqui. ''empresa_padrao'' e ''default_tenant'' sairam em '
  '08/09/2026 (o frontend os gravava como fallback de "empresa nao selecionada", o que fazia '
  'o registro nascer compartilhado); ''all'' saiu logo depois, quando se confirmou que a '
  '"transmissao a todos" que ele supostamente servia nao existia em nenhum registro. '
  'Para um catalogo realmente global, use uma clausula propria na policy da tabela '
  '(ex.: procedimentos: tenant_id IS NULL OR has_tenant_access(tenant_id)).';

-- SELECT: endereçada a mim, ou da minha empresa. O escopo 'all' dentro de uma empresa
-- continua valendo, mas agora passa pela cláusula de tenant em vez de escapar dela.
DROP POLICY IF EXISTS notificacoes_select_policy ON public.notificacoes;
CREATE POLICY notificacoes_select_policy ON public.notificacoes
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR usuario_id = (auth.uid())::text
    OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
  );

-- INSERT: uma notificação precisa nascer com dono. Sem tenant, ou com um tenant que não é
-- meu, a gravação é recusada — era esta a porta da injeção entre empresas.
DROP POLICY IF EXISTS notificacoes_insert_policy ON public.notificacoes;
CREATE POLICY notificacoes_insert_policy ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
  );

-- UPDATE: o WITH CHECK deixa de ser `true`. Marcar como lida continua funcionando; mudar o
-- tenant_id da linha para um escopo mais amplo, não.
DROP POLICY IF EXISTS notificacoes_update_policy ON public.notificacoes;
CREATE POLICY notificacoes_update_policy ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (
    is_super_admin()
    OR usuario_id = (auth.uid())::text
    OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
  )
  WITH CHECK (
    is_super_admin()
    OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
  );

-- DELETE já era o mais restrito dos quatro; recriado só para ficar explícito ao lado dos outros.
DROP POLICY IF EXISTS notificacoes_delete_policy ON public.notificacoes;
CREATE POLICY notificacoes_delete_policy ON public.notificacoes
  FOR DELETE TO authenticated
  USING (
    is_super_admin()
    OR usuario_id = (auth.uid())::text
    OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
  );
