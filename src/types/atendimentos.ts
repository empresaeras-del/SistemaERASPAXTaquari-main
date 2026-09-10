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

  /**
   * Dados de quem responde pelo falecido (migration 20260910183445). Todos opcionais no
   * tipo porque a coluna é nullable: atendimento anterior a 10/09/2026 não tem nenhum
   * deles, e a obrigatoriedade de cliente externo vive no `responsavelExternoSchema`,
   * no ponto de escrita — não no tipo nem na coluna.
   *
   * `| null` não é ruído: é o que o Postgres devolve para a coluna vazia e o que a
   * gravação envia para limpá-la (ver `responsavelParaGravacao`). Sem isso, apagar um
   * campo na tela de edição não apagaria nada no banco.
   */
  responsavel_nome?: string | null;
  responsavel_cpf?: string | null;
  responsavel_rg?: string | null;
  responsavel_parentesco?: string | null;
  responsavel_endereco?: string | null;
  responsavel_contato?: string | null;
  responsavel_nacionalidade?: string | null;
  responsavel_observacoes?: string | null;

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
