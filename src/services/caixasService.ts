import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { v4 as uuidv4 } from 'uuid';
import { 
  LoteCaixa, 
  MovimentacaoCaixa, 
  ResumoFluxoCaixa, 
  FiltroFluxoCaixa 
} from '../types/caixas';
import { 
  getParcelasReceber, 
  getParcelasPagar, 
  ParcelaReceber, 
  ParcelaPagar,
  estornarRecebimento,
  estornarPagamento
} from './financeiroService';
import { FormaPagamento } from '../types/financeiro';

// helper format codigo lote
export const gerarCodigoLote = (indexNumber: number = 1): string => {
  const dataHoje = new Date();
  const yyyy = dataHoje.getFullYear();
  const mm = String(dataHoje.getMonth() + 1).padStart(2, '0');
  const dd = String(dataHoje.getDate()).padStart(2, '0');
  const suf = String(indexNumber).padStart(3, '0');
  return `LOTE-${yyyy}${mm}${dd}-${suf}`;
};

// === LOTES DE CAIXA ===

export const getLotesCaixa = async (isOnline: boolean, tenantId: string): Promise<LoteCaixa[]> => {
  if (isOnline) {
    try {
      let query = supabase.from('lotes_caixa').select('*');
      if (tenantId && tenantId !== 'all') {
        query = query.eq('tenant_id', tenantId);
      }
      query = query.order('data_abertura', { ascending: false });
      const { data, error } = await query;
      if (!error && data) {
        for (const item of data) {
          await saveToIDB('lotes_caixa', item);
        }
        return data as LoteCaixa[];
      }
    } catch (error) {
      console.warn('Erro ao buscar lotes_caixa no Supabase, buscando IDB local:', error);
    }
  }

  const localData = await getAllFromIDB<LoteCaixa>('lotes_caixa');
  let result = localData;
  if (tenantId && tenantId !== 'all') {
    result = result.filter(item => item.tenant_id === tenantId);
  }
  return result.sort((a, b) => new Date(b.data_abertura).getTime() - new Date(a.data_abertura).getTime());
};

export const getLoteAbertoAtivo = async (isOnline: boolean, tenantId: string): Promise<LoteCaixa | null> => {
  const lotes = await getLotesCaixa(isOnline, tenantId);
  const aberto = lotes.find(l => l.status === 'aberto');
  return aberto || null;
};

export const abrirLoteCaixa = async (
  isOnline: boolean, 
  dados: {
    tenant_id: string;
    terminal_caixa: string;
    operador_id?: string;
    operador_nome: string;
    saldo_inicial: number;
    observacao_abertura?: string;
  }
): Promise<LoteCaixa> => {
  const lotesExistentes = await getLotesCaixa(isOnline, dados.tenant_id);
  const loteAberto = lotesExistentes.find(l => l.status === 'aberto');
  if (loteAberto) {
    throw new Error(`Já existe um Lote de Caixa aberto (${loteAberto.codigo_lote} - ${loteAberto.terminal_caixa}). Feche-o antes de abrir um novo.`);
  }

  const indexHoje = lotesExistentes.filter(l => {
    const d = new Date(l.data_abertura);
    const hoje = new Date();
    return d.toDateString() === hoje.toDateString();
  }).length + 1;

  const novoLote: LoteCaixa = {
    id: uuidv4(),
    tenant_id: dados.tenant_id,
    codigo_lote: gerarCodigoLote(indexHoje),
    terminal_caixa: dados.terminal_caixa || 'Caixa Principal',
    operador_id: dados.operador_id,
    operador_nome: dados.operador_nome,
    data_abertura: new Date().toISOString(),
    saldo_inicial: Number(dados.saldo_inicial) || 0,
    saldo_entradas: 0,
    saldo_saidas: 0,
    saldo_esperado: Number(dados.saldo_inicial) || 0,
    observacao_abertura: dados.observacao_abertura || '',
    status: 'aberto',
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  };

  if (isOnline) {
    try {
      const { error } = await supabase.from('lotes_caixa').insert(novoLote);
      if (error) console.warn('Falha no Supabase ao abrir lote, mantendo IDB:', error);
    } catch (e) {
      console.warn('Erro ao abrir lote no Supabase:', e);
    }
    await saveToIDB('lotes_caixa', novoLote);
    await registrarAuditoria('Abertura de Lote de Caixa', { lote_id: novoLote.id, codigo: novoLote.codigo_lote });
  } else {
    await saveToIDB('lotes_caixa', novoLote);
    await addToSyncQueue({ storeName: 'lotes_caixa', action: 'update', data: novoLote });
  }

  return novoLote;
};

