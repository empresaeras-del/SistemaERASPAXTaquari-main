/**
 * O valor manual da parcela, quando o operador digitou um.
 *
 * O campo "Valor Parcela (R$)" existe nos dois caminhos que geram mensalidade — o wizard de
 * contrato (`NovoContratoWizard`, usado no cadastro novo e na tela de Contratos) e o wizard da
 * aba Mensalidades (`MensalidadesGeracaoWizard`, usado na edição do associado) —, e até
 * 23/09/2026 os dois escreviam o mesmo predicado à mão, com um `isAdminOrSuperAdmin` na frente:
 * o campo só era renderizado para admin e super_admin.
 *
 * **A trava saiu, e ela não era uma trava.** O que ela cobria era só o atalho de digitar um
 * valor que vale para todas as parcelas de uma vez: a **prévia** logo abaixo, no wizard da aba
 * Mensalidades, sempre deixou qualquer nível editar o valor de **cada** parcela, uma a uma, e
 * é essa lista que é gravada. Quem não era admin conseguia exatamente o mesmo resultado com N
 * vezes mais cliques — o que o campo escondido produzia não era controle, era trabalho. Abrir
 * a geração de mensalidades em si nunca dependeu do nível (ver `handleAbrirGeracao`).
 *
 * O predicado mora aqui, num lugar só, porque ele estava escrito **três** vezes entre os dois
 * arquivos (a projeção de cada um mais o `manual_override` da auditoria do contrato) e este
 * repositório já registra, em várias seções, que predicado repetido em dois lugares só é
 * corrigido uma vez.
 */

/**
 * Devolve o valor manual a usar como base da parcela, ou `null` quando não há um — e aí quem
 * manda é o valor calculado do plano.
 *
 * Recusa o negativo em vez de gravá-lo: a projeção cairia para o automático de qualquer forma
 * no código anterior, e uma parcela de valor negativo viraria receita negativa no caixa.
 * Zero é aceito de propósito — é como se lança a mensalidade de cortesia.
 *
 * O espaço em branco é normalizado para "não digitado". Um `<input type="number">` nunca
 * devolve isso (entrada inválida chega como `''`), mas a função é usada fora dele em teste e em
 * auditoria, e `Number('  ')` é `0` — sem o `trim`, um branco viraria uma parcela de R$ 0,00.
 */
export const valorManualDaParcela = (texto: string | null | undefined): number | null => {
  const bruto = (texto ?? '').trim();
  if (bruto === '') return null;

  const valor = Number(bruto);
  if (isNaN(valor) || valor < 0) return null;

  return valor;
};

/**
 * A base da parcela: o valor manual quando existe, o calculado do plano quando não.
 *
 * Os dois wizards faziam essa escolha inline, com o encadeamento inteiro do predicado repetido
 * dentro do `useMemo`/`useCallback`. Aqui ela é uma pergunta só.
 */
export const baseDaParcela = (texto: string | null | undefined, valorCalculado: number): number => {
  const manual = valorManualDaParcela(texto);
  return manual === null ? valorCalculado : manual;
};
