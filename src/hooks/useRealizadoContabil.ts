/**
 * Valores realizados e previstos do exercício, por conta do plano exibido.
 *
 * Recebe as contas e a árvore **por parâmetro** em vez de chamar `usePlanoContabil` por
 * dentro: a tela do plano já tem o hook montado, e uma segunda instância recarregaria plano
 * e contas do zero a cada render da página. É a mesma decisão de `SeletorContaContabil`
 * (props) contra `CentrosCustoModal` (hook próprio) — quem já tem o dado passa o dado.
 *
 * A agregação em si é pura e testada em `utils/demonstracaoContabil.ts`; aqui só mora o
 * carregamento offline-first e a memoização.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  getReceitas,
  getDespesas,
  getParcelasReceber,
  getParcelasPagar,
  Receita,
  Despesa,
  ParcelaReceber,
  ParcelaPagar,
} from '../services/financeiroService';
import { ContaContabil, ContaContabilNode } from '../types/planoContabil';
import { indicePorLancamento } from '../utils/filtrosClassificacao';
import {
  agregarDemonstracao,
  arvoreComValores,
  resumoDaDemonstracao,
  movimentosDeReceber,
  movimentosDePagar,
  idsDasContas,
  ContaComValores,
  ValoresDaConta,
  ResumoDemonstracao,
} from '../utils/demonstracaoContabil';

interface Parametros {
  contas: ContaContabil[];
  arvore: ContaContabilNode[];
  exercicio: number;
}

interface Retorno {
  arvoreComValores: ContaComValores[];
  resumo: ResumoDemonstracao;
  foraDoExercicio: ValoresDaConta;
  naoClassificado: ValoresDaConta;
  loading: boolean;
  error: string | null;
  recarregar: () => Promise<void>;
}

const ZERO: ValoresDaConta = { previsto: 0, realizado: 0 };

export function useRealizadoContabil({ contas, arvore, exercicio }: Parametros): Retorno {
  const { state } = useAppContext();
  const { isOnline, empresaSelecionada } = state;

  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [parcelasReceber, setParcelasReceber] = useState<ParcelaReceber[]>([]);
  const [parcelasPagar, setParcelasPagar] = useState<ParcelaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    // Sem empresa escolhida não há o que somar — e inventar um tenant aqui seria o erro que
    // `utils/tenant.ts` existe para impedir. A tela mostra os valores zerados.
    if (!empresaSelecionada) {
      setReceitas([]); setDespesas([]); setParcelasReceber([]); setParcelasPagar([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [r, d, pr, pp] = await Promise.all([
        getReceitas(isOnline, empresaSelecionada),
        getDespesas(isOnline, empresaSelecionada),
        getParcelasReceber(isOnline, empresaSelecionada),
        getParcelasPagar(isOnline, empresaSelecionada),
      ]);
      setReceitas(r); setDespesas(d); setParcelasReceber(pr); setParcelasPagar(pp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar os lançamentos do exercício.');
      setReceitas([]); setDespesas([]); setParcelasReceber([]); setParcelasPagar([]);
    } finally {
      setLoading(false);
    }
  }, [isOnline, empresaSelecionada]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const agregado = useMemo(() => {
    // Um índice só para as duas naturezas: a conta do pai já diz de qual lado o valor cai.
    const indice = indicePorLancamento([...receitas, ...despesas]);
    return agregarDemonstracao({
      movimentos: [...movimentosDeReceber(parcelasReceber), ...movimentosDePagar(parcelasPagar)],
      indice,
      contasDoPlano: idsDasContas(contas),
      exercicio,
    });
  }, [receitas, despesas, parcelasReceber, parcelasPagar, contas, exercicio]);

  const comValores = useMemo(
    () => arvoreComValores(arvore, agregado.porConta),
    [arvore, agregado.porConta],
  );

  const resumo = useMemo(() => resumoDaDemonstracao(comValores), [comValores]);

  return {
    arvoreComValores: comValores,
    resumo,
    foraDoExercicio: agregado.foraDoExercicio ?? ZERO,
    naoClassificado: agregado.naoClassificado ?? ZERO,
    loading,
    error,
    recarregar: carregar,
  };
}
