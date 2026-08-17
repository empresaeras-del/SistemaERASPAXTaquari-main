CREATE TABLE atendimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    tipo_cliente TEXT NOT NULL CHECK (tipo_cliente IN ('associado', 'externo')),
    associado_id UUID, -- REFERENCES associados(id) -- but associados doesn't exist yet as a table?
    dependente_id UUID,
    falecido_nome TEXT NOT NULL,
    falecido_cpf TEXT,
    falecido_data_nascimento DATE,
    local_velorio TEXT,
    local_sepultamento TEXT,
    data_obito TIMESTAMP WITH TIME ZONE,
    data_velorio TIMESTAMP WITH TIME ZONE,
    data_sepultamento TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'aberto',
    valor_total NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID
);

CREATE TABLE atendimento_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atendimento_id UUID NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES itens_funerarios(id),
    quantidade NUMERIC(10,2) DEFAULT 1,
    valor_unitario NUMERIC(10,2) DEFAULT 0,
    coberto BOOLEAN DEFAULT false
);
