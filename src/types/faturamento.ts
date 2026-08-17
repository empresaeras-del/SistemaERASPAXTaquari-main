export type StatusRemessa = 'em_aberto' | 'processando' | 'fechada' | 'paga' | 'cancelada';

export type TipoPrestadorFaturamento = 'credenciado' | 'rede_externa';

export interface RemessaFaturamento {
  id: string;
  tenant_id: string;
  codigo_remessa: string; // Ex: REM-202608-001
  tipo_prestador: TipoPrestadorFaturamento;
  credenciado_id?: string;
  credenciado_nome: string;
  credenciado_cnpj_cpf?: string;
  
  data_criacao: string; // ISO string
  data_fechamento?: string; // ISO string
  data_vencimento_pagamento?: string; // ISO string
  
  periodo_inicio?: string;
  periodo_fim?: string;
  
  requisicao_ids: string[]; // IDs das requisições inclusas
  qtd_guias: number;
  valor_bruto: number;
  valor_desconto_glosa: number;
  valor_liquido: number;
  
  status: StatusRemessa;
  observacoes?: string;
  
  // Vínculo com Contas a Pagar
  despesa_id?: string;
  parcela_pagar_id?: string;
  
  created_at?: string;
  updated_at?: string;
  fechado_por?: string;
}

export interface FiltroRemessas {
  busca?: string;
  status?: string;
  tipoPrestador?: string;
  credenciadoId?: string;
  dataInicio?: string;
  dataFim?: string;
}
