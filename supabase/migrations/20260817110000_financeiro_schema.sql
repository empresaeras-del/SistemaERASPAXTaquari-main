-- =============================================================================
-- MIGRATION: Financeiro Schema
-- Sistema ERAS PAX Taquari
-- Tabelas: contas_bancarias, fornecedores, receitas, parcelas_receber,
--          despesas, parcelas_pagar
-- =============================================================================

-- ============================================================
-- TABELA: contas_bancarias
-- ============================================================
CREATE TABLE IF NOT EXISTS contas_bancarias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  nome        TEXT NOT NULL,
  banco       TEXT NOT NULL,
  agencia     TEXT,
  conta       TEXT,
  tipo        TEXT DEFAULT 'corrente' CHECK (tipo IN ('corrente', 'poupanca', 'pagamento')),
  status      TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contas_bancarias_tenant ON contas_bancarias(tenant_id);

ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados gerenciam contas bancárias"
ON contas_bancarias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: fornecedores
-- ============================================================
CREATE TABLE IF NOT EXISTS fornecedores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL,
  tipo_pessoa      TEXT NOT NULL DEFAULT 'PJ' CHECK (tipo_pessoa IN ('PF', 'PJ')),
  razao_social     TEXT NOT NULL,
  nome_fantasia    TEXT,
  cnpj_cpf         TEXT,
  email            TEXT,
  telefone         TEXT,
  endereco         TEXT,
  cidade           TEXT,
  estado           TEXT,
  cep              TEXT,
  categoria        TEXT,
  banco            TEXT,
  agencia          TEXT,
  conta_corrente   TEXT,
  tipo_chave_pix   TEXT,
  chave_pix        TEXT,
  status           TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_tenant ON fornecedores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_status ON fornecedores(status);

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados gerenciam fornecedores"
ON fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: receitas (Contas a Receber)
-- ============================================================
CREATE TABLE IF NOT EXISTS receitas (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   TEXT NOT NULL,
  tipo_devedor                TEXT NOT NULL CHECK (tipo_devedor IN ('associado', 'cliente_pf', 'cliente_pj')),
  associado_id                UUID REFERENCES associados(id),
  associado_nome              TEXT,
  associado_cpf               TEXT,
  associado_plano             TEXT,
  associado_valor_contrato    NUMERIC(10,2),
  cliente_tipo                TEXT,
  cliente_nome                TEXT,
  cliente_cpf_cnpj            TEXT,
  cliente_telefone            TEXT,
  cliente_email               TEXT,
  descricao                   TEXT NOT NULL,
  categoria                   TEXT NOT NULL,
  data_emissao                DATE NOT NULL DEFAULT CURRENT_DATE,
  data_inicio_cobranca        DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_total                 NUMERIC(10,2) NOT NULL,
  qtd_parcelas                INTEGER NOT NULL DEFAULT 1,
  forma_pagamento_padrao      TEXT NOT NULL DEFAULT 'pix',
  conta_bancaria_id           UUID REFERENCES contas_bancarias(id),
  observacoes                 TEXT,
  status                      TEXT NOT NULL DEFAULT 'ativo'
                                CHECK (status IN ('ativo', 'rascunho', 'cancelado', 'quitado')),
  atendimento_id              UUID,
  criado_em                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por                  UUID REFERENCES auth.users(id),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receitas_tenant ON receitas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receitas_status ON receitas(status);
CREATE INDEX IF NOT EXISTS idx_receitas_associado ON receitas(associado_id);
CREATE INDEX IF NOT EXISTS idx_receitas_data ON receitas(data_emissao);

CREATE OR REPLACE FUNCTION update_receitas_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receitas_updated_at_trigger
BEFORE UPDATE ON receitas FOR EACH ROW
EXECUTE FUNCTION update_receitas_updated_at();

ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados gerenciam receitas"
ON receitas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: parcelas_receber
-- ============================================================
CREATE TABLE IF NOT EXISTS parcelas_receber (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                TEXT NOT NULL,
  receita_id               UUID NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
  numero_parcela           INTEGER NOT NULL,
  valor                    NUMERIC(10,2) NOT NULL,
  data_vencimento          DATE NOT NULL,
  data_pagamento           DATE,
  valor_pago               NUMERIC(10,2),
  status                   TEXT NOT NULL DEFAULT 'pendente'
                             CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado', 'negociado', 'vencido', 'recebido')),
  forma_pagamento          TEXT,
  forma_pagamento_efetivo  TEXT,
  conta_bancaria_id        UUID REFERENCES contas_bancarias(id),
  link_pagamento           TEXT,
  linha_digitavel          TEXT,
  comprovante_url          TEXT,
  observacoes              TEXT,
  observacao_recebimento   TEXT,
  tipo_devedor             TEXT,
  devedor_nome             TEXT,
  devedor_cpf_cnpj         TEXT,
  descricao                TEXT,
  valor_recebido           NUMERIC(10,2),
  recebido_em              TIMESTAMPTZ,
  recebido_por             TEXT,
  total_parcelas           INTEGER,
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcelas_receber_tenant ON parcelas_receber(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_receber_receita ON parcelas_receber(receita_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_receber_status ON parcelas_receber(status);
CREATE INDEX IF NOT EXISTS idx_parcelas_receber_vencimento ON parcelas_receber(data_vencimento);

ALTER TABLE parcelas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados gerenciam parcelas a receber"
ON parcelas_receber FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: despesas (Contas a Pagar)
-- ============================================================
CREATE TABLE IF NOT EXISTS despesas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               TEXT NOT NULL,
  tipo_credor             TEXT NOT NULL
                            CHECK (tipo_credor IN ('fornecedor', 'fornecedor_pf', 'fornecedor_pj', 'funcionario', 'outro')),
  fornecedor_id           UUID REFERENCES fornecedores(id),
  fornecedor_nome         TEXT,
  fornecedor_cnpj_cpf     TEXT,
  funcionario_id          UUID,
  funcionario_nome        TEXT,
  funcionario_cpf         TEXT,
  credor_nome             TEXT,
  credor_cpf_cnpj         TEXT,
  descricao               TEXT NOT NULL,
  categoria               TEXT NOT NULL,
  centro_custo            TEXT,
  data_emissao            DATE NOT NULL DEFAULT CURRENT_DATE,
  data_inicio_pagamento   DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_total             NUMERIC(10,2) NOT NULL,
  qtd_parcelas            INTEGER NOT NULL DEFAULT 1,
  forma_pagamento_padrao  TEXT NOT NULL DEFAULT 'pix',
  conta_bancaria_id       UUID REFERENCES contas_bancarias(id),
  codigo_barras           TEXT,
  observacoes             TEXT,
  status                  TEXT NOT NULL DEFAULT 'ativo'
                            CHECK (status IN ('ativo', 'rascunho', 'cancelado', 'quitado')),
  atendimento_id          UUID,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por              UUID REFERENCES auth.users(id),
  atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_despesas_tenant ON despesas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_despesas_status ON despesas(status);
CREATE INDEX IF NOT EXISTS idx_despesas_data ON despesas(data_emissao);

CREATE OR REPLACE FUNCTION update_despesas_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER despesas_atualizado_em_trigger
BEFORE UPDATE ON despesas FOR EACH ROW
EXECUTE FUNCTION update_despesas_atualizado_em();

ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados gerenciam despesas"
ON despesas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: parcelas_pagar
-- ============================================================
CREATE TABLE IF NOT EXISTS parcelas_pagar (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               TEXT NOT NULL,
  despesa_id              UUID NOT NULL REFERENCES despesas(id) ON DELETE CASCADE,
  numero_parcela          INTEGER NOT NULL,
  valor                   NUMERIC(10,2) NOT NULL,
  data_vencimento         DATE NOT NULL,
  data_pagamento          DATE,
  valor_pago              NUMERIC(10,2),
  status                  TEXT NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado', 'negociado', 'recebido')),
  forma_pagamento         TEXT,
  forma_pagamento_efetivo TEXT,
  conta_bancaria_id       UUID REFERENCES contas_bancarias(id),
  comprovante_url         TEXT,
  observacoes             TEXT,
  observacao_pagamento    TEXT,
  credor_nome             TEXT,
  credor_cpf_cnpj         TEXT,
  descricao               TEXT,
  pago_em                 TIMESTAMPTZ,
  pago_por                TEXT,
  total_parcelas          INTEGER,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcelas_pagar_tenant ON parcelas_pagar(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_pagar_despesa ON parcelas_pagar(despesa_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_pagar_status ON parcelas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_parcelas_pagar_vencimento ON parcelas_pagar(data_vencimento);

ALTER TABLE parcelas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados gerenciam parcelas a pagar"
ON parcelas_pagar FOR ALL TO authenticated USING (true) WITH CHECK (true);
