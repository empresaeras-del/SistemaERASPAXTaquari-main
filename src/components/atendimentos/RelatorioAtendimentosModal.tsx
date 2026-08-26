import React, { useState, useMemo, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FileText, 
  Archive, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  Filter, 
  MapPin, 
  Calendar, 
  User, 
  TrendingUp 
} from 'lucide-react';
import { format } from 'date-fns';
import { Atendimento } from '../../types/atendimentos';
import { Empresa } from '../../services/empresasService';
import { Associado } from '../../services/associadosService';
import { formatLocalDate } from '../../utils/dateUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

interface RelatorioAtendimentosModalProps {
  isOpen: boolean;
  onClose: () => void;
  atendimentos: Atendimento[];
  empresaData: Empresa | null;
  associados?: Associado[];
  currentFilters?: {
    searchTerm?: string;
    statusFilter?: string;
  };
  userName?: string;
}

export const RelatorioAtendimentosModal: React.FC<RelatorioAtendimentosModalProps> = ({
  isOpen,
  onClose,
  atendimentos,
  empresaData,
  associados = [],
  currentFilters = {},
  userName = 'Operador do Sistema'
}) => {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [zoom, setZoom] = useState<number>(100);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Map de associados por ID
  const associadosMap = useMemo(() => {
    const map = new Map<string, Associado>();
    associados.forEach(a => {
      if (a.id) map.set(a.id, a);
    });
    return map;
  }, [associados]);

  // Lista formatada de atendimentos
  const reportData = useMemo(() => {
    return atendimentos.map((at, idx) => {
      const assoc = at.associado_id ? associadosMap.get(at.associado_id) : undefined;
      
      let statusLabel = 'Aberto';
      let statusColor = 'text-blue-700 bg-blue-50 border-blue-200';
      if (at.status === 'em_andamento') {
        statusLabel = 'Em Andamento';
        statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
      } else if (at.status === 'concluido') {
        statusLabel = 'Concluído';
        statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      } else if (at.status === 'cancelado') {
        statusLabel = 'Cancelado';
        statusColor = 'text-slate-600 bg-slate-100 border-slate-300';
      }

      const locais = [
        at.local_velorio ? `Velório: ${at.local_velorio}` : '',
        at.local_sepultamento ? `Sepultamento: ${at.local_sepultamento}` : ''
      ].filter(Boolean).join(' | ');

      const datas = [
        at.data_obito ? `Óbito: ${formatLocalDate(at.data_obito)}` : '',
        at.data_sepultamento ? `Sepult.: ${formatLocalDate(at.data_sepultamento)}` : ''
      ].filter(Boolean).join(' | ');

      return {
        index: idx + 1,
        id: at.id,
        codigo: at.id.substring(0, 8).toUpperCase(),
        falecidoNome: at.falecido_nome,
        falecidoCpf: at.falecido_cpf || 'Não informado',
        tipoCliente: at.tipo_cliente === 'associado' ? 'Associado' : 'Particular / Externo',
        associadoNome: assoc ? assoc.nome : (at.tipo_cliente === 'associado' ? 'Associado' : '-'),
        planoNome: assoc?.plano_nome || '-',
        locais: locais || '-',
        datas: datas || '-',
        dataRegistro: at.created_at ? formatLocalDate(at.created_at) : '-',
        valorTotal: at.valor_total || 0,
        valorFormatado: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(at.valor_total || 0),
        status: at.status,
        statusLabel,
        statusColor,
        qtdItens: at.itens?.length || 0
      };
    });
  }, [atendimentos, associadosMap]);

  // KPIs
  const totais = useMemo(() => {
    let valorGeral = 0;
    let abertos = 0;
    let emAndamento = 0;
    let concluidos = 0;
    let cancelados = 0;

    reportData.forEach(item => {
      valorGeral += item.valorTotal;
      if (item.status === 'aberto') abertos++;
      else if (item.status === 'em_andamento') emAndamento++;
      else if (item.status === 'concluido') concluidos++;
      else if (item.status === 'cancelado') cancelados++;
    });

    const ticketMedio = reportData.length > 0 ? valorGeral / reportData.length : 0;

    return {
      total: reportData.length,
      valorGeral,
      abertos,
      emAndamento,
      concluidos,
      cancelados,
      ticketMedio
    };
  }, [reportData]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 40));
  const handleZoomReset = () => setZoom(100);

  // Impressão limpa
  const handleImprimir = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('O navegador bloqueou a janela de impressão. Permita pop-ups.');
      return;
    }

    const dataHoraEmissao = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss");
    const logoHtml = empresaData?.logo_url 
      ? `<img src="${empresaData.logo_url}" alt="Logo" style="max-height: 55px; max-width: 220px; object-fit: contain;" />` 
      : `<h1 style="margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; color: #0f172a;">${empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX'}</h1>`;

    const rowsHtml = reportData.map(item => `
      <tr>
        <td style="text-align: center; font-weight: 600; color: #475569;">${item.index}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a; font-size: 11px;">${item.falecidoNome}</div>
          <div style="color: #64748b; font-size: 9px; margin-top: 1px;">
            <span><strong>CPF:</strong> ${item.falecidoCpf}</span> | <span>Prot: ${item.codigo}</span>
          </div>
        </td>
        <td style="font-size: 9.5px; color: #334155;">
          <div style="font-weight: 600;">${item.tipoCliente}</div>
          ${item.associadoNome !== '-' ? `<div style="color: #047857; font-size: 9px;">${item.associadoNome} (${item.planoNome})</div>` : ''}
        </td>
        <td style="font-size: 9px; color: #334155; line-height: 1.3;">
          ${item.locais}
        </td>
        <td style="font-size: 9px; color: #0f172a;">
          ${item.datas}
        </td>
        <td style="text-align: center; font-size: 9.5px; color: #0f172a;">
          ${item.dataRegistro}
        </td>
        <td style="text-align: right; font-weight: 800; font-size: 11px; color: #0f172a;">
          ${item.valorFormatado}
        </td>
        <td style="text-align: center;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; text-transform: uppercase;
            ${item.status === 'concluido' ? 'background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;' : ''}
            ${item.status === 'em_andamento' ? 'background: #fef3c7; color: #92400e; border: 1px solid #fde68a;' : ''}
            ${item.status === 'aberto' ? 'background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe;' : ''}
            ${item.status === 'cancelado' ? 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;' : ''}
          ">
            ${item.statusLabel}
          </span>
        </td>
      </tr>
    `).join('');

    const pageOrientationCss = orientation === 'landscape' ? 'size: A4 landscape;' : 'size: A4 portrait;';

    const printHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatório de Atendimentos Funerários - ERAS PAX</title>
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
            .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 12px; }
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
                <div class="title-main">Relatório de Atendimentos Funerários</div>
                <div style="font-size: 10px; font-weight: 600; color: #2563eb;">Gestão Operacional de Serviços e Funerais</div>
                <div style="font-size: 9px; color: #64748b; margin-top: 4px;">
                  <strong>Emissão:</strong> ${dataHoraEmissao}<br/>
                  <strong>Emitido por:</strong> ${userName}
                </div>
              </td>
            </tr>
          </table>

          <div class="filters-bar">
            <div><strong>Status:</strong> ${currentFilters.statusFilter ? currentFilters.statusFilter.toUpperCase() : 'TODOS'}</div>
            <div><strong>Busca:</strong> ${currentFilters.searchTerm ? `"${currentFilters.searchTerm}"` : 'Todos'}</div>
            <div><strong>Total Atendimentos:</strong> ${reportData.length}</div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card" style="border-left: 3px solid #3b82f6;">
              <div class="kpi-label">Total Atendimentos</div>
              <div class="kpi-val" style="color: #2563eb;">${totais.total}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #f59e0b;">
              <div class="kpi-label">Em Andamento</div>
              <div class="kpi-val" style="color: #d97706;">${totais.emAndamento}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #16a34a;">
              <div class="kpi-label">Concluídos</div>
              <div class="kpi-val" style="color: #16a34a;">${totais.concluidos}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #0f172a;">
              <div class="kpi-label">Valor Total dos Serviços</div>
              <div class="kpi-val" style="color: #0f172a;">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.valorGeral)}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #8b5cf6;">
              <div class="kpi-label">Ticket Médio</div>
              <div class="kpi-val" style="color: #7c3aed;">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.ticketMedio)}</div>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 3%; text-align: center;">#</th>
                <th style="width: 25%;">Falecido / Protocolo</th>
                <th style="width: 18%;">Origem / Associado</th>
                <th style="width: 22%;">Locais (Velório / Sepultamento)</th>
                <th style="width: 12%;">Datas Importantes</th>
                <th style="width: 8%; text-align: center;">Registro</th>
                <th style="width: 7%; text-align: right;">Valor</th>
                <th style="width: 5%; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background-color: #f1f5f9; font-weight: 800;">
                <td colspan="6" style="text-align: right; padding: 6px 8px; text-transform: uppercase; font-size: 10px;">
                  TOTAL CONSOLIDADO (${reportData.length} atendimentos):
                </td>
                <td style="text-align: right; font-size: 11px; color: #0f172a; padding: 6px 8px;">
                  ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.valorGeral)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div class="footer-info">
            <div>Sistema ERAS PAX Taquari - Gestão de Atendimentos Funerários</div>
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

  // Exportação via jsPDF
  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      toast.loading('Gerando PDF...', { id: 'export-atend-pdf' });

      const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
      });

      const dataHoraEmissao = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
      const companyName = empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX';

      // Header Background
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F');

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName.toUpperCase(), 14, 10);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('RELATÓRIO OPERACIONAL DE ATENDIMENTOS FUNERÁRIOS', 14, 16);

      doc.setFontSize(8);
      doc.text(`Emissão: ${dataHoraEmissao} | Operador: ${userName}`, doc.internal.pageSize.getWidth() - 14, 10, { align: 'right' });
      doc.text(`Total: ${reportData.length} atendimentos | Orientação: ${orientation === 'landscape' ? 'Paisagem' : 'Retrato'}`, doc.internal.pageSize.getWidth() - 14, 16, { align: 'right' });

      const tableData = reportData.map(item => [
        item.index.toString(),
        `${item.falecidoNome}\nCPF: ${item.falecidoCpf}\nProtocolo: ${item.codigo}`,
        `${item.tipoCliente}${item.associadoNome !== '-' ? '\n' + item.associadoNome + ' (' + item.planoNome + ')' : ''}`,
        item.locais,
        item.datas,
        item.dataRegistro,
        item.valorFormatado,
        item.statusLabel
      ]);

      autoTable(doc, {
        startY: 28,
        head: [['#', 'Falecido / Protocolo', 'Origem / Associado', 'Locais (Velório / Sepultamento)', 'Datas', 'Registro', 'Valor', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [15, 23, 42],
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: orientation === 'landscape' ? 55 : 40 },
          2: { cellWidth: orientation === 'landscape' ? 45 : 32 },
          3: { cellWidth: orientation === 'landscape' ? 60 : 42 },
          4: { cellWidth: orientation === 'landscape' ? 35 : 25 },
          5: { cellWidth: 18, halign: 'center' },
          6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
          7: { cellWidth: 20, halign: 'center' }
        },
        foot: [[
          { content: `TOTAL CONSOLIDADO (${reportData.length} atendimentos):`, colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
          { content: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.valorGeral), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
          { content: '', styles: { fillColor: [241, 245, 249] } }
        ]],
        margin: { left: 14, right: 14 }
      });

      const filename = `Relatorio_Atendimentos_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
      doc.save(filename);
      toast.success('Relatório em PDF exportado com sucesso!', { id: 'export-atend-pdf' });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF. Use a opção Imprimir.', { id: 'export-atend-pdf' });
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
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Relatório de Atendimentos Funerários
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {reportData.length} atendimentos
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Visualização fiel de serviços para impressão e exportação
            </p>
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-2 bg-[#1c222e] p-1.5 rounded-xl border border-[#2d3544]">
          <div className="flex items-center bg-[#13171f] rounded-lg p-1 mr-2 border border-[#2d3544]">
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                orientation === 'landscape' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Paisagem</span>
            </button>
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                orientation === 'portrait' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Retrato</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={handleZoomOut} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544]" title="Reduzir Zoom (-)">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={handleZoomReset} className="px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-[#2d3544] rounded-lg min-w-[54px] text-center" title="Resetar para 100%">
              {zoom}%
            </button>
            <button onClick={handleZoomIn} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544]" title="Ampliar Zoom (+)">
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
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#2d3544]">
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
            transition: 'transform 0.15s ease-out'
          }}
          className="mb-12 shadow-2xl"
        >
          <div 
            ref={printAreaRef}
            style={{
              width: orientation === 'landscape' ? '297mm' : '210mm',
              minHeight: orientation === 'landscape' ? '210mm' : '297mm',
              padding: '14mm 16mm'
            }}
            className="bg-white text-slate-900 rounded-sm shadow-2xl relative font-sans leading-normal box-border selection:bg-blue-100"
          >
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start gap-4">
              <div className="flex-1">
                {empresaData?.logo_url ? (
                  <img src={empresaData.logo_url} alt="Logo" className="max-h-14 max-w-[240px] object-contain mb-2" />
                ) : (
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase mb-1">
                    {empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX'}
                  </h1>
                )}
                <div className="text-xs text-slate-600 leading-tight space-y-0.5">
                  {empresaData?.cnpj && <p><span className="font-semibold text-slate-800">CNPJ:</span> {empresaData.cnpj} {empresaData.telefone ? ` | Tel: ${empresaData.telefone}` : ''}</p>}
                  {empresaData?.endereco && <p className="text-slate-500">{empresaData.endereco}</p>}
                </div>
              </div>

              <div className="text-right">
                <div className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] font-extrabold uppercase tracking-wide text-slate-800 mb-1">
                  Relatório Operacional
                </div>
                <h2 className="text-base font-black uppercase text-slate-900 tracking-wide">
                  Atendimentos Funerários
                </h2>
                <div className="text-[11px] text-slate-500 mt-1">
                  Emissão: <strong className="text-slate-800">{format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</strong>
                </div>
                <div className="text-[10px] text-slate-500">Emitido por: <span className="font-medium text-slate-700">{userName}</span></div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-2.5 mb-4">
              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50">
                <div className="text-[10px] font-bold text-blue-800 uppercase">Total Geral</div>
                <div className="text-sm font-black text-blue-700 mt-1">{totais.total}</div>
                <div className="text-[9px] text-blue-600 mt-0.5">Atendimentos listados</div>
              </div>
              <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
                <div className="text-[10px] font-bold text-amber-800 uppercase">Em Andamento</div>
                <div className="text-sm font-black text-amber-700 mt-1">{totais.emAndamento}</div>
                <div className="text-[9px] text-amber-600 mt-0.5">Em execução</div>
              </div>
              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">Concluídos</div>
                <div className="text-sm font-black text-emerald-700 mt-1">{totais.concluidos}</div>
                <div className="text-[9px] text-emerald-600 mt-0.5">Finalizados</div>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50">
                <div className="text-[10px] font-bold text-slate-700 uppercase">Montante Total</div>
                <div className="text-sm font-black text-slate-900 mt-1">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.valorGeral)}
                </div>
                <div className="text-[9px] text-slate-600 mt-0.5">Soma dos contratos</div>
              </div>
              <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50">
                <div className="text-[10px] font-bold text-purple-800 uppercase">Ticket Médio</div>
                <div className="text-sm font-black text-purple-700 mt-1">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.ticketMedio)}
                </div>
                <div className="text-[9px] text-purple-600 mt-0.5">Por atendimento</div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2 px-2 text-center w-[3%] border-r border-slate-700">#</th>
                    <th className="py-2 px-3 w-[25%] border-r border-slate-700">Falecido / Protocolo</th>
                    <th className="py-2 px-3 w-[18%] border-r border-slate-700">Origem / Associado</th>
                    <th className="py-2 px-3 w-[22%] border-r border-slate-700">Locais (Velório / Sepultamento)</th>
                    <th className="py-2 px-2 text-center w-[12%] border-r border-slate-700">Datas</th>
                    <th className="py-2 px-2 text-center w-[8%] border-r border-slate-700">Registro</th>
                    <th className="py-2 px-3 text-right w-[7%] border-r border-slate-700">Valor</th>
                    <th className="py-2 px-2 text-center w-[5%]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {reportData.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-2 text-center font-bold text-slate-500 border-r border-slate-200 text-[10px]">{item.index}</td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900 text-xs">{item.falecidoNome}</div>
                        <div className="text-[10px] text-slate-500 flex gap-1 items-center mt-0.5">
                          <span>CPF: {item.falecidoCpf}</span> | <span className="font-mono text-slate-700 font-bold">{item.codigo}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-semibold text-slate-800 text-[11px]">{item.tipoCliente}</div>
                        {item.associadoNome !== '-' && (
                          <div className="text-[10px] text-emerald-700 font-medium">{item.associadoNome} ({item.planoNome})</div>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-[10.5px] text-slate-700 leading-snug">
                        {item.locais}
                      </td>
                      <td className="py-2 px-2 text-center text-[10px] text-slate-700 border-r border-slate-200">
                        {item.datas}
                      </td>
                      <td className="py-2 px-2 text-center text-[11px] text-slate-900 border-r border-slate-200">
                        {item.dataRegistro}
                      </td>
                      <td className="py-2 px-3 text-right font-extrabold text-slate-900 border-r border-slate-200 text-[11.5px]">
                        {item.valorFormatado}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${item.statusColor}`}>
                          {item.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-400">
                    <td colSpan={6} className="py-2.5 px-3 text-right text-xs uppercase tracking-wide">
                      Total Consolidado ({reportData.length} atendimentos):
                    </td>
                    <td className="py-2.5 px-3 text-right text-sm text-slate-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.valorGeral)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-center text-[10px] text-slate-500">
              <div><strong>Sistema ERAS PAX Taquari</strong> - Gestão de Atendimentos Funerários</div>
              <div>Documento emitido eletronicamente em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div>
              <div>Página 1 de 1</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
