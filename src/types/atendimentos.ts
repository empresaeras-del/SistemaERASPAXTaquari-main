export interface Atendimento {
  id: string;
  tenant_id: string;
  tipo_cliente: 'associado' | 'externo';
  associado_id?: string;
  dependente_id?: string;
  falecido_nome: string;
  falecido_cpf?: string;
  falecido_data_nascimento?: string;
  sexo_falecido?: string;
  sexo?: string;
  cor_falecido?: string;
  etnia?: string;

  local_velorio?: string;
  local_sepultamento?: string;
  local_obito?: string;
  data_obito?: string;
  hora_obito?: string;
  data_velorio?: string;
  data_sepultamento?: string;

  declaracao_obito?: string;
  numero_do?: string;
  medico_responsavel?: string;
  medico_resp?: string;
  crm_medico?: string;
  rqe_medico?: string;
  inicio_tanato?: string;
  termino_tanato?: string;

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
