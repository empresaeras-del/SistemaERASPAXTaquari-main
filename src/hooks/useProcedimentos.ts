import { useState, useEffect, useCallback } from 'react';
import { generateUUID } from '../utils/uuid';
import { supabase } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Procedimento, ProcedimentoInsert, ProcedimentoUpdate } from '../types/procedimentos';
import { registrarAuditoria } from '../lib/supabase';

export function useProcedimentos() {
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { state: { isOnline, empresaSelecionada } } = useAppContext();
  const { user } = useAuth();

  // Retorna o tenant_id efetivo: para não-super_admin usa sempre o tenant do usuário
  const getTenantId = useCallback((): string | null => {
    if (user?.nivel === 'super_admin') return empresaSelecionada;
    return user?.tenant_id || empresaSelecionada;
  }, [user, empresaSelecionada]);

  const carregarProcedimentos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const tenantId = getTenantId();
      const isSuperAdmin = user?.nivel === 'super_admin';

      if (isOnline) {
        let query = supabase.from('procedimentos').select('*');
        // Filtra por tenant: super_admin verá todos se nenhuma empresa estiver selecionada
        if (!isSuperAdmin && tenantId) {
          query = query.or(`tenant_id.eq.${tenantId},empresa_id.eq.${tenantId}`);
        } else if (isSuperAdmin && tenantId && tenantId !== 'all') {
          query = query.or(`tenant_id.eq.${tenantId},empresa_id.eq.${tenantId}`);
        }
        const { data, error: err } = await query.order('descricao', { ascending: true });
        if (err) throw err;
        if (data) {
          for (const item of data) {
            await saveToIDB('procedimentos', item);
          }
        }
        setProcedimentos(data as Procedimento[] || []);
      } else {
        let idbData = await getAllFromIDB<Procedimento>('procedimentos');
        if (tenantId && tenantId !== 'all') {
          idbData = idbData.filter(d =>
            (d as any).empresa_id === tenantId ||
            (d as any).tenant_id === tenantId
          );
        }
        idbData.sort((a, b) => a.descricao.localeCompare(b.descricao));
        setProcedimentos(idbData);
      }
    } catch (err: any) {
      console.warn("Erro ao carregar procedimentos:", err);
      try {
        const tenantId = getTenantId();
        let idbData = await getAllFromIDB<Procedimento>('procedimentos');
        if (tenantId && tenantId !== 'all') {
          idbData = idbData.filter(d =>
            (d as any).empresa_id === tenantId ||
            (d as any).tenant_id === tenantId
          );
        }
        setProcedimentos(idbData);
      } catch (idbErr) {
        setError('Erro ao carregar procedimentos.');
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, empresaSelecionada, getTenantId, user]);

  useEffect(() => {
    carregarProcedimentos();
  }, [carregarProcedimentos]);

  const criar = async (data: ProcedimentoInsert) => {
    try {
      const tenantId = getTenantId();
      const newItem = {
        ...data,
        id: data.id || generateUUID(),
        tenant_id: tenantId || data.tenant_id,
        empresa_id: tenantId || data.empresa_id,
      };
      const { data: inserted, error: err } = await supabase
        .from('procedimentos')
        .insert([newItem])
        .select()
        .single();
      if (err) {
        console.warn('Supabase insert failed, saving to IDB only.', err);
        await saveToIDB('procedimentos', newItem);
      } else {
        await saveToIDB('procedimentos', inserted);
      }
      await registrarAuditoria('Criar Procedimento', { id: newItem.id, descricao: newItem.descricao });
      await carregarProcedimentos();
    } catch (err: any) {
      console.error('Error in criar:', err);
      throw new Error(err?.message || 'Erro ao criar procedimento.');
    }
  };

  const editar = async (id: string, data: ProcedimentoUpdate) => {
    try {
      const existing = await getFromIDB<Procedimento>('procedimentos', id);
      const tenantId =
        (data as any).tenant_id ||
        (existing as any)?.tenant_id ||
        getTenantId();
      const payload = {
        ...data,
        tenant_id: tenantId,
        empresa_id: tenantId,
      };
      const { data: updated, error: err } = await supabase
        .from('procedimentos')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (err) {
        console.warn('Supabase update failed, attempting IDB update.', err);
        if (existing) {
          await saveToIDB('procedimentos', { ...existing, ...payload });
        }
      } else {
        await saveToIDB('procedimentos', updated);
      }
      await registrarAuditoria('Editar Procedimento', { id, descricao: data.descricao });
      await carregarProcedimentos();
    } catch (err: any) {
      console.error('Error in editar:', err);
      throw new Error(err?.message || 'Erro ao atualizar procedimento.');
    }
  };

    const excluir = async (id: string) => {
    try {
      // Regra Global: Não permitir exclusão se estiver vinculado a credenciados ou requisições
      const credenciados = await getAllFromIDB<any>('credenciados_procedimentos');
      if (credenciados.some(c => c.procedimento_id === id)) {
        throw new Error('Não é possível excluir: Procedimento vinculado a um ou mais credenciados.');
      }
      
      const requisicoes = await getAllFromIDB<any>('requisicoes');
      if (requisicoes.some(r => r.itens && r.itens.some((i: any) => i.procedimento_id === id))) {
        throw new Error('Não é possível excluir: Procedimento vinculado a uma ou mais requisições.');
      }

      if (isOnline) {
        // Also check Supabase if online just to be sure, though IDB should have it if it was synced
        const { count: credCount } = await supabase.from('credenciados_procedimentos').select('*', { count: 'exact', head: true }).eq('procedimento_id', id);
        if (credCount && credCount > 0) {
          throw new Error('Não é possível excluir: Procedimento vinculado a um ou mais credenciados.');
        }
        
        const { count: reqCount } = await supabase.from('requisicao_itens').select('*', { count: 'exact', head: true }).eq('procedimento_id', id);
        if (reqCount && reqCount > 0) {
          throw new Error('Não é possível excluir: Procedimento vinculado a uma ou mais requisições.');
        }
      }

      const { error: err } = await supabase.from('procedimentos').delete().eq('id', id);
      if (err) {
        console.warn('Supabase delete failed, attempting IDB delete.', err);
      }
      await deleteFromIDB('procedimentos', id);
      await registrarAuditoria('Excluir Procedimento', { id });
      await carregarProcedimentos();
    } catch (err: any) {
      // Validation errors are expected, just pass them
      if (!err?.message?.includes('Não é possível excluir')) {
        console.error('Error in excluir:', err);
      }
      throw new Error(err?.message || 'Erro ao excluir procedimento.');
    }
  };

  return {
    procedimentos,
    loading,
    error,
    criar,
    editar,
    excluir,
    recarregar: carregarProcedimentos
  };
}
