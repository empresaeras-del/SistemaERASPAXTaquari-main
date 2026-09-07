import { supabase } from '../lib/supabase';
import { getFromIDB } from '../lib/idb';
import { Credenciado } from '../types/credenciados';

export async function getCredenciadoById(id: string, isOnline: boolean = true): Promise<Credenciado | null> {
  if (isOnline) {
    try {
      const { data, error } = await supabase
        .from('credenciados')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      return data as Credenciado;
    } catch (err) {
      console.warn('Erro ao buscar credenciado online, tentando offline:', err);
      // Fallback for IDB
    }
  }

  try {
    const cred = await getFromIDB<Credenciado>('credenciados', id);
    return cred || null;
  } catch (err) {
    console.warn('Erro ao buscar credenciado offline:', err);
    return null;
  }
}
