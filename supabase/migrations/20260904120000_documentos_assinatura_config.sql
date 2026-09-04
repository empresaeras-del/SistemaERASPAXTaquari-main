-- =============================================================================
-- MIGRATION: Posição livre da assinatura da empresa nos Documentos Padrões
-- Sistema ERAS PAX Taquari
-- Data: 2026-09-04
-- =============================================================================
-- Contexto: hoje a assinatura da empresa é sempre renderizada fixa, centralizada,
-- no rodapé de todo documento gerado. Esta coluna permite que cada modelo de
-- documento tenha sua própria posição/tamanho de assinatura (arrastar-e-soltar
-- no editor), guardada em % da página A4 para funcionar em qualquer zoom/tela.
-- Ausente/NULL preserva o comportamento legado (rodapé fixo).
-- =============================================================================

ALTER TABLE documentos_padroes ADD COLUMN IF NOT EXISTS assinatura_config JSONB;

COMMENT ON COLUMN documentos_padroes.assinatura_config IS
  'Posição/tamanho da assinatura da empresa neste modelo: {x, y, largura, altura, pagina} em % da página. NULL = rodapé fixo (comportamento legado).';
