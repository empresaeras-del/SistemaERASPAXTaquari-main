import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  Layers,
  Building2,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { ParcelaPagar, Despesa } from '../../services/financeiroService';
import { Empresa } from '../../services/empresasService';
import { formatLocalDate, formatLocalDateTime, isDateBeforeToday } from '../../utils/dateUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

interface RelatorioContasPagarModalProps {
  isOpen: boolean;
  onClose: () => void;
  parcelas: ParcelaPagar[];
  empresaData: Empresa | null;
  despesas?: Despesa[];
  currentFilters?: {
    searchTerm?: string;
    statusFilter?: string;
    formaPagamentoFilter?: string;
    dataInicial?: string;
    dataFinal?: string;
  };
  userName?: string;
}

export const RelatorioContasPagarModal: React.FC<RelatorioContasPagarModalProps> = ({
  isOpen,
  onClose,
  parcelas,
  empresaData,
  despesas = [],
  currentFilters = {},
  userName = 'Operador do Sistema',
}) => {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [zoom, setZoom] = useState<number>(100);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const despesasMap = useMemo(() => {
    const map = new Map<string, Despesa>();
    despesas.forEach((d) => {
      if (d.id) map.set(d.id, d);
    });
    return map;
  }, [despesas]);

  const reportData = useMemo(() => {
    return parcelas.map((p, idx) => {
      const desp = p.despesa_id ? despesasMap.get(p.despesa_id) : undefined;

      let statusLabel = 'Pendente';
      let statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
      if (p.status === 'pago' || p.status === 'recebido') {
        statusLabel = 'Pago / Liquidado';
        statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      } else if (p.status === 'cancelado') {
        statusLabel = 'Cancelado';
        statusColor = 'text-slate-600 bg-slate-100 border-slate-300';
      } else if (isDateBeforeToday(p.data_vencimento)) {
        statusLabel = 'Vencido';
        statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
      }

      return {
        index: idx + 1,
        parcela: p,
        despesa: desp,
        credorNome:
          p.credor_nome ||
          desp?.fornecedor_nome ||
          desp?.funcionario_nome ||
          desp?.credor_nome ||
          'Não informado',
        credorDoc:
          p.credor_cpf_cnpj ||
          desp?.fornecedor_cnpj_cpf ||
          desp?.funcionario_cpf ||
          desp?.credor_cpf_cnpj ||
          '-',
        categoria: desp?.categoria || 'Geral',
        centroCusto: desp?.centro_custo || '-',
        descricao: p.descricao || desp?.descricao || 'Despesa',
        numeroParcelaStr: `Parc. ${p.numero_parcela}/${p.total_parcelas || 1}`,
        vencimentoFormatado: formatLocalDate(p.data_vencimento),
        valorFormatado: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(p.valor),
        valorNumerico: p.valor,
        valorPagoNumerico: p.valor_pago || (p.status === 'pago' ? p.valor : 0),
        statusLabel,
        statusColor,
        formaPagamento: (p.forma_pagamento_efetivo || p.forma_pagamento || 'PIX').toUpperCase(),
        dataPagamento:
          p.data_pagamento || p.pago_em ? formatLocalDateTime(p.data_pagamento || p.pago_em) : '-',
      };
    });
  }, [parcelas, despesasMap]);

  const totalizadores = useMemo(() => {
    let totalGeral = 0;
    let totalPendente = 0;
    let totalVencido = 0;
    let totalPago = 0;
    let qtdPendentes = 0;
    let qtdVencidas = 0;
    let qtdPagas = 0;

    reportData.forEach((item) => {
      totalGeral += item.valorNumerico;
      if (item.parcela.status === 'pago' || item.parcela.status === 'recebido') {
        totalPago += item.valorPagoNumerico;
        qtdPagas++;
      } else if (item.parcela.status === 'pendente') {
        if (isDateBeforeToday(item.parcela.data_vencimento)) {
          totalVencido += item.valorNumerico;
          qtdVencidas++;
        } else {
          totalPendente += item.valorNumerico;
          qtdPendentes++;
        }
      }
    });

    return {
      totalGeral,
      totalPendente,
      totalVencido,
      totalPago,
      qtdPendentes,
      qtdVencidas,
      qtdPagas,
      qtdTotal: reportData.length,
    };
  }, [reportData]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 40));
  const handleZoomReset = () => setZoom(100);

  const handleImprimir = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('O navegador bloqueou a abertura da janela de impressão. Permita pop-ups.');
      return;
    }

    const dataHoraEmissao = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss");
    const logoHtml = empresaData?.logo_url
      ? `<img src="${empresaData.logo_url}" alt="Logo" style="max-height: 55px; max-width: 220px; object-fit: contain;" />`
      : `<h1 style="margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; color: #0f172a;">${empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX'}</h1>`;

    const filtroPeriodo =
      currentFilters.dataInicial || currentFilters.dataFinal
        ? `${currentFilters.dataInicial ? formatLocalDate(currentFilters.dataInicial) : 'Início'} até ${currentFilters.dataFinal ? formatLocalDate(currentFilters.dataFinal) : 'Atual'}`
        : 'Todos os Períodos';

    const rowsHtml = reportData
      .map(
        (item) => `
      <tr>
        <td style="text-align: center; font-weight: 600; color: #475569;">${item.index}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a; font-size: 11px;">${item.credorNome}</div>
          <div style="color: #64748b; font-size: 9px; margin-top: 1px;">
            <span>CPF/CNPJ: ${item.credorDoc}</span>
          </div>
        </td>
        <td style="font-size: 9.5px; color: #334155;">
          <div style="font-weight: 600; color: #047857;">${item.categoria}</div>
          ${item.centroCusto !== '-' ? `<div style="color: #64748b; font-size: 8.5px;">CC: ${item.centroCusto}</div>` : ''}
        </td>
        <td style="font-size: 10px; color: #0f172a;">
          <div style="font-weight: 600;">${item.descricao}</div>
          <div style="color: #64748b; font-size: 9px;">${item.numeroParcelaStr} (${item.formaPagamento})</div>
        </td>
        <td style="text-align: center; font-weight: 600; font-size: 10px; color: #0f172a;">
          ${item.vencimentoFormatado}
        </td>
        <td style="text-align: right; font-weight: 800; font-size: 10.5px; color: #0f172a;">
          ${item.valorFormatado}
        </td>
        <td style="text-align: center;">
          <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; 
            ${item.statusLabel.includes('Pago') ? 'background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;' : ''}
            ${item.statusLabel === 'Vencido' ? 'background: #ffe4e6; color: #9f1239; border: 1px solid #fecdd3;' : ''}
            ${item.statusLabel === 'Pendente' ? 'background: #fef3c7; color: #92400e; border: 1px solid #fde68a;' : ''}
            ${item.statusLabel === 'Cancelado' ? 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;' : ''}
          ">
            ${item.statusLabel}
          </span>
          ${item.dataPagamento !== '-' ? `<div style="font-size: 8px; color: #15803d; margin-top: 2px;">Pago: ${item.dataPagamento}</div>` : ''}
        </td>
      </tr>
    `,
      )
      .join('');

    const pageOrientationCss =
      orientation === 'landscape' ? 'size: A4 landscape;' : 'size: A4 portrait;';

    const printHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatório de Contas a Pagar - ERAS PAX</title>
          <style>
            @page { ${pageOrientationCss} margin: 8mm 10mm; }
            *, *::before, *::after { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a; margin: 0; padding: 0; background-color: #ffffff;
              -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10px;
            }
            .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
            .title-main { font-size: 16px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0 0 4px 0; }
            .filters-bar {
              background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
              padding: 6px 10px; margin-bottom: 10px; display: flex; justify-content: space-between;
              font-size: 9.5px; color: #475569;
            }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
            .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; background: #f8fafc; }
            .kpi-label { font-size: 8.5px; text-transform: uppercase; font-weight: 700; color: #64748b; }
            .kpi-val { font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 2px; }
            table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            table.data-table th {
              background-color: #0f172a !important; color: #ffffff !important;
              font-weight: 800; font-size: 9.5px; text-transform: uppercase;
              padding: 6px 7px; border: 1px solid #0f172a; text-align: left;
            }
            table.data-table td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: top; }
            table.data-table tr:nth-child(even) { background-color: #f8fafc; }
            .footer-info {
              border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 14px;
              display: flex; justify-content: space-between; font-size: 8.5px; color: #64748b;
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="vertical-align: top; width: 50%;">
                ${logoHtml}
                <div style="font-size: 9.5px; color: #475569; margin-top: 3px; line-height: 1.3;">
                  ${empresaData?.cnpj ? `<strong>CNPJ:</strong> ${empresaData.cnpj} | ` : ''}
                  ${empresaData?.telefone ? `<strong>Tel:</strong> ${empresaData.telefone}<br/>` : '<br/>'}
                  ${empresaData?.endereco ? `${empresaData.endereco}` : ''}
                </div>
              </td>
              <td style="vertical-align: top; width: 50%; text-align: right;">
                <div class="title-main">Relatório de Contas a Pagar</div>
                <div style="font-size: 10px; font-weight: 600; color: #2563eb;">Gestão Financeira de Despesas & Fornecedores</div>
                <div style="font-size: 9px; color: #64748b; margin-top: 4px;">
                  <strong>Emissão:</strong> ${dataHoraEmissao}<br/>
                  <strong>Emitido por:</strong> ${userName}
                </div>
              </td>
            </tr>
          </table>

          <div class="filters-bar">
            <div><strong>Período:</strong> ${filtroPeriodo}</div>
            <div><strong>Status:</strong> ${currentFilters.statusFilter ? currentFilters.statusFilter.toUpperCase() : 'TODOS'}</div>
            <div><strong>Forma de Pagto:</strong> ${currentFilters.formaPagamentoFilter ? currentFilters.formaPagamentoFilter.toUpperCase() : 'TODAS'}</div>
            <div><strong>Total Registros:</strong> ${reportData.length}</div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card" style="border-left: 3px solid #3b82f6;">
              <div class="kpi-label">Total a Pagar (Pendente)</div>
              <div class="kpi-val" style="color: #2563eb;">
                ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalizadores.totalPendente)}
              </div>
              <div style="font-size: 8px; color: #64748b; margin-top: 1px;">${totalizadores.qtdPendentes} despesa(s)</div>
            </div>

            <div class="kpi-card" style="border-left: 3px solid #e11d48;">
              <div class="kpi-label">Vencidas (Em Atraso)</div>
              <div class="kpi-val" style="color: #e11d48;">
                ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalizadores.totalVencido)}
              </div>
              <div style="font-size: 8px; color: #64748b; margin-top: 1px;">${totalizadores.qtdVencidas} despesa(s)</div>
            </div>

            <div class="kpi-card" style="border-left: 3px solid #16a34a;">
              <div class="kpi-label">Pagas / Liquidadas</div>
              <div class="kpi-val" style="color: #16a34a;">
                ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalizadores.totalPago)}
              </div>
              <div style="font-size: 8px; color: #64748b; margin-top: 1px;">${totalizadores.qtdPagas} despesa(s)</div>
            </div>

            <div class="kpi-card" style="border-left: 3px solid #0f172a;">
              <div class="kpi-label">Montante Geral</div>
              <div class="kpi-val" style="color: #0f172a;">
                ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalizadores.totalGeral)}
              </div>
              <div style="font-size: 8px; color: #64748b; margin-top: 1px;">${totalizadores.qtdTotal} registros listados</div>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 3%; text-align: center;">#</th>
                <th style="width: 26%;">Fornecedor / Credor</th>
                <th style="width: 16%;">Categoria / Centro Custo</th>
                <th style="width: 25%;">Descrição / Parcela</th>
                <th style="width: 10%; text-align: center;">Vencimento</th>
                <th style="width: 10%; text-align: right;">Valor</th>
                <th style="width: 10%; text-align: center;">Situação</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background-color: #f1f5f9; font-weight: 800;">
                <td colspan="5" style="text-align: right; padding: 6px 8px; text-transform: uppercase; font-size: 10px;">
                  TOTAL CONSOLIDADO (${reportData.length} despesas):
                </td>
                <td style="text-align: right; font-size: 11px; color: #0f172a; padding: 6px 8px;">
                  ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalizadores.totalGeral)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div class="footer-info">
            <div>Sistema ERAS PAX Taquari - Gestão Financeira de Contas a Pagar</div>
            <div>Documento emitido eletronicamente em ${dataHoraEmissao}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      toast.loading('Gerando PDF...', { id: 'export-pagar-pdf' });

      const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4',
      });

      const dataHoraEmissao = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
      const companyName =
        empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX';

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName.toUpperCase(), 14, 10);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('RELATÓRIO GERENCIAL DE CONTAS A PAGAR / DESPESAS', 14, 16);

      doc.setFontSize(8);
      doc.text(
        `Emissão: ${dataHoraEmissao} | Operador: ${userName}`,
        doc.internal.pageSize.getWidth() - 14,
        10,
        { align: 'right' },
      );
      doc.text(
        `Total: ${reportData.length} parcelas | Orientação: ${orientation === 'landscape' ? 'Paisagem' : 'Retrato'}`,
        doc.internal.pageSize.getWidth() - 14,
        16,
        { align: 'right' },
      );

      const tableData = reportData.map((item) => [
        item.index.toString(),
        `${item.credorNome}\nCPF/CNPJ: ${item.credorDoc}`,
        `${item.categoria}${item.centroCusto !== '-' ? '\nCC: ' + item.centroCusto : ''}`,
        `${item.descricao}\n${item.numeroParcelaStr} (${item.formaPagamento})`,
        item.vencimentoFormatado,
        item.valorFormatado,
        item.statusLabel,
      ]);

      autoTable(doc, {
        startY: 28,
        head: [
          [
            '#',
            'Fornecedor / Credor',
            'Categoria / Centro Custo',
            'Descrição / Parcela',
            'Vencimento',
            'Valor',
            'Situação',
          ],
        ],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'left',
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [15, 23, 42],
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: orientation === 'landscape' ? 65 : 45 },
          2: { cellWidth: orientation === 'landscape' ? 45 : 30 },
          3: { cellWidth: orientation === 'landscape' ? 70 : 50 },
          4: { cellWidth: 20, halign: 'center' },
          5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
          6: { cellWidth: 22, halign: 'center' },
        },
        foot: [
          [
            {
              content: `TOTAL CONSOLIDADO:`,
              colSpan: 5,
              styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] },
            },
            {
              content: new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(totalizadores.totalGeral),
              styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] },
            },
            { content: '', styles: { fillColor: [241, 245, 249] } },
          ],
        ],
        margin: { left: 14, right: 14 },
      });

      const filename = `Relatorio_Contas_a_Pagar_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
      doc.save(filename);
      toast.success('Relatório em PDF exportado com sucesso!', { id: 'export-pagar-pdf' });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF. Use a opção Imprimir.', { id: 'export-pagar-pdf' });
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1e232a] text-slate-100 backdrop-blur-md overflow-hidden">
      {/* TOOLBAR */}
      <header className="h-16 bg-[#13171f] border-b border-[#2d3544] px-6 flex items-center justify-between shadow-xl shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Relatório de Contas a Pagar
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {reportData.length} despesas
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Visualização fiel de despesas e vencimentos para impressão e exportação
            </p>
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-2 bg-[#1c222e] p-1.5 rounded-xl border border-[#2d3544]">
          <div className="flex items-center bg-[#13171f] rounded-lg p-1 mr-2 border border-[#2d3544]">
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                orientation === 'landscape'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Paisagem</span>
            </button>
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                orientation === 'portrait'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Retrato</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544]"
              title="Reduzir Zoom (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-[#2d3544] rounded-lg min-w-[54px] text-center"
              title="Resetar para 100%"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544]"
              title="Ampliar Zoom (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            <span>Salvar PDF</span>
          </button>
          <button
            onClick={handleImprimir}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-blue-600/20"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
          <div className="h-6 w-px bg-[#2d3544]" />
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#2d3544]"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* CANVAS */}
      <main className="flex-1 overflow-auto p-8 flex justify-center items-start bg-[#1a1e27] custom-scrollbar">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="mb-12 shadow-2xl"
        >
          <div
            ref={printAreaRef}
            style={{
              width: orientation === 'landscape' ? '297mm' : '210mm',
              minHeight: orientation === 'landscape' ? '210mm' : '297mm',
              padding: '14mm 16mm',
            }}
            className="bg-white text-slate-900 rounded-sm shadow-2xl relative font-sans leading-normal box-border selection:bg-blue-100"
          >
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start gap-4">
              <div className="flex-1">
                {empresaData?.logo_url ? (
                  <img
                    src={empresaData.logo_url}
                    alt="Logo"
                    className="max-h-14 max-w-[240px] object-contain mb-2"
                  />
                ) : (
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase mb-1">
                    {empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX'}
                  </h1>
                )}
                <div className="text-xs text-slate-600 leading-tight space-y-0.5">
                  {empresaData?.cnpj && (
                    <p>
                      <span className="font-semibold text-slate-800">CNPJ:</span> {empresaData.cnpj}{' '}
                      {empresaData.telefone ? ` | Tel: ${empresaData.telefone}` : ''}
                    </p>
                  )}
                  {empresaData?.endereco && (
                    <p className="text-slate-500">{empresaData.endereco}</p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] font-extrabold uppercase tracking-wide text-slate-800 mb-1">
                  Relatório Financeiro
                </div>
                <h2 className="text-base font-black uppercase text-slate-900 tracking-wide">
                  Contas a Pagar
                </h2>
                <div className="text-[11px] text-slate-500 mt-1">
                  Emissão:{' '}
                  <strong className="text-slate-800">
                    {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
                  </strong>
                </div>
                <div className="text-[10px] text-slate-500">
                  Emitido por: <span className="font-medium text-slate-700">{userName}</span>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-2.5 mb-4">
              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50">
                <div className="text-[10px] font-bold text-blue-800 uppercase">
                  A Pagar (Pendente)
                </div>
                <div className="text-sm font-black text-blue-700 mt-1">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    totalizadores.totalPendente,
                  )}
                </div>
                <div className="text-[9px] text-blue-600 mt-0.5">
                  {totalizadores.qtdPendentes} despesa(s)
                </div>
              </div>
              <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50">
                <div className="text-[10px] font-bold text-rose-800 uppercase">Vencidas</div>
                <div className="text-sm font-black text-rose-700 mt-1">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    totalizadores.totalVencido,
                  )}
                </div>
                <div className="text-[9px] text-rose-600 mt-0.5">
                  {totalizadores.qtdVencidas} despesa(s)
                </div>
              </div>
              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">
                  Pagas / Liquidadas
                </div>
                <div className="text-sm font-black text-emerald-700 mt-1">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    totalizadores.totalPago,
                  )}
                </div>
                <div className="text-[9px] text-emerald-600 mt-0.5">
                  {totalizadores.qtdPagas} despesa(s)
                </div>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50">
                <div className="text-[10px] font-bold text-slate-700 uppercase">Montante Geral</div>
                <div className="text-sm font-black text-slate-900 mt-1">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    totalizadores.totalGeral,
                  )}
                </div>
                <div className="text-[9px] text-slate-600 mt-0.5">
                  {totalizadores.qtdTotal} registros
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2 px-2 text-center w-[3%] border-r border-slate-700">#</th>
                    <th className="py-2 px-3 w-[26%] border-r border-slate-700">
                      Fornecedor / Credor
                    </th>
                    <th className="py-2 px-3 w-[16%] border-r border-slate-700">
                      Categoria / Centro Custo
                    </th>
                    <th className="py-2 px-3 w-[25%] border-r border-slate-700">
                      Descrição / Parcela
                    </th>
                    <th className="py-2 px-2 text-center w-[10%] border-r border-slate-700">
                      Vencimento
                    </th>
                    <th className="py-2 px-3 text-right w-[10%] border-r border-slate-700">
                      Valor
                    </th>
                    <th className="py-2 px-2 text-center w-[10%]">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {reportData.map((item) => (
                    <tr key={item.parcela.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-2 text-center font-bold text-slate-500 border-r border-slate-200 text-[10px]">
                        {item.index}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900 text-xs">{item.credorNome}</div>
                        <div className="text-[10px] text-slate-500 flex gap-1 items-center mt-0.5">
                          <span>CPF/CNPJ: {item.credorDoc}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-800 text-[11px]">{item.categoria}</div>
                        {item.centroCusto !== '-' && (
                          <div className="text-[9.5px] text-slate-500">CC: {item.centroCusto}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-semibold text-slate-900 text-[11px]">
                          {item.descricao}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {item.numeroParcelaStr}{' '}
                          <span className="uppercase text-blue-600 font-medium">
                            ({item.formaPagamento})
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center font-semibold text-slate-900 border-r border-slate-200 text-[11px]">
                        {item.vencimentoFormatado}
                      </td>
                      <td className="py-2 px-3 text-right font-extrabold text-slate-900 border-r border-slate-200 text-[11.5px]">
                        {item.valorFormatado}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${item.statusColor}`}
                        >
                          {item.statusLabel}
                        </span>
                        {item.dataPagamento !== '-' && (
                          <div className="text-[8px] text-emerald-700 font-medium mt-0.5">
                            {item.dataPagamento}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-400">
                    <td
                      colSpan={5}
                      className="py-2.5 px-3 text-right text-xs uppercase tracking-wide"
                    >
                      Total Consolidado ({reportData.length} despesas):
                    </td>
                    <td className="py-2.5 px-3 text-right text-sm text-slate-900">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(totalizadores.totalGeral)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-center text-[10px] text-slate-500">
              <div>
                <strong>Sistema ERAS PAX Taquari</strong> - Gestão Financeira de Contas a Pagar
              </div>
              <div>
                Documento emitido eletronicamente em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
              </div>
              <div>Página 1 de 1</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
