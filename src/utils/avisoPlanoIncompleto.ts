/**
 * A frase para quando o plano foi gravado e uma tabela filha dele não.
 *
 * `planos_pax`, `planos_pax_faixas` e `planos_pax_coberturas` são três escritas sequenciais
 * sem transação entre elas. Até 20/09/2026 as duas últimas falhavam **caladas** (um
 * `console.warn`), e o efeito era pior do que perder o cadastro:
 *
 * - **A faixa etária É o preço.** Sem linha em `planos_pax_faixas`, `calcularValor` ignora a
 *   idade do dependente — o plano passa a cobrar outro valor, e nada na tela diz por quê.
 * - **A cobertura é o que o plano cobre.** Sem ela, o atendimento oferece todo item como
 *   fora da cobertura e gera co-participação onde não deveria haver.
 * - O cache local guardava plano, faixas e coberturas juntos, então **o navegador de quem
 *   criou mostrava o plano certo** e o de todos os outros, errado.
 *
 * A frase precisa dizer as três coisas que um "Erro ao salvar" genérico não diz: que o plano
 * **existe** (repetir criaria um duplicado), o que ficou faltando, e por onde completar. É a
 * mesma escolha de `avisoLiquidacaoSemCaixa`.
 */
export const avisoPlanoIncompleto = (
  parte: 'faixas' | 'coberturas',
  motivoDoServidor?: string,
): string => {
  const oQueFaltou =
    parte === 'faixas'
      ? 'as FAIXAS ETÁRIAS não foram gravadas — sem elas o plano cobra o valor fixo, ignorando a idade'
      : 'as COBERTURAS não foram gravadas — sem elas todo item fica fora da cobertura no atendimento';
  const motivo = (motivoDoServidor || '').trim();
  return (
    `O plano foi criado, mas ${oQueFaltou}. ` +
    'Abra o plano e salve novamente para completá-lo — NÃO crie o plano de novo, ou ficarão dois.' +
    (motivo ? ` Motivo: ${motivo}` : '')
  );
};
