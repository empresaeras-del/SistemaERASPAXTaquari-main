import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FileText, 
  Building2, 
  User, 
  SlidersHorizontal,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { DocumentoPadrao, TipoDocumento } from '../../types/documentos';
import { Empresa } from '../../services/empresasService';
import { Associado } from '../../services/associadosService';
import { formatLocalDate } from '../../utils/dateUtils';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

const TIPO_LABELS: Record<TipoDocumento, string> = {
  'contrato_adesao': 'Contrato de Adesão',
  'termo_rescisao': 'Termo de Rescisão',
  'termo_credenciamento': 'Termo de Credenciamento',
  'aditivo': 'Aditivo/Atualização',
  'outro': 'Outro'
};

export interface VisualizadorDocumentoPadraoModalProps {
  isOpen: boolean;
  onClose: () => void;
  documento: DocumentoPadrao | null;
  empresaData?: Empresa | null;
  empresas?: Empresa[];
  associados?: Associado[];
  initialPlaceholderValues?: Record<string, string>;
  onEmpresaSelect?: (empresaId: string) => void;
  onAssociadoSelect?: (associadoId: string) => void;
  customTitle?: string;
}

export const VisualizadorDocumentoPadraoModal: React.FC<VisualizadorDocumentoPadraoModalProps> = ({
  isOpen,
  onClose,
  documento,
  empresaData: initialEmpresaData,
  empresas = [],
  associados = [],
  initialPlaceholderValues = {},
  onEmpresaSelect,
  onAssociadoSelect,
  customTitle
}) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [zoom, setZoom] = useState<number>(100);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [searchVar, setSearchVar] = useState('');
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');
  const [selectedAssociadoId, setSelectedAssociadoId] = useState<string>('');
  const [currentEmpresa, setCurrentEmpresa] = useState<Empresa | null>(initialEmpresaData || null);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>(initialPlaceholderValues);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Sincroniza empresa atual caso mude por props
  useEffect(() => {
    if (initialEmpresaData) {
      setCurrentEmpresa(initialEmpresaData);
      setSelectedEmpresaId(initialEmpresaData.id);
    }
  }, [initialEmpresaData]);

  // Inicializa valores de placeholders ao abrir o documento
  useEffect(() => {
    if (!documento || !isOpen) return;

    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [...(documento.conteudo || '').matchAll(regex)];
    const initialVals: Record<string, string> = { ...initialPlaceholderValues };
    const now = new Date();

    // Valores padrão automáticos de data/hora
    const autoValues: Record<string, string> = {
      '{{data_atual}}': formatLocalDate(now),
      '{{hora_atual}}': now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      '{{data_hora_atual}}': `${formatLocalDate(now)} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      '{{mes_atual}}': now.toLocaleDateString('pt-BR', { month: 'long' }),
      '{{ano_atual}}': now.getFullYear().toString(),
    };

    matches.forEach(match => {
      const varKey = match[0];
      if (initialVals[varKey] === undefined) {
        initialVals[varKey] = autoValues[varKey] || '';
      }
    });

    if (currentEmpresa) {
      if (!initialVals['{{empresa_nome}}']) initialVals['{{empresa_nome}}'] = currentEmpresa.nome_fantasia || currentEmpresa.razao_social || '';
      if (!initialVals['{{empresa_cnpj}}']) initialVals['{{empresa_cnpj}}'] = currentEmpresa.cnpj || '';
      if (!initialVals['{{empresa_endereco}}']) initialVals['{{empresa_endereco}}'] = currentEmpresa.endereco || '';
      if (!initialVals['{{empresa_telefone}}']) initialVals['{{empresa_telefone}}'] = currentEmpresa.telefone || '';
      if (!initialVals['{{empresa_email}}']) initialVals['{{empresa_email}}'] = currentEmpresa.email || '';
    }

    setPlaceholderValues(initialVals);
  }, [documento, isOpen]);

  // Manipulador de troca de empresa
  const handleEmpresaChange = (empresaId: string) => {
    setSelectedEmpresaId(empresaId);
    const emp = empresas.find(e => e.id === empresaId) || null;
    setCurrentEmpresa(emp);

    if (emp) {
      setPlaceholderValues(prev => ({
        ...prev,
        '{{empresa_nome}}': emp.nome_fantasia || emp.razao_social || '',
        '{{empresa_cnpj}}': emp.cnpj || '',
        '{{empresa_endereco}}': emp.endereco || '',
        '{{empresa_telefone}}': emp.telefone || '',
        '{{empresa_email}}': emp.email || '',
      }));
    }

    if (onEmpresaSelect) {
      onEmpresaSelect(empresaId);
    }
  };

  // Manipulador de seleção de associado para preenchimento rápido
  const handleAssociadoChange = (associadoId: string) => {
    setSelectedAssociadoId(associadoId);
    const assoc = associados.find(a => a.id === associadoId);
    if (!assoc) return;

    const enderecoCompleto = [
      assoc.endereco_logradouro,
      assoc.endereco_numero ? `nº ${assoc.endereco_numero}` : '',
      assoc.endereco_bairro,
      assoc.endereco_cidade,
      assoc.endereco_cep ? `CEP: ${assoc.endereco_cep}` : ''
    ].filter(Boolean).join(', ');

    setPlaceholderValues(prev => {
      const nv = { ...prev };
      const setIfPresent = (k: string, v: string) => { if (k in nv || true) nv[k] = v; };
      setIfPresent('{{associado_nome}}', assoc.nome || '');
      setIfPresent('{{associado_cpf}}', assoc.cpf || '');
      setIfPresent('{{associado_rg}}', assoc.rg || '');
      setIfPresent('{{associado_data_nasc}}', assoc.data_nascimento ? formatLocalDate(assoc.data_nascimento) : '');
      setIfPresent('{{associado_sexo}}', assoc.sexo || '');
      setIfPresent('{{associado_nome_pai}}', assoc.nome_pai || '');
      setIfPresent('{{associado_nome_mae}}', assoc.nome_mae || '');
      setIfPresent('{{associado_telefone}}', assoc.telefone || '');
      setIfPresent('{{associado_email}}', assoc.email || '');
      setIfPresent('{{associado_endereco}}', enderecoCompleto);
      setIfPresent('{{associado_logradouro}}', assoc.endereco_logradouro || '');
      setIfPresent('{{associado_numero}}', assoc.endereco_numero || '');
      setIfPresent('{{associado_bairro}}', assoc.endereco_bairro || '');
      setIfPresent('{{associado_cidade}}', assoc.endereco_cidade || '');
      setIfPresent('{{associado_cep}}', assoc.endereco_cep || '');
      setIfPresent('{{associado_status}}', assoc.status || '');
      setIfPresent('{{plano_atual}}', assoc.plano_nome || '');
      setIfPresent('{{plano_nome}}', assoc.plano_nome || '');
      setIfPresent('{{numero_contrato}}', assoc.numero_contrato || (assoc as any).numero_contrato_fisico || assoc.id.substring(0, 8).toUpperCase());
      setIfPresent('{{valor_mensalidade}}', assoc.valor_plano ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(assoc.valor_plano) : '');
      setIfPresent('{{quantidade_dependentes}}', (assoc.dependentes?.length || 0).toString());
      setIfPresent('{{data_adesao}}', assoc.data_adesao ? formatLocalDate(assoc.data_adesao) : '');
      setIfPresent('{{associado_dependentes}}', (assoc.dependentes && assoc.dependentes.length > 0) 
        ? assoc.dependentes.map(d => `${d.nome} (${d.parentesco || 'Dependente'} - CPF: ${d.cpf || 'Não inf.'})`).join('<br/>') 
        : 'Nenhum dependente vinculado');
      return nv;
    });

    if (onAssociadoSelect) {
      onAssociadoSelect(associadoId);
    }
  };

  // Controles de zoom
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 40));
  const handleZoomReset = () => setZoom(100);

  // Fechamento com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lista de variáveis do documento filtradas para o painel
  const variaveisDoDocumento = useMemo(() => {
    if (!documento?.conteudo) return [];
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [...documento.conteudo.matchAll(regex)];
    const uniqueKeys = Array.from(new Set(matches.map(m => m[0])));
    
    if (!searchVar.trim()) return uniqueKeys;
    const q = searchVar.toLowerCase();
    return uniqueKeys.filter(k => k.toLowerCase().includes(q));
  }, [documento?.conteudo, searchVar]);

  // Conteúdo HTML final processado com substituição de variáveis
  const renderedHtml = useMemo(() => {
    if (!documento?.conteudo) {
      return '<p class="text-center italic text-slate-400 py-12">Documento sem conteúdo cadastrado.</p>';
    }

    let html = documento.conteudo;
    Object.entries(placeholderValues).forEach(([key, value]) => {
      const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const displayValue = value && value.trim() 
        ? `<span class="font-semibold text-slate-900">${value}</span>` 
        : `<span class="text-rose-500 font-bold bg-rose-50 px-1 py-0.5 rounded border border-rose-200 print:border-0 print:bg-transparent print:text-black">${key}</span>`;
      html = html.replace(regex, displayValue);
    });

    return html;
  }, [documento?.conteudo, placeholderValues]);

  // Quantidade de variáveis pendentes
  const totalVars = Object.keys(placeholderValues).length;
  const preenchidasVars = Object.values(placeholderValues).filter(v => v && v.trim().length > 0).length;

  // Impressão limpa isolada
  const handleImprimir = () => {
    const printArea = printAreaRef.current;
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('O navegador bloqueou a abertura da janela de impressão. Permita pop-ups.');
      return;
    }

    const pageOrientationCss = orientation === 'landscape' ? 'size: A4 landscape;' : 'size: A4 portrait;';

    const printHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${documento?.nome || 'Documento Oficial'}</title>
          <style>
            @page {
              ${pageOrientationCss}
              margin: 15mm 15mm 15mm 15mm;
            }
            *, *::before, *::after {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              background-color: #ffffff;
              color: #0f172a;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              font-size: 11pt;
              line-height: 1.6;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .doc-container {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
              background: #ffffff;
            }
            .doc-header {
              width: 100%;
              text-align: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 14px;
              margin-bottom: 22px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .doc-header img {
              max-height: 90px;
              width: 100%;
              object-fit: contain;
              display: block;
              margin: 0 auto;
            }
            .doc-content {
              width: 100%;
              page-break-inside: auto;
              break-inside: auto;
            }
            .doc-content p, 
            .doc-content div, 
            .doc-content h1, 
            .doc-content h2, 
            .doc-content h3, 
            .doc-content h4, 
            .doc-content table, 
            .doc-content ul, 
            .doc-content ol {
              page-break-inside: auto;
              break-inside: auto;
              margin-bottom: 12px;
            }
            .doc-footer {
              width: 100%;
              margin-top: 40px;
              padding-top: 18px;
              border-top: 1px solid #cbd5e1;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .doc-footer img {
              max-height: 75px;
              max-width: 280px;
              object-fit: contain;
              margin-bottom: 6px;
            }
            .signature-line {
              width: 280px;
              border-top: 1px solid #0f172a;
              margin: 6px auto;
            }
            h1, h2, h3, h4 {
              color: #0f172a;
              margin-top: 14px;
              margin-bottom: 8px;
            }
            strong {
              font-weight: bold;
              color: #000000;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 12px 0;
            }
            table th, table td {
              border: 1px solid #cbd5e1;
              padding: 6px 10px;
              font-size: 10pt;
            }
            table th {
              background-color: #f1f5f9;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="doc-container">
            ${printArea.innerHTML}
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

  // Exportação direta para PDF com jsPDF
  const handleExportPDF = async () => {
    const printArea = printAreaRef.current;
    if (!printArea) return;

    try {
      setIsExportingPDF(true);
      toast.loading('Gerando PDF do documento...', { id: 'export-doc-pdf' });

      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = orientation === 'landscape' ? 297 : 210;
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);

      await pdf.html(printArea, {
        callback: (doc) => {
          const cleanName = (documento?.nome || 'Documento')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_');
          const filename = `${cleanName}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
          doc.save(filename);
          toast.success('Documento em PDF baixado com sucesso!', { id: 'export-doc-pdf' });
          setIsExportingPDF(false);
        },
        x: margin,
        y: margin,
        width: contentWidth,
        windowWidth: orientation === 'landscape' ? 1122 : 794,
        autoPaging: 'text'
      });
    } catch (err) {
      console.error('Erro ao gerar PDF do documento:', err);
      // Fallback para impressão caso doc.html falhe
      toast.error('Não foi possível gerar o PDF direto. Abrindo diálogo de impressão...', { id: 'export-doc-pdf' });
      setIsExportingPDF(false);
      handleImprimir();
    }
  };

  if (!isOpen || !documento) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#1e232a] text-slate-100 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      
      {/* ─── TOOLBAR SUPERIOR DO VISUALIZADOR PROFISSIONAL ─── */}
      <header className="h-16 bg-[#13171f] border-b border-[#2d3544] px-4 sm:px-6 flex items-center justify-between shadow-xl shrink-0 z-30">
        
        {/* Lado Esquerdo: Identificação do Documento */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide truncate max-w-xs sm:max-w-md" title={documento.nome}>
                {customTitle || documento.nome}
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                {TIPO_LABELS[documento.tipo as TipoDocumento] || documento.tipo}
              </span>
              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border shrink-0 ${
                documento.ativo 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
              }`}>
                {documento.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block truncate">
              Visualizador Interativo • {preenchidasVars} de {totalVars} variáveis preenchidas
            </p>
          </div>
        </div>

        {/* Centro: Controles de Orientação, Zoom e Barra de Variáveis */}
        <div className="flex items-center gap-2 bg-[#1c222e] p-1.5 rounded-xl border border-[#2d3544]">
          
          {/* Alternância de Sidebar */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              showSidebar 
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' 
                : 'text-slate-400 hover:text-white hover:bg-[#2d3544]'
            }`}
            title={showSidebar ? "Ocultar painel de variáveis" : "Exibir painel de variáveis"}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Variáveis</span>
          </button>

          <div className="h-4 w-px bg-[#2d3544]" />

          {/* Botão de Orientação: Retrato vs Paisagem */}
          <div className="flex items-center bg-[#13171f] rounded-lg p-0.5 border border-[#2d3544]">
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                orientation === 'portrait' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Retrato (Vertical - A4 210x297mm)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Retrato</span>
            </button>
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                orientation === 'landscape' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Paisagem (Horizontal - A4 297x210mm)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Paisagem</span>
            </button>
          </div>

          <div className="h-4 w-px bg-[#2d3544]" />

          {/* Controles de Zoom */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544] transition-colors"
              title="Reduzir Zoom (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleZoomReset}
              className="px-2 py-1 text-xs font-bold text-slate-200 hover:bg-[#2d3544] rounded-lg transition-colors min-w-[48px] text-center"
              title="Resetar para 100%"
            >
              {zoom}%
            </button>
            
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544] transition-colors"
              title="Ampliar Zoom (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lado Direito: Ações (Salvar PDF, Imprimir, Fechar) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-emerald-600/20 active:scale-95"
            title="Baixar arquivo PDF diretamente"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Salvar PDF</span>
          </button>

          <button
            onClick={handleImprimir}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-blue-600/20 active:scale-95"
            title="Abrir impressão limpa nativa / Salvar como PDF"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          <div className="h-6 w-px bg-[#2d3544]" />

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#2d3544] transition-colors"
            title="Fechar Visualizador (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ─── CORPO PRINCIPAL: SIDEBAR DE VARIÁVEIS + ÁREA DE TRABALHO ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* SIDEBAR DE VARIÁVEIS & SELETORES */}
        {showSidebar && (
          <aside className="w-80 lg:w-96 bg-[#13171f] border-r border-[#2d3544] flex flex-col shrink-0 z-20 shadow-2xl animate-in slide-in-from-left duration-200">
            
            {/* Header da Sidebar */}
            <div className="p-4 border-b border-[#2d3544] bg-[#181d27]">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                  Preenchimento de Variáveis
                </h3>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {variaveisDoDocumento.length} variáveis
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Os dados preenchidos atualizam o documento em tempo real.
              </p>
            </div>

            {/* Conteúdo Rolável da Sidebar */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              
              {/* Seletor de Empresa Emissora */}
              {empresas.length > 0 && (
                <div className="bg-[#181d27] p-3.5 rounded-xl border border-[#2d3544] space-y-2">
                  <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Empresa Emissora
                  </label>
                  <select
                    value={selectedEmpresaId}
                    onChange={(e) => handleEmpresaChange(e.target.value)}
                    className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 outline-none transition-colors"
                  >
                    <option value="">Selecione a empresa...</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome_fantasia || emp.razao_social}
                      </option>
                    ))}
                  </select>
                  {currentEmpresa && (
                    <div className="text-[10px] text-slate-400 pt-1.5 flex flex-wrap items-center gap-2 border-t border-[#2d3544]">
                      <span className="flex items-center gap-1">
                        {currentEmpresa.logo_url ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <AlertCircle className="w-3 h-3 text-amber-400" />}
                        Logo: {currentEmpresa.logo_url ? 'Vinculado' : 'Sem logo'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {currentEmpresa.assinatura_url ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <AlertCircle className="w-3 h-3 text-amber-400" />}
                        Assinatura: {currentEmpresa.assinatura_url ? 'Vinculada' : 'Sem assinatura'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Seletor Rápido de Associado */}
              {associados.length > 0 && (
                <div className="bg-[#181d27] p-3.5 rounded-xl border border-[#2d3544] space-y-2">
                  <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Associado (Preenchimento Automático)
                  </label>
                  <select
                    value={selectedAssociadoId}
                    onChange={(e) => handleAssociadoChange(e.target.value)}
                    className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 outline-none transition-colors"
                  >
                    <option value="">Selecione um associado para preencher...</option>
                    {associados.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.nome} (CPF: {a.cpf || 'Sem CPF'})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400">
                    Preenche nome, CPF, endereço, plano, dependentes e mensalidade automaticamente.
                  </p>
                </div>
              )}

              {/* Busca de Variáveis */}
              {variaveisDoDocumento.length > 5 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchVar}
                    onChange={(e) => setSearchVar(e.target.value)}
                    placeholder="Filtrar variáveis..."
                    className="w-full pl-8 pr-7 py-1.5 bg-[#181d27] border border-[#2d3544] rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  {searchVar && (
                    <button onClick={() => setSearchVar('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Campos de Inserção de Variáveis */}
              <div className="space-y-3 pt-1">
                {variaveisDoDocumento.length > 0 ? (
                  variaveisDoDocumento.map(variable => {
                    const isFilled = Boolean(placeholderValues[variable] && placeholderValues[variable].trim());
                    const labelFriendly = variable.replace(/[{}]/g, '').replace(/_/g, ' ');

                    return (
                      <div key={variable} className="bg-[#181d27] p-3 rounded-xl border border-[#2d3544] space-y-1.5 hover:border-slate-600 transition-colors">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate" title={variable}>
                            {labelFriendly}
                          </label>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            isFilled 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {isFilled ? 'OK' : 'PENDENTE'}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-blue-400/80 truncate">{variable}</p>
                        
                        {variable === '{{associado_dependentes}}' || variable.includes('conteudo') || variable.includes('texto') ? (
                          <textarea
                            rows={3}
                            value={placeholderValues[variable] || ''}
                            onChange={(e) => setPlaceholderValues(prev => ({ ...prev, [variable]: e.target.value }))}
                            placeholder="Digite o valor..."
                            className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 outline-none transition-colors resize-none"
                          />
                        ) : (
                          <input
                            type="text"
                            value={placeholderValues[variable] || ''}
                            onChange={(e) => setPlaceholderValues(prev => ({ ...prev, [variable]: e.target.value }))}
                            placeholder="Digite o valor..."
                            className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 outline-none transition-colors"
                          />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 bg-[#181d27] rounded-xl border border-[#2d3544] p-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                    <p className="text-xs text-slate-300 font-semibold">Nenhuma variável dinâmica</p>
                    <p className="text-[11px] text-slate-400 mt-1">Este documento não possui tags de substituição identificadas.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé da Sidebar */}
            <div className="p-3 border-t border-[#2d3544] bg-[#181d27] flex items-center justify-between text-xs text-slate-400">
              <button
                onClick={() => {
                  const now = new Date();
                  setPlaceholderValues(prev => ({
                    ...prev,
                    '{{data_atual}}': formatLocalDate(now),
                    '{{hora_atual}}': now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    '{{data_hora_atual}}': `${formatLocalDate(now)} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
                    '{{ano_atual}}': now.getFullYear().toString(),
                  }));
                  toast.success('Datas e horas atualizadas!');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#13171f] hover:bg-[#232936] text-slate-300 rounded-lg text-xs transition-colors border border-[#2d3544]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar Datas
              </button>

              <button
                onClick={() => {
                  if (window.confirm('Deseja limpar todos os campos de variáveis preenchidos?')) {
                    const emptyVals: Record<string, string> = {};
                    Object.keys(placeholderValues).forEach(k => { emptyVals[k] = ''; });
                    setPlaceholderValues(emptyVals);
                    setSelectedAssociadoId('');
                    toast.success('Campos limpos!');
                  }
                }}
                className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
              >
                Limpar Campos
              </button>
            </div>
          </aside>
        )}

        {/* ─── ÁREA DE TRABALHO CENTRALIZADA (A4 SHEET PREVIEW) ─── */}
        <main className="flex-1 overflow-auto bg-[#0a0d14] flex justify-center p-4 sm:p-8 custom-scrollbar relative">
          
          <div 
            style={{ 
              transform: `scale(${zoom / 100})`, 
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
            className="shrink-0 my-4"
          >
            {/* Folha A4 Realista */}
            <div 
              ref={printAreaRef}
              id="print-area-documento"
              style={{
                width: orientation === 'landscape' ? '297mm' : '210mm',
                minHeight: orientation === 'landscape' ? '210mm' : '297mm',
                padding: '22mm 20mm',
                boxSizing: 'border-box'
              }}
              className="bg-white text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-sm flex flex-col justify-between"
            >
              <div>
                {/* Cabeçalho Oficial da Empresa */}
                {currentEmpresa?.logo_url ? (
                  <div className="doc-header w-full pb-4 mb-6 border-b-2 border-slate-900 flex items-center justify-center text-center">
                    <img 
                      src={currentEmpresa.logo_url} 
                      alt={currentEmpresa.nome_fantasia || "Logotipo"} 
                      style={{ maxHeight: '85px', maxWidth: '100%', objectFit: 'contain' }}
                      className="mx-auto block"
                    />
                  </div>
                ) : (
                  <div className="doc-header w-full pb-3 mb-6 border-b-2 border-slate-900 text-center">
                    <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900 m-0">
                      {currentEmpresa?.nome_fantasia || currentEmpresa?.razao_social || 'SISTEMA ERAS PAX'}
                    </h2>
                    {currentEmpresa?.cnpj && (
                      <p className="text-xs text-slate-600 font-medium mt-1">CNPJ: {currentEmpresa.cnpj}</p>
                    )}
                    {currentEmpresa?.endereco && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{currentEmpresa.endereco}</p>
                    )}
                  </div>
                )}

                {/* Conteúdo HTML do Documento com Variáveis Substituídas */}
                <div 
                  className="doc-content prose max-w-none text-slate-800"
                  style={{ 
                    fontSize: '11pt', 
                    lineHeight: '1.6', 
                    fontFamily: 'Arial, Helvetica, sans-serif' 
                  }}
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              </div>

              {/* Rodapé Oficial da Empresa com Assinatura */}
              <div className="doc-footer w-full mt-12 pt-6 border-t border-slate-300 flex flex-col items-center justify-center text-center">
                {currentEmpresa?.assinatura_url && (
                  <div className="mb-2 flex justify-center">
                    <img 
                      src={currentEmpresa.assinatura_url} 
                      alt="Assinatura da Empresa" 
                      style={{ maxHeight: '70px', maxWidth: '260px', objectFit: 'contain' }}
                    />
                  </div>
                )}
                
                <div className="signature-line w-72 border-t border-slate-900 my-1"></div>
                <p className="text-xs font-bold text-slate-900 uppercase">
                  {currentEmpresa?.nome_fantasia || currentEmpresa?.razao_social || 'Assinatura Autorizada'}
                </p>
                {currentEmpresa?.cnpj && (
                  <p className="text-[10px] text-slate-600">CNPJ: {currentEmpresa.cnpj}</p>
                )}
              </div>

            </div>
          </div>

        </main>
      </div>

    </div>
  );
};
