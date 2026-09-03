-- =============================================================================
-- MIGRATION: Fechamento de RLS — associados/dependentes/contratos e módulo
--            financeiro (policies permissivas órfãs identificadas em auditoria)
-- Sistema ERAS PAX Taquari
-- Data: 2026-09-03
-- =============================================================================
-- CONTEXTO
-- Uma auditoria do histórico completo de migrations (não apenas da última que
-- toca cada tabela) revelou que várias tabelas sensíveis continuam acessíveis
-- por QUALQUER usuário autenticado, de QUALQUER empresa (tenant), porque
-- policies "USING(true)" antigas nunca foram removidas — elas coexistem com
-- policies restritivas corretas criadas depois. No Postgres, policies
-- permissivas do mesmo comando são combinadas com OR: basta UMA policy aberta
-- para anular qualquer outra restritiva na mesma tabela.
--
-- Casos confirmados:
--  1) associados / dependentes / contratos — 20260830200000 recriou a policy
--     "Usuários autenticados gerenciam X" com USING(true)/WITH CHECK(true)
--     SEM remover "X_tenant_policy" (criada em 20260818010000, já correta,
--     baseada em has_tenant_access). As duas ficaram ativas ao mesmo tempo e
--     a aberta prevalece — isolamento multi-tenant efetivamente desativado
--     para dados pessoais de associados/dependentes e contratos.
--  2) contas_bancarias — 20260817110000 criou a policy
--     "Usuários autenticados gerenciam contas bancárias" (nome com espaço e
--     acento). Nenhuma migration seguinte referenciou esse nome exato — todas
--     usam "...contas_bancarias" com underscore, um nome diferente — então
--     essa policy órfã com USING(true) nunca foi removida e permanece ativa.
--
-- fornecedores, receitas, parcelas_receber, despesas e parcelas_pagar não
-- apresentaram esse problema nesta auditoria (o histórico mostra que a policy
-- antiga foi corretamente removida antes da criação da policy restritiva),
-- mas são incluídas aqui também: em vez de confiar na leitura estática do
-- histórico de arquivos, a correção abaixo remove DINAMICAMENTE todas as
-- policies hoje ativas em cada tabela-alvo (consultando pg_policies) antes de
-- recriar exatamente uma policy, eliminando qualquer resíduo desconhecido —
-- inclusive um que uma leitura manual do histórico possa não ter capturado.
-- =============================================================================

DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'associados', 'dependentes', 'contratos',
    'contas_bancarias', 'fornecedores', 'receitas', 'parcelas_receber',
    'despesas', 'parcelas_pagar'
  ]
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Garante RLS habilitada (idempotente)
ALTER TABLE associados ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_pagar ENABLE ROW LEVEL SECURITY;

-- Recria exatamente uma policy por tabela, no mesmo padrão já usado em
-- users/tenants/credenciados: isolamento por tenant_id via has_tenant_access(),
-- com bypass apenas para super_admin (ver função em 20260818010000, corrigida
-- em 20260831190000 para não ter bypass via NULL).
CREATE POLICY "associados_tenant_policy" ON associados
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "dependentes_tenant_policy" ON dependentes
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "contratos_tenant_policy" ON contratos
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "contas_bancarias_tenant_policy" ON contas_bancarias
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "fornecedores_tenant_policy" ON fornecedores
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "receitas_tenant_policy" ON receitas
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "parcelas_receber_tenant_policy" ON parcelas_receber
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "despesas_tenant_policy" ON despesas
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "parcelas_pagar_tenant_policy" ON parcelas_pagar
FOR ALL TO authenticated
USING (has_tenant_access(tenant_id))
WITH CHECK (has_tenant_access(tenant_id));

-- Índices para performance das políticas RLS (idempotente)
CREATE INDEX IF NOT EXISTS idx_associados_tenant_id ON associados(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dependentes_tenant_id ON dependentes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contratos_tenant_id ON contratos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contas_bancarias_tenant_id ON contas_bancarias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_tenant_id ON fornecedores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receitas_tenant_id ON receitas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_receber_tenant_id ON parcelas_receber(tenant_id);
CREATE INDEX IF NOT EXISTS idx_despesas_tenant_id ON despesas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_pagar_tenant_id ON parcelas_pagar(tenant_id);

-- =============================================================================
-- VERIFICAÇÃO PÓS-DEPLOY (rodar manualmente após aplicar em produção)
-- Deve retornar exatamente 1 linha por tabela, todas com has_tenant_access:
--
-- SELECT tablename, policyname, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'associados','dependentes','contratos','contas_bancarias',
--     'fornecedores','receitas','parcelas_receber','despesas','parcelas_pagar'
--   )
-- ORDER BY tablename;
-- =============================================================================
