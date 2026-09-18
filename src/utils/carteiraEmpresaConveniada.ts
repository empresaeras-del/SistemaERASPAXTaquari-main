import { Associado } from '../services/associadosService';
import { ParcelaReceber, Receita } from '../services/financeiroService';
import { ehPessoaJuridica } from './empresaVinculada';
import { indiceDeAssociados, resolverAssociadoDaParcela } from './mapaCalorReceber';
import { parcelaEmAberto, parcelaLiquidada } from './statusParcela';

/**
 * A carteira de uma empresa conveniada: os associados Pessoa Jurídica vinculados a ela e, para
 * cada um, quanto de mensalidade foi recebido e quanto está em aberto, mês a mês.
 *
 * Puro e testado — decide **o quê** (quem entra, em que mês cai, o que não entra na soma); a aba
 * do formulário de fornecedor decide só **como**. É a mesma divisão da Ficha de Cadastro, da
 * Demonstração Contábil e do mapa de calor.
 */

export const MESES_ABREVIADOS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
] as const;

export interface CelulaMes {
  /** Soma efetivamente recebida das parcelas que vencem no mês. */
  recebido: number;
  /** Soma de face das parcelas em aberto que vencem no mês. */
  emAberto: number;
  qtdRecebida: number;
  qtdEmAberto: number;
}

export interface LinhaCarteira {
  associado: Associado;
  /** Índice 0–11, por mês do exercício. */
  meses: CelulaMes[];
  totalRecebido: number;
  totalEmAberto: number;
  qtdEmAberto: number;
  /** Vencimento mais antigo ainda em aberto no exercício, ou `null`. */
  vencimentoMaisAntigoEmAberto: string | null;
}

export interface NotaDaCarteira {
  quantidade: number;
  valor: number;
}

export interface CarteiraEmpresaConveniada {
  exercicio: number;
  linhas: LinhaCarteira[];
  totaisPorMes: CelulaMes[];
  totalRecebido: number;
  totalEmAberto: number;
  /** Exercícios que têm ao menos uma parcela desta carteira, do mais recente para o mais antigo. */
  exerciciosDisponiveis: number[];
  /** Parcela cancelada: existe no banco e não cobra ninguém. Não soma, mas aparece. */
  canceladas: NotaDaCarteira;
  /** Parcela dos associados desta empresa que vence em outro ano — não some, vira nota. */
  foraDoExercicio: NotaDaCarteira;
}

const celulaVazia = (): CelulaMes => ({ recebido: 0, emAberto: 0, qtdRecebida: 0, qtdEmAberto: 0 });

/**
 * Ano e mês de uma data, lidos do **texto**, nunca via `new Date()`.
 *
 * `new Date('2026-01-01')` é meia-noite **UTC**; em UTC-3 isso é 31/12/2025, e a mensalidade de
 * 1º de janeiro cairia em dezembro. As colunas são `date` (`YYYY-MM-DD`), então o ano e o mês
 * estão nos sete primeiros caracteres. É a mesma regra de `anoDaData()`.
 */
export const anoMesDaData = (
  data: string | null | undefined
): { ano: number; mes: number } | null => {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(String(data ?? '').trim());
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return { ano: Number(m[1]), mes: mes - 1 };
};

/** Os associados Pessoa Jurídica vinculados a uma empresa conveniada, em ordem alfabética. */
export const associadosDaEmpresa = (
  associados: readonly Associado[],
  fornecedorId: string | null | undefined
): Associado[] => {
  if (!fornecedorId) return [];
  return (associados || [])
    .filter((a) => a && ehPessoaJuridica(a.tipo_pessoa) && a.fornecedor_id === fornecedorId)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
};

/**
 * Monta a carteira do exercício pedido.
 *
 * **A competência é o VENCIMENTO, para os dois lados** — e aqui isto diverge de propósito da
 * Demonstração Contábil, que data o realizado pela liquidação. Lá a pergunta é "quanto entrou
 * neste exercício"; aqui é "a mensalidade de março foi paga?". Com o realizado datado pela
 * liquidação, uma parcela de março paga em abril sairia da coluna de março sem entrar como
 * aberta — março mostraria um buraco que não existe. Datando as duas pelo vencimento, cada
 * parcela aparece **exatamente uma vez**, e recebido + em aberto do mês é o que foi lançado
 * naquele mês.
 */
