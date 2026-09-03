import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { generateUUID } from '../utils/uuid';

export type FormaPagamento = string;

export interface Receita {
  id: string;
  tenant_id: string;
  tipo_devedor: 'associado' | 'cliente_pf' | 'cliente_pj';
  associado_id?: string;
  associado_nome?: string;
  associado_cpf?: string;
  associado_plano?: string;
  associado_valor_contrato?: number;
  cliente_tipo?: 'pf' | 'pj';
  cliente_nome?: string;
  cliente_cpf_cnpj?: string;
  cliente_telefone?: string;
  cliente_email?: string;
  descricao: string;
  categoria: string;
  data_emissao: string;
  data_inicio_cobranca: string;
  valor_total: number;
  qtd_parcelas: number;
  forma_pagamento_padrao: FormaPagamento;
  conta_bancaria_id?: string;
  observacoes?: string;
  status: 'ativo' | 'rascunho' | 'cancelado' | 'quitado';
  atendimento_id?: string;
  criado_em?: string;
  criado_por?: string;
  deleted_at?: string | null;
}

export interface Despesa {
  atualizado_em?: string;
  criado_por?: string;
  centro_custo?: string;
  id: string;
  tenant_id: string;
  tipo_credor: 'fornecedor' | 'fornecedor_pf' | 'fornecedor_pj' | 'funcionario' | 'outro';
  fornecedor_id?: string;
  fornecedor_nome?: string;
  fornecedor_cnpj_cpf?: string;
  funcionario_id?: string;
  funcionario_nome?: string;
  funcionario_cpf?: string;
  credor_nome?: string;
  credor_cpf_cnpj?: string;
  descricao: string;
  categoria: string;
  data_emissao: string;
  data_inicio_pagamento: string;
  valor_total: number;
  qtd_parcelas: number;
  forma_pagamento_padrao: FormaPagamento;
  conta_bancaria_id?: string;
  codigo_barras?: string;
  observacoes?: string;
  status: 'ativo' | 'rascunho' | 'cancelado' | 'quitado';
  atendimento_id?: string;
  criado_em?: string;
  deleted_at?: string | null;
}

export interface ParcelaReceber {
  id: string;
  tenant_id: string;
  receita_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  valor_pago?: number;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado' | 'negociado' | 'vencido' | 'recebido';
  forma_pagamento?: FormaPagamento;
  conta_bancaria_id?: string;
  link_pagamento?: string;
  linha_digitavel?: string;
  comprovante_url?: string;
  observacoes?: string;
  criado_em?: string;
  tipo_devedor?: string;
  devedor_cpf_cnpj?: string;
  devedor_nome?: string;
  descricao?: string;
  valor_recebido?: number;
  forma_pagamento_efetivo?: FormaPagamento;
  data_recebimento?: string;
  recebido_em?: string;
  total_parcelas?: number;
  recebido_por?: string;
  observacao_recebimento?: string;
  deleted_at?: string | null;
}

export interface ParcelaPagar {
  atualizado_em?: string;
  observacao?: string;
  credor_cpf_cnpj?: string;
  id: string;
  tenant_id: string;
  despesa_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  valor_pago?: number;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado' | 'negociado' | 'recebido';
  forma_pagamento?: FormaPagamento;
  conta_bancaria_id?: string;
  comprovante_url?: string;
  observacoes?: string;
  criado_em?: string;
  credor_nome?: string;
  descricao?: string;
  forma_pagamento_efetivo?: FormaPagamento;
  pago_em?: string;
  total_parcelas?: number;
  pago_por?: string;
  observacao_pagamento?: string;
  tipo_credor?: string;
  deleted_at?: string | null;
}

export const sanitizeReceitaForSupabase = (r: Receita, fallbackTenantId?: string) => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rId = UUID_REGEX.test(r.id || '') ? r.id : generateUUID();
  const tId = (r.tenant_id && r.tenant_id !== 'all' && r.tenant_id.trim() !== '') 
    ? r.tenant_id 
    : ((fallbackTenantId && fallbackTenantId !== 'all' && fallbackTenantId.trim() !== '') ? fallbackTenantId : 'default_tenant');
  const empresaId = ((r as any).empresa_id && (r as any).empresa_id !== 'all' && String((r as any).empresa_id).trim() !== '')
    ? (r as any).empresa_id
    : tId;

  return {
    id: rId,
    tenant_id: tId,
    empresa_id: empresaId,
    tipo_devedor: r.tipo_devedor || 'associado',
    associado_id: r.associado_id && UUID_REGEX.test(r.associado_id) ? r.associado_id : null,
    associado_nome: r.associado_nome || null,
    associado_cpf: r.associado_cpf ? String(r.associado_cpf).trim() : null,
    associado_plano: r.associado_plano || null,
    associado_valor_contrato: r.associado_valor_contrato !== undefined && r.associado_valor_contrato !== null && !isNaN(Number(r.associado_valor_contrato)) ? Number(r.associado_valor_contrato) : null,
    cliente_tipo: r.cliente_tipo || null,
    cliente_nome: r.cliente_nome || null,
    cliente_cpf_cnpj: r.cliente_cpf_cnpj ? String(r.cliente_cpf_cnpj).trim() : null,
    cliente_telefone: r.cliente_telefone || null,
    cliente_email: r.cliente_email ? String(r.cliente_email).trim() : null,
    descricao: r.descricao || 'Receita',
    categoria: r.categoria || 'Geral',
    data_emissao: (r.data_emissao && String(r.data_emissao).trim() !== '') ? String(r.data_emissao).split('T')[0] : new Date().toISOString().split('T')[0],
    data_inicio_cobranca: (r.data_inicio_cobranca && String(r.data_inicio_cobranca).trim() !== '') ? String(r.data_inicio_cobranca).split('T')[0] : new Date().toISOString().split('T')[0],
    valor_total: Number(r.valor_total) || 0,
    qtd_parcelas: Number(r.qtd_parcelas) || 1,
    forma_pagamento_padrao: r.forma_pagamento_padrao || 'pix',
    conta_bancaria_id: r.conta_bancaria_id && UUID_REGEX.test(r.conta_bancaria_id) ? r.conta_bancaria_id : null,
    observacoes: r.observacoes || null,
    status: r.status || 'ativo',
    atendimento_id: r.atendimento_id && UUID_REGEX.test(r.atendimento_id) ? r.atendimento_id : null,
    criado_em: r.criado_em || new Date().toISOString(),
    criado_por: r.criado_por && UUID_REGEX.test(r.criado_por) ? r.criado_por : null,
    updated_at: new Date().toISOString()
  };
};

