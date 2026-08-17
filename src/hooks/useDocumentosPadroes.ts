import { useState, useEffect, useCallback } from 'react';
import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { useAppContext } from '../context/AppContext';
import { DocumentoPadrao, DocumentoPadraoInsert, DocumentoPadraoUpdate } from '../types/documentos';

export function useDocumentosPadroes() {
  const [documentos, setDocumentos] = useState<DocumentoPadrao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { state: { isOnline, empresaSelecionada } } = useAppContext();

  const carregarDocumentos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isOnline) {
        let query = supabase.from('documentos_padroes').select('*');
        if (empresaSelecionada && empresaSelecionada !== 'all') {
          query = query.eq('empresa_id', empresaSelecionada);
        }
        const { data, error: err } = await query.order('nome', { ascending: true });
        
        if (err) console.warn("Supabase query error.", err);
        
        if (data) {
          for (const item of data) {
            await saveToIDB('documentos_padroes', item);
          }
        }
        setDocumentos(data as DocumentoPadrao[] || []);
      } else {
        let idbData = await getAllFromIDB<DocumentoPadrao>('documentos_padroes');
        if (empresaSelecionada && empresaSelecionada !== 'all') {
          idbData = idbData.filter(d => d.empresa_id === empresaSelecionada);
        }
        idbData.sort((a, b) => a.nome.localeCompare(b.nome));
        setDocumentos(idbData);
      }
    } catch (err: any) {
      console.warn("Erro ao carregar documentos:", err);
      try {
        let idbData = await getAllFromIDB<DocumentoPadrao>('documentos_padroes');
        if (empresaSelecionada && empresaSelecionada !== 'all') {
          idbData = idbData.filter(d => d.empresa_id === empresaSelecionada);
        }
        setDocumentos(idbData);
      } catch (idbErr) {
        setError('Erro ao carregar documentos.');
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, empresaSelecionada]);

  useEffect(() => {
    carregarDocumentos();
  }, [carregarDocumentos]);

  const criar = async (data: DocumentoPadraoInsert) => {
    try {
      const newItem = { 
        ...data, 
        id: crypto.randomUUID(),
        empresa_id: data.empresa_id || (empresaSelecionada && empresaSelecionada !== 'all' ? empresaSelecionada : 'emp-001')
      };
      
      if (isOnline) {
        try {
          const { data: inserted, error: err } = await supabase.from('documentos_padroes').insert([newItem]).select().single();
          if (err) throw err;
          await saveToIDB('documentos_padroes', inserted);
        } catch (e) {
          console.warn('Supabase insert failed, saving to IDB only.');
          await saveToIDB('documentos_padroes', newItem);
        }
      } else {
        await saveToIDB('documentos_padroes', newItem);
      }
      
      await carregarDocumentos();
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao criar documento.');
    }
  };

  const editar = async (id: string, data: DocumentoPadraoUpdate) => {
    try {
      const existing = await getFromIDB<DocumentoPadrao>('documentos_padroes', id);
      let finalData = { ...existing, ...data };
      
      if (isOnline) {
        try {
          const { data: updated, error: err } = await supabase.from('documentos_padroes').update(data).eq('id', id).select().single();
          if (err) throw err;
          finalData = updated;
          await saveToIDB('documentos_padroes', updated);
        } catch (e) {
          console.warn('Supabase update failed, attempting IDB update.');
          if (existing) await saveToIDB('documentos_padroes', finalData);
        }
      } else {
        if (existing) await saveToIDB('documentos_padroes', finalData);
      }
      
      try {
        await registrarAuditoria('Editar Documento', { 
          id, 
          nome: data.nome || existing?.nome,
          dados_anteriores: existing,
          dados_novos: finalData
        });
      } catch (e) {}
      
      await carregarDocumentos();
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao atualizar documento.');
    }
  };

  const uploadArquivo = async (file: File) => {
    try {
      if (!isOnline) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Falha ao ler arquivo local'));
          reader.readAsDataURL(file);
        });
      }
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `documentos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('arquivos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('arquivos').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      console.warn("Falha no upload online, convertendo para Base64.");
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Falha ao ler arquivo local'));
        reader.readAsDataURL(file);
      });
    }
  };

  const excluir = async (id: string) => {
    try {
      if (isOnline) {
        const { error: err } = await supabase.from('documentos_padroes').delete().eq('id', id);
        if (err) console.warn("Supabase delete failed, attempting IDB delete.", err);
      }
      await deleteFromIDB('documentos_padroes', id);
      await carregarDocumentos();
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao excluir documento.');
    }
  };

  return {
    documentos,
    loading,
    error,
    criar,
    editar,
    excluir,
    uploadArquivo,
    recarregar: carregarDocumentos
  };
}