export const fecharLoteCaixa = async (
  isOnline: boolean,
  loteId: string,
  dados: {
    saldo_fechamento_informado: number;
    observacao_fechamento?: string;
  }
): Promise<LoteCaixa> => {
  const lote = await getFromIDB<LoteCaixa>('lotes_caixa', loteId);
  if (!lote) {
    throw new Error('Lote de caixa não encontrado.');
  }

  // Buscar movimentacoes do lote para recalcular com exatidao
  const movs = await getMovimentacoesCaixa(isOnline, lote.tenant_id, loteId);
  const entradas = movs
    .filter(m => m.tipo === 'entrada' && !m.estornado)
    .reduce((acc, m) => acc + (Number(m.valor) || 0), 0);
  
  const saidas = movs
    .filter(m => m.tipo === 'saida' && !m.estornado)
    .reduce((acc, m) => acc + (Number(m.valor) || 0), 0);

  const saldoEsperado = Number(lote.saldo_inicial || 0) + entradas - saidas;
  const saldoInformado = Number(dados.saldo_fechamento_informado);
  const diferenca = saldoInformado - saldoEsperado;

  const loteAtualizado: LoteCaixa = {
    ...lote,
    data_fechamento: new Date().toISOString(),
    saldo_entradas: entradas,
    saldo_saidas: saidas,
    saldo_esperado: saldoEsperado,
    saldo_fechamento_informado: saldoInformado,
    diferenca_quebra_sobra: diferenca,
    observacao_fechamento: dados.observacao_fechamento || '',
    status: 'fechado',
    atualizado_em: new Date().toISOString()
  };

  if (isOnline) {
    try {
      const { error } = await supabase.from('lotes_caixa').upsert(loteAtualizado);
      if (error) console.warn('Falha no Supabase ao fechar lote, salvando IDB:', error);
    } catch (e) {
      console.warn('Erro Supabase ao fechar lote:', e);
    }
    await saveToIDB('lotes_caixa', loteAtualizado);
    await registrarAuditoria('Fechamento de Lote de Caixa', { 
      lote_id: lote.id, 
      codigo: lote.codigo_lote,
      saldo_esperado: saldoEsperado,
      saldo_informado: saldoInformado,
      diferenca
    });
  } else {
    await saveToIDB('lotes_caixa', loteAtualizado);
    await addToSyncQueue({ storeName: 'lotes_caixa', action: 'update', data: loteAtualizado });
  }

  return loteAtualizado;
};

// === RECALCULO PRECISO DE TOTAIS DO LOTE ===

