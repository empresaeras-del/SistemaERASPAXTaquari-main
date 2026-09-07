-- =============================================================================
-- MIGRATION: credenciados.especialidade — documentação e índice
-- Sistema ERAS PAX Taquari
-- Data: 2026-09-07
-- =============================================================================
-- CONTEXTO
-- A coluna `especialidade` (TEXT) já existia desde 20260817100000, mas nunca foi
-- exposta no frontend: não estava na interface TypeScript nem no formulário de
-- credenciados, e os registros em produção estavam todos com ela nula. Ou seja,
-- o inverso do bug recorrente descrito no CLAUDE.md — aqui a coluna existia e o
-- código é que não a usava.
--
-- Esta migration não cria a coluna (ADD COLUMN IF NOT EXISTS é mantido só para
-- ambientes que porventura não tenham rodado a migration original): ela
-- documenta o conteúdo esperado e adiciona o índice que o filtro por
-- especialidade na listagem vai usar.
-- =============================================================================

ALTER TABLE public.credenciados
  ADD COLUMN IF NOT EXISTS especialidade TEXT;

COMMENT ON COLUMN public.credenciados.especialidade IS
  'Especialidade médica do credenciado, gravada pelo rótulo (ex.: "Cardiologia"). '
  'Catálogo em src/config/especialidadesConselhos.ts — as 55 especialidades da '
  'Resolução CFM 2.221/2018, que é a lista que o CRM/MS usa para registrar '
  'especialistas. Opcional: credenciados não-médicos (laboratório, farmácia, '
  'odontologia) podem ficar sem especialidade.';

-- Filtro por especialidade na listagem de credenciados; parcial porque a
-- maioria das linhas fica nula e não precisa entrar no índice.
CREATE INDEX IF NOT EXISTS idx_credenciados_especialidade
  ON public.credenciados (especialidade)
  WHERE especialidade IS NOT NULL;