export const sanitizeParcelaReceberForSupabase = (p: ParcelaReceber, fallbackReceitaId?: string, fallbackTenantId?: string) => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const pId = UUID_REGEX.test(p.id || '') ? p.id : generateUUID();
  const rId = (p.receita_id && UUID_REGEX.test(p.receita_id)) 
    ? p.receita_id 
    : ((fallbackReceitaId && UUID_REGEX.test(fallbackReceitaId)) ? fallbackReceitaId : null);
  
  const tId = (p.tenant_id && p.tenant_id !== 'all' && p.tenant_id.trim() !== '') 
    ? p.tenant_id 
    : ((fallbackTenantId && fallbackTenantId !== 'all' && fallbackTenantId.trim() !== '') ? fallbackTenantId : 'default_tenant');
  const empresaId = ((p as any).empresa_id && (p as any).empresa_id !== 'all' && String((p as any).empresa_id).trim() !== '')
    ? (p as any).empresa_id
    : tId;

  const dataVenc = (p.data_vencimento && String(p.data_vencimento).trim() !== '') 
    ? String(p.data_vencimento).split('T')[0] 
    : new Date().toISOString().split('T')[0];
  const isPaid = p.status === 'recebido' || p.status === 'pago';

  const dataPag = p.data_pagamento 
    ? String(p.data_pagamento).split('T')[0] 
    : (p.data_recebimento ? String(p.data_recebimento).split('T')[0] : (p.recebido_em ? String(p.recebido_em).split('T')[0] : (isPaid ? new Date().toISOString().split('T')[0] : null)));

  const valRecebido = p.valor_recebido !== undefined && p.valor_recebido !== null && !isNaN(Number(p.valor_recebido))
    ? Number(p.valor_recebido) 
    : (p.valor_pago !== undefined && p.valor_pago !== null && !isNaN(Number(p.valor_pago)) ? Number(p.valor_pago) : (isPaid ? Number(p.valor) || 0 : null));

  const recebidoEm = p.recebido_em 
    ? p.recebido_em 
    : (p.data_recebimento ? new Date(p.data_recebimento).toISOString() : (isPaid ? new Date().toISOString() : null));

  return {
    id: pId,
    tenant_id: tId,
    empresa_id: empresaId,
    receita_id: rId,
    numero_parcela: Number(p.numero_parcela) || 1,
    valor: Number(p.valor) || 0,
    data_vencimento: dataVenc,
    data_pagamento: dataPag,
    valor_pago: valRecebido,
    valor_recebido: valRecebido,
    status: p.status || 'pendente',
    forma_pagamento: p.forma_pagamento || 'pix',
    forma_pagamento_efetivo: p.forma_pagamento_efetivo || null,
    conta_bancaria_id: p.conta_bancaria_id && UUID_REGEX.test(p.conta_bancaria_id) ? p.conta_bancaria_id : null,
    link_pagamento: p.link_pagamento || null,
    linha_digitavel: p.linha_digitavel || null,
    comprovante_url: p.comprovante_url || null,
    observacoes: p.observacoes || null,
    observacao_recebimento: p.observacao_recebimento || (p as any).observacao || null,
    tipo_devedor: p.tipo_devedor || null,
    devedor_nome: p.devedor_nome || null,
    devedor_cpf_cnpj: p.devedor_cpf_cnpj ? String(p.devedor_cpf_cnpj).trim() : null,
    descricao: p.descricao || null,
    recebido_em: recebidoEm,
    recebido_por: p.recebido_por || null,
    total_parcelas: Number(p.total_parcelas) || 1,
    criado_em: p.criado_em || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
};

export const salvarReceita = async (isOnline: boolean, receita: Receita, parcelas: ParcelaReceber[]): Promise<void> => {
  const sanitizedReceita = sanitizeReceitaForSupabase(receita);
  const receitaId = sanitizedReceita.id;

  if (isOnline) {
    try {
      const { error } = await supabase.from('receitas').upsert(sanitizedReceita);
      if (error) console.error('Supabase save receita error:', error);
    } catch (e) {
      console.error('Supabase save receita threw:', e);
    }
  } else {
    await addToSyncQueue({
      storeName: 'receitas',
      action: 'update',
      data: sanitizedReceita
    });
  }
  await saveToIDB('receitas', sanitizedReceita);

  // Deletar parcelas órfãs
  const existingParcelas = await getAllFromIDB<ParcelaReceber>('parcelas_receber');
  const orphanParcelas = existingParcelas.filter(p => p.receita_id === receitaId && !parcelas.find(np => np.id === p.id));
  
  for (const orphan of orphanParcelas) {
    if (isOnline) {
      try {
        await supabase.from('parcelas_receber').delete().eq('id', orphan.id);
      } catch (e) {
        console.warn('Supabase delete orphaned parcela_receber threw:', e);
      }
    } else {
      await addToSyncQueue({
        storeName: 'parcelas_receber',
        action: 'delete',
        data: { id: orphan.id } as any
      });
    }
    await deleteFromIDB('parcelas_receber', orphan.id);
  }

  for (const p of parcelas) {
    const sanitizedParcela = sanitizeParcelaReceberForSupabase(p, receitaId, sanitizedReceita.tenant_id);
    if (isOnline) {
      try {
        const { error } = await supabase.from('parcelas_receber').upsert(sanitizedParcela);
        if (error) console.error('Supabase save parcela_receber error:', error);
      } catch (e) {
        console.error('Supabase save parcela_receber threw:', e);
      }
    } else {
      await addToSyncQueue({
        storeName: 'parcelas_receber',
        action: 'update',
        data: sanitizedParcela
      });
    }
    await saveToIDB('parcelas_receber', sanitizedParcela);
  }

  await registrarAuditoria('Salvar Receita', { id: receitaId, descricao: sanitizedReceita.descricao });
};

export const atualizarReceita = async (isOnline: boolean, receita: Partial<Receita> & { id: string }): Promise<void> => {
  let existente = await getFromIDB<Receita>('receitas', receita.id);
  if (!existente && isOnline) {
    try {
      const { data } = await supabase.from('receitas').select('*').eq('id', receita.id).maybeSingle();
      if (data) existente = data;
    } catch (e) {
      console.warn('Erro ao buscar receita existente para atualizar:', e);
    }
  }

  const mesclada: Receita = {
    ...(existente || {} as any),
    ...receita,
    id: receita.id
  };

  const sanitized = sanitizeReceitaForSupabase(mesclada);

  if (isOnline) {
    try {
      const { error } = await supabase.from('receitas').upsert(sanitized);
      if (error) {
        console.error('Supabase update receita error:', error);
        throw new Error(error.message);
      }
    } catch (e: any) {
      console.warn('Supabase update receita threw, adding to sync queue:', e);
      await addToSyncQueue({
        storeName: 'receitas',
        action: 'update',
        data: sanitized
      });
    }
  } else {
    await addToSyncQueue({
      storeName: 'receitas',
      action: 'update',
      data: sanitized
    });
  }

  await saveToIDB('receitas', { ...mesclada, ...sanitized });
  await registrarAuditoria('Atualizar Receita', { id: receita.id, descricao: sanitized.descricao });
};

export const atualizarParcelaReceber = async (isOnline: boolean, parcela: Partial<ParcelaReceber> & { id: string }): Promise<void> => {
  let existente = await getFromIDB<ParcelaReceber>('parcelas_receber', parcela.id);
  if (!existente && isOnline) {
    try {
      const { data } = await supabase.from('parcelas_receber').select('*').eq('id', parcela.id).maybeSingle();
      if (data) existente = data;
    } catch (e) {
      console.warn('Erro ao buscar parcela existente para atualizar:', e);
    }
  }

  const mesclada: ParcelaReceber = {
    ...(existente || {} as any),
    ...parcela,
    id: parcela.id
  };

  const sanitized = sanitizeParcelaReceberForSupabase(mesclada);

  if (isOnline) {
    try {
      const { error } = await supabase.from('parcelas_receber').upsert(sanitized);
      if (error) {
        console.error('Supabase update parcela_receber error:', error);
        throw new Error(error.message);
      }
    } catch (e: any) {
      console.warn('Supabase update parcela_receber threw, adding to sync queue:', e);
      await addToSyncQueue({
        storeName: 'parcelas_receber',
        action: 'update',
        data: sanitized
      });
    }
  } else {
    await addToSyncQueue({
      storeName: 'parcelas_receber',
      action: 'update',
      data: sanitized
    });
  }

  await saveToIDB('parcelas_receber', { ...mesclada, ...sanitized });
  await registrarAuditoria('Atualizar Parcela Receber', { id: parcela.id, numero: sanitized.numero_parcela, valor: sanitized.valor });
};

