import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { useAppContext } from '../context/AppContext';
import { registrarAuditoria } from '../lib/supabase';
import { 
  PlanoPaxCompleto, 
  PlanoPaxFormData, 
  PlanoPaxResumo,
  SimulacaoValor 
} from '../types/planosPax';

export function usePlanosPax() {
  const [planos, setPlanos] = useState<PlanoPaxCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { state: { user, isOnline, empresaSelecionada } } = useAppContext();

  const carregarPlanos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('planos_pax')
        .select(`
          *,
          coberturas:planos_pax_coberturas(
            id, plano_id, item_id, tipo_cobertura, observacao,
            item:itens_funerarios(*)
          ),
          faixas:planos_pax_faixas(*)
        `);

      if (empresaSelecionada && empresaSelecionada !== 'all') {
        query = query.eq('empresa_id', empresaSelecionada);
      }

      const { data, error: err } = await query.order('created_at', { ascending: false });

      if (err) throw err;
      
      if (data) {
        for (const item of data) {
          await saveToIDB('planos_pax', item);
        }
      }
      setPlanos(data as unknown as PlanoPaxCompleto[] || []);
    } catch (err: unknown) {
      console.warn('Supabase fetch failed, falling back to IDB.', err);
      try {
        let idbData = await getAllFromIDB<PlanoPaxCompleto>('planos_pax');
        if (empresaSelecionada && empresaSelecionada !== 'all') {
          idbData = idbData.filter(p => (p as any).empresa_id === empresaSelecionada);
        }
        idbData.sort((a, b) => {
           if (!a.created_at || !b.created_at) return 0;
           return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setPlanos(idbData);
      } catch (idbErr) {
        setError('Erro ao carregar planos PAX.');
      }
    } finally {
      setLoading(false);
    }
  }, [empresaSelecionada]);

  useEffect(() => {
    carregarPlanos();
  }, [carregarPlanos]);

  const criar = async (data: PlanoPaxFormData): Promise<PlanoPaxCompleto> => {
    try {
      if (!user) throw new Error("Usuário não autenticado");
      
      const { 
        faixas, itensCobertos, itensExcluidos, observacoesItens, 
        ...planoBase 
      } = data;
      
      const newItem = { 
        ...planoBase, 
        id: crypto.randomUUID(),
        empresa_id: (planoBase as any).empresa_id || (empresaSelecionada && empresaSelecionada !== 'all' ? empresaSelecionada : 'emp-001')
      };
      const planoId = newItem.id;

      const faixasData = data.regra_calculo === 'faixa_etaria' && faixas.length > 0 
        ? faixas.map(f => ({ ...f, plano_id: planoId, id: crypto.randomUUID() })) 
        : [];

      const coberturasData = [
        ...itensCobertos.map(itemId => ({
          id: crypto.randomUUID(),
          plano_id: planoId,
          item_id: itemId,
          tipo_cobertura: 'coberto',
          observacao: observacoesItens[itemId] || null
        })),
        ...itensExcluidos.map(itemId => ({
          id: crypto.randomUUID(),
          plano_id: planoId,
          item_id: itemId,
          tipo_cobertura: 'excluido',
          observacao: observacoesItens[itemId] || null
        }))
      ];
      
      const planoCompletoToSave = {
        ...newItem,
        faixas: faixasData,
        coberturas: coberturasData
      } as unknown as PlanoPaxCompleto;

      let onlineSuccess = false;
      if (isOnline) {
        try {
          const { error: errPlano } = await supabase
            .from('planos_pax')
            .insert([newItem]);
          
          if (errPlano) {
            console.warn("Falha no Supabase ao criar plano, caindo para IDB", errPlano);
            throw errPlano;
          }
          
          if (faixasData.length > 0) {
            const { error: errFaixas } = await supabase.from('planos_pax_faixas').insert(faixasData);
            if (errFaixas) console.warn("Erro ao salvar faixas:", errFaixas);
          }
          
          if (coberturasData.length > 0) {
            const { error: errCoberturas } = await supabase.from('planos_pax_coberturas').insert(coberturasData);
            if (errCoberturas) console.warn("Erro ao salvar coberturas:", errCoberturas);
          }
          await registrarAuditoria('Criar Plano', { id: planoId, nome: newItem.nome });
          onlineSuccess = true;
        } catch (errPlano) {
           console.warn("Falha no Supabase, caindo para IDB");
        }
      }
      
      // Sincronizar cache IDB pós-escrita ou fallback
      await saveToIDB('planos_pax', planoCompletoToSave);
      
      await carregarPlanos();
      return onlineSuccess ? (await buscarPorId(planoId) as PlanoPaxCompleto) : planoCompletoToSave;
    } catch (err: unknown) {
      console.warn("Erro no criar plano", err);
      if (err instanceof Error) throw new Error(err.message);
      if (typeof err === 'object' && err !== null && 'message' in err) {
         throw new Error(String((err as any).message));
      }
      throw new Error('Erro ao criar plano.');
    }
  };

  const editar = async (id: string, data: PlanoPaxFormData): Promise<void> => {
    try {
      const { 
        faixas, itensCobertos, itensExcluidos, observacoesItens, 
        ...planoBase 
      } = data;
      
      const faixasData = data.regra_calculo === 'faixa_etaria' && faixas.length > 0 
        ? faixas.map(f => ({ ...f, plano_id: id, id: crypto.randomUUID() })) 
        : [];

      const coberturasData = [
        ...itensCobertos.map(itemId => ({
          id: crypto.randomUUID(),
          plano_id: id,
          item_id: itemId,
          tipo_cobertura: 'coberto',
          observacao: observacoesItens[itemId] || null
        })),
        ...itensExcluidos.map(itemId => ({
          id: crypto.randomUUID(),
          plano_id: id,
          item_id: itemId,
          tipo_cobertura: 'excluido',
          observacao: observacoesItens[itemId] || null
        }))
      ];
      
      let onlineSuccess = false;
      if (isOnline) {
        try {
          const { error: errPlano } = await supabase
            .from('planos_pax')
            .update(planoBase)
            .eq('id', id);
          
          if (errPlano) throw errPlano;
          
          await supabase.from('planos_pax_faixas').delete().eq('plano_id', id);
          if (faixasData.length > 0) {
            const { error: errFaixas } = await supabase.from('planos_pax_faixas').insert(faixasData);
            if (errFaixas) console.warn("Erro ao salvar faixas:", errFaixas);
          }
          
          await supabase.from('planos_pax_coberturas').delete().eq('plano_id', id);
          if (coberturasData.length > 0) {
            const { error: errCoberturas } = await supabase.from('planos_pax_coberturas').insert(coberturasData);
            if (errCoberturas) console.warn("Erro ao salvar coberturas:", errCoberturas);
          }
          
          // Get previous data for auditing
          const { data: oldPlano } = await supabase.from('planos_pax').select('*').eq('id', id).single();
          await registrarAuditoria('Editar Plano', { 
            id, 
            nome: data.nome,
            dados_anteriores: oldPlano,
            dados_novos: data
          });

          onlineSuccess = true;
        } catch (e) {
          console.warn("Falha no Supabase editar, caindo para IDB");
        }
      }
      
      const existing = await getFromIDB<PlanoPaxCompleto>('planos_pax', id) || {} as PlanoPaxCompleto;
      await saveToIDB('planos_pax', {
        ...existing,
        ...planoBase,
        faixas: faixasData,
        coberturas: coberturasData
      } as unknown as PlanoPaxCompleto);
      
      await carregarPlanos();
    } catch (err: unknown) {
      if (err instanceof Error) throw new Error(err.message);
      throw new Error('Erro ao editar plano.');
    }
  };

  const desativar = async (id: string): Promise<void> => {
    if (isOnline) {
      try {
        const { data: vinculos, error: checkErr } = await supabase
          .from('contratos')
          .select('id')
          .eq('plano_pax_id', id)
          .eq('status', 'ativo')
          .limit(1);
        
        if (checkErr && checkErr.code !== '42P01') throw checkErr;
        
        if (vinculos && vinculos.length > 0) {
          throw new Error('Existem contratos ativos utilizando este plano. Não é possível desativar.');
        }
        
        const { error } = await supabase.from('planos_pax').update({ ativo: false }).eq('id', id);
        if (error) throw error;
        await registrarAuditoria('Desativar Plano', { id });
      } catch (err: any) {
        if (err.message && err.message.includes('contratos ativos')) throw err;
        console.warn('Falha no Supabase ao desativar, caindo para IDB', err);
      }
    }
    const existing = await getFromIDB<PlanoPaxCompleto>('planos_pax', id);
    if (existing) {
      await saveToIDB('planos_pax', { ...existing, ativo: false });
    }
    await carregarPlanos();
  };

  const reativar = async (id: string): Promise<void> => {
    if (isOnline) {
      try {
        const { error } = await supabase.from('planos_pax').update({ ativo: true }).eq('id', id);
        if (error) throw error;
        await registrarAuditoria('Reativar Plano', { id });
      } catch (err) {
        console.warn('Falha no Supabase ao reativar, caindo para IDB', err);
      }
    }
    const existing = await getFromIDB<PlanoPaxCompleto>('planos_pax', id);
    if (existing) {
      await saveToIDB('planos_pax', { ...existing, ativo: true });
    }
    await carregarPlanos();
  };



  const excluir = async (id: string): Promise<void> => {
    if (isOnline) {
      try {
        const { data: vinculos, error: checkErr } = await supabase
          .from('contratos')
          .select('id')
          .eq('plano_pax_id', id)
          .eq('status', 'ativo')
          .limit(1);
        
        if (checkErr && checkErr.code !== '42P01') throw checkErr;
        
        if (vinculos && vinculos.length > 0) {
          throw new Error('Existem contratos ativos utilizando este plano. Não é possível excluir.');
        }
        
        const { error } = await supabase.from('planos_pax').delete().eq('id', id);
        if (error) throw error;
        await registrarAuditoria('Excluir Plano', { id });
      } catch (err: any) {
        if (err.message && err.message.includes('contratos ativos')) throw err;
        console.warn('Falha no Supabase ao excluir, caindo para IDB', err);
      }
    }
    await deleteFromIDB('planos_pax', id);
    await carregarPlanos();
  };

  const buscarPorId = useCallback(async (id: string): Promise<PlanoPaxCompleto | null> => {
    try {
      const { data, error } = await supabase
          .from('planos_pax')
          .select(`
            *,
            coberturas:planos_pax_coberturas(
              id, plano_id, item_id, tipo_cobertura, observacao,
              item:itens_funerarios(*)
            ),
            faixas:planos_pax_faixas(*)
          `)
          .eq('id', id)
          .single();
          
      if (error) throw error;
      if (data) {
        await saveToIDB('planos_pax', data);
      }
      return data as unknown as PlanoPaxCompleto;
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to IDB for buscarPorId.');
      const data = await getFromIDB<PlanoPaxCompleto>('planos_pax', id);
      if (data) return data;
      throw err;
    }
  }, []);

  const calcularValor = useCallback((plano: PlanoPaxCompleto | undefined, totalVidas?: number, idadesDependentes?: number[], valorExtra?: number): SimulacaoValor => {
    if (!plano) return { base: 0, por_vida: 0, total: 0, descricao: '' };
    
    let base = 0;
    let descricao = '';
    const vidas = totalVidas || 1;
    
    if (plano.tipo_plano === 'individual') {
      const minVidas = plano.minimo_vidas_calculo || 1;
      const calculoVidas = vidas <= minVidas ? minVidas : vidas;
      base = plano.valor_mensalidade * calculoVidas;
      descricao = `Valor por vida (${calculoVidas}x R$ ${plano.valor_mensalidade})`;
      if (vidas <= minVidas) {
        descricao += ` (Mínimo de ${minVidas} vidas)`;
      }
    } else {
      // Coletivo
      base = plano.valor_mensalidade + (Number(valorExtra) || 0);
      descricao = 'Valor Base Coletivo' + (Number(valorExtra) > 0 ? ` + Valor Extra (R$ ${valorExtra})` : '');
    }
    
    let adicionaisDependentes = 0;
    if (idadesDependentes && idadesDependentes.length > 0 && plano.faixas && plano.faixas.length > 0) {
      idadesDependentes.forEach(idade => {
        const faixa = plano.faixas.find(f => idade >= f.idade_de && idade <= f.idade_ate);
        if (faixa) {
          adicionaisDependentes += faixa.valor;
        }
      });
      if (adicionaisDependentes > 0) {
        descricao += ` + Adicional Dependentes (R$ ${adicionaisDependentes})`;
      }
    }
    
    return {
      base: base,
      por_vida: plano.tipo_plano === 'individual' ? plano.valor_mensalidade : 0,
      total: base + adicionaisDependentes,
      descricao: descricao
    };
  }, []);

  const planosAtivos = useMemo(() => {
    return planos
      .filter(p => p.ativo)
      .map(p => ({
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        tipo_plano: p.tipo_plano,
        valor_mensalidade: p.valor_mensalidade,
        taxa_adesao: p.taxa_adesao,
        limite_vidas: p.limite_vidas
      } as PlanoPaxResumo));
  }, [planos]);

  return {
    planos,
    loading,
    error,
    criar,
    editar,
    desativar,
    reativar,
    excluir,
    buscarPorId,
    planosAtivos,
    calcularValor,
    recarregar: carregarPlanos
  };
}
