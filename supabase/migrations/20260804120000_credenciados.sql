CREATE TABLE credenciados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj_cpf TEXT NOT NULL UNIQUE,
    inscricao_estadual TEXT,
    inscricao_municipal TEXT,
    cep TEXT,
    endereco TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    telefone TEXT,
    email TEXT,
    ramo_atividade TEXT NOT NULL,
    registro_profissional TEXT,
    banco TEXT,
    agencia TEXT,
    conta_corrente TEXT,
    tipo_chave_pix TEXT,
    chave_pix TEXT,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'bloqueado', 'descredenciado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE credenciados_planos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credenciado_id UUID NOT NULL REFERENCES credenciados(id) ON DELETE CASCADE,
    plano_pax_id UUID NOT NULL REFERENCES planos_pax(id) ON DELETE CASCADE,
    percentual_desconto NUMERIC(5,2),
    valor_coparticipacao NUMERIC(10,2),
    carencia_dias INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(credenciado_id, plano_pax_id)
);

-- Trigger para updated_at
-- CREATE TRIGGER handle_updated_at BEFORE UPDATE ON credenciados
--   FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);