export const montarCarteiraEmpresaConveniada = (params: {
  associados: readonly Associado[];
  parcelas: readonly ParcelaReceber[];
  receitas: readonly Receita[];
  fornecedorId: string | null | undefined;
  exercicio: number;
}): CarteiraEmpresaConveniada => {
  const { associados, parcelas, receitas, fornecedorId, exercicio } = params;

  const daEmpresa = associadosDaEmpresa(associados, fornecedorId);
  const idsDaEmpresa = new Set(daEmpresa.map((a) => a.id));

  // Índice id → linha, montado uma vez, em vez de cada parcela varrer a lista inteira.
  const linhaPorAssociado = new Map<string, LinhaCarteira>();
  for (const assoc of daEmpresa) {
    linhaPorAssociado.set(assoc.id, {
      associado: assoc,
      meses: Array.from({ length: 12 }, celulaVazia),
      totalRecebido: 0,
      totalEmAberto: 0,
      qtdEmAberto: 0,
      vencimentoMaisAntigoEmAberto: null,
    });
  }

  // O resolvedor é o mesmo do relatório de Contas a Receber: id da receita → CPF → nome.
  const indice = indiceDeAssociados(daEmpresa);
  const receitasPorId = new Map<string, Receita>();
  for (const r of receitas || []) {
    if (r?.id) receitasPorId.set(r.id, r);
  }

  const totaisPorMes = Array.from({ length: 12 }, celulaVazia);
  const canceladas: NotaDaCarteira = { quantidade: 0, valor: 0 };
  const foraDoExercicio: NotaDaCarteira = { quantidade: 0, valor: 0 };
  const anos = new Set<number>();
  let totalRecebido = 0;
  let totalEmAberto = 0;

  for (const parcela of parcelas || []) {
    if (!parcela) continue;

    const dono = resolverAssociadoDaParcela(parcela, indice, receitasPorId);
    // Parcela de quem não é desta empresa não é assunto desta carteira, e nem vira nota: ela
    // pertence a outra tela. Só o que é dos associados daqui entra nas contas abaixo.
    if (!dono || !idsDaEmpresa.has(dono.id)) continue;

    const competencia = anoMesDaData(parcela.data_vencimento);
    const valorFace = Number(parcela.valor) || 0;

    if (competencia) anos.add(competencia.ano);

    // Cancelada existe no banco e não cobra ninguém — somá-la em aberto mandaria cobrar o que
    // foi cancelado. Vira nota, como `foraDoExercicio` na Demonstração Contábil.
    if (parcela.status === 'cancelado') {
      if (competencia?.ano === exercicio) {
        canceladas.quantidade += 1;
        canceladas.valor += valorFace;
      }
      continue;
    }

    if (!competencia) continue;

    if (competencia.ano !== exercicio) {
      foraDoExercicio.quantidade += 1;
      foraDoExercicio.valor += valorFace;
      continue;
    }

    const linha = linhaPorAssociado.get(dono.id);
    if (!linha) continue;

    const celula = linha.meses[competencia.mes];
    const totalMes = totaisPorMes[competencia.mes];

    if (parcelaLiquidada(parcela.status)) {
      // `??` e não `||`: R$ 0,00 recebido é um valor, não ausência de valor — um `||` encadeado
      // trocaria zero pelo valor de face. Mesma armadilha do recibo de recebimento.
      const recebido = Number(parcela.valor_recebido ?? parcela.valor_pago ?? valorFace) || 0;
      celula.recebido += recebido;
      celula.qtdRecebida += 1;
      totalMes.recebido += recebido;
      totalMes.qtdRecebida += 1;
      linha.totalRecebido += recebido;
      totalRecebido += recebido;
      continue;
    }

    if (parcelaEmAberto(parcela.status)) {
      celula.emAberto += valorFace;
      celula.qtdEmAberto += 1;
      totalMes.emAberto += valorFace;
      totalMes.qtdEmAberto += 1;
      linha.totalEmAberto += valorFace;
      linha.qtdEmAberto += 1;
      totalEmAberto += valorFace;

      const venc = parcela.data_vencimento || '';
      // Comparação de texto: para `YYYY-MM-DD` a ordem lexicográfica é a cronológica, e não
      // depende de fuso nenhum.
      if (venc && (!linha.vencimentoMaisAntigoEmAberto || venc < linha.vencimentoMaisAntigoEmAberto)) {
        linha.vencimentoMaisAntigoEmAberto = venc;
      }
    }
    // Os demais status (`negociado`) não são nem recebimento nem dívida em aberto aqui.
  }

  return {
    exercicio,
    linhas: daEmpresa.map((a) => linhaPorAssociado.get(a.id)!),
    totaisPorMes,
    totalRecebido,
    totalEmAberto,
    exerciciosDisponiveis: Array.from(anos).sort((a, b) => b - a),
    canceladas,
    foraDoExercicio,
  };
};
