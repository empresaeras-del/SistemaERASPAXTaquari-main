/**
 * Filtro de parcelas por classificação contábil (conta contábil e centro de custo).
 *
 * A parcela não carrega a classificação: quem carrega é o **lançamento pai** (`receitas` /
 * `despesas`). Como as telas de Contas a Receber e a Pagar já têm as duas listas em memória,
 * o filtro é uma junção — e é essa junção que mora aqui, fora das páginas, porque as duas
 * fariam exatamente a mesma coisa e porque é a única parte disso que dá para testar sem
 * navegador.
 */

export interface ClassificacaoLancamento {
  conta_contabil_id?: string | null;
  centro_custo_id?: string | null;
}

export interface FiltroClassificacao {
  contaContabilId?: string;
  centroCustoId?: string;
}

/**
 * Índice `id do lançamento → classificação`, para cada parcela resolver o pai em O(1) em vez
 * de varrer a lista inteira por linha renderizada.
 */
export function indicePorLancamento<T extends { id: string } & ClassificacaoLancamento>(
  lancamentos: T[],
): Map<string, ClassificacaoLancamento> {
  const indice = new Map<string, ClassificacaoLancamento>();
  for (const l of lancamentos) {
    if (!l?.id) continue;
    indice.set(l.id, {
      conta_contabil_id: l.conta_contabil_id ?? null,
      centro_custo_id: l.centro_custo_id ?? null,
    });
  }
  return indice;
}

/**
 * A parcela casa com os filtros de classificação?
 *
 * Sem filtro nenhum, casa com tudo — inclusive parcela órfã (pai não carregado) e lançamento
 * legado sem classificação, que é o caso da maioria das linhas antigas.
 *
 * **Com filtro, a parcela cujo pai não foi encontrado fica de fora.** É deliberado: deixá-la
 * passar faria uma parcela sem classificação nenhuma aparecer em *qualquer* filtro escolhido,
 * que é o oposto do que filtrar significa. O usuário que quer ver essas usa o filtro vazio.
 */
export function parcelaCasaClassificacao(
  paiId: string | null | undefined,
  indice: Map<string, ClassificacaoLancamento>,
  filtros: FiltroClassificacao,
): boolean {
  const { contaContabilId, centroCustoId } = filtros;
  if (!contaContabilId && !centroCustoId) return true;

  const pai = paiId ? indice.get(paiId) : undefined;
  if (!pai) return false;

  if (contaContabilId && pai.conta_contabil_id !== contaContabilId) return false;
  if (centroCustoId && pai.centro_custo_id !== centroCustoId) return false;

  return true;
}
