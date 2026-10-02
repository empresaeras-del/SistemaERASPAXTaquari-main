
/**
 * O limite de vidas e o valor da mensalidade, ajustáveis por associado sem alterar o plano.
 *
 * **O que a produção mostrava quando isto foi escrito (02/10/2026), e que decidiu o desenho:**
 * os três planos coletivos tinham `limite_vidas = 2` e **11 dos 16 associados ativos
 * excediam** esse limite, até 7 vidas. O aviso "Limite de Vidas Excedido" e a trava que
 * desabilitava "Confirmar e Lançar" não eram exceção — eram o estado da maioria da base. Uma
 * regra que dispara para quase todo mundo não descreve o negócio: o acordo real é por família.
 *
 * E o "valor exclusivo" já existia de fato, sem campo próprio: 16 dos 18 associados coletivos
 * tinham `valor_plano` diferente do valor do plano, em números que não seguem fórmula nenhuma
 * (R$ 40, 42, 61, 63, 64, 70, 76, 84, 85, 89...). Era digitação manual caso a caso, feita no
 * wizard de contrato e no campo por parcela da prévia.
 *
 * **Quem manda é a coluna de exceção, e `valor_plano` é o snapshot do resultado** — o mesmo
 * par de `categoria` ao lado de `conta_contabil_id`, e pelo mesmo motivo. Reaproveitar
 * `valor_plano` como se ele FOSSE o valor exclusivo seria errado num caso que a produção já
 * tem: em plano **individual** o preço escala com as vidas (R$ 20 × 3 = 60), então tratar o
 * número gravado como exclusivo congelaria o preço em silêncio ao incluir um dependente. A
 * presença de `valor_mensalidade_exclusivo` é o que declara "este associado tem valor
 * negociado"; a ausência dela devolve o cálculo do plano.
 */

/**
 * O recorte de associado que estas funções leem — nada além disso.
 *
 * Os dois campos aceitam `string` de propósito, porque é o que de fato chega: a coluna é
 * `numeric` e o Supabase a devolve como string, e o `<input type="number">` devolve `''`
 * quando o operador limpa o campo. Declarar só `number` aqui obrigaria um cast em cada
 * chamador — e um cast é exatamente onde o `''` passa batido até virar `22P02` no Postgres.
 * **Estreite o tipo onde o domínio vale e alargue onde o legado entra**, como o CLAUDE.md
 * registra em `TipoFornecedor`.
 */
export interface AjustesDoAssociado {
  limite_vidas_personalizado?: number | string | null;
  valor_mensalidade_exclusivo?: number | string | null;
}

/**
 * O recorte de plano que estas funções leem.
 *
 * `limite_vidas` aceita `null` porque é o que a coluna guarda — ela é nullable justamente para
 * o plano individual ("NULL se individual", no `CREATE TABLE`). `PlanoPax` declara só
 * `number | undefined`, então exigir aquele tipo aqui obrigaria cada chamador que lê o plano
 * direto do banco a converter `null` em `undefined` — e a conversão é onde o caso do plano
 * individual se perde. Mesma regra de `AjustesDoAssociado` acima: estreitar onde o domínio
 * vale, alargar onde o dado real entra.
 */
export interface PlanoParaLimite {
  tipo_plano?: string;
  limite_vidas?: number | null;
}

/** O limite que o plano declara, sem personalização. Coletivo sem limite declarado é ilimitado. */
const limiteDoPlano = (
  plano: PlanoParaLimite | null | undefined,
): number | null => {
  if (!plano || plano.tipo_plano !== 'coletivo') return null;
  return plano.limite_vidas && plano.limite_vidas > 0 ? plano.limite_vidas : null;
};

/**
 * O limite de vidas que vale para ESTE associado: o personalizado quando existe, senão o do
 * plano. `null` significa "sem limite" — plano individual, ou coletivo que não declarou um.
 *
 * O personalizado vale mesmo quando é **menor** que o do plano: ele é o acordo, não um bônus,
 * e um limite menor é tão legítimo quanto um maior.
 */
export const limiteDeVidasEfetivo = (
  plano: PlanoParaLimite | null | undefined,
  associado: AjustesDoAssociado | null | undefined,
): number | null => {
  // Em plano individual não há limite de vidas para personalizar — o preço escala com elas.
  // Aceitar o personalizado aqui inventaria um teto que o produto não tem.
  if (!plano || plano.tipo_plano !== 'coletivo') return null;

  const personalizado = associado?.limite_vidas_personalizado;
  if (typeof personalizado === 'number' && personalizado >= 1) return personalizado;

  return limiteDoPlano(plano);
};

/** `true` quando o personalizado está em uso — é o que a tela usa para dizer de onde o número veio. */
export const limiteEhPersonalizado = (
  plano: PlanoParaLimite | null | undefined,
  associado: AjustesDoAssociado | null | undefined,
): boolean => {
  if (!plano || plano.tipo_plano !== 'coletivo') return false;
  const personalizado = associado?.limite_vidas_personalizado;
  return typeof personalizado === 'number' && personalizado >= 1;
};

