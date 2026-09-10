import React, { useEffect, useState } from 'react';
import { X, Printer, Download, ZoomIn, ZoomOut, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Associado } from '../../services/associadosService';
import { Empresa, getEmpresaById } from '../../services/empresasService';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { formatLocalDate } from '../../utils/dateUtils';
import {
  montarSecoesFicha,
  montarDependentesFicha,
  montarHtmlImpressaoFicha,
  SecaoFicha,
} from '../../utils/fichaCadastroAssociado';

interface FichaCadastroModalProps {
  isOpen: boolean;
  onClose: () => void;
  associado: Associado;
}

/**
 * Prévia da Ficha de Cadastro do Associado, com zoom, impressão e exportação
 * em PDF — segue o mesmo padrão de `VisualizadorReciboModal.tsx`: uma prévia
 * em tela (Tailwind, com zoom) e uma janela de impressão à parte com CSS
 * próprio, porque a janela de impressão não enxerga Tailwind (ver CLAUDE.md,
 * seção "Impressão"). O conteúdo dos dois — e do PDF — vem de
 * `utils/fichaCadastroAssociado.ts`, para não haver três listas de campos
 * divergentes.
 */
export const FichaCadastroModal: React.FC<FichaCadastroModalProps> = ({
  isOpen,
  onClose,
  associado,
}) => {
  const { state } = useAppContext();
  const toast = useToast();
  const [zoom, setZoom] = useState<number>(100);
  const [empresaData, setEmpresaData] = useState<Empresa | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelado = false;
    const carregarEmpresa = async () => {
      try {
        const tenantId = state.empresaSelecionada || 'default_tenant';
        const empresa = await getEmpresaById(tenantId, state.isOnline);
        if (!cancelado) setEmpresaData(empresa);
      } catch (e) {
        console.warn('Erro ao buscar empresa para a ficha:', e);
      }
    };
    carregarEmpresa();
    return () => {
      cancelado = true;
    };
  }, [isOpen, state.empresaSelecionada, state.isOnline]);

  if (!isOpen) return null;

  const secoes = montarSecoesFicha(associado);
  const dependentes = montarDependentesFicha(associado);
  const dataEmissao = formatLocalDate(new Date());
  const empresaNome = empresaData?.nome_fantasia || empresaData?.razao_social || '';

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 40));
  const handleZoomReset = () => setZoom(100);

  const handleImprimir = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('O navegador bloqueou a abertura da janela de impressão. Permita pop-ups.');
      return;
    }

    const printHtml = montarHtmlImpressaoFicha(associado, empresaData, dataEmissao);
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let y = 16;

      // Cabeçalho
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text((empresaNome || 'FICHA DE CADASTRO').toUpperCase(), margin, y);

      doc.setFontSize(13);
      doc.text('FICHA DE CADASTRO DO ASSOCIADO', pageWidth - margin, y, { align: 'right' });
      y += 5;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      if (empresaData?.cnpj) doc.text(`CNPJ: ${empresaData.cnpj}`, margin, y);
      doc.text(
        `Emitida em: ${dataEmissao} | Status: ${associado.status.toUpperCase()}`,
        pageWidth - margin,
        y,
        { align: 'right' },
      );
      y += 3;

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      const addSecaoTable = (secao: SecaoFicha) => {
        const corpo = secao.linhas
          .map((linha) => linha.map((c) => `${c.label}: ${c.valor}`).join('     '))
          .join('\n');

        autoTable(doc, {
          startY: y,
          head: [[secao.titulo.toUpperCase()]],
          body: [[corpo]],
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 8.5, cellPadding: 2, textColor: [15, 23, 42] },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 3;
      };

      secoes.forEach(addSecaoTable);

      // Dependentes
      if (dependentes.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Nome', 'Parentesco', 'CPF', 'Data de Nascimento']],
          body: dependentes.map((d) => [d.nome, d.parentesco, d.cpf, d.dataNascimento]),
          theme: 'grid',
          headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 2 },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 3;
      } else {
        autoTable(doc, {
          startY: y,
          head: [[`DEPENDENTES (0)`]],
          body: [['Nenhum dependente cadastrado.']],
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 8.5, cellPadding: 2, fontStyle: 'italic', textColor: [100, 116, 139] },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 3;
      }

      // Assinaturas — reserva espaço numa página nova se não couber.
      const alturaAssinatura = 30;
      if (y + alturaAssinatura > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      y += 10;
      const colWidth = (contentWidth - 20) / 2;
      const col1X = margin;
      const col2X = margin + colWidth + 20;

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.2);
      doc.line(col1X, y, col1X + colWidth, y);
      doc.line(col2X, y, col2X + colWidth, y);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(associado.nome, col1X + colWidth / 2, y + 4, { align: 'center' });
      doc.text(empresaNome || 'Assinatura da Empresa', col2X + colWidth / 2, y + 4, { align: 'center' });

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Assinatura do Associado', col1X + colWidth / 2, y + 8, { align: 'center' });
      doc.text(
        empresaData?.cnpj ? `CNPJ: ${empresaData.cnpj}` : 'Carimbo e Assinatura',
        col2X + colWidth / 2,
        y + 8,
        { align: 'center' },
      );

      const filename = `Ficha_de_Cadastro_${associado.nome.replace(/\s+/g, '_')}.pdf`;
      doc.save(filename);
      toast.success('Ficha exportada em PDF com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF da ficha:', err);
      toast.error('Erro ao gerar PDF. Use a opção Imprimir.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1e232a] text-slate-100 backdrop-blur-md overflow-hidden">
      {/* TOOLBAR */}
      <header className="h-16 bg-[#13171f] border-b border-[#2d3544] px-6 flex items-center justify-between shadow-xl shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center text-[#3B82F6] shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white tracking-wide truncate">
              Ficha de Cadastro — {associado.nome}
            </h2>
            <p className="text-xs text-slate-400">Pré-visualização para impressão e exportação em PDF</p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#1c222e] p-1.5 rounded-xl border border-[#2d3544] shrink-0">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544]"
            title="Reduzir Zoom (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomReset}
            className="px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-[#2d3544] rounded-lg min-w-[54px] text-center"
            title="Resetar para 100%"
          >
            {zoom}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544]"
            title="Ampliar Zoom (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            <span>Salvar PDF</span>
          </button>
          <button
            type="button"
            onClick={handleImprimir}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-blue-600/20"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
          <div className="h-6 w-px bg-[#2d3544]" />
          <button
            type="button"
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
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', transition: 'transform 0.15s ease-out' }}
          className="mb-12 shadow-2xl"
        >
          <div
            style={{ width: '210mm', minHeight: '297mm', padding: '12mm 15mm' }}
            className="bg-white text-slate-900 rounded-sm shadow-2xl relative font-sans box-border selection:bg-blue-100"
          >
            {/* Cabeçalho */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2 mb-2.5">
              <div>
                {empresaData?.logo_url ? (
                  <img
                    src={empresaData.logo_url}
                    alt="Logo"
                    className="max-h-11 max-w-[200px] object-contain"
                  />
                ) : empresaNome ? (
                  <h2 className="text-[15px] font-black uppercase text-slate-900">{empresaNome}</h2>
                ) : null}
                {empresaData?.cnpj && (
                  <p className="text-[9px] text-slate-500 mt-0.5">CNPJ: {empresaData.cnpj}</p>
                )}
              </div>
              <div className="text-right">
                <h1 className="text-[15px] font-black uppercase text-slate-900">
                  Ficha de Cadastro do Associado
                </h1>
                <p className="text-[9px] text-slate-500 mt-0.5">Emitida em: {dataEmissao}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase bg-slate-100 border border-slate-300 text-slate-700">
                  {associado.status}
                </span>
              </div>
            </div>

            {/* Seções de campos */}
            {secoes.map((secao) => (
              <div key={secao.titulo} className="border border-slate-300 rounded-md mb-1.5 overflow-hidden">
                <div className="bg-slate-100 border-b border-slate-300 px-2 py-1 text-[8.5px] font-bold uppercase tracking-wide text-slate-600">
                  {secao.titulo}
                </div>
                <div className="px-2 py-1">
                  {secao.linhas.map((linha, i) => (
                    <div key={i} className="flex flex-wrap gap-x-5 gap-y-0.5 text-[10.5px] py-0.5">
                      {linha.map((campo) => (
                        <span key={campo.label}>
                          <strong className="text-slate-700">{campo.label}:</strong>{' '}
                          <span className="text-slate-900">{campo.valor}</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Dependentes */}
            <div className="border border-slate-300 rounded-md mb-1.5 overflow-hidden">
              <div className="bg-slate-100 border-b border-slate-300 px-2 py-1 text-[8.5px] font-bold uppercase tracking-wide text-slate-600">
                Dependentes ({dependentes.length})
              </div>
              <div className="px-2 py-1.5">
                {dependentes.length > 0 ? (
                  <table className="w-full border-collapse text-[9.5px]">
                    <thead>
                      <tr>
                        <th className="border border-slate-300 bg-slate-50 px-1.5 py-1 text-left font-bold">
                          Nome
                        </th>
                        <th className="border border-slate-300 bg-slate-50 px-1.5 py-1 text-left font-bold">
                          Parentesco
                        </th>
                        <th className="border border-slate-300 bg-slate-50 px-1.5 py-1 text-left font-bold">
                          CPF
                        </th>
                        <th className="border border-slate-300 bg-slate-50 px-1.5 py-1 text-left font-bold">
                          Data de Nascimento
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dependentes.map((dep, i) => (
                        <tr key={i}>
                          <td className="border border-slate-300 px-1.5 py-1">{dep.nome}</td>
                          <td className="border border-slate-300 px-1.5 py-1">{dep.parentesco}</td>
                          <td className="border border-slate-300 px-1.5 py-1">{dep.cpf}</td>
                          <td className="border border-slate-300 px-1.5 py-1">{dep.dataNascimento}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-[10px] italic text-slate-500">Nenhum dependente cadastrado.</p>
                )}
              </div>
            </div>

            {/* Assinaturas */}
            <div className="flex justify-between mt-6">
              <div className="text-center w-[46%]">
                <div className="h-8"></div>
                <div className="border-t border-slate-900 pt-1">
                  <div className="text-[10px] font-bold uppercase text-slate-900">{associado.nome}</div>
                  <div className="text-[8.5px] text-slate-500">Assinatura do Associado</div>
                </div>
              </div>
              <div className="text-center w-[46%]">
                {empresaData?.assinatura_url ? (
                  <img
                    src={empresaData.assinatura_url}
                    alt="Assinatura"
                    className="max-h-8 mx-auto mb-1 object-contain"
                  />
                ) : (
                  <div className="h-8"></div>
                )}
                <div className="border-t border-slate-900 pt-1">
                  <div className="text-[10px] font-bold uppercase text-slate-900">
                    {empresaNome || 'Assinatura da Empresa'}
                  </div>
                  <div className="text-[8.5px] text-slate-500">
                    {empresaData?.cnpj ? `CNPJ: ${empresaData.cnpj}` : 'Carimbo e Assinatura'}
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