export const getParcelasReceber = async (isOnline: boolean, tenantId: string): Promise<ParcelaReceber[]> => {
  let parcelas: ParcelaReceber[] = [];
  const localParcelas = await getAllFromIDB<ParcelaReceber>('parcelas_receber');

  if (isOnline) {
    try {
      let query = supabase.from('parcelas_receber').select('*');
      if (tenantId && tenantId !== 'all') {
        query = query.or(`tenant_id.eq.${tenantId},tenant_id.eq.default_tenant,tenant_id.eq.empresa_padrao`);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        for (const item of data) {
          await saveToIDB('parcelas_receber', item);
        }

        // Merge Supabase com os locais
        const remoteMap = new Map<string, ParcelaReceber>();
        data.forEach((item: any) => remoteMap.set(item.id, item));
        (localParcelas || []).forEach(localItem => {
          if (!remoteMap.has(localItem.id) && !localItem.deleted_at) {
            remoteMap.set(localItem.id, localItem);
          }
        });
        parcelas = Array.from(remoteMap.values());
      } else {
        parcelas = localParcelas || [];
      }
    } catch (error) {
      console.warn('Supabase fetch parcelas_receber failed, using IDB fallback.', error);
      parcelas = localParcelas || [];
    }
  } else {
    parcelas = localParcelas || [];
  }

  return (parcelas || []).filter(p => {
    if (!p) return false;
    if (p.deleted_at) return false;
    if (tenantId && tenantId !== 'all') {
      const matchTenant = !p.tenant_id || 
        p.tenant_id === tenantId || 
        p.tenant_id === 'all' || 
        p.tenant_id === 'default_tenant' || 
        p.tenant_id === 'empresa_padrao';
      if (!matchTenant) return false;
    }
    return true;
  });
};

export const sanitizeParcelaPagarForSupabase = (p: ParcelaPagar, fallbackDespesaId?: string, fallbackTenantId?: string) => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const pId = UUID_REGEX.test(p.id || '') ? p.id : generateUUID();
  const dId = UUID_REGEX.test(p.despesa_id || fallbackDespesaId || '') ? (p.despesa_id || fallbackDespesaId) : fallbackDespesaId;

  return {
    id: pId,
    tenant_id: p.tenant_id || fallbackTenantId || 'default_tenant',
    empresa_id: p.tenant_id || fallbackTenantId || 'default_tenant',
    despesa_id: dId,
    numero_parcela: Number(p.numero_parcela) || 1,
    valor: Number(p.valor) || 0,
    data_vencimento: p.data_vencimento ? p.data_vencimento.split('T')[0] : new Date().toISOString().split('T')[0],
    data_pagamento: p.data_pagamento ? p.data_pagamento.split('T')[0] : null,
    valor_pago: p.valor_pago !== undefined && p.valor_pago !== null ? Number(p.valor_pago) : null,
    status: p.status || 'pendente',
    forma_pagamento: p.forma_pagamento || 'pix',
    forma_pagamento_efetivo: p.forma_pagamento_efetivo || null,
    conta_bancaria_id: p.conta_bancaria_id && UUID_REGEX.test(p.conta_bancaria_id) ? p.conta_bancaria_id : null,
    comprovante_url: p.comprovante_url || null,
    observacoes: p.observacoes || (p as any).observacao || null,
    observacao_pagamento: p.observacao_pagamento || null,
    credor_nome: p.credor_nome || null,
    credor_cpf_cnpj: p.credor_cpf_cnpj || null,
    descricao: p.descricao || null,
    pago_em: p.pago_em || null,
    pago_por: p.pago_por || null,
    total_parcelas: Number(p.total_parcelas) || 1,
    criado_em: p.criado_em || new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  };
};

export const sanitizeDespesaForSupabase = (d: Despesa) => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const dId = UUID_REGEX.test(d.id || '') ? d.id : generateUUID();

  return {
    id: dId,
    tenant_id: d.tenant_id || 'default_tenant',
    empresa_id: d.tenant_id || 'default_tenant',
    tipo_credor: d.tipo_credor || 'fornecedor',
    fornecedor_id: d.fornecedor_id && UUID_REGEX.test(d.fornecedor_id) ? d.fornecedor_id : null,
    fornecedor_nome: d.fornecedor_nome || null,
    fornecedor_cnpj_cpf: d.fornecedor_cnpj_cpf || null,
    funcionario_id: d.funcionario_id && UUID_REGEX.test(d.funcionario_id) ? d.funcionario_id : null,
    funcionario_nome: d.funcionario_nome || null,
    funcionario_cpf: d.funcionario_cpf || null,
    credor_nome: d.credor_nome || d.fornecedor_nome || 'Credor',
    credor_cpf_cnpj: d.credor_cpf_cnpj || d.fornecedor_cnpj_cpf || null,
    descricao: d.descricao || 'Despesa',
    categoria: d.categoria || 'Geral',
    centro_custo: d.centro_custo || null,
    data_emissao: d.data_emissao ? d.data_emissao.split('T')[0] : new Date().toISOString().split('T')[0],
    data_inicio_pagamento: d.data_inicio_pagamento ? d.data_inicio_pagamento.split('T')[0] : new Date().toISOString().split('T')[0],
    valor_total: Number(d.valor_total) || 0,
    qtd_parcelas: Number(d.qtd_parcelas) || 1,
    forma_pagamento_padrao: d.forma_pagamento_padrao || 'pix',
    conta_bancaria_id: d.conta_bancaria_id && UUID_REGEX.test(d.conta_bancaria_id) ? d.conta_bancaria_id : null,
    codigo_barras: d.codigo_barras || null,
    observacoes: d.observacoes || null,
    status: d.status || 'ativo',
    atendimento_id: d.atendimento_id && UUID_REGEX.test(d.atendimento_id) ? d.atendimento_id : null,
    criado_em: d.criado_em || new Date().toISOString(),
    criado_por: d.criado_por || 'Sistema',
    atualizado_em: new Date().toISOString()
  };
};

export const salvarDespesa = async (isOnline: boolean, despesa: Despesa, parcelas: ParcelaPagar[]): Promise<void> => {
  const sanitizedDespesa = sanitizeDespesaForSupabase(despesa);
  const despesaId = sanitizedDespesa.id;

  if (isOnline) {
    try {
      const { error } = await supabase.from('despesas').upsert(sanitizedDespesa);
      if (error) console.error('Supabase save despesa error:', error);
    } catch (e) {
      console.error('Supabase save despesa threw:', e);
    }
  } else {
    await addToSyncQueue({
      storeName: 'despesas',
      action: 'update',
      data: sanitizedDespesa
    });
  }
  await saveToIDB('despesas', sanitizedDespesa);

  // Deletar parcelas órfãs
  const existingParcelas = await getAllFromIDB<ParcelaPagar>('parcelas_pagar');
  const orphanParcelas = existingParcelas.filter(p => p.despesa_id === despesaId && !parcelas.find(np => np.id === p.id));
  
  for (const orphan of orphanParcelas) {
    if (isOnline) {
      try {
        await supabase.from('parcelas_pagar').delete().eq('id', orphan.id);
      } catch (e) {
        console.warn('Supabase delete orphaned parcela_pagar threw:', e);
      }
    } else {
      await addToSyncQueue({
        storeName: 'parcelas_pagar',
        action: 'delete',
        data: { id: orphan.id } as any
      });
    }
    await deleteFromIDB('parcelas_pagar', orphan.id);
  }

  for (const p of parcelas) {
    const sanitizedParcela = sanitizeParcelaPagarForSupabase(p, despesaId, sanitizedDespesa.tenant_id);

    if (isOnline) {
      try {
        const { error } = await supabase.from('parcelas_pagar').upsert(sanitizedParcela);
        if (error) console.error('Supabase save parcela_pagar error:', error);
      } catch (e) {
        console.error('Supabase save parcela_pagar threw:', e);
      }
    } else {
      await addToSyncQueue({
        storeName: 'parcelas_pagar',
        action: 'update',
        data: sanitizedParcela
      });
    }
    await saveToIDB('parcelas_pagar', sanitizedParcela);
  }

  await registrarAuditoria('Salvar Despesa', { id: despesaId, descricao: sanitizedDespesa.descricao });
};

