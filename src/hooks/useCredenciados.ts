import { useState, useEffect, useCallback } from 'react';
import { generateUUID } from '../utils/uuid';
import { supabase } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { useAppContext } from '../context/AppContext';
import { Credenciado, CredenciadoInsert, CredenciadoUpdate, CredenciadoPlano, CredenciadoPlanoInsert, CredenciadoProcedimento, CredenciadoProcedimentoInsert, CredenciadoProcedimentoUpdate } from '../types/credenciados';

export function useCredenciados() {
  const [credenciados, setCredenciados] = useState<Credenciado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { state: { isOnline, empresaSelecionada } } = useAppContext();

  const carregarCredenciados = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (isOnline) {
        let query = supabase.from('credenciados').select('*');
        const { data, error: err } = await query.order('razao_social', { ascending: true });
        
        if (err) throw err;
        
        if (data) {
          for (const item of data) {
            await saveToIDB('credenciados', item);
          }
        }
        setCredenciados(data as Credenciado[] || []);
      } else {
        let idbData = await getAllFromIDB<Credenciado>('credenciados');
        idbData.sort((a, b) => a.razao_social.localeCompare(b.razao_social));
        setCredenciados(idbData);
      }
    } catch (err: any) {
      console.warn("Erro ao carregar credenciados:", err);
      try {
        let idbData = await getAllFromIDB<Credenciado>('credenciados');
        setCredenciados(idbData);
      } catch (idbErr) {
        setError('Erro ao carregar credenciados.');
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, empresaSelecionada]);

  useEffect(() => {
    carregarCredenciados();
  }, [carregarCredenciados]);

  const criar = async (data: CredenciadoInsert) => {
    try {
      const newItem = { 
        ...data, 
        id: generateUUID()
      };
      let inserted = newItem;
      if (isOnline) {
        const { data, error: err } = await supabase.from('credenciados').insert([newItem]).select().single();
        if (err) throw err;
        inserted = data;
      } else {
        await addToSyncQueue({ storeName: 'credenciados', action: 'insert', data: newItem });
      }
      await saveToIDB('credenciados', inserted);
      await carregarCredenciados();
    } catch (err: any) {
      console.error("Criar error:", JSON.stringify(err)); if (err.code === "23505") throw new Error("Já existe um credenciado com este CNPJ/CPF."); throw new Error(err.message ? err.message : JSON.stringify(err));
    }
  };

  const editar = async (id: string, data: CredenciadoUpdate) => {
    try {
      let updatedData = { ...data, updated_at: new Date().toISOString() };
      if (isOnline) {
        const { data: updated, error: err } = await supabase.from('credenciados').update(updatedData).eq('id', id).select().single();
        if (err) throw err;
        updatedData = updated;
      } else {
        await addToSyncQueue({ storeName: 'credenciados', action: 'update', data: { ...updatedData, id } });
      }
      const existing = await getFromIDB<Credenciado>('credenciados', id);
      if (existing) {
        await saveToIDB('credenciados', { ...existing, ...updatedData });
      }
      await carregarCredenciados();
    } catch (err: any) {
      console.error("Editar error:", JSON.stringify(err)); if (err.code === "23505") throw new Error("Já existe um credenciado com este CNPJ/CPF."); throw new Error(err.message ? err.message : JSON.stringify(err));
    }
  };

  const vincularPlano = async (data: CredenciadoPlanoInsert) => {
    try {
      try {
        const { error: err } = await supabase.from('credenciados_planos').insert([data]);
        if (err) throw err;
      } catch (err) {
        console.warn('Falha no Supabase ao vincular plano, prosseguindo', err);
      }
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao vincular plano.');
    }
  };


  const vincularProcedimento = async (data: CredenciadoProcedimentoInsert) => {
    try {
      const newItem: any = {
        id: generateUUID(),
        credenciado_id: data.credenciado_id,
        procedimento_id: data.procedimento_id,
        valor_exclusivo: data.valor_exclusivo ?? 0,
        valor_coparticipacao: data.valor_coparticipacao ?? 0,
        valor: data.valor_exclusivo ?? 0,
        created_at: new Date().toISOString()
      };

      if (isOnline) {
        try {
          const { data: inserted, error: err } = await supabase
            .from('credenciados_procedimentos')
            .upsert({
              id: newItem.id,
              credenciado_id: newItem.credenciado_id,
              procedimento_id: newItem.procedimento_id,
              valor_exclusivo: newItem.valor_exclusivo,
              valor_coparticipacao: newItem.valor_coparticipacao,
              valor: newItem.valor
            })
            .select()
            .single();

          if (err) {
            // Fallback se colunas valor_exclusivo / valor_coparticipacao não existirem na tabela
            const { data: insertedFallback, error: errFallback } = await supabase
              .from('credenciados_procedimentos')
              .upsert({
                id: newItem.id,
                credenciado_id: newItem.credenciado_id,
                procedimento_id: newItem.procedimento_id,
                valor: newItem.valor
              })
              .select()
              .single();

            if (errFallback) {
              console.warn('Falha no Supabase ao vincular procedimento (fallback):', errFallback);
            } else if (insertedFallback) {
              newItem.id = insertedFallback.id || newItem.id;
            }
          } else if (inserted) {
            newItem.id = inserted.id || newItem.id;
          }
        } catch (errSupabase) {
          console.warn('Falha no Supabase ao vincular procedimento, usando IDB:', errSupabase);
        }
      }

      await saveToIDB('credenciados_procedimentos', newItem);
    } catch (err: any) {
      console.error('Erro ao vincular procedimento:', err);
      throw new Error(err.message || 'Erro ao vincular procedimento.');
    }
  };

  const desvincularProcedimento = async (id: string) => {
    try {
      if (isOnline) {
        try {
          const { error: err } = await supabase.from('credenciados_procedimentos').delete().eq('id', id);
          if (err) console.warn('Falha no Supabase ao desvincular procedimento:', err);
        } catch (err) {
          console.warn('Falha no Supabase ao desvincular procedimento:', err);
        }
      }
      await deleteFromIDB('credenciados_procedimentos', id);
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao desvincular procedimento.');
    }
  };

  const atualizarValorProcedimento = async (id: string, data: CredenciadoProcedimentoUpdate) => {
    try {
      const payload: any = {
        ...data,
        valor: data.valor_exclusivo ?? (data as any).valor
      };

      if (isOnline) {
        try {
          const { error: err } = await supabase
            .from('credenciados_procedimentos')
            .update(payload)
            .eq('id', id);

          if (err) {
            await supabase
              .from('credenciados_procedimentos')
              .update({ valor: payload.valor })
              .eq('id', id);
          }
        } catch (err) {
          console.warn('Falha no Supabase ao atualizar valor de procedimento:', err);
        }
      }

      const existing = await getFromIDB<any>('credenciados_procedimentos', id);
      if (existing) {
        await saveToIDB('credenciados_procedimentos', { ...existing, ...payload });
      }
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao atualizar valor do procedimento.');
    }
  };

  const buscarProcedimentosVinculados = async (credenciadoId: string) => {
    try {
      let vinculadosRaw: any[] = [];

      if (isOnline) {
        try {
          const { data: supaData, error: err } = await supabase
            .from('credenciados_procedimentos')
            .select('*')
            .eq('credenciado_id', credenciadoId);

          if (!err && supaData && supaData.length > 0) {
            vinculadosRaw = supaData;
          }
        } catch (supaErr) {
          console.warn("Falha no supabase ao buscar procedimentos vinculados:", supaErr);
        }
      }

      // Se o Supabase não retornou registros, busca no IDB local
      if (vinculadosRaw.length === 0) {
        const allIDB = await getAllFromIDB<any>('credenciados_procedimentos');
        vinculadosRaw = allIDB.filter(v => v && v.credenciado_id === credenciadoId);
      }

      // Buscar todos os procedimentos para montar os metadados (código, descrição, etc.)
      let procedimentosList: any[] = [];
      try {
        if (isOnline) {
          const { data: procsSupa } = await supabase.from('procedimentos').select('*');
          if (procsSupa && procsSupa.length > 0) {
            procedimentosList = procsSupa;
            for (const p of procsSupa) {
              await saveToIDB('procedimentos', p);
            }
          }
        }
      } catch (pErr) {
        console.warn("Falha ao buscar procedimentos no Supabase para join:", pErr);
      }

      const procsIDB = await getAllFromIDB<any>('procedimentos');
      const procsMap = new Map<string, any>();
      procsIDB.forEach(p => { if (p?.id) procsMap.set(p.id, p); });
      procedimentosList.forEach(p => { if (p?.id) procsMap.set(p.id, p); });

      const finalData = vinculadosRaw.map(item => {
        const proc = procsMap.get(item.procedimento_id) || item.procedimentos || {
          id: item.procedimento_id,
          codigo_tuss: item.codigo_tuss || '',
          descricao: item.descricao || 'Procedimento',
          valor_padrao: item.valor ?? item.valor_exclusivo ?? 0,
          coparticipacao: item.valor_coparticipacao ?? 0
        };

        const valorExclusivo = item.valor_exclusivo ?? item.valor ?? item.valor_acordado ?? proc?.valor_padrao ?? 0;
        const valorCopart = item.valor_coparticipacao ?? item.valor_repasse ?? proc?.coparticipacao ?? 0;

        return {
          ...item,
          valor_exclusivo: valorExclusivo,
          valor_coparticipacao: valorCopart,
          valor: valorExclusivo,
          procedimentos: proc
        };
      });

      // Atualiza IDB com os dados enriquecidos
      for (const item of finalData) {
        await saveToIDB('credenciados_procedimentos', item);
      }

      return finalData;
    } catch (err: any) {
      console.warn("Erro em buscarProcedimentosVinculados:", err);
      return [];
    }
  };

  const buscarPlanosVinculados = async (credenciadoId: string) => {
    try {
      const { data, error: err } = await supabase
        .from('credenciados_planos')
        .select('*, planos_pax(nome, codigo)')
        .eq('credenciado_id', credenciadoId);
      if (err) throw err;
      return data;
    } catch (err: any) {
      console.warn(err);
      return [];
    }
  };

  return {
    credenciados,
    loading,
    error,
    criar,
    editar,
    vincularPlano,
    buscarPlanosVinculados,
    vincularProcedimento,
    desvincularProcedimento,
    atualizarValorProcedimento,
    buscarProcedimentosVinculados,
    recarregar: carregarCredenciados
  };
}
