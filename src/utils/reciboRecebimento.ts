import { formatLocalDate, formatLocalDateTime } from './dateUtils';
import type { ReciboDados } from '../components/financeiro/VisualizadorReciboModal';

/**
 * O recibo de uma parcela recebida, montado num lugar só.
 *
 * As duas telas que liquidam parcela — a aba de Mensalidades do associado e Contas a
 * Receber — montavam este objeto à mão, com títulos e fallbacks ligeiramente diferentes.
 * Era a mesma regra escrita duas vezes, e a lição deste projeto sobre isso já está no
 * CLAUDE.md: predicado repetido em dois lugares só é corrigido uma vez.
 *
 * **O recibo nasce da parcela MAIS o que acabou de ser recebido**, nunca só da parcela.
 * Logo depois de efetivar a baixa, a linha que a tela tem em memória ainda é a de antes —
 * `pendente`, sem `valor_recebido`, sem data de liquidação. Montar o recibo a partir dela
 * imprimiria um comprovante em branco no campo que mais importa: o valor recebido. Por
 * isso `recebimento` é obrigatório aqui e sobrepõe o que veio da linha.
 */

/** A parcela como as duas telas a conhecem — só o que o recibo lê. */
export interface ParcelaParaRecibo {
  id?: string;
  numero_parcela?: number;
  total_parcelas?: number;
  descricao?: string;
  data_vencimento?: string;
  devedor_nome?: string;
  devedor_cpf_cnpj?: string;
  forma_pagamento?: string;
  forma_pagamento_efetivo?: string;
  valor?: number;
  valor_recebido?: number;
  recebido_por?: string;
  recebido_em?: string;
  data_recebimento?: string;
  data_pagamento?: string;
  observacao_recebimento?: string;
}

/** O que o operador acabou de informar na baixa. */
export interface DadosDoRecebimento {
  /** ISO completo do instante da liquidação. */
  dataLiquidacaoISO?: string;
  valorRecebido?: number;
  formaPagamento?: string;
  operadorNome?: string;
  observacao?: string;
}

/** O que a tela sabe e a parcela não carrega. */
export interface ContextoDoRecibo {
  nomeFallback?: string;
  documentoFallback?: string;
  categoriaFallback?: string;
  planoFallback?: string;
  operadorFallback?: string;
  titulo?: string;
}

export const TITULO_RECIBO_PADRAO = 'Recibo de Pagamento';

/**
 * Número do recibo: os 8 primeiros caracteres do id da parcela, em maiúsculas.
 *
 * É o que as duas telas já faziam, e é estável — reimprimir o mesmo recebimento devolve o
 * mesmo número, que é o que permite conferir contra o comprovante que o associado guardou.
 */
export const numeroDoRecibo = (parcelaId?: string): string =>
  (parcelaId || '').substring(0, 8).toUpperCase() || '—';

export const montarReciboDeRecebimento = (
  parcela: ParcelaParaRecibo,
  recebimento: DadosDoRecebimento = {},
  contexto: ContextoDoRecibo = {},
): ReciboDados => {
  // O valor recebido vem do que foi informado na baixa; só depois cai para o que a linha
  // guarda (reimpressão de um recebimento antigo) e, por último, para o valor de face.
  const valor =
    numeroOuNulo(recebimento.valorRecebido) ??
    numeroOuNulo(parcela.valor_recebido) ??
    numeroOuNulo(parcela.valor) ??
    0;

  const liquidacao =
    recebimento.dataLiquidacaoISO ||
    parcela.data_recebimento ||
    parcela.recebido_em ||
    parcela.data_pagamento;

  const forma = (
    recebimento.formaPagamento ||
    parcela.forma_pagamento_efetivo ||
    parcela.forma_pagamento ||
    'PIX'
  ).toUpperCase();

  return {
    numRecibo: numeroDoRecibo(parcela.id),
    tipo: 'recebimento',
    titulo: contexto.titulo || TITULO_RECIBO_PADRAO,
    pagadorNome: (parcela.devedor_nome || contexto.nomeFallback || 'Cliente / Associado').trim(),
    pagadorDoc: (parcela.devedor_cpf_cnpj || contexto.documentoFallback || 'Não informado').trim(),
    descricao: parcela.descricao || 'Mensalidade',
    parcelaInfo: `Parcela ${parcela.numero_parcela ?? 1} de ${parcela.total_parcelas || 1}`,
    categoria: contexto.categoriaFallback || 'Mensalidades',
    vencimentoOriginal: parcela.data_vencimento ? formatLocalDate(parcela.data_vencimento) : '-',
    // Sem data nenhuma, o recibo sai com um traço em vez de com a data de hoje: afirmar
    // um instante de liquidação que ninguém registrou é pior que deixar o campo vazio.
    dataLiquidacao: liquidacao ? formatLocalDateTime(liquidacao) : '-',
    formaPagamento: forma,
    valor,
    operadorNome:
      recebimento.operadorNome || parcela.recebido_por || contexto.operadorFallback || 'Sistema',
    observacoes: recebimento.observacao || parcela.observacao_recebimento || undefined,
    planoInfo: contexto.planoFallback,
  };
};

/**
 * `0` é um valor legítimo, `null`/`undefined`/`NaN` não são.
 *
 * Um `||` encadeado aqui trataria um recebimento de R$ 0,00 como ausente e cairia para o
 * valor de face — imprimindo no comprovante um valor que não foi recebido.
 */
const numeroOuNulo = (valor: unknown): number | null => {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};
