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
import { codigoDoPai, nivelDoCodigo, resolverContaPorCodigo } from '../utils/planoContabilTree';

const STORE_PLANOS = 'planos_contabeis';
const STORE_CONTAS = 'contas_contabeis';

const agora = () => new Date().toISOString();

/** Plano vigente da empresa, ou `null` quando ela ainda não tem plano montado. */
export const getPlanoAtivo = async (
  isOnline: boolean,
  tenantId?: string | null,
): Promise<PlanoContabil | null> => {
  if (isOnline) {
    try {
      let query = supabase
        .from(STORE_PLANOS)
        .select('*')
        .is('deleted_at', null)
        .eq('ativo', true);

      if (tenantId) query = query.eq('tenant_id', tenantId);

      const { data, error } = await query.limit(1);
      if (!error && data) {
        for (const plano of data) await saveToIDB(STORE_PLANOS, plano);
        return data[0] || null;
      }
    } catch (err) {
      console.warn('Falha ao buscar plano contábil no Supabase, caindo para o IDB:', err);
    }
  }

  const locais = await getAllFromIDB<PlanoContabil>(STORE_PLANOS);
  return (
    locais.find(
      (p) => p.ativo && !p.deleted_at && registroPertenceAoTenant(p.tenant_id, tenantId),
    ) || null
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
export const semearPlanoPadrao = async (
  isOnline: boolean,
  tenantIdBruto?: string | null,
): Promise<{ plano: PlanoContabil; contas: ContaContabil[] }> => {
  const tenantId = tenantDeEscrita(tenantIdBruto);
  if (!tenantId) throw new Error(MENSAGEM_TENANT_INDEFINIDO);

  const jaExiste = await getPlanoAtivo(isOnline, tenantId);
  if (jaExiste) {
    throw new Error('Esta empresa já tem um plano de contas ativo. Desative o atual antes de criar outro.');
  }

  const plano = await salvarPlano(isOnline, {
    tenant_id: tenantId,
    codigo: CODIGO_PLANO_PADRAO,
    nome: NOME_PLANO_PADRAO,
    descricao: 'Criado a partir do modelo padrão do sistema.',
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
