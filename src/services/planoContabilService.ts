/**
 * Acesso ao plano contábil (offline-first, no formato descrito no CLAUDE.md):
 * Supabase quando online, caindo para o IndexedDB quando não.
 *
 * O filtro por tenant no caminho offline passa por `registroPertenceAoTenant` — é o que
 * faz o cache local aplicar o mesmo critério que a RLS aplica no servidor. Sem ele, a
 * lista local mostraria contas de outra empresa depois de trocar de empresa na tela.
 */
import { supabase, registrarAuditoria } from '../lib/supabase';
import { getAllFromIDB, saveToIDB, getFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { generateUUID } from '../utils/uuid';
import { registroPertenceAoTenant, tenantDeEscrita, MENSAGEM_TENANT_INDEFINIDO } from '../utils/tenant';
import { ContaContabil, PlanoContabil } from '../types/planoContabil';
import {
  PLANO_CONTABIL_PADRAO,
  CODIGO_PLANO_PADRAO,
  NOME_PLANO_PADRAO,
} from '../config/planoContabilPadrao.config';
import { codigoDoPai, nivelDoCodigo, resolverContaPorCodigo, compararCodigos } from '../utils/planoContabilTree';

const STORE_PLANOS = 'planos_contabeis';
const STORE_CONTAS = 'contas_contabeis';

const agora = () => new Date().toISOString();

export const exercicioCorrente = (): number => new Date().getFullYear();

/** Todos os planos ativos da empresa, um por exercício, do mais recente para o mais antigo. */
export const getPlanosDoTenant = async (
  isOnline: boolean,
  tenantId?: string | null,
): Promise<PlanoContabil[]> => {
  if (isOnline) {
    try {
      let query = supabase.from(STORE_PLANOS).select('*').is('deleted_at', null).eq('ativo', true);
      if (tenantId && tenantId !== 'all') query = query.eq('tenant_id', tenantId);

      const { data, error } = await query.order('exercicio', { ascending: false });
      if (!error && data) {
        for (const plano of data) await saveToIDB(STORE_PLANOS, plano);
        return data;
      }
    } catch (err) {
      console.warn('Falha ao buscar planos contábeis no Supabase, caindo para o IDB:', err);
    }
  }

  const locais = await getAllFromIDB<PlanoContabil>(STORE_PLANOS);
  return locais
    .filter((p) => p.ativo && !p.deleted_at && registroPertenceAoTenant(p.tenant_id, tenantId))
    .sort((a, b) => (b.exercicio || 0) - (a.exercicio || 0));
};

/**
 * Plano da empresa para um exercício, ou `null` quando ela ainda não tem plano montado.
 *
 * Sem `exercicio`, usa o ano corrente. Quando não existe plano para o ano pedido, **cai para
 * o exercício mais recente que existir**, e não para `null`: sem essa queda, na virada do ano
 * toda empresa perderia o plano de um dia para o outro e os lançamentos voltariam a nascer
 * sem classificação (a isenção do trigger `exige_conta_contabil` passaria a valer), sem nada
 * visível na tela. A queda mantém o sistema funcionando; quem avisa que falta montar o
 * exercício novo é a tela do plano de contas.
 */
export const getPlanoAtivo = async (
  isOnline: boolean,
  tenantId?: string | null,
  exercicio?: number,
): Promise<PlanoContabil | null> => {
  const alvo = exercicio ?? exercicioCorrente();
  const planos = await getPlanosDoTenant(isOnline, tenantId);
  if (planos.length === 0) return null;

  return (
    planos.find((p) => p.exercicio === alvo) ||
    planos.find((p) => p.exercicio < alvo) ||
    planos[0]
  );
};

/** Todas as contas de um plano, sem montar a árvore (isso é `montarArvore`, puro e testado). */
export const getContasDoPlano = async (
  isOnline: boolean,
  planoId: string,
  tenantId?: string | null,
): Promise<ContaContabil[]> => {
  if (isOnline) {
    try {
      const { data, error } = await supabase
        .from(STORE_CONTAS)
        .select('*')
        .eq('plano_id', planoId)
        .is('deleted_at', null)
        .order('codigo', { ascending: true });

      if (!error && data) {
        for (const conta of data) await saveToIDB(STORE_CONTAS, conta);
        return data;
      }
    } catch (err) {
      console.warn('Falha ao buscar contas contábeis no Supabase, caindo para o IDB:', err);
    }
  }

  const locais = await getAllFromIDB<ContaContabil>(STORE_CONTAS);
  return locais.filter(
    (c) => c.plano_id === planoId && !c.deleted_at && registroPertenceAoTenant(c.tenant_id, tenantId),
  );
};

/**
 * Conta que um caminho automático deve gravar num lançamento novo.
 *
 * Usada por quem cria receita/despesa sem passar por formulário — o wizard de atendimento, a
 * requisição com co-participação, a geração de mensalidades, o contrato novo e o faturamento
 * de credenciado. Devolve `null` quando a empresa ainda não tem plano (ou não tem conta
 * lançável da natureza): aí o lançamento é gravado sem conta e o trigger `exige_conta_contabil`
 * o isenta, mantendo esses fluxos funcionando exatamente como antes da fase 3.
 *
 * Como todo o resto do módulo, é offline-first: online consulta o Supabase e reidrata o IDB,
 * offline responde do cache — um atendimento registrado sem rede continua nascendo classificado.
 */
export const resolverContaLancamento = async (
  isOnline: boolean,
  tenantId: string | null | undefined,
  natureza: 'receita' | 'despesa',
  codigoPreferido: string,
): Promise<ContaContabil | null> => {
  if (!tenantId) return null;

  try {
    const plano = await getPlanoAtivo(isOnline, tenantId);
    if (!plano) return null;

    const contas = await getContasDoPlano(isOnline, plano.id, tenantId);
    return resolverContaPorCodigo(contas, natureza, codigoPreferido);
  } catch (err) {
    // Classificar é desejável, mas nunca ao ponto de impedir o atendimento de ser salvo:
    // sem conta o lançamento ainda entra, porque o trigger isenta quem não tem o que usar.
    console.warn('Falha ao resolver a conta contábil do lançamento automático:', err);
    return null;
  }
};

export const salvarPlano = async (isOnline: boolean, plano: Partial<PlanoContabil>): Promise<PlanoContabil> => {
  const tenantId = tenantDeEscrita(plano.tenant_id);
  if (!tenantId) throw new Error(MENSAGEM_TENANT_INDEFINIDO);

  const existente = plano.id ? await getFromIDB<PlanoContabil>(STORE_PLANOS, plano.id) : null;

  const registro: PlanoContabil = {
    ...(existente || {}),
    ...plano,
    id: plano.id || generateUUID(),
    tenant_id: tenantId,
    empresa_id: plano.empresa_id || tenantId,
    codigo: (plano.codigo || CODIGO_PLANO_PADRAO).trim(),
    nome: (plano.nome || NOME_PLANO_PADRAO).trim(),
    exercicio: plano.exercicio || exercicioCorrente(),
    vigencia_inicio: plano.vigencia_inicio || new Date().toISOString().split('T')[0],
    ativo: plano.ativo !== undefined ? plano.ativo : true,
    criado_em: existente?.criado_em || agora(),
    atualizado_em: agora(),
  } as PlanoContabil;

  await saveToIDB(STORE_PLANOS, registro);

  if (isOnline) {
    const { error } = await supabase.from(STORE_PLANOS).upsert(registro, { onConflict: 'id' });
    if (error) {
      await addToSyncQueue({ storeName: STORE_PLANOS, action: 'update', data: registro });
      throw new Error(`Erro ao salvar plano contábil: ${error.message}`);
    }
    await registrarAuditoria(existente ? 'Editar Plano Contábil' : 'Criar Plano Contábil', {
      id: registro.id,
      nome: registro.nome,
    });
  } else {
    await addToSyncQueue({ storeName: STORE_PLANOS, action: 'update', data: registro });
  }

  return registro;
};

export const salvarConta = async (isOnline: boolean, conta: Partial<ContaContabil>): Promise<ContaContabil> => {
  const tenantId = tenantDeEscrita(conta.tenant_id);
  if (!tenantId) throw new Error(MENSAGEM_TENANT_INDEFINIDO);
  if (!conta.plano_id) throw new Error('Conta contábil sem plano: informe o plano antes de salvar.');

  const existente = conta.id ? await getFromIDB<ContaContabil>(STORE_CONTAS, conta.id) : null;
  const codigo = (conta.codigo || '').trim();

  const registro: ContaContabil = {
    ...(existente || {}),
    ...conta,
    id: conta.id || generateUUID(),
    tenant_id: tenantId,
    empresa_id: conta.empresa_id || tenantId,
    codigo,
    nome: (conta.nome || '').trim(),
    conta_pai_id: conta.conta_pai_id || null,
    nivel: nivelDoCodigo(codigo),
    ativo: conta.ativo !== undefined ? conta.ativo : true,
    criado_em: existente?.criado_em || agora(),
    atualizado_em: agora(),
  } as ContaContabil;

  await saveToIDB(STORE_CONTAS, registro);

  if (isOnline) {
    const { error } = await supabase.from(STORE_CONTAS).upsert(registro, { onConflict: 'id' });
    if (error) {
      await addToSyncQueue({ storeName: STORE_CONTAS, action: 'update', data: registro });
      throw new Error(`Erro ao salvar conta contábil: ${error.message}`);
    }
    await registrarAuditoria(existente ? 'Editar Conta Contábil' : 'Criar Conta Contábil', {
      id: registro.id,
      codigo: registro.codigo,
      nome: registro.nome,
    });
  } else {
    await addToSyncQueue({ storeName: STORE_CONTAS, action: 'update', data: registro });
  }

  return registro;
};

/**
 * Desativa (não exclui) uma conta. Conta que já classificou lançamento não pode sumir do
 * histórico — por isso a tela oferece "desativar", e a FK do banco é `ON DELETE RESTRICT`.
 */
export const desativarConta = async (isOnline: boolean, conta: ContaContabil): Promise<ContaContabil> =>
  salvarConta(isOnline, { ...conta, ativo: false });

export const reativarConta = async (isOnline: boolean, conta: ContaContabil): Promise<ContaContabil> =>
  salvarConta(isOnline, { ...conta, ativo: true });

/**
 * Cria o plano da empresa a partir do modelo em `config/planoContabilPadrao.config.ts`,
 * **copiando** as contas para linhas do próprio tenant — o modelo nunca é uma linha
 * compartilhada entre empresas (ver o comentário do config e o CLAUDE.md).
 *
 * As contas são criadas na ordem do array, que garante o pai antes das filhas: o
 * `conta_pai_id` é resolvido pelo código do pai já inserido.
 */
/**
 * Copia o plano de um exercício para outro — a operação de virada de ano.
 *
 * Copia, e não move: o plano de origem continua intacto, com os lançamentos daquele ano
 * apontando para as contas dele. É isso que faz o relatório de um exercício fechado continuar
 * batendo depois que o plano do ano seguinte for editado.
 *
 * Os ids são novos, e `conta_pai_id` é remapeado do id antigo para o novo — copiar mantendo
 * o `conta_pai_id` de origem penduraria as contas de 2027 nas de 2026, e a FK composta
 * `(tenant_id, plano_id, conta_pai_id)` recusaria a gravação de qualquer forma. As contas
 * são percorridas em ordem de código, que garante o pai antes das filhas.
 */
export const duplicarPlanoParaExercicio = async (
  isOnline: boolean,
  planoOrigem: PlanoContabil,
  exercicioDestino: number,
): Promise<{ plano: PlanoContabil; contas: ContaContabil[] }> => {
  const tenantId = tenantDeEscrita(planoOrigem.tenant_id);
  if (!tenantId) throw new Error(MENSAGEM_TENANT_INDEFINIDO);

  const planos = await getPlanosDoTenant(isOnline, tenantId);
  if (planos.some((p) => p.exercicio === exercicioDestino)) {
    throw new Error(`Esta empresa já tem um plano de contas ativo para ${exercicioDestino}.`);
  }

  const origem = await getContasDoPlano(isOnline, planoOrigem.id, tenantId);

  const plano = await salvarPlano(isOnline, {
    tenant_id: tenantId,
    codigo: planoOrigem.codigo,
    nome: `${planoOrigem.nome.replace(/\s*\d{4}$/, '')} ${exercicioDestino}`.trim(),
    descricao: `Copiado do exercício ${planoOrigem.exercicio}.`,
    exercicio: exercicioDestino,
    ativo: true,
  });

  const idNovoPorAntigo = new Map<string, string>();
  const contas: ContaContabil[] = [];

  for (const conta of [...origem].sort((a, b) => compararCodigos(a.codigo, b.codigo))) {
    const criada = await salvarConta(isOnline, {
      tenant_id: tenantId,
      plano_id: plano.id,
      conta_pai_id: conta.conta_pai_id ? idNovoPorAntigo.get(conta.conta_pai_id) || null : null,
      codigo: conta.codigo,
      nome: conta.nome,
      descricao: conta.descricao || null,
      natureza: conta.natureza,
      tipo: conta.tipo,
      ordem_exibicao: conta.ordem_exibicao ?? null,
      // Conta desativada no exercício anterior não volta a valer no novo por acidente.
      ativo: conta.ativo,
    });
    idNovoPorAntigo.set(conta.id, criada.id);
    contas.push(criada);
  }

  await registrarAuditoria('Duplicar Plano Contábil', {
    plano_origem_id: planoOrigem.id,
    exercicio_origem: planoOrigem.exercicio,
    plano_id: plano.id,
    exercicio_destino: exercicioDestino,
    contas_copiadas: contas.length,
  });

  return { plano, contas };
};

export const semearPlanoPadrao = async (
  isOnline: boolean,
  tenantIdBruto?: string | null,
  exercicio?: number,
): Promise<{ plano: PlanoContabil; contas: ContaContabil[] }> => {
  const tenantId = tenantDeEscrita(tenantIdBruto);
  if (!tenantId) throw new Error(MENSAGEM_TENANT_INDEFINIDO);

  const alvo = exercicio ?? exercicioCorrente();
  const planos = await getPlanosDoTenant(isOnline, tenantId);
  if (planos.some((p) => p.exercicio === alvo)) {
    throw new Error(`Esta empresa já tem um plano de contas ativo para ${alvo}.`);
  }

  const plano = await salvarPlano(isOnline, {
    tenant_id: tenantId,
    codigo: CODIGO_PLANO_PADRAO,
    nome: `${NOME_PLANO_PADRAO} ${alvo}`,
    descricao: 'Criado a partir do modelo padrão do sistema.',
    exercicio: alvo,
    ativo: true,
  });

  const idPorCodigo = new Map<string, string>();
  const contas: ContaContabil[] = [];

  for (const modelo of PLANO_CONTABIL_PADRAO) {
    const paiCodigo = codigoDoPai(modelo.codigo);
    const criada = await salvarConta(isOnline, {
      tenant_id: tenantId,
      plano_id: plano.id,
      conta_pai_id: paiCodigo ? idPorCodigo.get(paiCodigo) || null : null,
      codigo: modelo.codigo,
      nome: modelo.nome,
      descricao: modelo.descricao || null,
      natureza: modelo.natureza,
      tipo: modelo.tipo,
      ativo: true,
    });
    idPorCodigo.set(modelo.codigo, criada.id);
    contas.push(criada);
  }

  await registrarAuditoria('Semear Plano Contábil Padrão', {
    plano_id: plano.id,
    contas_criadas: contas.length,
  });

  return { plano, contas };
};
