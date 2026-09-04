import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { v4 as uuidv4 } from 'uuid';
import { Requisicao, RequisicaoItem, StatusRequisicao } from '../types/requisicoes';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatLocalDate, formatLocalDateTime } from '../utils/dateUtils';
import { fetchImageAsBase64, fetchImageWithDimensions } from '../utils/imageUtils';
import { getEmpresaById, Empresa } from './empresasService';

export const gerarCodigoRequisicao = (indexNumber: number = 1): string => {
  const dataHoje = new Date();
  const yyyy = dataHoje.getFullYear();
  const mm = String(dataHoje.getMonth() + 1).padStart(2, '0');
  const dd = String(dataHoje.getDate()).padStart(2, '0');
  const suf = String(indexNumber).padStart(3, '0');
  return `REQ-${yyyy}${mm}${dd}-${suf}`;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getRequisicoes = async (isOnline: boolean, tenantId: string): Promise<Requisicao[]> => {
  let supaRequisicoes: Requisicao[] = [];
  let fetchedFromSupa = false;

  if (isOnline) {
    try {
      let query = supabase.from('requisicoes').select('*').is('deleted_at', null);
      if (tenantId && tenantId !== 'all') {
        query = query.or(`tenant_id.eq.${tenantId},empresa_id.eq.${tenantId},tenant_id.eq.default_tenant,tenant_id.eq.empresa_padrao`);
      }
      query = query.order('data_emissao', { ascending: false });
      const { data, error } = await query;
      
      if (!error && data) {
        fetchedFromSupa = true;
        const reqIds = data.map(r => r.id).filter(Boolean);
        const itensMap: Record<string, RequisicaoItem[]> = {};

        if (reqIds.length > 0) {
          try {
            const { data: itensData } = await supabase
              .from('requisicao_itens')
              .select('*')
              .in('requisicao_id', reqIds);

            if (itensData) {
              itensData.forEach(item => {
                if (!itensMap[item.requisicao_id]) itensMap[item.requisicao_id] = [];
                itensMap[item.requisicao_id].push(item);
              });
            }
          } catch (itemErr) {
            console.warn('Erro ao buscar itens de requisições:', itemErr);
          }
        }

        supaRequisicoes = data.map(r => ({
          ...r,
          itens: itensMap[r.id] || r.itens || []
        }));

        // Reconcilia com IndexedDB: remove os que não existem no Supabase
        const localAll = await getAllFromIDB<Requisicao>('requisicoes');
        const remoteIds = new Set(data.map(r => r.id));
        for (const localItem of localAll) {
          if (!remoteIds.has(localItem.id)) {
            await deleteFromIDB('requisicoes', localItem.id);
          }
        }
        for (const item of supaRequisicoes) {
          await saveToIDB('requisicoes', item);
        }

        return supaRequisicoes;
      }
    } catch (e) {
      console.warn('Erro ao buscar requisições no Supabase, fallback IDB:', e);
    }
  }

  if (fetchedFromSupa) {
    return supaRequisicoes;
  }

  // Fallback para IndexedDB
  const localData = await getAllFromIDB<Requisicao>('requisicoes');
  let result = localData.filter(r => !(r as any).deleted_at);
  if (tenantId && tenantId !== 'all') {
    result = result.filter(r => r.tenant_id === tenantId || (r as any).empresa_id === tenantId || r.tenant_id === 'default_tenant' || r.tenant_id === 'empresa_padrao');
  }
  return result.sort((a, b) => new Date(b.data_emissao).getTime() - new Date(a.data_emissao).getTime());
};

export const excluirRequisicao = async (isOnline: boolean, id: string): Promise<void> => {
  // 1. Remove do IndexedDB imediatamente
  await deleteFromIDB('requisicoes', id);
  try {
    const allItens = await getAllFromIDB<any>('requisicao_itens');
    for (const it of (allItens || []).filter(i => i && (i.requisicao_id === id || i.id === id))) {
      await deleteFromIDB('requisicao_itens', it.id);
    }
  } catch (e) {}

  // 2. Remove do Supabase ou enfileira
  if (isOnline) {
    try {
      await supabase.from('requisicao_itens').delete().eq('requisicao_id', id);
      await supabase.from('requisicoes').delete().eq('id', id);
    } catch (e) {
      await addToSyncQueue({ storeName: 'requisicoes', action: 'delete', data: { id } });
    }
  } else {
    await addToSyncQueue({ storeName: 'requisicoes', action: 'delete', data: { id } });
  }

  try {
    await registrarAuditoria('Excluir Requisição/Guia', { id });
  } catch (e) {}
};

export const criarRequisicao = async (
  isOnline: boolean,
  tenantId: string,
  dados: Omit<Requisicao, 'id' | 'codigo_requisicao' | 'data_emissao' | 'created_at' | 'updated_at'>
): Promise<Requisicao> => {
  const requisicoesExistentes = await getRequisicoes(isOnline, tenantId);
  const indexHoje = requisicoesExistentes.filter(r => {
    const d = new Date(r.data_emissao);
    const hoje = new Date();
    return d.toDateString() === hoje.toDateString();
  }).length + 1;

  const dataEmissao = new Date();
  const dataValidade = addDays(dataEmissao, 30);
  const reqId = uuidv4();

  const { itens, ...dadosSemItens } = dados;

  const novaReq: Requisicao = {
    ...dadosSemItens,
    id: reqId,
    tenant_id: tenantId,
    codigo_requisicao: gerarCodigoRequisicao(indexHoje),
    data_emissao: dataEmissao.toISOString(),
    data_validade: dados.data_validade || dataValidade.toISOString(),
    itens: itens || [],
    created_at: dataEmissao.toISOString(),
    updated_at: dataEmissao.toISOString()
  };

  if (isOnline) {
    try {
      const dbPayload: any = {
        id: reqId,
        tenant_id: tenantId,
        empresa_id: tenantId,
        codigo_requisicao: novaReq.codigo_requisicao,
        associado_id: UUID_REGEX.test(dadosSemItens.associado_id || '') ? dadosSemItens.associado_id : null,
        associado_nome: dadosSemItens.associado_nome || 'Associado',
        associado_cpf: dadosSemItens.associado_cpf || null,
        associado_plano: dadosSemItens.associado_plano || null,
        paciente_tipo: dadosSemItens.paciente_tipo || 'titular',
        paciente_id: UUID_REGEX.test(dadosSemItens.paciente_id || '') ? dadosSemItens.paciente_id : null,
        paciente_nome: dadosSemItens.paciente_nome || dadosSemItens.associado_nome || 'Paciente',
        paciente_cpf: dadosSemItens.paciente_cpf || dadosSemItens.associado_cpf || null,
        paciente_parentesco: dadosSemItens.paciente_parentesco || 'Titular',
        tipo_prestador: dadosSemItens.tipo_prestador || 'credenciado',
        credenciado_id: UUID_REGEX.test(dadosSemItens.credenciado_id || '') ? dadosSemItens.credenciado_id : null,
        credenciado_nome: dadosSemItens.credenciado_nome || 'Prestador',
        credenciado_cnpj_cpf: dadosSemItens.credenciado_cnpj_cpf || null,
        medico_solicitante: dadosSemItens.medico_solicitante || null,
        crm_solicitante: dadosSemItens.crm_solicitante || null,
        data_emissao: novaReq.data_emissao,
        data_validade: novaReq.data_validade,
        status: novaReq.status || 'emitida',
        valor_total: novaReq.valor_total || 0,
        valor_coparticipacao_total: novaReq.valor_coparticipacao_total || 0,
        observacoes: novaReq.observacoes || null,
        created_at: novaReq.created_at,
        updated_at: novaReq.updated_at
      };

      let insertResult = await supabase.from('requisicoes').insert([dbPayload]);
      if (insertResult.error) {
        console.warn('Erro na inserção padrão de requisição:', insertResult.error);
        const fallbackPayload = { ...dbPayload, status: 'pendente' };
        insertResult = await supabase.from('requisicoes').insert([fallbackPayload]);
      }

      if (insertResult.error) {
        console.error('Erro ao salvar requisição no Supabase após fallback:', insertResult.error);
      } else if (itens && itens.length > 0) {
        const itensToInsert = itens.map(item => ({
          id: UUID_REGEX.test(item.id || '') ? item.id : uuidv4(),
          requisicao_id: reqId,
          procedimento_id: UUID_REGEX.test(item.procedimento_id || '') ? item.procedimento_id : null,
          codigo_tuss: item.codigo_tuss || '',
          descricao: item.descricao || 'Item de Requisição',
          quantidade: item.quantidade || 1,
          valor_unitario: item.valor_unitario || 0,
          valor_coparticipacao: item.valor_coparticipacao || 0,
          valor_total: item.valor_total || 0,
          observacoes: item.observacoes || null,
          tenant_id: tenantId,
          empresa_id: tenantId
        }));
        const { error: errItens } = await supabase.from('requisicao_itens').insert(itensToInsert);
        if (errItens) {
          console.warn('Erro ao inserir itens da requisição no Supabase:', errItens);
          const basicItens = itensToInsert.map(({ tenant_id, empresa_id, valor_coparticipacao, observacoes, ...rest }) => rest);
          await supabase.from('requisicao_itens').insert(basicItens);
        }
      }
    } catch (e) {
      console.warn('Erro geral ao inserir requisição no Supabase:', e);
    }
    await saveToIDB('requisicoes', novaReq);
    await registrarAuditoria('Emissão de Requisição/Guia', {
      requisicao_id: novaReq.id,
      codigo: novaReq.codigo_requisicao,
      paciente: novaReq.paciente_nome,
      prestador: novaReq.credenciado_nome
    });
  } else {
    await saveToIDB('requisicoes', novaReq);
    await addToSyncQueue({ storeName: 'requisicoes', action: 'insert', data: novaReq });
  }

  return novaReq;
};

export const atualizarRequisicao = async (
  isOnline: boolean,
  req: Requisicao
): Promise<Requisicao> => {
  const reqAtualizada = { ...req, updated_at: new Date().toISOString() };
  const { itens, ...dadosSemItens } = reqAtualizada;

  if (isOnline) {
    try {
      const dbPayload = {
        ...dadosSemItens,
        associado_id: UUID_REGEX.test(dadosSemItens.associado_id || '') ? dadosSemItens.associado_id : null,
        paciente_id: UUID_REGEX.test(dadosSemItens.paciente_id || '') ? dadosSemItens.paciente_id : null,
        credenciado_id: UUID_REGEX.test(dadosSemItens.credenciado_id || '') ? dadosSemItens.credenciado_id : null,
        empresa_id: req.tenant_id
      };

      const { error } = await supabase.from('requisicoes').update(dbPayload).eq('id', req.id);
      
      if (error) {
        console.error('Erro ao atualizar requisicao no Supabase:', error);
      } else if (itens && itens.length > 0) {
        await supabase.from('requisicao_itens').delete().eq('requisicao_id', req.id);
        const itensToInsert = itens.map(item => ({
          id: UUID_REGEX.test(item.id || '') ? item.id : uuidv4(),
          requisicao_id: req.id,
          procedimento_id: UUID_REGEX.test(item.procedimento_id || '') ? item.procedimento_id : null,
          codigo_tuss: item.codigo_tuss || '',
          descricao: item.descricao || 'Item de Requisição',
          quantidade: item.quantidade || 1,
          valor_unitario: item.valor_unitario || 0,
          valor_coparticipacao: item.valor_coparticipacao || 0,
          valor_total: item.valor_total || 0,
          observacoes: item.observacoes || null,
          tenant_id: req.tenant_id,
          empresa_id: req.tenant_id
        }));
        await supabase.from('requisicao_itens').insert(itensToInsert);
      }
    } catch (e) {
      console.warn('Erro ao atualizar requisicao no Supabase:', e);
    }
    await saveToIDB('requisicoes', reqAtualizada);
    await registrarAuditoria('Edição de Requisição/Guia', {
      requisicao_id: reqAtualizada.id,
      codigo: reqAtualizada.codigo_requisicao
    });
  } else {
    await saveToIDB('requisicoes', reqAtualizada);
    await addToSyncQueue({ storeName: 'requisicoes', action: 'update', data: reqAtualizada });
  }
  return reqAtualizada;
};

export const atualizarStatusRequisicao = async (
  isOnline: boolean,
  requisicaoId: string,
  novoStatus: StatusRequisicao,
  extras?: { motivo_cancelamento?: string; autorizado_por?: string; cancelado_por?: string }
): Promise<Requisicao> => {
  let req = await getFromIDB<Requisicao>('requisicoes', requisicaoId);
  if (!req && isOnline) {
    try {
      const { data } = await supabase.from('requisicoes').select('*').eq('id', requisicaoId).single();
      if (data) req = data as Requisicao;
    } catch (e) {
      console.warn('Erro ao buscar requisição no Supabase para atualização de status:', e);
    }
  }

  if (!req) {
    throw new Error('Requisição não encontrada.');
  }

  const reqAtualizada: Requisicao = {
    ...req,
    status: novoStatus,
    updated_at: new Date().toISOString(),
    ...(extras?.motivo_cancelamento ? { motivo_cancelamento: extras.motivo_cancelamento } : {}),
    ...(extras?.autorizado_por ? { autorizado_por: extras.autorizado_por } : {}),
    ...(extras?.cancelado_por ? { cancelado_por: extras.cancelado_por } : {})
  };

  if (isOnline) {
    try {
      const updateData: any = {
        status: novoStatus,
        updated_at: reqAtualizada.updated_at
      };
      if (extras?.motivo_cancelamento) updateData.motivo_cancelamento = extras.motivo_cancelamento;
      if (extras?.autorizado_por) updateData.autorizado_por = extras.autorizado_por;
      if (extras?.cancelado_por) updateData.cancelado_por = extras.cancelado_por;

      const { error } = await supabase.from('requisicoes').update(updateData).eq('id', requisicaoId);
      if (error) {
        console.warn('Erro ao atualizar status da requisição no Supabase:', error);
      }
    } catch (e) {
      console.warn('Erro ao atualizar status da requisição no Supabase:', e);
    }
    await saveToIDB('requisicoes', reqAtualizada);
    await registrarAuditoria(`Atualização de Requisição (${novoStatus})`, {
      requisicao_id: req.id,
      codigo: req.codigo_requisicao,
      status: novoStatus
    });
  } else {
    await saveToIDB('requisicoes', reqAtualizada);
    await addToSyncQueue({ storeName: 'requisicoes', action: 'update', data: reqAtualizada });
  }

  return reqAtualizada;
};

// IMPRESSÃO / EXPORTAÇÃO PDF DA GUIA
export const gerarPDFGuiaRequisicao = async (req: Requisicao, empresa?: Empresa | null) => {
  // jsPDF/jspdf-autotable só são carregados quando esta função de fato roda — mantém o pacote
  // (>400KB) fora do bundle inicial, já que requisicoesService.ts também é importado só para
  // buscar/listar dados (ex.: pelo hook de notificações, presente em toda página autenticada).
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  if (!empresa) {
    try {
      empresa = await getEmpresaById(req.tenant_id || 'default_tenant', true);
    } catch {}
  }
  const logoUrl = empresa?.logo_url;
  const doc = new jsPDF();
  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  let currentY = 14;
  if (logoUrl) {
    const imgData = await fetchImageWithDimensions(logoUrl);
    if (imgData && imgData.base64) {
      const maxWidth = 182;
      const maxHeight = 40;
      let imgWidth = maxWidth;
      let imgHeight = (imgData.height * maxWidth) / imgData.width;
      
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = (imgData.width * maxHeight) / imgData.height;
      }
      
      const x = 14 + (maxWidth - imgWidth) / 2;
      doc.addImage(imgData.base64, 'PNG', x, currentY, imgWidth, imgHeight, '', 'FAST');
      currentY += imgHeight + 10;
    }
  }

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('GUIA DE AUTORIZAÇÃO / REQUISIÇÃO DE SERVIÇO', 14, currentY);
  doc.setFontSize(10);
  doc.text(`CÓDIGO: ${req.codigo_requisicao}`, 196, currentY, { align: 'right' });
  currentY += 8;

  doc.setFont('helvetica', 'bold');
  doc.text(`Status: ${req.status.toUpperCase()}`, 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data de Emissão: ${formatLocalDateTime(req.data_emissao)}`, 80, currentY);
  if (req.data_validade) {
    doc.text(`Validade: ${formatLocalDate(req.data_validade)}`, 150, currentY);
  }

  // Bloco 1: Dados do Associado / Paciente
  autoTable(doc, {
    startY: currentY + 8,
    head: [['DADOS DO ASSOCIADO E PACIENTE (BENEFICIÁRIO)']],
    body: [
      [
        `Titular Associado: ${req.associado_nome} ${req.associado_cpf ? `(CPF: ${req.associado_cpf})` : ''}\n` +
        `Plano: ${req.associado_plano || 'Padrão'}\n` +
        `Paciente / Beneficiário: ${req.paciente_nome} (${req.paciente_tipo === 'titular' ? 'TITULAR' : `DEPENDENTE - ${req.paciente_parentesco || ''}`})\n` +
        `CPF Paciente: ${req.paciente_cpf || req.associado_cpf || 'Não Informado'}`
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9 }
  });

  // Bloco 2: Prestador de Serviço
  const startY2 = (doc as any).lastAutoTable.finalY + 4;
  autoTable(doc, {
    startY: startY2,
    head: [['PRESTADOR DE SERVIÇO / REDE ATENDENTE']],
    body: [
      [
        `Tipo Prestador: ${req.tipo_prestador === 'credenciado' ? 'REDE CREDENCIADA' : 'REDE EXTERNA'}\n` +
        `Prestador / Clínica / Laboratório: ${req.credenciado_nome}\n` +
        `Médico Solicitante: ${req.medico_solicitante || 'Não Informado'} ${req.crm_solicitante ? `(CRM: ${req.crm_solicitante})` : ''}`
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9 }
  });

  // Bloco 3: Tabela de Exames e Procedimentos
  const startY3 = (doc as any).lastAutoTable.finalY + 4;
  const itemRows = req.itens.map(item => [
    item.codigo_tuss || '-',
    item.descricao,
    item.quantidade.toString()
  ]);

  autoTable(doc, {
    startY: startY3,
    head: [['Cód. TUSS / Ref.', 'Descrição do Procedimento / Exame', 'Qtd']],
    body: itemRows,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    
    styles: { fontSize: 8 }
  });

  // Observações e Termos
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);

  if (req.observacoes) {
    doc.text(`Observações: ${req.observacoes}`, 14, finalY);
  }

  const termoY = finalY + (req.observacoes ? 10 : 4);
  doc.text('Termo de Autorização: A apresentação desta guia autoriza a realização dos exames/procedimentos listados acima.', 14, termoY);
  doc.text('O beneficiário e o credenciado declaram ciência dos termos do regulamento da assistência contratada.', 14, termoY + 4);

  // Linhas de Assinatura
  const sigY = termoY + 30;
  
  if (empresa?.assinatura_url) {
    try {
      const sigImgData = await fetchImageWithDimensions(empresa.assinatura_url);
      if (sigImgData && sigImgData.base64) {
        const sigWidth = 40;
        const sigHeight = (sigImgData.height * sigWidth) / sigImgData.width;
        // Desenha a assinatura da empresa centralizada na linha direita
        doc.addImage(sigImgData.base64, 'PNG', 135, sigY - sigHeight - 2, sigWidth, sigHeight, '', 'FAST');
      }
    } catch(e) {
      console.warn("Erro ao carregar assinatura", e);
    }
  }

  doc.setLineWidth(0.5);
  doc.setDrawColor(203, 213, 225);

  doc.line(14, sigY, 95, sigY);
  doc.line(115, sigY, 196, sigY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Assinatura do Paciente / Responsável', 25, sigY + 5);
  
  if (empresa?.nome_fantasia) {
    doc.text(empresa.nome_fantasia, 155, sigY + 5, { align: 'center' });
    if (empresa.cnpj) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`CNPJ: ${empresa.cnpj}`, 155, sigY + 9, { align: 'center' });
    }
  } else {
    doc.text('Carimbo e Assinatura da Empresa', 155, sigY + 5, { align: 'center' });
  }

  doc.save(`Guia_${req.codigo_requisicao}.pdf`);
};
