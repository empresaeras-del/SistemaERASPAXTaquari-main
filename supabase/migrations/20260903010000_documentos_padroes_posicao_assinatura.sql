-- =============================================================================
-- MIGRATION: Posição livre da assinatura da empresa em documentos padrão
-- Sistema ERAS PAX Taquari
-- Data: 2026-09-03
-- =============================================================================
-- Até aqui a assinatura da empresa (tenants.assinatura_url) era sempre
-- renderizada fixa no rodapé, centralizada. Esta migration adiciona a
-- posição livre (x/y, em % da página A4) que o usuário escolhe arrastando
-- a assinatura no editor de documentos padrão.
--
-- Guardado como % da largura/altura da página (não em pixels/mm) para não
-- depender de zoom, resolução de tela ou orientação retrato/paisagem —
-- tanto a pré-visualização quanto a impressão calculam a posição em cima
-- das mesmas dimensões relativas.
--
-- assinatura_pos_x/assinatura_pos_y NULL (o padrão) preserva o
-- comportamento atual — rodapé fixo — para todo documento já cadastrado.
-- =============================================================================

ALTER TABLE documentos_padroes ADD COLUMN IF NOT EXISTS assinatura_pos_x NUMERIC(5,2);
ALTER TABLE documentos_padroes ADD COLUMN IF NOT EXISTS assinatura_pos_y NUMERIC(5,2);

ALTER TABLE documentos_padroes ADD CONSTRAINT documentos_padroes_assinatura_pos_x_check
  CHECK (assinatura_pos_x IS NULL OR (assinatura_pos_x >= 0 AND assinatura_pos_x <= 100));
ALTER TABLE documentos_padroes ADD CONSTRAINT documentos_padroes_assinatura_pos_y_check
  CHECK (assinatura_pos_y IS NULL OR (assinatura_pos_y >= 0 AND assinatura_pos_y <= 100));
