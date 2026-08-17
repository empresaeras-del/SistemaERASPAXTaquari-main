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
}

export const salvarReceita = async (isOnline: boolean, receita: Receita, parcelas: ParcelaReceber[]): Promise<void> => {
  const receitaComData = {
    ...receita,
    criado_em: receita.criado_em || new Date().toISOString()
  };

  if (isOnline) {
    try {
      const { error } = await supabase.from('receitas').upsert(receitaComData);
      if (error) console.warn('Supabase save receita error:', error);
    } catch (e) {
      console.warn('Supabase save receita threw:', e);
    }
  } else {
    await addToSyncQueue({
      storeName: 'receitas',
      action: 'update',
      data: receitaComData
    });
  }
  await saveToIDB('receitas', receitaComData);

  // Deletar parcelas órfãs
  const existingParcelas = await getAllFromIDB<ParcelaReceber>('parcelas_receber');
  const orphanParcelas = existingParcelas.filter(p => p.receita_id === receita.id && !parcelas.find(np => np.id === p.id));
  
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
    const pComData = {
      ...p,
      criado_em: p.criado_em || new Date().toISOString()
    };
    if (isOnline) {
      try {
        const { error } = await supabase.from('parcelas_receber').upsert(pComData);
        if (error) console.warn('Supabase save parcela_receber error:', error);
      } catch (e) {
        console.warn('Supabase save parcela_receber threw:', e);
      }
    } else {
      await addToSyncQueue({
        storeName: 'parcelas_receber',
        action: 'update',
        data: pComData
      });
    }
    await saveToIDB('parcelas_receber', pComData);
  }

  await registrarAuditoria('Salvar Receita', { id: receita.id, descricao: receita.descricao });
};

