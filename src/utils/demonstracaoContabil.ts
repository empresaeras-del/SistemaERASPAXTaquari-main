/**
 * Valores realizados e previstos por conta contábil, para a árvore do Plano de Contas e para
 * o relatório de demonstração contábil.
 *
 * ## A armadilha que este arquivo existe para evitar: contar duas vezes
 *
 * Um recebimento produz **dois** registros no sistema: a parcela muda de status (ganha
 * `data_pagamento` e `valor_recebido`) **e** nasce uma linha em `movimentacoes_caixa` com a
 * conta herdada do lançamento (ver `registrarMovimentacao`). Somar as duas fontes contaria o
 * mesmo dinheiro duas vezes em toda conta com liquidação registrada em caixa.
 *
 * A fonte escolhida é a **parcela**, por três motivos: ela existe para todo lançamento
 * (a movimentação de caixa só aparece quando o caixa está aberto e a liquidação passa por
 * ele), ela é quem carrega o valor efetivamente recebido/pago (que pode diferir do previsto),
 * e é a mesma base que as telas de Contas a Receber e a Pagar já mostram — o relatório bate
 * com o que o operador vê. Movimentações de `suprimento`/`sangria` ficam de fora por
 * definição: transferir numerário entre caixa e banco não é receita nem despesa.
 *
 * ## Onde mora a classificação
 *
 * Na parcela, em lugar nenhum: quem tem `conta_contabil_id` é o **lançamento pai**
 * (`receitas` / `despesas`). A junção é a mesma de `filtrosClassificacao.ts`, e o índice dela
 * é reaproveitado aqui em vez de refeito.
 *
 * ## Realizado, previsto, e a data de cada um
 *
 * - **Realizado** é a parcela liquidada, pelo **valor efetivamente pago/recebido** e datada
 *   pela **data da liquidação**.
 * - **Previsto** é a parcela lançada, pelo valor de face e datada pelo **vencimento**.
 *
 * As duas datas são diferentes de propósito: uma parcela que vence em dezembro de 2026 e é
 * paga em janeiro de 2027 é previsto de 2026 e realizado de 2027 — que é exatamente o que um
 * demonstrativo por exercício precisa dizer.
 */
import { ContaContabil, ContaContabilNode, NaturezaContabil } from '../types/planoContabil';
import { ClassificacaoLancamento } from './filtrosClassificacao';

/** Uma parcela já normalizada, sem a diferença de nome de campo entre receber e pagar. */
export interface MovimentoDeConta {
  /** `receita_id` ou `despesa_id` — o lançamento que carrega a classificação. */
  paiId?: string | null;
  /** Valor de face da parcela. */
  valor: number;
  dataVencimento?: string | null;
  liquidada: boolean;
  /** Valor efetivamente recebido/pago. Cai para `valor` quando a liquidação não registrou. */
  valorLiquidado?: number | null;
  dataLiquidacao?: string | null;
}

export interface ValoresDaConta {
  previsto: number;
  realizado: number;
}

const ZERO: ValoresDaConta = { previsto: 0, realizado: 0 };

/**
 * Ano de uma data, lido do **texto**, nunca via `new Date()`.
 *
 * `new Date('2026-01-01')` é meia-noite **UTC**; em UTC-3 isso é 31/12/2025, e o
 * lançamento de 1º de janeiro cairia no exercício anterior. Como as colunas são `date`
 * (`YYYY-MM-DD`) ou ISO com o mesmo prefixo, o ano está nos quatro primeiros dígitos.
 */
export function anoDaData(data: string | null | undefined): number | null {
  const m = /^(\d{4})-\d{2}-\d{2}/.exec(String(data ?? '').trim());
  return m ? Number(m[1]) : null;
}

/** Parcelas a receber → movimentos. Cancelada fica de fora: não é previsto nem realizado. */
export function movimentosDeReceber(
  parcelas: Array<{
    receita_id?: string | null;
    valor?: number | null;
    data_vencimento?: string | null;
    data_pagamento?: string | null;
    data_recebimento?: string | null;
    recebido_em?: string | null;
    valor_pago?: number | null;
    valor_recebido?: number | null;
    status?: string | null;
    deleted_at?: string | null;
  }>,
): MovimentoDeConta[] {
  return parcelas
    .filter((p) => p && !p.deleted_at && p.status !== 'cancelado')
    .map((p) => {
      const liquidada = p.status === 'recebido' || p.status === 'pago' || !!p.data_pagamento;
      return {
        paiId: p.receita_id ?? null,
        valor: Number(p.valor) || 0,
        dataVencimento: p.data_vencimento ?? null,
        liquidada,
        valorLiquidado: numeroOuNulo(p.valor_recebido) ?? numeroOuNulo(p.valor_pago) ?? (Number(p.valor) || 0),
        dataLiquidacao: p.data_pagamento || p.data_recebimento || p.recebido_em || null,
      };
    });
}

