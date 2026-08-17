-- =============================================================================
-- MIGRATION: RPC Functions e Helpers
-- Sistema ERAS PAX Taquari
-- =============================================================================

-- ============================================================
-- FUNÇÃO: registrar_audit (chamada pelo frontend via supabase.rpc)
-- ============================================================
CREATE OR REPLACE FUNCTION registrar_audit(
  user_id   TEXT,
  acao      TEXT,
  detalhes  JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  -- Tenta obter tenant_id do JWT
  BEGIN
    v_tenant_id := (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id');
  EXCEPTION WHEN OTHERS THEN
    v_tenant_id := 'system';
  END;

  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    v_tenant_id := 'system';
  END IF;

  INSERT INTO auditoria (tenant_id, usuario_id, acao, detalhes)
  VALUES (v_tenant_id, COALESCE(user_id, 'system'), acao, COALESCE(detalhes, '{}'::jsonb));
END;
$$;

-- ============================================================
-- FUNÇÃO: get_user_profile (retorna perfil completo do usuário logado)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_profile()
RETURNS TABLE (
  id                  UUID,
  tenant_id           TEXT,
  nome                TEXT,
  email               TEXT,
  nivel               TEXT,
  modulos_permitidos  TEXT[],
  status              TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.tenant_id,
    u.nome,
    u.email,
    u.nivel,
    u.modulos_permitidos,
    u.status
  FROM users u
  WHERE u.id = auth.uid()
    AND u.deleted_at IS NULL
  LIMIT 1;
END;
$$;

-- ============================================================
-- FUNÇÃO: get_dashboard_resumo (resumo financeiro do tenant)
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_resumo(p_tenant_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total_associados INTEGER;
  v_associados_ativos INTEGER;
  v_a_receber_mes NUMERIC;
  v_a_pagar_mes NUMERIC;
  v_recebido_mes NUMERIC;
  v_pago_mes NUMERIC;
BEGIN
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
$$;

-- ============================================================
-- GRANT para funções RPC
-- ============================================================
GRANT EXECUTE ON FUNCTION registrar_audit(TEXT, TEXT, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_resumo(TEXT) TO authenticated;
