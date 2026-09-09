/**
 * Estado do plano contábil da empresa selecionada.
 *
 * O hook só orquestra (carregar, salvar, recarregar); toda a regra de árvore e validação
 * mora em `utils/planoContabilTree.ts`, que é puro e testado. `contasLancaveis` é exposto
 * aqui porque é o que os formulários de lançamento vão consumir na fase 2 — uma fonte só,
 * para as duas telas não divergirem como divergiram as listas do `useOptions`.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { ContaContabil, NaturezaContabil, PlanoContabil } from '../types/planoContabil';
import {
  getPlanoAtivo,
  getContasDoPlano,
  salvarConta as salvarContaService,
  desativarConta as desativarContaService,
  reativarConta as reativarContaService,
  semearPlanoPadrao as semearPlanoPadraoService,
} from '../services/planoContabilService';
import {
  montarArvore,
  contasLancaveis as filtrarLancaveis,
  paisPossiveis as filtrarPaisPossiveis,
} from '../utils/planoContabilTree';
import { tenantDeEscrita } from '../utils/tenant';

export function usePlanoContabil() {
  const { state } = useAppContext();
  const { isOnline, empresaSelecionada } = state;

  // Resolução canônica (utils/tenant.ts): empresa da tela, senão a do próprio usuário.
  // `null` aqui não é erro — é "super_admin sem empresa escolhida", e o service recusa a
  // gravação com MENSAGEM_TENANT_INDEFINIDO em vez de carimbar um valor coringa.
  const tenantDestino = tenantDeEscrita(empresaSelecionada, state.user?.tenant_id);

  const [plano, setPlano] = useState<PlanoContabil | null>(null);
  const [contas, setContas] = useState<ContaContabil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const planoAtivo = await getPlanoAtivo(isOnline, empresaSelecionada);
      setPlano(planoAtivo);
      setContas(planoAtivo ? await getContasDoPlano(isOnline, planoAtivo.id, empresaSelecionada) : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar o plano contábil.';
      setError(msg);
      setPlano(null);
      setContas([]);
    } finally {
      setLoading(false);
    }
  }, [isOnline, empresaSelecionada]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const arvore = useMemo(() => montarArvore(contas), [contas]);

  const salvarConta = useCallback(
    async (dados: Partial<ContaContabil>) => {
      if (!plano) throw new Error('Crie o plano de contas da empresa antes de cadastrar contas.');
      const salva = await salvarContaService(isOnline, {
        ...dados,
        plano_id: dados.plano_id || plano.id,
        tenant_id: dados.tenant_id || tenantDestino || undefined,
      });
      await carregar();
      return salva;
    },
    [isOnline, plano, tenantDestino, carregar],
  );

  const desativarConta = useCallback(
    async (conta: ContaContabil) => {
      await desativarContaService(isOnline, conta);
      await carregar();
    },
    [isOnline, carregar],
  );

  const reativarConta = useCallback(
    async (conta: ContaContabil) => {
      await reativarContaService(isOnline, conta);
      await carregar();
    },
    [isOnline, carregar],
  );

  const semearPlanoPadrao = useCallback(async () => {
    const criado = await semearPlanoPadraoService(isOnline, tenantDestino);
    await carregar();
    return criado;
  }, [isOnline, tenantDestino, carregar]);

  const contasLancaveis = useCallback(
    (natureza?: NaturezaContabil) => filtrarLancaveis(contas, natureza),
    [contas],
  );

  const paisPossiveis = useCallback(
    (natureza: NaturezaContabil, contaId: string | null) => filtrarPaisPossiveis(contas, natureza, contaId),
    [contas],
  );

  return {
    plano,
    contas,
    arvore,
    loading,
    error,
    recarregar: carregar,
    salvarConta,
    desativarConta,
    reativarConta,
    semearPlanoPadrao,
    contasLancaveis,
    paisPossiveis,
  };
}