/** Parcelas a pagar → movimentos. Mesma regra da de receber. */
export function movimentosDePagar(
  parcelas: Array<{
    despesa_id?: string | null;
    valor?: number | null;
    data_vencimento?: string | null;
    data_pagamento?: string | null;
    pago_em?: string | null;
    valor_pago?: number | null;
    status?: string | null;
    deleted_at?: string | null;
  }>,
): MovimentoDeConta[] {
  return parcelas
    .filter((p) => p && !p.deleted_at && p.status !== 'cancelado')
    .map((p) => {
      const liquidada = p.status === 'pago' || !!p.data_pagamento;
      return {
        paiId: p.despesa_id ?? null,
        valor: Number(p.valor) || 0,
        dataVencimento: p.data_vencimento ?? null,
        liquidada,
        valorLiquidado: numeroOuNulo(p.valor_pago) ?? (Number(p.valor) || 0),
        dataLiquidacao: p.data_pagamento || p.pago_em || null,
      };
    });
}

const numeroOuNulo = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

export interface AgregadoDemonstracao {
  /** Conta analítica → valores do exercício. Só contas do plano exibido aparecem aqui. */
  porConta: Map<string, ValoresDaConta>;
  /**
   * Valor que **pertence a uma conta deste plano** mas caiu em outro ano.
   *
   * Existe para não sumir em silêncio: acontece de verdade quando a empresa ainda não montou
   * o exercício novo e `getPlanoAtivo` cai para o plano do ano anterior — os lançamentos de
   * janeiro nascem classificados em contas do ano passado. A tela mostra o total como nota
   * de rodapé em vez de fingir que não existe.
   */
  foraDoExercicio: ValoresDaConta;
  /** Sem conta (lançamento legado), pai não carregado, ou conta de outro plano. */
  naoClassificado: ValoresDaConta;
}

/**
 * Soma os movimentos por conta, dentro de um exercício.
 *
 * `previsto` e `realizado` são somados **independentemente**: a mesma parcela pode entrar só
 * no previsto (vence no ano, ainda não paga), só no realizado (venceu antes, paga no ano) ou
 * nos dois.
 */
export function agregarDemonstracao(params: {
  movimentos: MovimentoDeConta[];
  indice: Map<string, ClassificacaoLancamento>;
  contasDoPlano: Iterable<string>;
  exercicio: number;
}): AgregadoDemonstracao {
  const { movimentos, indice, exercicio } = params;
  const doPlano = new Set(params.contasDoPlano);

  const porConta = new Map<string, ValoresDaConta>();
  const foraDoExercicio: ValoresDaConta = { previsto: 0, realizado: 0 };
  const naoClassificado: ValoresDaConta = { previsto: 0, realizado: 0 };

  const somar = (alvo: ValoresDaConta, previsto: number, realizado: number) => {
    alvo.previsto += previsto;
    alvo.realizado += realizado;
  };

  for (const mov of movimentos) {
    if (!mov) continue;

    const pai = mov.paiId ? indice.get(mov.paiId) : undefined;
    const contaId = pai?.conta_contabil_id ?? null;

    const valorPrevisto = Number(mov.valor) || 0;
    const valorRealizado = mov.liquidada ? Number(mov.valorLiquidado ?? mov.valor) || 0 : 0;

    if (!contaId || !doPlano.has(contaId)) {
      somar(naoClassificado, valorPrevisto, valorRealizado);
      continue;
    }

    const noExercicioPrevisto = anoDaData(mov.dataVencimento) === exercicio;
    const noExercicioRealizado = mov.liquidada && anoDaData(mov.dataLiquidacao) === exercicio;

    const previstoDentro = noExercicioPrevisto ? valorPrevisto : 0;
    const realizadoDentro = noExercicioRealizado ? valorRealizado : 0;

    if (previstoDentro || realizadoDentro) {
      const atual = porConta.get(contaId) || { previsto: 0, realizado: 0 };
      somar(atual, previstoDentro, realizadoDentro);
      porConta.set(contaId, atual);
    }

    // O que sobrou é deste plano mas de outro ano — é o que a nota de rodapé mostra.
    somar(
      foraDoExercicio,
      valorPrevisto - previstoDentro,
      valorRealizado - realizadoDentro,
    );
  }

  return { porConta, foraDoExercicio, naoClassificado };
}

