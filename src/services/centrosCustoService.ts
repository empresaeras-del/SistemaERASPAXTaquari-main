/**
 * Acesso aos centros de custo (offline-first, no formato descrito no CLAUDE.md):
 * Supabase quando online, caindo para o IndexedDB quando não.
 *
 * Substitui `useOptions('centros_custo', ...)`, que guardava a lista no IndexedDB do próprio
 * navegador: era **por dispositivo**, não por empresa. O filtro por tenant no caminho offline
 * passa por `registroPertenceAoTenant` — é o que faz o cache local aplicar o mesmo critério
 * que a RLS aplica no servidor.
 */
import { supabase, registrarAuditoria } from '../lib/supabase';
import { getAllFromIDB, saveToIDB, getFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { generateUUID } from '../utils/uuid';
import { registroPertenceAoTenant, tenantDeEscrita, MENSAGEM_TENANT_INDEFINIDO } from '../utils/tenant';
import { CentroCusto } from '../types/centroCusto';
import { codigoDeCentroCusto, ordenarCentrosCusto } from '../utils/centrosCusto';

const STORE = 'centros_custo';

const agora = () => new Date().toISOString();

/** Centros de custo da empresa, ativos e inativos — a tela decide o que mostrar. */
export const getCentrosCusto = async (
  isOnline: boolean,
  tenantId?: string | null,
): Promise<CentroCusto[]> => {
  if (isOnline) {
    try {
      let query = supabase.from(STORE).select('*').is('deleted_at', null);
      if (tenantId && tenantId !== 'all') query = query.eq('tenant_id', tenantId);

      const { data, error } = await query.order('codigo', { ascending: true });
      if (!error && data) {
        for (const centro of data) await saveToIDB(STORE, centro);
        return ordenarCentrosCusto(data);
      }
    } catch (err) {
      console.warn('Falha ao buscar centros de custo no Supabase, caindo para o IDB:', err);
    }
  }

  const locais = await getAllFromIDB<CentroCusto>(STORE);
  return ordenarCentrosCusto(
    locais.filter((c) => !c.deleted_at && registroPertenceAoTenant(c.tenant_id, tenantId)),
  );
};

/**
 * Cria ou atualiza um centro de custo. O código é derivado do nome quando não vem informado
 * — centro de custo não tem hierarquia como o plano de contas, então um código legível vale
 * mais que uma sequência; e o código de um centro que já existe nunca é reescrito, porque é
 * ele que identifica o centro nos relatórios de quem já exportou dados.
 */
export const salvarCentroCusto = async (
  isOnline: boolean,
  centro: Partial<CentroCusto>,
): Promise<CentroCusto> => {
  const tenantId = tenantDeEscrita(centro.tenant_id);
  if (!tenantId) throw new Error(MENSAGEM_TENANT_INDEFINIDO);

  const nome = (centro.nome || '').trim();
  if (!nome) throw new Error('Informe o nome do centro de custo.');

  const existente = centro.id ? await getFromIDB<CentroCusto>(STORE, centro.id) : null;

  const registro: CentroCusto = {
    ...(existente || {}),
    ...centro,
    id: centro.id || generateUUID(),
    tenant_id: tenantId,
    empresa_id: centro.empresa_id || tenantId,
    codigo: (existente?.codigo || centro.codigo || codigoDeCentroCusto(nome)).trim(),
    nome,
    ativo: centro.ativo !== undefined ? centro.ativo : true,
    criado_em: existente?.criado_em || agora(),
    atualizado_em: agora(),
  } as CentroCusto;

  await saveToIDB(STORE, registro);

  if (isOnline) {
    const { error } = await supabase.from(STORE).upsert(registro, { onConflict: 'id' });
    if (error) {
      await addToSyncQueue({ storeName: STORE, action: 'update', data: registro });
      throw new Error(`Erro ao salvar centro de custo: ${error.message}`);
    }
    await registrarAuditoria(existente ? 'Editar Centro de Custo' : 'Criar Centro de Custo', {
      id: registro.id,
      nome: registro.nome,
    });
  } else {
    await addToSyncQueue({ storeName: STORE, action: 'update', data: registro });
  }

  return registro;
};

/**
 * Desativa em vez de excluir — a despesa que já aponta para o centro continua válida, e a FK
 * é `ON DELETE RESTRICT` de qualquer forma. É a mesma decisão de `desativarConta`.
 */
export const desativarCentroCusto = async (isOnline: boolean, centro: CentroCusto): Promise<CentroCusto> =>
  salvarCentroCusto(isOnline, { ...centro, ativo: false });

export const reativarCentroCusto = async (isOnline: boolean, centro: CentroCusto): Promise<CentroCusto> =>
  salvarCentroCusto(isOnline, { ...centro, ativo: true });
