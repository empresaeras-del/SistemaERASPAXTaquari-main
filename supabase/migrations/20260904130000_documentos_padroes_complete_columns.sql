-- Completa as colunas de documentos_padroes que já existem no tipo DocumentoPadrao (TypeScript)
-- mas nunca chegaram ao schema real, causando descarte silencioso via PGRST204 no hook de salvamento
-- (achado crítico do Diagnóstico ERAS PAX de 04/09/2026 — Fase 0).
ALTER TABLE public.documentos_padroes
  ADD COLUMN IF NOT EXISTS cabecalho_html text,
  ADD COLUMN IF NOT EXISTS rodape_html text,
  ADD COLUMN IF NOT EXISTS margens jsonb,
  ADD COLUMN IF NOT EXISTS orientacao text,
  ADD COLUMN IF NOT EXISTS tamanho_papel text,
  ADD COLUMN IF NOT EXISTS padrao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS variaveis_disponiveis jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.documentos_padroes.cabecalho_html IS 'HTML customizado de cabeçalho, opcional (fallback: logo/nome da empresa)';
COMMENT ON COLUMN public.documentos_padroes.rodape_html IS 'HTML customizado de rodapé, opcional (fallback: assinatura da empresa)';
COMMENT ON COLUMN public.documentos_padroes.margens IS 'Margens da página em mm: {top, bottom, left, right}';
COMMENT ON COLUMN public.documentos_padroes.orientacao IS 'retrato | paisagem';
COMMENT ON COLUMN public.documentos_padroes.tamanho_papel IS 'a4 | carta | oficio';
COMMENT ON COLUMN public.documentos_padroes.padrao IS 'Marca este modelo como padrão para o seu tipo de documento';
COMMENT ON COLUMN public.documentos_padroes.variaveis_disponiveis IS 'Variáveis personalizadas criadas pelo usuário no editor: [{chave, label, descricao}]';
