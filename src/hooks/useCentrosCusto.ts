/**
 * Estado dos centros de custo da empresa selecionada.
 *
 * Mesmo desenho de `usePlanoContabil`: o hook só orquestra (carregar, salvar, recarregar), e
 * toda a regra — código derivado do nome, ordenação, quem pode ser oferecido no lançamento —
 * mora em `utils/centrosCusto.ts`, que é puro e testado.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { CentroCusto } from '../types/centroCusto';
import {
  getCentrosCusto,
  salvarCentroCusto as salvarService,
  desativarCentroCusto as desativarService,
  reativarCentroCusto as reativarService,
} from '../services/centrosCustoService';
import { tenantDeEscrita } from '../utils/tenant';

export function useCentrosCusto() {
  const { state } = useAppContext();
  const { isOnline, empresaSelecionada } = state;

  // Resolução canônica (utils/tenant.ts). `null` é "super_admin sem empresa escolhida": o
  // service recusa a gravação com MENSAGEM_TENANT_INDEFINIDO em vez de carimbar um coringa.
  const tenantDestino = tenantDeEscrita(empresaSelecionada, state.user?.tenant_id);

  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCentros(await getCentrosCusto(isOnline, empresaSelecionada));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar os centros de custo.');
      setCentros([]);
    } finally {
      setLoading(false);
    }
  }, [isOnline, empresaSelecionada]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = useCallback(
    async (dados: Partial<CentroCusto>) => {
      const salvo = await salvarService(isOnline, {
        ...dados,
        tenant_id: dados.tenant_id || tenantDestino || undefined,
      });
      await carregar();
      return salvo;
    },
    [isOnline, tenantDestino, carregar],
  );

  const desativar = useCallback(
    async (centro: CentroCusto) => {
      await desativarService(isOnline, centro);
      await carregar();
    },
    [isOnline, carregar],
  );

  const reativar = useCallback(
    async (centro: CentroCusto) => {
      await reativarService(isOnline, centro);
      await carregar();
    },
    [isOnline, carregar],
  );

  return { centros, loading, error, carregar, salvar, desativar, reativar };
}