export const getParcelasPagar = async (isOnline: boolean, tenantId: string): Promise<ParcelaPagar[]> => {
  let parcelas: ParcelaPagar[] = [];
  const localParcelas = await getAllFromIDB<ParcelaPagar>('parcelas_pagar');

  if (isOnline) {
    try {
      let query = supabase.from('parcelas_pagar').select('*');
      if (tenantId && tenantId !== 'all') {
        query = query.or(`tenant_id.eq.${tenantId},tenant_id.eq.default_tenant,tenant_id.eq.empresa_padrao`);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        for (const item of data) {
          await saveToIDB('parcelas_pagar', item);
        }
        
        // Merge Supabase com os locais
        const remoteMap = new Map<string, ParcelaPagar>();
        data.forEach((item: any) => remoteMap.set(item.id, item));
        (localParcelas || []).forEach(localItem => {
          if (!remoteMap.has(localItem.id) && !localItem.deleted_at) {
            remoteMap.set(localItem.id, localItem);
          }
        });
        parcelas = Array.from(remoteMap.values());
      } else {
        parcelas = localParcelas || [];
      }
    } catch (error) {
      console.warn('Supabase fetch parcelas_pagar failed, using IDB fallback.', error);
      parcelas = localParcelas || [];
    }
  } else {
    parcelas = localParcelas || [];
  }

  return (parcelas || []).filter(p => {
    if (!p) return false;
    if (p.deleted_at) return false;
    if (tenantId && tenantId !== 'all') {
      const matchTenant = !p.tenant_id || 
        p.tenant_id === tenantId || 
        p.tenant_id === 'all' || 
        p.tenant_id === 'default_tenant' || 
        p.tenant_id === 'empresa_padrao';
      if (!matchTenant) return false;
    }
    return true;
  });
};

export const registrarRecebimento = async (isOnline: boolean, parcelaId: string, dadosRecebimento: any): Promise<void> => {
  let parcela = await getFromIDB<ParcelaReceber>('parcelas_receber', parcelaId);

  if (!parcela && isOnline) {
    try {
      const { data, error } = await supabase.from('parcelas_receber').select('*').eq('id', parcelaId).maybeSingle();
      if (!error && data) {
        parcela = data;
      }
    } catch (e) {
      console.warn('Falha ao buscar parcela remota no Supabase:', e);
    }
  }

  if (!parcela) {
    throw new Error('Parcela não encontrada para efetivar recebimento.');
  }

  const dataRecebimentoISO = dadosRecebimento.data_recebimento || new Date().toISOString();
  const valorRecebidoNum = Number(dadosRecebimento.valor_recebido) || parcela.valor;

  const parcelaAtualizada: ParcelaReceber = {
    ...parcela,
    status: 'recebido',
    data_recebimento: dataRecebimentoISO,
    recebido_em: dataRecebimentoISO,
    data_pagamento: dataRecebimentoISO.split('T')[0],
    valor_recebido: valorRecebidoNum,
    valor_pago: valorRecebidoNum,
    forma_pagamento_efetivo: dadosRecebimento.forma_pagamento_efetivo || parcela.forma_pagamento,
    conta_bancaria_id: dadosRecebimento.conta_bancaria_id || parcela.conta_bancaria_id,
    recebido_por: dadosRecebimento.recebido_por || 'Sistema',
    observacao_recebimento: dadosRecebimento.observacao || dadosRecebimento.observacao_recebimento
  };

  const sanitized = sanitizeParcelaReceberForSupabase(parcelaAtualizada);

  if (isOnline) {
    try {
      const { error } = await supabase.from('parcelas_receber').upsert(sanitized);
      if (error) {
        console.error('Supabase update parcela_receber error:', error);
        throw new Error(`Erro ao atualizar parcela no Supabase: ${error.message}`);
      }
    } catch (e: any) {
      console.error('Supabase update error:', e);
      throw e;
    }
  } else {
    await addToSyncQueue({
      storeName: 'parcelas_receber',
      action: 'update',
      data: sanitized
    });
  }

  await saveToIDB('parcelas_receber', { ...parcelaAtualizada, ...sanitized });
  await registrarAuditoria('Registrar Recebimento', { id: parcelaId, valor: sanitized.valor_recebido });
};

export const registrarPagamento = async (isOnline: boolean, parcelaId: string, dadosPagamento: any): Promise<void> => {
  let parcela = await getFromIDB<ParcelaPagar>('parcelas_pagar', parcelaId);

  if (!parcela && isOnline) {
    try {
      const { data, error } = await supabase.from('parcelas_pagar').select('*').eq('id', parcelaId).maybeSingle();
      if (!error && data) {
        parcela = data;
      }
    } catch (e) {
      console.warn('Falha ao buscar parcela remota no Supabase:', e);
    }
  }

  if (!parcela) {
    throw new Error('Parcela não encontrada para efetivar pagamento.');
  }

  const dataPagamentoStr = dadosPagamento.data_pagamento ? dadosPagamento.data_pagamento.split('T')[0] : new Date().toISOString().split('T')[0];
  const valorPagoNum = Number(dadosPagamento.valor_pago) || parcela.valor;

  const parcelaAtualizada: ParcelaPagar = {
    ...parcela,
    status: 'pago',
    data_pagamento: dataPagamentoStr,
    valor_pago: valorPagoNum,
    forma_pagamento_efetivo: dadosPagamento.forma_pagamento_efetivo || parcela.forma_pagamento,
    conta_bancaria_id: dadosPagamento.conta_bancaria_id || parcela.conta_bancaria_id,
    pago_por: dadosPagamento.pago_por || 'Sistema',
    observacao_pagamento: dadosPagamento.observacao || dadosPagamento.observacao_pagamento,
    pago_em: new Date().toISOString()
  };

  const sanitized = sanitizeParcelaPagarForSupabase(parcelaAtualizada);

  if (isOnline) {
    try {
      const { error } = await supabase.from('parcelas_pagar').upsert(sanitized);
      if (error) {
        console.error('Supabase update parcela_pagar error:', error);
        throw new Error(`Erro ao atualizar parcela no Supabase: ${error.message}`);
      }
    } catch (e: any) {
      console.error('Supabase update error:', e);
      throw e;
    }
  } else {
    await addToSyncQueue({
      storeName: 'parcelas_pagar',
      action: 'update',
      data: sanitized
    });
  }

  await saveToIDB('parcelas_pagar', { ...parcelaAtualizada, ...sanitized });
  await registrarAuditoria('Registrar Pagamento', { id: parcelaId, valor: sanitized.valor_pago });
};


export const estornarRecebimento = async (isOnline: boolean, parcelaId: string, observacao: string): Promise<void> => {
  let parcela = await getFromIDB<ParcelaReceber>('parcelas_receber', parcelaId);

  if (!parcela && isOnline) {
    try {
      const { data, error } = await supabase.from('parcelas_receber').select('*').eq('id', parcelaId).maybeSingle();
      if (!error && data) {
        parcela = data;
      }
    } catch (e) {
      console.warn('Falha ao buscar parcela remota no Supabase:', e);
    }
  }

  if (!parcela) return;

  const dataVencimento = new Date(parcela.data_vencimento + 'T12:00:00');
  const now = new Date();
  const novoStatus = dataVencimento < now ? 'atrasado' : 'pendente';

  const parcelaAtualizada: ParcelaReceber = {
    ...parcela,
    status: novoStatus,
    data_recebimento: null as any,
    data_pagamento: null as any,
    recebido_em: null as any,
    valor_recebido: null as any,
    valor_pago: null as any,
    forma_pagamento_efetivo: null as any,
    recebido_por: null as any,
    observacao_recebimento: `Estornado: ${observacao}`
  };

  const sanitized = sanitizeParcelaReceberForSupabase(parcelaAtualizada);

  if (isOnline) {
    try {
      const { error } = await supabase.from('parcelas_receber').upsert(sanitized);
      if (error) {
        console.error('Supabase update parcela_receber error:', error);
        throw new Error(`Erro ao estornar parcela no Supabase: ${error.message}`);
      }
    } catch (e: any) {
      console.error('Supabase update error:', e);
      throw e;
    }
  } else {
    await addToSyncQueue({
      storeName: 'parcelas_receber',
      action: 'update',
      data: sanitized
    });
  }

  await saveToIDB('parcelas_receber', { ...parcelaAtualizada, ...sanitized });
  await registrarAuditoria('Estorno Recebimento', { id: parcelaId, valor: parcela.valor_recebido });
};

