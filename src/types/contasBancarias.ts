export interface ContaBancaria {
  id: string;
  tenant_id: string;
  nome: string;
  banco: string;
  agencia: string;
  conta: string;
  chave_pix?: string;
  status: 'ativo' | 'inativo';
  saldo_inicial?: number;
  criado_em?: string;
}
