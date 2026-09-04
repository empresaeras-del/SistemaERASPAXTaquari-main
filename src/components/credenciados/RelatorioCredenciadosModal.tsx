import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  Building2,
  CheckCircle2,
  AlertCircle,
  HeartPulse,
  Stethoscope,
  Filter,
  MapPin,
  Phone,
  Mail,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { Credenciado } from '../../types/credenciados';
import { Empresa } from '../../services/empresasService';
import { formatLocalDate } from '../../utils/dateUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

interface RelatorioCredenciadosModalProps {
  isOpen: boolean;
  onClose: () => void;
  credenciados: Credenciado[];
  empresaData: Empresa | null;
  currentFilters?: {
    searchTerm?: string;
    statusFilter?: string;
    ramoFilter?: string;
  };
  userName?: string;
}

export const RelatorioCredenciadosModal: React.FC<RelatorioCredenciadosModalProps> = ({
  isOpen,
  onClose,
  credenciados,
  empresaData,
  currentFilters = {},
  userName = 'Operador do Sistema',
}) => {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [zoom, setZoom] = useState<number>(100);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Lista formatada
  const reportData = useMemo(() => {
    return credenciados.map((c, idx) => {
      const endereco = [
        c.endereco ? `${c.endereco}${c.numero ? ', ' + c.numero : ''}` : '',
        c.bairro ? `Bairro: ${c.bairro}` : '',
        c.cidade ? `${c.cidade}${c.estado ? '/' + c.estado : ''}` : '',
        c.cep ? `CEP: ${c.cep}` : '',
      ]
        .filter(Boolean)
        .join(' - ');

      const contato = [
        c.telefone ? `Tel: ${c.telefone}` : '',
        c.email ? `Email: ${c.email}` : '',
        c.responsavel_nome ? `Resp: ${c.responsavel_nome}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      let statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      if (c.status === 'bloqueado') statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
      else if (c.status === 'descredenciado')
        statusColor = 'text-slate-600 bg-slate-100 border-slate-300';

      return {
        index: idx + 1,
        id: c.id,
        razaoSocial: c.razao_social,
        nomeFantasia: c.nome_fantasia || '-',
        cnpjCpf: c.cnpj_cpf,
        ramoFormatado: (c.ramo_atividade || 'outros').replace(/_/g, ' ').toUpperCase(),
        registroProfissional: c.registro_profissional || '-',
        enderecoCompleto: endereco || 'Endereço não informado',
        contatoCompleto: contato || 'Contato não informado',
        status: c.status,
        statusColor,
      };
    });
  }, [credenciados]);

  // KPIs
  const totais = useMemo(() => {
    const total = reportData.length;
    const ativos = credenciados.filter((c) => c.status === 'ativo').length;
    const bloqueados = credenciados.filter((c) => c.status === 'bloqueado').length;
    const clinicas = credenciados.filter(
      (c) => c.ramo_atividade.includes('clinica') || c.ramo_atividade.includes('hospital'),
    ).length;
    const profissionais = credenciados.filter(
      (c) =>
        c.ramo_atividade.includes('medico') ||
        c.ramo_atividade.includes('dentista') ||
        c.ramo_atividade.includes('psicologo'),
    ).length;

    return {
      total,
      ativos,
      bloqueados,
      clinicas,
      profissionais,
    };
  }, [reportData, credenciados]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 40));
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

    const rowsHtml = reportData
      .map(
        (item) => `
      <tr>
        <td style="text-align: center; font-weight: 600; color: #475569;">${item.index}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a; font-size: 10.5px;">${item.razaoSocial}</div>
          <div style="color: #64748b; font-size: 9px; margin-top: 1px;">
            <span><strong>Fantasia:</strong> ${item.nomeFantasia}</span> | <span><strong>CNPJ/CPF:</strong> ${item.cnpjCpf}</span>
          </div>
        </td>
        <td style="font-size: 9.5px; color: #2563eb; font-weight: 700;">
          ${item.ramoFormatado}
          ${item.registroProfissional !== '-' ? `<div style="color: #64748b; font-size: 8.5px; font-weight: normal;">Reg: ${item.registroProfissional}</div>` : ''}
        </td>
        <td style="font-size: 9.5px; color: #334155; line-height: 1.25;">
          ${item.enderecoCompleto}
        </td>
        <td style="font-size: 9.5px; color: #334155; line-height: 1.25;">
          ${item.contatoCompleto}
        </td>
        <td style="text-align: center;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; text-transform: uppercase;
            ${item.status === 'ativo' ? 'background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;' : ''}
            ${item.status === 'bloqueado' ? 'background: #fef3c7; color: #92400e; border: 1px solid #fde68a;' : ''}
            ${item.status === 'descredenciado' ? 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;' : ''}
          ">
            ${item.status}
          </span>
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
          <title>Relatório da Rede Credenciada - ERAS PAX</title>
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
                <div class="title-main">Relatório da Rede Credenciada</div>
                <div style="font-size: 10px; font-weight: 600; color: #2563eb;">Parceiros, Médicos & Clínicas de Saúde</div>
                <div style="font-size: 9px; color: #64748b; margin-top: 4px;">
                  <strong>Emissão:</strong> ${dataHoraEmissao}<br/>
                  <strong>Emitido por:</strong> ${userName}
                </div>
              </td>
            </tr>
          </table>

          <div class="filters-bar">
            <div><strong>Ramo:</strong> ${currentFilters.ramoFilter ? currentFilters.ramoFilter.toUpperCase() : 'TODOS'}</div>
            <div><strong>Status:</strong> ${currentFilters.statusFilter ? currentFilters.statusFilter.toUpperCase() : 'TODOS'}</div>
            <div><strong>Busca:</strong> ${currentFilters.searchTerm ? `"${currentFilters.searchTerm}"` : 'Todos'}</div>
            <div><strong>Total Listado:</strong> ${reportData.length} credenciados</div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card" style="border-left: 3px solid #3b82f6;">
              <div class="kpi-label">Total Cadastros</div>
              <div class="kpi-val" style="color: #2563eb;">${totais.total}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #16a34a;">
              <div class="kpi-label">Ativos</div>
              <div class="kpi-val" style="color: #16a34a;">${totais.ativos}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #0284c7;">
              <div class="kpi-label">Clínicas/Hospitais</div>
              <div class="kpi-val" style="color: #0284c7;">${totais.clinicas}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #8b5cf6;">
              <div class="kpi-label">Profissionais Saúde</div>
              <div class="kpi-val" style="color: #7c3aed;">${totais.profissionais}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #f59e0b;">
              <div class="kpi-label">Bloqueados / Outros</div>
              <div class="kpi-val" style="color: #d97706;">${totais.bloqueados}</div>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 3%; text-align: center;">#</th>
                <th style="width: 27%;">Credenciado / Razão Social</th>
                <th style="width: 17%;">Ramo de Atividade</th>
                <th style="width: 25%;">Endereço Completo</th>
                <th style="width: 20%;">Contatos / Responsável</th>
                <th style="width: 8%; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background-color: #f1f5f9; font-weight: 800;">
                <td colspan="6" style="text-align: right; padding: 6px 8px; text-transform: uppercase; font-size: 10px;">
                  Total de Credenciados: ${reportData.length} parceiros listados
                </td>
              </tr>
            </tfoot>
          </table>

          <div class="footer-info">
            <div>Sistema ERAS PAX Taquari - Gestão de Rede Credenciada</div>
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
      toast.loading('Gerando PDF...', { id: 'export-cred-pdf' });

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
      doc.text('RELATÓRIO GERENCIAL DA REDE CREDENCIADA', 14, 16);

      doc.setFontSize(8);
      doc.text(
        `Emissão: ${dataHoraEmissao} | Operador: ${userName}`,
        doc.internal.pageSize.getWidth() - 14,
        10,
        { align: 'right' },
      );
      doc.text(
        `Total: ${reportData.length} parceiros | Orientação: ${orientation === 'landscape' ? 'Paisagem' : 'Retrato'}`,
        doc.internal.pageSize.getWidth() - 14,
        16,
        { align: 'right' },
      );

      const tableData = reportData.map((item) => [
        item.index.toString(),
        `${item.razaoSocial}\nFantasia: ${item.nomeFantasia}\nCNPJ/CPF: ${item.cnpjCpf}`,
        `${item.ramoFormatado}${item.registroProfissional !== '-' ? '\nReg: ' + item.registroProfissional : ''}`,
        item.enderecoCompleto,
        item.contatoCompleto,
        item.status,
      ]);

      autoTable(doc, {
        startY: 28,
        head: [
          [
            '#',
            'Credenciado / Razão Social',
            'Ramo de Atividade',
            'Endereço Completo',
            'Contatos / Responsável',
            'Status',
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
          1: { cellWidth: orientation === 'landscape' ? 70 : 50 },
          2: { cellWidth: orientation === 'landscape' ? 45 : 30 },
          3: { cellWidth: orientation === 'landscape' ? 75 : 55 },
          4: { cellWidth: orientation === 'landscape' ? 50 : 35 },
          5: { cellWidth: 20, halign: 'center' },
        },
        foot: [
          [
            {
              content: `TOTAL CONSOLIDADO: ${reportData.length} credenciados`,
              colSpan: 6,
              styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] },
            },
          ],
        ],
        margin: { left: 14, right: 14 },
      });

      const filename = `Relatorio_Credenciados_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
      doc.save(filename);
      toast.success('Relatório em PDF exportado com sucesso!', { id: 'export-cred-pdf' });
    } catch (err) {
      console.error('Erro ao gerar PDF de credenciados:', err);
      toast.error('Erro ao gerar PDF. Use a opção Imprimir.', { id: 'export-cred-pdf' });
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
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Relatório de Rede Credenciada
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {reportData.length} credenciados
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Visualização fiel de parceiros e profissionais de saúde
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
                  Rede Credenciada
                </div>
                <h2 className="text-base font-black uppercase text-slate-900 tracking-wide">
                  Parceiros & Saúde
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
            <div className="grid grid-cols-5 gap-2.5 mb-4">
              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50">
                <div className="text-[10px] font-bold text-blue-800 uppercase">Total Cadastros</div>
                <div className="text-sm font-black text-blue-700 mt-1">{totais.total}</div>
                <div className="text-[9px] text-blue-600 mt-0.5">Rede credenciada</div>
              </div>
              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">Ativos</div>
                <div className="text-sm font-black text-emerald-700 mt-1">{totais.ativos}</div>
                <div className="text-[9px] text-emerald-600 mt-0.5">Parceiros ativos</div>
              </div>
              <div className="p-2.5 rounded-lg border border-sky-200 bg-sky-50/50">
                <div className="text-[10px] font-bold text-sky-800 uppercase">
                  Clínicas/Hospitais
                </div>
                <div className="text-sm font-black text-sky-700 mt-1">{totais.clinicas}</div>
                <div className="text-[9px] text-sky-600 mt-0.5">Unidades médicas</div>
              </div>
              <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50">
                <div className="text-[10px] font-bold text-purple-800 uppercase">
                  Profissionais Saúde
                </div>
                <div className="text-sm font-black text-purple-700 mt-1">
                  {totais.profissionais}
                </div>
                <div className="text-[9px] text-purple-600 mt-0.5">Médicos/Dentistas</div>
              </div>
              <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
                <div className="text-[10px] font-bold text-amber-800 uppercase">
                  Bloqueados/Outros
                </div>
                <div className="text-sm font-black text-amber-700 mt-1">{totais.bloqueados}</div>
                <div className="text-[9px] text-amber-600 mt-0.5">Suspensos</div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2 px-2 text-center w-[3%] border-r border-slate-700">#</th>
                    <th className="py-2 px-3 w-[27%] border-r border-slate-700">
                      Credenciado / Razão Social
                    </th>
                    <th className="py-2 px-3 w-[17%] border-r border-slate-700">
                      Ramo de Atividade
                    </th>
                    <th className="py-2 px-3 w-[25%] border-r border-slate-700">
                      Endereço Completo
                    </th>
                    <th className="py-2 px-3 w-[20%] border-r border-slate-700">
                      Contatos / Responsável
                    </th>
                    <th className="py-2 px-2 text-center w-[8%]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {reportData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-2 text-center font-bold text-slate-500 border-r border-slate-200 text-[10px]">
                        {item.index}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900 text-xs">{item.razaoSocial}</div>
                        <div className="text-[10px] text-slate-500 flex gap-1 items-center mt-0.5">
                          {item.nomeFantasia !== '-' && (
                            <span>Fantasia: {item.nomeFantasia} | </span>
                          )}
                          <span>CPF/CNPJ: {item.cnpjCpf}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-blue-700 text-[10.5px]">
                          {item.ramoFormatado}
                        </div>
                        {item.registroProfissional !== '-' && (
                          <div className="text-[9.5px] text-slate-500">
                            Reg: {item.registroProfissional}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-[10.5px] text-slate-700 leading-snug">
                        {item.enderecoCompleto}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-[10.5px] text-slate-700 leading-snug">
                        {item.contatoCompleto}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${item.statusColor}`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-400">
                    <td
                      colSpan={6}
                      className="py-2.5 px-3 text-right text-xs uppercase tracking-wide"
                    >
                      Total de Credenciados: {reportData.length} parceiros listados
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-center text-[10px] text-slate-500">
              <div>
                <strong>Sistema ERAS PAX Taquari</strong> - Gestão da Rede Credenciada
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
