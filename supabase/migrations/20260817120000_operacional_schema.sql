-- =============================================================================
-- MIGRATION: Operacional Schema
-- Sistema ERAS PAX Taquari
-- Tabelas: lotes_caixa, movimentacoes_caixa, requisicoes,
--          remessas_faturamento, auditoria, notificacoes, documentos_padroes
-- =============================================================================

-- ============================================================
-- TABELA: lotes_caixa
-- ============================================================
CREATE TABLE IF NOT EXISTS lotes_caixa (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   TEXT NOT NULL,
  codigo_lote                 TEXT NOT NULL UNIQUE,
  terminal_caixa              TEXT NOT NULL,
  operador_id                 UUID REFERENCES auth.users(id),
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
  status                      TEXT NOT NULL DEFAULT 'aberto'
                                CHECK (status IN ('aberto', 'fechado', 'auditado')),
  criado_em                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotes_caixa_tenant ON lotes_caixa(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lotes_caixa_status ON lotes_caixa(status);
CREATE INDEX IF NOT EXISTS idx_lotes_caixa_data ON lotes_caixa(data_abertura);

ALTER TABLE lotes_caixa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados gerenciam lotes de caixa"
ON lotes_caixa FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: movimentacoes_caixa
-- ============================================================
CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  lote_id             UUID NOT NULL REFERENCES lotes_caixa(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  origem              TEXT NOT NULL
                        CHECK (origem IN ('contas_receber', 'contas_pagar', 'suprimento', 'sangria', 'avulso')),
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
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_tenant ON movimentacoes_caixa(tenant_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_lote ON movimentacoes_caixa(lote_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_tipo ON movimentacoes_caixa(tipo);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_data ON movimentacoes_caixa(data_movimentacao);

ALTER TABLE movimentacoes_caixa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados gerenciam movimentações de caixa"
ON movimentacoes_caixa FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: requisicoes (Guias de Serviço)
-- ============================================================
CREATE TABLE IF NOT EXISTS requisicoes (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   TEXT NOT NULL,
  codigo_requisicao           TEXT NOT NULL,
  data_emissao                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_validade               TIMESTAMPTZ,
  associado_id                UUID REFERENCES associados(id),
  associado_nome              TEXT NOT NULL,
  associado_cpf               TEXT,
  associado_plano             TEXT,
  paciente_tipo               TEXT NOT NULL CHECK (paciente_tipo IN ('titular', 'dependente')),
  paciente_id                 UUID,
  paciente_nome               TEXT NOT NULL,
  paciente_cpf                TEXT,
  paciente_parentesco         TEXT,
  tipo_prestador              TEXT NOT NULL CHECK (tipo_prestador IN ('credenciado', 'rede_externa')),
  credenciado_id              UUID REFERENCES credenciados(id),
  credenciado_nome            TEXT NOT NULL,
  credenciado_cnpj_cpf        TEXT,
  medico_solicitante          TEXT,
  crm_solicitante             TEXT,
  itens                       JSONB NOT NULL DEFAULT '[]',
  valor_total                 NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_coparticipacao_total  NUMERIC(10,2) DEFAULT 0,
  status                      TEXT NOT NULL DEFAULT 'emitida'
                                CHECK (status IN ('emitida', 'autorizada', 'realizada', 'cancelada')),
  observacoes                 TEXT,
  cancelado_por               TEXT,
  motivo_cancelamento         TEXT,
  autorizado_por              TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requisicoes_tenant ON requisicoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_status ON requisicoes(status);
CREATE INDEX IF NOT EXISTS idx_requisicoes_associado ON requisicoes(associado_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_credenciado ON requisicoes(credenciado_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_data ON requisicoes(data_emissao);

ALTER TABLE requisicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados gerenciam requisições"
ON requisicoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: remessas_faturamento
-- ============================================================
CREATE TABLE IF NOT EXISTS remessas_faturamento (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 TEXT NOT NULL,
  codigo_remessa            TEXT NOT NULL UNIQUE,
  tipo_prestador            TEXT NOT NULL CHECK (tipo_prestador IN ('credenciado', 'rede_externa')),
  credenciado_id            UUID REFERENCES credenciados(id),
  credenciado_nome          TEXT NOT NULL,
  credenciado_cnpj_cpf      TEXT,
  data_criacao              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_fechamento           TIMESTAMPTZ,
  data_vencimento_pagamento DATE,
  periodo_inicio            DATE,
  periodo_fim               DATE,
  requisicao_ids            UUID[] NOT NULL DEFAULT '{}',
  qtd_guias                 INTEGER NOT NULL DEFAULT 0,
  valor_bruto               NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_desconto_glosa      NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_liquido             NUMERIC(10,2) NOT NULL DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'em_aberto'
                              CHECK (status IN ('em_aberto', 'processando', 'fechada', 'paga', 'cancelada')),
  observacoes               TEXT,
  despesa_id                UUID REFERENCES despesas(id),
  parcela_pagar_id          UUID,
  fechado_por               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remessas_faturamento_tenant ON remessas_faturamento(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remessas_faturamento_status ON remessas_faturamento(status);
CREATE INDEX IF NOT EXISTS idx_remessas_faturamento_credenciado ON remessas_faturamento(credenciado_id);

ALTER TABLE remessas_faturamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados gerenciam remessas de faturamento"
ON remessas_faturamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: auditoria
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL DEFAULT 'system',
  usuario_id  TEXT NOT NULL DEFAULT 'system',
  acao        TEXT NOT NULL,
  detalhes    JSONB,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_tenant ON auditoria(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_acao ON auditoria(acao);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON auditoria(created_at);

ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem inserir auditoria"
ON auditoria FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin pode ler auditoria"
ON auditoria FOR SELECT TO authenticated
USING (
  (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'nivel')
    IN ('super_admin', 'admin', 'gerente')
);

-- ============================================================
-- TABELA: notificacoes
-- ============================================================
CREATE TABLE IF NOT EXISTS notificacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  user_id     UUID REFERENCES auth.users(id),
  titulo      TEXT NOT NULL,
  mensagem    TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'info'
                CHECK (tipo IN ('info', 'aviso', 'erro', 'sucesso')),
  lida        BOOLEAN NOT NULL DEFAULT FALSE,
  link        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_tenant ON notificacoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON notificacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários veem suas próprias notificações"
ON notificacoes FOR ALL TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL)
WITH CHECK (true);

-- ============================================================
-- TABELA: documentos_padroes (Templates de documentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS documentos_padroes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  conteudo    TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_documentos_padroes_tenant ON documentos_padroes(tenant_id);

ALTER TABLE documentos_padroes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados gerenciam documentos padrões"
ON documentos_padroes FOR ALL TO authenticated USING (true) WITH CHECK (true);
