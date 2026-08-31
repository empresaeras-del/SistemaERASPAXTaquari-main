import { useState, useEffect, useCallback, useMemo } from 'react';
import { generateUUID } from '../utils/uuid';
import { supabase } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
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
  const { state: { user: stateUser, isOnline, empresaSelecionada } } = useAppContext();
  const { user } = useAuth();

  // Retorna o tenant_id efetivo para salvar registros
  // Não-super_admin: sempre usa o tenant do próprio usuário
  // Super_admin: usa a empresa selecionada no momento
  const getTenantId = useCallback((): string => {
    if (user?.nivel !== 'super_admin' && user?.tenant_id) {
      return user.tenant_id;
    }
    return (empresaSelecionada && empresaSelecionada !== 'all')
      ? empresaSelecionada
      : (user?.tenant_id || '');
  }, [user, empresaSelecionada]);

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
        `)
        .is('deleted_at', null);

      if (empresaSelecionada && empresaSelecionada !== 'all') {
        query = query.or(`empresa_id.eq.${empresaSelecionada},tenant_id.eq.${empresaSelecionada}`);
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
          idbData = idbData.filter(p => (p as any).empresa_id === empresaSelecionada || (p as any).tenant_id === empresaSelecionada);
        }
        idbData = idbData.filter(p => !(p as any).deleted_at);
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
      
      const tenantId = getTenantId();
      const planoId = generateUUID();

      // Sanitizar dados base para garantir que apenas colunas do banco sejam enviadas
      const dbPlanoPayload = {
        id: planoId,
        codigo: planoBase.codigo,
        nome: planoBase.nome,
        descricao: planoBase.descricao || null,
        tipo_plano: planoBase.tipo_plano,
        limite_vidas: planoBase.tipo_plano === 'coletivo' ? Number(planoBase.limite_vidas) || 2 : null,
        idade_minima: Number(planoBase.idade_minima) || 0,
        idade_maxima: planoBase.idade_maxima ? Number(planoBase.idade_maxima) : null,
        valor_mensalidade: Number(planoBase.valor_mensalidade) || 0,
        taxa_adesao: Number(planoBase.taxa_adesao) || 0,
        carencia_geral_dias: Number(planoBase.carencia_geral_dias) || 30,
        carencia_acidente_dias: Number(planoBase.carencia_acidente_dias) || 0,
        carencia_morte_natural_dias: Number(planoBase.carencia_morte_natural_dias) || 90,
        km_translado_coberto: planoBase.km_translado_coberto !== undefined && planoBase.km_translado_coberto !== null ? Number(planoBase.km_translado_coberto) : null,
        regra_calculo: planoBase.regra_calculo || 'fixo',
        minimo_vidas: (planoBase as any).minimo_vidas || 1,
        minimo_vidas_calculo: (planoBase as any).minimo_vidas_calculo || (planoBase as any).minimo_vidas || 1,
        ativo: planoBase.ativo !== undefined ? planoBase.ativo : true,
        vigencia_inicio: planoBase.vigencia_inicio || null,
        vigencia_fim: planoBase.vigencia_fim || null,
        empresa_id: tenantId,
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const faixasData = data.regra_calculo === 'faixa_etaria' && faixas && faixas.length > 0 
        ? faixas.map(f => ({ 
            id: generateUUID(),
            plano_id: planoId,
            idade_de: Number((f as any).idade_de ?? (f as any).idade_min) || 0,
            idade_ate: Number((f as any).idade_ate ?? (f as any).idade_max) || 99,
            valor: Number(f.valor) || 0,
            tenant_id: tenantId,
            empresa_id: tenantId
          })) 
        : [];

      const coberturasData = [
        ...(itensCobertos || []).map(itemId => ({
          id: generateUUID(),
          plano_id: planoId,
          item_id: itemId,
          tipo_cobertura: 'coberto',
          observacao: observacoesItens?.[itemId] || null,
          tenant_id: tenantId,
          empresa_id: tenantId
        })),
        ...(itensExcluidos || []).map(itemId => ({
          id: generateUUID(),
          plano_id: planoId,
          item_id: itemId,
          tipo_cobertura: 'excluido',
          observacao: observacoesItens?.[itemId] || null,
          tenant_id: tenantId,
          empresa_id: tenantId
        }))
      ];
      
      const planoCompletoToSave = {
        ...dbPlanoPayload,
        faixas: faixasData,
        coberturas: coberturasData
      } as unknown as PlanoPaxCompleto;

      let onlineSuccess = false;
      if (isOnline) {
        const { error: errPlano } = await supabase
          .from('planos_pax')
          .insert([dbPlanoPayload]);
        
        if (errPlano) {
          console.error("Erro ao salvar plano no Supabase:", errPlano);
          throw new Error(`Erro ao salvar no banco: ${errPlano.message}`);
        }
        
        if (faixasData.length > 0) {
          const { error: errFaixas } = await supabase.from('planos_pax_faixas').insert(faixasData);
          if (errFaixas) console.warn("Erro ao salvar faixas no Supabase:", errFaixas);
        }
        
        if (coberturasData.length > 0) {
          const { error: errCoberturas } = await supabase.from('planos_pax_coberturas').insert(coberturasData);
          if (errCoberturas) console.warn("Erro ao salvar coberturas no Supabase:", errCoberturas);
        }
        
        await registrarAuditoria('Criar Plano', { id: planoId, nome: dbPlanoPayload.nome });
        onlineSuccess = true;
      }
      
      // Sincronizar cache IDB
      await saveToIDB('planos_pax', planoCompletoToSave);
      await carregarPlanos();
      return planoCompletoToSave;
    } catch (err: unknown) {
      console.error("Erro ao criar plano:", err);
      if (err instanceof Error) throw err;
      throw new Error('Erro ao criar plano.');
    }
  };

  const editar = async (id: string, data: PlanoPaxFormData): Promise<void> => {
    try {
      const { 
        faixas, itensCobertos, itensExcluidos, observacoesItens, 
        ...planoBase 
      } = data;
      
      const tenantId = getTenantId();

      // Sanitizar dados para UPDATE
      const dbPlanoUpdate = {
        codigo: planoBase.codigo,
        nome: planoBase.nome,
        descricao: planoBase.descricao || null,
        tipo_plano: planoBase.tipo_plano,
        limite_vidas: planoBase.tipo_plano === 'coletivo' ? Number(planoBase.limite_vidas) || 2 : null,
        idade_minima: Number(planoBase.idade_minima) || 0,
        idade_maxima: planoBase.idade_maxima ? Number(planoBase.idade_maxima) : null,
        valor_mensalidade: Number(planoBase.valor_mensalidade) || 0,
        taxa_adesao: Number(planoBase.taxa_adesao) || 0,
        carencia_geral_dias: Number(planoBase.carencia_geral_dias) || 30,
        carencia_acidente_dias: Number(planoBase.carencia_acidente_dias) || 0,
        carencia_morte_natural_dias: Number(planoBase.carencia_morte_natural_dias) || 90,
        km_translado_coberto: planoBase.km_translado_coberto !== undefined && planoBase.km_translado_coberto !== null ? Number(planoBase.km_translado_coberto) : null,
        regra_calculo: planoBase.regra_calculo || 'fixo',
        minimo_vidas: (planoBase as any).minimo_vidas || 1,
        minimo_vidas_calculo: (planoBase as any).minimo_vidas_calculo || (planoBase as any).minimo_vidas || 1,
        ativo: planoBase.ativo !== undefined ? planoBase.ativo : true,
        vigencia_inicio: planoBase.vigencia_inicio || null,
        vigencia_fim: planoBase.vigencia_fim || null,
        empresa_id: tenantId,
        tenant_id: tenantId,
        updated_at: new Date().toISOString()
      };

      const faixasData = data.regra_calculo === 'faixa_etaria' && faixas && faixas.length > 0 
        ? faixas.map(f => ({ 
            id: generateUUID(),
            plano_id: id,
            idade_de: Number((f as any).idade_de ?? (f as any).idade_min) || 0,
            idade_ate: Number((f as any).idade_ate ?? (f as any).idade_max) || 99,
            valor: Number(f.valor) || 0,
            tenant_id: tenantId,
            empresa_id: tenantId
          })) 
        : [];

      const coberturasData = [
        ...(itensCobertos || []).map(itemId => ({
          id: generateUUID(),
          plano_id: id,
          item_id: itemId,
          tipo_cobertura: 'coberto',
          observacao: observacoesItens?.[itemId] || null,
          tenant_id: tenantId,
          empresa_id: tenantId
        })),
        ...(itensExcluidos || []).map(itemId => ({
          id: generateUUID(),
          plano_id: id,
          item_id: itemId,
          tipo_cobertura: 'excluido',
          observacao: observacoesItens?.[itemId] || null,
          tenant_id: tenantId,
          empresa_id: tenantId
        }))
      ];
      
      if (isOnline) {
        const { error: errPlano } = await supabase
          .from('planos_pax')
          .update(dbPlanoUpdate)
          .eq('id', id);
        
        if (errPlano) {
          console.error("Erro ao atualizar plano no Supabase:", errPlano);
          throw new Error(`Erro ao atualizar no banco: ${errPlano.message}`);
        }
        
        await supabase.from('planos_pax_faixas').delete().eq('plano_id', id);
        if (faixasData.length > 0) {
          const { error: errFaixas } = await supabase.from('planos_pax_faixas').insert(faixasData);
          if (errFaixas) console.warn("Erro ao atualizar faixas no Supabase:", errFaixas);
        }
        
        await supabase.from('planos_pax_coberturas').delete().eq('plano_id', id);
        if (coberturasData.length > 0) {
          const { error: errCoberturas } = await supabase.from('planos_pax_coberturas').insert(coberturasData);
          if (errCoberturas) console.warn("Erro ao atualizar coberturas no Supabase:", errCoberturas);
        }
        
        await registrarAuditoria('Editar Plano', { 
          id, 
          nome: data.nome,
          dados_novos: dbPlanoUpdate
        });
      }
      
      const existing = await getFromIDB<PlanoPaxCompleto>('planos_pax', id) || {} as PlanoPaxCompleto;
      await saveToIDB('planos_pax', {
        ...existing,
        ...dbPlanoUpdate,
        faixas: faixasData,
        coberturas: coberturasData
      } as unknown as PlanoPaxCompleto);
      
      await carregarPlanos();
    } catch (err: unknown) {
      console.error("Erro ao editar plano:", err);
      if (err instanceof Error) throw err;
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



  const verificarVinculosPlano = async (planoId: string): Promise<{ total: number; associados: number; contratos: number }> => {
    let totalAssoc = 0;
    let totalContratos = 0;

    // 1. Verifica no IndexedDB local
    try {
      const localAssocs = await getAllFromIDB<any>('associados');
      const assocsVinculados = (localAssocs || []).filter(a => 
        a && !a.deleted_at && (a.plano_pax_id === planoId || a.plano_id === planoId) && a.status !== 'inativo' && a.status !== 'encerrado'
      );
      totalAssoc += assocsVinculados.length;
    } catch (e) {}

    try {
      const localContratos = await getAllFromIDB<any>('contratos');
      const contratosVinculados = (localContratos || []).filter(c => 
        c && !c.deleted_at && c.plano_pax_id === planoId && c.status === 'ativo'
      );
      totalContratos += contratosVinculados.length;
    } catch (e) {}

    // 2. Verifica no Supabase se online
    if (isOnline) {
      try {
        const { count: countAssoc } = await supabase
          .from('associados')
          .select('id', { count: 'exact', head: true })
          .or(`plano_pax_id.eq.${planoId},plano_id.eq.${planoId}`)
          .is('deleted_at', null)
          .neq('status', 'inativo');
        
        if (countAssoc !== null && countAssoc !== undefined) {
          totalAssoc = Math.max(totalAssoc, countAssoc);
        }
      } catch (e) {}

      try {
        const { count: countContratos } = await supabase
          .from('contratos')
          .select('id', { count: 'exact', head: true })
          .eq('plano_pax_id', planoId)
          .is('deleted_at', null)
          .eq('status', 'ativo');

        if (countContratos !== null && countContratos !== undefined) {
          totalContratos = Math.max(totalContratos, countContratos);
        }
      } catch (e) {}
    }

    return {
      total: totalAssoc + totalContratos,
      associados: totalAssoc,
      contratos: totalContratos
    };
  };

  const excluir = async (id: string): Promise<void> => {
    // 1. Validação obrigatória de integridade relacional
    const vinculos = await verificarVinculosPlano(id);
    if (vinculos.total > 0) {
      const detalhe = vinculos.associados > 0 && vinculos.contratos > 0
        ? `${vinculos.associados} associado(s) e ${vinculos.contratos} contrato(s) ativo(s)`
        : vinculos.associados > 0
        ? `${vinculos.associados} associado(s) ativo(s)`
        : `${vinculos.contratos} contrato(s) ativo(s)`;
      throw new Error(`Não é possível excluir este plano: Existem ${detalhe} vinculados. Desative o plano ou desvincule os associados/contratos antes de excluir.`);
    }

    if (isOnline) {
      try {
        // 1. Exclui coberturas vinculadas
        await supabase.from('planos_pax_coberturas').delete().eq('plano_id', id);
        
        // 2. Exclui faixas vinculadas
        await supabase.from('planos_pax_faixas').delete().eq('plano_id', id);
        
        // 3. Exclui vínculos com credenciados
        await supabase.from('credenciados_planos').delete().eq('plano_id', id);

        // 4. Exclui o plano principal
        const { error } = await supabase.from('planos_pax').delete().eq('id', id);
        if (error) {
          await supabase.from('planos_pax').update({ deleted_at: new Date().toISOString(), ativo: false }).eq('id', id);
        }
        await registrarAuditoria('Excluir Plano e Vínculos', { id });
      } catch (err: any) {
        console.warn('Falha no Supabase ao excluir plano:', err);
        throw new Error(err?.message || 'Erro ao excluir plano no Supabase.');
      }
    }
    await deleteFromIDB('planos_pax', id);
    await deleteFromIDB('planos', id);
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
    verificarVinculosPlano,
    planosAtivos,
    calcularValor,
    recarregar: carregarPlanos
  };
}
