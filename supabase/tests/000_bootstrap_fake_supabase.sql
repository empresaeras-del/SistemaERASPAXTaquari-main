-- =============================================================================
-- BOOTSTRAP PARA TESTES DE RLS (pgTAP)
-- =============================================================================
-- Este arquivo NÃO é uma migration e nunca deve ser copiado para
-- supabase/migrations/. Ele só existe para permitir rodar as migrations reais
-- do projeto contra um Postgres "puro" (local ou de CI), recriando o mínimo
-- necessário do ambiente que o Supabase hospedado já fornece de fábrica:
-- os schemas/roles/funções de auth e storage.
--
-- Uso local:
--   createdb eras_rls_test
--   psql eras_rls_test -v ON_ERROR_STOP=1 -f supabase/tests/000_bootstrap_fake_supabase.sql
--   for f in supabase/migrations/*.sql; do
--     psql eras_rls_test -v ON_ERROR_STOP=1 -f "$f"
--   done
--   pg_prove --ext .sql -d eras_rls_test supabase/tests/0[1-9]*.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

-- ---------------------------------------------------------------------------
-- Roles usadas pelas políticas de RLS (CREATE POLICY ... TO authenticated)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

GRANT anon TO CURRENT_USER;
GRANT authenticated TO CURRENT_USER;
GRANT service_role TO CURRENT_USER;

-- ---------------------------------------------------------------------------
-- Schemas equivalentes aos que o Supabase hospedado já provisiona
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS storage;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

-- No Supabase hospedado, anon/authenticated/service_role recebem privilégios
-- amplos de tabela no schema public por padrão — a segurança de verdade vem
-- do RLS, não do GRANT. Reproduz isso aqui via default privileges, para que
-- toda tabela criada pelas migrations (rodadas com este mesmo role) já saia
-- acessível a esses roles, exatamente como em produção.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- auth.users (mínimo necessário) + auth.uid()/auth.role(), como no Supabase
-- (mesma definição usada pelo GoTrue: lê os claims setados na sessão)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT,
  encrypted_password  TEXT,
  raw_app_meta_data   JSONB DEFAULT '{}'::jsonb,
  raw_user_meta_data  JSONB DEFAULT '{}'::jsonb,
  banned_until        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON auth.users TO service_role, authenticated, anon;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )
$$;

-- ---------------------------------------------------------------------------
-- storage.buckets / storage.objects (usados pela migration de assets de tenants)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storage.buckets (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  public  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id   TEXT REFERENCES storage.buckets(id),
  name        TEXT,
  owner       UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON storage.buckets TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helper para os testes: simula uma requisição autenticada como um usuário
-- específico (equivalente ao que o PostgREST faz com o JWT do Supabase).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION test_login_as(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END;
$$;

CREATE OR REPLACE FUNCTION test_logout()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  EXECUTE 'RESET ROLE';
END;
$$;
