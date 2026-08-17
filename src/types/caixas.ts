import { FormaPagamento } from './financeiro';

export type StatusLoteCaixa = 'aberto' | 'fechado' | 'auditado';

export type TipoMovimentacaoCaixa = 'entrada' | 'saida';

export type OrigemMovimentacaoCaixa = 
  | 'contas_receber' 
  | 'contas_pagar' 
  | 'suprimento' 
  | 'sangria' 
  | 'avulso';

export interface LoteCaixa {
  id: string;
  tenant_id: string;
  codigo_lote: string; // ex: LOTE-20260806-001
  terminal_caixa: string; // ex: "Caixa Principal", "Guichê 01"
  operador_id?: string;
  operador_nome: string;
  data_abertura: string; // ISO String
  data_fechamento?: string; // ISO String
  saldo_inicial: number;
  saldo_entradas: number;
  saldo_saidas: number;
  saldo_esperado: number; // saldo_inicial + saldo_entradas - saldo_saidas
  saldo_fechamento_informado?: number; // valor apurado na conferencia cega/fisica
  diferenca_quebra_sobra?: number; // saldo_fechamento_informado - saldo_esperado
  observacao_abertura?: string;
  observacao_fechamento?: string;
  status: StatusLoteCaixa;
  criado_em?: string;
  atualizado_em?: string;
}

export interface MovimentacaoCaixa {
  id: string;
  tenant_id: string;
  lote_id: string; // ID do Lote/Sessao de Caixa
  tipo: TipoMovimentacaoCaixa;
  origem: OrigemMovimentacaoCaixa;
  categoria: string;
  descricao: string;
  valor: number;
  forma_pagamento: FormaPagamento;
  data_movimentacao: string; // ISO string
  referencia_id?: string; // ID da parcela_receber ou parcela_pagar
  documento_ref?: string; // Ex: "Recebimento Parc. 1/12" ou "NF 104"
  operador_nome: string;
  observacao?: string;
  estornado?: boolean;
  criado_em?: string;
}

export interface ResumoFluxoCaixa {
  total_entradas: number;
  total_saidas: number;
  saldo_periodo: number;
  total_dinheiro: number;
  total_pix: number;
  total_cartoes: number;
  total_outros: number;
  total_suprimentos: number;
  total_sangrias: number;
  lotes_abertos_count: number;
  lotes_fechados_count: number;
}

export interface FiltroFluxoCaixa {
  periodo: 'hoje' | '7dias' | '30dias' | 'mes_atual' | 'todos' | 'personalizado';
  dataInicio?: string;
  dataFim?: string;
  loteId?: string;
  origem?: string;
  formaPagamento?: string;
  tipo?: 'todos' | 'entrada' | 'saida';
  busca?: string;
}
