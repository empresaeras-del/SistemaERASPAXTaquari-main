import { ItemFunerario } from './itensFunerarios';

export type TipoPlano = 'individual' | 'coletivo';
export type RegraCalculo = 'fixo' | 'por_vida' | 'faixa_etaria';

export interface PlanoPax {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  tipo_plano: TipoPlano;
  limite_vidas?: number;
  idade_minima: number;
  idade_maxima?: number;
  valor_mensalidade: number;
  taxa_adesao: number;
  carencia_geral_dias: number;
  carencia_acidente_dias: number;
  carencia_morte_natural_dias: number;
  km_translado_coberto?: number;
  regra_calculo: RegraCalculo;
  minimo_vidas_calculo?: number;
  ativo: boolean;
  vigencia_inicio?: string;
  vigencia_fim?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export type PlanoPaxInsert = Omit<PlanoPax, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
export type PlanoPaxUpdate = Partial<PlanoPaxInsert>;

export interface PlanoPaxCobertura {
  id: string;
  plano_id: string;
  item_id: string;
  tipo_cobertura: 'coberto' | 'excluido';
  observacao?: string;
  item?: ItemFunerario; // Used when joining
}

export interface PlanoPaxFaixa {
  id: string;
  plano_id: string;
  idade_de: number;
  idade_ate: number;
  valor: number;
}

export interface PlanoPaxCompleto extends PlanoPax {
  coberturas: PlanoPaxCobertura[];
  faixas: PlanoPaxFaixa[];
}

export interface PlanoPaxFormData extends Omit<PlanoPaxInsert, 'valor_mensalidade'> {
  valor_mensalidade: number;
  faixas: Omit<PlanoPaxFaixa, 'id' | 'plano_id'>[];
  itensCobertos: string[];
  itensExcluidos: string[];
  observacoesItens: Record<string, string>;
}

export interface PlanoPaxResumo {
  id: string;
  codigo: string;
  nome: string;
  tipo_plano: TipoPlano;
  valor_mensalidade: number;
  taxa_adesao: number;
  limite_vidas?: number;
}

export interface SimulacaoValor {
  base: number;
  por_vida: number;
  total: number;
  descricao: string;
}
