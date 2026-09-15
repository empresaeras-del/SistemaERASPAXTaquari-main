/**
 * Quando uma parcela já foi liquidada, ela deixa de ser editável e excluível.
 *
 * Uma parcela recebida não é mais só uma previsão: ela tem recibo impresso, entrou na
 * movimentação de caixa e é a fonte do realizado no Plano de Contas (ver "Valores
 * realizados no plano"). Editar o valor ou apagar a linha depois disso desfaz um número
 * que já foi somado em relatório e entregue ao associado, sem desfazer nada do resto.
 *
 * O caminho correto para corrigir um recebimento é **estornar** — que reverte a
 * movimentação e devolve a parcela para pendente — e só então editar ou excluir.
 */

/** Os dois valores que significam "liquidada" no schema. */
const STATUS_LIQUIDADOS = ['recebido', 'pago'] as const;

/**
 * `true` quando a parcela já foi liquidada.
 *
 * **Cobre `'recebido'` e `'pago'`.** As telas de associado já tratavam os dois juntos,
 * mas a de Contas a Receber olhava só `'recebido'` — uma parcela `'pago'` continuava
 * editável e excluível lá. São os dois nomes do mesmo estado neste schema; quem checar
 * só um deixa metade do caso de fora.
 */
export const parcelaLiquidada = (status?: string | null): boolean =>
  STATUS_LIQUIDADOS.includes((status || '').trim().toLowerCase() as typeof STATUS_LIQUIDADOS[number]);

/** Motivo da recusa, igual na tela e no ponto de escrita. */
export const MENSAGEM_PARCELA_LIQUIDADA =
  'Esta parcela já foi recebida e não pode ser editada nem excluída. ' +
  'Estorne o recebimento antes, se precisar corrigi-la.';

/** Os três nomes que "em aberto" tem neste schema. */
const STATUS_EM_ABERTO = ['pendente', 'vencido', 'atrasado'] as const;

/**
 * `true` quando a parcela ainda é cobrável.
 *
 * Existe porque "em aberto" tem **três** nomes aqui e "liquidada" tem dois — e quem
 * filtra por um só deixa parte do caso de fora (foi o que aconteceu com `'pago'` na tela
 * de Contas a Receber, e com `'vencido'` no `cancelarReceitasPorAtendimento`). Cancelada
 * não entra: ela existe no banco e não cobra ninguém.
 */
export const parcelaEmAberto = (status?: string | null): boolean =>
  STATUS_EM_ABERTO.includes((status || '').trim().toLowerCase() as typeof STATUS_EM_ABERTO[number]);
