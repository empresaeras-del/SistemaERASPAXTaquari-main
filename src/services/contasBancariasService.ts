import { ContaBancaria } from '../types/contasBancarias';
import { supabase } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';

const STORE_NAME = 'contas_bancarias';

const defaultContasBancarias: ContaBancaria[] = [
  {
    id: 'conta-1',
    tenant_id: 'empresa_padrao',
    nome: 'Itaú - Ag. 1234',
    banco: '341 - Itaú Unibanco S.A.',
    agencia: '1234',
    conta: '12345-6',
    status: 'ativo'
  },
  {
    id: 'conta-2',
    tenant_id: 'empresa_padrao',
    nome: 'Banco do Brasil - Ag. 5678',
    banco: '001 - Banco do Brasil S.A.',
    agencia: '5678',
    conta: '98765-4',
    status: 'ativo'
  }
];

export const getContasBancariasAtivas = async (tenantId: string, isOnline: boolean): Promise<ContaBancaria[]> => {
  try {
    const contas = await getAllFromIDB<ContaBancaria>(STORE_NAME);
    if (contas.length > 0) {
      return contas.filter(c => c.tenant_id === tenantId && c.status === 'ativo');
    } else {
      // If none, initialize defaults
      for (const conta of defaultContasBancarias) {
        await saveToIDB(STORE_NAME, conta);
      }
      return defaultContasBancarias.filter(c => c.tenant_id === tenantId && c.status === 'ativo');
    }
  } catch (error) {
    console.error("Erro ao buscar contas bancárias:", error);
    return defaultContasBancarias;
  }
};

export const getContasBancarias = async (tenantId: string, isOnline: boolean): Promise<ContaBancaria[]> => {
  try {
    const contas = await getAllFromIDB<ContaBancaria>(STORE_NAME);
    if (contas.length > 0) {
      return contas.filter(c => c.tenant_id === tenantId);
    } else {
      for (const conta of defaultContasBancarias) {
        await saveToIDB(STORE_NAME, conta);
      }
      return defaultContasBancarias.filter(c => c.tenant_id === tenantId);
    }
  } catch (error) {
    console.error("Erro ao buscar contas bancárias:", error);
    return [];
  }
};

export const salvarContaBancaria = async (isOnline: boolean, conta: ContaBancaria): Promise<void> => {
  if (isOnline) {
    // Optionally sync with Supabase if it exists
    try {
      const { error } = await supabase.from('contas_bancarias').upsert(conta);
      if (error) console.warn('Supabase update conta_bancaria error:', error);
    } catch (e) {
      console.warn('Supabase update error:', e);
    }
  }
  await saveToIDB(STORE_NAME, conta);
};

export const deletarContaBancaria = async (isOnline: boolean, id: string): Promise<void> => {
  if (isOnline) {
    try {
      const { error } = await supabase.from('contas_bancarias').delete().eq('id', id);
      if (error) console.warn('Supabase delete conta_bancaria error:', error);
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
  }
  await deleteFromIDB(STORE_NAME, id);
};