export const recalcularTotaisLote = async (
  isOnline: boolean, 
  loteId: string
): Promise<LoteCaixa | null> => {
  const lote = await getFromIDB<LoteCaixa>('lotes_caixa', loteId);
  if (!lote) return null;

  const movs = await getMovimentacoesCaixa(isOnline, lote.tenant_id, loteId);
  const entradas = movs
    .filter(m => m.tipo === 'entrada' && !m.estornado)
    .reduce((acc, m) => acc + (Number(m.valor) || 0), 0);

  const saidas = movs
    .filter(m => m.tipo === 'saida' && !m.estornado)
    .reduce((acc, m) => acc + (Number(m.valor) || 0), 0);

  const saldoEsperado = Number(lote.saldo_inicial || 0) + entradas - saidas;

  const loteAtualizado: LoteCaixa = {
    ...lote,
    saldo_entradas: entradas,
    saldo_saidas: saidas,
    saldo_esperado: saldoEsperado,
    atualizado_em: new Date().toISOString()
  };

  await saveToIDB('lotes_caixa', loteAtualizado);
  if (isOnline) {
    try {
      await supabase.from('lotes_caixa').upsert(loteAtualizado);
    } catch (e) {
      console.warn('Erro ao atualizar totais do lote no Supabase:', e);
    }
  } else {
    await addToSyncQueue({ storeName: 'lotes_caixa', action: 'update', data: loteAtualizado });
  }

  return loteAtualizado;
};

// === MOVIMENTAÇÕES DE FLUXO DE CAIXA ===

export const getMovimentacoesCaixa = async (
  isOnline: boolean, 
  tenantId: string, 
  loteId?: string
): Promise<MovimentacaoCaixa[]> => {
  if (isOnline) {
    try {
      let query = supabase.from('movimentacoes_caixa').select('*');
      if (tenantId && tenantId !== 'all') {
        query = query.eq('tenant_id', tenantId);
      }
      if (loteId) {
        query = query.eq('lote_id', loteId);
      }
      query = query.order('data_movimentacao', { ascending: false });
      const { data, error } = await query;
      if (!error && data) {
        for (const item of data) {
          await saveToIDB('movimentacoes_caixa', item);
        }
        return data as MovimentacaoCaixa[];
      }
    } catch (e) {
      console.warn('Erro ao carregar movimentacoes_caixa do Supabase, fallback IDB:', e);
    }
  }

  const localData = await getAllFromIDB<MovimentacaoCaixa>('movimentacoes_caixa');
  let result = localData;
  if (tenantId && tenantId !== 'all') {
    result = result.filter(m => m.tenant_id === tenantId);
  }
  if (loteId) {
    result = result.filter(m => m.lote_id === loteId);
  }
  return result.sort((a, b) => new Date(b.data_movimentacao).getTime() - new Date(a.data_movimentacao).getTime());
};

export const registrarMovimentacao = async (
  isOnline: boolean,
  mov: Omit<MovimentacaoCaixa, 'id' | 'criado_em'>
): Promise<MovimentacaoCaixa> => {
  const novaMov: MovimentacaoCaixa = {
    ...mov,
    id: uuidv4(),
    criado_em: new Date().toISOString()
  };

  if (isOnline) {
    try {
      const { error } = await supabase.from('movimentacoes_caixa').insert(novaMov);
      if (error) console.warn('Supabase movimentacao insert error:', error);
    } catch (e) {
      console.warn('Erro ao inserir movimentacao no Supabase:', e);
    }
    await saveToIDB('movimentacoes_caixa', novaMov);
  } else {
    await saveToIDB('movimentacoes_caixa', novaMov);
    await addToSyncQueue({ storeName: 'movimentacoes_caixa', action: 'update', data: novaMov });
  }

  // Recalcula totais do lote com exatidão
  if (mov.lote_id) {
    await recalcularTotaisLote(isOnline, mov.lote_id);
  }

  return novaMov;
};

