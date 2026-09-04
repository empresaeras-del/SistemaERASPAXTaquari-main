import { getEmpresaById, getEmpresas, Empresa } from '../services/empresasService';
import { getAssociados, Associado } from '../services/associadosService';
import React, { useState, useRef, useMemo } from 'react';
import JoditEditor from 'jodit-react';
import toast from 'react-hot-toast';
import { useDocumentosPadroes } from '../hooks/useDocumentosPadroes';
import { useAppContext } from '../context/AppContext';
import { DocumentoPadrao, TipoDocumento } from '../types/documentos';
import { canDelete } from '../utils/permissions';
import { formatLocalDate } from '../utils/dateUtils';
import { FileText, Plus, Search, Pencil, Power, PowerOff, X, Download, Eye, Maximize, Minimize, Trash2, Printer, ChevronDown, ChevronRight, Copy, Tag, Info, Layout, Table as TableIcon, Image as ImageIcon, Scissors, Layers, SlidersHorizontal, Sparkles, Grid3x3 } from 'lucide-react';
import { VisualizadorDocumentoPadraoModal } from '../components/documentos/VisualizadorDocumentoPadraoModal';
import { DocumentoMargensModal, MargensConfig } from '../components/documentos/DocumentoMargensModal';
import { DocumentoTableModal } from '../components/documentos/DocumentoTableModal';
import { DocumentoTableEditModal } from '../components/documentos/DocumentoTableEditModal';
import { DocumentoImageModal } from '../components/documentos/DocumentoImageModal';
import { DocumentoMiniaturasPreview } from '../components/documentos/DocumentoMiniaturasPreview';
import { resolverVariaveisAssociado, resolverVariaveisContrato, resolverVariaveisEmpresa } from '../utils/documentoVariaveis';
import { montarHtmlImpressaoDocumento } from '../utils/documentoPrintStyles';
import { MODULOS_VARIAVEIS as MODULOS, VariavelInfo, ModuloInfo } from '../config/documentoVariaveis.config';
import { BotaoSalvar } from '../components/common/BotaoSalvar';
import { AlertaAlteracoesPendentes } from '../components/common/AlertaAlteracoesPendentes';

/* ─── Sub-componente: botão de variável ─── */
interface VariavelButtonProps {
  v: VariavelInfo;
  cor: string;
  onInsert: (text: string) => void;
  onCopy: (text: string) => void;
  tooltip: string | null;
  setTooltip: (v: string | null) => void;
  onRemove?: (text: string) => void;
}
const VariavelButton: React.FC<VariavelButtonProps> = ({ v, cor, onInsert, onCopy, tooltip, setTooltip, onRemove }) => {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(v.variavel);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="group relative flex items-center gap-1 rounded-lg hover:bg-bg-surface/80 transition-colors">
      <button
        type="button"
        onClick={() => onInsert(v.variavel)}
        className="flex-1 flex flex-col items-start px-2 py-1.5 text-left min-w-0"
        onMouseEnter={() => setTooltip(v.variavel)}
        onMouseLeave={() => setTooltip(null)}
      >
        <span className="text-[10px] font-mono truncate w-full" style={{ color: cor }}>{v.variavel}</span>
        <span className="text-[10px] text-text-subtle truncate w-full">{v.label}</span>
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 text-text-subtle hover:text-text-base opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1"
        title="Copiar variável"
      >
        {copied ? <span className="text-[9px] text-emerald-400 font-bold">✓</span> : <Copy className="w-3 h-3" />}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(v.variavel); }}
          className="p-1 text-text-subtle hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1"
          title="Remover variável personalizada"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      {tooltip === v.variavel && (
        <div className="absolute left-full top-0 ml-2 z-50 w-52 bg-bg-surface border border-border-default rounded-lg p-2.5 shadow-xl pointer-events-none">
          <p className="text-[10px] font-mono mb-1" style={{ color: cor }}>{v.variavel}</p>
          <p className="text-[11px] font-semibold text-text-base mb-0.5">{v.label}</p>
          <p className="text-[10px] text-text-subtle leading-relaxed">{v.descricao}</p>
        </div>
      )}
    </div>
  );
};

