-- =============================================================================
-- MIGRATION: Patches de colunas ausentes em tabelas existentes
-- Sistema ERAS PAX Taquari
-- Corrige: deleted_at em atendimentos, planos_pax, notificacoes
-- =============================================================================

-- ============================================================
-- Patches: atendimentos
-- ============================================================
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- RLS para atendimentos (se ainda não existir)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'atendimentos' AND n.nspname = 'public'
      AND c.relrowsecurity = true
  ) THEN
    EXECUTE 'ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam atendimentos" ON atendimentos;
CREATE POLICY "Usuários autenticados gerenciam atendimentos"
ON atendimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Patches: planos_pax
-- ============================================================
ALTER TABLE planos_pax ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE planos_pax ADD COLUMN IF NOT EXISTS tenant_id  TEXT;
ALTER TABLE planos_pax ADD COLUMN IF NOT EXISTS minimo_vidas INTEGER DEFAULT 1;

-- ============================================================
-- Patches: notificacoes
-- ============================================================
-- Cria a tabela se não existir, com todas as colunas necessárias
CREATE TABLE IF NOT EXISTS notificacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT,
  usuario_id  TEXT NOT NULL DEFAULT 'all',
  titulo      TEXT NOT NULL,
  mensagem    TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'info',
  lida        BOOLEAN NOT NULL DEFAULT FALSE,
  link        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- Caso a tabela já exista mas sem deleted_at, adiciona a coluna
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS tenant_id   TEXT;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS usuario_id  TEXT;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS lida        BOOLEAN DEFAULT FALSE;

-- RLS notificacoes
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem suas próprias notificações" ON notificacoes;
CREATE POLICY "Usuários veem suas próprias notificações"
ON notificacoes FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ============================================================
-- Patches: atendimento_itens — RLS
-- ============================================================
ALTER TABLE atendimento_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam atendimento_itens" ON atendimento_itens;
CREATE POLICY "Usuários autenticados gerenciam atendimento_itens"
ON atendimento_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Patches: planos_pax_coberturas e planos_pax_faixas — RLS já existente, garantir
-- ============================================================
-- (Já criados na migration 20260803120001, apenas garantir que RLS está ativo)

-- ============================================================
-- Patches: credenciados_planos — RLS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credenciados_planos') THEN
    ALTER TABLE credenciados_planos ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam credenciados_planos" ON credenciados_planos;
CREATE POLICY "Usuários autenticados gerenciam credenciados_planos"
ON credenciados_planos FOR ALL TO authenticated USING (true) WITH CHECK (true);
