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
  RefreshCw,
  Flame,
  CreditCard,
  Hospital,
  Truck,
  ChevronDown,
  ChevronRight,
  Sparkles,
  RotateCcw,
  Layers,
  ClipboardList,
  Wallet
} from 'lucide-react';
import { format } from 'date-fns';
import { DocumentoPadrao, TipoDocumento } from '../../types/documentos';
import { Empresa, getEmpresas } from '../../services/empresasService';
import { Associado, getAssociados } from '../../services/associadosService';
import { Atendimento } from '../../types/atendimentos';
import { getAtendimentos } from '../../services/atendimentosService';
import { PlanoPax } from '../../types/planosPax';
import { Credenciado } from '../../types/credenciados';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import { Fornecedor } from '../../types/fornecedores';
import { Requisicao } from '../../types/requisicoes';
import { getRequisicoes } from '../../services/requisicoesService';
import { Receita, ParcelaReceber, getReceitas, getParcelasReceber } from '../../services/financeiroService';
import { formatLocalDate } from '../../utils/dateUtils';
import { getAllFromIDB } from '../../lib/idb';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import {
  resolverAssociado,
  resolverAtendimento,
  resolverCredenciado,
  resolverEmpresa,
  resolverFinanceiro,
  resolverFornecedor,
  resolverPlano,
  resolverRequisicao,
} from '../../utils/documentVariaveis';

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
  atendimentos?: Atendimento[];
  planos?: PlanoPax[];
  credenciados?: Credenciado[];
  fornecedores?: Fornecedor[];
  requisicoes?: Requisicao[];
  receitas?: Receita[];
  parcelasReceber?: ParcelaReceber[];
  initialPlaceholderValues?: Record<string, string>;
  onEmpresaSelect?: (empresaId: string) => void;
  onAssociadoSelect?: (associadoId: string) => void;
  onAtendimentoSelect?: (atendimentoId: string) => void;
  onPlanoSelect?: (planoId: string) => void;
  onCredenciadoSelect?: (credenciadoId: string) => void;
  onFornecedorSelect?: (fornecedorId: string) => void;
  onRequisicaoSelect?: (requisicaoId: string) => void;
  onParcelaSelect?: (parcelaId: string) => void;
  customTitle?: string;
}

