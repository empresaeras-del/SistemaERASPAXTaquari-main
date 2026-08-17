import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { v4 as uuidv4 } from 'uuid';
import { Requisicao, StatusRequisicao } from '../types/requisicoes';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import { fetchImageAsBase64, fetchImageWithDimensions } from '../utils/imageUtils';
import autoTable from 'jspdf-autotable';

export const gerarCodigoRequisicao = (indexNumber: number = 1): string => {
  const dataHoje = new Date();
  const yyyy = dataHoje.getFullYear();
  const mm = String(dataHoje.getMonth() + 1).padStart(2, '0');
  const dd = String(dataHoje.getDate()).padStart(2, '0');
  const suf = String(indexNumber).padStart(3, '0');
  return `REQ-${yyyy}${mm}${dd}-${suf}`;
};

export const getRequisicoes = async (isOnline: boolean, tenantId: string): Promise<Requisicao[]> => {
  if (isOnline) {
    try {
      let query = supabase.from('requisicoes').select('*');
      if (tenantId && tenantId !== 'all') {
        query = query.eq('tenant_id', tenantId);
      }
      query = query.order('data_emissao', { ascending: false });
      const { data, error } = await query;
      if (!error && data) {
        for (const item of data) {
          await saveToIDB('requisicoes', item);
        }
        return data as Requisicao[];
      }
    } catch (e) {
      console.warn('Erro ao buscar requisições no Supabase, fallback IDB:', e);
    }
  }

  const localData = await getAllFromIDB<Requisicao>('requisicoes');
  let result = localData;
  if (tenantId && tenantId !== 'all') {
    result = result.filter(r => r.tenant_id === tenantId);
  }
  return result.sort((a, b) => new Date(b.data_emissao).getTime() - new Date(a.data_emissao).getTime());
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
  const dataValidade = addDays(dataEmissao, 30); // Validade de 30 dias por padrão

  const novaReq: Requisicao = {
    ...dados,
    id: uuidv4(),
    tenant_id: tenantId,
    codigo_requisicao: gerarCodigoRequisicao(indexHoje),
    data_emissao: dataEmissao.toISOString(),
    data_validade: dados.data_validade || dataValidade.toISOString(),
    created_at: dataEmissao.toISOString(),
    updated_at: dataEmissao.toISOString()
  };

  if (isOnline) {
    try {
      const { error } = await supabase.from('requisicoes').insert(novaReq);
      if (error) console.warn('Erro ao salvar requisição no Supabase:', error);
    } catch (e) {
      console.warn('Erro ao inserir requisição no Supabase:', e);
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
  if (isOnline) {
    try {
      const { error } = await supabase.from('requisicoes').upsert(reqAtualizada);
      if (error) console.warn('Erro ao atualizar requisicao no Supabase:', error);
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
  const req = await getFromIDB<Requisicao>('requisicoes', requisicaoId);
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
      await supabase.from('requisicoes').upsert(reqAtualizada);
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
export const gerarPDFGuiaRequisicao = async (req: Requisicao, empresa?: any) => {
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
  doc.text(`Data de Emissão: ${format(new Date(req.data_emissao), 'dd/MM/yyyy HH:mm')}`, 80, currentY);
  if (req.data_validade) {
    doc.text(`Validade: ${format(new Date(req.data_validade), 'dd/MM/yyyy')}`, 150, 38);
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
  let sigY = termoY + 30;
  
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