export const estornarMovimentacaoCaixa = async (
  isOnline: boolean,
  movimentacaoId: string,
  observacao: string
): Promise<void> => {
  const mov = await getFromIDB<MovimentacaoCaixa>('movimentacoes_caixa', movimentacaoId);
  if (!mov) throw new Error('Movimentação não encontrada');

  const lote = await getFromIDB<LoteCaixa>('lotes_caixa', mov.lote_id);
  if (!lote) throw new Error('Lote não encontrado');
  if (lote.status !== 'aberto') {
    throw new Error('Não é possível estornar movimentações de um lote fechado');
  }

  // Se tem referencia, estorna no financeiro (reverte status da parcela para pendente/atrasado)
  if (mov.referencia_id) {
    if (mov.origem === 'contas_receber') {
      await estornarRecebimento(isOnline, mov.referencia_id, observacao);
    } else if (mov.origem === 'contas_pagar') {
      await estornarPagamento(isOnline, mov.referencia_id, observacao);
    }
  }

  // Atualiza a movimentação para estornada
  const movAtualizada: MovimentacaoCaixa = { 
    ...mov, 
    estornado: true, 
    observacao: (mov.observacao ? mov.observacao + ' | ' : '') + 'ESTORNADO: ' + observacao 
  };
  await saveToIDB('movimentacoes_caixa', movAtualizada);
  
  if (isOnline) {
    try {
      const { error } = await supabase.from('movimentacoes_caixa').upsert(movAtualizada);
      if (error) console.warn('Supabase update mov error:', error);
    } catch (e) {
      console.warn('Erro ao atualizar movimentacao no Supabase:', e);
    }
  } else {
    await addToSyncQueue({ storeName: 'movimentacoes_caixa', action: 'update', data: movAtualizada as any });
  }

  // Recalcula totais reais do lote (entradas e saídas ativas desconsiderando estornos)
  await recalcularTotaisLote(isOnline, mov.lote_id);
  
  await registrarAuditoria('Estorno Movimentação Caixa', { id: movimentacaoId, valor: mov.valor });
};

export const registrarSuprimento = async (
  isOnline: boolean,
  tenantId: string,
  loteId: string,
  valor: number,
  descricao: string,
  operadorNome: string
): Promise<MovimentacaoCaixa> => {
  return registrarMovimentacao(isOnline, {
    tenant_id: tenantId,
    lote_id: loteId,
    tipo: 'entrada',
    origem: 'suprimento',
    categoria: 'Suprimento de Caixa',
    descricao: descricao || 'Aporte/Suprimento de saldo no caixa',
    valor,
    forma_pagamento: 'dinheiro',
    data_movimentacao: new Date().toISOString(),
    operador_nome: operadorNome
  });
};

export const registrarSangria = async (
  isOnline: boolean,
  tenantId: string,
  loteId: string,
  valor: number,
  descricao: string,
  operadorNome: string
): Promise<MovimentacaoCaixa> => {
  return registrarMovimentacao(isOnline, {
    tenant_id: tenantId,
    lote_id: loteId,
    tipo: 'saida',
    origem: 'sangria',
    categoria: 'Sangria de Caixa',
    descricao: descricao || 'Retirada/Sangria de valores do caixa',
    valor,
    forma_pagamento: 'dinheiro',
    data_movimentacao: new Date().toISOString(),
    operador_nome: operadorNome
  });
};

// === SINCRONIZAÇÃO/INTEGRAÇÃO DO MÓDULO FINANCEIRO ===

