-- =============================================================================
-- MIGRATION: Core Schema
-- Sistema ERAS PAX Taquari
-- Tabelas: tenants, users, associados, dependentes, contratos
-- + Evolução da tabela credenciados (já existente)
-- =============================================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: tenants (Empresas / Clientes do sistema)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social     TEXT NOT NULL,
  nome_fantasia    TEXT NOT NULL,
  cnpj             TEXT UNIQUE,
  email            TEXT,
  telefone         TEXT,
  endereco         TEXT,
  logo_url         TEXT,
  assinatura_url   TEXT,
  chave_pix        TEXT,
  cidade_pix       TEXT,
  status           TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at ON tenants(deleted_at);

-- Seed: tenant padrão para primeiro uso
INSERT INTO tenants (id, razao_social, nome_fantasia, cnpj, status)
VALUES (
  gen_random_uuid(),
  'ERAS PAX Taquari',
  'ERAS PAX',
  '00.000.000/0001-00',
  'ativo'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- TABELA: users (Perfis de usuário — 1:1 com auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id           TEXT NOT NULL,
  nome                TEXT NOT NULL,
  email               TEXT NOT NULL,
  nivel               TEXT NOT NULL DEFAULT 'funcionario'
                        CHECK (nivel IN ('super_admin', 'admin', 'gerente', 'funcionario')),
  modulos_permitidos  TEXT[] NOT NULL DEFAULT ARRAY['*'],
  status              TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- RLS: users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem próprio perfil ou admin vê todos" ON users;
CREATE POLICY "Usuários veem próprio perfil ou admin vê todos"
ON users FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'nivel') IN ('super_admin', 'admin')
);

DROP POLICY IF EXISTS "Apenas super_admin pode criar usuários" ON users;
CREATE POLICY "Apenas super_admin pode criar usuários"
ON users FOR INSERT TO authenticated
WITH CHECK (
  (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'nivel') = 'super_admin'
  OR id = auth.uid()
);

DROP POLICY IF EXISTS "Admin pode atualizar usuários do seu tenant" ON users;
CREATE POLICY "Admin pode atualizar usuários do seu tenant"
ON users FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  OR (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'nivel') IN ('super_admin', 'admin')
)
WITH CHECK (
  id = auth.uid()
  OR (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'nivel') IN ('super_admin', 'admin')
);

