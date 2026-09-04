import React, { useState, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  CheckCircle2,
  DollarSign,
  Building2,
  User,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { format } from 'date-fns';
import { Empresa } from '../../services/empresasService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

export interface ReciboDados {
  numRecibo: string;
  tipo: 'recebimento' | 'pagamento';
  titulo?: string;
  pagadorNome: string;
  pagadorDoc?: string;
  beneficiarioNome?: string;
  beneficiarioDoc?: string;
  descricao: string;
  parcelaInfo?: string;
  categoria?: string;
  vencimentoOriginal?: string;
  dataLiquidacao: string;
  formaPagamento: string;
  valor: number;
  operadorNome?: string;
  observacoes?: string;
  planoInfo?: string;
  enderecoPagador?: string;
  contatoPagador?: string;
}

interface VisualizadorReciboModalProps {
  isOpen: boolean;
  onClose: () => void;
  dados: ReciboDados | null;
  empresaData: Empresa | null;
}

export const VisualizadorReciboModal: React.FC<VisualizadorReciboModalProps> = ({
  isOpen,
  onClose,
  dados,
  empresaData,
}) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [zoom, setZoom] = useState<number>(100);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !dados) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 40));
  const handleZoomReset = () => setZoom(100);

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(dados.valor);
  const dataEmissao = format(new Date(), 'dd/MM/yyyy');

  const handleImprimir = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('O navegador bloqueou a abertura da janela de impressão. Permita pop-ups.');
      return;
    }

    const logoHtml = empresaData?.logo_url
      ? `<img src="${empresaData.logo_url}" alt="Logo" style="max-height: 60px; max-width: 220px; object-fit: contain; margin-bottom: 6px;" />`
      : `<h2 style="margin: 0 0 4px 0; font-size: 18px; text-transform: uppercase; color: #0f172a; font-weight: 800;">${empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX'}</h2>`;

    const assinaturaHtml = empresaData?.assinatura_url
      ? `<img src="${empresaData.assinatura_url}" alt="Assinatura" style="max-height: 55px; max-width: 200px; object-fit: contain; margin-bottom: 4px;" />`
      : `<div style="height: 45px;"></div>`;

    const pageOrientationCss =
      orientation === 'landscape' ? 'size: A4 landscape;' : 'size: A4 portrait;';

    const printHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${dados.titulo || 'Recibo de Pagamento'} - Nº ${dados.numRecibo}</title>
          <style>
            @page { ${pageOrientationCss} margin: 12mm 15mm; }
            *, *::before, *::after { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a; margin: 0; padding: 0; background-color: #ffffff;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .recibo-wrapper {
              max-width: ${orientation === 'landscape' ? '920px' : '780px'};
              margin: 0 auto; border: 2px solid #0f172a; border-radius: 12px;
              padding: 24px; background: #ffffff;
            }
            .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; }
            .title-main { font-size: 20px; font-weight: 900; text-transform: uppercase; margin: 0 0 4px 0; color: #0f172a; }
            .badge-num {
              display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1;
              padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; color: #334155;
            }
            .valor-highlight {
              background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px;
              padding: 14px 20px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;
            }
            .valor-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #15803d; }
            .valor-num { font-size: 24px; font-weight: 900; color: #166534; }
            .section-box {
              border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px;
              margin-bottom: 12px; background: #f8fafc;
            }
            .section-title {
              font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b;
              margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;
            }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; font-size: 12px; }
            .grid-item span.label { display: block; color: #64748b; font-size: 10px; text-transform: uppercase; margin-bottom: 1px; }
            .grid-item span.val { font-weight: 600; color: #0f172a; }
            .declaracao-box {
              background: #ffffff; border: 1px dashed #94a3b8; border-radius: 8px;
              padding: 12px 16px; margin: 16px 0; font-size: 12px; line-height: 1.5; color: #1e293b; text-align: justify;
            }
            .footer-table { width: 100%; margin-top: 28px; page-break-inside: avoid; }
            .signature-col { text-align: center; width: 50%; padding: 0 20px; vertical-align: bottom; }
            .signature-line { border-top: 1px solid #0f172a; margin-top: 6px; padding-top: 6px; font-size: 11px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="recibo-wrapper">
            <table class="header-table">
              <tr>
                <td style="vertical-align: top; width: 55%;">
                  ${logoHtml}
                  <div style="font-size: 11px; color: #475569; line-height: 1.3;">
                    ${empresaData?.cnpj ? `<strong>CNPJ:</strong> ${empresaData.cnpj}<br/>` : ''}
                    ${empresaData?.endereco ? `${empresaData.endereco}<br/>` : ''}
                    ${empresaData?.telefone ? `<strong>Tel:</strong> ${empresaData.telefone}` : ''}
                    ${empresaData?.email ? ` | <strong>E-mail:</strong> ${empresaData.email}` : ''}
                  </div>
                </td>
                <td style="vertical-align: top; width: 45%; text-align: right;">
                  <div class="title-main">${dados.titulo || 'Recibo de Pagamento'}</div>
                  <div class="badge-num">Nº ${dados.numRecibo}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
                    <strong>Emissão:</strong> ${dataEmissao}
                  </div>
                </td>
              </tr>
            </table>

            <div class="valor-highlight">
              <div>
                <div class="valor-title">Valor Liquidado / Quitado</div>
                <div style="font-size: 11px; color: #166534; margin-top: 1px;">Operação financeira compensada</div>
              </div>
              <div class="valor-num">${valorFormatado}</div>
            </div>

            <div class="section-box">
              <div class="section-title">${dados.tipo === 'recebimento' ? 'Identificação do Pagador (Devedor)' : 'Identificação do Beneficiário (Credor)'}</div>
              <div class="grid-2">
                <div class="grid-item">
                  <span class="label">Nome / Razão Social:</span>
                  <span class="val">${dados.pagadorNome}</span>
                </div>
                <div class="grid-item">
                  <span class="label">CPF / CNPJ:</span>
                  <span class="val">${dados.pagadorDoc || 'Não informado'}</span>
                </div>
                ${
                  dados.planoInfo
                    ? `
                  <div class="grid-item" style="grid-column: span 2;">
                    <span class="label">Plano Vinculado:</span>
                    <span class="val" style="color: #047857;">${dados.planoInfo}</span>
                  </div>
                `
                    : ''
                }
              </div>
            </div>

            <div class="section-box">
              <div class="section-title">Dados da Cobrança / Movimentação</div>
              <div class="grid-2">
                <div class="grid-item">
                  <span class="label">Descrição:</span>
                  <span class="val">${dados.descricao}</span>
                </div>
                ${
                  dados.parcelaInfo
                    ? `
                  <div class="grid-item">
                    <span class="label">Parcela:</span>
                    <span class="val">${dados.parcelaInfo}</span>
                  </div>
                `
                    : ''
                }
                ${
                  dados.categoria
                    ? `
                  <div class="grid-item">
                    <span class="label">Categoria:</span>
                    <span class="val">${dados.categoria}</span>
                  </div>
                `
                    : ''
                }
                ${
                  dados.vencimentoOriginal
                    ? `
                  <div class="grid-item">
                    <span class="label">Vencimento Original:</span>
                    <span class="val">${dados.vencimentoOriginal}</span>
                  </div>
                `
                    : ''
                }
              </div>
            </div>

            <div class="section-box">
              <div class="section-title">Informações da Liquidação</div>
              <div class="grid-2">
                <div class="grid-item">
                  <span class="label">Data da Liquidação:</span>
                  <span class="val">${dados.dataLiquidacao}</span>
                </div>
                <div class="grid-item">
                  <span class="label">Forma de Pagamento:</span>
                  <span class="val">${dados.formaPagamento}</span>
                </div>
                <div class="grid-item">
                  <span class="label">Operador / Recebido Por:</span>
                  <span class="val">${dados.operadorNome || 'Sistema'}</span>
                </div>
                <div class="grid-item">
                  <span class="label">Situação:</span>
                  <span class="val" style="color: #15803d; font-weight: bold;">QUITADO / LIQUIDADO</span>
                </div>
              </div>
              ${
                dados.observacoes
                  ? `
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #475569;">
                  <strong>Observações:</strong> ${dados.observacoes}
                </div>
              `
                  : ''
              }
            </div>

            <div class="declaracao-box">
              ${
                dados.tipo === 'recebimento'
                  ? `Recebemos de <strong>${dados.pagadorNome}</strong> a quantia de <strong>${valorFormatado}</strong> referente à quitação de <strong>${dados.descricao}</strong> (${dados.parcelaInfo || 'Parcela Única'}), dando plena e geral quitação do valor discriminado.`
                  : `Declaramos para os devidos fins que foi pago a <strong>${dados.pagadorNome}</strong> a quantia de <strong>${valorFormatado}</strong> referente a <strong>${dados.descricao}</strong> (${dados.parcelaInfo || 'Parcela Única'}), estando o presente título devidamente liquidado.`
              }
            </div>

            <table class="footer-table">
              <tr>
                <td class="signature-col">
                  <div style="height: 40px;"></div>
                  <div class="signature-line">
                    ${dados.pagadorNome}<br/>
                    <span style="font-size: 9px; color: #64748b; font-weight: normal;">Assinatura / Pagador</span>
                  </div>
                </td>
                <td class="signature-col">
                  ${assinaturaHtml}
                  <div class="signature-line">
                    ${empresaData?.nome_fantasia || empresaData?.razao_social || 'EMPRESA EMISSORA'}<br/>
                    <span style="font-size: 9px; color: #64748b; font-weight: normal;">Recebedor Autorizado / Carimbo</span>
                  </div>
                </td>
              </tr>
            </table>

            <div style="text-align: center; margin-top: 18px; font-size: 10px; color: #94a3b8;">
              Documento emitido eletronicamente em ${dataEmissao} via Sistema ERAS PAX Taquari.
            </div>
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
      toast.loading('Gerando PDF do Recibo...', { id: 'export-recibo-pdf' });

      const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4',
      });

      const companyName =
        empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX';

      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName.toUpperCase(), 14, 10);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text((dados.titulo || 'RECIBO DE PAGAMENTO').toUpperCase(), 14, 16);

      doc.setFontSize(8);
      doc.text(
        `Nº ${dados.numRecibo} | Emissão: ${dataEmissao}`,
        doc.internal.pageSize.getWidth() - 14,
        10,
        { align: 'right' },
      );

      // Valor Box
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(34, 197, 94);
      doc.roundedRect(14, 28, doc.internal.pageSize.getWidth() - 28, 16, 2, 2, 'FD');

      doc.setTextColor(21, 128, 61);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('VALOR QUITADO / LIQUIDADO', 20, 34);

      doc.setFontSize(14);
      doc.text(valorFormatado, doc.internal.pageSize.getWidth() - 20, 38, { align: 'right' });

      // Dados Table
      const tableData = [
        [
          'PAGADOR / DEVEDOR:',
          `${dados.pagadorNome} (CPF/CNPJ: ${dados.pagadorDoc || 'Não informado'})`,
        ],
        ['PLANO:', dados.planoInfo || 'Individual / Avulso'],
        [
          'DESCRIÇÃO:',
          `${dados.descricao} ${dados.parcelaInfo ? '(' + dados.parcelaInfo + ')' : ''}`,
        ],
        ['CATEGORIA:', dados.categoria || 'Geral'],
        ['VENCIMENTO ORIGINAL:', dados.vencimentoOriginal || '-'],
        ['DATA DA LIQUIDAÇÃO:', dados.dataLiquidacao],
        ['FORMA DE PAGAMENTO:', dados.formaPagamento],
        ['OPERADOR RESPONSÁVEL:', dados.operadorNome || 'Sistema'],
      ];

      autoTable(doc, {
        startY: 48,
        body: tableData,
        theme: 'grid',
        bodyStyles: {
          fontSize: 8.5,
          cellPadding: 3,
          textColor: [15, 23, 42],
        },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold', fillColor: [248, 250, 252] },
          1: { cellWidth: doc.internal.pageSize.getWidth() - 78 },
        },
        margin: { left: 14, right: 14 },
      });

      const filename = `Recibo_${dados.numRecibo}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
      doc.save(filename);
      toast.success('Recibo exportado em PDF com sucesso!', { id: 'export-recibo-pdf' });
    } catch (err) {
      console.error('Erro ao gerar PDF do recibo:', err);
      toast.error('Erro ao gerar PDF. Use a opção Imprimir.', { id: 'export-recibo-pdf' });
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1e232a] text-slate-100 backdrop-blur-md overflow-hidden">
      {/* TOOLBAR */}
      <header className="h-16 bg-[#13171f] border-b border-[#2d3544] px-6 flex items-center justify-between shadow-xl shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                {dados.titulo || 'Recibo de Pagamento'} - Nº {dados.numRecibo}
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Quitado
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Visualização de alta resolução para impressão e exportação em PDF
            </p>
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-2 bg-[#1c222e] p-1.5 rounded-xl border border-[#2d3544]">
          <div className="flex items-center bg-[#13171f] rounded-lg p-1 mr-2 border border-[#2d3544]">
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
              width: orientation === 'portrait' ? '210mm' : '297mm',
              minHeight: orientation === 'portrait' ? '297mm' : '210mm',
              padding: '16mm 18mm',
            }}
            className="bg-white text-slate-900 rounded-sm shadow-2xl relative font-sans leading-normal box-border selection:bg-blue-100"
          >
            <div className="border-2 border-slate-900 rounded-2xl p-6">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-start">
                <div>
                  {empresaData?.logo_url ? (
                    <img
                      src={empresaData.logo_url}
                      alt="Logo"
                      className="max-h-12 max-w-[200px] object-contain mb-1.5"
                    />
                  ) : (
                    <h2 className="text-lg font-black uppercase text-slate-900">
                      {empresaData?.nome_fantasia ||
                        empresaData?.razao_social ||
                        'SISTEMA ERAS PAX'}
                    </h2>
                  )}
                  <div className="text-[11px] text-slate-600 leading-tight space-y-0.5">
                    {empresaData?.cnpj && (
                      <p>
                        <strong>CNPJ:</strong> {empresaData.cnpj}
                      </p>
                    )}
                    {empresaData?.endereco && (
                      <p className="text-slate-500">{empresaData.endereco}</p>
                    )}
                    {empresaData?.telefone && (
                      <p>
                        <strong>Tel:</strong> {empresaData.telefone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <h3 className="text-xl font-black uppercase text-slate-900 tracking-wide">
                    {dados.titulo || 'Recibo de Pagamento'}
                  </h3>
                  <div className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded font-bold text-xs text-slate-800 mt-1">
                    Nº {dados.numRecibo}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2">
                    Emissão: <strong className="text-slate-800">{dataEmissao}</strong>
                  </div>
                </div>
              </div>

              {/* Valor Destaque */}
              <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-4 mb-4 flex justify-between items-center">
                <div>
                  <div className="text-[11px] font-bold text-emerald-800 uppercase">
                    Valor Liquidado / Quitado
                  </div>
                  <div className="text-xs text-emerald-700">Pagamento confirmado e compensado</div>
                </div>
                <div className="text-2xl font-black text-emerald-800">{valorFormatado}</div>
              </div>

              {/* Pagador / Devedor */}
              <div className="border border-slate-300 rounded-xl p-4 mb-3 bg-slate-50">
                <div className="text-[10px] font-bold text-slate-500 uppercase pb-1 mb-2 border-b border-slate-200">
                  {dados.tipo === 'recebimento'
                    ? 'Identificação do Pagador (Devedor)'
                    : 'Identificação do Beneficiário (Credor)'}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">
                      Nome / Razão Social:
                    </span>
                    <strong className="text-slate-900">{dados.pagadorNome}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">CPF / CNPJ:</span>
                    <strong className="text-slate-900">
                      {dados.pagadorDoc || 'Não informado'}
                    </strong>
                  </div>
                  {dados.planoInfo && (
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px] uppercase">
                        Plano Vinculado:
                      </span>
                      <strong className="text-emerald-700 font-bold">{dados.planoInfo}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Dados da Movimentação */}
              <div className="border border-slate-300 rounded-xl p-4 mb-3 bg-slate-50">
                <div className="text-[10px] font-bold text-slate-500 uppercase pb-1 mb-2 border-b border-slate-200">
                  Dados da Cobrança / Título
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Descrição:</span>
                    <strong className="text-slate-900">{dados.descricao}</strong>
                  </div>
                  {dados.parcelaInfo && (
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Parcela:</span>
                      <strong className="text-slate-900">{dados.parcelaInfo}</strong>
                    </div>
                  )}
                  {dados.categoria && (
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Categoria:</span>
                      <strong className="text-slate-900">{dados.categoria}</strong>
                    </div>
                  )}
                  {dados.vencimentoOriginal && (
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">
                        Vencimento Original:
                      </span>
                      <strong className="text-slate-900">{dados.vencimentoOriginal}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Informações da Liquidação */}
              <div className="border border-slate-300 rounded-xl p-4 mb-4 bg-slate-50">
                <div className="text-[10px] font-bold text-slate-500 uppercase pb-1 mb-2 border-b border-slate-200">
                  Informações da Liquidação Efetivada
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">
                      Data da Liquidação:
                    </span>
                    <strong className="text-slate-900">{dados.dataLiquidacao}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">
                      Forma de Pagamento:
                    </span>
                    <strong className="text-blue-700 uppercase">{dados.formaPagamento}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">
                      Operador Responsável:
                    </span>
                    <strong className="text-slate-900">{dados.operadorNome || 'Sistema'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Situação:</span>
                    <strong className="text-emerald-700 uppercase font-black">
                      Quitado / Liquidado
                    </strong>
                  </div>
                </div>
                {dados.observacoes && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">Obs:</span> {dados.observacoes}
                  </div>
                )}
              </div>

              {/* Declaração de Quitação */}
              <div className="bg-white border border-dashed border-slate-400 rounded-xl p-3.5 mb-6 text-xs text-slate-700 leading-relaxed text-justify">
                {dados.tipo === 'recebimento'
                  ? `Recebemos de <strong>${dados.pagadorNome}</strong> a quantia de <strong>${valorFormatado}</strong> referente à quitação de <strong>${dados.descricao}</strong> (${dados.parcelaInfo || 'Parcela Única'}), dando plena, rasa e geral quitação do valor discriminado.`
                  : `Declaramos para os devidos fins que foi pago a <strong>${dados.pagadorNome}</strong> a quantia de <strong>${valorFormatado}</strong> referente a <strong>${dados.descricao}</strong> (${dados.parcelaInfo || 'Parcela Única'}), estando o presente título devidamente quitado.`}
              </div>

              {/* Assinaturas */}
              <div className="grid grid-cols-2 gap-8 pt-6">
                <div className="text-center">
                  <div className="h-10"></div>
                  <div className="border-t border-slate-900 pt-1 text-xs font-bold text-slate-900">
                    {dados.pagadorNome}
                    <div className="text-[10px] font-normal text-slate-500">
                      Assinatura do Pagador
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  {empresaData?.assinatura_url ? (
                    <img
                      src={empresaData.assinatura_url}
                      alt="Assinatura"
                      className="max-h-10 mx-auto mb-1 object-contain"
                    />
                  ) : (
                    <div className="h-10"></div>
                  )}
                  <div className="border-t border-slate-900 pt-1 text-xs font-bold text-slate-900">
                    {empresaData?.nome_fantasia || empresaData?.razao_social || 'EMPRESA EMISSORA'}
                    <div className="text-[10px] font-normal text-slate-500">
                      Recebedor Autorizado / Carimbo
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
