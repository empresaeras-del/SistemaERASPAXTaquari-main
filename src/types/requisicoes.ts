export type StatusRequisicao = 'emitida' | 'autorizada' | 'realizada' | 'cancelada';

export type TipoPrestador = 'credenciado' | 'rede_externa';

export interface RequisicaoItem {
  id: string;
  procedimento_id: string;
  codigo_tuss: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_coparticipacao?: number;
  valor_total: number;
  observacoes?: string;
}

export interface Requisicao {
  id: string;
  tenant_id: string;
  codigo_requisicao: string; // Ex: REQ-20260806-001
  data_emissao: string; // ISO string
  data_validade?: string; // ISO string
  
  // Associado & Paciente
  associado_id: string;
  associado_nome: string;
  associado_cpf?: string;
  associado_plano?: string;
  
  // Paciente
  paciente_tipo: 'titular' | 'dependente';
  paciente_id?: string;
  paciente_nome: string;
  paciente_cpf?: string;
  paciente_parentesco?: string;
  
  // Prestador de Serviço
  tipo_prestador: TipoPrestador;
  credenciado_id?: string;
  credenciado_nome: string;
  credenciado_cnpj_cpf?: string;
  medico_solicitante?: string;
  crm_solicitante?: string;
  
  // Itens (Procedimentos/Exames)
  itens: RequisicaoItem[];
  
  valor_total: number;
  valor_coparticipacao_total?: number;
  
  status: StatusRequisicao;
  observacoes?: string;
  cancelado_por?: string;
  motivo_cancelamento?: string;
  autorizado_por?: string;
  
  created_at?: string;
  updated_at?: string;
}

export interface FiltroRequisicoes {
  busca?: string;
  status?: string;
  associadoId?: string;
  credenciadoId?: string;
  tipoPrestador?: string;
  dataInicio?: string;
  dataFim?: string;
}
