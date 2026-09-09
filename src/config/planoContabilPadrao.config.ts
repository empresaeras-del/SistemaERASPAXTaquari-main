/**
 * Plano de contas modelo — ponto de partida sugerido, montado a partir das categorias
 * que o sistema já usava em `useOptions` (`categorias_receita`, `categorias_despesa`).
 *
 * Isto é deliberadamente uma constante do frontend, e **não** um conjunto de linhas com
 * `tenant_id IS NULL` compartilhado por todos os tenants: ao semear, as contas são
 * **copiadas** para linhas do próprio tenant. Cada empresa vira dona das próprias contas
 * (pode renomear, desativar, acrescentar) sem afetar ninguém, e o schema não volta a ter
 * linha sem dono — que foi o mecanismo do incidente `empresa_padrao` (ver CLAUDE.md).
 *
 * A ordem do array é a ordem de criação: um pai sempre aparece antes das filhas, porque
 * `semearPlanoPadrao` resolve `conta_pai_id` pelo código do pai já inserido.
 */
import { ContaModelo } from '../types/planoContabil';

export const CODIGO_PLANO_PADRAO = 'PADRAO';
export const NOME_PLANO_PADRAO = 'Plano de Contas Padrão';

export const PLANO_CONTABIL_PADRAO: ContaModelo[] = [
  // ── Receitas ──────────────────────────────────────────────────────────────
  { codigo: '3', nome: 'RECEITAS', natureza: 'receita', tipo: 'sintetica' },

  { codigo: '3.1', nome: 'Receitas Operacionais', natureza: 'receita', tipo: 'sintetica' },
  { codigo: '3.1.01', nome: 'Mensalidades de Planos', natureza: 'receita', tipo: 'analitica',
    descricao: 'Mensalidades dos planos PAX dos associados' },
  { codigo: '3.1.02', nome: 'Taxa de Adesão', natureza: 'receita', tipo: 'analitica' },
  { codigo: '3.1.03', nome: 'Serviços Extras', natureza: 'receita', tipo: 'analitica',
    descricao: 'Serviços cobrados fora da cobertura do plano' },
  { codigo: '3.1.04', nome: 'Serviços Funerários Avulsos', natureza: 'receita', tipo: 'analitica' },

  { codigo: '3.2', nome: 'Receitas Não Operacionais', natureza: 'receita', tipo: 'sintetica' },
  { codigo: '3.2.01', nome: 'Rendimentos Financeiros', natureza: 'receita', tipo: 'analitica' },
  { codigo: '3.2.02', nome: 'Outras Receitas', natureza: 'receita', tipo: 'analitica' },

  // ── Despesas ──────────────────────────────────────────────────────────────
  { codigo: '4', nome: 'DESPESAS', natureza: 'despesa', tipo: 'sintetica' },

  { codigo: '4.1', nome: 'Custo dos Serviços Prestados', natureza: 'despesa', tipo: 'sintetica' },
  { codigo: '4.1.01', nome: 'Repasse a Credenciados / Prestadores', natureza: 'despesa', tipo: 'analitica' },
  { codigo: '4.1.02', nome: 'Fornecedores e Materiais', natureza: 'despesa', tipo: 'analitica' },
  { codigo: '4.1.03', nome: 'Serviços de Terceiros', natureza: 'despesa', tipo: 'analitica' },

  { codigo: '4.2', nome: 'Despesas Administrativas', natureza: 'despesa', tipo: 'sintetica' },
  { codigo: '4.2.01', nome: 'Salários e Encargos', natureza: 'despesa', tipo: 'analitica' },
  { codigo: '4.2.02', nome: 'Aluguel', natureza: 'despesa', tipo: 'analitica' },
  { codigo: '4.2.03', nome: 'Água / Luz / Telefone', natureza: 'despesa', tipo: 'analitica' },
  { codigo: '4.2.04', nome: 'Material de Escritório', natureza: 'despesa', tipo: 'analitica' },
  { codigo: '4.2.05', nome: 'Manutenção e Conservação', natureza: 'despesa', tipo: 'analitica' },
  { codigo: '4.2.06', nome: 'Combustível e Transporte', natureza: 'despesa', tipo: 'analitica' },
  { codigo: '4.2.07', nome: 'Marketing e Publicidade', natureza: 'despesa', tipo: 'analitica' },

  { codigo: '4.3', nome: 'Despesas Tributárias', natureza: 'despesa', tipo: 'sintetica' },
  { codigo: '4.3.01', nome: 'Impostos e Taxas', natureza: 'despesa', tipo: 'analitica' },

  { codigo: '4.4', nome: 'Despesas Financeiras', natureza: 'despesa', tipo: 'sintetica' },
  { codigo: '4.4.01', nome: 'Tarifas Bancárias', natureza: 'despesa', tipo: 'analitica' },
  { codigo: '4.4.02', nome: 'Juros e Multas', natureza: 'despesa', tipo: 'analitica' },

  { codigo: '4.9', nome: 'Outras Despesas', natureza: 'despesa', tipo: 'sintetica' },
  { codigo: '4.9.01', nome: 'Despesas Diversas', natureza: 'despesa', tipo: 'analitica' },
];

/**
 * Códigos que os caminhos **automáticos** procuram no plano da empresa.
 *
 * Um lançamento nascido de um atendimento, de uma requisição, da geração de mensalidades ou
 * do faturamento de um credenciado não passa por formulário nenhum — ninguém escolhe a conta.
 * Desde a fase 3 esse lançamento também precisa nascer classificado, então cada um desses
 * caminhos resolve a conta por código, com a rede de segurança de `resolverContaPorCodigo`
 * (código pedido → conta de sobra da natureza → primeira analítica; ver `planoContabilTree.ts`).
 *
 * São códigos do plano modelo. A empresa que renomeou a conta continua funcionando (o código
 * é que é procurado, não o nome); a que **apagou** a conta cai na rede de segurança.
 */
export const CODIGO_CONTA_MENSALIDADE = '3.1.01';
export const CODIGO_CONTA_TAXA_ADESAO = '3.1.02';
export const CODIGO_CONTA_SERVICO_EXTRA = '3.1.03';
export const CODIGO_CONTA_SERVICO_AVULSO = '3.1.04';
export const CODIGO_CONTA_REPASSE_CREDENCIADO = '4.1.01';

/** Conta que recebe o lançamento quando a conta específica não existe mais no plano. */
export const CODIGO_CONTA_SOBRA: Record<'receita' | 'despesa', string> = {
  receita: '3.2.02',
  despesa: '4.9.01',
};
