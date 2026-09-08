-- Desfaz o duplo sentido de 'empresa_padrao' e 'default_tenant'.
--
-- Contexto
-- --------
-- `has_tenant_access()` é a função que TODA policy RLS do schema public usa para decidir
-- acesso. Ela devolvia verdadeiro sempre que o tenant_id do registro fosse
-- 'default_tenant', 'empresa_padrao' ou 'all', para qualquer usuário autenticado de
-- qualquer empresa — a intenção documentada era "registros globais, compartilhados".
--
-- O frontend, porém, usava 'empresa_padrao' e 'default_tenant' com outro sentido: eram o
-- fallback de "empresa ainda não selecionada" (`state.empresaSelecionada || 'empresa_padrao'`).
-- Um registro criado sem empresa escolhida — uma conta a pagar, uma receita, uma entrada
-- de auditoria — nascia legível E gravável por todas as empresas, sem erro e sem aviso.
--
-- Esta migration remove os dois valores da função. 'all' permanece: no código ele nunca é
-- gravado como tenant de um registro de negócio (é o sentinela de "sem filtro"), e é o
-- marcador de transmissão das notificações — um sentido só, que não colide com nenhum outro.
--
-- Verificado antes de aplicar, varrendo TODAS as tabelas de public com coluna tenant_id:
-- nenhum registro usa 'default_tenant' ou 'empresa_padrao'. A mudança não esconde nenhuma
-- linha existente — fecha a porta antes de ela gerar dado.
--
-- Catálogo global continua possível, e da forma correta: uma cláusula própria na policy da
-- tabela, como `procedimentos` já faz (`tenant_id IS NULL OR has_tenant_access(tenant_id)`),
-- em vez de um valor mágico dentro de tenant_id.

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
    -- Marcador de transmissão a todos (usado pelas notificações)
    OR record_tenant_id = 'all'
    -- Registros sem tenant_id são acessíveis apenas se o usuário também não tem tenant
    -- (situação de migração de dados antigos, aceita com cautela)
    OR (record_tenant_id IS NULL AND current_tenant_id() IS NULL)
  );
$function$;

COMMENT ON FUNCTION public.has_tenant_access(text) IS
  'Critério central de acesso por tenant, usado por todas as policies de public. '
  'NÃO acrescente valores coringa aqui: ''empresa_padrao'' e ''default_tenant'' foram '
  'removidos em 08/09/2026 porque o frontend os gravava como fallback de "empresa não '
  'selecionada", o que fazia o registro nascer compartilhado entre todas as empresas. '
  'Para um catálogo realmente global, use uma cláusula própria na policy da tabela '
  '(ex.: procedimentos: tenant_id IS NULL OR has_tenant_access(tenant_id)).';

-- As policies de notificacoes repetiam a mesma lista de coringas inline. Reduzidas ao
-- único marcador de transmissão, 'all'. As 5 notificações existentes com tenant_id = 'all'
-- continuam visíveis; nenhuma linha usa os outros dois valores.
DROP POLICY IF EXISTS notificacoes_select_policy ON public.notificacoes;
CREATE POLICY notificacoes_select_policy ON public.notificacoes
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR usuario_id = (auth.uid())::text
    OR usuario_id = 'all'
    OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
    OR tenant_id IS NULL
    OR tenant_id = 'all'
  );

DROP POLICY IF EXISTS notificacoes_update_policy ON public.notificacoes;
CREATE POLICY notificacoes_update_policy ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (
    is_super_admin()
    OR usuario_id = (auth.uid())::text
    OR usuario_id = 'all'
    OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
    OR tenant_id IS NULL
    OR tenant_id = 'all'
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS notificacoes_insert_policy ON public.notificacoes;
CREATE POLICY notificacoes_insert_policy ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR usuario_id = (auth.uid())::text
    OR usuario_id = 'all'
    OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
    OR tenant_id IS NULL
    OR tenant_id = 'all'
  );
