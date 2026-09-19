import { useState, useEffect, useCallback } from 'react';
import { generateUUID } from '../utils/uuid';
import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { useAppContext } from '../context/AppContext';
import { DocumentoPadrao, DocumentoPadraoInsert, DocumentoPadraoUpdate } from '../types/documentos';
import { RecusaDoServidor, explicarRecusa } from '../utils/recusaDoServidor';

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
        arquivo_url: data.arquivo_url || null,
        cabecalho_html: data.cabecalho_html || null,
        rodape_html: data.rodape_html || null,
        margens: data.margens || null,
        orientacao: data.orientacao || 'retrato',
        tamanho_papel: data.tamanho_papel || 'a4',
        padrao: data.padrao !== undefined ? data.padrao : false,
        variaveis_disponiveis: data.variaveis_disponiveis || [],
        assinatura_config: data.assinatura_config || null,
        ativo: data.ativo !== undefined ? data.ativo : true,
        empresa_id: tenantId,
        tenant_id: tenantId,
        criado_em: now,
        atualizado_em: now
      };

      if (isOnline) {
        // Uma tentativa, um payload. Até 19/09/2026 este bloco respondia ao `PGRST204`
        // **apagando a coluna que faltava e reinserindo**, até 12 vezes: o documento era
        // gravado sem o campo, a tela dizia "salvo com sucesso" e o dado do usuário sumia
        // sem erro nenhum — é este arquivo que o CLAUDE.md cita ao descrever essa perda.
        // Um retry que muda o dado enviado não é tolerância a falha: é corromper o registro
        // para conseguir gravá-lo. O `PGRST204` é justamente o único sinal de que falta uma
        // migration, e engoli-lo escondia o defeito seguinte.
        const { data: resData, error: err } = await supabase
          .from('documentos_padroes')
          .insert([docPayload])
          .select()
          .single();

        if (err) {
          console.error('Erro ao inserir modelo de documento no Supabase:', err);
          throw new RecusaDoServidor(explicarRecusa('documentos_padroes', err));
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
        atualizado_em: now
      };

      if (data.conteudo !== undefined) {
        updatePayload.conteudo = data.conteudo;
      }

      if (isOnline) {
        // Uma tentativa, um payload — ver a nota em `criar`. Aqui o campo em risco é o
        // `conteudo`: o modelo inteiro que o operador acabou de reescrever.
        const { data: updated, error: err } = await supabase
          .from('documentos_padroes')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();

        if (err) {
          console.error('Erro ao atualizar modelo de documento no Supabase:', err);
          throw new RecusaDoServidor(explicarRecusa('documentos_padroes', err));
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