-- ============================================================
-- TRIGGER: Criar perfil em users ao registrar no auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, tenant_id, nome, email, nivel, modulos_permitidos)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_app_meta_data->>'tenant_id', 'default'),
    COALESCE(NEW.raw_user_meta_data->>'nome', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_app_meta_data->>'nivel', 'funcionario'),
    ARRAY['*']
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TABELA: associados
-- ============================================================
CREATE TABLE IF NOT EXISTS associados (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               TEXT NOT NULL,
  nome                    TEXT NOT NULL,
  cpf                     TEXT,
  rg                      TEXT,
  data_nascimento         DATE,
  sexo                    TEXT,
  nome_pai                TEXT,
  nome_mae                TEXT,
  telefone                TEXT,
  email                   TEXT,
  endereco_logradouro     TEXT,
  endereco_numero         TEXT,
  endereco_bairro         TEXT,
  endereco_cidade         TEXT,
  endereco_cep            TEXT,
  endereco_estado         TEXT,
  tipo_pessoa             TEXT DEFAULT 'PF' CHECK (tipo_pessoa IN ('PF', 'PJ')),
  plano_id                UUID,
  plano_pax_id            UUID REFERENCES planos_pax(id),
  plano_nome              TEXT,
  numero_contrato         TEXT,
  n_vidas                 INTEGER DEFAULT 1,
  valor_plano             NUMERIC(10,2),
  data_adesao             DATE NOT NULL DEFAULT CURRENT_DATE,
  assinatura_base64       TEXT,
  documentos              JSONB DEFAULT '[]',
  historico_contratos     JSONB DEFAULT '[]',
  status                  TEXT NOT NULL DEFAULT 'ativo'
                            CHECK (status IN ('ativo', 'inativo', 'inadimplente', 'encerrado')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by              UUID REFERENCES auth.users(id),
  deleted_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_associados_tenant_id ON associados(tenant_id);
CREATE INDEX IF NOT EXISTS idx_associados_status ON associados(status);
CREATE INDEX IF NOT EXISTS idx_associados_cpf ON associados(cpf);
CREATE INDEX IF NOT EXISTS idx_associados_deleted_at ON associados(deleted_at);

CREATE OR REPLACE FUNCTION update_associados_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS associados_updated_at_trigger ON associados;
CREATE TRIGGER associados_updated_at_trigger
BEFORE UPDATE ON associados FOR EACH ROW
EXECUTE FUNCTION update_associados_updated_at();

-- RLS: associados
ALTER TABLE associados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados leem associados do seu tenant" ON associados;
CREATE POLICY "Usuários autenticados leem associados do seu tenant"
ON associados FOR SELECT TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Usuários autenticados gerenciam associados" ON associados;
CREATE POLICY "Usuários autenticados gerenciam associados"
ON associados FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: dependentes
-- ============================================================
CREATE TABLE IF NOT EXISTS dependentes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id     UUID NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  tenant_id        TEXT NOT NULL,
  nome             TEXT NOT NULL,
  cpf              TEXT,
  data_nascimento  DATE,
  parentesco       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dependentes_associado_id ON dependentes(associado_id);
CREATE INDEX IF NOT EXISTS idx_dependentes_tenant_id ON dependentes(tenant_id);

ALTER TABLE dependentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam dependentes" ON dependentes;
CREATE POLICY "Usuários autenticados gerenciam dependentes"
ON dependentes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: contratos
-- ============================================================
CREATE TABLE IF NOT EXISTS contratos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL,
  associado_id     UUID NOT NULL REFERENCES associados(id),
  plano_pax_id     UUID REFERENCES planos_pax(id),
  numero_contrato  TEXT NOT NULL UNIQUE,
  data_inicio      DATE NOT NULL,
  data_fim         DATE,
  valor_mensalidade NUMERIC(10,2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ativo'
                     CHECK (status IN ('ativo', 'inativo', 'encerrado', 'cancelado')),
  observacoes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contratos_associado_id ON contratos(associado_id);
CREATE INDEX IF NOT EXISTS idx_contratos_tenant_id ON contratos(tenant_id);

ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam contratos" ON contratos;
CREATE POLICY "Usuários autenticados gerenciam contratos"
ON contratos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: credenciados — EVOLUÇÃO (tabela já existe)
-- Adiciona colunas ausentes sem recriar a tabela
-- ============================================================
ALTER TABLE credenciados ADD COLUMN IF NOT EXISTS tenant_id     TEXT;
ALTER TABLE credenciados ADD COLUMN IF NOT EXISTS tipo_pessoa   TEXT DEFAULT 'PJ';
ALTER TABLE credenciados ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;
ALTER TABLE credenciados ADD COLUMN IF NOT EXISTS especialidade TEXT;
ALTER TABLE credenciados ADD COLUMN IF NOT EXISTS tipo_conta    TEXT;
ALTER TABLE credenciados ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;

-- Garante que tenant_id tem um valor padrão para registros existentes
UPDATE credenciados SET tenant_id = 'default' WHERE tenant_id IS NULL;

-- Agora podemos criar os índices com segurança
CREATE INDEX IF NOT EXISTS idx_credenciados_tenant_id ON credenciados(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credenciados_status    ON credenciados(status);

-- RLS: credenciados (habilita se ainda não estiver)
ALTER TABLE credenciados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam credenciados" ON credenciados;
CREATE POLICY "Usuários autenticados gerenciam credenciados"
ON credenciados FOR ALL TO authenticated USING (true) WITH CHECK (true);
