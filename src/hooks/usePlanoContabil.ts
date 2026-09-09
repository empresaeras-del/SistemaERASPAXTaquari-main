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
  getPlanosDoTenant,
  getContasDoPlano,
  duplicarPlanoParaExercicio as duplicarPlanoService,
  exercicioCorrente,
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
import { proximoExercicioLivre } from '../utils/exerciciosContabeis';

export function usePlanoContabil() {
  const { state } = useAppContext();
  const { isOnline, empresaSelecionada } = state;

  // Resolução canônica (utils/tenant.ts): empresa da tela, senão a do próprio usuário.
  // `null` aqui não é erro — é "super_admin sem empresa escolhida", e o service recusa a
  // gravação com MENSAGEM_TENANT_INDEFINIDO em vez de carimbar um valor coringa.
  const tenantDestino = tenantDeEscrita(empresaSelecionada, state.user?.tenant_id);

  // Exercício que a tela está olhando. `null` = "o corrente", resolvido pelo service com a
  // queda para o exercício mais recente que existir (ver `getPlanoAtivo`).
  const [exercicioSelecionado, setExercicioSelecionado] = useState<number | null>(null);
  const [planos, setPlanos] = useState<PlanoContabil[]>([]);
  const [plano, setPlano] = useState<PlanoContabil | null>(null);
  const [contas, setContas] = useState<ContaContabil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlanos(await getPlanosDoTenant(isOnline, empresaSelecionada));
      const planoAtivo = await getPlanoAtivo(isOnline, empresaSelecionada, exercicioSelecionado ?? undefined);
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
  }, [isOnline, empresaSelecionada, exercicioSelecionado]);

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

  const semearPlanoPadrao = useCallback(
    async (exercicio?: number) => {
      const criado = await semearPlanoPadraoService(isOnline, tenantDestino, exercicio);
      setExercicioSelecionado(criado.plano.exercicio);
      await carregar();
      return criado;
    },
    [isOnline, tenantDestino, carregar],
  );

  /** Copia o plano visível para outro exercício e passa a mostrar o novo. */
  const duplicarParaExercicio = useCallback(
    async (exercicioDestino: number) => {
      if (!plano) throw new Error('Não há plano de contas para copiar.');
      const criado = await duplicarPlanoService(isOnline, plano, exercicioDestino);
      setExercicioSelecionado(exercicioDestino);
      await carregar();
      return criado;
    },
    [isOnline, plano, carregar],
  );

  const contasLancaveis = useCallback(
    (natureza?: NaturezaContabil) => filtrarLancaveis(contas, natureza),
    [contas],
  );

  const paisPossiveis = useCallback(
    (natureza: NaturezaContabil, contaId: string | null) => filtrarPaisPossiveis(contas, natureza, contaId),
    [contas],
  );

  // O plano mostrado pode não ser o do ano corrente: quando a empresa ainda não montou o
  // exercício novo, `getPlanoAtivo` cai para o mais recente. A tela avisa em vez de fingir.
  const exercicioExibido = plano?.exercicio ?? exercicioSelecionado ?? exercicioCorrente();
  const faltaExercicioCorrente = !!plano && plano.exercicio < exercicioCorrente();

  // Destino sugerido ao duplicar. Parte do maior entre o exercício exibido e o ano corrente,
  // para quem está olhando um plano antigo receber a sugestão do futuro, não do passado.
  // A duplicação em si NÃO depende disto: qualquer exercício livre é aceito — preparar o ano
  // seguinte é trabalho de dezembro, não de 1º de janeiro (ver `exerciciosContabeis.ts`).
  const exercicioSugerido = proximoExercicioLivre(
    planos,
    Math.max(exercicioExibido, exercicioCorrente()),
  );

  return {
    plano,
    planos,
    exercicioExibido,
    exercicioCorrente: exercicioCorrente(),
    faltaExercicioCorrente,
    exercicioSugerido,
    selecionarExercicio: setExercicioSelecionado,
    duplicarParaExercicio,
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
