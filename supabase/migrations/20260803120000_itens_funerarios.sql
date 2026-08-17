-- Tabela: itens_funerarios
-- Representa cada item/serviço que pode compor um plano PAX

CREATE TABLE itens_funerarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        TEXT NOT NULL UNIQUE,         -- ex: "URNA-001", "VELORIO-PADRAO"
  nome          TEXT NOT NULL,                -- nome exibido nos formulários
  descricao     TEXT,                         -- detalhamento opcional
  categoria     TEXT NOT NULL,                -- enum: ver abaixo
  unidade       TEXT NOT NULL DEFAULT 'unidade', -- unidade de medida se aplicável
  valor_referencia NUMERIC(10,2),             -- valor de custo de referência (opcional)
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  ordem_exibicao INTEGER NOT NULL DEFAULT 0,  -- controla ordem nos checkboxes
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES auth.users(id)
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_itens_funerarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER itens_funerarios_updated_at_trigger
BEFORE UPDATE ON itens_funerarios
FOR EACH ROW
EXECUTE FUNCTION update_itens_funerarios_updated_at();

-- RLS
ALTER TABLE itens_funerarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Itens funerarios lidos por todos os usuários autenticados"
ON itens_funerarios FOR SELECT
TO authenticated
USING (ativo = TRUE OR ativo = FALSE); -- All items can be read

CREATE POLICY "Itens funerarios modificados por admin e gerente"
ON itens_funerarios FOR ALL
TO authenticated
USING (
  current_setting('request.jwt.claims', true)::jsonb ->> 'role' IN ('admin', 'gerente')
)
WITH CHECK (
  current_setting('request.jwt.claims', true)::jsonb ->> 'role' IN ('admin', 'gerente')
);

-- Indexes
CREATE INDEX idx_itens_funerarios_ativo ON itens_funerarios(ativo);
CREATE INDEX idx_itens_funerarios_categoria ON itens_funerarios(categoria);
CREATE INDEX idx_itens_funerarios_ordem_exibicao ON itens_funerarios(ordem_exibicao);

-- Seed (optional)
INSERT INTO itens_funerarios (codigo, nome, categoria, valor_referencia, ordem_exibicao) VALUES
('TR-001', 'Translado Local', 'translado', 250.00, 10),
('TR-002', 'Translado Intermunicipal', 'translado', 500.00, 20),
('PR-001', 'Higienização e Ornamentação', 'preparacao', 150.00, 30),
('PR-002', 'Tanatopraxia', 'preparacao', 800.00, 40),
('UR-001', 'Urna Padrão', 'urna', 900.00, 50),
('UR-002', 'Urna Luxo', 'urna', 2500.00, 60),
('VL-001', 'Velório Padrão (24h)', 'velorio', 1200.00, 70),
('CT-001', 'Carro Funerário (Cortejo)', 'cortejo', 300.00, 80),
('SP-001', 'Taxa de Sepultamento', 'sepultamento', 150.00, 90),
('SP-002', 'Lápide de Granito', 'sepultamento', 450.00, 100),
('DC-001', 'Guia de Sepultamento', 'documentacao', 50.00, 110),
('DC-002', 'Certidão de Óbito', 'documentacao', 100.00, 120),
('FL-001', 'Coroa de Flores Média', 'flores', 200.00, 130),
('FL-002', 'Arranjo de Urna', 'flores', 180.00, 140),
('AP-001', 'Buffet Velório (Café/Chá)', 'apoio_familia', 350.00, 150);