export const VisualizadorDocumentoPadraoModal: React.FC<VisualizadorDocumentoPadraoModalProps> = ({
  isOpen,
  onClose,
  documento,
  empresaData: initialEmpresaData,
  empresas: propEmpresas = [],
  associados: propAssociados = [],
  atendimentos: propAtendimentos = [],
  planos: propPlanos = [],
  credenciados: propCredenciados = [],
  fornecedores: propFornecedores = [],
  requisicoes: propRequisicoes = [],
  receitas: propReceitas = [],
  parcelasReceber: propParcelasReceber = [],
  initialPlaceholderValues = {},
  onEmpresaSelect,
  onAssociadoSelect,
  onAtendimentoSelect,
  onPlanoSelect,
  onCredenciadoSelect,
  onFornecedorSelect,
  onRequisicaoSelect,
  onParcelaSelect,
  customTitle
}) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [zoom, setZoom] = useState<number>(100);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [searchVar, setSearchVar] = useState('');
  
  // Entidades carregadas (props ou autônomas)
  const [empresas, setEmpresas] = useState<Empresa[]>(propEmpresas);
  const [associados, setAssociados] = useState<Associado[]>(propAssociados);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>(propAtendimentos);
  const [planos, setPlanos] = useState<PlanoPax[]>(propPlanos);
  const [credenciados, setCredenciados] = useState<Credenciado[]>(propCredenciados);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>(propFornecedores);
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>(propRequisicoes);
  const [receitas, setReceitas] = useState<Receita[]>(propReceitas);
  const [parcelasReceber, setParcelasReceber] = useState<ParcelaReceber[]>(propParcelasReceber);

  // Seleções ativas
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');
  const [selectedAssociadoId, setSelectedAssociadoId] = useState<string>('');
  const [selectedAtendimentoId, setSelectedAtendimentoId] = useState<string>('');
  const [selectedPlanoId, setSelectedPlanoId] = useState<string>('');
  const [selectedCredenciadoId, setSelectedCredenciadoId] = useState<string>('');
  const [selectedFornecedorId, setSelectedFornecedorId] = useState<string>('');
  const [selectedRequisicaoId, setSelectedRequisicaoId] = useState<string>('');
  const [selectedParcelaId, setSelectedParcelaId] = useState<string>('');

  const [currentEmpresa, setCurrentEmpresa] = useState<Empresa | null>(initialEmpresaData || null);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>(initialPlaceholderValues);

  // Controle de accordions/seções abertas na sidebar
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    empresa: true,
    associado: false,
    atendimento: false,
    plano: false,
    credenciado: false,
    fornecedor: false,
    requisicao: false,
    financeiro: false,
  });

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Sincroniza listas vindas de props
  useEffect(() => { if (propEmpresas.length > 0) setEmpresas(propEmpresas); }, [propEmpresas]);
  useEffect(() => { if (propAssociados.length > 0) setAssociados(propAssociados); }, [propAssociados]);
  useEffect(() => { if (propAtendimentos.length > 0) setAtendimentos(propAtendimentos); }, [propAtendimentos]);
  useEffect(() => { if (propPlanos.length > 0) setPlanos(propPlanos); }, [propPlanos]);
  useEffect(() => { if (propCredenciados.length > 0) setCredenciados(propCredenciados); }, [propCredenciados]);
  useEffect(() => { if (propFornecedores.length > 0) setFornecedores(propFornecedores); }, [propFornecedores]);
  useEffect(() => { if (propRequisicoes.length > 0) setRequisicoes(propRequisicoes); }, [propRequisicoes]);
  useEffect(() => { if (propReceitas.length > 0) setReceitas(propReceitas); }, [propReceitas]);
  useEffect(() => { if (propParcelasReceber.length > 0) setParcelasReceber(propParcelasReceber); }, [propParcelasReceber]);

  // Carregamento autônomo e unificado caso as listas não sejam passadas por props
  useEffect(() => {
    if (!isOpen) return;

    const carregarEntidades = async () => {
      try {
        if (empresas.length === 0) {
          const emps = await getEmpresas(true);
          setEmpresas(emps || []);
          if (!currentEmpresa && emps && emps.length > 0) {
            setCurrentEmpresa(emps[0]);
            setSelectedEmpresaId(emps[0].id);
          }
        }
        if (associados.length === 0) {
          const assocs = await getAssociados(true, 'all');
          setAssociados(assocs || []);
        }
        if (atendimentos.length === 0) {
          const atds = await getAtendimentos(true, 'all');
          setAtendimentos(atds || []);
        }
        if (planos.length === 0) {
          try {
            const { data } = await supabase.from('planos_pax').select('*').is('deleted_at', null);
            if (data && data.length > 0) {
              setPlanos(data as PlanoPax[]);
            } else {
              const idbPlanos = await getAllFromIDB<PlanoPax>('planos_pax');
              setPlanos(idbPlanos || []);
            }
          } catch (e) {
            const idbPlanos = await getAllFromIDB<PlanoPax>('planos_pax');
            setPlanos(idbPlanos || []);
          }
        }
        if (credenciados.length === 0) {
          try {
            const { data } = await supabase.from('credenciados').select('*');
            if (data && data.length > 0) {
              setCredenciados(data as Credenciado[]);
            } else {
              const idbCreds = await getAllFromIDB<Credenciado>('credenciados');
              setCredenciados(idbCreds || []);
            }
          } catch (e) {
            const idbCreds = await getAllFromIDB<Credenciado>('credenciados');
            setCredenciados(idbCreds || []);
          }
        }
        if (fornecedores.length === 0) {
          try {
            const { data } = await supabase.from('fornecedores').select('*');
            if (data && data.length > 0) {
              setFornecedores(data as Fornecedor[]);
            } else {
              const idbForns = await getAllFromIDB<Fornecedor>('fornecedores');
              setFornecedores(idbForns || []);
            }
          } catch (e) {
            const idbForns = await getAllFromIDB<Fornecedor>('fornecedores');
            setFornecedores(idbForns || []);
          }
        }
        if (requisicoes.length === 0) {
          const reqs = await getRequisicoes(true, 'all');
          setRequisicoes(reqs || []);
        }
        if (receitas.length === 0) {
          const recs = await getReceitas(true, 'all');
          setReceitas(recs || []);
        }
        if (parcelasReceber.length === 0) {
          const parcs = await getParcelasReceber(true, 'all');
          setParcelasReceber(parcs || []);
        }
      } catch (e) {
        console.warn('Erro ao carregar entidades para o visualizador:', e);
      }
    };

    carregarEntidades();
  }, [isOpen]);

  // Sincroniza empresa atual caso mude por props
  useEffect(() => {
    if (initialEmpresaData) {
      setCurrentEmpresa(initialEmpresaData);
      setSelectedEmpresaId(initialEmpresaData.id);
    }
  }, [initialEmpresaData]);

  // Detecção inteligente de módulos a partir das tags do documento
  const modulosDetectados = useMemo(() => {
    if (!documento?.conteudo) return { hasAtendimento: false, hasAssociado: false, hasPlano: false, hasCredenciado: false, hasFornecedor: false, hasRequisicao: false, hasFinanceiro: false, hasEmpresa: true };
    const content = documento.conteudo.toLowerCase();

    return {
      hasAtendimento: /\{\{(falecido_|data_obito|hora_obito|local_obito|local_velorio|local_sepultamento|data_velorio|data_sepultamento|atendimento_|declaracao|medico_|crm_medico|rqe_medico|tanato|datanasc_falecido|cor_falecido|sexo_falecido)/i.test(content),
      hasAssociado: /\{\{(associado_|numero_contrato|data_adesao|quantidade_dependentes|valor_mensalidade)/i.test(content),
      hasPlano: /\{\{(plano_|valor_mensalidade)/i.test(content),
      hasCredenciado: /\{\{credenciado_/i.test(content),
      hasFornecedor: /\{\{fornecedor_/i.test(content),
      hasRequisicao: /\{\{(requisicao_|paciente_|medico_solicitante|crm_solicitante)/i.test(content),
      hasFinanceiro: /\{\{(parcela_|receita_|forma_pagamento)/i.test(content),
      hasEmpresa: /\{\{empresa_/i.test(content),
    };
  }, [documento?.conteudo]);

  // Inicializa valores de placeholders e abre accordions relevantes
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
      if (!initialVals['{{empresa_razao_social}}']) initialVals['{{empresa_razao_social}}'] = currentEmpresa.razao_social || currentEmpresa.nome_fantasia || '';
      if (!initialVals['{{empresa_cnpj}}']) initialVals['{{empresa_cnpj}}'] = currentEmpresa.cnpj || '';
      if (!initialVals['{{empresa_endereco}}']) initialVals['{{empresa_endereco}}'] = currentEmpresa.endereco || '';
      if (!initialVals['{{empresa_telefone}}']) initialVals['{{empresa_telefone}}'] = currentEmpresa.telefone || '';
      if (!initialVals['{{empresa_email}}']) initialVals['{{empresa_email}}'] = currentEmpresa.email || '';
      if (!initialVals['{{empresa_chave_pix}}']) initialVals['{{empresa_chave_pix}}'] = currentEmpresa.chave_pix || '';
    }

    setPlaceholderValues(initialVals);

    // Ajusta seções abertas com base no tipo de documento detectado
    setOpenSections({
      empresa: true,
      atendimento: modulosDetectados.hasAtendimento,
      associado: modulosDetectados.hasAssociado,
      plano: modulosDetectados.hasPlano,
      credenciado: modulosDetectados.hasCredenciado,
      fornecedor: modulosDetectados.hasFornecedor,
      requisicao: modulosDetectados.hasRequisicao,
      financeiro: modulosDetectados.hasFinanceiro,
    });
  }, [documento, isOpen, modulosDetectados]);

  // Manipulador de troca de empresa
  const handleEmpresaChange = (empresaId: string) => {
    setSelectedEmpresaId(empresaId);
    const emp = empresas.find(e => e.id === empresaId) || null;
    setCurrentEmpresa(emp);

    if (emp) {
      setPlaceholderValues(prev => ({ ...prev, ...resolverEmpresa(emp) }));
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

    setPlaceholderValues(prev => ({ ...prev, ...resolverAssociado(assoc) }));

    if (onAssociadoSelect) {
      onAssociadoSelect(associadoId);
    }
  };

  // Manipulador de seleção de Atendimento Funerário / Óbito
  const handleAtendimentoChange = (atendimentoId: string) => {
    setSelectedAtendimentoId(atendimentoId);
    const atd = atendimentos.find(a => a.id === atendimentoId);
    if (!atd) return;

    setPlaceholderValues(prev => ({ ...prev, ...resolverAtendimento(atd) }));

    // Se o atendimento possui associado_id vinculado, preenche automaticamente os dados do associado
    if (atd.associado_id && (!selectedAssociadoId || selectedAssociadoId !== atd.associado_id)) {
      handleAssociadoChange(atd.associado_id);
    }

    if (onAtendimentoSelect) {
      onAtendimentoSelect(atendimentoId);
    }
  };

  // Manipulador de seleção de Plano PAX
  const handlePlanoChange = (planoId: string) => {
    setSelectedPlanoId(planoId);
    const plano = planos.find(p => p.id === planoId);
    if (!plano) return;

    setPlaceholderValues(prev => ({ ...prev, ...resolverPlano(plano) }));

    if (onPlanoSelect) {
      onPlanoSelect(planoId);
    }
  };

  // Manipulador de seleção de Rede Credenciada / Prestadores
  const handleCredenciadoChange = (credenciadoId: string) => {
    setSelectedCredenciadoId(credenciadoId);
    const cred = credenciados.find(c => c.id === credenciadoId);
    if (!cred) return;

    setPlaceholderValues(prev => ({ ...prev, ...resolverCredenciado(cred) }));

    if (onCredenciadoSelect) {
      onCredenciadoSelect(credenciadoId);
    }
  };

  // Manipulador de seleção de Fornecedores
  const handleFornecedorChange = (fornecedorId: string) => {
    setSelectedFornecedorId(fornecedorId);
    const forn = fornecedores.find(f => f.id === fornecedorId);
    if (!forn) return;

    setPlaceholderValues(prev => ({ ...prev, ...resolverFornecedor(forn) }));

    if (onFornecedorSelect) {
      onFornecedorSelect(fornecedorId);
    }
  };

  // Manipulador de seleção de Requisição / Guia
  const handleRequisicaoChange = (requisicaoId: string) => {
    setSelectedRequisicaoId(requisicaoId);
    const req = requisicoes.find(r => r.id === requisicaoId);
    if (!req) return;

    setPlaceholderValues(prev => ({ ...prev, ...resolverRequisicao(req) }));

    if (req.associado_id && (!selectedAssociadoId || selectedAssociadoId !== req.associado_id)) {
      handleAssociadoChange(req.associado_id);
    }
    if (req.credenciado_id && (!selectedCredenciadoId || selectedCredenciadoId !== req.credenciado_id)) {
      handleCredenciadoChange(req.credenciado_id);
    }

    if (onRequisicaoSelect) {
      onRequisicaoSelect(requisicaoId);
    }
  };

  // Manipulador de seleção de parcela financeira (Contas a Receber)
  const handleParcelaChange = (parcelaId: string) => {
    setSelectedParcelaId(parcelaId);
    const parcela = parcelasReceber.find(p => p.id === parcelaId);
    if (!parcela) return;

    const receita = receitas.find(r => r.id === parcela.receita_id) || null;
    setPlaceholderValues(prev => ({ ...prev, ...resolverFinanceiro(parcela, receita) }));

    if (onParcelaSelect) {
      onParcelaSelect(parcelaId);
    }
  };

  // Toggle de seção do accordion
  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Reset de seleções automáticas
  const handleResetSelections = () => {
    setSelectedAssociadoId('');
    setSelectedAtendimentoId('');
    setSelectedPlanoId('');
    setSelectedCredenciadoId('');
    setSelectedFornecedorId('');
    setSelectedRequisicaoId('');
    setSelectedParcelaId('');
    toast.success('Seleções limpas.');
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

    return sanitizeHtml(html);
  }, [documento?.conteudo, placeholderValues]);

  // Contadores
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
            table.tabela-sem-grade,
            table.tabela-sem-grade td,
            table.tabela-sem-grade th,
            table[style*="border: none"],
            table[style*="border: 0"] {
              border: none !important;
            }
            table.tabela-zebrada tr:nth-child(even) td {
              background-color: #f8fafc !important;
            }
            .page-break {
              page-break-after: always;
              break-after: page;
              height: 0;
              margin: 0;
              padding: 0;
              border: none !important;
            }
            .page-break span {
              display: none !important;
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
                documento.ativo ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600'
              }`}>
                {documento.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              Visualizador Interativo • {preenchidasVars} de {totalVars} variáveis preenchidas
            </p>
          </div>
        </div>

        {/* Centro: Controles de Orientação, Zoom e Sidebar */}
        <div className="hidden md:flex items-center gap-3 bg-[#181d27] px-3 py-1.5 rounded-xl border border-[#2d3544]">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              showSidebar ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
            }`}
            title={showSidebar ? "Ocultar Painel Lateral" : "Exibir Painel Lateral"}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Painel de Dados</span>
          </button>

          <div className="h-4 w-px bg-[#2d3544]" />

          {/* Seletor de Orientação */}
          <div className="flex items-center gap-1 bg-[#13171f] p-0.5 rounded-lg border border-[#2d3544]">
            <button
              onClick={() => setOrientation('portrait')}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                orientation === 'portrait' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Retrato (Vertical - A4 210x297mm)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Retrato</span>
            </button>
            <button
              onClick={() => setOrientation('landscape')}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-all ${
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

      {/* ─── CORPO PRINCIPAL: SIDEBAR MULTI-MÓDULO + ÁREA DE TRABALHO ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* SIDEBAR DE INSERÇÃO AUTOMÁTICA E VARIÁVEIS */}
        {showSidebar && (
          <aside className="w-80 lg:w-[410px] bg-[#13171f] border-r border-[#2d3544] flex flex-col shrink-0 z-20 shadow-2xl animate-in slide-in-from-left duration-200">
            
            {/* Header da Sidebar */}
            <div className="p-4 border-b border-[#2d3544] bg-[#181d27]">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                  Inserção Automática de Dados
                </h3>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {variaveisDoDocumento.length} variáveis
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Selecione os registros dos módulos abaixo para preenchimento imediato.
              </p>
            </div>

            {/* Conteúdo Rolável da Sidebar */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              
              {/* ── SELETOR 1: EMPRESA EMISSORA ── */}
              <div className="bg-[#181d27] rounded-xl border border-[#2d3544] overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('empresa')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <Building2 className="w-4 h-4" />
                    <span>Empresa Emissora</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedEmpresaId && <span className="w-2 h-2 rounded-full bg-emerald-400" title="Empresa Selecionada" />}
                    {openSections.empresa ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.empresa && (
                  <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
                    <select
                      value={selectedEmpresaId}
                      onChange={(e) => handleEmpresaChange(e.target.value)}
                      className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-amber-500 outline-none transition-colors"
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
              </div>

              {/* ── SELETOR 2: ATENDIMENTO / ÓBITO ── */}
              <div className={`bg-[#181d27] rounded-xl border transition-all ${
                modulosDetectados.hasAtendimento ? 'border-indigo-500/50 shadow-md shadow-indigo-500/5' : 'border-[#2d3544]'
              } overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => toggleSection('atendimento')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    <Flame className="w-4 h-4" />
                    <span>Atendimento / Óbito</span>
                    {modulosDetectados.hasAtendimento && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Detectado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedAtendimentoId && <span className="w-2 h-2 rounded-full bg-emerald-400" title="Atendimento Selecionado" />}
                    {openSections.atendimento ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.atendimento && (
                  <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
                    <select
                      value={selectedAtendimentoId}
                      onChange={(e) => handleAtendimentoChange(e.target.value)}
                      className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none transition-colors"
                    >
                      <option value="">Selecione o atendimento do falecido...</option>
                      {atendimentos.map(atd => (
                        <option key={atd.id} value={atd.id}>
                          {atd.falecido_nome} {atd.data_obito ? `(Óbito: ${formatLocalDate(atd.data_obito)})` : ''} - Status: {(atd.status || '').toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche falecido, datas de óbito, velório, sepultamento, médico, CRM, tanatopraxia e vincula associado se houver.
                    </p>
                  </div>
                )}
              </div>

              {/* ── SELETOR 3: ASSOCIADO & CONTRATO ── */}
              <div className={`bg-[#181d27] rounded-xl border transition-all ${
                modulosDetectados.hasAssociado ? 'border-blue-500/50 shadow-md shadow-blue-500/5' : 'border-[#2d3544]'
              } overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => toggleSection('associado')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                    <User className="w-4 h-4" />
                    <span>Associado & Contrato</span>
                    {modulosDetectados.hasAssociado && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Detectado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedAssociadoId && <span className="w-2 h-2 rounded-full bg-emerald-400" title="Associado Selecionado" />}
                    {openSections.associado ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.associado && (
                  <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
                    <select
                      value={selectedAssociadoId}
                      onChange={(e) => handleAssociadoChange(e.target.value)}
                      className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 outline-none transition-colors"
                    >
                      <option value="">Selecione um associado...</option>
                      {associados.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.nome} {a.cpf ? `(CPF: ${a.cpf})` : ''} {a.numero_contrato ? `[Contrato: ${a.numero_contrato}]` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche nome, CPF, endereço, número do contrato, plano, dependentes e data de adesão.
                    </p>
                  </div>
                )}
              </div>

              {/* ── SELETOR 4: PLANO PAX ── */}
              <div className={`bg-[#181d27] rounded-xl border transition-all ${
                modulosDetectados.hasPlano ? 'border-emerald-500/50 shadow-md shadow-emerald-500/5' : 'border-[#2d3544]'
              } overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => toggleSection('plano')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <CreditCard className="w-4 h-4" />
                    <span>Plano PAX</span>
                    {modulosDetectados.hasPlano && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Detectado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedPlanoId && <span className="w-2 h-2 rounded-full bg-emerald-400" title="Plano Selecionado" />}
                    {openSections.plano ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.plano && (
                  <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
                    <select
                      value={selectedPlanoId}
                      onChange={(e) => handlePlanoChange(e.target.value)}
                      className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none transition-colors"
                    >
                      <option value="">Selecione o plano PAX...</option>
                      {planos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome} ({p.codigo}) - {p.tipo_plano === 'individual' ? 'Individual' : 'Coletivo'} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.valor_mensalidade || 0)}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche nome do plano, código, tipo, valor de mensalidade, taxa de adesão e carências.
                    </p>
                  </div>
                )}
              </div>

              {/* ── SELETOR 5: REDE CREDENCIADA / PRESTADOR ── */}
              <div className={`bg-[#181d27] rounded-xl border transition-all ${
                modulosDetectados.hasCredenciado ? 'border-rose-500/50 shadow-md shadow-rose-500/5' : 'border-[#2d3544]'
              } overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => toggleSection('credenciado')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
                    <Hospital className="w-4 h-4" />
                    <span>Rede Credenciada / Prestador</span>
                    {modulosDetectados.hasCredenciado && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Detectado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedCredenciadoId && <span className="w-2 h-2 rounded-full bg-emerald-400" title="Credenciado Selecionado" />}
                    {openSections.credenciado ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.credenciado && (
                  <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
                    <select
                      value={selectedCredenciadoId}
                      onChange={(e) => handleCredenciadoChange(e.target.value)}
                      className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-rose-500 outline-none transition-colors"
                    >
                      <option value="">Selecione o credenciado / clínica...</option>
                      {credenciados.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''} - {c.ramo_atividade || 'Saúde'}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche razão social, nome fantasia, CNPJ/CPF, endereço, telefone, e-mail e responsável.
                    </p>
                  </div>
                )}
              </div>

              {/* ── SELETOR 6: FORNECEDOR ── */}
              <div className={`bg-[#181d27] rounded-xl border transition-all ${
                modulosDetectados.hasFornecedor ? 'border-orange-500/50 shadow-md shadow-orange-500/5' : 'border-[#2d3544]'
              } overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => toggleSection('fornecedor')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
                    <Truck className="w-4 h-4" />
                    <span>Fornecedor</span>
                    {modulosDetectados.hasFornecedor && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Detectado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedFornecedorId && <span className="w-2 h-2 rounded-full bg-emerald-400" title="Fornecedor Selecionado" />}
                    {openSections.fornecedor ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.fornecedor && (
                  <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
                    <select
                      value={selectedFornecedorId}
                      onChange={(e) => handleFornecedorChange(e.target.value)}
                      className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-orange-500 outline-none transition-colors"
                    >
                      <option value="">Selecione o fornecedor...</option>
                      {fornecedores.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.razao_social} {f.nome_fantasia ? `(${f.nome_fantasia})` : ''} - {f.cnpj_cpf}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche razão social, CNPJ/CPF, endereço, telefone, contato e dados bancários/PIX.
                    </p>
                  </div>
                )}
              </div>

              {/* ── SELETOR 7: REQUISIÇÃO / GUIA ── */}
              <div className={`bg-[#181d27] rounded-xl border transition-all ${
                modulosDetectados.hasRequisicao ? 'border-cyan-500/50 shadow-md shadow-cyan-500/5' : 'border-[#2d3544]'
              } overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => toggleSection('requisicao')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    <ClipboardList className="w-4 h-4" />
                    <span>Requisição / Guia</span>
                    {modulosDetectados.hasRequisicao && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Detectado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedRequisicaoId && <span className="w-2 h-2 rounded-full bg-emerald-400" title="Requisição Selecionada" />}
                    {openSections.requisicao ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.requisicao && (
                  <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
                    <select
                      value={selectedRequisicaoId}
                      onChange={(e) => handleRequisicaoChange(e.target.value)}
                      className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-cyan-500 outline-none transition-colors"
                    >
                      <option value="">Selecione a requisição...</option>
                      {requisicoes.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.codigo_requisicao} - {r.paciente_nome} {r.credenciado_nome ? `(${r.credenciado_nome})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche código, datas, paciente, médico solicitante, valor e coparticipação. Vincula associado e credenciado se houver.
                    </p>
                  </div>
                )}
              </div>

              {/* ── SELETOR 8: FINANCEIRO / PARCELA ── */}
              <div className={`bg-[#181d27] rounded-xl border transition-all ${
                modulosDetectados.hasFinanceiro ? 'border-green-500/50 shadow-md shadow-green-500/5' : 'border-[#2d3544]'
              } overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => toggleSection('financeiro')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-green-400 uppercase tracking-wider">
                    <Wallet className="w-4 h-4" />
                    <span>Financeiro / Pagamentos</span>
                    {modulosDetectados.hasFinanceiro && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Detectado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedParcelaId && <span className="w-2 h-2 rounded-full bg-emerald-400" title="Parcela Selecionada" />}
                    {openSections.financeiro ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {openSections.financeiro && (
                  <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
                    <select
                      value={selectedParcelaId}
                      onChange={(e) => handleParcelaChange(e.target.value)}
                      className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-green-500 outline-none transition-colors"
                    >
                      <option value="">Selecione a parcela...</option>
                      {parcelasReceber.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.descricao || `Parcela ${p.numero_parcela}`} - {formatLocalDate(p.data_vencimento)}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche número, valor e vencimento da parcela, além da descrição, categoria e valor total da receita.
                    </p>
                  </div>
                )}
              </div>

              {/* Botão para limpar seleções */}
              {(selectedAssociadoId || selectedAtendimentoId || selectedPlanoId || selectedCredenciadoId || selectedFornecedorId || selectedRequisicaoId || selectedParcelaId) && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleResetSelections}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Limpar Seleções de Módulos
                  </button>
                </div>
              )}

              {/* Divisor */}
              <div className="border-t border-[#2d3544] pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    Variáveis do Documento
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    {preenchidasVars} de {totalVars} preenchidas
                  </span>
                </div>
              </div>

              {/* Busca de Variáveis */}
              {variaveisDoDocumento.length > 4 && (
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

              {/* Campos de Inserção Manual/Ajuste de Variáveis */}
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
                    handleResetSelections();
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
