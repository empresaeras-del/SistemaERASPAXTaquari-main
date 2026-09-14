/**
 * O que impede excluir um associado, e como dizer isso ao operador.
 *
 * `softDeleteAssociado` não é soft coisa nenhuma: ele apaga em cascata receitas,
 * **parcelas já recebidas**, atendimentos, requisições, contratos e dependentes — do
 * IndexedDB e do Postgres. Um clique desfaz dinheiro que entrou no caixa e o registro do
 * velório que a família já usou, sem deixar rastro além da linha de auditoria.
 *
 * Por isso a regra não é "confirme com cuidado", é **recusar**: associado com histórico
 * não se exclui, se inativa. Este módulo decide o que conta como histórico e monta a
 * listagem que a tela mostra; quem lê o banco é o service, quem desenha é o componente.
 */

/** Um registro que impede a exclusão, já no formato que a tela exibe. */
export interface RegistroImpeditivo {
  /** Identificação curta da linha, ex. "Parcela 3/12 — Plano A". */
  titulo: string;
  /** Contexto secundário, ex. "Recebida em 10/08/2026 · R$ 80,00". */
  detalhe?: string;
}

export interface GrupoImpeditivo {
  /** Rótulo do bloco, ex. "Parcelas recebidas". */
  titulo: string;
  /** Total real do grupo — pode ser maior que `registros.length` (ver `LIMITE_POR_GRUPO`). */
  total: number;
  registros: RegistroImpeditivo[];
}

export interface HistoricoImpeditivo {
  /** `true` quando existe qualquer registro que impeça a exclusão. */
  impede: boolean;
  grupos: GrupoImpeditivo[];
  /** Frase única para o toast, quando não há espaço para a listagem inteira. */
  resumo: string;
}

/**
 * Quantos registros de cada grupo aparecem na tela.
 *
 * A listagem existe para o operador **reconhecer** o que está travando, não para auditar:
 * doze parcelas de um plano anual encheriam o modal e empurrariam o botão de inativar
 * para fora da vista. O total continua visível no cabeçalho do grupo.
 */
export const LIMITE_POR_GRUPO = 5;

const plural = (n: number, singular: string, pluralForma: string) =>
  `${n} ${n === 1 ? singular : pluralForma}`;

/**
 * Monta o histórico impeditivo a partir dos registros já lidos do banco.
 *
 * Recebe listas prontas em vez de ir buscá-las: assim a regra é testável sem rede, e o
 * service decide como consultar (ver o padrão offline-first no CLAUDE.md).
 */
export function montarHistoricoImpeditivo(params: {
  parcelasRecebidas: { titulo: string; detalhe?: string }[];
  atendimentos: { titulo: string; detalhe?: string }[];
}): HistoricoImpeditivo {
  const grupos: GrupoImpeditivo[] = [];

  const recebidas = params.parcelasRecebidas || [];
  const atendimentos = params.atendimentos || [];

  if (recebidas.length > 0) {
    grupos.push({
      titulo: 'Parcelas recebidas',
      total: recebidas.length,
      registros: recebidas.slice(0, LIMITE_POR_GRUPO),
    });
  }

  if (atendimentos.length > 0) {
    grupos.push({
      titulo: 'Atendimentos funerários',
      total: atendimentos.length,
      registros: atendimentos.slice(0, LIMITE_POR_GRUPO),
    });
  }

  const partes: string[] = [];
  if (recebidas.length > 0) partes.push(plural(recebidas.length, 'parcela recebida', 'parcelas recebidas'));
  if (atendimentos.length > 0) partes.push(plural(atendimentos.length, 'atendimento', 'atendimentos'));

  return {
    impede: grupos.length > 0,
    grupos,
    resumo: partes.length > 0
      ? `Este associado tem ${partes.join(' e ')} no histórico.`
      : 'Nenhum registro impeditivo encontrado.',
  };
}

/**
 * Motivo da recusa, usado na tela e no ponto de escrita.
 *
 * Aponta a saída — inativar — porque uma recusa que só diz "não pode" deixa o operador
 * sem ação nenhuma diante de um cadastro que ele precisa tirar da frente.
 */
export const MENSAGEM_EXCLUSAO_BLOQUEADA =
  'Este associado tem histórico de parcelas recebidas ou atendimentos e não pode ser excluído. ' +
  'Inative o cadastro para tirá-lo dos registros novos, preservando o histórico.';
