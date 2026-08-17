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
      const newItem = { ...data, id: generateUUID(), created_at: new Date().toISOString() };
      try {
        const { data: inserted, error: err } = await supabase.from('credenciados_procedimentos').insert([newItem]).select().single();
        if (err) throw err;
        await saveToIDB('credenciados_procedimentos', inserted);
      } catch (err) {
        console.warn('Falha no Supabase ao vincular procedimento, salvando no IDB', err);
        await saveToIDB('credenciados_procedimentos', newItem);
      }
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao vincular procedimento.');
    }
  };

  const desvincularProcedimento = async (id: string) => {
    try {
      try {
        const { error: err } = await supabase.from('credenciados_procedimentos').delete().eq('id', id);
        if (err) throw err;
      } catch (err) {
        console.warn('Falha no Supabase ao desvincular procedimento, removendo do IDB', err);
      }
      await deleteFromIDB('credenciados_procedimentos', id);
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao desvincular procedimento.');
    }
  };

  const atualizarValorProcedimento = async (id: string, data: CredenciadoProcedimentoUpdate) => {
    try {
      try {
        const { data: updated, error: err } = await supabase.from('credenciados_procedimentos').update(data).eq('id', id).select().single();
        if (err) throw err;
        await saveToIDB('credenciados_procedimentos', updated);
      } catch (err) {
        console.warn('Falha no Supabase ao atualizar valor de procedimento, atualizando IDB', err);
        const existing = await getFromIDB<any>('credenciados_procedimentos', id);
        if (existing) {
          await saveToIDB('credenciados_procedimentos', { ...existing, ...data });
        }
      }
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao atualizar valor do procedimento.');
    }
  };

  const buscarProcedimentosVinculados = async (credenciadoId: string) => {
    try {
      let data = [];
      try {
        const { data: supaData, error: err } = await supabase
          .from('credenciados_procedimentos')
          .select('*, procedimentos(*)')
          .eq('credenciado_id', credenciadoId);
        if (err) throw err;
        data = supaData || [];
        
        // Sincronizar IDB
        for (const item of data) {
          await saveToIDB('credenciados_procedimentos', item);
        }
      } catch (supaErr) {
        console.warn("Falha no supabase, buscando no IDB", supaErr);
        const all = await getAllFromIDB<any>('credenciados_procedimentos');
        const procedimentos = await getAllFromIDB<any>('procedimentos');
        
        data = all.filter(v => v.credenciado_id === credenciadoId).map(v => ({
          ...v,
          procedimentos: procedimentos.find(p => p.id === v.procedimento_id)
        }));
      }
      return data;
    } catch (err: any) {
      console.warn(err);
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
