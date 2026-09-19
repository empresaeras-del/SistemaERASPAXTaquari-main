/**
 * O texto do aviso para quando a parcela foi liquidada e a movimentação de caixa não subiu.
 *
 * As duas escritas são sequenciais e não há transação entre elas: a baixa da parcela vai
 * para `parcelas_receber`/`parcelas_pagar`, e a movimentação para `movimentacoes_caixa`.
 * Desde que o `caixasService` parou de engolir a recusa do servidor (19/09/2026), a segunda
 * pode falhar de forma visível — e aí o operador precisa saber exatamente três coisas, que
 * um "Erro ao efetivar recebimento" genérico não diz nenhuma:
 *
 * 1. **A baixa valeu.** A parcela está liquidada, e ela é a fonte do realizado no Plano de
 *    Contas — repetir a operação não conserta nada e confunde quem for conferir depois.
 * 2. **O que ficou faltando**, e a consequência prática: o valor não entra no saldo do lote,
 *    então a conferência do fechamento vai acusar diferença.
 * 3. **Como resolver**: "Sincronizar Financeiro", na tela de Caixas, varre as parcelas
 *    liquidadas sem movimentação e lança as que faltam — é idempotente por `referencia_id`,
 *    então rodar de novo não duplica nada.
 *
 * É a mesma escolha que o CLAUDE.md registra na cobrança automática do atendimento: a falha
 * do segundo passo não desfaz o primeiro, e o `toast` diz **qual** dos dois falhou.
 */
export const avisoLiquidacaoSemCaixa = (
  operacao: 'recebimento' | 'pagamento',
  motivoDoServidor?: string,
): string => {
  const feito = operacao === 'recebimento' ? 'Recebimento registrado' : 'Pagamento registrado';
  const motivo = (motivoDoServidor || '').trim();
  return (
    `${feito} na parcela, mas a movimentação de caixa NÃO foi lançada: ` +
    'o valor não entra no saldo do lote e vai faltar na conferência do fechamento. ' +
    'Use "Sincronizar Financeiro" na tela de Caixas para lançá-la — não repita a baixa.' +
    (motivo ? ` Motivo: ${motivo}` : '')
  );
};
