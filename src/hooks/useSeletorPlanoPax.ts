import { useState, useCallback, useEffect } from 'react';
import { usePlanosPax } from './usePlanosPax';
import { PlanoPaxCompleto, SimulacaoValor } from '../types/planosPax';

export function useSeletorPlanoPax() {
  const { planosAtivos, buscarPorId, calcularValor, loading: loadingPlanos } = usePlanosPax();
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoPaxCompleto | null>(null);
  const [loading, setLoading] = useState(false);

  const selecionarPlano = useCallback(async (id: string) => {
    if (!id) {
      setPlanoSelecionado(null);
      return;
    }
    
    try {
      setLoading(true);
      const plano = await buscarPorId(id);
      setPlanoSelecionado(plano);
    } catch (err) {
      console.warn("Erro ao buscar detalhes do plano selecionado:", err);
      setPlanoSelecionado(null);
    } finally {
      setLoading(false);
    }
  }, [buscarPorId]);

  const calcularValorContrato = useCallback((nVidas?: number, idadesDependentes?: number[]): SimulacaoValor | null => {
    if (!planoSelecionado) return null;
    return calcularValor(planoSelecionado, nVidas, idadesDependentes);
  }, [planoSelecionado, calcularValor]);

  return {
    planosDisponiveis: planosAtivos,
    planoSelecionado,
    selecionarPlano,
    loading: loading || loadingPlanos,
    calcularValorContrato
  };
}