export const sincronizarLancamentosFinanceiros = async (
  isOnline: boolean,
  tenantId: string,
  operadorNome: string = 'Sistema Financeiro'
): Promise<{ novosContasReceber: number; novosContasPagar: number }> => {
  // 1. Busca Lote Ativo ou garante um lote aberto
  let loteAberto = await getLoteAbertoAtivo(isOnline, tenantId);
  if (!loteAberto) {
    // se nao houver lote aberto, abre um lote automatico de integracao
    loteAberto = await abrirLoteCaixa(isOnline, {
      tenant_id: tenantId,
      terminal_caixa: 'Caixa Automático Integrado',
      operador_nome: operadorNome,
      saldo_inicial: 0,
      observacao_abertura: 'Lote aberto automaticamente para recepção do financeiro'
    });
  }

  // 2. Busca parcelas recebidas e pagas
  const parcelasReceber = await getParcelasReceber(isOnline, tenantId);
  const parcelasPagar = await getParcelasPagar(isOnline, tenantId);

  const movsExistentes = await getMovimentacoesCaixa(isOnline, tenantId);
  const refsProcessadas = new Set(movsExistentes.map(m => m.referencia_id).filter(Boolean));

  let novosContasReceber = 0;
  let novosContasPagar = 0;

  // Processa Recebimentos (Entradas)
  const recebidos = parcelasReceber.filter(p => p.status === 'recebido');
  for (const p of recebidos) {
    if (!refsProcessadas.has(p.id)) {
      await registrarMovimentacao(isOnline, {
        tenant_id: tenantId,
        lote_id: loteAberto.id,
        tipo: 'entrada',
        origem: 'contas_receber',
        categoria: 'Receita / Mensalidade',
        descricao: `Recebimento: ${p.devedor_nome} - ${p.descricao}`,
        valor: Number(p.valor_recebido || p.valor),
        forma_pagamento: p.forma_pagamento_efetivo || p.forma_pagamento || 'pix',
        data_movimentacao: p.data_recebimento || p.recebido_em || new Date().toISOString(),
        referencia_id: p.id,
        documento_ref: `Parc. ${p.numero_parcela}/${p.total_parcelas}`,
        operador_nome: p.recebido_por || operadorNome,
        observacao: p.observacao_recebimento
      });
      novosContasReceber++;
    }
  }

  // Processa Pagamentos (Saídas)
  const pagos = parcelasPagar.filter(p => p.status === 'pago');
  for (const p of pagos) {
    if (!refsProcessadas.has(p.id)) {
      await registrarMovimentacao(isOnline, {
        tenant_id: tenantId,
        lote_id: loteAberto.id,
        tipo: 'saida',
        origem: 'contas_pagar',
        categoria: 'Despesa Operacional',
        descricao: `Pagamento: ${p.credor_nome} - ${p.descricao}`,
        valor: Number(p.valor_pago || p.valor),
        forma_pagamento: p.forma_pagamento_efetivo || p.forma_pagamento || 'pix',
        data_movimentacao: p.data_pagamento || p.pago_em || new Date().toISOString(),
        referencia_id: p.id,
        documento_ref: `Parc. ${p.numero_parcela}/${p.total_parcelas}`,
        operador_nome: p.pago_por || operadorNome,
        observacao: p.observacao_pagamento
      });
      novosContasPagar++;
    }
  }

  return { novosContasReceber, novosContasPagar };
};

// === CÁLCULO DE RESUMO DE FLUXO DE CAIXA ===

export const calcularResumoFluxoCaixa = (
  movimentacoes: MovimentacaoCaixa[],
  lotes: LoteCaixa[]
): ResumoFluxoCaixa => {
  let totalEntradas = 0;
  let totalSaidas = 0;
  let totalDinheiro = 0;
  let totalPix = 0;
  let totalCartoes = 0;
  let totalOutros = 0;
  let totalSuprimentos = 0;
  let totalSangrias = 0;

  movimentacoes.forEach(m => {
    if (m.estornado) return; // Ignore estornadas nos totais gerais
    const valor = Number(m.valor) || 0;
    if (m.tipo === 'entrada') {
      totalEntradas += valor;
    } else {
      totalSaidas += valor;
    }

    if (m.origem === 'suprimento') totalSuprimentos += valor;
    if (m.origem === 'sangria') totalSangrias += valor;

    const forma = m.forma_pagamento;
    if (forma === 'dinheiro') totalDinheiro += (m.tipo === 'entrada' ? valor : -valor);
    else if (forma === 'pix') totalPix += (m.tipo === 'entrada' ? valor : -valor);
    else if (forma === 'cartao_credito' || forma === 'cartao_debito') totalCartoes += (m.tipo === 'entrada' ? valor : -valor);
    else totalOutros += (m.tipo === 'entrada' ? valor : -valor);
  });

  const abertos = lotes.filter(l => l.status === 'aberto').length;
  const fechados = lotes.filter(l => l.status !== 'aberto').length;

  return {
    total_entradas: totalEntradas,
    total_saidas: totalSaidas,
    saldo_periodo: totalEntradas - totalSaidas,
    total_dinheiro: totalDinheiro,
    total_pix: totalPix,
    total_cartoes: totalCartoes,
    total_outros: totalOutros,
    total_suprimentos: totalSuprimentos,
    total_sangrias: totalSangrias,
    lotes_abertos_count: abertos,
    lotes_fechados_count: fechados
  };
};


