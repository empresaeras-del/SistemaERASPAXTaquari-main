import { Associado } from '../services/associadosService';
import { Receita, ParcelaReceber } from '../services/financeiroService';
import { PlanoPax } from '../types/planosPax';

/**
 * Funções puras extraídas de components/associados/AssociadoMensalidadesTab.tsx
 * — comportamento idêntico ao original, só relocadas para poder ser testadas
 * isoladamente sem montar o componente. Ver CLAUDE.md, seção "God components".
 */

/** Verifica se a quantidade de vidas cadastradas excede o limite de um plano coletivo. */
export const ultrapassaLimiteColetivo = (
  plano: Pick<PlanoPax, 'tipo_plano' | 'limite_vidas'> | null | undefined,
  vidasCadastradas: number
): boolean => {
  if (!plano) return false;
  if (plano.tipo_plano === 'coletivo') {
    const limite = plano.limite_vidas || 999;
    return vidasCadastradas > limite;
  }
  return false;
};

/**
 * Calcula o valor-base da mensalidade: em planos individuais, multiplica o
 * valor unitário pelas vidas cadastradas (respeitando o mínimo de vidas para
 * cálculo do plano); em planos coletivos, usa o valor fixo do plano mais um
 * valor extra (cobrado quando o limite de vidas é excedido).
 */
export const calcularValorMensalidadeBase = (
  plano: Pick<PlanoPax, 'tipo_plano' | 'valor_mensalidade' | 'minimo_vidas_calculo'> | null | undefined,
  vidasCadastradas: number,
  valorExtra: number
): number => {
  if (!plano) return 0;
  if (plano.tipo_plano === 'individual') {
    const minVidas = plano.minimo_vidas_calculo || 1;
    const vidasParaCalculo = vidasCadastradas <= minVidas ? minVidas : vidasCadastradas;
    return plano.valor_mensalidade * vidasParaCalculo;
  }
  return plano.valor_mensalidade + (Number(valorExtra) || 0);
};

/** Descrição textual de como o valor da mensalidade foi calculado, exibida ao usuário. */
export const descricaoCalculoMensalidade = (
  plano: Pick<PlanoPax, 'tipo_plano' | 'minimo_vidas_calculo'> | null | undefined,
  vidasCadastradas: number,
  valorExtra: number
): string => {
  if (!plano) return '';
  if (plano.tipo_plano === 'individual') {
    const minVidas = plano.minimo_vidas_calculo || 1;
    if (vidasCadastradas <= minVidas) {
      return `Valor Base x ${minVidas} (Mínimo de vidas exigido)`;
    }
    return `Valor Base x ${vidasCadastradas} vidas`;
  }
  return 'Valor Base Coletivo' + (Number(valorExtra) > 0 ? ' + Valor Extra' : '');
};

export interface ParcelaProjetada {
  numero_parcela: number;
  descricao: string;
  data_vencimento: string;
  valor: number;
}

export interface ProjecaoParcelasOptions {
  dataInicioISO: string; // 'yyyy-MM-dd'
  qtdParcelas: number;
  diaVencimento: number;
  baseParcela: number;
  taxaAdesao: number;
  planoNome: string;
  formatarData: (date: Date) => string; // injeta format(date, 'yyyy-MM-dd') do date-fns
}

/**
 * Projeta as parcelas de mensalidade a serem geradas: a taxa de adesão é
 * somada só na primeira parcela. Vencimentos caem sempre no mesmo dia do mês,
 * a partir do mês da data de início.
 */
export const gerarProjecaoParcelas = ({
  dataInicioISO,
  qtdParcelas,
  diaVencimento,
  baseParcela,
  taxaAdesao,
  planoNome,
  formatarData,
}: ProjecaoParcelasOptions): ParcelaProjetada[] => {
  const dt = new Date(dataInicioISO + 'T12:00:00');
  const arr: ParcelaProjetada[] = [];

  for (let i = 1; i <= qtdParcelas; i++) {
    const vencimento = new Date(dt.getFullYear(), dt.getMonth() + (i - 1), diaVencimento);
    const valorParcela = i === 1 ? baseParcela + taxaAdesao : baseParcela;
    const descAdesao = i === 1 && taxaAdesao > 0 ? ' (Inc. Adesão)' : '';

    arr.push({
      numero_parcela: i,
      descricao: `Mensalidade ${i}/${qtdParcelas} - ${planoNome}${descAdesao}`,
      data_vencimento: formatarData(vencimento),
      valor: valorParcela,
    });
  }
  return arr;
};

