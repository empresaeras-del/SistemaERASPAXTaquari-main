import { useState, useEffect, useCallback } from 'react';
import { generateUUID } from '../utils/uuid';
import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { RecusaDoServidor, explicarRecusa } from '../utils/recusaDoServidor';
import { Credenciado, CredenciadoInsert, CredenciadoUpdate, CredenciadoPlano, CredenciadoPlanoInsert, CredenciadoProcedimento, CredenciadoProcedimentoInsert, CredenciadoProcedimentoUpdate } from '../types/credenciados';

export function useCredenciados() {
  const [credenciados, setCredenciados] = useState<Credenciado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { state: { isOnline, empresaSelecionada } } = useAppContext();
  const { user } = useAuth();

  // Retorna o tenant_id efetivo: para não-super_admin usa sempre o tenant do usuário
  const getTenantId = useCallback((): string | null => {
    if (user?.nivel === 'super_admin') return empresaSelecionada;
    return user?.tenant_id || empresaSelecionada;
  }, [user, empresaSelecionada]);

  const carregarCredenciados = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const tenantId = getTenantId();
      const isSuperAdmin = user?.nivel === 'super_admin';

      if (isOnline) {
        let query = supabase
          .from('credenciados')
          .select('*')
          .is('deleted_at', null);

        // Filtra por tenant: super_admin pode ver todos ou só o selecionado
        if (!isSuperAdmin && tenantId) {
          query = query.or(`tenant_id.eq.${tenantId},empresa_id.eq.${tenantId}`);
        } else if (isSuperAdmin && tenantId && tenantId !== 'all') {
          query = query.or(`tenant_id.eq.${tenantId},empresa_id.eq.${tenantId}`);
        }

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
        // Filtragem local pelo tenant
        if (tenantId && tenantId !== 'all') {
          idbData = idbData.filter(c =>
            (c as any).tenant_id === tenantId ||
            (c as any).empresa_id === tenantId
          );
        }
        idbData = idbData.filter(c => !(c as any).deleted_at);
        idbData.sort((a, b) => a.razao_social.localeCompare(b.razao_social));
        setCredenciados(idbData);
      }
    } catch (err: any) {
      console.warn("Erro ao carregar credenciados:", err);
      try {
        const tenantId = getTenantId();
        let idbData = await getAllFromIDB<Credenciado>('credenciados');
        if (tenantId && tenantId !== 'all') {
          idbData = idbData.filter(c =>
            (c as any).tenant_id === tenantId ||
            (c as any).empresa_id === tenantId
          );
        }
        setCredenciados(idbData);
      } catch (idbErr) {
        setError('Erro ao carregar credenciados.');
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, empresaSelecionada, getTenantId, user]);

  useEffect(() => {
    carregarCredenciados();
  }, [carregarCredenciados]);

  const criar = async (data: CredenciadoInsert) => {
    try {
      // Garante que tenant_id seja sempre o do usuário logado (nunca vazio)
      const tenantId = getTenantId();
      const newItem = {
        ...data,
        id: generateUUID(),
        tenant_id: tenantId || data.tenant_id,
        empresa_id: tenantId || data.empresa_id,
      };
      let inserted = newItem;
      if (isOnline) {
        const { data: dbData, error: err } = await supabase
          .from('credenciados')
          .insert([newItem])
          .select()
          .single();
        if (err) throw err;
        inserted = dbData;
      } else {
        await addToSyncQueue({ storeName: 'credenciados', action: 'insert', data: newItem });
      }
      await saveToIDB('credenciados', inserted);
      await carregarCredenciados();
    } catch (err: any) {
      console.error("Criar error:", JSON.stringify(err));
      if (err.code === "23505") throw new Error("Já existe um credenciado com este CNPJ/CPF nesta empresa.");
      throw new Error(err.message ? err.message : JSON.stringify(err));
    }
  };

  const editar = async (id: string, data: CredenciadoUpdate) => {
    try {
      // Preserva o tenant_id existente; preenche com o do usuário se ausente
      const existing = await getFromIDB<Credenciado>('credenciados', id);
      const tenantId =
        (data as any).tenant_id ||
        (existing as any)?.tenant_id ||
        getTenantId();
      let updatedData = {
        ...data,
        tenant_id: tenantId,
        empresa_id: tenantId,
        updated_at: new Date().toISOString(),
      };
      if (isOnline) {
        const { data: updated, error: err } = await supabase
          .from('credenciados')
          .update(updatedData)
          .eq('id', id)
          .select()
          .single();
        if (err) throw err;
        updatedData = updated;
      } else {
        await addToSyncQueue({ storeName: 'credenciados', action: 'update', data: { ...updatedData, id } });
      }
      if (existing) {
        await saveToIDB('credenciados', { ...existing, ...updatedData });
      }
      await carregarCredenciados();
    } catch (err: any) {
      console.error("Editar error:", JSON.stringify(err));
      if (err.code === "23505") throw new Error("Já existe um credenciado com este CNPJ/CPF nesta empresa.");
      throw new Error(err.message ? err.message : JSON.stringify(err));
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


  /**
   * O valor exclusivo do procedimento é gravado em `valor`, que é a coluna canônica do preço —
   * NÃO existe `valor_exclusivo` no banco, e criá-la reintroduziria o par de colunas duplicadas
   * que a migration `20260915132838` eliminou. A co-participação ganhou coluna própria em
   * `20260920141609`; até lá ela era enviada, recusada com `PGRST204` em toda gravação, e o
   * "fallback" reenviava sem ela — o valor digitado pelo operador ficava só no IndexedDB dele.
   */
  const vincularProcedimento = async (data: CredenciadoProcedimentoInsert) => {
    try {
      const allIDB = await getAllFromIDB<any>('credenciados_procedimentos');
      const existingInIDB = allIDB.find(
        v => v && v.credenciado_id === data.credenciado_id && v.procedimento_id === data.procedimento_id
      );

      const itemId = existingInIDB?.id || generateUUID();
      const newItem: any = {
        id: itemId,
        credenciado_id: data.credenciado_id,
        procedimento_id: data.procedimento_id,
        // `existingInIDB?.valor_exclusivo` só aparece em cache gravado antes desta correção.
        valor: data.valor_exclusivo ?? existingInIDB?.valor ?? existingInIDB?.valor_exclusivo ?? 0,
        valor_coparticipacao: data.valor_coparticipacao ?? existingInIDB?.valor_coparticipacao ?? 0,
        created_at: existingInIDB?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let aceito = false;

      if (isOnline) {
        // Recusa do servidor e queda de rede não podem terminar igual: `error` devolvido é
        // recusa (repetir amanhã com o mesmo payload dá o mesmo resultado, então lança e não
        // enfileira); exceção lançada é rede fora, e aí vale o caminho offline-first.
        let recusa: any = null;
        try {
          const { data: inserted, error: err } = await supabase
            .from('credenciados_procedimentos')
            .upsert(
              {
                id: newItem.id,
                credenciado_id: newItem.credenciado_id,
                procedimento_id: newItem.procedimento_id,
                valor: newItem.valor,
                valor_coparticipacao: newItem.valor_coparticipacao
              },
              { onConflict: 'credenciado_id,procedimento_id' }
            )
            .select()
            .single();

          if (err) {
            recusa = err;
          } else {
            if (inserted) newItem.id = inserted.id || newItem.id;
            aceito = true;
          }
        } catch (errSupabase) {
          console.warn('Sem rede ao vincular procedimento, mantendo no IDB e enfileirando:', errSupabase);
        }

        // Relançada FORA do try, senão cairia no próprio catch que trata rede.
        if (recusa) {
          console.error('O servidor recusou o vínculo do procedimento:', recusa);
          throw new RecusaDoServidor(explicarRecusa('credenciados_procedimentos', recusa));
        }
      }

      await saveToIDB('credenciados_procedimentos', newItem);
      if (!aceito) {
        await addToSyncQueue({ storeName: 'credenciados_procedimentos', action: 'insert', data: newItem });
      }
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
      // `valor_exclusivo` não é coluna: ele vira `valor`, e sai do payload em vez de ser
      // enviado para levar `PGRST204` e disparar um reenvio que descarta a co-participação.
      const { valor_exclusivo, ...resto } = data as any;
      const payload: any = {
        ...resto,
        valor: valor_exclusivo ?? (data as any).valor
      };

      if (isOnline) {
        let recusa: any = null;
        try {
          const { error: err } = await supabase
            .from('credenciados_procedimentos')
            .update(payload)
            .eq('id', id);

          if (err) recusa = err;
        } catch (err) {
          console.warn('Sem rede ao atualizar valor de procedimento, mantendo no IDB:', err);
        }

        if (recusa) {
          console.error('O servidor recusou a atualização do valor do procedimento:', recusa);
          throw new RecusaDoServidor(explicarRecusa('credenciados_procedimentos', recusa));
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
      let supaData: any[] = [];

      if (isOnline) {
        try {
          const { data, error: err } = await supabase
            .from('credenciados_procedimentos')
            .select('*')
            .eq('credenciado_id', credenciadoId);

          if (!err && data) {
            supaData = data;
          }
        } catch (supaErr) {
          console.warn("Falha no supabase ao buscar procedimentos vinculados:", supaErr);
        }
      }

      // Busca todos os vínculos locais do IndexedDB para este credenciado
      const allIDB = await getAllFromIDB<any>('credenciados_procedimentos');
      const idbItems = allIDB.filter(v => v && v.credenciado_id === credenciadoId);

      // Mescla de forma aditiva: preserva os itens do IDB e adiciona/atualiza com os do Supabase
      const mergedMap = new Map<string, any>();
      for (const item of idbItems) {
        if (item && item.procedimento_id) {
          mergedMap.set(item.procedimento_id, item);
        }
      }
      for (const item of supaData) {
        if (item && item.procedimento_id) {
          const existing = mergedMap.get(item.procedimento_id) || {};
          mergedMap.set(item.procedimento_id, { ...existing, ...item });
        }
      }

      const vinculadosRaw = Array.from(mergedMap.values());

      // Buscar procedimentos cadastrados para anexar os metadados (código, descrição, etc.)
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

      // Sincroniza o IDB com os dados completos e consolidados
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

  const excluir = async (id: string): Promise<void> => {
    try {
      if (isOnline) {
        try {
          // 1. Exclui vínculos com planos
          await supabase.from('credenciados_planos').delete().eq('credenciado_id', id);

          // 2. Exclui vínculos com procedimentos
          await supabase.from('credenciados_procedimentos').delete().eq('credenciado_id', id);

          // 3. Exclui o credenciado
          const { error: delErr } = await supabase.from('credenciados').delete().eq('id', id);
          if (delErr) {
            await supabase.from('credenciados').update({ deleted_at: new Date().toISOString(), status: 'descredenciado' }).eq('id', id);
          }
          await registrarAuditoria('Excluir Credenciado', { id });
        } catch (e) {
          console.warn('Erro ao excluir credenciado no Supabase:', e);
        }
      }
      
      // Limpeza IDB
      await deleteFromIDB('credenciados', id);
      const localCp = await getAllFromIDB<any>('credenciados_procedimentos');
      for (const cp of localCp) {
        if (cp.credenciado_id === id) {
          await deleteFromIDB('credenciados_procedimentos', cp.id);
        }
      }

      await carregarCredenciados();
    } catch (err: any) {
      throw new Error(err?.message || 'Erro ao excluir credenciado.');
    }
  };

  return {
    credenciados,
    loading,
    error,
    criar,
    editar,
    excluir,
    vincularPlano,
    buscarPlanosVinculados,
    vincularProcedimento,
    desvincularProcedimento,
    atualizarValorProcedimento,
    buscarProcedimentosVinculados,
    recarregar: carregarCredenciados
  };
}