export const getParcelasReceber = async (isOnline: boolean, tenantId: string): Promise<ParcelaReceber[]> => {
  let parcelas: ParcelaReceber[] = [];

  if (isOnline) {
    try {
      let query = supabase.from('parcelas_receber').select('*');
      if (tenantId && tenantId !== 'all') {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (data) {
        for (const item of data) {
          await saveToIDB('parcelas_receber', item);
        }
      }
      parcelas = data || [];
    } catch (error) {
      console.warn('Supabase fetch parcelas_receber failed, using IDB fallback.', error);
      parcelas = await getAllFromIDB<ParcelaReceber>('parcelas_receber');
    }
  } else {
    parcelas = await getAllFromIDB<ParcelaReceber>('parcelas_receber');
  }

  return parcelas.filter(p => {
    if (!p) return false;
    if (tenantId && tenantId !== 'all' && p.tenant_id && p.tenant_id !== tenantId) return false;
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

  if (isOnline) {
    try {
      let query = supabase.from('parcelas_pagar').select('*');
      if (tenantId && tenantId !== 'all') {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (error) {
        // Se der erro no filtro, busca todos
        const fallbackRes = await supabase.from('parcelas_pagar').select('*');
        if (!fallbackRes.error && fallbackRes.data) {
          for (const item of fallbackRes.data) {
            await saveToIDB('parcelas_pagar', item);
          }
          parcelas = fallbackRes.data || [];
        } else {
          throw error;
        }
      } else if (data) {
        for (const item of data) {
          await saveToIDB('parcelas_pagar', item);
        }
        parcelas = data || [];
      }
    } catch (error) {
      console.warn('Supabase fetch parcelas_pagar failed, using IDB fallback.', error);
      parcelas = await getAllFromIDB<ParcelaPagar>('parcelas_pagar');
    }
  } else {
    parcelas = await getAllFromIDB<ParcelaPagar>('parcelas_pagar');
  }

  // Sincronização e Geração Automática para Remessas Fechadas:
  // Garante que toda remessa com status 'fechada' possua sua respectiva parcela no Contas a Pagar
  try {
    let remessasFechadas: any[] = [];
    if (isOnline) {
      try {
        let qRems = supabase.from('remessas_faturamento').select('*').eq('status', 'fechada');
        if (tenantId && tenantId !== 'all') {
          qRems = qRems.eq('tenant_id', tenantId);
        }
        const { data: remsSupabase } = await qRems;
        if (remsSupabase && remsSupabase.length > 0) {
          remessasFechadas = remsSupabase;
          for (const r of remsSupabase) {
            await saveToIDB('remessas_faturamento', r);
          }
        }
      } catch (rErr) {
        // fallback IDB
      }
    }
    
    if (remessasFechadas.length === 0) {
      const allRemsIDB = await getAllFromIDB<any>('remessas_faturamento');
      remessasFechadas = (allRemsIDB || []).filter(r => r && r.status === 'fechada');
      if (tenantId && tenantId !== 'all') {
        remessasFechadas = remessasFechadas.filter(r => r.tenant_id === tenantId || r.tenant_id === 'default_tenant');
      }
    }

    for (const rem of remessasFechadas) {
      if (!rem || rem.valor_liquido <= 0) continue;

      // Verifica se a parcela já existe pelo parcela_pagar_id ou pela descrição da remessa
      const jaExiste = parcelas.some(p => 
        (rem.parcela_pagar_id && p.id === rem.parcela_pagar_id) ||
        (rem.codigo_remessa && p.descricao && p.descricao.includes(rem.codigo_remessa))
      );

      if (!jaExiste) {
        const despesaId = rem.despesa_id || generateUUID();
        const parcelaId = rem.parcela_pagar_id || generateUUID();
        const effectiveTenant = rem.tenant_id || tenantId || 'default_tenant';
        const vencimento = rem.data_vencimento_pagamento || 
          new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dataCriacao = rem.data_fechamento || rem.data_criacao || new Date().toISOString();

        const novaDespesa: Despesa = {
          id: despesaId,
          tenant_id: effectiveTenant,
          tipo_credor: 'fornecedor_pj',
          credor_nome: rem.credenciado_nome,
          credor_cpf_cnpj: rem.credenciado_cnpj_cpf,
          descricao: `Faturamento Remessa ${rem.codigo_remessa} - ${rem.credenciado_nome} (${rem.qtd_guias || 1} guias)`,
          categoria: 'Repasse Credenciados / Prestadores',
          centro_custo: 'Rede Assistencial',
          data_emissao: dataCriacao,
          data_inicio_pagamento: vencimento,
          valor_total: rem.valor_liquido,
          qtd_parcelas: 1,
          forma_pagamento_padrao: 'pix',
          observacoes: `Gerado automaticamente pelo fechamento da Remessa ${rem.codigo_remessa}. ${rem.observacoes || ''}`,
          status: 'ativo',
          criado_em: dataCriacao,
          criado_por: rem.fechado_por || 'Sistema',
          atualizado_em: new Date().toISOString()
        };

        const novaParcela: ParcelaPagar = {
          id: parcelaId,
          tenant_id: effectiveTenant,
          despesa_id: despesaId,
          numero_parcela: 1,
          total_parcelas: 1,
          tipo_credor: 'fornecedor_pj',
          credor_nome: rem.credenciado_nome,
          credor_cpf_cnpj: rem.credenciado_cnpj_cpf,
          descricao: `Remessa ${rem.codigo_remessa} (${rem.qtd_guias || 1} guias)`,
          data_vencimento: vencimento,
          valor: rem.valor_liquido,
          forma_pagamento: 'pix',
          observacao: `Vencimento do Faturamento da Rede Credenciada (${rem.codigo_remessa})`,
          status: 'pendente',
          criado_em: dataCriacao,
          atualizado_em: new Date().toISOString()
        };

        await salvarDespesa(isOnline, novaDespesa, [novaParcela]);

        if (!rem.despesa_id || !rem.parcela_pagar_id) {
          rem.despesa_id = despesaId;
          rem.parcela_pagar_id = parcelaId;
          await saveToIDB('remessas_faturamento', rem);
          if (isOnline) {
            try {
              await supabase.from('remessas_faturamento').upsert(rem);
            } catch (uErr) {
              console.warn('Erro ao atualizar ids na remessa:', uErr);
            }
          }
        }

        parcelas.push(novaParcela);
      }
    }
  } catch (syncErr) {
    console.warn('Erro ao auto-sincronizar remessas fechadas em getParcelasPagar:', syncErr);
  }

  return parcelas.filter(p => {
    if (!p) return false;
    if (tenantId && tenantId !== 'all' && p.tenant_id && p.tenant_id !== tenantId && p.tenant_id !== 'default_tenant') return false;
    return true;
  });
};

export const registrarRecebimento = async (isOnline: boolean, parcelaId: string, dadosRecebimento: any): Promise<void> => {
  const parcela = await getFromIDB<ParcelaReceber>('parcelas_receber', parcelaId);
  if (!parcela) return;

  const parcelaAtualizada: ParcelaReceber = {
    ...parcela,
    status: 'recebido',
    data_recebimento: dadosRecebimento.data_recebimento || new Date().toISOString(),
    valor_recebido: dadosRecebimento.valor_recebido || parcela.valor,
    forma_pagamento_efetivo: dadosRecebimento.forma_pagamento_efetivo || parcela.forma_pagamento,
    conta_bancaria_id: dadosRecebimento.conta_bancaria_id || parcela.conta_bancaria_id,
    recebido_por: dadosRecebimento.recebido_por || 'Sistema',
    observacao_recebimento: dadosRecebimento.observacao
  };

  if (isOnline) {
    try {
      const { error } = await supabase.from('parcelas_receber').upsert(parcelaAtualizada);
      if (error) console.warn('Supabase update parcela_receber error:', error);
    } catch (e) {
      console.warn('Supabase update error:', e);
    }
  } else {
    await addToSyncQueue({
      storeName: 'parcelas_receber',
      action: 'update',
      data: parcelaAtualizada
    });
  }

  await saveToIDB('parcelas_receber', parcelaAtualizada);
  await registrarAuditoria('Registrar Recebimento', { id: parcelaId, valor: parcelaAtualizada.valor_recebido });
};

export const registrarPagamento = async (isOnline: boolean, parcelaId: string, dadosPagamento: any): Promise<void> => {
  const parcela = await getFromIDB<ParcelaPagar>('parcelas_pagar', parcelaId);
  if (!parcela) return;

  const parcelaAtualizada: ParcelaPagar = {
    ...parcela,
    status: 'pago',
    data_pagamento: dadosPagamento.data_pagamento ? dadosPagamento.data_pagamento.split('T')[0] : new Date().toISOString().split('T')[0],
    valor_pago: dadosPagamento.valor_pago || parcela.valor,
    forma_pagamento_efetivo: dadosPagamento.forma_pagamento_efetivo || parcela.forma_pagamento,
    conta_bancaria_id: dadosPagamento.conta_bancaria_id || parcela.conta_bancaria_id,
    pago_por: dadosPagamento.pago_por || 'Sistema',
    observacao_pagamento: dadosPagamento.observacao,
    pago_em: new Date().toISOString()
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
  await registrarAuditoria('Registrar Pagamento', { id: parcelaId, valor: sanitized.valor_pago });
};


export const estornarRecebimento = async (isOnline: boolean, parcelaId: string, observacao: string): Promise<void> => {
  const parcela = await getFromIDB<ParcelaReceber>('parcelas_receber', parcelaId);
  if (!parcela) return;

  const dataVencimento = new Date(parcela.data_vencimento + 'T12:00:00');
  const now = new Date();
  const novoStatus = dataVencimento < now ? 'atrasado' : 'pendente';

  const parcelaAtualizada: ParcelaReceber = {
    ...parcela,
    status: novoStatus,
    data_recebimento: null as any,
    valor_recebido: null as any,
    forma_pagamento_efetivo: null as any,
    recebido_por: null as any,
    observacao_recebimento: `Estornado: ${observacao}`
  };

  if (isOnline) {
    try {
      const { error } = await supabase.from('parcelas_receber').upsert(parcelaAtualizada);
      if (error) console.warn('Supabase update parcela_receber error:', error);
    } catch (e) {
      console.warn('Supabase update error:', e);
    }
  } else {
    await addToSyncQueue({
      storeName: 'parcelas_receber',
      action: 'update',
      data: parcelaAtualizada
    });
  }

  await saveToIDB('parcelas_receber', parcelaAtualizada);
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
  // Delete associated parcelas
  const allParcelas = await getAllFromIDB<ParcelaReceber>('parcelas_receber');
  const relatedParcelas = allParcelas.filter(p => p.receita_id === receitaId);
  for (const p of relatedParcelas) {
    await excluirParcelaReceber(isOnline, p.id);
  }

  if (isOnline) {
    try {
      const { error } = await supabase.from('receitas').delete().eq('id', receitaId);
      if (error) console.warn('Supabase delete receita error:', error);
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
  } else {
    await addToSyncQueue({
      storeName: 'receitas',
      action: 'delete',
      data: { id: receitaId }
    });
  }
  await deleteFromIDB('receitas', receitaId);
  await registrarAuditoria('Excluir Receita', { id: receitaId });
};

export const excluirParcelaPagar = async (isOnline: boolean, parcelaId: string): Promise<void> => {
  if (isOnline) {
    try {
      const { error } = await supabase.from('parcelas_pagar').delete().eq('id', parcelaId);
      if (error) console.warn('Supabase delete parcela_pagar error:', error);
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
  } else {
    await addToSyncQueue({
      storeName: 'parcelas_pagar',
      action: 'delete',
      data: { id: parcelaId }
    });
  }
  await deleteFromIDB('parcelas_pagar', parcelaId);
  await registrarAuditoria('Excluir Parcela Pagar', { id: parcelaId });
};

export const excluirDespesa = async (isOnline: boolean, despesaId: string): Promise<void> => {
  const allParcelas = await getAllFromIDB<ParcelaPagar>('parcelas_pagar');
  const relatedParcelas = allParcelas.filter(p => p.despesa_id === despesaId);
  for (const p of relatedParcelas) {
    await excluirParcelaPagar(isOnline, p.id);
  }

  if (isOnline) {
    try {
      const { error } = await supabase.from('despesas').delete().eq('id', despesaId);
      if (error) console.warn('Supabase delete despesa error:', error);
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
  } else {
    await addToSyncQueue({
      storeName: 'despesas',
      action: 'delete',
      data: { id: despesaId }
    });
  }
  await deleteFromIDB('despesas', despesaId);
  await registrarAuditoria('Excluir Despesa', { id: despesaId });
};

export const getReceitaById = async (isOnline: boolean, id: string): Promise<Receita | null> => {
  if (isOnline) {
    try {
      const { data, error } = await supabase.from('receitas').select('*').eq('id', id).maybeSingle();
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase get receita error:', e);
    }
  }
  return await getFromIDB<Receita>('receitas', id) || null;
};

export const getDespesaById = async (isOnline: boolean, id: string): Promise<Despesa | null> => {
  if (isOnline) {
    try {
      const { data, error } = await supabase.from('despesas').select('*').eq('id', id).maybeSingle();
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase get despesa error:', e);
    }
  }
  return await getFromIDB<Despesa>('despesas', id) || null;
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
