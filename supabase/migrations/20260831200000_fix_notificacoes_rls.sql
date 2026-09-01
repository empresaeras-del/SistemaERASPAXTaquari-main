-- =============================================================================
-- MIGRATION: Correção Definitiva de RLS e Schema da Tabela "notificacoes"
-- Sistema ERAS PAX Taquari
-- Data: 2026-08-31
-- =============================================================================
-- Problema:
--   O log do Postgres no Supabase apresentava erro persistente de RLS:
--   "42501 new row violates row-level security policy for table notificacoes"
--
-- Causa:
--   A política RLS anterior exigia has_tenant_access(tenant_id) estrito para
--   todas as operações, inclusive quando:
--   1. A notificação é endereçada ao usuário logado (usuario_id = auth.uid())
--   2. O tenant_id é 'all' ou NULL (notificações do sistema)
--   3. Havia incompatibilidade entre usuario_id (TEXT) e user_id (UUID), ou
--      constraints restritivas no campo "tipo".
--
-- Solução:
--   1. Garantir que as colunas e tipos necessários existam (usuario_id, tenant_id, etc.)
--   2. Remover constraints restritivas de tipo
--   3. Recriar políticas RLS abrangentes para SELECT, INSERT, UPDATE e DELETE
--   4. Criar índices para otimização de consultas
-- =============================================================================

-- 1. Garantir que a tabela existe com todas as colunas necessárias
CREATE TABLE IF NOT EXISTS public.notificacoes (
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

-- 2. Assegurar que colunas opcionais ou adicionadas posteriormente existam
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS tenant_id   TEXT;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS usuario_id  TEXT;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS lida        BOOLEAN DEFAULT FALSE;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS link        TEXT;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();

-- 3. Remover NOT NULL da coluna tenant_id caso exista (permite notificações globais)
ALTER TABLE public.notificacoes ALTER COLUMN tenant_id DROP NOT NULL;

-- 4. Remover constraint de tipo antiga caso exista para permitir 'alerta', 'acao', etc.
ALTER TABLE public.notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;

-- 5. Habilitar Row Level Security
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- 6. Remover todas as políticas antigas
DROP POLICY IF EXISTS "Usuários veem suas próprias notificações" ON public.notificacoes;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_tenant_policy" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_select_policy" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_insert_policy" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_update_policy" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_delete_policy" ON public.notificacoes;

-- 7. Criar novas políticas de RLS granulares

-- SELECT: Usuários autenticados podem ver notificações se:
--   - For super_admin
--   - OU for o destinatário da notificação (usuario_id bate com seu ID ou 'all')
--   - OU a notificação pertencer ao seu tenant (has_tenant_access)
--   - OU o tenant for global ('all', 'default_tenant' ou NULL)
CREATE POLICY "notificacoes_select_policy" ON public.notificacoes
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR usuario_id = auth.uid()::text
  OR usuario_id = 'all'
  OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
  OR tenant_id IS NULL
  OR tenant_id IN ('all', 'default_tenant', 'empresa_padrao')
);

-- INSERT: Usuários autenticados podem inserir notificações se:
--   - For super_admin
--   - OU criar notificação para si mesmo ou para 'all'
--   - OU criar notificação no seu respectivo tenant
--   - OU criar notificação global
CREATE POLICY "notificacoes_insert_policy" ON public.notificacoes
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR usuario_id = auth.uid()::text
  OR usuario_id = 'all'
  OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
  OR tenant_id IS NULL
  OR tenant_id IN ('all', 'default_tenant', 'empresa_padrao')
);

-- UPDATE: Usuários autenticados podem atualizar notificações (ex: marcar como lida):
--   - Se for sua notificação ou do seu tenant
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
WITH CHECK (true);

-- DELETE: Usuários autenticados podem excluir notificações que lhes pertencem ou do seu tenant
CREATE POLICY "notificacoes_delete_policy" ON public.notificacoes
FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR usuario_id = auth.uid()::text
  OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
);

-- 8. Índices para performance das consultas de notificações
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_id ON public.notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tenant_id ON public.notificacoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_deleted_at ON public.notificacoes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at ON public.notificacoes(created_at DESC);
