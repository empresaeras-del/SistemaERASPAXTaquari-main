-- =============================================================================
-- MIGRATION: Políticas de RLS Multi-Tenant Granulares (Idempotente e Resiliente)
-- Sistema ERAS PAX Taquari
-- Data: 2026-08-18
-- =============================================================================

-- =============================================================================
-- 0. GARANTIR COLUNAS DE TENANCY EM TODAS AS TABELAS
-- =============================================================================
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS nivel TEXT DEFAULT 'funcionario';
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS associados ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS associados ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS associados ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS dependentes ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS dependentes ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS dependentes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS contratos ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS contratos ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS contratos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS planos_pax ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS planos_pax ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS planos_pax ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS planos_pax_coberturas ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS planos_pax_coberturas ADD COLUMN IF NOT EXISTS empresa_id TEXT;

ALTER TABLE IF EXISTS planos_pax_faixas ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS planos_pax_faixas ADD COLUMN IF NOT EXISTS empresa_id TEXT;

ALTER TABLE IF EXISTS itens_funerarios ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS itens_funerarios ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS itens_funerarios ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS credenciados ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS credenciados ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS credenciados ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS credenciados_planos ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS credenciados_planos ADD COLUMN IF NOT EXISTS empresa_id TEXT;

ALTER TABLE IF EXISTS credenciados_procedimentos ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS credenciados_procedimentos ADD COLUMN IF NOT EXISTS empresa_id TEXT;

ALTER TABLE IF EXISTS procedimentos ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS procedimentos ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS procedimentos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS fornecedores ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS fornecedores ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS fornecedores ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS contas_bancarias ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS contas_bancarias ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS contas_bancarias ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS receitas ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS receitas ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS receitas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS parcelas_receber ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS parcelas_receber ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS parcelas_receber ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS despesas ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS despesas ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS despesas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS parcelas_pagar ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS parcelas_pagar ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS parcelas_pagar ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS requisicoes ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS requisicoes ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS requisicoes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS requisicao_itens ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS requisicao_itens ADD COLUMN IF NOT EXISTS empresa_id TEXT;

ALTER TABLE IF EXISTS remessas_faturamento ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS remessas_faturamento ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS remessas_faturamento ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS lotes_caixa ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS lotes_caixa ADD COLUMN IF NOT EXISTS empresa_id TEXT;

ALTER TABLE IF EXISTS movimentacoes_caixa ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS movimentacoes_caixa ADD COLUMN IF NOT EXISTS empresa_id TEXT;

ALTER TABLE IF EXISTS atendimentos ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS atendimentos ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS atendimentos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS atendimento_itens ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS atendimento_itens ADD COLUMN IF NOT EXISTS empresa_id TEXT;

ALTER TABLE IF EXISTS auditoria ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS notificacoes ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE IF EXISTS documentos_padroes ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE IF EXISTS documentos_padroes ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE IF EXISTS documentos_padroes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- =============================================================================
-- 1. FUNÇÕES AUXILIARES DE AUTENTICAÇÃO E TENANCY
-- =============================================================================

-- Retorna o tenant_id do usuário atual (via JWT claims ou fallback na tabela users)
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'),
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'tenant_id'),
    (SELECT u.tenant_id FROM public.users u WHERE u.id = auth.uid())
  );
$$;

-- Retorna o nível de acesso do usuário atual (super_admin, admin, gerente, funcionario)
CREATE OR REPLACE FUNCTION current_user_nivel()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'nivel'),
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'nivel'),
    (SELECT u.nivel FROM public.users u WHERE u.id = auth.uid())
  );
$$;

-- Verifica se o usuário atual possui privilégios de super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(current_user_nivel() = 'super_admin', false);
$$;

