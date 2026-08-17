-- =============================================================================
-- MIGRATION: RLS e Storage para Tenants (Empresas)
-- Sistema ERAS PAX Taquari
-- =============================================================================

-- 1. Habilita RLS na tabela tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de acesso para a tabela tenants
DROP POLICY IF EXISTS "Usuários autenticados podem ver tenants" ON tenants;
CREATE POLICY "Usuários autenticados podem ver tenants"
ON tenants FOR SELECT TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Usuários autenticados podem inserir tenants" ON tenants;
CREATE POLICY "Usuários autenticados podem inserir tenants"
ON tenants FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Usuários autenticados podem atualizar tenants" ON tenants;
CREATE POLICY "Usuários autenticados podem atualizar tenants"
ON tenants FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Usuários autenticados podem excluir tenants" ON tenants;
CREATE POLICY "Usuários autenticados podem excluir tenants"
ON tenants FOR DELETE TO authenticated
USING (true);

DROP POLICY IF EXISTS "Usuários autenticados gerenciam tenants (ALL)" ON tenants;
CREATE POLICY "Usuários autenticados gerenciam tenants (ALL)"
ON tenants FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Trigger para updated_at automático em tenants
CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_updated_at_trigger ON tenants;
CREATE TRIGGER tenants_updated_at_trigger
BEFORE UPDATE ON tenants FOR EACH ROW
EXECUTE FUNCTION update_tenants_updated_at();

-- 4. Criação do Storage Bucket para logos e assinaturas de tenants
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenants_assets', 'tenants_assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para tenants_assets
DROP POLICY IF EXISTS "Acesso público aos assets de tenants" ON storage.objects;
CREATE POLICY "Acesso público aos assets de tenants"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'tenants_assets');

DROP POLICY IF EXISTS "Usuários autenticados fazem upload em tenants_assets" ON storage.objects;
CREATE POLICY "Usuários autenticados fazem upload em tenants_assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tenants_assets');

DROP POLICY IF EXISTS "Usuários autenticados atualizam assets em tenants_assets" ON storage.objects;
CREATE POLICY "Usuários autenticados atualizam assets em tenants_assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tenants_assets');

-- 5. Colunas adicionais para contas_bancarias
ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS chave_pix TEXT;
ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS saldo_inicial NUMERIC(10,2) DEFAULT 0;

