-- =============================================================================
-- MIGRATION: Verificação Completa, Criação e Correção Global de Tabelas e RLS
-- Sistema ERAS PAX Taquari
-- =============================================================================

-- 1. TABELA: tenants (Empresas)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  email TEXT,
  telefone TEXT,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam tenants" ON tenants;
CREATE POLICY "Usuários autenticados gerenciam tenants" ON tenants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. TABELA: users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  nivel TEXT DEFAULT 'funcionario',
  tenant_id TEXT,
  empresa_id TEXT,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam users" ON users;
CREATE POLICY "Usuários autenticados gerenciam users" ON users FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. TABELA: planos_pax
CREATE TABLE IF NOT EXISTS planos_pax (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo_plano TEXT DEFAULT 'individual',
  limite_vidas INTEGER,
  idade_minima INTEGER DEFAULT 0,
  idade_maxima INTEGER,
  valor_mensalidade NUMERIC(10,2) DEFAULT 0,
  taxa_adesao NUMERIC(10,2) DEFAULT 0,
  carencia_geral_dias INTEGER DEFAULT 30,
  carencia_acidente_dias INTEGER DEFAULT 0,
  carencia_morte_natural_dias INTEGER DEFAULT 90,
  km_translado_coberto NUMERIC(10,2),
  regra_calculo TEXT DEFAULT 'fixo',
  minimo_vidas_calculo INTEGER DEFAULT 1,
  minimo_vidas INTEGER DEFAULT 1,
  ativo BOOLEAN DEFAULT true,
  vigencia_inicio DATE,
  vigencia_fim DATE,
  empresa_id TEXT,
  tenant_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE planos_pax ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE planos_pax ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE planos_pax ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE planos_pax ADD COLUMN IF NOT EXISTS minimo_vidas INTEGER DEFAULT 1;
ALTER TABLE planos_pax ADD COLUMN IF NOT EXISTS minimo_vidas_calculo INTEGER DEFAULT 1;

ALTER TABLE planos_pax ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Planos pax lidos por todos os usuários autenticados" ON planos_pax;
DROP POLICY IF EXISTS "Planos pax modificados por admin e gerente" ON planos_pax;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam planos_pax" ON planos_pax;
CREATE POLICY "Usuários autenticados gerenciam planos_pax" ON planos_pax FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. TABELA: itens_funerarios
CREATE TABLE IF NOT EXISTS itens_funerarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT DEFAULT 'outros',
  unidade TEXT DEFAULT 'unidade',
  valor_referencia NUMERIC(10,2),
  ativo BOOLEAN DEFAULT true,
  ordem_exibicao INTEGER DEFAULT 0,
  empresa_id TEXT,
  tenant_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE itens_funerarios ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE itens_funerarios ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE itens_funerarios ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE itens_funerarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Itens funerarios lidos por todos os usuários autenticados" ON itens_funerarios;
DROP POLICY IF EXISTS "Itens funerarios modificados por admin e gerente" ON itens_funerarios;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam itens_funerarios" ON itens_funerarios;
CREATE POLICY "Usuários autenticados gerenciam itens_funerarios" ON itens_funerarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. TABELA: planos_pax_coberturas
CREATE TABLE IF NOT EXISTS planos_pax_coberturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID REFERENCES planos_pax(id) ON DELETE CASCADE,
  item_id UUID REFERENCES itens_funerarios(id) ON DELETE CASCADE,
  tipo_cobertura TEXT DEFAULT 'coberto',
  observacao TEXT,
  empresa_id TEXT,
  tenant_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE planos_pax_coberturas ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE planos_pax_coberturas ADD COLUMN IF NOT EXISTS empresa_id TEXT;

ALTER TABLE planos_pax_coberturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Planos pax coberturas lidos por todos os usuários autenticados" ON planos_pax_coberturas;
DROP POLICY IF EXISTS "Planos pax coberturas modificados por admin e gerente" ON planos_pax_coberturas;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam planos_pax_coberturas" ON planos_pax_coberturas;
CREATE POLICY "Usuários autenticados gerenciam planos_pax_coberturas" ON planos_pax_coberturas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. TABELA: planos_pax_faixas
CREATE TABLE IF NOT EXISTS planos_pax_faixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID REFERENCES planos_pax(id) ON DELETE CASCADE,
  idade_min INTEGER DEFAULT 0,
  idade_max INTEGER DEFAULT 99,
  idade_de INTEGER DEFAULT 0,
  idade_ate INTEGER DEFAULT 99,
  valor NUMERIC(10,2) DEFAULT 0,
  empresa_id TEXT,
  tenant_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE planos_pax_faixas ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE planos_pax_faixas ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE planos_pax_faixas ADD COLUMN IF NOT EXISTS idade_de INTEGER DEFAULT 0;
ALTER TABLE planos_pax_faixas ADD COLUMN IF NOT EXISTS idade_ate INTEGER DEFAULT 99;

ALTER TABLE planos_pax_faixas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Planos pax faixas lidas por todos os usuários autenticados" ON planos_pax_faixas;
DROP POLICY IF EXISTS "Planos pax faixas modificadas por admin e gerente" ON planos_pax_faixas;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam planos_pax_faixas" ON planos_pax_faixas;
CREATE POLICY "Usuários autenticados gerenciam planos_pax_faixas" ON planos_pax_faixas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. TABELA: fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  codigo TEXT,
  tipo_pessoa TEXT DEFAULT 'PJ',
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj_cpf TEXT,
  email TEXT,
  telefone TEXT,
  celular_whatsapp TEXT,
  website TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  tipo_fornecedor TEXT DEFAULT 'produtos',
  categoria TEXT,
  contato_nome TEXT,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  dados_bancarios JSONB,
  banco TEXT,
  agencia TEXT,
  conta_corrente TEXT,
  tipo_chave_pix TEXT,
  chave_pix TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'ativo',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS tipo_fornecedor TEXT DEFAULT 'produtos';
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS contato_nome TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS celular_whatsapp TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS uf TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS dados_bancarios JSONB;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam fornecedores" ON fornecedores;
CREATE POLICY "Usuários autenticados gerenciam fornecedores" ON fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. TABELA: procedimentos
CREATE TABLE IF NOT EXISTS procedimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_tuss TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT,
  especialidade TEXT,
  valor_padrao NUMERIC(10,2) DEFAULT 0,
  valor_coparticipacao NUMERIC(10,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  observacoes TEXT,
  empresa_id TEXT,
  tenant_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE procedimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam procedimentos" ON procedimentos;
CREATE POLICY "Usuários autenticados gerenciam procedimentos" ON procedimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. TABELA: credenciados
CREATE TABLE IF NOT EXISTS credenciados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj_cpf TEXT,
  ramo_atividade TEXT,
  email TEXT,
  telefone TEXT,
  celular_whatsapp TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  bairro TEXT,
  status TEXT DEFAULT 'ativo',
  empresa_id TEXT,
  tenant_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE credenciados ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE credenciados ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE credenciados ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE credenciados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam credenciados" ON credenciados;
CREATE POLICY "Usuários autenticados gerenciam credenciados" ON credenciados FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. TABELA: credenciados_planos e credenciados_procedimentos
CREATE TABLE IF NOT EXISTS credenciados_planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credenciado_id UUID REFERENCES credenciados(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES planos_pax(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE credenciados_planos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam credenciados_planos" ON credenciados_planos;
CREATE POLICY "Usuários autenticados gerenciam credenciados_planos" ON credenciados_planos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS credenciados_procedimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credenciado_id UUID REFERENCES credenciados(id) ON DELETE CASCADE,
  procedimento_id UUID REFERENCES procedimentos(id) ON DELETE CASCADE,
  valor_acordado NUMERIC(10,2),
  valor_repasse NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE credenciados_procedimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam credenciados_procedimentos" ON credenciados_procedimentos;
CREATE POLICY "Usuários autenticados gerenciam credenciados_procedimentos" ON credenciados_procedimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. TABELA: associados e dependentes
CREATE TABLE IF NOT EXISTS associados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  nome TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  data_nascimento DATE,
  sexo TEXT,
  estado_civil TEXT,
  profissao TEXT,
  telefone TEXT,
  celular_whatsapp TEXT,
  email TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  status TEXT DEFAULT 'ativo',
  tipo_associado TEXT DEFAULT 'titular',
  observacoes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE associados ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE associados ADD COLUMN IF NOT EXISTS tipo_associado TEXT DEFAULT 'titular';
ALTER TABLE associados ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE associados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam associados" ON associados;
CREATE POLICY "Usuários autenticados gerenciam associados" ON associados FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS dependentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID REFERENCES associados(id) ON DELETE CASCADE,
  tenant_id TEXT,
  empresa_id TEXT,
  nome TEXT NOT NULL,
  cpf TEXT,
  data_nascimento DATE,
  parentesco TEXT,
  status TEXT DEFAULT 'ativo',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE dependentes ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE dependentes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE dependentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam dependentes" ON dependentes;
CREATE POLICY "Usuários autenticados gerenciam dependentes" ON dependentes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 12. TABELA: contratos e contratos_dependentes
CREATE TABLE IF NOT EXISTS contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  associado_id UUID REFERENCES associados(id),
  plano_pax_id UUID REFERENCES planos_pax(id),
  numero_contrato TEXT,
  data_adesao DATE DEFAULT CURRENT_DATE,
  data_vigencia DATE,
  valor_mensalidade NUMERIC(10,2) DEFAULT 0,
  taxa_adesao NUMERIC(10,2) DEFAULT 0,
  dia_vencimento INTEGER DEFAULT 10,
  status TEXT DEFAULT 'ativo',
  forma_pagamento TEXT DEFAULT 'pix',
  observacoes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam contratos" ON contratos;
CREATE POLICY "Usuários autenticados gerenciam contratos" ON contratos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 13. TABELA: receitas e parcelas_receber
CREATE TABLE IF NOT EXISTS receitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  tipo_devedor TEXT DEFAULT 'associado',
  associado_id UUID REFERENCES associados(id),
  associado_nome TEXT,
  associado_cpf TEXT,
  associado_plano TEXT,
  associado_valor_contrato NUMERIC(10,2),
  cliente_tipo TEXT,
  cliente_nome TEXT,
  cliente_cpf_cnpj TEXT,
  cliente_telefone TEXT,
  cliente_email TEXT,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  data_emissao DATE DEFAULT CURRENT_DATE,
  data_inicio_cobranca DATE DEFAULT CURRENT_DATE,
  valor_total NUMERIC(10,2) NOT NULL,
  qtd_parcelas INTEGER DEFAULT 1,
  forma_pagamento_padrao TEXT DEFAULT 'pix',
  conta_bancaria_id UUID,
  observacoes TEXT,
  status TEXT DEFAULT 'ativo',
  atendimento_id UUID,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  criado_por TEXT,
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE IF EXISTS receitas DROP CONSTRAINT IF EXISTS receitas_criado_por_fkey;
ALTER TABLE IF EXISTS receitas ALTER COLUMN criado_por TYPE TEXT USING criado_por::text;
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam receitas" ON receitas;
CREATE POLICY "Usuários autenticados gerenciam receitas" ON receitas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS parcelas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  receita_id UUID REFERENCES receitas(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  valor_pago NUMERIC(10,2),
  status TEXT DEFAULT 'pendente',
  forma_pagamento TEXT,
  forma_pagamento_efetivo TEXT,
  conta_bancaria_id UUID,
  link_pagamento TEXT,
  linha_digitavel TEXT,
  comprovante_url TEXT,
  observacoes TEXT,
  observacao_recebimento TEXT,
  tipo_devedor TEXT,
  devedor_nome TEXT,
  devedor_cpf_cnpj TEXT,
  descricao TEXT,
  valor_recebido NUMERIC(10,2),
  recebido_em TIMESTAMPTZ,
  recebido_por TEXT,
  total_parcelas INTEGER,
  deleted_at TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE parcelas_receber ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE parcelas_receber ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE parcelas_receber ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam parcelas a receber" ON parcelas_receber;
CREATE POLICY "Usuários autenticados gerenciam parcelas a receber" ON parcelas_receber FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 14. TABELA: despesas e parcelas_pagar
CREATE TABLE IF NOT EXISTS despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  tipo_credor TEXT DEFAULT 'fornecedor',
  fornecedor_id UUID REFERENCES fornecedores(id),
  fornecedor_nome TEXT,
  fornecedor_cnpj_cpf TEXT,
  funcionario_id UUID,
  funcionario_nome TEXT,
  funcionario_cpf TEXT,
  credor_nome TEXT,
  credor_cpf_cnpj TEXT,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  centro_custo TEXT,
  data_emissao DATE DEFAULT CURRENT_DATE,
  data_inicio_pagamento DATE DEFAULT CURRENT_DATE,
  valor_total NUMERIC(10,2) NOT NULL,
  qtd_parcelas INTEGER DEFAULT 1,
  forma_pagamento_padrao TEXT DEFAULT 'pix',
  conta_bancaria_id UUID,
  codigo_barras TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'ativo',
  atendimento_id UUID,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  criado_por TEXT,
  deleted_at TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE IF EXISTS despesas DROP CONSTRAINT IF EXISTS despesas_criado_por_fkey;
ALTER TABLE IF EXISTS despesas ALTER COLUMN criado_por TYPE TEXT USING criado_por::text;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam despesas" ON despesas;
CREATE POLICY "Usuários autenticados gerenciam despesas" ON despesas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS parcelas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  despesa_id UUID REFERENCES despesas(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  valor_pago NUMERIC(10,2),
  status TEXT DEFAULT 'pendente',
  forma_pagamento TEXT,
  forma_pagamento_efetivo TEXT,
  conta_bancaria_id UUID,
  comprovante_url TEXT,
  observacoes TEXT,
  observacao_pagamento TEXT,
  credor_nome TEXT,
  credor_cpf_cnpj TEXT,
  descricao TEXT,
  pago_em TIMESTAMPTZ,
  pago_por TEXT,
  total_parcelas INTEGER,
  deleted_at TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE parcelas_pagar ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE parcelas_pagar ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE parcelas_pagar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam parcelas a pagar" ON parcelas_pagar;
CREATE POLICY "Usuários autenticados gerenciam parcelas a pagar" ON parcelas_pagar FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 15. TABELA: requisicoes e requisicao_itens
CREATE TABLE IF NOT EXISTS requisicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  codigo_requisicao TEXT NOT NULL,
  associado_id UUID REFERENCES associados(id),
  associado_nome TEXT,
  associado_cpf TEXT,
  associado_plano TEXT,
  associado_status TEXT,
  paciente_id UUID,
  paciente_nome TEXT,
  paciente_tipo TEXT DEFAULT 'titular',
  paciente_cpf TEXT,
  credenciado_id UUID REFERENCES credenciados(id),
  credenciado_nome TEXT,
  credenciado_cnpj_cpf TEXT,
  medico_solicitante TEXT,
  crm_solicitante TEXT,
  data_emissao TIMESTAMPTZ DEFAULT NOW(),
  data_validade TIMESTAMPTZ,
  status TEXT DEFAULT 'emitida',
  valor_total NUMERIC(10,2) DEFAULT 0,
  valor_coparticipacao_total NUMERIC(10,2) DEFAULT 0,
  observacoes TEXT,
  motivo_cancelamento TEXT,
  cancelado_por TEXT,
  autorizado_por TEXT,
  faturado BOOLEAN DEFAULT false,
  remessa_id UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS valor_coparticipacao_total NUMERIC(10,2) DEFAULT 0;
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS cancelado_por TEXT;
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS autorizado_por TEXT;
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS credenciado_cnpj_cpf TEXT;
ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE requisicoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam requisicoes" ON requisicoes;
CREATE POLICY "Usuários autenticados gerenciam requisicoes" ON requisicoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS requisicao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicao_id UUID REFERENCES requisicoes(id) ON DELETE CASCADE,
  procedimento_id UUID REFERENCES procedimentos(id),
  codigo_tuss TEXT,
  descricao TEXT NOT NULL,
  quantidade INTEGER DEFAULT 1,
  valor_unitario NUMERIC(10,2) DEFAULT 0,
  valor_coparticipacao NUMERIC(10,2) DEFAULT 0,
  valor_total NUMERIC(10,2) DEFAULT 0,
  observacoes TEXT,
  tenant_id TEXT,
  empresa_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE requisicao_itens ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE requisicao_itens ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE requisicao_itens ADD COLUMN IF NOT EXISTS valor_coparticipacao NUMERIC(10,2) DEFAULT 0;
ALTER TABLE requisicao_itens ADD COLUMN IF NOT EXISTS observacoes TEXT;

ALTER TABLE requisicao_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam requisicao_itens" ON requisicao_itens;
CREATE POLICY "Usuários autenticados gerenciam requisicao_itens" ON requisicao_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 16. TABELA: remessas_faturamento
CREATE TABLE IF NOT EXISTS remessas_faturamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  codigo_remessa TEXT NOT NULL,
  tipo_prestador TEXT DEFAULT 'credenciado',
  credenciado_id UUID REFERENCES credenciados(id),
  credenciado_nome TEXT,
  periodo_inicio DATE,
  periodo_fim DATE,
  qtd_requisicoes INTEGER DEFAULT 0,
  valor_total NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'aberta',
  requisicao_ids UUID[] DEFAULT '{}',
  despesa_id UUID REFERENCES despesas(id),
  parcela_pagar_id UUID,
  observacoes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE remessas_faturamento ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE remessas_faturamento ADD COLUMN IF NOT EXISTS requisicao_ids UUID[] DEFAULT '{}';
ALTER TABLE remessas_faturamento ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE remessas_faturamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam remessas de faturamento" ON remessas_faturamento;
CREATE POLICY "Usuários autenticados gerenciam remessas de faturamento" ON remessas_faturamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 17. TABELA: documentos_padroes
CREATE TABLE IF NOT EXISTS documentos_padroes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL,
  conteudo_html TEXT,
  cabecalho_html TEXT,
  rodape_html TEXT,
  margens JSONB,
  orientacao TEXT DEFAULT 'retrato',
  tamanho_papel TEXT DEFAULT 'a4',
  ativo BOOLEAN DEFAULT true,
  padrao BOOLEAN DEFAULT false,
  variaveis_disponiveis JSONB,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE documentos_padroes ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE documentos_padroes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE documentos_padroes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam documentos padrões" ON documentos_padroes;
CREATE POLICY "Usuários autenticados gerenciam documentos padrões" ON documentos_padroes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 18. TABELA: contas_bancarias
CREATE TABLE IF NOT EXISTS contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  nome TEXT NOT NULL,
  banco TEXT NOT NULL,
  agencia TEXT,
  conta TEXT,
  tipo TEXT DEFAULT 'corrente',
  status TEXT DEFAULT 'ativo',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam contas_bancarias" ON contas_bancarias;
CREATE POLICY "Usuários autenticados gerenciam contas_bancarias" ON contas_bancarias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 19. TABELA: atendimentos e atendimento_itens
CREATE TABLE IF NOT EXISTS atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  numero_atendimento TEXT NOT NULL,
  tipo TEXT DEFAULT 'obito',
  status TEXT DEFAULT 'em_andamento',
  falecido_nome TEXT,
  falecido_cpf TEXT,
  falecido_data_nascimento DATE,
  falecido_data_falecimento DATE,
  associado_id UUID REFERENCES associados(id),
  contrato_id UUID REFERENCES contratos(id),
  solicitante_nome TEXT,
  solicitante_cpf TEXT,
  solicitante_telefone TEXT,
  solicitante_parentesco TEXT,
  local_velorio TEXT,
  local_sepultamento TEXT,
  data_sepultamento TIMESTAMPTZ,
  observacoes TEXT,
  valor_total NUMERIC(10,2) DEFAULT 0,
  valor_coberto NUMERIC(10,2) DEFAULT 0,
  valor_adicional NUMERIC(10,2) DEFAULT 0,
  receita_id UUID REFERENCES receitas(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS empresa_id TEXT;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam atendimentos" ON atendimentos;
CREATE POLICY "Usuários autenticados gerenciam atendimentos" ON atendimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS atendimento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id UUID REFERENCES atendimentos(id) ON DELETE CASCADE,
  item_id UUID REFERENCES itens_funerarios(id),
  codigo TEXT,
  nome TEXT NOT NULL,
  categoria TEXT,
  quantidade INTEGER DEFAULT 1,
  valor_unitario NUMERIC(10,2) DEFAULT 0,
  valor_total NUMERIC(10,2) DEFAULT 0,
  coberto_pelo_plano BOOLEAN DEFAULT false,
  valor_cobrado NUMERIC(10,2) DEFAULT 0,
  tenant_id TEXT,
  empresa_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE atendimento_itens ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE atendimento_itens ADD COLUMN IF NOT EXISTS empresa_id TEXT;

ALTER TABLE atendimento_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam atendimento_itens" ON atendimento_itens;
CREATE POLICY "Usuários autenticados gerenciam atendimento_itens" ON atendimento_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 20. TABELAS DE AUDITORIA E NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT,
  usuario_id UUID,
  usuario_nome TEXT,
  acao TEXT NOT NULL,
  detalhes JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam auditoria" ON auditoria;
CREATE POLICY "Usuários autenticados gerenciam auditoria" ON auditoria FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT,
  usuario_id UUID,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT DEFAULT 'info',
  lida BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados gerenciam notificacoes" ON notificacoes;
CREATE POLICY "Usuários autenticados gerenciam notificacoes" ON notificacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
