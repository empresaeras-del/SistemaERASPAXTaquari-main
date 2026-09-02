-- =============================================================================
-- MIGRATION: Corrige políticas de RLS totalmente abertas (vazamento entre tenants)
-- Sistema ERAS PAX Taquari
-- Data: 2026-09-02
-- =============================================================================
-- Encontrado ao escrever a suíte de testes automatizados (pgTAP) de isolamento
-- multi-tenant: várias tabelas mantinham, lado a lado com sua política
-- corretamente restrita por tenant, uma política antiga totalmente aberta
-- (USING/WITH CHECK true, ou sem nenhuma checagem de tenant) que nunca foi
-- removida:
--
--   - associados/dependentes/contratos: a política aberta foi RECRIADA por
--     engano em 20260830200000_fix_associados_dependentes_contratos.sql,
--     depois de já ter sido corrigida em 20260818010000.
--   - associados também mantinha uma 2ª política de SELECT antiga
--     ("...leem associados do seu tenant") sem nenhuma checagem de tenant.
--   - contas_bancarias/requisicoes: o DROP tentado em
--     20260818010000_multi_tenant_rls_policies.sql usava um nome de política
--     sem os acentos do nome original ("contas_bancarias" ao invés de
--     "contas bancárias", "requisicoes" ao invés de "requisições") e por
--     isso nunca surtiu efeito — o DROP IF EXISTS falhou silenciosamente.
--   - auditoria: qualquer usuário autenticado podia inserir um registro
--     atribuído a QUALQUER tenant, e qualquer admin/gerente podia LER os
--     logs de auditoria de QUALQUER empresa (a política só checava o nível
--     do usuário, nunca o tenant do registro).
--   - notificacoes: a política de UPDATE validava corretamente o registro
--     atual (USING), mas aceitava qualquer alteração no novo valor
--     (WITH CHECK true) — permitia reatribuir uma notificação para outro
--     usuário/tenant ao editá-la.
--
-- Como o Postgres combina políticas permissivas com OR, bastava UMA política
-- aberta para anular todo o isolamento por tenant da tabela: qualquer usuário
-- autenticado de QUALQUER empresa podia ler/editar/excluir os associados,
-- dependentes, contratos, contas bancárias e requisições de QUALQUER OUTRA
-- empresa cadastrada no sistema.
-- =============================================================================

-- 1. associados: remove a política ALL totalmente aberta e a política de
--    SELECT antiga que nunca checava o tenant do registro. Resta apenas
--    "associados_tenant_policy" (USING/WITH CHECK has_tenant_access(tenant_id)).
DROP POLICY IF EXISTS "Usuários autenticados gerenciam associados" ON associados;
DROP POLICY IF EXISTS "Usuários autenticados leem associados do seu tenant" ON associados;

-- 2. dependentes / contratos: idem, resta apenas a *_tenant_policy de cada uma.
DROP POLICY IF EXISTS "Usuários autenticados gerenciam dependentes" ON dependentes;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam contratos" ON contratos;

-- 3. contas_bancarias / requisicoes: mesma causa raiz (nome do DROP anterior
--    não batia com o nome real, acentuado, da política).
DROP POLICY IF EXISTS "Usuários autenticados gerenciam contas bancárias" ON contas_bancarias;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam requisições" ON requisicoes;

-- 4. auditoria: inserir só é permitido em nome do próprio tenant do usuário;
--    ler os logs de auditoria exige nível administrativo E acesso ao tenant
--    do registro (super_admin continua vendo tudo via has_tenant_access).
DROP POLICY IF EXISTS "Usuários autenticados podem inserir auditoria" ON auditoria;
CREATE POLICY "Usuários autenticados podem inserir auditoria"
ON auditoria FOR INSERT TO authenticated
WITH CHECK (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Admin pode ler auditoria" ON auditoria;
CREATE POLICY "Admin pode ler auditoria"
ON auditoria FOR SELECT TO authenticated
USING (
  current_user_nivel() IN ('super_admin', 'admin', 'gerente')
  AND has_tenant_access(tenant_id)
);

-- 5. notificacoes: WITH CHECK passa a exigir a mesma condição do USING, para
--    que atualizar uma notificação não possa reatribuí-la para fora do
--    escopo permitido.
DROP POLICY IF EXISTS "notificacoes_update_policy" ON public.notificacoes;
CREATE POLICY "notificacoes_update_policy" ON public.notificacoes
FOR UPDATE TO authenticated
USING (
  is_super_admin()
  OR usuario_id = auth.uid()::text
  OR usuario_id = 'all'
  OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
  OR tenant_id IS NULL
  OR tenant_id IN ('all', 'default_tenant', 'empresa_padrao')
)
WITH CHECK (
  is_super_admin()
  OR usuario_id = auth.uid()::text
  OR usuario_id = 'all'
  OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
  OR tenant_id IS NULL
  OR tenant_id IN ('all', 'default_tenant', 'empresa_padrao')
);