/**
 * Filtra, dentre todas as receitas do sistema, as que pertencem a um
 * associado — por id, depois por CPF (só dígitos) e por fim por nome
 * normalizado, na mesma ordem de precedência do código original.
 */
export const filtrarReceitasDoAssociado = (
  todasReceitas: Receita[],
  associado: Pick<Associado, 'id' | 'cpf' | 'nome'>
): Receita[] => {
  const assocCpf = associado.cpf?.replace(/\D/g, '');
  const assocNome = associado.nome?.toLowerCase().trim();

  return todasReceitas.filter(r => {
    if (r.associado_id && r.associado_id === associado.id) return true;
    const rCpf = (r.associado_cpf || r.cliente_cpf_cnpj)?.replace(/\D/g, '');
    if (assocCpf && rCpf && rCpf === assocCpf) return true;
    if (assocNome && (r.associado_nome?.toLowerCase().trim() === assocNome || r.cliente_nome?.toLowerCase().trim() === assocNome)) return true;
    return false;
  });
};

/**
 * Filtra, dentre todas as parcelas do sistema, as que pertencem a um
 * associado — por vínculo com uma receita já identificada como dele, depois
 * por CPF e por nome, mesma ordem de precedência do original.
 */
export const filtrarParcelasDoAssociado = (
  todasParcelas: ParcelaReceber[],
  receitasDoAssociado: Receita[],
  associado: Pick<Associado, 'cpf' | 'nome'>
): ParcelaReceber[] => {
  const idsReceitasAssociado = new Set(receitasDoAssociado.map(r => r.id));
  const assocCpf = associado.cpf?.replace(/\D/g, '');
  const assocNome = associado.nome?.toLowerCase().trim();

  return todasParcelas.filter(p => {
    if (p.receita_id && idsReceitasAssociado.has(p.receita_id)) return true;
    const pCpf = p.devedor_cpf_cnpj?.replace(/\D/g, '');
    if (assocCpf && pCpf && pCpf === assocCpf) return true;
    if (assocNome && p.devedor_nome?.toLowerCase().trim() === assocNome) return true;
    return false;
  });
};

export interface KpiParcelas {
  pagas: ParcelaReceber[];
  emAberto: ParcelaReceber[];
  atrasadas: ParcelaReceber[];
  valorPagas: number;
  valorAberto: number;
  valorAtrasadas: number;
}

/** Agrupa as parcelas por status (pagas/em aberto/atrasadas) e soma os valores de cada grupo, para os KPIs do topo da tela. */
export const agruparParcelasPorStatusComTotais = (parcelas: ParcelaReceber[]): KpiParcelas => {
  const pagas = parcelas.filter(p => p.status === 'recebido' || p.status === 'pago');
  const emAberto = parcelas.filter(p => p.status === 'pendente');
  const atrasadas = parcelas.filter(p => p.status === 'vencido' || p.status === 'atrasado');

  const valorPagas = pagas.reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0);
  const valorAberto = emAberto.reduce((acc, p) => acc + (p.valor || 0), 0);
  const valorAtrasadas = atrasadas.reduce((acc, p) => acc + (p.valor || 0), 0);

  return { pagas, emAberto, atrasadas, valorPagas, valorAberto, valorAtrasadas };
};

export interface FiltrosParcelasTabela {
  filtroStatus: string;
  filtroPeriodoInicio: string;
  filtroPeriodoFim: string;
}

/** Filtra a lista de parcelas para a tabela detalhada, por status e por período de vencimento. */
export const filtrarParcelasTabela = (
  parcelas: ParcelaReceber[],
  { filtroStatus, filtroPeriodoInicio, filtroPeriodoFim }: FiltrosParcelasTabela
): ParcelaReceber[] => {
  return parcelas.filter(p => {
    const matchStatus = filtroStatus === 'all' || p.status === filtroStatus;
    let matchPeriodo = true;
    if (filtroPeriodoInicio) {
      matchPeriodo = matchPeriodo && new Date(p.data_vencimento) >= new Date(filtroPeriodoInicio);
    }
    if (filtroPeriodoFim) {
      matchPeriodo = matchPeriodo && new Date(p.data_vencimento) <= new Date(filtroPeriodoFim);
    }
    return matchStatus && matchPeriodo;
  });
};
