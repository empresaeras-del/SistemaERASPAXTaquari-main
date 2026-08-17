CREATE TABLE planos_pax (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                TEXT NOT NULL UNIQUE,     -- ex: "PAX-IND-BASICO"
  nome                  TEXT NOT NULL,            -- ex: "Plano Individual Básico"
  descricao             TEXT,
  tipo_plano            TEXT NOT NULL CHECK (tipo_plano IN ('individual', 'coletivo')),
  
  -- Regras de elegibilidade
  limite_vidas          INTEGER,                  -- NULL se individual; obrigatório se coletivo
  idade_minima          INTEGER DEFAULT 0,
  idade_maxima          INTEGER,                  -- NULL = sem limite
  
  -- Valores comerciais
  valor_mensalidade     NUMERIC(10,2) NOT NULL,
  taxa_adesao           NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Carência (em dias para cada evento coberto)
  carencia_geral_dias   INTEGER NOT NULL DEFAULT 30,
  carencia_acidente_dias INTEGER NOT NULL DEFAULT 0,  -- carência reduzida para acidente
  carencia_morte_natural_dias INTEGER NOT NULL DEFAULT 90,
  
  -- Translado
  km_translado_coberto  INTEGER,                  -- NULL = sem cobertura de translado, 0 = local, N = km
  
  -- Regras de cálculo
  regra_calculo         TEXT NOT NULL DEFAULT 'fixo' CHECK (regra_calculo IN ('fixo', 'por_vida', 'faixa_etaria')),
  
  ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
  vigencia_inicio       DATE,                     -- data de início de vigência do plano
  vigencia_fim          DATE,                     -- NULL = sem prazo de término
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_coletivo CHECK (
    (tipo_plano = 'individual' AND limite_vidas IS NULL) OR 
    (tipo_plano = 'coletivo' AND limite_vidas >= 2)
  )
);

CREATE OR REPLACE FUNCTION update_planos_pax_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER planos_pax_updated_at_trigger
BEFORE UPDATE ON planos_pax
FOR EACH ROW
EXECUTE FUNCTION update_planos_pax_updated_at();

-- Vincula itens funerários ao plano, distinguindo cobertos de excluídos
CREATE TABLE planos_pax_coberturas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id        UUID NOT NULL REFERENCES planos_pax(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES itens_funerarios(id),
  tipo_cobertura  TEXT NOT NULL CHECK (tipo_cobertura IN ('coberto', 'excluido')),
  observacao      TEXT,   -- observação específica sobre este item neste plano
  UNIQUE (plano_id, item_id)
);

CREATE TABLE planos_pax_faixas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id        UUID NOT NULL REFERENCES planos_pax(id) ON DELETE CASCADE,
  idade_de        INTEGER NOT NULL,
  idade_ate       INTEGER NOT NULL,
  valor           NUMERIC(10,2) NOT NULL,
  CONSTRAINT faixa_valida CHECK (idade_de <= idade_ate)
);

-- RLS for planos_pax
ALTER TABLE planos_pax ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Planos pax lidos por todos os usuários autenticados" ON planos_pax FOR SELECT TO authenticated USING (true);
CREATE POLICY "Planos pax modificados por admin e gerente" ON planos_pax FOR ALL TO authenticated USING (current_setting('request.jwt.claims', true)::jsonb ->> 'role' IN ('admin', 'gerente')) WITH CHECK (current_setting('request.jwt.claims', true)::jsonb ->> 'role' IN ('admin', 'gerente'));

-- RLS for planos_pax_coberturas
ALTER TABLE planos_pax_coberturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Planos pax coberturas lidos por todos os usuários autenticados" ON planos_pax_coberturas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Planos pax coberturas modificados por admin e gerente" ON planos_pax_coberturas FOR ALL TO authenticated USING (current_setting('request.jwt.claims', true)::jsonb ->> 'role' IN ('admin', 'gerente')) WITH CHECK (current_setting('request.jwt.claims', true)::jsonb ->> 'role' IN ('admin', 'gerente'));

-- RLS for planos_pax_faixas
ALTER TABLE planos_pax_faixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Planos pax faixas lidas por todos os usuários autenticados" ON planos_pax_faixas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Planos pax faixas modificadas por admin e gerente" ON planos_pax_faixas FOR ALL TO authenticated USING (current_setting('request.jwt.claims', true)::jsonb ->> 'role' IN ('admin', 'gerente')) WITH CHECK (current_setting('request.jwt.claims', true)::jsonb ->> 'role' IN ('admin', 'gerente'));

-- Indexes
CREATE INDEX idx_planos_pax_ativo ON planos_pax(ativo);
CREATE INDEX idx_planos_pax_tipo ON planos_pax(tipo_plano);
CREATE INDEX idx_planos_pax_coberturas_plano ON planos_pax_coberturas(plano_id);
CREATE INDEX idx_planos_pax_faixas_plano ON planos_pax_faixas(plano_id);