/** Nó da árvore com o valor próprio e o total consolidado das filhas. */
export interface ContaComValores extends ContaContabilNode {
  filhas: ContaComValores[];
  /** Lançado diretamente nesta conta. Numa sintética é zero (o trigger não deixa lançar nela). */
  proprio: ValoresDaConta;
  /** Próprio + todas as descendentes. É o que a tela mostra na linha. */
  total: ValoresDaConta;
}

/**
 * Repete a árvore acrescentando os valores, com o total de cada sintética vindo da soma das
 * filhas — o equivalente em memória do `WITH RECURSIVE` que o relatório por grupo faria no
 * banco. A conta sem movimento nenhum aparece zerada, não some: o plano é a estrutura, e uma
 * linha faltando faria o leitor procurar a conta que ele sabe que existe.
 */
export function arvoreComValores(
  arvore: ContaContabilNode[],
  porConta: Map<string, ValoresDaConta>,
): ContaComValores[] {
  const visitar = (node: ContaContabilNode): ContaComValores => {
    const filhas = node.filhas.map(visitar);
    const proprio = porConta.get(node.id) || ZERO;
    const total = filhas.reduce(
      (acc, f) => ({ previsto: acc.previsto + f.total.previsto, realizado: acc.realizado + f.total.realizado }),
      { previsto: proprio.previsto, realizado: proprio.realizado },
    );
    return { ...node, filhas, proprio, total };
  };
  return arvore.map(visitar);
}

/** Soma dos nós de raiz de uma natureza — o total do grupo receita ou despesa. */
export function totalDaNatureza(nodes: ContaComValores[], natureza: NaturezaContabil): ValoresDaConta {
  return nodes
    .filter((n) => n.natureza === natureza)
    .reduce(
      (acc, n) => ({ previsto: acc.previsto + n.total.previsto, realizado: acc.realizado + n.total.realizado }),
      { previsto: 0, realizado: 0 },
    );
}

export interface ResumoDemonstracao {
  receita: ValoresDaConta;
  despesa: ValoresDaConta;
  /** Receita menos despesa. Negativo é déficit — o sinal é informação, não erro. */
  resultado: ValoresDaConta;
}

export function resumoDaDemonstracao(nodes: ContaComValores[]): ResumoDemonstracao {
  const receita = totalDaNatureza(nodes, 'receita');
  const despesa = totalDaNatureza(nodes, 'despesa');
  return {
    receita,
    despesa,
    resultado: {
      previsto: receita.previsto - despesa.previsto,
      realizado: receita.realizado - despesa.realizado,
    },
  };
}

/** Linha achatada da demonstração, na ordem em que o relatório imprime. */
export interface LinhaDemonstracao {
  id: string;
  codigo: string;
  nome: string;
  natureza: NaturezaContabil;
  tipo: 'sintetica' | 'analitica';
  nivel: number;
  ativo: boolean;
  previsto: number;
  realizado: number;
  /** Quanto do previsto já foi realizado, em %. `null` quando não há previsto no exercício. */
  execucao: number | null;
}

/**
 * Achata a árvore em linhas para o relatório.
 *
 * `apenasComMovimento` existe porque o demonstrativo tem dois leitores: quem quer o plano
 * inteiro (inclusive as contas zeradas, para conferir que nada foi esquecido) e quem quer só
 * o que aconteceu. Uma sintética entra sempre que qualquer descendente sua entra — sem o
 * grupo, a conta filha apareceria solta.
 */
export function linhasDaDemonstracao(
  nodes: ContaComValores[],
  opcoes?: { apenasComMovimento?: boolean },
): LinhaDemonstracao[] {
  const apenasComMovimento = opcoes?.apenasComMovimento ?? false;
  const saida: LinhaDemonstracao[] = [];

  const visitar = (node: ContaComValores, nivel: number) => {
    const temMovimento = node.total.previsto !== 0 || node.total.realizado !== 0;
    if (apenasComMovimento && !temMovimento) return;

    saida.push({
      id: node.id,
      codigo: node.codigo,
      nome: node.nome,
      natureza: node.natureza,
      tipo: node.tipo,
      nivel,
      ativo: node.ativo,
      previsto: node.total.previsto,
      realizado: node.total.realizado,
      execucao: node.total.previsto !== 0 ? (node.total.realizado / node.total.previsto) * 100 : null,
    });

    for (const filha of node.filhas) visitar(filha, nivel + 1);
  };

  for (const node of nodes) visitar(node, 1);
  return saida;
}

/** Ids das contas de uma lista — o `contasDoPlano` de `agregarDemonstracao`. */
export function idsDasContas(contas: ContaContabil[]): string[] {
  return contas.filter((c) => c?.id).map((c) => c.id);
}
