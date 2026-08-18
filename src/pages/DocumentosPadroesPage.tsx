import { getEmpresaById, getEmpresas, Empresa } from '../services/empresasService';
import { getAssociados, Associado } from '../services/associadosService';
import React, { useState, useRef, useMemo } from 'react';
import JoditEditor from 'jodit-react';
import { useDocumentosPadroes } from '../hooks/useDocumentosPadroes';
import { useAppContext } from '../context/AppContext';
import { DocumentoPadrao, TipoDocumento } from '../types/documentos';
import { canDelete } from '../utils/permissions';
import { formatLocalDate } from '../utils/dateUtils';
import { FileText, Plus, Search, Pencil, Power, PowerOff, UploadCloud, X, Download, FileCheck, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, Eye, Maximize, Minimize, Trash2, Printer, Building2 } from 'lucide-react';

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
  const [isUploading, setIsUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentoPadrao | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [customVariables, setCustomVariables] = useState<string[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>('Associado');
  const VARIAVEIS_POR_MODULO: Record<string, string[]> = {
    'Associado': [
      '{{associado_nome}}',
      '{{associado_cpf}}',
      '{{associado_rg}}',
      '{{associado_telefone}}',
      '{{associado_email}}',
      '{{associado_endereco}}',
      '{{associado_dependentes}}',
      '{{quantidade_dependentes}}',
      '{{data_adesao}}',
      '{{numero_contrato}}',
    ],
    'Plano / Financeiro': [
      '{{plano_nome}}',
      '{{plano_atual}}',
      '{{valor_mensalidade}}',
    ],
    'Empresa Contratada': [
      '{{empresa_nome}}',
      '{{empresa_cnpj}}',
    ],
    'Sistema / Outros': [
      '{{data_atual}}',
    ]
  };

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
    height: isFullscreen ? 600 : 400,
    toolbarButtonSize: 'small' as const,
    buttons: [
      'source', '|',
      'bold', 'italic', 'underline', 'strikethrough', '|',
      'superscript', 'subscript', '|',
      'ul', 'ol', '|',
      'outdent', 'indent', '|',
      'font', 'fontsize', 'brush', 'paragraph', '|',
      'image', 'table', 'link', '|',
      'align', 'undo', 'redo', '|',
      'hr', 'eraser', 'copyformat', '|',
      'fullsize', 'print'
    ],
    uploader: {
      insertImageAsBase64URI: true
    },
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    style: {
      background: '#ffffff',
      color: '#333333',
      padding: '25mm',
      width: '210mm',
      minHeight: '297mm',
      margin: '20px auto',
      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
    },
    iframe: true,
    iframeStyle: `
      html { background: #e5e7eb; padding: 20px 0; }
      body { 
         width: 210mm !important;
         min-height: 297mm !important; 
         padding: 25mm !important; 
         margin: 0 auto !important; 
         background: #ffffff !important; 
         box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
         box-sizing: border-box !important;
      }
    `
  }), [isFullscreen]);


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
        let targetEmp = activeEmps.find(e => e.id === targetEmpId) || activeEmps[0] || null;
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
      matches.forEach(match => {
        initialValues[match[0]] = match[0] === '{{data_atual}}' ? formatLocalDate(new Date()) : '';
      });
      setPlaceholderValues(initialValues);
    }
  }, [docToPrint]);


  const filtered = documentos.filter(doc => {
    const matchesSearch = ((doc.nome || "").toLowerCase()).includes(searchTerm.toLowerCase()) || 
                          (doc.descricao && doc.descricao.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTipo = tipoFilter ? doc.tipo === tipoFilter : true;
    return matchesSearch && matchesTipo;
  });

  const handleAssociadoChange = (associadoId: string) => {
    const associado = associados.find(a => a.id === associadoId);
    if (!associado) return;
    
    setPlaceholderValues(prev => {
      const newVals = { ...prev };
      if ('{{associado_nome}}' in newVals) newVals['{{associado_nome}}'] = associado.nome || '';
      if ('{{associado_cpf}}' in newVals) newVals['{{associado_cpf}}'] = associado.cpf || '';
      if ('{{associado_rg}}' in newVals) newVals['{{associado_rg}}'] = associado.rg || '';
      if ('{{associado_telefone}}' in newVals) newVals['{{associado_telefone}}'] = associado.telefone || '';
      if ('{{associado_email}}' in newVals) newVals['{{associado_email}}'] = associado.email || '';
      if ('{{associado_endereco}}' in newVals) newVals['{{associado_endereco}}'] = `${associado.endereco_logradouro || ''}, ${associado.endereco_numero || ''} - ${associado.endereco_bairro || ''} - ${associado.endereco_cidade || ''}`;
      if ('{{plano_atual}}' in newVals) newVals['{{plano_atual}}'] = associado.plano_nome || '';
      if ('{{plano_nome}}' in newVals) newVals['{{plano_nome}}'] = associado.plano_nome || '';
      if ('{{numero_contrato}}' in newVals) newVals['{{numero_contrato}}'] = associado.numero_contrato || associado.id.substring(0, 8).toUpperCase();
      if ('{{valor_mensalidade}}' in newVals) newVals['{{valor_mensalidade}}'] = associado.valor_plano ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(associado.valor_plano) : '';
      if ('{{quantidade_dependentes}}' in newVals) newVals['{{quantidade_dependentes}}'] = (associado.dependentes?.length || 0).toString();
      if ('{{data_adesao}}' in newVals) newVals['{{data_adesao}}'] = associado.data_adesao ? formatLocalDate(associado.data_adesao) : '';
            if ('{{associado_dependentes}}' in newVals) newVals['{{associado_dependentes}}'] = (associado.dependentes && associado.dependentes.length > 0) ? associado.dependentes.map(d => `${d.nome} - Parentesco: ${d.parentesco} - CPF: ${d.cpf || 'Não informado'}`).join('<br/>') : 'Nenhum dependente vinculado';
      return newVals;
    });
  };

  const handleEmpresaChange = (empresaId: string) => {
    setSelectedEmpresaId(empresaId);
    const empresa = empresas.find(e => e.id === empresaId);
    if (!empresa) return;
    setCurrentEmpresa(empresa);

    setPlaceholderValues(prev => {
      const newVals = { ...prev };
      newVals['{{empresa_nome}}'] = empresa.nome_fantasia || empresa.razao_social || '';
      newVals['{{empresa_cnpj}}'] = empresa.cnpj || '';
      newVals['{{empresa_endereco}}'] = `${empresa.endereco || ''}`;
      newVals['{{empresa_telefone}}'] = empresa.telefone || '';
      newVals['{{empresa_email}}'] = empresa.email || '';
      return newVals;
    });
  };

  const handlePrint = () => {
    const printArea = document.getElementById('print-area');
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
          <head>
            <meta charset="utf-8" />
            <title>${docToPrint?.nome || 'Documento'}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 15mm 15mm 15mm 15mm;
              }
              *, *::before, *::after {
                box-sizing: border-box;
              }
              html, body {
                margin: 0;
                padding: 0;
                background-color: #ffffff;
                color: #000000;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 11pt;
                line-height: 1.5;
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
                padding-bottom: 12px;
                margin-bottom: 20px;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .doc-header img {
                max-height: 95px;
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
                margin-bottom: 10px;
              }
              .doc-footer {
                width: 100%;
                margin-top: 35px;
                padding-top: 15px;
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
                max-height: 80px;
                max-width: 280px;
                object-fit: contain;
                margin-bottom: 5px;
              }
              .signature-line {
                width: 280px;
                border-top: 1px solid #0f172a;
                margin: 5px auto;
              }
              h1, h2, h3, h4 {
                color: #000000;
              }
              strong {
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
      `);
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
    setEditingDoc(doc || { 
      ativo: true, 
      tipo: 'contrato_adesao',
      conteudo: '',
      empresa_id: empresaSelecionada || ''
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (doc: DocumentoPadrao) => {
    if (!canDelete(state.user)) {
      alert('Permissão negada. Somente usuários Administradores podem excluir registros no sistema.');
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
    try {
      await editar(doc.id, { ativo: !doc.ativo });
    } catch (err) {
      console.error(err);
      alert('Erro ao alterar status');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingDoc?.id) {
        await editar(editingDoc.id, editingDoc);
      } else {
        await criar(editingDoc as any);
      }
      setIsFormOpen(false);
      setEditingDoc(null);
    } catch (err: any) {
      console.error('Erro ao salvar documento:', err);
      alert(err?.message || 'Erro ao salvar documento');
    }
  };

  const handleAddVariable = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newVariable.trim()) {
      let formatted = newVariable.trim();
      if (!formatted.startsWith('{{')) formatted = '{{' + formatted;
      if (!formatted.endsWith('}}')) formatted = formatted + '}}';
      formatted = formatted.replace(/\s+/g, '_').toLowerCase();
      
      if (!customVariables.includes(formatted)) {
        setCustomVariables([...customVariables, formatted]);
      }
      setNewVariable('');
    }
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
          
          onClick={() => handleOpenForm()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
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
              <button onClick={() => { handleOpenForm(previewDoc); setPreviewDoc(null); }} className="flex-1 py-2 bg-bg-hover hover:bg-[#64748B] text-text-base rounded-lg text-sm font-medium transition-colors border border-[#64748B]">
                Editar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Print Modal */}
      {docToPrint && (
        <div className="fixed inset-0 z-[60] bg-white flex overflow-hidden print:static print:block print:overflow-visible">
          {/* Sidebar for variables */}
          <div className="w-80 bg-bg-surface border-r border-border-default flex flex-col print:hidden h-full">
             <div className="p-6 border-b border-border-default bg-[#1A1D36]">
                <h3 className="font-bold text-lg text-text-base mb-1">{docToPrint.nome}</h3>
                <p className="text-sm text-[#3B82F6]">Preencha as variáveis do documento</p>
             </div>
             <div className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar bg-bg-base">

                {/* Seleção de Empresa Emissora */}
                <div className="bg-bg-surface p-3.5 rounded-xl border border-border-default space-y-2">
                  <label className="block text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Empresa Emissora
                  </label>
                  <select
                    value={selectedEmpresaId}
                    onChange={(e) => handleEmpresaChange(e.target.value)}
                    className="w-full bg-bg-base border border-border-default rounded-lg px-3 py-2 text-text-base text-sm focus:border-[#3B82F6] outline-none"
                  >
                    <option value="">Selecione a empresa...</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.nome_fantasia || emp.razao_social}</option>
                    ))}
                  </select>
                  {currentEmpresa && (
                    <div className="text-[11px] text-text-subtle pt-1 flex flex-col gap-0.5 border-t border-border-default/50">
                      <span>Logotipo: {currentEmpresa.logo_url ? '✅ Vinculado' : '⚠️ Sem logotipo'}</span>
                      <span>Assinatura: {currentEmpresa.assinatura_url ? '✅ Vinculada' : '⚠️ Sem assinatura'}</span>
                    </div>
                  )}
                </div>

                {Object.keys(placeholderValues).length > 0 ? (
                  Object.keys(placeholderValues).map(variable => {
                    const isAssociadoNome = variable === '{{associado_nome}}';
                    const isEmpresaNome = variable === '{{empresa_nome}}';
                    
                    return (
                      <div key={variable}>
                        <label className="block text-xs font-semibold text-text-subtle mb-1.5 uppercase tracking-wider">{variable.replace(/[{}]/g, '').replace(/_/g, ' ')}</label>
                        {isAssociadoNome ? (
                          <select
                            onChange={(e) => {
                              const val = e.target.value;
                              setPlaceholderValues(prev => ({ ...prev, [variable]: val ? associados.find(a => a.id === val)?.nome || '' : '' }));
                              if (val) handleAssociadoChange(val);
                            }}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base text-sm focus:border-[#3B82F6] outline-none transition-colors"
                          >
                            <option value="">Selecionar associado...</option>
                            {associados.map(a => (
                              <option key={a.id} value={a.id}>{a.nome} ({a.cpf})</option>
                            ))}
                          </select>
                        ) : isEmpresaNome ? (
                          <select
                            value={selectedEmpresaId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPlaceholderValues(prev => ({ ...prev, [variable]: val ? (empresas.find(emp => emp.id === val)?.nome_fantasia || '') : '' }));
                              if (val) handleEmpresaChange(val);
                            }}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base text-sm focus:border-[#3B82F6] outline-none transition-colors"
                          >
                            <option value="">Selecionar empresa...</option>
                            {empresas.map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.nome_fantasia || emp.razao_social}</option>
                            ))}
                          </select>
                        ) : (
                          <input 
                            type="text"
                            value={placeholderValues[variable]}
                            onChange={(e) => setPlaceholderValues(prev => ({ ...prev, [variable]: e.target.value }))}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base text-sm focus:border-[#3B82F6] outline-none transition-colors"
                            placeholder="Valor..."
                          />
                        )}
                      </div>
                    );
                  })
                ) : (

                  <div className="text-center py-8">
                    <FileCheck className="w-8 h-8 text-emerald-500 mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-text-muted">Nenhuma variável encontrada neste documento.</p>
                  </div>
                )}
             </div>
             <div className="p-6 border-t border-border-default bg-bg-surface space-y-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
               <button 
                  onClick={handlePrint}
                  className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                >
                  <Printer className="w-5 h-5" />
                  Imprimir Documento
                </button>
                <button 
                  onClick={() => setDocToPrint(null)}
                  className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-bg-hover hover:bg-[#323654] text-text-base rounded-xl transition-colors font-medium active:scale-[0.98]"
                >
                  <X className="w-5 h-5" />
                  Cancelar
                </button>
             </div>
          </div>
          
          {/* Document Preview & Print Area */}
          <div className="flex-1 overflow-y-auto bg-[#0F1123] flex justify-center p-8 print:p-0 print:bg-white custom-scrollbar">
            <div id="print-area" className="w-full max-w-4xl bg-white text-black p-10 lg:p-14 min-h-[1056px] shadow-2xl print:max-w-none print:w-full print:min-h-0 print:my-0 print:shadow-none print:p-0 flex flex-col justify-between">
              <div>
                {/* Cabeçalho com Logotipo da Empresa alinhado às margens */}
                {currentEmpresa?.logo_url ? (
                  <div className="doc-header w-full pb-4 mb-6 border-b-2 border-slate-900 flex items-center justify-center text-center">
                    <img 
                      src={currentEmpresa.logo_url} 
                      alt={currentEmpresa.nome_fantasia || "Logotipo"} 
                      className="w-full max-h-24 object-contain mx-auto"
                      style={{ maxHeight: '95px', width: '100%', objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <div className="doc-header w-full pb-3 mb-6 border-b-2 border-slate-900 text-center">
                    <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900">
                      {currentEmpresa?.nome_fantasia || currentEmpresa?.razao_social || 'DOCUMENTO OFICIAL'}
                    </h2>
                    {currentEmpresa?.cnpj && (
                      <p className="text-xs text-slate-600 font-medium">CNPJ: {currentEmpresa.cnpj}</p>
                    )}
                  </div>
                )}

                {/* Conteúdo do Documento */}
                <div 
                  className="prose max-w-none print:prose-p:m-0 print:prose-p:leading-normal"
                  style={{ fontSize: '12pt', lineHeight: '1.6', fontFamily: 'Arial, sans-serif' }}
                  dangerouslySetInnerHTML={{ 
                    __html: (() => {
                      let html = docToPrint.conteudo ? docToPrint.conteudo : '<p class="text-center italic text-gray-500">Documento vazio</p>';
                      Object.entries(placeholderValues).forEach(([key, value]) => {
                        const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                        const displayValue = value ? `<strong>${value}</strong>` : `<span class="text-rose-500 font-bold bg-rose-50 px-1 rounded print:bg-transparent print:text-black">${key}</span>`;
                        html = html.replace(regex, displayValue);
                      });
                      return html;
                    })()
                  }} 
                />
              </div>

              {/* Rodapé com Assinatura da Empresa */}
              <div className="doc-footer w-full mt-12 pt-6 border-t border-slate-200 flex flex-col items-center justify-center text-center print:break-inside-avoid">
                {currentEmpresa?.assinatura_url && (
                  <div className="mb-2 flex justify-center">
                    <img 
                      src={currentEmpresa.assinatura_url} 
                      alt="Assinatura da Empresa" 
                      style={{ maxHeight: '80px', maxWidth: '280px', objectFit: 'contain' }}
                    />
                  </div>
                )}
                <div className="w-72 border-t border-slate-900 my-1"></div>
                <p className="text-xs font-bold text-slate-900 uppercase">
                  {currentEmpresa?.nome_fantasia || currentEmpresa?.razao_social || 'Assinatura Autorizada'}
                </p>
                {currentEmpresa?.cnpj && (
                  <p className="text-[10px] text-slate-600">CNPJ: {currentEmpresa.cnpj}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
{/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/90 backdrop-blur-sm p-4">
          <div className={`bg-bg-subtle ${isFullscreen ? 'rounded-none w-full h-full max-w-none border-0' : 'rounded-3xl shadow-2xl w-full max-w-[95vw] h-[90vh] border border-border-default'} flex flex-col overflow-hidden transition-all duration-300`}>
            <div className="p-4 sm:p-6 border-b border-border-default flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-text-base flex items-center gap-3">
                {editingDoc?.id ? 'Editar Modelo' : 'Novo Modelo de Documento'}
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowPreviewModal(!showPreviewModal)} 
                  className={`hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${showPreviewModal ? "bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20" : "bg-bg-surface text-text-subtle border-border-default hover:text-white"}`}
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-sm font-medium">{showPreviewModal ? "Ocultar Preview" : "Mostrar Preview"}</span>
                </button>
                <button 
                  onClick={() => setIsFullscreen(!isFullscreen)} 
                  className="p-2 text-text-subtle hover:text-text-base bg-bg-surface rounded-lg border border-border-default hidden md:block"
                  title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
                <button onClick={() => setIsFormOpen(false)} className="p-2 text-text-subtle hover:text-text-base bg-bg-surface rounded-lg border border-border-default">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:border-r border-border-default">
                <form id="docForm" onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-text-subtle mb-1">Nome do Modelo *</label>
                      <input
                        required
                        type="text"
                        value={editingDoc?.nome || ''}
                        onChange={e => setEditingDoc({ ...editingDoc, nome: e.target.value })}
                        className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50"
                        placeholder="Ex: Contrato Padrão Mensal"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-text-subtle mb-1">Tipo de Documento *</label>
                      <select
                        required
                        value={editingDoc?.tipo || ''}
                        onChange={e => setEditingDoc({ ...editingDoc, tipo: e.target.value as TipoDocumento })}
                        className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50"
                      >
                        {Object.entries(TIPO_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-sm font-semibold text-text-subtle mb-1">Descrição</label>
                      <textarea
                        rows={2}
                        value={editingDoc?.descricao || ''}
                        onChange={e => setEditingDoc({ ...editingDoc, descricao: e.target.value })}
                        className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 resize-none"
                        placeholder="Breve descrição do uso deste modelo..."
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border-default">
                    <h4 className="text-sm font-semibold text-[#3B82F6] uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Conteúdo do Documento
                    </h4>
                    
                    <div className="bg-bg-surface border border-border-default rounded-xl p-4 text-sm text-text-subtle">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <p className="text-text-muted font-medium">Variáveis do módulo:</p>
                          <select 
                            value={selectedModule} 
                            onChange={(e) => setSelectedModule(e.target.value)}
                            className="px-2 py-1 bg-bg-subtle border border-border-default rounded-lg text-xs text-text-base focus:outline-none focus:border-[#3B82F6]"
                          >
                            {Object.keys(VARIAVEIS_POR_MODULO).map(mod => (
                              <option key={mod} value={mod}>{mod}</option>
                            ))}
                            <option value="Personalizadas">Personalizadas</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={newVariable}
                            onChange={(e) => setNewVariable(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddVariable(); } }}
                            placeholder="Nova variável..." 
                            className="px-2 py-1 bg-bg-subtle border border-border-default rounded-lg text-xs text-text-base focus:outline-none focus:border-[#3B82F6]"
                          />
                          <button type="button" onClick={() => handleAddVariable()} className="p-1 bg-bg-hover hover:bg-[#3B82F6] text-white rounded transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar">
                        {(selectedModule === 'Personalizadas' ? customVariables : VARIAVEIS_POR_MODULO[selectedModule] || []).map(v => (
                          <button 
                            key={v} 
                            type="button"
                            onClick={() => insertAtCursor(v)}
                            className="px-2 py-1 bg-bg-subtle hover:bg-[#3B82F6]/20 hover:text-[#3B82F6] border border-border-default rounded font-mono text-xs text-text-muted transition-colors cursor-pointer"
                          >
                            {v}
                          </button>
                        ))}
                        {selectedModule === 'Personalizadas' && customVariables.length === 0 && (
                          <span className="text-xs text-text-muted italic">Nenhuma variável personalizada adicionada ainda. Use o campo acima para adicionar.</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-text-subtle mb-1">Editor de Conteúdo (HTML/Texto)</label>
                      <div className="border border-border-default rounded-xl overflow-hidden flex flex-col bg-white">
                        <JoditEditor
                          ref={editorRef}
                          value={editingDoc?.conteudo || ''}
                          config={editorConfig}
                          onBlur={newContent => setEditingDoc({ ...editingDoc, conteudo: newContent })}
                          onChange={newContent => setEditingDoc(prev => ({ ...prev, conteudo: newContent }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-text-subtle mb-1">Ou faça upload de um arquivo modelo (PDF/Docx)</label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-border-default border-dashed rounded-xl cursor-pointer bg-bg-surface hover:bg-bg-subtle transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <UploadCloud className="w-6 h-6 text-text-subtle mb-2" />
                            {isUploading ? <p className="text-sm text-[#3B82F6]">Fazendo upload...</p> : <p className="text-sm text-text-subtle"><span className="font-semibold text-[#3B82F6]">Clique para enviar</span> ou arraste o arquivo</p>}
                          </div>
                          <input type="file" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              setIsUploading(true);
                              const url = await uploadArquivo(file);
                              setEditingDoc(prev => prev ? { ...prev, arquivo_url: url } : null);
                            } catch (err: any) {
                              console.warn('Falha no upload', err);
                              alert('Erro ao fazer upload. Verifique sua conexão.');
                            } finally {
                              setIsUploading(false);
                            }
                          }} disabled={isUploading} />
                        </label>
                      </div>
                      {editingDoc?.arquivo_url && (
                        <div className="mt-2 text-sm text-emerald-400 flex items-center gap-2">
                          <FileCheck className="w-4 h-4" />
                          Arquivo anexado com sucesso.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="docAtivo"
                      checked={editingDoc?.ativo}
                      onChange={e => setEditingDoc({ ...editingDoc, ativo: e.target.checked })}
                      className="w-4 h-4 rounded border-border-default bg-bg-surface text-[#3B82F6] focus:ring-[#3B82F6]/50 focus:ring-offset-0 focus:ring-2"
                    />
                    <label htmlFor="docAtivo" className="text-sm text-text-muted">Modelo ativo (disponível para uso)</label>
                  </div>
                </form>
              </div>

              {/* Preview Side */}
              {showPreviewModal && (
                <div className="hidden lg:flex flex-col w-[50%] bg-[#404040] overflow-hidden">
                  <div className="p-3 border-b border-border-default bg-bg-subtle flex items-center justify-between shrink-0 shadow-md z-10">
                    <span className="text-sm font-semibold text-text-subtle flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Pré-visualização (A4)
                    </span>
                    <span className="text-xs text-text-subtle">
                      Margens e paginação simuladas
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-6 bg-[#323639] custom-scrollbar pb-24">
                    <div 
                      className="a4-simulated shrink-0 shadow-2xl relative"
                    >
                      <div 
                        className="document-preview-content prose max-w-none h-full"
                        style={{ fontSize: '11pt', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' }}
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
              <button
                type="submit"
                form="docForm"
                className="px-4 py-2 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25"
              >
                Salvar Modelo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