-- Verifica se o registro pertence ao tenant do usuário ou se o usuário é super_admin
CREATE OR REPLACE FUNCTION has_tenant_access(record_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT (
    is_super_admin()
    OR record_tenant_id = current_tenant_id()
    OR record_tenant_id IN ('default_tenant', 'empresa_padrao', 'all')
    OR record_tenant_id IS NULL
    OR current_tenant_id() IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION current_tenant_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION current_user_nivel() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION has_tenant_access(TEXT) TO authenticated, anon;

-- =============================================================================
-- 2. TABELA: tenants (Empresas)
-- =============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ver tenants" ON tenants;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir tenants" ON tenants;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar tenants" ON tenants;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir tenants" ON tenants;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam tenants" ON tenants;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam tenants (ALL)" ON tenants;
DROP POLICY IF EXISTS "Somente super_admin pode incluir empresas" ON tenants;
DROP POLICY IF EXISTS "Super_admin edita tudo e admin edita sua respectiva empresa" ON tenants;
DROP POLICY IF EXISTS "Somente super_admin pode excluir empresas" ON tenants;
DROP POLICY IF EXISTS "tenants_select_policy" ON tenants;
DROP POLICY IF EXISTS "tenants_insert_policy" ON tenants;
DROP POLICY IF EXISTS "tenants_update_policy" ON tenants;
DROP POLICY IF EXISTS "tenants_delete_policy" ON tenants;

CREATE POLICY "tenants_select_policy" ON tenants
FOR SELECT TO authenticated
USING (deleted_at IS NULL AND (is_super_admin() OR id::text = current_tenant_id() OR current_tenant_id() IS NULL));

CREATE POLICY "tenants_insert_policy" ON tenants
FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR current_tenant_id() IS NULL);

CREATE POLICY "tenants_update_policy" ON tenants
FOR UPDATE TO authenticated
USING (is_super_admin() OR id::text = current_tenant_id())
WITH CHECK (is_super_admin() OR id::text = current_tenant_id());

CREATE POLICY "tenants_delete_policy" ON tenants
FOR DELETE TO authenticated
USING (is_super_admin());

-- =============================================================================
-- 3. TABELA: users
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem próprio perfil ou admin vê todos" ON users;
DROP POLICY IF EXISTS "Apenas super_admin pode criar usuários" ON users;
DROP POLICY IF EXISTS "Admin pode atualizar usuários do seu tenant" ON users;
DROP POLICY IF EXISTS "Usuários autenticados veem usuários" ON users;
DROP POLICY IF EXISTS "Usuários autenticados criam usuários" ON users;
DROP POLICY IF EXISTS "Usuários autenticados atualizam usuários" ON users;
DROP POLICY IF EXISTS "Usuários autenticados deletam usuários" ON users;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam users" ON users;
DROP POLICY IF EXISTS "Criação de usuários com controle de nível" ON users;
DROP POLICY IF EXISTS "Edição de usuários com controle de nível" ON users;
DROP POLICY IF EXISTS "Exclusão de usuários com controle de nível" ON users;
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_delete_policy" ON users;

CREATE POLICY "users_select_policy" ON users
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (
    is_super_admin()
    OR id = auth.uid()
    OR has_tenant_access(tenant_id)
  )
);

CREATE POLICY "users_insert_policy" ON users
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR id = auth.uid()
  OR has_tenant_access(tenant_id)
);

CREATE POLICY "users_update_policy" ON users
FOR UPDATE TO authenticated
USING (
  is_super_admin()
  OR id = auth.uid()
  OR (current_user_nivel() IN ('admin', 'gerente') AND has_tenant_access(tenant_id))
)
WITH CHECK (
  is_super_admin()
  OR id = auth.uid()
  OR (current_user_nivel() IN ('admin', 'gerente') AND has_tenant_access(tenant_id))
);

CREATE POLICY "users_delete_policy" ON users
FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR (current_user_nivel() = 'admin' AND has_tenant_access(tenant_id) AND id <> auth.uid())
);

-- =============================================================================
-- 4. TABELA: associados
-- =============================================================================
ALTER TABLE associados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam associados" ON associados;
DROP POLICY IF EXISTS "associados_tenant_policy" ON associados;

CREATE POLICY "associados_tenant_policy" ON associados
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

-- =============================================================================
-- 5. TABELA: dependentes
-- =============================================================================
ALTER TABLE dependentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam dependentes" ON dependentes;
DROP POLICY IF EXISTS "dependentes_tenant_policy" ON dependentes;

CREATE POLICY "dependentes_tenant_policy" ON dependentes
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

-- =============================================================================
-- 6. TABELA: contratos
-- =============================================================================
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam contratos" ON contratos;
DROP POLICY IF EXISTS "contratos_tenant_policy" ON contratos;

CREATE POLICY "contratos_tenant_policy" ON contratos
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

-- =============================================================================
-- 7. TABELAS: planos_pax, planos_pax_coberturas, planos_pax_faixas
-- =============================================================================
ALTER TABLE planos_pax ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_pax_coberturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_pax_faixas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Planos pax lidos por todos os usuários autenticados" ON planos_pax;
DROP POLICY IF EXISTS "Planos pax modificados por admin e gerente" ON planos_pax;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam planos_pax" ON planos_pax;
DROP POLICY IF EXISTS "planos_pax_tenant_policy" ON planos_pax;

