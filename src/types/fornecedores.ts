export type TipoPessoa = 'PJ' | 'PF';

export type TipoFornecedor = 'produtos' | 'servicos' | 'ambos' | string;

export type StatusFornecedor = 'ativo' | 'inativo' | 'bloqueado';

export type CategoriaFornecedor = string;

export interface DadosBancarios {
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: 'corrente' | 'poupanca';
  chave_pix?: string;
}

export interface Fornecedor {
  id: string;
  codigo: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj_cpf: string;
  tipo_pessoa: TipoPessoa;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  tipo_fornecedor: TipoFornecedor;
  categoria: CategoriaFornecedor | string;
  /**
   * Categoria do fornecedor em `categorias_fornecedor` (migration `20260918010924`). Nulo em
   * empresa que ainda não tem a lista montada — aí a tela cai na lista modelo do frontend.
   *
   * **Quem manda é este id**; `categoria` (texto) acompanha o nome da categoria e é atualizado
   * quando ela é renomeada. Não é snapshot, ao contrário de `despesas.centro_custo`.
   */
  categoria_id?: string | null;
  status: StatusFornecedor;
  
  // Contato
  contato_nome?: string;
  telefone?: string;
  celular_whatsapp?: string;
  email?: string;
  website?: string;
  
  // Endereço
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  
  // Financeiro
  dados_bancarios?: DadosBancarios;
  
  // Informações extras
  observacoes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  empresa_id?: string;
  tenant_id?: string;
}

export type FornecedorInsert = Omit<Fornecedor, 'id' | 'created_at' | 'updated_at'>;
export type FornecedorUpdate = Partial<FornecedorInsert>;

export interface FornecedorFiltros {
  busca?: string;
  categoria?: string;
  tipo_fornecedor?: string;
  status?: string;
}