export const reabrirLoteCaixa = async (
  isOnline: boolean,
  loteId: string,
  justificativa: string,
  usuarioNome: string
): Promise<LoteCaixa> => {
  const lote = await getFromIDB<LoteCaixa>('lotes_caixa', loteId);
  if (!lote) throw new Error('Lote não encontrado');
  if (lote.status === 'aberto') throw new Error('O lote já está aberto');

  const lotes = await getLotesCaixa(isOnline, lote.tenant_id);
  const loteAbertoAtual = lotes.find(l => l.status === 'aberto');
  if (loteAbertoAtual) {
    throw new Error('Não é possível reabrir este lote, pois já existe um lote aberto (' + loteAbertoAtual.codigo_lote + '). Feche o lote atual antes de reabrir um anterior.');
  }

  const loteAtualizado: LoteCaixa = {
    ...lote,
    status: 'aberto',
    data_fechamento: null as any,
    saldo_fechamento_informado: null as any,
    diferenca_quebra_sobra: null as any,
    observacao_fechamento: (lote.observacao_fechamento ? lote.observacao_fechamento + ' | ' : '') + `REABERTO por ${usuarioNome}: ${justificativa}`,
    atualizado_em: new Date().toISOString()
  };

  if (isOnline) {
    const { error } = await supabase.from('lotes_caixa').update(loteAtualizado).eq('id', loteAtualizado.id);
    if (error) {
      console.error('Supabase update lote error:', error);
      throw new Error("Erro no banco de dados ao atualizar lote: " + error.message);
    }
  } else {
    await addToSyncQueue({ storeName: 'lotes_caixa', action: 'update', data: loteAtualizado as any });
  }

  await saveToIDB('lotes_caixa', loteAtualizado);
  await registrarAuditoria('Reabertura Lote Caixa', { id: loteId, codigo: lote.codigo_lote, justificativa, usuario: usuarioNome });
  
  return loteAtualizado;
};

export const excluirLoteCaixa = async (isOnline: boolean, loteId: string): Promise<void> => {
  // 1. Limpeza no IDB
  await deleteFromIDB('lotes_caixa', loteId);
  try {
    const localMovs = await getAllFromIDB<any>('movimentacoes_caixa');
    for (const m of (localMovs || []).filter(m => m && m.lote_id === loteId)) {
      await deleteFromIDB('movimentacoes_caixa', m.id);
    }
  } catch (e) {}

  // 2. Exclusão no Supabase em cascata ou enfileiramento
  if (isOnline) {
    try {
      await supabase.from('movimentacoes_caixa').delete().eq('lote_id', loteId);
      const { error } = await supabase.from('lotes_caixa').delete().eq('id', loteId);
      if (error) {
        await supabase.from('lotes_caixa').update({ deleted_at: new Date().toISOString(), status: 'cancelado' }).eq('id', loteId);
      }
    } catch (e) {
      console.warn('Erro ao excluir lote de caixa no Supabase:', e);
      await addToSyncQueue({ storeName: 'lotes_caixa', action: 'delete', data: { id: loteId } });
    }
  } else {
    await addToSyncQueue({ storeName: 'lotes_caixa', action: 'delete', data: { id: loteId } });
  }

  try {
    await registrarAuditoria('Excluir Lote de Caixa e Movimentações', { id: loteId });
  } catch (e) {}
};
