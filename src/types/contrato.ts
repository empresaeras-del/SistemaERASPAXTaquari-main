/**
 * Um "Contrato" hoje não tem entidade própria no fluxo de dados: a tabela `contratos`
 * é sincronizada em segundo plano a partir dos campos do próprio Associado
 * (ver src/pages/ContratosPage.tsx) — não há tela de edição de contrato separada
 * do associado. Este tipo formaliza esse espelho, para uso no catálogo de variáveis
 * de documentos e em qualquer lugar que precise ler a tabela `contratos` diretamente.
 */
export type StatusContrato = 'ativo' | 'inativo' | 'inadimplente' | 'encerrado';

export interface Contrato {
  id: string;
  tenant_id: string;
  empresa_id?: string;
  associado_id: string;
  plano_pax_id?: string | null;
  numero_contrato: string;
  data_inicio: string;
  valor_mensalidade: number;
  status: StatusContrato;
  observacoes?: string | null;
}
