/**
 * Plano contábil por tenant — ver `supabase/migrations/20260909021132_plano_contabil_tabelas_base.sql`.
 *
 * A distinção entre "grupo" e "conta" não é feita por duas tabelas: é o campo `tipo`.
 * Só `analitica` recebe lançamento; `sintetica` existe para agrupar e totalizar.
 */

export type NaturezaContabil = 'receita' | 'despesa';
export type TipoConta = 'sintetica' | 'analitica';

export interface PlanoContabil {
  id: string;
  tenant_id: string;
  empresa_id?: string | null;
  codigo: string;
  nome: string;
  descricao?: string | null;
  /**
   * Ano contábil do plano. Uma empresa tem no máximo um plano ativo por exercício — o plano
   * do ano anterior continua existindo, com os lançamentos daquele ano apontando para as
   * contas dele. Ver a migration `20260909122831`.
   */
  exercicio: number;
  vigencia_inicio: string;
  vigencia_fim?: string | null;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
  criado_por?: string | null;
  deleted_at?: string | null;
}

export interface ContaContabil {
  id: string;
  tenant_id: string;
  empresa_id?: string | null;
  plano_id: string;
  conta_pai_id?: string | null;
  codigo: string;
  nome: string;
  descricao?: string | null;
  natureza: NaturezaContabil;
  tipo: TipoConta;
  nivel: number;
  ordem_exibicao?: number | null;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
  criado_por?: string | null;
  deleted_at?: string | null;
}

/** Conta com as filhas resolvidas, para renderizar a árvore. */
export interface ContaContabilNode extends ContaContabil {
  filhas: ContaContabilNode[];
}

/** Uma conta do plano modelo, antes de virar linha do tenant. */
export interface ContaModelo {
  codigo: string;
  nome: string;
  natureza: NaturezaContabil;
  tipo: TipoConta;
  descricao?: string;
}
