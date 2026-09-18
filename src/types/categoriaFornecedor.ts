/**
 * Categorias de fornecedor por tenant — ver
 * `supabase/migrations/20260918010924_categorias_fornecedor_tabela.sql`.
 *
 * Substitui a lista que vivia no **localStorage de cada navegador** (chave
 * `categorias_fornecedores`): era por dispositivo, não por empresa. Dois operadores da mesma
 * empresa tinham listas diferentes, e uma categoria criada pelo "Gerenciar" numa máquina não
 * existia em nenhuma outra — foi assim que `Convenios Associados`, a chave do vínculo com o
 * associado PJ, ficou invisível para quem não a tinha criado.
 */

export interface CategoriaFornecedorRegistro {
  id: string;
  tenant_id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
  criado_por?: string | null;
  deleted_at?: string | null;
}