/* ─── Régua Horizontal (topo do editor) ─── */
const RulerHorizontal: React.FC = () => {
  // A4 = 21 cm de largura; exibimos marcas a cada cm e meia-marca a cada 5mm
  const cms = Array.from({ length: 22 }, (_, i) => i);
  return (
    <div
      style={{
        height: 22,
        background: 'linear-gradient(to bottom, #1c2232, #222a3a)',
        borderBottom: '1px solid #2d3748',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        paddingLeft: 22,
      }}
    >
      <div style={{ position: 'relative', height: '100%' }}>
        {cms.map(c => (
          <React.Fragment key={c}>
            {/* Marca maior (cm) */}
            <div style={{
              position: 'absolute',
              left: `${(c / 21) * 100}%`,
              bottom: 0,
              width: 1,
              height: 11,
              background: c % 5 === 0 ? '#64748b' : '#374151',
            }} />
            {/* Label cm */}
            {c > 0 && c % 2 === 0 && (
              <span style={{
                position: 'absolute',
                left: `calc(${(c / 21) * 100}% + 2px)`,
                bottom: 10,
                fontSize: 7,
                color: '#64748b',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}>{c}</span>
            )}
            {/* Meia marca (5mm) */}
            <div style={{
              position: 'absolute',
              left: `calc(${(c / 21) * 100}% + ${(0.5 / 21) * 100}%)`,
              bottom: 0,
              width: 1,
              height: 6,
              background: '#2d3748',
            }} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/* ─── Régua Vertical (lateral do editor) ─── */
const RulerVertical: React.FC = () => {
  // A4 = ~29.7 cm de altura; exibimos marcas a cada cm
  const cms = Array.from({ length: 30 }, (_, i) => i);
  return (
    <div
      style={{
        width: 22,
        background: 'linear-gradient(to right, #1c2232, #222a3a)',
        borderRight: '1px solid #2d3748',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {cms.map(c => (
        <React.Fragment key={c}>
          <div style={{
            position: 'absolute',
            top: `${(c / 29.7) * 100}%`,
            right: 0,
            height: 1,
            width: c % 5 === 0 ? 11 : 5,
            background: c % 5 === 0 ? '#64748b' : '#374151',
          }} />
          {c > 0 && c % 2 === 0 && (
            <span style={{
              position: 'absolute',
              top: `calc(${(c / 29.7) * 100}% + 2px)`,
              right: 11,
              fontSize: 7,
              color: '#64748b',
              lineHeight: 1,
              writingMode: 'vertical-lr',
              transform: 'rotate(180deg)',
              whiteSpace: 'nowrap',
            }}>{c}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const TIPO_LABELS: Record<TipoDocumento, string> = {
  'contrato_adesao': 'Contrato de Adesão',
  'termo_rescisao': 'Termo de Rescisão',
  'termo_credenciamento': 'Termo de Credenciamento',
  'aditivo': 'Aditivo/Atualização',
  'outro': 'Outro'
};

export const DocumentosPadroesPage = () => {
  const { documentos, loading, criar, editar, excluir, uploadArquivo } = useDocumentosPadroes();
  const { state } = useAppContext();
  const { isOnline, empresaSelecionada } = state;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Partial<DocumentoPadrao> | null>(null);
  const [initialDocJson, setInitialDocJson] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const isDirty = React.useMemo(() => {
    if (!isFormOpen || !initialDocJson) return false;
    return JSON.stringify(editingDoc) !== initialDocJson;
  }, [isFormOpen, editingDoc, initialDocJson]);

  const [previewDoc, setPreviewDoc] = useState<DocumentoPadrao | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Novos estados para Margens, Tabelas, Imagens e Miniaturas
  const [margens, setMargens] = useState<MargensConfig>({ top: 20, bottom: 20, left: 25, right: 25 });
  const [isMargensModalOpen, setIsMargensModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isTableEditModalOpen, setIsTableEditModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'miniaturas' | 'preview_split'>('miniaturas');

  const [customVariables, setCustomVariables] = useState<string[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['associado']));
  const [varSearch, setVarSearch] = useState('');
  const [tooltipVar, setTooltipVar] = useState<string | null>(null);

  const [newVariable, setNewVariable] = useState('');
  const [docToPrint, setDocToPrint] = useState<DocumentoPadrao | null>(null);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [currentEmpresa, setCurrentEmpresa] = useState<Empresa | null>(null);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<any>(null);

  const editorConfig = useMemo(() => ({
    readonly: false,
    language: 'pt_br',
    height: isFullscreen ? 560 : 440,
    toolbarButtonSize: 'middle' as const,
    toolbarAdaptive: false,
    buttons: [
      'bold', 'italic', 'underline', 'strikethrough', '|',
      'superscript', 'subscript', '|',
      'font', 'fontsize', 'brush', 'paragraph', '|',
      'ul', 'ol', '|',
      'outdent', 'indent', '|',
      'align', '|',
      'image', 'table', 'link', 'hr', '|',
      'undo', 'redo', '|',
      'eraser', 'copyformat', 'source',
    ],
    uploader: { insertImageAsBase64URI: true },
    showCharsCounter: true,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    placeholder: 'Comece a digitar o conteúdo do documento aqui...',
    style: {
      background: '#ffffff',
      color: '#1a1a1a',
      padding: `${margens.top}mm ${margens.right}mm ${margens.bottom}mm ${margens.left}mm`,
      width: '210mm',
      minHeight: '297mm',
      margin: '0 auto',
      boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '11pt',
      lineHeight: '1.6',
    },
    iframe: true,
    iframeStyle: `
      html {
        background: #3a404e;
        padding: 20px 0 40px;
        min-height: 100%;
      }
      body {
        width: 210mm !important;
        min-height: 297mm !important;
        padding: ${margens.top}mm ${margens.right}mm ${margens.bottom}mm ${margens.left}mm !important;
        margin: 0 auto !important;
        background: #ffffff !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;
        box-sizing: border-box !important;
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 11pt !important;
        line-height: 1.6 !important;
        color: #1a1a1a !important;
      }
      table {
        border-collapse: collapse !important;
        width: 100% !important;
      }
      table td, table th {
        border: 1px solid #cbd5e1;
        padding: 6px 10px;
        min-width: 30px;
        vertical-align: top;
      }
      table.tabela-sem-grade, 
      table.tabela-sem-grade td, 
      table.tabela-sem-grade th, 
      table[style*="border: none"],
      table[style*="border: 0"] {
        border: none !important;
      }
      table.tabela-sem-grade td, 
      table.tabela-sem-grade th {
        border: none !important;
      }
      table.tabela-zebrada tr:nth-child(even) td {
        background: #f8fafc !important;
      }
      table th {
        background: #f1f5f9;
        font-weight: bold;
        text-align: left;
      }
      .jodit-selected-cell {
        outline: 2px solid #3B82F6 !important;
      }
      .page-break {
        page-break-after: always;
        break-after: page;
        height: 1px;
        border-bottom: 2px dashed #94a3b8;
        margin: 24px 0;
        text-align: center;
      }
      h1, h2, h3, h4 { color: #0f172a !important; margin-top: 0.8em; }
      p { margin-bottom: 0.6em; }
    `,
  }), [isFullscreen, margens]);


  React.useEffect(() => {
    const loadAuxData = async () => {
      try {
        const [assocData, empData] = await Promise.all([
          getAssociados(isOnline, state.empresaSelecionada || 'empresa_padrao'),
          getEmpresas(isOnline)
        ]);
        const activeAssocs = assocData.filter(a => a.status === 'ativo');
        const activeEmps = empData.filter(e => e.status === 'ativo');
        setAssociados(activeAssocs);
        setEmpresas(activeEmps);

        const targetEmpId = state.empresaSelecionada || (docToPrint?.empresa_id) || '';
        let targetEmp: Empresa | null = activeEmps.find(e => e.id === targetEmpId) || activeEmps[0] || null;
        if (!targetEmp && targetEmpId) {
          targetEmp = await getEmpresaById(targetEmpId, isOnline);
        }

        if (targetEmp) {
          setCurrentEmpresa(targetEmp);
          setSelectedEmpresaId(targetEmp.id);
          setPlaceholderValues(prev => ({
            ...prev,
            '{{empresa_nome}}': prev['{{empresa_nome}}'] || targetEmp.nome_fantasia || targetEmp.razao_social || '',
            '{{empresa_cnpj}}': prev['{{empresa_cnpj}}'] || targetEmp.cnpj || '',
            '{{empresa_endereco}}': prev['{{empresa_endereco}}'] || targetEmp.endereco || '',
            '{{empresa_telefone}}': prev['{{empresa_telefone}}'] || targetEmp.telefone || '',
            '{{empresa_email}}': prev['{{empresa_email}}'] || targetEmp.email || '',
          }));
        }
      } catch (err) {
        console.error("Erro ao carregar dados auxiliares", err);
      }
    };
    if (docToPrint) {
      loadAuxData();
    }
  }, [docToPrint, isOnline, state.empresaSelecionada]);

  React.useEffect(() => {
    if (docToPrint?.conteudo) {
      const regex = /\{\{([^}]+)\}\}/g;
      const matches = [...docToPrint.conteudo.matchAll(regex)];
      const initialValues: Record<string, string> = {};
      const now = new Date();
      matches.forEach(match => {
        if (match[0] === '{{data_atual}}') initialValues[match[0]] = formatLocalDate(now);
        else if (match[0] === '{{hora_atual}}') initialValues[match[0]] = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        else if (match[0] === '{{data_hora_atual}}') initialValues[match[0]] = `${formatLocalDate(now)} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        else if (match[0] === '{{mes_atual}}') initialValues[match[0]] = now.toLocaleDateString('pt-BR', { month: 'long' });
        else if (match[0] === '{{ano_atual}}') initialValues[match[0]] = now.getFullYear().toString();
        else initialValues[match[0]] = '';
      });
      setPlaceholderValues(initialValues);
    }
  }, [docToPrint]);

  const allVarsFiltered = useMemo(() => {
    const q = varSearch.toLowerCase();
    if (!q) return [];
    const results: { modulo: ModuloInfo; v: VariavelInfo }[] = [];
    MODULOS.forEach(mod => {
      mod.variaveis.forEach(v => {
        if (v.variavel.includes(q) || v.label.toLowerCase().includes(q) || v.descricao.toLowerCase().includes(q)) {
          results.push({ modulo: mod, v });
        }
      });
    });
    customVariables.filter(cv => cv.includes(q)).forEach(cv => {
      results.push({ modulo: { id: 'personalizado', label: 'Personalizada', icon: '✏️', cor: '#94A3B8', variaveis: [] }, v: { variavel: cv, label: cv, descricao: 'Variável personalizada' } });
    });
    return results;
  }, [varSearch, customVariables]);


  const filtered = documentos.filter(doc => {
    const matchesSearch = ((doc.nome || "").toLowerCase()).includes(searchTerm.toLowerCase()) || 
                          (doc.descricao && doc.descricao.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTipo = tipoFilter ? doc.tipo === tipoFilter : true;
    return matchesSearch && matchesTipo;
  });

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleAssociadoChange = (associadoId: string) => {
    const associado = associados.find(a => a.id === associadoId);
    if (!associado) return;
    const resolvidas = { ...resolverVariaveisAssociado(associado), ...resolverVariaveisContrato(associado) };
    setPlaceholderValues(prev => {
      const nv = { ...prev };
      Object.entries(resolvidas).forEach(([k, v]) => { if (k in nv) nv[k] = v; });
      return nv;
    });
  };

  const handleEmpresaChange = (empresaId: string) => {
    setSelectedEmpresaId(empresaId);
    const empresa = empresas.find(e => e.id === empresaId);
    if (!empresa) return;
    setCurrentEmpresa(empresa);

    const resolvidas = resolverVariaveisEmpresa(empresa);
    setPlaceholderValues(prev => ({ ...prev, ...resolvidas }));
  };

  const handlePrint = () => {
    const printArea = document.getElementById('print-area');
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(
        montarHtmlImpressaoDocumento(docToPrint?.nome || 'Documento', printArea.innerHTML, 'portrait')
      );
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 350);
    } else {
      window.print();
    }
  };

  const handleOpenForm = (doc?: DocumentoPadrao) => {
    const initialObj: Partial<DocumentoPadrao> = doc ? { ...doc } : { 
      ativo: true, 
      tipo: 'contrato_adesao' as TipoDocumento,
      conteudo: '',
      empresa_id: empresaSelecionada || ''
    };
    setEditingDoc(initialObj);
    setInitialDocJson(JSON.stringify(initialObj));
    setIsSaving(false);
    setIsSaved(false);
    setIsFormOpen(true);
    setVarSearch('');
    setExpandedModules(new Set(['associado']));
    setCustomVariables((initialObj.variaveis_disponiveis || []).map(v => v.chave));
  };

  const handleDelete = async (doc: DocumentoPadrao) => {
    if (!canDelete(state.user, state.isOnline)) {
      alert(!state.isOnline ? 'Exclusão bloqueada no Modo de Visualização (Offline).' : 'Permissão negada. Somente usuários Administradores podem excluir registros no sistema.');
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir o modelo "${doc.nome}"?`)) {
      try {
        await excluir(doc.id);
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'Erro ao excluir documento');
      }
    }
  };

  const handleToggleStatus = async (doc: DocumentoPadrao) => {
    if (!state.isOnline) {
      alert('Alteração de status bloqueada no Modo de Visualização (Offline).');
      return;
    }
    try {
      await editar(doc.id, { ativo: !doc.ativo });
    } catch (err) {
      console.error(err);
      alert('Erro ao alterar status');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.isOnline) {
      alert('Operação bloqueada no Modo de Visualização (Offline).');
      return;
    }
    
    setIsSaving(true);
    try {
      if (editingDoc?.id) {
        await editar(editingDoc.id, editingDoc);
      } else {
        await criar(editingDoc as any);
      }
      setIsSaved(true);
      setTimeout(() => {
        setIsFormOpen(false);
        setEditingDoc(null);
      }, 400);
    } catch (err: any) {
      console.error('Erro ao salvar documento:', err);
      alert(err?.message || 'Erro ao salvar documento');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddVariable = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newVariable.trim()) {
      const label = newVariable.trim();
      let formatted = label;
      if (!formatted.startsWith('{{')) formatted = '{{' + formatted;
      if (!formatted.endsWith('}}')) formatted = formatted + '}}';
      formatted = formatted.replace(/\s+/g, '_').toLowerCase();

      if (!customVariables.includes(formatted)) {
        setCustomVariables([...customVariables, formatted]);
        setEditingDoc(prev => prev ? {
          ...prev,
          variaveis_disponiveis: [...(prev.variaveis_disponiveis || []), { chave: formatted, label, descricao: 'Variável personalizada' }],
        } : prev);
      }
      setNewVariable('');
    }
  };

  const handleRemoveVariable = (chave: string) => {
    setCustomVariables(prev => prev.filter(cv => cv !== chave));
    setEditingDoc(prev => prev ? {
      ...prev,
      variaveis_disponiveis: (prev.variaveis_disponiveis || []).filter(v => v.chave !== chave),
    } : prev);
  };

  const insertAtCursor = (text: string) => {
    if (editorRef.current) {
      editorRef.current.selection.insertHTML(text);
      setEditingDoc(prev => ({
        ...prev,
        conteudo: editorRef.current.value
      }));
    } else {
      setEditingDoc(prev => ({
        ...prev,
        conteudo: (prev?.conteudo || '') + text
      }));
    }
  };

  const handleInsertPageBreak = () => {
    const pageBreakHtml = `
      <div class="page-break" style="page-break-after: always; height: 1px; border-bottom: 2px dashed #94a3b8; margin: 24px 0; text-align: center;">
        <span style="background: #e2e8f0; color: #475569; font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
          --- Quebra de Página (Nova Folha A4) ---
        </span>
      </div>
      <p><br/></p>
    `;
    insertAtCursor(pageBreakHtml);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6]"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 max-w-7xl mx-auto pb-12 h-full flex flex-col ${docToPrint ? "no-print" : ""}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-base flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#3B82F6]" />
            Documentos Padrões
          </h2>
          <p className="text-text-subtle text-sm mt-1">Gerencie os modelos de contratos e termos</p>
        </div>
        <button 
          disabled={!state.isOnline}
          onClick={() => handleOpenForm()}
          title={!state.isOnline ? "Inclusão bloqueada no Modo Offline" : "Novo Modelo"}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          Novo Modelo
        </button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className={`bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col ${previewDoc ? "hidden lg:flex" : "flex"}`}>
          <div className="p-4 border-b border-border-default flex flex-col sm:flex-row gap-4 justify-between bg-bg-surface/50">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-subtle" />
              <input
                type="text"
                placeholder="Buscar documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50"
              />
            </div>
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50"
            >
              <option value="">Todos os Tipos</option>
              {Object.entries(TIPO_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto flex-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-text-subtle">
                <FileText className="w-12 h-12 mb-4 opacity-20" />
                <p>Nenhum documento encontrado.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-text-muted">
                <thead className="bg-bg-surface/50 text-text-subtle font-medium border-b border-border-default">
                  <tr>
                    <th className="px-6 py-4">Nome</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#475569]">
                  {filtered.map(doc => (
                    <tr 
                      key={doc.id} 
                      className="hover:bg-bg-surface/30 transition-colors cursor-pointer"
                      onClick={() => setPreviewDoc(doc)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-text-base">{doc.nome}</div>
                        {doc.descricao && <div className="text-xs text-text-subtle mt-1 truncate max-w-xs">{doc.descricao}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-bg-surface text-text-muted border border-border-default">
                          {TIPO_LABELS[doc.tipo as TipoDocumento] || doc.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${doc.ativo ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-text-subtle border-slate-500/20"}`}>
                          {doc.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDocToPrint(doc); }}
                            className="p-2 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-lg transition-colors"
                            title="Visualizar Impressão"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenForm(doc); }}
                            
                            className="p-2 text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleStatus(doc); }}
                            
                            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                              doc.ativo 
                                ? "text-text-subtle hover:text-red-400 hover:bg-red-400/10" 
                                : "text-text-subtle hover:text-emerald-400 hover:bg-emerald-400/10"
                            }`}
                            title={doc.ativo ? "Desativar" : "Ativar"}
                          >
                            {doc.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                            
                            className="p-2 text-text-subtle hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        
        {previewDoc && (
          <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0 bg-bg-subtle border border-border-default rounded-2xl flex flex-col shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border-default flex items-center justify-between bg-bg-surface/50">
              <h3 className="font-semibold text-text-base">Detalhes do Modelo</h3>
              <button onClick={() => setPreviewDoc(null)} className="text-text-subtle hover:text-text-base">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div>
                <h4 className="text-lg font-medium text-text-base mb-1">{previewDoc.nome}</h4>
                <p className="text-sm text-text-subtle">{TIPO_LABELS[previewDoc.tipo as TipoDocumento]}</p>
              </div>
              
              <div className="bg-bg-surface p-3 rounded-xl border border-border-default">
                <p className="text-xs text-text-subtle mb-1">Status</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${previewDoc.ativo ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-text-subtle border-slate-500/20"}`}>{previewDoc.ativo ? "Ativo" : "Inativo"}</span>
              </div>

              {previewDoc.descricao && (
                <div>
                  <h5 className="text-sm font-medium text-text-muted mb-2 border-b border-border-default pb-2">Descrição</h5>
                  <p className="text-sm text-text-subtle">{previewDoc.descricao}</p>
                </div>
              )}

              {previewDoc.arquivo_url && (
                <div>
                  <h5 className="text-sm font-medium text-text-muted mb-2 border-b border-border-default pb-2">Arquivo Anexo</h5>
                  <a href={previewDoc.arquivo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 bg-bg-surface border border-border-default rounded-xl text-sm text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-colors">
                    <Download className="w-4 h-4" />
                    Baixar Modelo
                  </a>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border-default bg-bg-surface/50 flex gap-2">
              <button 
                onClick={() => setDocToPrint(previewDoc)} 
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20"
              >
                <Eye className="w-4 h-4" />
                Visualizar
              </button>
              <button 
                onClick={() => { handleOpenForm(previewDoc); setPreviewDoc(null); }} 
                className="flex-1 py-2 bg-bg-hover hover:bg-[#64748B] text-text-base rounded-lg text-sm font-medium transition-colors border border-[#64748B] flex items-center justify-center gap-1.5"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Visualizador Profissional Interativo de Documentos Padrões */}
      <VisualizadorDocumentoPadraoModal
        isOpen={Boolean(docToPrint)}
        onClose={() => setDocToPrint(null)}
        documento={docToPrint}
        empresaData={currentEmpresa}
        empresas={empresas}
        associados={associados}
        initialPlaceholderValues={placeholderValues}
        onEmpresaSelect={handleEmpresaChange}
        onAssociadoSelect={handleAssociadoChange}
        onSaveAssinaturaConfig={async (config) => {
          if (!docToPrint) return;
          try {
            await editar(docToPrint.id, { assinatura_config: config });
            toast.success(config ? 'Posição da assinatura salva!' : 'Posicionamento personalizado removido.');
          } catch (err) {
            console.error('Erro ao salvar posição da assinatura:', err);
            toast.error('Erro ao salvar a posição da assinatura.');
          }
        }}
      />
{/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/90 backdrop-blur-sm p-4">
          <div className={`bg-bg-subtle ${isFullscreen ? 'rounded-none w-full h-full max-w-none border-0' : 'rounded-3xl shadow-2xl w-full max-w-[95vw] h-[90vh] border border-border-default'} flex flex-col overflow-hidden transition-all duration-300`}>
            {/* ── Cabeçalho do modal ── */}
            <div className="relative p-5 sm:p-6 border-b border-border-default flex items-center justify-between shrink-0 bg-gradient-to-r from-bg-subtle via-bg-surface to-bg-subtle">
              {/* Barra de acento superior */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#3B82F6] via-[#60A5FA] to-transparent" />
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-[#3B82F6]/10 rounded-xl border border-[#3B82F6]/20 shrink-0">
                  <FileText className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-text-base leading-tight">
                    {editingDoc?.id ? 'Editar Modelo de Documento' : 'Novo Modelo de Documento'}
                  </h3>
                  <p className="text-[11px] text-text-subtle mt-0.5 truncate">
                    {editingDoc?.id ? 'Atualize as informações e o conteúdo do modelo' : 'Configure e crie um novo modelo reutilizável'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'preview_split' ? 'miniaturas' : 'preview_split')}
                  className={`hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
                    viewMode === 'preview_split'
                      ? 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30'
                      : 'bg-bg-base text-text-subtle border-border-default hover:text-[#3B82F6] hover:border-[#3B82F6]/30'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  {viewMode === 'preview_split' ? 'Ocultar Preview A4' : 'Preview A4'}
                </button>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="hidden md:flex items-center justify-center p-2 text-text-subtle hover:text-text-base bg-bg-base rounded-lg border border-border-default transition-colors"
                  title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="flex items-center justify-center p-2 text-text-subtle hover:text-red-400 bg-bg-base rounded-lg border border-border-default transition-colors"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* ─── Variables Panel ─── */}
              <div className="w-full lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-border-default bg-bg-base flex flex-col overflow-hidden">
                <div className="p-3 border-b border-border-default bg-bg-surface/50 shrink-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Tag className="w-4 h-4 text-[#3B82F6]" />
                    <span className="text-sm font-semibold text-text-base">Variáveis disponíveis</span>
                  </div>
                  <p className="text-[11px] text-text-subtle mb-2">Clique para inserir no documento</p>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-subtle" />
                    <input
                      type="text"
                      placeholder="Buscar variável..."
                      value={varSearch}
                      onChange={e => setVarSearch(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 bg-bg-subtle border border-border-default rounded-lg text-xs text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                    {varSearch && (
                      <button onClick={() => setVarSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-base">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {varSearch && allVarsFiltered.length > 0 && (
                    <div className="p-2 space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wider text-text-subtle px-2 py-1 font-semibold">{allVarsFiltered.length} resultado(s)</p>
                      {allVarsFiltered.map(({ modulo, v }) => (
                        <VariavelButton key={v.variavel} v={v} cor={modulo.cor} onInsert={insertAtCursor} onCopy={copyToClipboard} tooltip={tooltipVar} setTooltip={setTooltipVar} />
                      ))}
                    </div>
                  )}
                  {varSearch && allVarsFiltered.length === 0 && (
                    <div className="p-4 text-center text-xs text-text-subtle">Nenhuma variável encontrada</div>
                  )}
                  {!varSearch && (
                    <div>
                      {MODULOS.map(mod => (
                        <div key={mod.id} className="border-b border-border-default/50 last:border-b-0">
                          <button
                            type="button"
                            onClick={() => toggleModule(mod.id)}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-bg-surface/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{mod.icon}</span>
                              <span className="text-xs font-semibold text-text-base">{mod.label}</span>
                              <span className="text-[10px] text-text-subtle bg-bg-hover px-1.5 py-0.5 rounded-full">{mod.variaveis.length}</span>
                            </div>
                            {expandedModules.has(mod.id) ? <ChevronDown className="w-3.5 h-3.5 text-text-subtle" /> : <ChevronRight className="w-3.5 h-3.5 text-text-subtle" />}
                          </button>
                          {expandedModules.has(mod.id) && (
                            <div className="px-2 pb-2 space-y-0.5 bg-bg-subtle/30">
                              {mod.variaveis.map(v => (
                                <VariavelButton key={v.variavel} v={v} cor={mod.cor} onInsert={insertAtCursor} onCopy={copyToClipboard} tooltip={tooltipVar} setTooltip={setTooltipVar} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="border-t border-border-default">
                        <button
                          type="button"
                          onClick={() => toggleModule('personalizado')}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-bg-surface/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">✏️</span>
                            <span className="text-xs font-semibold text-text-base">Personalizadas</span>
                            <span className="text-[10px] text-text-subtle bg-bg-hover px-1.5 py-0.5 rounded-full">{customVariables.length}</span>
                          </div>
                          {expandedModules.has('personalizado') ? <ChevronDown className="w-3.5 h-3.5 text-text-subtle" /> : <ChevronRight className="w-3.5 h-3.5 text-text-subtle" />}
                        </button>
                        {expandedModules.has('personalizado') && (
                          <div className="px-2 pb-2 bg-bg-subtle/30">
                            <div className="flex gap-1 mb-2 px-1">
                              <input
                                type="text"
                                value={newVariable}
                                onChange={e => setNewVariable(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddVariable(); } }}
                                placeholder="Nome da variável..."
                                className="flex-1 px-2 py-1 bg-bg-base border border-border-default rounded-lg text-[11px] text-text-base focus:outline-none focus:border-[#3B82F6]"
                              />
                              <button type="button" onClick={() => handleAddVariable()} className="p-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-lg transition-colors" title="Adicionar">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {customVariables.length === 0 && (
                              <p className="text-[10px] text-text-subtle italic px-2">Use o campo acima para adicionar variáveis personalizadas.</p>
                            )}
                            <div className="space-y-0.5">
                              {customVariables.map(cv => (
                                <VariavelButton key={cv} v={{ variavel: cv, label: cv.replace(/[{}]/g, '').replace(/_/g, ' '), descricao: 'Variável personalizada' }} cor="#94A3B8" onInsert={insertAtCursor} onCopy={copyToClipboard} tooltip={tooltipVar} setTooltip={setTooltipVar} onRemove={handleRemoveVariable} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <form id="docForm" onSubmit={handleSubmit}>
                  {isDirty && (
                    <div className="p-4 border-b border-border-default bg-bg-surface/30">
                      <AlertaAlteracoesPendentes
                        visivel={isDirty}
                        formId="docForm"
                        salvando={isSaving}
                        posicao="compact"
                        mensagem="Existem alterações pendentes neste modelo de documento. Salve para registrar no banco de dados."
                      />
                    </div>
                  )}

                  {/* ── Seção: Dados básicos ── */}
                  <div className="p-5 sm:p-6 space-y-4 border-b border-border-default">

                    {/* Nome + Tipo */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="block text-[10px] font-bold text-text-subtle uppercase tracking-widest">Nome do Modelo *</label>
                        <input
                          required
                          type="text"
                          value={editingDoc?.nome || ''}
                          onChange={e => setEditingDoc({ ...editingDoc, nome: e.target.value })}
                          className="w-full px-4 py-2.5 bg-bg-base border border-border-default rounded-xl text-sm text-text-base placeholder-text-subtle/40 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]/50 transition-all"
                          placeholder="Ex: Contrato Padrão Mensal"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-text-subtle uppercase tracking-widest">Tipo *</label>
                        <select
                          required
                          value={editingDoc?.tipo || ''}
                          onChange={e => setEditingDoc({ ...editingDoc, tipo: e.target.value as TipoDocumento })}
                          className="w-full px-4 py-2.5 bg-bg-base border border-border-default rounded-xl text-sm text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]/50 transition-all"
                        >
                          {Object.entries(TIPO_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Descrição */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-text-subtle uppercase tracking-widest">Descrição</label>
                      <textarea
                        rows={2}
                        value={editingDoc?.descricao || ''}
                        onChange={e => setEditingDoc({ ...editingDoc, descricao: e.target.value })}
                        className="w-full px-4 py-2.5 bg-bg-base border border-border-default rounded-xl text-sm text-text-base placeholder-text-subtle/40 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]/50 transition-all resize-none"
                        placeholder="Breve descrição do uso deste modelo..."
                      />
                    </div>

                    {/* Toggle status */}
                    <label
                      htmlFor="docAtivo"
                      className="flex items-center gap-3 p-3 bg-bg-base rounded-xl border border-border-default cursor-pointer hover:border-[#3B82F6]/30 transition-colors group"
                    >
                      <div
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          editingDoc?.ativo ? 'bg-emerald-500' : 'bg-bg-hover border border-border-default'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          editingDoc?.ativo ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                        <input
                          type="checkbox"
                          id="docAtivo"
                          className="sr-only"
                          checked={!!editingDoc?.ativo}
                          onChange={e => setEditingDoc({ ...editingDoc, ativo: e.target.checked })}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-text-base">
                          {editingDoc?.ativo ? 'Modelo Ativo' : 'Modelo Inativo'}
                        </p>
                        <p className="text-[11px] text-text-subtle">
                          Modelos ativos ficam disponíveis para emissão no sistema
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                        editingDoc?.ativo
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-slate-500/15 text-text-subtle'
                      }`}>
                        {editingDoc?.ativo ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </label>
                  </div>

                  {/* ── Seção: Conteúdo ── */}
                  <div className="p-5 sm:p-6 space-y-4">

                    {/* Cabeçalho da seção */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-default">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20">
                          <FileText className="w-3.5 h-3.5 text-[#3B82F6]" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#3B82F6] uppercase tracking-widest">Conteúdo do Documento</h4>
                          <p className="text-[11px] text-text-subtle mt-0.5">
                            Use as ferramentas profissionais de margens, tabelas, imagens e variáveis
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-text-subtle bg-bg-base border border-border-default rounded-lg px-2.5 py-1">
                        <Info className="w-3.5 h-3.5 text-[#3B82F6]" />
                        <span>Formato A4 · 210mm × 297mm</span>
                      </div>
                    </div>

                    {/* ── Barra de Ferramentas Avançadas do Editor ── */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#13171f] border border-[#2d3748] rounded-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Botão Margens */}
                        <button
                          type="button"
                          onClick={() => setIsMargensModalOpen(true)}
                          className="px-3 py-1.5 bg-[#1e2533] hover:bg-blue-500/20 text-slate-200 hover:text-blue-300 border border-[#2d3544] hover:border-blue-500/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                          title="Ajustar margens laterais, superior e inferior"
                        >
                          <Layout className="w-3.5 h-3.5 text-blue-400" />
                          <span>Margens:</span>
                          <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                            {margens.left}mm × {margens.top}mm
                          </span>
                        </button>

                        {/* Botão Tabelas Profissionais */}
                        <button
                          type="button"
                          onClick={() => setIsTableModalOpen(true)}
                          className="px-3 py-1.5 bg-[#1e2533] hover:bg-indigo-500/20 text-slate-200 hover:text-indigo-300 border border-[#2d3544] hover:border-indigo-500/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                          title="Inserir tabelas com controle de grades visíveis/ocultas"
                        >
                          <TableIcon className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Tabelas & Grades</span>
                        </button>

                        {/* Botão Editor de Tabelas Office */}
                        <button
                          type="button"
                          onClick={() => setIsTableEditModalOpen(true)}
                          className="px-3 py-1.5 bg-[#1e2533] hover:bg-fuchsia-500/20 text-slate-200 hover:text-fuchsia-300 border border-[#2d3544] hover:border-fuchsia-500/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                          title="Mesclar, dividir, redimensionar e formatar células de tabelas já existentes no documento"
                        >
                          <Grid3x3 className="w-3.5 h-3.5 text-fuchsia-400" />
                          <span>Editar Tabela</span>
                        </button>

                        {/* Botão Inserir Imagem */}
                        <button
                          type="button"
                          onClick={() => setIsImageModalOpen(true)}
                          className="px-3 py-1.5 bg-[#1e2533] hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-[#2d3544] hover:border-emerald-500/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                          title="Inserir imagens, logomarcas ou carimbos"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Inserir Imagem</span>
                        </button>

                        {/* Botão Quebra de Página */}
                        <button
                          type="button"
                          onClick={handleInsertPageBreak}
                          className="px-3 py-1.5 bg-[#1e2533] hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-[#2d3544] hover:border-amber-500/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                          title="Inserir quebra de página A4"
                        >
                          <Scissors className="w-3.5 h-3.5 text-amber-400" />
                          <span>Quebra de Página</span>
                        </button>
                      </div>

                      {/* Seletor de Modo de Visualização */}
                      <div className="flex items-center gap-1 bg-[#0f1219] p-1 rounded-xl border border-[#2d3544]">
                        <button
                          type="button"
                          onClick={() => setViewMode('editor')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            viewMode === 'editor'
                              ? 'bg-blue-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                          title="Apenas Editor"
                        >
                          Editor
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('miniaturas')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                            viewMode === 'miniaturas'
                              ? 'bg-blue-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                          title="Miniaturas de Páginas Laterais"
                        >
                          <Layers className="w-3 h-3" />
                          Miniaturas
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('preview_split')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                            viewMode === 'preview_split'
                              ? 'bg-blue-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                          title="Pré-visualização A4 Lado a Lado"
                        >
                          <Eye className="w-3 h-3" />
                          Preview A4
                        </button>
                      </div>
                    </div>

                    {/* Editor com réguas */}
                    <div
                      className="rounded-xl overflow-hidden border border-[#2d3748] shadow-xl"
                      style={{ background: '#1c2232' }}
                    >
                      {/* Régua horizontal superior */}
                      <RulerHorizontal />

                      {/* Corpo: régua vertical + área de edição */}
                      <div className="flex overflow-hidden" style={{ height: isFullscreen ? 560 : 440 }}>
                        <RulerVertical />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <JoditEditor
                            ref={editorRef}
                            value={editingDoc?.conteudo || ''}
                            config={editorConfig}
                            onBlur={newContent => setEditingDoc({ ...editingDoc, conteudo: newContent })}
                            onChange={newContent => setEditingDoc(prev => ({ ...prev, conteudo: newContent }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                </form>
              </div>

              {/* ── Painel Lateral: Miniaturas em Tempo Real ── */}
              {viewMode === 'miniaturas' && (
                <DocumentoMiniaturasPreview
                  htmlContent={editingDoc?.conteudo || ''}
                  margens={margens}
                  onInsertPageBreak={handleInsertPageBreak}
                />
              )}

              {/* ── Painel Lateral: Pré-visualização A4 Lado a Lado ── */}
              {viewMode === 'preview_split' && (
                <div className="hidden lg:flex flex-col w-[50%] bg-[#404040] overflow-hidden border-l border-border-default">
                  <div className="p-3 border-b border-border-default bg-bg-subtle flex items-center justify-between shrink-0 shadow-md z-10">
                    <span className="text-sm font-semibold text-text-subtle flex items-center gap-2">
                      <Eye className="w-4 h-4 text-blue-400" />
                      Pré-visualização (A4)
                    </span>
                    <span className="text-xs text-text-subtle">
                      Margens: {margens.left}mm / {margens.top}mm
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-6 bg-[#323639] custom-scrollbar pb-24">
                    <div 
                      className="a4-simulated shrink-0 shadow-2xl relative"
                      style={{
                        padding: `${margens.top}mm ${margens.right}mm ${margens.bottom}mm ${margens.left}mm`,
                        background: '#ffffff',
                        width: '210mm',
                        minHeight: '297mm',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div 
                        className="document-preview-content prose max-w-none h-full"
                        style={{ fontSize: '11pt', lineHeight: '1.5', fontFamily: 'Arial, sans-serif', color: '#1a1a1a' }}
                        dangerouslySetInnerHTML={{ 
                          __html: editingDoc?.conteudo 
                            ? editingDoc.conteudo 
                            : '<p class="text-text-subtle italic text-center mt-20">Comece a digitar para ver a pré-visualização...</p>'
                        }} 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t border-border-default bg-bg-surface/50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
              >
                Cancelar
              </button>
              <BotaoSalvar
                type="submit"
                form="docForm"
                salvando={isSaving}
                salvo={isSaved}
                texto={editingDoc?.id ? 'Salvar Alterações' : 'Salvar Modelo'}
                textoSalvando="Salvando Modelo..."
                textoSalvo="Modelo Salvo!"
                variante="primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modais de Recursos Avançados do Editor */}
      <DocumentoMargensModal
        isOpen={isMargensModalOpen}
        onClose={() => setIsMargensModalOpen(false)}
        margens={margens}
        onSave={setMargens}
      />

      <DocumentoTableModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        onInsertTable={insertAtCursor}
      />

      <DocumentoTableEditModal
        isOpen={isTableEditModalOpen}
        onClose={() => setIsTableEditModalOpen(false)}
        htmlContent={editingDoc?.conteudo || ''}
        onSave={(newHtml) => setEditingDoc(prev => prev ? { ...prev, conteudo: newHtml } : prev)}
      />

      <DocumentoImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onInsertImage={insertAtCursor}
        empresaData={currentEmpresa}
        empresas={empresas}
      />
    </div>
  );
};
