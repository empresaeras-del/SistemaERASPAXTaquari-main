/**
 * Centros de custo por tenant — ver `supabase/migrations/20260909122921_centros_custo_tabela.sql`.
 *
 * Substitui a lista que vivia só no IndexedDB do navegador (`useOptions('centros_custo')`),
 * que era **por dispositivo** e não por empresa: dois operadores da mesma empresa podiam ter
 * listas diferentes, e o que a despesa guardava era só o texto que o select daquele navegador
 * oferecia. Agora é linha da empresa, com id, e a FK composta leva o `tenant_id` junto.
 */

export interface CentroCusto {
  id: string;
  tenant_id: string;
  empresa_id?: string | null;
  codigo: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
  criado_por?: string | null;
  deleted_at?: string | null;
}
