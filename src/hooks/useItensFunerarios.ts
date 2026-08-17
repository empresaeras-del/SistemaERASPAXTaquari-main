import { useState, useEffect, useMemo } from 'react';
import { generateUUID } from '../utils/uuid';
import { supabase } from '../lib/supabase';
import { 
  ItemFunerario, 
  ItemFunerarioInsert, 
  ItemFunerarioUpdate, 
  ItemFunerarioFiltros,
  CategoriaItemFunerario,
  ItemFunerarioCheckbox,
  PlanoVinculadoItem
} from '../types/itensFunerarios';
import { PlanoPaxCobertura, PlanoPaxCompleto } from '../types/planosPax';
import { getFromIDB, saveToIDB, getAllFromIDB } from '../lib/idb';
import { useAppContext } from '../context/AppContext';

export async function getCoberturasDoItem(itemId: string, isOnline: boolean): Promise<PlanoPaxCobertura[]> {
  if (isOnline) {
    try {
      const { data, error } = await supabase
        .from('planos_pax_coberturas')
        .select('*')
        .eq('item_id', itemId);
      if (!error && data) return data as PlanoPaxCobertura[];
    } catch (e) {
      console.warn('Erro ao buscar coberturas no Supabase:', e);
    }
  }

  // Fallback / sync with IDB
  try {
    const todosPlanos = await getAllFromIDB<PlanoPaxCompleto>('planos_pax');
    const result: PlanoPaxCobertura[] = [];
    for (const plano of todosPlanos) {
      if (plano.coberturas && Array.isArray(plano.coberturas)) {
        const cob = plano.coberturas.find(c => c.item_id === itemId);
        if (cob) {
          result.push({
            ...cob,
            plano_id: plano.id
          });
        }
      }
    }
    return result;
  } catch (e) {
    return [];
  }
}

export async function salvarCoberturasDoItem(
  itemId: string,
  planosVinculados: PlanoVinculadoItem[],
  isOnline: boolean
): Promise<void> {
  if (isOnline) {
    try {
      // 1. Remove existing coverage rows for this item
      await supabase.from('planos_pax_coberturas').delete().eq('item_id', itemId);

      // 2. Insert new coverage rows if any selected
      if (planosVinculados.length > 0) {
        const newRows = planosVinculados.map(pv => ({
          id: generateUUID(),
          plano_id: pv.plano_id,
          item_id: itemId,
          tipo_cobertura: pv.tipo_cobertura,
          observacao: pv.observacao || null
        }));
        const { error: insertErr } = await supabase.from('planos_pax_coberturas').insert(newRows);
        if (insertErr) console.warn('Erro ao inserir coberturas no Supabase:', insertErr);
      }
    } catch (e) {
      console.warn('Falha no Supabase ao salvar coberturas do item:', e);
    }
  }

  // Always keep IDB planos_pax store in sync
  try {
    const todosPlanos = await getAllFromIDB<PlanoPaxCompleto>('planos_pax');
    for (const plano of todosPlanos) {
      if (!plano.coberturas) plano.coberturas = [];
      // Filter out previous linkage for this item
      plano.coberturas = plano.coberturas.filter(c => c.item_id !== itemId);

      // Check if item is linked to this plano
      const vinculacao = planosVinculados.find(pv => pv.plano_id === plano.id);
      if (vinculacao) {
        plano.coberturas.push({
          id: generateUUID(),
          plano_id: plano.id,
          item_id: itemId,
          tipo_cobertura: vinculacao.tipo_cobertura,
          observacao: vinculacao.observacao || undefined
        });
      }
      await saveToIDB('planos_pax', plano);
    }
  } catch (e) {
    console.warn('Erro ao sincronizar IDB com novos vínculos do item:', e);
  }
}

