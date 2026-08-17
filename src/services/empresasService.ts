import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';

export interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  email: string;
  telefone: string;
  endereco: string;
  logo_url?: string;
  assinatura_url?: string;
  status: 'ativo' | 'inativo';
  chave_pix?: string;
  cidade_pix?: string;
  created_at?: string;
}

const STORE_NAME = 'empresas';


export const getEmpresaById = async (id: string | undefined | null, isOnline: boolean): Promise<Empresa | null> => {
  if (!id || id === 'default_tenant' || id === 'all') return null;
  if (isOnline) {
    try {
      const { data, error } = await supabase.from('tenants').select('*').eq('id', id).single();
      if (error) throw error;
      if (data) {
        await saveToIDB(STORE_NAME, data);
        return data as Empresa;
      }
    } catch (err) {
      
    }
  }
  const localData = await getFromIDB(STORE_NAME, id);
  return localData as Empresa || null;
};

export const getEmpresas = async (isOnline: boolean): Promise<Empresa[]> => {
  if (isOnline) {
    try {
      const { data, error } = await supabase.from('tenants').select('*').is('deleted_at', null);
      if (error) throw error;
      
      // Update local cache
      if (data) {
        for (const item of data) {
          await saveToIDB(STORE_NAME, item);
        }
      }
      return data || [];
    } catch (error) {
      console.warn('Supabase fetch failed (likely not configured), falling back to IDB.');
      return await getAllFromIDB<Empresa>(STORE_NAME);
    }
  } else {
    return await getAllFromIDB<Empresa>(STORE_NAME);
  }
};

export const saveEmpresa = async (empresa: Empresa, isOnline: boolean): Promise<void> => {
  if (!isOnline) {
    throw new Error('Não é possível salvar enquanto estiver offline.');
  }

  try {
    const { error } = await supabase.from('tenants').upsert(empresa);
    if (error) {
      console.warn('Supabase save failed (likely not configured), proceeding with IDB only.', error);
    }
  } catch (err) {
    console.warn('Supabase save threw error, proceeding with IDB only.', err);
  }

  // Sincroniza IDB pós-escrita
  await saveToIDB(STORE_NAME, empresa);
  await registrarAuditoria('Salvar Empresa', { id: empresa.id, nome_fantasia: empresa.nome_fantasia });
};

export const deleteEmpresa = async (id: string, isOnline: boolean): Promise<void> => {
  if (!isOnline) {
    throw new Error('Não é possível excluir enquanto estiver offline.');
  }

  const { error } = await supabase
    .from('tenants')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
     console.warn('Supabase delete failed (likely not configured), proceeding with IDB only.');
  }

  await deleteFromIDB(STORE_NAME, id);
  await registrarAuditoria('Excluir Empresa (Soft Delete)', { id });
};

export const uploadArquivo = async (file: File, path: string): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from('tenants_assets')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const { data: publicData } = supabase.storage
      .from('tenants_assets')
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  } catch (error) {
    console.warn('Falha no upload (Supabase), usando fallback local:', error);
    // Fallback para string base64 se o supabase falhar (ex: placeholder)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo local'));
      reader.readAsDataURL(file);
    });
  }
};
