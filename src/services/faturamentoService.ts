import { supabase, registrarAuditoria } from '../lib/supabase';
import { getFromIDB, saveToIDB, getAllFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { generateUUID } from '../utils/uuid';
import { RemessaFaturamento, StatusRemessa } from '../types/faturamento';
import { Requisicao } from '../types/requisicoes';
import { salvarDespesa, cancelarDespesa, Despesa, ParcelaPagar, FormaPagamento } from './financeiroService';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import { fetchImageAsBase64, fetchImageWithDimensions } from '../utils/imageUtils';
import autoTable from 'jspdf-autotable';

export const gerarCodigoRemessa = (indexNumber: number = 1): string => {
  const dataHoje = new Date();
  const yyyy = dataHoje.getFullYear();
  const mm = String(dataHoje.getMonth() + 1).padStart(2, '0');
  const suf = String(indexNumber).padStart(3, '0');
  return `REM-${yyyy}${mm}-${suf}`;
};

export const getRemessas = async (isOnline: boolean, tenantId: string): Promise<RemessaFaturamento[]> => {
  if (isOnline) {
    try {
      let query = supabase.from('remessas_faturamento').select('*');
      if (tenantId && tenantId !== 'all') {
        query = query.eq('tenant_id', tenantId);
      }
      query = query.order('data_criacao', { ascending: false });
      const { data, error } = await query;
      if (!error && data) {
        for (const item of data) {
          await saveToIDB('remessas_faturamento', item);
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar remessas no Supabase, fallback IDB:', e);
    }
  }

  const localData = await getAllFromIDB<RemessaFaturamento>('remessas_faturamento');
  let result = localData;
  if (tenantId && tenantId !== 'all') {
    result = result.filter(r => r.tenant_id === tenantId);
  }

  // Autocorreção: se houver remessa com status 'fechada' sem lançamento gerado no Contas a Pagar, gera agora
  for (const rem of result) {
    if (rem.status === 'fechada' && rem.valor_liquido > 0) {
      try {
        const parcelaId = rem.parcela_pagar_id || generateUUID();
        const despesaId = rem.despesa_id || generateUUID();
        const existingP = await getFromIDB<ParcelaPagar>('parcelas_pagar', parcelaId);
        
        if (!existingP) {
          const effectiveTenant = rem.tenant_id || tenantId || 'default_tenant';
          const vencimento = rem.data_vencimento_pagamento || format(addDays(new Date(rem.data_criacao || new Date()), 15), 'yyyy-MM-dd');
          const dataCriacao = rem.data_fechamento || rem.data_criacao || new Date().toISOString();

          const novaDespesa: Despesa = {
            id: despesaId,
            tenant_id: effectiveTenant,
            tipo_credor: 'fornecedor_pj',
            credor_nome: rem.credenciado_nome,
            credor_cpf_cnpj: rem.credenciado_cnpj_cpf,
            descricao: `Faturamento Remessa ${rem.codigo_remessa} - ${rem.credenciado_nome} (${rem.qtd_guias} guias)`,
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
            descricao: `Remessa ${rem.codigo_remessa} (${rem.qtd_guias} guias)`,
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
              await supabase.from('remessas_faturamento').upsert(rem);
            }
          }
        }
      } catch (errSync) {
        console.warn('Erro ao auto-sincronizar contas a pagar de remessa fechada:', errSync);
      }
    }
  }

  return result.sort((a, b) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime());
};

export const criarRemessa = async (
  isOnline: boolean,
  tenantId: string,
  dados: Omit<RemessaFaturamento, 'id' | 'codigo_remessa' | 'data_criacao' | 'created_at' | 'updated_at'>
): Promise<RemessaFaturamento> => {
  const remessasExistentes = await getRemessas(isOnline, tenantId);
  const indexMes = remessasExistentes.filter(r => {
    const d = new Date(r.data_criacao);
    const hoje = new Date();
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  }).length + 1;

  const dataCriacao = new Date().toISOString();

  const novaRemessa: RemessaFaturamento = {
    ...dados,
    id: generateUUID(),
    tenant_id: tenantId,
    codigo_remessa: gerarCodigoRemessa(indexMes),
    data_criacao: dataCriacao,
    created_at: dataCriacao,
    updated_at: dataCriacao
  };

  if (isOnline) {
    try {
      const { error } = await supabase.from('remessas_faturamento').insert(novaRemessa);
      if (error) console.warn('Erro ao inserir remessa no Supabase:', error);
    } catch (e) {
      console.warn('Erro ao inserir remessa no Supabase:', e);
    }
    await saveToIDB('remessas_faturamento', novaRemessa);
    await registrarAuditoria('Criação de Remessa de Faturamento', {
      remessa_id: novaRemessa.id,
      codigo: novaRemessa.codigo_remessa,
      prestador: novaRemessa.credenciado_nome,
      qtd_guias: novaRemessa.qtd_guias,
      valor_liquido: novaRemessa.valor_liquido
    });
  } else {
    await saveToIDB('remessas_faturamento', novaRemessa);
    await addToSyncQueue({ storeName: 'remessas_faturamento', action: 'insert', data: novaRemessa });
  }

  return novaRemessa;
};

export const atualizarRemessa = async (
  isOnline: boolean,
  remessa: RemessaFaturamento
): Promise<RemessaFaturamento> => {
  const remessaAtualizada: RemessaFaturamento = {
    ...remessa,
    updated_at: new Date().toISOString()
  };

  if (isOnline) {
    try {
      await supabase.from('remessas_faturamento').upsert(remessaAtualizada);
    } catch (e) {
      console.warn('Erro ao atualizar remessa no Supabase:', e);
    }
    await saveToIDB('remessas_faturamento', remessaAtualizada);
  } else {
    await saveToIDB('remessas_faturamento', remessaAtualizada);
    await addToSyncQueue({ storeName: 'remessas_faturamento', action: 'update', data: remessaAtualizada });
  }

  return remessaAtualizada;
};

export const fecharRemessaEGerarContaPagar = async (
  isOnline: boolean,
  tenantId: string,
  remessaId: string,
  dataVencimento: string,
  formaPagamento: FormaPagamento = 'pix',
  usuarioNome: string = 'Operador'
): Promise<RemessaFaturamento> => {
  let remessa = await getFromIDB<RemessaFaturamento>('remessas_faturamento', remessaId);
  if (!remessa && isOnline) {
    try {
      const { data } = await supabase.from('remessas_faturamento').select('*').eq('id', remessaId).maybeSingle();
      if (data) remessa = data as RemessaFaturamento;
    } catch (e) {
      console.warn('Erro ao buscar remessa no Supabase:', e);
    }
  }

  if (!remessa) {
    throw new Error('Remessa não encontrada.');
  }

  const effectiveTenantId = remessa.tenant_id || tenantId || 'default_tenant';
  const despesaId = remessa.despesa_id || generateUUID();
  const parcelaId = remessa.parcela_pagar_id || generateUUID();
  const dataHoje = new Date().toISOString();

  // 1. Gerar Despesa (Contas a Pagar)
  const novaDespesa: Despesa = {
    id: despesaId,
    tenant_id: effectiveTenantId,
    tipo_credor: 'fornecedor_pj',
    credor_nome: remessa.credenciado_nome,
    credor_cpf_cnpj: remessa.credenciado_cnpj_cpf,
    descricao: `Faturamento Remessa ${remessa.codigo_remessa} - ${remessa.credenciado_nome} (${remessa.qtd_guias} guias)`,
    categoria: 'Repasse Credenciados / Prestadores',
    centro_custo: 'Rede Assistencial',
    data_emissao: dataHoje,
    data_inicio_pagamento: dataVencimento,
    valor_total: remessa.valor_liquido,
    qtd_parcelas: 1,
    forma_pagamento_padrao: formaPagamento,
    observacoes: `Gerado automaticamente pelo fechamento da Remessa de Faturamento ${remessa.codigo_remessa}. ${remessa.observacoes || ''}`,
    status: 'ativo',
    criado_em: dataHoje,
    criado_por: usuarioNome,
    atualizado_em: dataHoje
  };

  const novaParcela: ParcelaPagar = {
    id: parcelaId,
    tenant_id: effectiveTenantId,
    despesa_id: despesaId,
    numero_parcela: 1,
    total_parcelas: 1,
    tipo_credor: 'fornecedor_pj',
    credor_nome: remessa.credenciado_nome,
    credor_cpf_cnpj: remessa.credenciado_cnpj_cpf,
    descricao: `Remessa ${remessa.codigo_remessa} (${remessa.qtd_guias} guias)`,
    data_vencimento: dataVencimento,
    valor: remessa.valor_liquido,
    forma_pagamento: formaPagamento,
    observacao: `Vencimento do Faturamento da Rede Credenciada (${remessa.codigo_remessa})`,
    status: 'pendente',
    criado_em: dataHoje,
    atualizado_em: dataHoje
  };

  // Salvar no Financeiro (IDB e Supabase)
  await salvarDespesa(isOnline, novaDespesa, [novaParcela]);

  // 2. Atualizar a Remessa
  const remessaFechada: RemessaFaturamento = {
    ...remessa,
    tenant_id: effectiveTenantId,
    status: 'fechada',
    data_fechamento: dataHoje,
    data_vencimento_pagamento: dataVencimento,
    despesa_id: despesaId,
    parcela_pagar_id: parcelaId,
    fechado_por: usuarioNome,
    updated_at: dataHoje
  };

  await atualizarRemessa(isOnline, remessaFechada);

  await registrarAuditoria('Fechamento de Remessa e Geração de Conta a Pagar', {
    remessa_id: remessa.id,
    codigo_remessa: remessa.codigo_remessa,
    despesa_id: despesaId,
    valor_liquido: remessa.valor_liquido,
    data_vencimento: dataVencimento
  });

  return remessaFechada;
};

// IMPRESSÃO / EXPORTAÇÃO PDF DO RELATÓRIO DA REMESSA DE FATURAMENTO
export const gerarPDFRelatorioFaturamento = async (
  remessa: RemessaFaturamento,
  requisicoesInclusas: Requisicao[],
  logoUrl?: string,
  assinaturaUrl?: string
) => {
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
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('DEMONSTRATIVO DE FATURAMENTO DE REMESSA', 14, currentY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`REMESSA: ${remessa.codigo_remessa}`, 196, currentY, { align: 'right' });
  currentY += 10;
  
  let startY = currentY;

  // Bloco de Informações da Remessa
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

    doc.text(`Prestador: ${remessa.credenciado_nome}`, 14, currentY);
  doc.text(`Documento (CNPJ/CPF): ${remessa.credenciado_cnpj_cpf || 'Não Informado'}`, 14, currentY + 5);
  doc.text(`Tipo Prestador: ${remessa.tipo_prestador === 'credenciado' ? 'Rede Credenciada' : 'Rede Externa'}`, 14, currentY + 10);

  doc.text(`Data de Criação: ${format(new Date(remessa.data_criacao), 'dd/MM/yyyy HH:mm')}`, 130, currentY);
  doc.text(`Status: ${remessa.status.toUpperCase()}`, 130, currentY + 5);
  if (remessa.data_vencimento_pagamento) {
    doc.text(`Venc. Financeiro: ${format(new Date(remessa.data_vencimento_pagamento), 'dd/MM/yyyy')}`, 130, currentY + 10);
  }

  currentY += 16;

  // Tabela de Guias / Requisições inclusas
  const tableRows = requisicoesInclusas.map(req => {
    const procsNomes = req.itens.map(i => `${i.descricao} (${i.quantidade}x)`).join(', ');
    return [
      req.codigo_requisicao,
      format(new Date(req.data_emissao), 'dd/MM/yyyy'),
      req.paciente_nome,
      procsNomes,
      formatBRL(req.valor_total)
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Guia/Cód', 'Emissão', 'Paciente/Beneficiário', 'Procedimentos/Exames', 'Valor (R$)']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8 }
  });

  // Resumo Financeiro no final
  const finalY = (doc as any).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: finalY,
    head: [['RESUMO DE FATURAMENTO DA REMESSA', 'VALOR']],
    body: [
      ['Total de Guias Inclusas', `${remessa.qtd_guias} guia(s)`],
      ['Valor Bruto das Guias', formatBRL(remessa.valor_bruto)],
      ['Descontos / Glosas Aplicadas', `- ${formatBRL(remessa.valor_desconto_glosa || 0)}`],
      ['VALOR LÍQUIDO A PAGAR AO PRESTADOR', formatBRL(remessa.valor_liquido)]
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 120 },
      1: { halign: 'right', fontStyle: 'bold' }
    },
    styles: { fontSize: 9 }
  });

  const footerY = (doc as any).lastAutoTable.finalY + 12;

  if (remessa.observacoes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Observações da Remessa: ${remessa.observacoes}`, 14, footerY);
  }

// Assinaturas
  const sigY = footerY + 22;
  
  if (assinaturaUrl) {
    const sigImgData = await fetchImageWithDimensions(assinaturaUrl);
    if (sigImgData && sigImgData.base64) {
      const sigHeight = 15;
      const sigWidth = (sigImgData.width * sigHeight) / sigImgData.height;
      
      const sigX = 14 + (81 - sigWidth) / 2; // center within the line (14 to 95) => width is 81. center = 14 + (81 - sigWidth)/2
      
      doc.addImage(sigImgData.base64, 'PNG', sigX, sigY - 18, sigWidth, sigHeight, '', 'FAST');
    }
  }

  doc.setLineWidth(0.5);
  doc.setDrawColor(203, 213, 225);

  doc.line(14, sigY, 95, sigY);
  doc.line(115, sigY, 196, sigY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Responsável pelo Faturamento (Operadora)', 22, sigY + 5);
  doc.text('Aceite do Prestador Credenciado', 130, sigY + 5);

  doc.save(`Faturamento_Remessa_${remessa.codigo_remessa}.pdf`);
};


export const reabrirRemessa = async (
  isOnline: boolean,
  tenantId: string,
  remessaId: string,
  justificativa: string,
  usuarioNome: string
): Promise<RemessaFaturamento> => {
  const remessa = await getFromIDB<RemessaFaturamento>('remessas_faturamento', remessaId);
  if (!remessa) {
    throw new Error('Remessa não encontrada.');
  }

  if (remessa.status !== 'fechada') {
    throw new Error('Apenas remessas fechadas podem ser reabertas.');
  }

  // Cancelar Contas a Pagar geradas
  if (remessa.despesa_id) {
    await cancelarDespesa(isOnline, remessa.despesa_id);
  }

  const dataHoje = new Date().toISOString();
  
  const remessaReaberta: RemessaFaturamento = {
    ...remessa,
    status: 'em_aberto',
    data_fechamento: undefined,
    data_vencimento_pagamento: undefined,
    despesa_id: undefined,
    parcela_pagar_id: undefined,
    fechado_por: undefined,
    updated_at: dataHoje,
    observacoes: (remessa.observacoes || '') + `
[${format(new Date(), 'dd/MM/yyyy HH:mm')} - ${usuarioNome}] Reabertura: ${justificativa}`
  };

  await atualizarRemessa(isOnline, remessaReaberta);

  await registrarAuditoria('Reabertura de Remessa de Faturamento', {
    remessa_id: remessa.id,
    codigo_remessa: remessa.codigo_remessa,
    despesa_cancelada_id: remessa.despesa_id,
    justificativa,
    reaberto_por: usuarioNome
  });

  return remessaReaberta;
};
