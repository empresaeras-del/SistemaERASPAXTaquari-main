CREATE TABLE procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_tuss TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor_padrao NUMERIC(10,2) NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    empresa_id TEXT NOT NULL,
    tipo_procedimento TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE credenciados_procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credenciado_id UUID NOT NULL REFERENCES credenciados(id) ON DELETE CASCADE,
    procedimento_id UUID NOT NULL REFERENCES procedimentos(id) ON DELETE RESTRICT,
    valor NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(credenciado_id, procedimento_id)
);

CREATE TABLE requisicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    codigo_requisicao TEXT NOT NULL UNIQUE,
    data_emissao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    data_validade TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'autorizada', 'negada', 'cancelada', 'realizada')),
    
    associado_id UUID NOT NULL,
    associado_nome TEXT NOT NULL,
    associado_cpf TEXT,
    associado_plano TEXT,
    
    paciente_id UUID NOT NULL,
    paciente_nome TEXT NOT NULL,
    paciente_tipo TEXT NOT NULL,
    paciente_parentesco TEXT,
    paciente_cpf TEXT,
    
    credenciado_id UUID NOT NULL REFERENCES credenciados(id) ON DELETE RESTRICT,
    credenciado_nome TEXT NOT NULL,
    tipo_prestador TEXT,
    
    medico_solicitante TEXT,
    crm_solicitante TEXT,
    
    valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    observacoes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE requisicao_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisicao_id UUID NOT NULL REFERENCES requisicoes(id) ON DELETE CASCADE,
    procedimento_id UUID NOT NULL REFERENCES procedimentos(id) ON DELETE RESTRICT,
    codigo_tuss TEXT,
    descricao TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    valor_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
    valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