export const estornarPagamento = async (isOnline: boolean, parcelaId: string, observacao: string): Promise<void> => {
  const parcela = await getFromIDB<ParcelaPagar>('parcelas_pagar', parcelaId);
  if (!parcela) return;

  const dataVencimento = new Date(parcela.data_vencimento + 'T12:00:00');
  const now = new Date();
  const novoStatus = dataVencimento < now ? 'atrasado' : 'pendente';

  const parcelaAtualizada: ParcelaPagar = {
    ...parcela,
    status: novoStatus,
    data_pagamento: null as any,
    valor_pago: null as any,
    forma_pagamento_efetivo: null as any,
    pago_por: null as any,
    observacao_pagamento: `Estornado: ${observacao}`
  };

  const sanitized = sanitizeParcelaPagarForSupabase(parcelaAtualizada);

  if (isOnline) {
    try {
      const { error } = await supabase.from('parcelas_pagar').upsert(sanitized);
      if (error) console.error('Supabase update parcela_pagar error:', error);
    } catch (e) {
      console.error('Supabase update error:', e);
    }
  } else {
    await addToSyncQueue({
      storeName: 'parcelas_pagar',
      action: 'update',
      data: sanitized
    });
  }

  await saveToIDB('parcelas_pagar', sanitized);
  await registrarAuditoria('Estorno Pagamento', { id: parcelaId, valor: parcela.valor_pago });
};

