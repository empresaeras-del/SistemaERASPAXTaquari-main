export type CredenciadoStatus = 'ativo' | 'bloqueado' | 'descredenciado';

export interface Credenciado {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj_cpf: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  cep?: string;
  logradouro?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  estado?: string;
  telefone?: string;
  celular_whatsapp?: string;
  email?: string;
  responsavel_nome?: string;
  responsavel_telefone?: string;
  ramo_atividade: string;
  registro_profissional?: string;
  banco?: string;
  agencia?: string;
  conta_corrente?: string;
  tipo_chave_pix?: string;
  chave_pix?: string;
  status: CredenciadoStatus;
  // Campos de multi-tenancy
  tenant_id?: string;
  empresa_id?: string;
  deleted_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CredenciadoInsert extends Omit<Credenciado, 'id' | 'created_at' | 'updated_at'> {}
export interface CredenciadoUpdate extends Partial<CredenciadoInsert> {}

export interface CredenciadoPlano {
  id: string;
  credenciado_id: string;
  plano_pax_id: string;
  percentual_desconto?: number;
  valor_coparticipacao?: number;
  carencia_dias?: number;
  created_at?: string;
}

export interface CredenciadoPlanoInsert extends Omit<CredenciadoPlano, 'id' | 'created_at'> {}
export interface CredenciadoPlanoUpdate extends Partial<CredenciadoPlanoInsert> {}

export interface CredenciadoProcedimento {
  id: string;
  credenciado_id: string;
  procedimento_id: string;
  valor_exclusivo?: number;
  valor_coparticipacao?: number;
  created_at?: string;
}

export interface CredenciadoProcedimentoInsert extends Omit<CredenciadoProcedimento, 'id' | 'created_at'> {}
export interface CredenciadoProcedimentoUpdate extends Partial<CredenciadoProcedimentoInsert> {}
