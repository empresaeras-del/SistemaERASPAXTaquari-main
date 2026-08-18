-- =============================================================================
-- MIGRATION PATCH: Colunas ausentes para associados e remessas_faturamento
-- + Criação de lotes_caixa e movimentacoes_caixa se ausentes
-- Sistema ERAS PAX Taquari — Patch para produção
-- =============================================================================

-- ============================================================
-- PATCH: associados — colunas usadas pelo frontend mas ausentes
-- na migration full_schema_and_rls_fix
-- ============================================================
ALTER TABLE associados ADD COLUMN IF NOT EXISTS nome_pai TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS nome_mae TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS sexo TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS n_vidas INTEGER DEFAULT 1;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS plano_nome TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS plano_pax_id UUID;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS plano_id TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS numero_contrato TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT DEFAULT 'PF';
ALTER TABLE associados ADD COLUMN IF NOT EXISTS documentos JSONB DEFAULT '[]';
ALTER TABLE associados ADD COLUMN IF NOT EXISTS valor_plano NUMERIC(10,2);
ALTER TABLE associados ADD COLUMN IF NOT EXISTS assinatura_base64 TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS historico_contratos JSONB DEFAULT '[]';
ALTER TABLE associados ADD COLUMN IF NOT EXISTS data_adesao DATE DEFAULT CURRENT_DATE;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS endereco_numero TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS endereco_bairro TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS endereco_cidade TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS endereco_cep TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS endereco_estado TEXT;

-- ============================================================
-- PATCH: remessas_faturamento — colunas usadas pelo frontend
-- presentes no operacional_schema mas ausentes no full_schema_fix
-- ============================================================
ALTER TABLE remessas_faturamento ADD COLUMN IF NOT EXISTS data_criacao TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE remessas_faturamento ADD COLUMN IF NOT EXISTS data_fechamento TIMESTAMPTZ;
ALTER TABLE remessas_faturamento ADD COLUMN IF NOT EXISTS data_vencimento_pagamento DATE;
ALTER TABLE remessas_faturamento ADD COLUMN IF NOT EXISTS credenciado_cnpj_cpf TEXT;
ALTER TABLE remessas_faturamento ADD COLUMN IF NOT EXISTS qtd_guias INTEGER DEFAULT 0;
ALTER TABLE remessas_faturamento ADD COLUMN IF NOT EXISTS valor_bruto NUMERIC(10,2) DEFAULT 0;
ALTER TABLE remessas_faturamento ADD COLUMN IF NOT EXISTS valor_desconto_glosa NUMERIC(10,2) DEFAULT 0;
ALTER TABLE remessas_faturamento ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(10,2) DEFAULT 0;
ALTER TABLE remessas_faturamento ADD COLUMN IF NOT EXISTS fechado_por TEXT;

-- ============================================================
-- PATCH: lotes_caixa e movimentacoes_caixa
-- Garantem existência caso apenas a full_schema_fix tenha rodado
-- ============================================================
CREATE TABLE IF NOT EXISTS lotes_caixa (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   TEXT NOT NULL,
  codigo_lote                 TEXT NOT NULL,
  terminal_caixa              TEXT NOT NULL,
  operador_id                 UUID,
  operador_nome               TEXT NOT NULL,
  data_abertura               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_fechamento             TIMESTAMPTZ,
  saldo_inicial               NUMERIC(10,2) NOT NULL DEFAULT 0,
  saldo_entradas              NUMERIC(10,2) NOT NULL DEFAULT 0,
  saldo_saidas                NUMERIC(10,2) NOT NULL DEFAULT 0,
  saldo_esperado              NUMERIC(10,2) NOT NULL DEFAULT 0,
  saldo_fechamento_informado  NUMERIC(10,2),
  diferenca_quebra_sobra      NUMERIC(10,2),
  observacao_abertura         TEXT,
  observacao_fechamento       TEXT,
  status                      TEXT NOT NULL DEFAULT 'aberto',
  empresa_id                  TEXT,
  criado_em                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lotes_caixa ADD COLUMN IF NOT EXISTS empresa_id TEXT;

ALTER TABLE lotes_caixa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam lotes de caixa" ON lotes_caixa;
CREATE POLICY "Usuários autenticados gerenciam lotes de caixa"
ON lotes_caixa FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  lote_id             UUID NOT NULL REFERENCES lotes_caixa(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL,
  origem              TEXT NOT NULL,
  categoria           TEXT NOT NULL,
  descricao           TEXT NOT NULL,
  valor               NUMERIC(10,2) NOT NULL,
  forma_pagamento     TEXT NOT NULL,
  data_movimentacao   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referencia_id       UUID,
  documento_ref       TEXT,
  operador_nome       TEXT NOT NULL,
  observacao          TEXT,
  estornado           BOOLEAN NOT NULL DEFAULT FALSE,
  empresa_id          TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE movimentacoes_caixa ADD COLUMN IF NOT EXISTS empresa_id TEXT;

ALTER TABLE movimentacoes_caixa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam movimentações de caixa" ON movimentacoes_caixa;
CREATE POLICY "Usuários autenticados gerenciam movimentações de caixa"
ON movimentacoes_caixa FOR ALL TO authenticated USING (true) WITH CHECK (true);
