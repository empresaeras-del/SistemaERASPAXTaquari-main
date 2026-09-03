import { useState, useEffect, useCallback } from 'react';
import { generateUUID } from '../utils/uuid';
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
        let query = supabase.from('documentos_padroes').select('*').is('deleted_at', null);
        if (empresaSelecionada && empresaSelecionada !== 'all') {
          query = query.or(`empresa_id.eq.${empresaSelecionada},tenant_id.eq.${empresaSelecionada}`);
        }
        const { data, error: err } = await query.order('nome', { ascending: true });
        
        if (err) {
          console.warn("Supabase query error documentos_padroes:", err);
        } else if (data) {
          const docsFormatados = data.map(item => ({
            ...item,
            conteudo: item.conteudo || item.conteudo_html || '',
            criado_em: item.criado_em || item.created_at,
            atualizado_em: item.atualizado_em || item.updated_at,
            empresa_id: item.empresa_id || item.tenant_id
          }));

          for (const doc of docsFormatados) {
            await saveToIDB('documentos_padroes', doc);
          }
          setDocumentos(docsFormatados as DocumentoPadrao[]);
          return;
        }
      }
      
      let idbData = await getAllFromIDB<DocumentoPadrao>('documentos_padroes');
      if (empresaSelecionada && empresaSelecionada !== 'all') {
        idbData = idbData.filter(d => d.empresa_id === empresaSelecionada || (d as any).tenant_id === empresaSelecionada);
      }
      idbData = idbData.filter(d => !(d as any).deleted_at);
      idbData.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setDocumentos(idbData);
    } catch (err: any) {
      console.warn("Erro ao carregar documentos:", err);
      try {
        let idbData = await getAllFromIDB<DocumentoPadrao>('documentos_padroes');
        if (empresaSelecionada && empresaSelecionada !== 'all') {
          idbData = idbData.filter(d => d.empresa_id === empresaSelecionada || (d as any).tenant_id === empresaSelecionada);
        }
        idbData = idbData.filter(d => !(d as any).deleted_at);
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
      const now = new Date().toISOString();
      const tenantId = data.empresa_id || (empresaSelecionada && empresaSelecionada !== 'all' ? empresaSelecionada : 'emp-001');
      const docId = data.id || generateUUID();

      const docPayload = {
        id: docId,
        nome: data.nome,
        descricao: data.descricao || null,
        tipo: data.tipo,
        conteudo: data.conteudo || '',
        conteudo_html: data.conteudo || '',
        arquivo_url: data.arquivo_url || null,
        assinatura_pos_x: data.assinatura_pos_x ?? null,
        assinatura_pos_y: data.assinatura_pos_y ?? null,
        ativo: data.ativo !== undefined ? data.ativo : true,
        empresa_id: tenantId,
        tenant_id: tenantId,
        created_at: now,
        updated_at: now,
        criado_em: now,
        atualizado_em: now
      };
      
      if (isOnline) {
        const inserted = null;
        const payloadToTry: any = { ...docPayload };

        let { data: resData, error: err } = await supabase
          .from('documentos_padroes')
          .insert([payloadToTry])
          .select()
          .single();

        // Se uma coluna específica não existir no cache do PostgREST, remove e retenta
        if (err && err.code === 'PGRST204') {
          if (err.message.includes('descricao')) {
            delete payloadToTry.descricao;
          }
          if (err.message.includes('conteudo_html')) {
            delete payloadToTry.conteudo_html;
          }
          if (err.message.includes('criado_em')) {
            delete payloadToTry.criado_em;
            delete payloadToTry.atualizado_em;
          }
          if (err.message.includes('assinatura_pos')) {
            delete payloadToTry.assinatura_pos_x;
            delete payloadToTry.assinatura_pos_y;
          }
          const retryRes = await supabase
            .from('documentos_padroes')
            .insert([payloadToTry])
            .select()
            .single();
          resData = retryRes.data;
          err = retryRes.error;
        }

        if (err) {
          console.error('Erro ao inserir modelo de documento no Supabase:', err);
          throw new Error(`Erro ao salvar modelo no banco: ${err.message}`);
        }
        if (resData) {
          const formatted = {
            ...docPayload,
            ...resData,
            conteudo: resData.conteudo || resData.conteudo_html || docPayload.conteudo
          };
          await saveToIDB('documentos_padroes', formatted);
          await registrarAuditoria('Criar Modelo Documento', { id: docId, nome: data.nome });
          await carregarDocumentos();
          return formatted;
        }
      }

      await saveToIDB('documentos_padroes', docPayload);
      await carregarDocumentos();
      return docPayload;
    } catch (err: any) {
      if (err instanceof Error) throw err;
      throw new Error(err.message || 'Erro ao criar documento.');
    }
  };

  const editar = async (id: string, data: DocumentoPadraoUpdate) => {
    try {
      const now = new Date().toISOString();
      const existing = await getFromIDB<DocumentoPadrao>('documentos_padroes', id);
      const tenantId = data.empresa_id || existing?.empresa_id || (empresaSelecionada && empresaSelecionada !== 'all' ? empresaSelecionada : 'emp-001');

      const updatePayload: any = {
        ...data,
        empresa_id: tenantId,
        tenant_id: tenantId,
        updated_at: now,
        atualizado_em: now
      };

      if (data.conteudo !== undefined) {
        updatePayload.conteudo = data.conteudo;
        updatePayload.conteudo_html = data.conteudo;
      }

      if (isOnline) {
        const payloadToTry: any = { ...updatePayload };
        let { data: updated, error: err } = await supabase
          .from('documentos_padroes')
          .update(payloadToTry)
          .eq('id', id)
          .select()
          .single();

        if (err && err.code === 'PGRST204') {
          if (err.message.includes('descricao')) {
            delete payloadToTry.descricao;
          }
          if (err.message.includes('conteudo_html')) {
            delete payloadToTry.conteudo_html;
          }
          if (err.message.includes('atualizado_em')) {
            delete payloadToTry.atualizado_em;
            delete payloadToTry.criado_em;
          }
          if (err.message.includes('assinatura_pos')) {
            delete payloadToTry.assinatura_pos_x;
            delete payloadToTry.assinatura_pos_y;
          }
          const retryRes = await supabase
            .from('documentos_padroes')
            .update(payloadToTry)
            .eq('id', id)
            .select()
            .single();
          updated = retryRes.data;
          err = retryRes.error;
        }

        if (err) {
          console.error('Erro ao atualizar modelo de documento no Supabase:', err);
          throw new Error(`Erro ao atualizar modelo no banco: ${err.message}`);
        }
        if (updated) {
          const formatted = {
            ...existing,
            ...updated,
            conteudo: updated.conteudo || updated.conteudo_html || updatePayload.conteudo
          };
          await saveToIDB('documentos_padroes', formatted);
          await registrarAuditoria('Editar Modelo Documento', { id, nome: data.nome || existing?.nome });
          await carregarDocumentos();
          return formatted;
        }
      }

      const finalData = { ...existing, ...updatePayload };
      await saveToIDB('documentos_padroes', finalData);
      await carregarDocumentos();
      return finalData;
    } catch (err: any) {
      if (err instanceof Error) throw err;
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
        const { error: err } = await supabase
          .from('documentos_padroes')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);

        if (err) {
          // Tentar delete físico se soft-delete falhar
          await supabase.from('documentos_padroes').delete().eq('id', id);
        }
        await registrarAuditoria('Excluir Modelo Documento', { id });
      }
      await deleteFromIDB('documentos_padroes', id);
      await carregarDocumentos();
    } catch (err: any) {
      if (err instanceof Error) throw err;
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