CREATE POLICY "planos_pax_tenant_policy" ON planos_pax
FOR ALL TO authenticated
USING (tenant_id IS NULL OR has_tenant_access(tenant_id))
WITH CHECK (tenant_id IS NULL OR has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Planos pax coberturas lidos por todos os usuários autenticados" ON planos_pax_coberturas;
DROP POLICY IF EXISTS "Planos pax coberturas modificados por admin e gerente" ON planos_pax_coberturas;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam planos_pax_coberturas" ON planos_pax_coberturas;
DROP POLICY IF EXISTS "planos_pax_coberturas_tenant_policy" ON planos_pax_coberturas;

CREATE POLICY "planos_pax_coberturas_tenant_policy" ON planos_pax_coberturas
FOR ALL TO authenticated
USING (tenant_id IS NULL OR has_tenant_access(tenant_id))
WITH CHECK (tenant_id IS NULL OR has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Planos pax faixas lidas por todos os usuários autenticados" ON planos_pax_faixas;
DROP POLICY IF EXISTS "Planos pax faixas modificadas por admin e gerente" ON planos_pax_faixas;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam planos_pax_faixas" ON planos_pax_faixas;
DROP POLICY IF EXISTS "planos_pax_faixas_tenant_policy" ON planos_pax_faixas;

CREATE POLICY "planos_pax_faixas_tenant_policy" ON planos_pax_faixas
FOR ALL TO authenticated
USING (tenant_id IS NULL OR has_tenant_access(tenant_id))
WITH CHECK (tenant_id IS NULL OR has_tenant_access(tenant_id));

-- =============================================================================
-- 8. TABELA: itens_funerarios
-- =============================================================================
ALTER TABLE itens_funerarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Itens funerarios lidos por todos os usuários autenticados" ON itens_funerarios;
DROP POLICY IF EXISTS "Itens funerarios modificados por admin e gerente" ON itens_funerarios;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam itens_funerarios" ON itens_funerarios;
DROP POLICY IF EXISTS "itens_funerarios_tenant_policy" ON itens_funerarios;

CREATE POLICY "itens_funerarios_tenant_policy" ON itens_funerarios
FOR ALL TO authenticated
USING (tenant_id IS NULL OR has_tenant_access(tenant_id))
WITH CHECK (tenant_id IS NULL OR has_tenant_access(tenant_id));

-- =============================================================================
-- 9. TABELAS: credenciados, credenciados_planos, credenciados_procedimentos
-- =============================================================================
ALTER TABLE credenciados ENABLE ROW LEVEL SECURITY;
ALTER TABLE credenciados_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE credenciados_procedimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam credenciados" ON credenciados;
DROP POLICY IF EXISTS "credenciados_tenant_policy" ON credenciados;

CREATE POLICY "credenciados_tenant_policy" ON credenciados
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários autenticados gerenciam credenciados_planos" ON credenciados_planos;
DROP POLICY IF EXISTS "credenciados_planos_tenant_policy" ON credenciados_planos;

CREATE POLICY "credenciados_planos_tenant_policy" ON credenciados_planos
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Usuários autenticados gerenciam credenciados_procedimentos" ON credenciados_procedimentos;
DROP POLICY IF EXISTS "credenciados_procedimentos_tenant_policy" ON credenciados_procedimentos;

CREATE POLICY "credenciados_procedimentos_tenant_policy" ON credenciados_procedimentos
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- =============================================================================
-- 10. TABELA: procedimentos
-- =============================================================================
ALTER TABLE procedimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam procedimentos" ON procedimentos;
DROP POLICY IF EXISTS "procedimentos_tenant_policy" ON procedimentos;

CREATE POLICY "procedimentos_tenant_policy" ON procedimentos
FOR ALL TO authenticated
USING (tenant_id IS NULL OR has_tenant_access(tenant_id))
WITH CHECK (tenant_id IS NULL OR has_tenant_access(tenant_id));

-- =============================================================================
-- 11. TABELAS FINANCEIRAS: fornecedores, contas_bancarias, receitas, parcelas_receber, despesas, parcelas_pagar
-- =============================================================================
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam fornecedores" ON fornecedores;
DROP POLICY IF EXISTS "fornecedores_tenant_policy" ON fornecedores;
CREATE POLICY "fornecedores_tenant_policy" ON fornecedores
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários autenticados gerenciam contas_bancarias" ON contas_bancarias;
DROP POLICY IF EXISTS "contas_bancarias_tenant_policy" ON contas_bancarias;
CREATE POLICY "contas_bancarias_tenant_policy" ON contas_bancarias
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários autenticados gerenciam receitas" ON receitas;
DROP POLICY IF EXISTS "receitas_tenant_policy" ON receitas;
CREATE POLICY "receitas_tenant_policy" ON receitas
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários autenticados gerenciam parcelas a receber" ON parcelas_receber;
DROP POLICY IF EXISTS "parcelas_receber_tenant_policy" ON parcelas_receber;
CREATE POLICY "parcelas_receber_tenant_policy" ON parcelas_receber
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários autenticados gerenciam despesas" ON despesas;
DROP POLICY IF EXISTS "despesas_tenant_policy" ON despesas;
CREATE POLICY "despesas_tenant_policy" ON despesas
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários autenticados gerenciam parcelas a pagar" ON parcelas_pagar;
DROP POLICY IF EXISTS "parcelas_pagar_tenant_policy" ON parcelas_pagar;
CREATE POLICY "parcelas_pagar_tenant_policy" ON parcelas_pagar
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

-- =============================================================================
-- 12. TABELAS OPERACIONAIS: requisicoes, requisicao_itens, remessas_faturamento, lotes_caixa, movimentacoes_caixa
-- =============================================================================
ALTER TABLE requisicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisicao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE remessas_faturamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_caixa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam requisicoes" ON requisicoes;
DROP POLICY IF EXISTS "requisicoes_tenant_policy" ON requisicoes;
CREATE POLICY "requisicoes_tenant_policy" ON requisicoes
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários autenticados gerenciam requisicao_itens" ON requisicao_itens;
DROP POLICY IF EXISTS "requisicao_itens_tenant_policy" ON requisicao_itens;
CREATE POLICY "requisicao_itens_tenant_policy" ON requisicao_itens
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários autenticados gerenciam remessas de faturamento" ON remessas_faturamento;
DROP POLICY IF EXISTS "remessas_faturamento_tenant_policy" ON remessas_faturamento;
CREATE POLICY "remessas_faturamento_tenant_policy" ON remessas_faturamento
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários autenticados gerenciam lotes de caixa" ON lotes_caixa;
DROP POLICY IF EXISTS "lotes_caixa_tenant_policy" ON lotes_caixa;
CREATE POLICY "lotes_caixa_tenant_policy" ON lotes_caixa
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários autenticados gerenciam movimentações de caixa" ON movimentacoes_caixa;
DROP POLICY IF EXISTS "movimentacoes_caixa_tenant_policy" ON movimentacoes_caixa;
CREATE POLICY "movimentacoes_caixa_tenant_policy" ON movimentacoes_caixa
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

-- =============================================================================
-- 13. TABELAS: atendimentos, atendimento_itens
-- =============================================================================
ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam atendimentos" ON atendimentos;
DROP POLICY IF EXISTS "atendimentos_tenant_policy" ON atendimentos;
CREATE POLICY "atendimentos_tenant_policy" ON atendimentos
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários autenticados gerenciam atendimento_itens" ON atendimento_itens;
DROP POLICY IF EXISTS "atendimento_itens_tenant_policy" ON atendimento_itens;
CREATE POLICY "atendimento_itens_tenant_policy" ON atendimento_itens
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

-- =============================================================================
-- 14. TABELAS: auditoria, notificacoes, documentos_padroes
-- =============================================================================
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_padroes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados gerenciam auditoria" ON auditoria;
DROP POLICY IF EXISTS "auditoria_tenant_policy" ON auditoria;
CREATE POLICY "auditoria_tenant_policy" ON auditoria
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários veem suas próprias notificações" ON notificacoes;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam notificacoes" ON notificacoes;
DROP POLICY IF EXISTS "notificacoes_tenant_policy" ON notificacoes;
CREATE POLICY "notificacoes_tenant_policy" ON notificacoes
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Usuários autenticados gerenciam documentos padrões" ON documentos_padroes;
DROP POLICY IF EXISTS "documentos_padroes_tenant_policy" ON documentos_padroes;
CREATE POLICY "documentos_padroes_tenant_policy" ON documentos_padroes
FOR ALL TO authenticated
USING (tenant_id IS NULL OR has_tenant_access(tenant_id))
WITH CHECK (tenant_id IS NULL OR has_tenant_access(tenant_id));