export function useItensFunerarios() {
  const [itens, setItens] = useState<ItemFunerario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<ItemFunerarioFiltros>({});
  const { state: { user, isOnline, empresaSelecionada } } = useAppContext();

  const carregarItens = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('itens_funerarios')
        .select('*')
        .is('deleted_at', null);

      if (empresaSelecionada && empresaSelecionada !== 'all') {
        query = query.or(`empresa_id.eq.${empresaSelecionada},tenant_id.eq.${empresaSelecionada}`);
      }

      if (filtros.categoria) {
        query = query.eq('categoria', filtros.categoria);
      }
      if (filtros.ativo !== undefined) {
        query = query.eq('ativo', filtros.ativo);
      }
      if (filtros.busca) {
        query = query.or(`nome.ilike.%${filtros.busca}%,codigo.ilike.%${filtros.busca}%`);
      }

      const { data, error: err } = await query
        .order('ordem_exibicao', { ascending: true })
        .order('nome', { ascending: true });

      if (err) throw err;
      
      if (data) {
        for (const item of data) {
          await saveToIDB('itens_funerarios', item);
        }
      }
      setItens(data as ItemFunerario[] || []);
    } catch (err: unknown) {
      console.warn('Supabase fetch failed, falling back to IDB.', err);
      try {
        let idbData = await getAllFromIDB<ItemFunerario>('itens_funerarios');
        if (empresaSelecionada && empresaSelecionada !== 'all') {
          idbData = idbData.filter(i => (i as any).empresa_id === empresaSelecionada || (i as any).tenant_id === empresaSelecionada);
        }
        idbData = idbData.filter(i => !(i as any).deleted_at);
        if (filtros.categoria) {
            idbData = idbData.filter(i => i.categoria === filtros.categoria);
        }
        if (filtros.ativo !== undefined) {
            idbData = idbData.filter(i => i.ativo === filtros.ativo);
        }
        if (filtros.busca) {
            const b = filtros.busca.toLowerCase();
            idbData = idbData.filter(i => i.nome.toLowerCase().includes(b) || i.codigo.toLowerCase().includes(b));
        }
        idbData.sort((a, b) => {
            if (a.ordem_exibicao !== b.ordem_exibicao) return (a.ordem_exibicao || 99) - (b.ordem_exibicao || 99);
            return a.nome.localeCompare(b.nome);
        });
        setItens(idbData);
      } catch (idbErr) {
        setError('Erro ao carregar itens funerários.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarItens();
  }, [filtros, empresaSelecionada]);

  const criar = async (data: ItemFunerarioInsert & { planosVinculados?: PlanoVinculadoItem[] }) => {
    try {
      if (!user) throw new Error("Usuário não autenticado.");
      const { planosVinculados, ...itemData } = data;
      const tenantId = (itemData as any).empresa_id || (empresaSelecionada && empresaSelecionada !== 'all' ? empresaSelecionada : 'emp-001');
      const itemId = generateUUID();

      const newItem = { 
        id: itemId,
        codigo: itemData.codigo,
        nome: itemData.nome,
        descricao: itemData.descricao || null,
        categoria: itemData.categoria,
        unidade: itemData.unidade || 'unidade',
        valor_referencia: itemData.valor_referencia ? Number(itemData.valor_referencia) : null,
        ativo: itemData.ativo !== undefined ? itemData.ativo : true,
        ordem_exibicao: itemData.ordem_exibicao ? Number(itemData.ordem_exibicao) : 0,
        created_by: user.id,
        empresa_id: tenantId,
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      let inserted = newItem;
      if (isOnline) {
        const { data: dbData, error: err } = await supabase.from('itens_funerarios').insert([
          newItem
        ]).select().single();
        
        if (err) {
          console.error('Erro ao inserir item funerário no Supabase:', err);
          throw new Error(`Erro ao salvar no banco: ${err.message}`);
        }
        if (dbData) inserted = dbData;
      }

      await saveToIDB('itens_funerarios', inserted);

      if (planosVinculados && Array.isArray(planosVinculados)) {
        await salvarCoberturasDoItem(itemId, planosVinculados, isOnline);
      }

      await carregarItens();
    } catch (err: unknown) {
      if (err instanceof Error) throw err;
      throw new Error('Erro ao criar item funerário.');
    }
  };

  const editar = async (id: string, data: ItemFunerarioUpdate & { planosVinculados?: PlanoVinculadoItem[] }) => {
    try {
      const { planosVinculados, ...itemData } = data;
      const tenantId = (itemData as any).empresa_id || (empresaSelecionada && empresaSelecionada !== 'all' ? empresaSelecionada : 'emp-001');

      const updatedPayload = {
        ...itemData,
        empresa_id: tenantId,
        tenant_id: tenantId,
        updated_at: new Date().toISOString()
      };
      
      if (isOnline) {
        const { data: updated, error: err } = await supabase.from('itens_funerarios').update(updatedPayload).eq('id', id).select().single();
        if (err) {
          console.error('Erro ao atualizar item funerário no Supabase:', err);
          throw new Error(`Erro ao atualizar no banco: ${err.message}`);
        }
        if (updated) {
          await saveToIDB('itens_funerarios', updated);
        }
      } else {
        const existing = await getFromIDB<ItemFunerario>('itens_funerarios', id);
        if (existing) {
          await saveToIDB('itens_funerarios', { ...existing, ...updatedPayload });
        }
      }

      if (planosVinculados !== undefined && Array.isArray(planosVinculados)) {
        await salvarCoberturasDoItem(id, planosVinculados, isOnline);
      }

      await carregarItens();
    } catch (err: unknown) {
      if (err instanceof Error) throw err;
      throw new Error('Erro ao atualizar item funerário.');
    }
  };

  const desativar = async (id: string) => {
    try {
      try {
        const { data: vinculos, error: checkErr } = await supabase
          .from('planos_pax_coberturas')
          .select('id')
          .eq('item_id', id)
          .limit(1);

        if (checkErr && checkErr.code !== '42P01') throw checkErr;

        if (vinculos && vinculos.length > 0) {
          console.warn('Item vinculado a planos. Apenas desativando.');
        }
      } catch (err) {
        console.warn('Falha no Supabase ao verificar vínculos, prosseguindo', err);
      }
      
      await editar(id, { ativo: false });
    } catch (err: unknown) {
      if (err instanceof Error) throw new Error(err.message);
      throw new Error('Erro ao desativar item funerário.');
    }
  };

  const reativar = async (id: string) => {
    await editar(id, { ativo: true });
  };

  const reordenar = async (ids: string[]) => {
    try {
      const updates = ids.map((id, index) => 
        supabase.from('itens_funerarios').update({ ordem_exibicao: index * 10 }).eq('id', id)
      );
      await Promise.all(updates);
      await carregarItens();
    } catch (err: unknown) {
      if (err instanceof Error) throw new Error(err.message);
      throw new Error('Erro ao reordenar itens.');
    }
  };

  const itensPorCategoria = useMemo(() => {
    const agrupado: Record<CategoriaItemFunerario, ItemFunerario[]> = {
      translado: [], preparacao: [], urna: [], velorio: [], cortejo: [], 
      sepultamento: [], documentacao: [], flores: [], apoio_familia: [], outros: []
    };
    
    itens.filter(i => i.ativo).forEach(item => {
      if (agrupado[item.categoria]) {
        agrupado[item.categoria].push(item);
      } else {
        agrupado.outros.push(item);
      }
    });
    
    return agrupado;
  }, [itens]);

  const itensSelecionaveis = useMemo(() => {
    return itens
      .filter(i => i.ativo)
      .map(i => ({
        id: i.id,
        nome: i.nome,
        categoria: i.categoria,
        ativo: i.ativo,
        ordem_exibicao: i.ordem_exibicao
      } as ItemFunerarioCheckbox))
      .sort((a, b) => a.ordem_exibicao - b.ordem_exibicao);
  }, [itens]);

  return {
    itens,
    loading,
    error,
    filtros,
    setFiltros,
    criar,
    editar,
    desativar,
    reativar,
    reordenar,
    itensPorCategoria,
    itensSelecionaveis,
    getCoberturasDoItem: (itemId: string) => getCoberturasDoItem(itemId, isOnline),
    recarregar: carregarItens
  };
}