/**
 * As vidas excedem o limite que vale para este associado?
 *
 * **Isto virou informação, não trava** (decisão de 02/10/2026): quem excede continua vendo o
 * aviso, mas a geração de mensalidades não é mais bloqueada. A trava anterior exigia digitar
 * um valor extra e era contornável digitando qualquer número — ou seja, obstruía a operação
 * normal de 11 dos 16 ativos sem decidir nada.
 */
export const excedeLimiteDeVidas = (
  plano: PlanoParaLimite | null | undefined,
  associado: AjustesDoAssociado | null | undefined,
  vidasCadastradas: number,
): boolean => {
  const limite = limiteDeVidasEfetivo(plano, associado);
  if (limite === null) return false;
  return vidasCadastradas > limite;
};

/**
 * O valor manual da mensalidade, quando o associado tem um acordado.
 *
 * Zero é valor (mensalidade de cortesia), negativo é recusado (viraria receita negativa no
 * caixa) e ausência é `null` — as mesmas três decisões de `utils/valorParcelaManual.ts`, pelos
 * mesmos motivos. A coluna é `numeric` e o Supabase a devolve como **string**, então o número
 * é coagido aqui em vez de em cada chamador.
 */
export const valorExclusivoDoAssociado = (
  associado: AjustesDoAssociado | null | undefined,
): number | null => {
  const bruto = associado?.valor_mensalidade_exclusivo;
  if (bruto === null || bruto === undefined || bruto === '') return null;

  const valor = Number(bruto);
  if (isNaN(valor) || valor < 0) return null;

  return valor;
};

/** `true` quando a mensalidade deste associado vem do acordo, não do cálculo do plano. */
export const temValorExclusivo = (associado: AjustesDoAssociado | null | undefined): boolean =>
  valorExclusivoDoAssociado(associado) !== null;

/**
 * A mensalidade que vale para este associado: o valor exclusivo quando existe, senão o
 * `valorCalculado` que o chamador derivou do plano.
 *
 * O cálculo do plano **não** é refeito aqui de propósito: ele já existe em
 * `calcularValorMensalidadeBase` (helpers de mensalidade) e em `calcularValor` (hook dos
 * planos), e uma terceira cópia divergiria delas na primeira regra nova — é a lição que o
 * CLAUDE.md registra na projeção de parcelas, que chegou a ter três cópias.
 */
export const mensalidadeDoAssociado = (
  associado: AjustesDoAssociado | null | undefined,
  valorCalculado: number,
): number => {
  const exclusivo = valorExclusivoDoAssociado(associado);
  return exclusivo === null ? valorCalculado : exclusivo;
};

/**
 * A frase que diz de onde o número veio, para a tela não precisar remontá-la.
 *
 * Ela existe porque o operador precisa distinguir "R$ 63,00 porque o plano calcula assim" de
 * "R$ 63,00 porque foi acordado com esta família" — sem isso o campo vira um número sem
 * procedência, que é o estado que esta mudança veio encerrar.
 */
export const origemDaMensalidade = (
  associado: AjustesDoAssociado | null | undefined,
  descricaoDoCalculo: string,
): string => (temValorExclusivo(associado) ? 'Valor exclusivo deste associado' : descricaoDoCalculo);

/**
 * Os dois ajustes normalizados para o ponto de escrita.
 *
 * **Devolve `null`, nunca `undefined`**, e isso não é preciosismo: `JSON.stringify` descarta
 * chave `undefined`, então o `upsert` chegaria ao Postgres sem a coluna e o valor antigo
 * continuaria lá — o operador apagaria o campo na tela, salvaria, e o acordo velho seguiria
 * valendo sem erro nenhum. É a mesma armadilha que o CLAUDE.md registra nos dados do
 * responsável do atendimento e no vínculo da empresa conveniada.
 *
 * O `''` que o `<input type="number">` devolve quando o operador limpa o campo também virou
 * `null` aqui: numa coluna numérica ele seria `22P02`.
 */
export const ajustesParaGravacao = (
  associado: AjustesDoAssociado | null | undefined,
): { limite_vidas_personalizado: number | null; valor_mensalidade_exclusivo: number | null } => {
  const limiteBruto = associado?.limite_vidas_personalizado;
  const limite = Math.trunc(Number(limiteBruto));
  const limiteValido =
    limiteBruto !== null && limiteBruto !== undefined && (limiteBruto as unknown) !== ''
      && !isNaN(limite) && limite >= 1;

  return {
    limite_vidas_personalizado: limiteValido ? limite : null,
    valor_mensalidade_exclusivo: valorExclusivoDoAssociado(associado),
  };
};
