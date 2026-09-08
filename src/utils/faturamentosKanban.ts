/**
 * Agrupamento das remessas de faturamento em colunas por status, para a visão
 * kanban da aba de faturamentos do credenciado.
 *
 * A lógica fica aqui, fora do componente, porque é o que decide o que aparece em
 * cada coluna e os totais que o usuário lê — é o tipo de conta que precisa de
 * teste, ao contrário do desenho das colunas.
 */
import type { RemessaFaturamento, StatusRemessa } from '../types/faturamento';
import type { Requisicao } from '../types/requisicoes';

export interface ColunaKanban {
  status: StatusRemessa;
  rotulo: string;
  remessas: RemessaFaturamento[];
  /** Soma de `valor_liquido` das remessas da coluna. */
  totalLiquido: number;
  /** Soma de `qtd_guias` das remessas da coluna. */
  totalGuias: number;
}

/**
 * Ordem das colunas: o ciclo de vida de uma remessa, da esquerda para a direita.
 * `cancelada` fica por último por ser um desvio, não uma etapa.
 */
export const ORDEM_STATUS: { status: StatusRemessa; rotulo: string }[] = [
  { status: 'em_aberto', rotulo: 'Em Aberto' },
  { status: 'processando', rotulo: 'Processando' },
  { status: 'fechada', rotulo: 'Fechada' },
  { status: 'paga', rotulo: 'Paga' },
  { status: 'cancelada', rotulo: 'Cancelada' },
];

/**
 * Monta as colunas do kanban. Colunas vazias são mantidas de propósito: o
 * quadro precisa mostrar o ciclo inteiro para que a ausência de remessas numa
 * etapa seja informação, e não um buraco no layout.
 */
export function agruparPorStatus(remessas: readonly RemessaFaturamento[]): ColunaKanban[] {
  return ORDEM_STATUS.map(({ status, rotulo }) => {
    const doStatus = remessas.filter((r) => r.status === status);
    return {
      status,
      rotulo,
      remessas: doStatus,
      totalLiquido: doStatus.reduce((soma, r) => soma + (r.valor_liquido || 0), 0),
      totalGuias: doStatus.reduce((soma, r) => soma + (r.qtd_guias || 0), 0),
    };
  });
}

/**
 * Guias (requisições) vinculadas a uma remessa. O vínculo é o array
 * `requisicao_ids` da própria remessa — pode vir ausente em registros antigos.
 */
export function guiasDaRemessa(
  remessa: RemessaFaturamento,
  requisicoes: readonly Requisicao[],
): Requisicao[] {
  const ids = new Set(remessa.requisicao_ids || []);
  if (ids.size === 0) return [];
  return requisicoes.filter((r) => ids.has(r.id));
}

/**
 * Remessas que referenciam guias que não vieram na consulta — sinal de dado
 * inconsistente que vale mostrar em vez de esconder.
 */
export function guiasFaltando(
  remessa: RemessaFaturamento,
  requisicoes: readonly Requisicao[],
): number {
  const total = (remessa.requisicao_ids || []).length;
  return Math.max(0, total - guiasDaRemessa(remessa, requisicoes).length);
}

/** Totais gerais, para o cabeçalho da aba. */
export function totaisGerais(remessas: readonly RemessaFaturamento[]): {
  qtdRemessas: number;
  totalGuias: number;
  totalLiquido: number;
} {
  return {
    qtdRemessas: remessas.length,
    totalGuias: remessas.reduce((s, r) => s + (r.qtd_guias || 0), 0),
    totalLiquido: remessas.reduce((s, r) => s + (r.valor_liquido || 0), 0),
  };
}