export const excluirParcelaReceber = async (isOnline: boolean, parcelaId: string): Promise<void> => {
  if (isOnline) {
    try {
      const { error } = await supabase.from('parcelas_receber').delete().eq('id', parcelaId);
      if (error) console.warn('Supabase delete parcela_receber error:', error);
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
  } else {
    await addToSyncQueue({
      storeName: 'parcelas_receber',
      action: 'delete',
      data: { id: parcelaId }
    });
  }
  await deleteFromIDB('parcelas_receber', parcelaId);
  await registrarAuditoria('Excluir Parcela Receber', { id: parcelaId });
};

export const excluirReceita = async (isOnline: boolean, receitaId: string): Promise<void> => {
  // 1. Exclui receita e parcelas associadas no IDB
  await deleteFromIDB('receitas', receitaId);
  const allParcelas = await getAllFromIDB<ParcelaReceber>('parcelas_receber');
  const relatedParcelas = allParcelas.filter(p => p.receita_id === receitaId);
  for (const p of relatedParcelas) {
    await deleteFromIDB('parcelas_receber', p.id);
  }

  // 2. Exclusão em cascata no Supabase
  if (isOnline) {
    try {
      await supabase.from('parcelas_receber').delete().eq('receita_id', receitaId);
      const { error } = await supabase.from('receitas').delete().eq('id', receitaId);
      if (error) {
        await supabase.from('receitas').update({ deleted_at: new Date().toISOString(), status: 'cancelado' }).eq('id', receitaId);
      }
    } catch (e) {
      console.warn('Supabase delete receita error:', e);
      await addToSyncQueue({
        storeName: 'receitas',
        action: 'delete',
        data: { id: receitaId }
      });
    }
  } else {
    await addToSyncQueue({
      storeName: 'receitas',
      action: 'delete',
      data: { id: receitaId }
    });
  }
  await registrarAuditoria('Excluir Receita e Parcelas', { id: receitaId });
};

export const excluirParcelaPagar = async (isOnline: boolean, parcelaId: string): Promise<void> => {
  // 1. Remove do IDB imediatamente para resposta instantânea na interface
  await deleteFromIDB('parcelas_pagar', parcelaId);

  // 2. Desvincula de remessas de faturamento se for o caso
  try {
    const allRemessas = await getAllFromIDB<any>('remessas_faturamento');
    const linkedRems = (allRemessas || []).filter(r => r && (r.parcela_pagar_id === parcelaId || r.despesa_id === parcelaId));
    for (const rem of linkedRems) {
      rem.parcela_pagar_id = null;
      rem.parcela_excluida = true;
      await saveToIDB('remessas_faturamento', rem);
      if (isOnline) {
        try {
          await supabase.from('remessas_faturamento').upsert(rem);
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Erro ao desvincular remessa na exclusão de parcela:', e);
  }

  // 3. Exclui do Supabase ou coloca na fila
  if (isOnline) {
    try {
      const { error } = await supabase.from('parcelas_pagar').delete().eq('id', parcelaId);
      if (error) {
        console.warn('Supabase delete parcela_pagar error, enqueuing:', error);
        await addToSyncQueue({
          storeName: 'parcelas_pagar',
          action: 'delete',
          data: { id: parcelaId }
        });
      }
    } catch (e) {
      await addToSyncQueue({
        storeName: 'parcelas_pagar',
        action: 'delete',
        data: { id: parcelaId }
      });
    }
  } else {
    await addToSyncQueue({
      storeName: 'parcelas_pagar',
      action: 'delete',
      data: { id: parcelaId }
    });
  }

  try {
    await registrarAuditoria('Excluir Parcela Pagar', { id: parcelaId });
  } catch (e) {}
};

export const excluirDespesa = async (isOnline: boolean, despesaId: string): Promise<void> => {
  // 1. Exclui do IDB imediatamente
  await deleteFromIDB('despesas', despesaId);

  // 2. Exclui parcelas filhas no IDB
  const allParcelas = await getAllFromIDB<ParcelaPagar>('parcelas_pagar');
  const relatedParcelas = (allParcelas || []).filter(p => p && p.despesa_id === despesaId);
  for (const p of relatedParcelas) {
    await deleteFromIDB('parcelas_pagar', p.id);
  }

  // 3. Desvincula de remessas
  try {
    const allRemessas = await getAllFromIDB<any>('remessas_faturamento');
    const linkedRems = (allRemessas || []).filter(r => r && r.despesa_id === despesaId);
    for (const rem of linkedRems) {
      rem.despesa_id = null;
      rem.parcela_pagar_id = null;
      rem.parcela_excluida = true;
      await saveToIDB('remessas_faturamento', rem);
      if (isOnline) {
        try {
          await supabase.from('remessas_faturamento').upsert(rem);
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Erro ao desvincular remessa na exclusão de parcela:', e);
  }

  // 4. Exclui do Supabase em cascata ou enfileira
  if (isOnline) {
    try {
      await supabase.from('parcelas_pagar').delete().eq('despesa_id', despesaId);
      const { error } = await supabase.from('despesas').delete().eq('id', despesaId);
      if (error) {
        await supabase.from('despesas').update({ deleted_at: new Date().toISOString(), status: 'cancelado' }).eq('id', despesaId);
      }
    } catch (e) {
      console.warn('Supabase delete despesa error, enqueuing:', e);
      await addToSyncQueue({
        storeName: 'despesas',
        action: 'delete',
        data: { id: despesaId }
      });
    }
  } else {
    await addToSyncQueue({
      storeName: 'despesas',
      action: 'delete',
      data: { id: despesaId }
    });
  }

  try {
    await registrarAuditoria('Excluir Despesa e Parcelas', { id: despesaId });
  } catch (e) {}
};

export const getReceitaCompleta = async (
  isOnline: boolean,
  idOrParcelaId: string,
  parcelaIdHint?: string | null
): Promise<{ receita: Receita | null; parcelas: ParcelaReceber[] }> => {
  let receita: Receita | null = null;
  let targetReceitaId = idOrParcelaId;
  let parcelaRef: ParcelaReceber | null = null;

  // 1. Tenta buscar a receita diretamente pelo ID
  if (isOnline) {
    try {
      const { data, error } = await supabase.from('receitas').select('*').eq('id', targetReceitaId).maybeSingle();
      if (!error && data) {
        receita = data;
      }
    } catch (e) {
      console.warn('Erro ao buscar receita no Supabase:', e);
    }
  }

  if (!receita) {
    receita = await getFromIDB<Receita>('receitas', targetReceitaId) || null;
  }

  // 2. Se não encontrou receita com esse ID ou temos um hint de parcela, busca a parcela de referência
  if (isOnline) {
    try {
      const { data: pData } = await supabase.from('parcelas_receber').select('*').eq('id', targetReceitaId).maybeSingle();
      if (pData) parcelaRef = pData;
    } catch (e) {
      console.warn('Erro ao buscar parcela por ID no Supabase:', e);
    }
  }
  if (!parcelaRef) {
    parcelaRef = await getFromIDB<ParcelaReceber>('parcelas_receber', targetReceitaId) || null;
  }

  if (!parcelaRef && parcelaIdHint) {
    if (isOnline) {
      try {
        const { data: pData } = await supabase.from('parcelas_receber').select('*').eq('id', parcelaIdHint).maybeSingle();
        if (pData) parcelaRef = pData;
      } catch (e) {
        console.warn('Erro ao buscar parcelaIdHint no Supabase:', e);
      }
    }
    if (!parcelaRef) {
      parcelaRef = await getFromIDB<ParcelaReceber>('parcelas_receber', parcelaIdHint) || null;
    }
  }

  // Se não tínhamos a receita mas a parcela possui receita_id, busca a receita pai
  if (!receita && parcelaRef && parcelaRef.receita_id) {
    targetReceitaId = parcelaRef.receita_id;
    if (isOnline) {
      try {
        const { data: rData } = await supabase.from('receitas').select('*').eq('id', targetReceitaId).maybeSingle();
        if (rData) receita = rData;
      } catch (e) {
        console.warn('Erro ao buscar receita pai pelo receita_id da parcela:', e);
      }
    }
    if (!receita) {
      receita = await getFromIDB<Receita>('receitas', targetReceitaId) || null;
    }
  }

  // 3. Carregar todas as parcelas dessa receita (ou vinculadas)
  let parcelas: ParcelaReceber[] = [];
  const searchReceitaId = receita?.id || parcelaRef?.receita_id;

  if (searchReceitaId) {
    if (isOnline) {
      try {
        const { data: pList, error: pErr } = await supabase
          .from('parcelas_receber')
          .select('*')
          .eq('receita_id', searchReceitaId)
          .order('numero_parcela', { ascending: true });
        if (!pErr && pList && pList.length > 0) {
          parcelas = pList;
          for (const p of pList) {
            await saveToIDB('parcelas_receber', p);
          }
        }
      } catch (e) {
        console.warn('Erro ao buscar parcelas da receita no Supabase:', e);
      }
    }

    if (parcelas.length === 0) {
      const allIDBParcelas = await getAllFromIDB<ParcelaReceber>('parcelas_receber');
      parcelas = allIDBParcelas
        .filter(p => p.receita_id === searchReceitaId)
        .sort((a, b) => (a.numero_parcela || 0) - (b.numero_parcela || 0));
    }
  }

  if (parcelas.length === 0 && parcelaRef) {
    parcelas = [parcelaRef];
  }

  // 4. Se a receita não foi encontrada na tabela de receitas, mas temos parcela(s), sintetiza a receita
  if (!receita && parcelaRef) {
    const totalParcs = Number(parcelaRef.total_parcelas) || parcelas.length || 1;
    const somaValores = parcelas.length > 0
      ? parcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)
      : (Number(parcelaRef.valor) || 0) * totalParcs;

    receita = {
      id: parcelaRef.receita_id || parcelaRef.id,
      tenant_id: parcelaRef.tenant_id,
      tipo_devedor: (parcelaRef.tipo_devedor as any) || 'associado',
      associado_id: (parcelaRef as any).associado_id,
      associado_nome: parcelaRef.devedor_nome,
      associado_cpf: parcelaRef.devedor_cpf_cnpj,
      cliente_nome: parcelaRef.devedor_nome,
      cliente_cpf_cnpj: parcelaRef.devedor_cpf_cnpj,
      descricao: parcelaRef.descricao || 'Receita de Mensalidade / Plano',
      categoria: 'Mensalidade',
      data_emissao: parcelaRef.data_vencimento ? parcelaRef.data_vencimento.split('T')[0] : new Date().toISOString().split('T')[0],
      data_inicio_cobranca: parcelaRef.data_vencimento ? parcelaRef.data_vencimento.split('T')[0] : new Date().toISOString().split('T')[0],
      valor_total: somaValores,
      qtd_parcelas: totalParcs,
      forma_pagamento_padrao: parcelaRef.forma_pagamento || 'Boleto',
      conta_bancaria_id: parcelaRef.conta_bancaria_id,
      status: 'ativo'
    };
  }

  // 5. Enriquecimento de dados se algum campo prioritário estiver ausente na receita
  if (receita) {
    if (!receita.associado_id && (parcelaRef as any)?.associado_id) {
      receita.associado_id = (parcelaRef as any).associado_id;
    }
    if (!receita.associado_nome && parcelaRef?.devedor_nome) {
      receita.associado_nome = parcelaRef.devedor_nome;
    }
    if (!receita.associado_cpf && parcelaRef?.devedor_cpf_cnpj) {
      receita.associado_cpf = parcelaRef.devedor_cpf_cnpj;
    }
    if (!receita.forma_pagamento_padrao && (parcelaRef?.forma_pagamento || parcelas[0]?.forma_pagamento)) {
      receita.forma_pagamento_padrao = parcelaRef?.forma_pagamento || parcelas[0]?.forma_pagamento || 'pix';
    }
    if (!receita.data_inicio_cobranca && (parcelas[0]?.data_vencimento || parcelaRef?.data_vencimento)) {
      receita.data_inicio_cobranca = parcelas[0]?.data_vencimento || parcelaRef?.data_vencimento || new Date().toISOString().split('T')[0];
    }
    if ((!receita.valor_total || Number(receita.valor_total) === 0) && parcelas.length > 0) {
      receita.valor_total = parcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    }
    if ((!receita.qtd_parcelas || Number(receita.qtd_parcelas) === 0) && parcelas.length > 0) {
      receita.qtd_parcelas = parcelas.length;
    }

    await saveToIDB('receitas', receita);
  }

  return { receita, parcelas };
};

export const getReceitaById = async (isOnline: boolean, id: string): Promise<Receita | null> => {
  const { receita } = await getReceitaCompleta(isOnline, id);
  return receita;
};

export const getDespesaCompleta = async (
  isOnline: boolean,
  idOrParcelaId: string,
  parcelaIdHint?: string | null
): Promise<{ despesa: Despesa | null; parcelas: ParcelaPagar[] }> => {
  let despesa: Despesa | null = null;
  let targetDespesaId = idOrParcelaId;

  // 1. Tenta buscar a despesa diretamente pelo ID
  if (isOnline) {
    try {
      const { data, error } = await supabase.from('despesas').select('*').eq('id', targetDespesaId).maybeSingle();
      if (!error && data) {
        despesa = data;
      }
    } catch (e) {
      console.warn('Erro ao buscar despesa no Supabase:', e);
    }
  }

  if (!despesa) {
    despesa = await getFromIDB<Despesa>('despesas', targetDespesaId) || null;
  }

  // 2. Se não encontrou despesa com esse ID, pode ser que o ID recebido seja o ID de uma parcela_pagar
  if (!despesa) {
    let parcelaRef: ParcelaPagar | null = null;
    if (isOnline) {
      try {
        const { data: pData } = await supabase.from('parcelas_pagar').select('*').eq('id', targetDespesaId).maybeSingle();
        if (pData) parcelaRef = pData;
      } catch (e) {
        console.warn('Erro ao buscar parcela por ID no Supabase:', e);
      }
    }
    if (!parcelaRef) {
      parcelaRef = await getFromIDB<ParcelaPagar>('parcelas_pagar', targetDespesaId) || null;
    }

    // Se ainda não achou e temos um parcelaIdHint
    if (!parcelaRef && parcelaIdHint) {
      if (isOnline) {
        try {
          const { data: pData } = await supabase.from('parcelas_pagar').select('*').eq('id', parcelaIdHint).maybeSingle();
          if (pData) parcelaRef = pData;
        } catch (e) {
          console.warn('Erro ao buscar parcelaIdHint no Supabase:', e);
        }
      }
      if (!parcelaRef) {
        parcelaRef = await getFromIDB<ParcelaPagar>('parcelas_pagar', parcelaIdHint) || null;
      }
    }

    if (parcelaRef && parcelaRef.despesa_id) {
      targetDespesaId = parcelaRef.despesa_id;
      if (isOnline) {
        try {
          const { data: dData } = await supabase.from('despesas').select('*').eq('id', targetDespesaId).maybeSingle();
          if (dData) despesa = dData;
        } catch (e) {
          console.warn('Erro ao buscar despesa pai pelo despesa_id da parcela:', e);
        }
      }
      if (!despesa) {
        despesa = await getFromIDB<Despesa>('despesas', targetDespesaId) || null;
      }
    }
  }

  // 3. Carregar todas as parcelas dessa despesa
  let parcelas: ParcelaPagar[] = [];
  if (despesa) {
    await saveToIDB('despesas', despesa);
    if (isOnline) {
      try {
        const { data: pList, error: pErr } = await supabase
          .from('parcelas_pagar')
          .select('*')
          .eq('despesa_id', despesa.id)
          .order('numero_parcela', { ascending: true });
        if (!pErr && pList && pList.length > 0) {
          parcelas = pList;
          for (const p of pList) {
            await saveToIDB('parcelas_pagar', p);
          }
        }
      } catch (e) {
        console.warn('Erro ao buscar parcelas da despesa no Supabase:', e);
      }
    }

    if (parcelas.length === 0) {
      const allIDBParcelas = await getAllFromIDB<ParcelaPagar>('parcelas_pagar');
      parcelas = allIDBParcelas
        .filter(p => p.despesa_id === despesa!.id)
        .sort((a, b) => (a.numero_parcela || 0) - (b.numero_parcela || 0));
    }
  }

  return { despesa, parcelas };
};

export const getDespesaById = async (isOnline: boolean, id: string): Promise<Despesa | null> => {
  const { despesa } = await getDespesaCompleta(isOnline, id);
  return despesa;
};




export const cancelarDespesa = async (isOnline: boolean, despesaId: string): Promise<void> => {
  if (isOnline) {
    try {
      const { error: err1 } = await supabase.from('despesas').update({ status: 'cancelado' }).eq('id', despesaId);
      if (err1) throw err1;
      const { error: err2 } = await supabase.from('parcelas_pagar').update({ status: 'cancelado' }).eq('despesa_id', despesaId);
      if (err2) throw err2;
    } catch (e) {
      console.warn("Erro ao cancelar despesa no Supabase:", e);
    }
  }

  // Update in IDB
  const despesa = await getFromIDB<Despesa>('despesas', despesaId);
  if (despesa) {
    despesa.status = 'cancelado';
    await saveToIDB('despesas', despesa);
  }

  const todasParcelas = await getAllFromIDB<ParcelaPagar>('parcelas_pagar');
  const parcelasDaDespesa = todasParcelas.filter(p => p.despesa_id === despesaId);
  for (const p of parcelasDaDespesa) {
    p.status = 'cancelado';
    await saveToIDB('parcelas_pagar', p);
  }

  if (isOnline) {
    await registrarAuditoria('Cancelamento de Despesa e Parcelas', { despesa_id: despesaId });
  } else {
    await addToSyncQueue({ storeName: 'despesas', action: 'update', data: { id: despesaId, status: 'cancelado' } });
  }
};


export const cancelarReceitasPorAtendimento = async (atendimentoId: string, isOnline: boolean): Promise<void> => {
  if (isOnline) {
    try {
      const { data: receitas, error: fetchErr } = await supabase
        .from('receitas')
        .select('id')
        .eq('atendimento_id', atendimentoId);

      if (fetchErr) {
        console.warn('Erro ao buscar receitas do atendimento:', fetchErr);
        // Fallback: search by descricao containing the ID if atendimento_id column is unreliable
        const { data: receitasDesc } = await supabase
          .from('receitas')
          .select('id')
          .ilike('descricao', `%${atendimentoId}%`);
          
        if (receitasDesc && receitasDesc.length > 0) {
           const ids = receitasDesc.map(r => r.id);
           await supabase.from('receitas').update({ status: 'cancelado' }).in('id', ids);
           await supabase.from('parcelas_receber').update({ status: 'cancelado' }).in('receita_id', ids).eq('status', 'pendente');
        }
        return;
      }

      if (receitas && receitas.length > 0) {
        const receitaIds = receitas.map(r => r.id);
        
        const { error: err1 } = await supabase
          .from('receitas')
          .update({ status: 'cancelado' })
          .in('id', receitaIds);
          
        if (err1) console.warn('Erro ao cancelar receitas:', err1);

        const { error: err2 } = await supabase
          .from('parcelas_receber')
          .update({ status: 'cancelado' })
          .in('receita_id', receitaIds)
          .eq('status', 'pendente');
          
        if (err2) console.warn('Erro ao cancelar parcelas:', err2);
        
        await registrarAuditoria('Cancelamento Financeiro Atendimento', { atendimento_id: atendimentoId, qtd_receitas: receitaIds.length });
      }
    } catch (e) {
      console.error('Falha ao cancelar receitas vinculadas', e);
    }
  }
  
  // IDB fallback/update
  try {
    const allReceitas = await getAllFromIDB<Receita>('receitas');
    const linkedReceitas = allReceitas.filter(r => r.atendimento_id === atendimentoId || r.descricao.includes(atendimentoId));
    
    for (const r of linkedReceitas) {
      r.status = 'cancelado';
      await saveToIDB('receitas', r);
    }
    
    if (linkedReceitas.length > 0) {
      const allParcelas = await getAllFromIDB<ParcelaReceber>('parcelas_receber');
      const linkedIds = linkedReceitas.map(r => r.id);
      
      for (const p of allParcelas) {
        if (linkedIds.includes(p.receita_id) && p.status === 'pendente') {
          p.status = 'cancelado';
          await saveToIDB('parcelas_receber', p);
        }
      }
    }
  } catch(e) {
    console.error('Erro ao atualizar IDB para receitas canceladas', e);
  }
};


export const getParcelasReceberPorAtendimento = async (atendimentoId: string, isOnline: boolean): Promise<ParcelaReceber[]> => {
  let parcelas: ParcelaReceber[] = [];
  
  if (isOnline) {
    try {
      // First find the receita(s)
      const { data: receitas, error: errRec } = await supabase
        .from('receitas')
        .select('id')
        .eq('atendimento_id', atendimentoId);
        
      let receitaIds = receitas?.map(r => r.id) || [];
      
      if (!receitas || receitas.length === 0) {
        // Fallback to description
        const { data: receitasDesc } = await supabase
          .from('receitas')
          .select('id')
          .ilike('descricao', `%${atendimentoId}%`);
        if (receitasDesc) {
           receitaIds = receitasDesc.map(r => r.id);
        }
      }
      
      if (receitaIds.length > 0) {
         const { data, error } = await supabase
           .from('parcelas_receber')
           .select('*')
           .in('receita_id', receitaIds)
           .order('numero_parcela', { ascending: true });
           
         if (!error && data) {
            parcelas = data as ParcelaReceber[];
            // Sync to IDB could be done here, but usually read handles it in global get.
            return parcelas;
         }
      }
    } catch(e) {
      console.warn('Erro ao buscar parcelas por atendimento online', e);
    }
  }
  
  // Offline fallback
  try {
     const allReceitas = await getAllFromIDB<Receita>('receitas');
     const linkedReceitas = allReceitas.filter(r => r.atendimento_id === atendimentoId || r.descricao.includes(atendimentoId));
     const linkedIds = linkedReceitas.map(r => r.id);
     
     if (linkedIds.length > 0) {
       const allParcelas = await getAllFromIDB<ParcelaReceber>('parcelas_receber');
       parcelas = allParcelas.filter(p => linkedIds.includes(p.receita_id)).sort((a,b) => a.numero_parcela - b.numero_parcela);
     }
  } catch(e) {
     console.warn('Erro IDB', e);
  }
  
  return parcelas;
};

export interface VerificacaoFinanceiraAtendimento {
  temReceita: boolean;
  receitas: Receita[];
  parcelas: ParcelaReceber[];
  temParcelaQuitada: boolean;
  parcelasQuitadas: ParcelaReceber[];
  parcelasPendentes: ParcelaReceber[];
  valorTotalReceitas: number;
  valorTotalQuitado: number;
  valorTotalPendente: number;
}

export const getReceitasPorAtendimento = async (atendimentoId: string, isOnline: boolean): Promise<Receita[]> => {
  let receitas: Receita[] = [];

  if (isOnline) {
    try {
      const { data, error } = await supabase
        .from('receitas')
        .select('*')
        .eq('atendimento_id', atendimentoId);

      if (!error && data && data.length > 0) {
        return data as Receita[];
      }

      // Fallback para buscar na descrição
      const { data: dataDesc, error: errorDesc } = await supabase
        .from('receitas')
        .select('*')
        .ilike('descricao', `%${atendimentoId}%`);

      if (!errorDesc && dataDesc && dataDesc.length > 0) {
        return dataDesc as Receita[];
      }
    } catch (e) {
      console.warn('Erro ao buscar receitas por atendimento online:', e);
    }
  }

  // IDB fallback
  try {
    const allReceitas = await getAllFromIDB<Receita>('receitas');
    receitas = (allReceitas || []).filter(
      r => r && (r.atendimento_id === atendimentoId || (r.descricao && r.descricao.includes(atendimentoId)))
    );
  } catch (e) {
    console.warn('Erro ao buscar receitas por atendimento no IDB:', e);
  }

  return receitas;
};

export const verificarFinanceiroAtendimento = async (
  atendimentoId: string,
  isOnline: boolean
): Promise<VerificacaoFinanceiraAtendimento> => {
  const receitas = await getReceitasPorAtendimento(atendimentoId, isOnline);
  const parcelas = await getParcelasReceberPorAtendimento(atendimentoId, isOnline);

  const parcelasQuitadas = parcelas.filter(p => {
    return (
      p.status === 'pago' ||
      p.status === 'recebido' ||
      Boolean(p.data_pagamento) ||
      Boolean(p.valor_pago && p.valor_pago > 0) ||
      Boolean(p.data_recebimento)
    );
  });

  const parcelasPendentes = parcelas.filter(p => !parcelasQuitadas.includes(p));

  const valorTotalReceitas = receitas.reduce((acc, r) => acc + (Number(r.valor_total) || 0), 0);
  const valorTotalQuitado = parcelasQuitadas.reduce(
    (acc, p) => acc + (Number(p.valor_pago) || Number(p.valor_recebido) || Number(p.valor) || 0),
    0
  );
  const valorTotalPendente = parcelasPendentes.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

  return {
    temReceita: receitas.length > 0,
    receitas,
    parcelas,
    temParcelaQuitada: parcelasQuitadas.length > 0,
    parcelasQuitadas,
    parcelasPendentes,
    valorTotalReceitas,
    valorTotalQuitado,
    valorTotalPendente
  };
};

export const excluirReceitasPorAtendimento = async (
  atendimentoId: string,
  isOnline: boolean
): Promise<{ receitasExcluidas: string[]; parcelasExcluidasCount: number }> => {
  const receitas = await getReceitasPorAtendimento(atendimentoId, isOnline);
  const parcelas = await getParcelasReceberPorAtendimento(atendimentoId, isOnline);

  const idsExcluidos: string[] = [];

  for (const rec of receitas) {
    await excluirReceita(isOnline, rec.id);
    idsExcluidos.push(rec.id);
  }

  return {
    receitasExcluidas: idsExcluidos,
    parcelasExcluidasCount: parcelas.length
  };
};

export const getDespesas = async (isOnline: boolean, tenantId: string): Promise<Despesa[]> => {
  let despesas: Despesa[] = [];
  const localDespesas = await getAllFromIDB<Despesa>('despesas');

  if (isOnline) {
    try {
      let query = supabase.from('despesas').select('*');
      if (tenantId && tenantId !== 'all') {
        query = query.or(`tenant_id.eq.${tenantId},tenant_id.eq.default_tenant,tenant_id.eq.empresa_padrao`);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        for (const item of data) {
          await saveToIDB('despesas', item);
        }
        const remoteMap = new Map<string, Despesa>();
        data.forEach((item: any) => remoteMap.set(item.id, item));
        (localDespesas || []).forEach(localItem => {
          if (!remoteMap.has(localItem.id) && !localItem.deleted_at) {
            remoteMap.set(localItem.id, localItem);
          }
        });
        despesas = Array.from(remoteMap.values());
      } else {
        despesas = localDespesas || [];
      }
    } catch (error) {
      console.warn('Supabase fetch despesas failed, using IDB fallback.', error);
      despesas = localDespesas || [];
    }
  } else {
    despesas = localDespesas || [];
  }

  return (despesas || []).filter(d => {
    if (!d) return false;
    if (d.deleted_at) return false;
    if (tenantId && tenantId !== 'all') {
      const matchTenant = !d.tenant_id || 
        d.tenant_id === tenantId || 
        d.tenant_id === 'all' || 
        d.tenant_id === 'default_tenant' || 
        d.tenant_id === 'empresa_padrao';
      if (!matchTenant) return false;
    }
    return true;
  });
};

export const getReceitas = async (isOnline: boolean, tenantId: string): Promise<Receita[]> => {
  let receitas: Receita[] = [];
  const localReceitas = await getAllFromIDB<Receita>('receitas');

  if (isOnline) {
    try {
      let query = supabase.from('receitas').select('*');
      if (tenantId && tenantId !== 'all') {
        query = query.or(`tenant_id.eq.${tenantId},tenant_id.eq.default_tenant,tenant_id.eq.empresa_padrao`);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        for (const item of data) {
          await saveToIDB('receitas', item);
        }
        const remoteMap = new Map<string, Receita>();
        data.forEach((item: any) => remoteMap.set(item.id, item));
        (localReceitas || []).forEach(localItem => {
          if (!remoteMap.has(localItem.id) && !localItem.deleted_at) {
            remoteMap.set(localItem.id, localItem);
          }
        });
        receitas = Array.from(remoteMap.values());
      } else {
        receitas = localReceitas || [];
      }
    } catch (error) {
      console.warn('Supabase fetch receitas failed, using IDB fallback.', error);
      receitas = localReceitas || [];
    }
  } else {
    receitas = localReceitas || [];
  }

  return (receitas || []).filter(r => {
    if (!r) return false;
    if (r.deleted_at) return false;
    if (tenantId && tenantId !== 'all') {
      const matchTenant = !r.tenant_id || 
        r.tenant_id === tenantId || 
        r.tenant_id === 'all' || 
        r.tenant_id === 'default_tenant' || 
        r.tenant_id === 'empresa_padrao';
      if (!matchTenant) return false;
    }
    return true;
  });
};
