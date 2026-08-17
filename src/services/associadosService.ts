import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';

export interface Associado {
  id: string;
  tenant_id: string;
  nome: string;
  cpf: string;
  data_nascimento?: string;
  rg?: string;
  sexo?: string;
  nome_pai?: string;
  nome_mae?: string;
  telefone?: string;
  email?: string;
  endereco_logradouro?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_cep?: string;
  plano_id?: string;
  tipo_pessoa?: 'PF' | 'PJ';
  fornecedor_id?: string;
  plano_pax_id?: string;
  numero_contrato?: string;
  n_vidas?: number;
  plano_nome?: string;
  documentos?: DocumentoAssociado[];
  valor_plano?: number;
  assinatura_base64?: string;
  historico_contratos?: { id: string; plano: string; valor: number; data_inicio: string; data_fim?: string }[];
  status: 'ativo' | 'inativo' | 'inadimplente' | 'encerrado';
  created_at?: string;
  deleted_at?: string | null;
  data_adesao: string;
  dependentes: Dependente[];
}

export interface Dependente {
  id: string;
  nome: string;
  cpf?: string;
  data_nascimento?: string;
  parentesco: string;
}

const STORE_NAME = 'associados';

export const getAssociados = async (isOnline: boolean, tenantId: string | null): Promise<Associado[]> => {
  

  let associados: Associado[] = [];

  if (isOnline) {
    try {
      let query = supabase.from('associados').select('*').eq('deleted_at', null);
      if (tenantId && tenantId !== 'all') {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (error) throw error;
      
      // Update local cache
      if (data) {
        for (const item of data) {
          await saveToIDB(STORE_NAME, item);
        }
      }
      associados = data || [];
    } catch (error) {
      console.warn('Supabase fetch failed (likely not configured), falling back to IDB.');
      associados = await getAllFromIDB<Associado>(STORE_NAME);
    }
  } else {
    associados = await getAllFromIDB<Associado>(STORE_NAME);
  }

  // Ensure we filter by tenant_id for IDB fallbacks
  return associados.filter(a => {
    if (!a) return false;
    if (a.deleted_at) return false;
    if (tenantId && tenantId !== 'all' && a?.tenant_id !== tenantId) return false;
    return true;
  });
};

export const saveAssociado = async (associado: Associado, isOnline: boolean): Promise<void> => {
  const existing = await getFromIDB<Associado>(STORE_NAME, associado.id);
  
  if (isOnline) {
    try {
      const { error } = await supabase
        .from('associados')
        .upsert(associado);
            
      if (error) {
        console.warn('Supabase save failed, proceeding with IDB only.', error);
      }
    } catch (err) {
      console.warn('Supabase save threw error, proceeding with IDB only.', err);
    }
  } else {
    await addToSyncQueue({
      storeName: 'associados',
      action: 'update',
      data: associado
    });
  }
  
  // Sincroniza IDB pós-escrita
  await saveToIDB(STORE_NAME, associado);
  
  const acao = existing ? 'Editar Associado' : 'Criar Associado';
  await registrarAuditoria(acao, { 
    id: associado.id, 
    nome: associado.nome,
    dados_anteriores: existing,
    dados_novos: associado
  });
};

export const softDeleteAssociado = async (id: string, isOnline: boolean): Promise<void> => {
  if (isOnline) {
    let { error } = await supabase
      .from('associados')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.warn('Soft delete failed, trying hard delete...', error);
      const hardDelete = await supabase.from('associados').delete().eq('id', id);
      if (hardDelete.error) {
         console.warn('Hard delete also failed. Proceeding with IDB only.', hardDelete.error);
      }
    }
  } else {
    await addToSyncQueue({
      storeName: 'associados',
      action: 'delete',
      data: { id }
    });
  }

  await deleteFromIDB(STORE_NAME, id);
  await registrarAuditoria('Excluir Associado (Soft Delete)', { id });
};
export interface DocumentoAssociado {
  id: string;
  nome: string;
  url: string;
  tipo: string;
  tamanho: number;
  data_upload: string;
}
