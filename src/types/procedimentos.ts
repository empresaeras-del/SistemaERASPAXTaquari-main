export interface Procedimento {
  id: string;
  codigo_tuss: string;
  descricao: string;
  valor_padrao: number;
  coparticipacao?: number;
  valor_total_associado?: number;
  ativo: boolean;
  empresa_id?: string;
  tenant_id?: string;
  deleted_at?: string;
  tipo_procedimento?: string;
  created_at?: string;
  updated_at?: string;
}

export type ProcedimentoInsert = Omit<Procedimento, 'id' | 'created_at' | 'updated_at'> & { id?: string };
export type ProcedimentoUpdate = Partial<ProcedimentoInsert>;
