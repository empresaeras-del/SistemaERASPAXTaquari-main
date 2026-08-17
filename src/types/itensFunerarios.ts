export type CategoriaItemFunerario = 
  | 'translado'
  | 'preparacao'
  | 'urna'
  | 'velorio'
  | 'cortejo'
  | 'sepultamento'
  | 'documentacao'
  | 'flores'
  | 'apoio_familia'
  | 'outros';

export interface ItemFunerario {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  categoria: CategoriaItemFunerario;
  unidade: string;
  valor_referencia?: number;
  ativo: boolean;
  ordem_exibicao: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export type ItemFunerarioInsert = Omit<ItemFunerario, 'id' | 'created_at' | 'updated_at' | 'created_by'>;

export type ItemFunerarioUpdate = Partial<ItemFunerarioInsert>;

export interface ItemFunerarioFiltros {
  categoria?: CategoriaItemFunerario;
  ativo?: boolean;
  busca?: string;
}

export interface ItemFunerarioCheckbox {
  id: string;
  nome: string;
  categoria: CategoriaItemFunerario;
  ativo: boolean;
  ordem_exibicao: number;
}

export interface PlanoVinculadoItem {
  plano_id: string;
  tipo_cobertura: 'coberto' | 'excluido';
  observacao?: string;
}

