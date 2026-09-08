-- =============================================================================
-- MIGRATION: get_dashboard_resumo — checagem de tenant e revogação de anon
-- Sistema ERAS PAX Taquari
-- Data: 2026-09-08
-- =============================================================================
-- CONTEXTO
-- A função é SECURITY DEFINER (portanto ignora RLS), recebe `p_tenant_id` por
-- parâmetro e não verificava se quem chama tem acesso a esse tenant. Somado ao
-- EXECUTE herdado por PUBLIC, isso deixava o resumo financeiro de QUALQUER
-- empresa — associados, a receber, a pagar, recebido, pago — acessível a um
-- chamador NÃO AUTENTICADO via /rest/v1/rpc/get_dashboard_resumo, bastando
-- conhecer ou adivinhar um tenant_id.
--
-- Duas correções, porque uma sozinha não fecha o caso:
--  1. A guarda `has_tenant_access(p_tenant_id)` dentro da função. Sem ela,
--     revogar de anon ainda deixaria qualquer usuário autenticado ler o
--     dashboard de outra empresa.
--  2. REVOKE de PUBLIC (não só de anon): o grant padrão do Postgres vale por
--     herança, então revogar de anon isoladamente não teria efeito.
--
-- Nenhuma chamada a esta função existe no frontend hoje (`grep get_dashboard_resumo`
-- em src/ não retorna nada), então a guarda não quebra tela alguma.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_resumo(p_tenant_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result JSONB;
  v_total_associados INTEGER;
  v_associados_ativos INTEGER;
  v_a_receber_mes NUMERIC;
  v_a_pagar_mes NUMERIC;
  v_recebido_mes NUMERIC;
  v_pago_mes NUMERIC;
BEGIN
  -- A função ignora RLS por ser SECURITY DEFINER: o tenant pedido precisa ser
  -- checado explicitamente contra quem está chamando.
  IF NOT has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant informado.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Contagem de associados
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'ativo')
  INTO v_total_associados, v_associados_ativos
  FROM associados
  WHERE tenant_id = p_tenant_id AND deleted_at IS NULL;

  -- A receber no mês atual
  SELECT COALESCE(SUM(valor), 0)
  INTO v_a_receber_mes
  FROM parcelas_receber
  WHERE tenant_id = p_tenant_id
    AND status IN ('pendente', 'atrasado', 'vencido')
    AND EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- Recebido no mês atual
  SELECT COALESCE(SUM(valor_pago), 0)
  INTO v_recebido_mes
  FROM parcelas_receber
  WHERE tenant_id = p_tenant_id
    AND status IN ('pago', 'recebido')
    AND EXTRACT(MONTH FROM data_pagamento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM data_pagamento) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- A pagar no mês atual
  SELECT COALESCE(SUM(valor), 0)
  INTO v_a_pagar_mes
  FROM parcelas_pagar
  WHERE tenant_id = p_tenant_id
    AND status IN ('pendente', 'atrasado')
    AND EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- Pago no mês atual
  SELECT COALESCE(SUM(valor_pago), 0)
  INTO v_pago_mes
  FROM parcelas_pagar
  WHERE tenant_id = p_tenant_id
    AND status = 'pago'
    AND EXTRACT(MONTH FROM data_pagamento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM data_pagamento) = EXTRACT(YEAR FROM CURRENT_DATE);

  v_result := jsonb_build_object(
    'total_associados', v_total_associados,
    'associados_ativos', v_associados_ativos,
    'a_receber_mes', v_a_receber_mes,
    'recebido_mes', v_recebido_mes,
    'a_pagar_mes', v_a_pagar_mes,
    'pago_mes', v_pago_mes,
    'saldo_liquido', v_recebido_mes - v_pago_mes
  );

  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.get_dashboard_resumo(text) IS
  'Resumo financeiro do dashboard de um tenant. SECURITY DEFINER, portanto ignora '
  'RLS: a checagem de has_tenant_access(p_tenant_id) no início da função é o que '
  'impede leitura cross-tenant e NÃO pode ser removida.';

REVOKE EXECUTE ON FUNCTION public.get_dashboard_resumo(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_resumo(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_resumo(text) TO authenticated;
