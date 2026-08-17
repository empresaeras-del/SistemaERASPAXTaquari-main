export interface Atendimento {
  id: string;
  tenant_id: string;
  tipo_cliente: 'associado' | 'externo';
  associado_id?: string;
  dependente_id?: string;
  falecido_nome: string;
  falecido_cpf?: string;
  falecido_data_nascimento?: string;
  
  local_velorio?: string;
  local_sepultamento?: string;
  data_obito?: string;
  data_velorio?: string;
  data_sepultamento?: string;
  
  status: 'aberto' | 'em_andamento' | 'concluido' | 'cancelado';
  valor_total: number;
  
  created_at?: string;
  created_by?: string;
  
  itens?: AtendimentoItem[];
}

export interface AtendimentoItem {
  id: string;
  atendimento_id: string;
  item_id: string;
  quantidade: number;
  valor_unitario: number;
  coberto: boolean;
  item_nome?: string;
}
