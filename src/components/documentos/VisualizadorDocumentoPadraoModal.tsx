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
  Wallet,
  ClipboardList,
  UserCircle2,
  Move,
  Check,
  Undo2,
} from 'lucide-react';
import { Rnd } from 'react-rnd';
import { format } from 'date-fns';
import { DocumentoPadrao, TipoDocumento, AssinaturaConfig } from '../../types/documentos';
import { Empresa, getEmpresas } from '../../services/empresasService';
import { Associado, Dependente, getAssociados } from '../../services/associadosService';
import { Atendimento } from '../../types/atendimentos';
import { getAtendimentos } from '../../services/atendimentosService';
import { PlanoPax } from '../../types/planosPax';
import { Credenciado } from '../../types/credenciados';
import { Fornecedor } from '../../types/fornecedores';
import {
  Receita,
  ParcelaReceber,
  getReceitas,
  getParcelasReceber,
} from '../../services/financeiroService';
import { Requisicao } from '../../types/requisicoes';
import { getRequisicoes } from '../../services/requisicoesService';
import { formatLocalDate } from '../../utils/dateUtils';
import { getAllFromIDB } from '../../lib/idb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  resolverVariaveisEmpresa,
  resolverVariaveisAssociado,
  resolverVariaveisDependente,
  resolverVariaveisContrato,
  resolverVariaveisAtendimento,
  resolverVariaveisPlano,
  resolverVariaveisCredenciado,
  resolverVariaveisFornecedor,
  resolverVariaveisUsuario,
  resolverVariaveisReceita,
  resolverVariaveisParcelaReceber,
  resolverVariaveisRequisicao,
  resolverVariaveisSistema,
} from '../../utils/documentoVariaveis';
import { montarHtmlImpressaoDocumento } from '../../utils/documentoPrintStyles';
import { sanitizeDocumentoHtml } from '../../utils/sanitizeHtml';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

const TIPO_LABELS: Record<TipoDocumento, string> = {
  contrato_adesao: 'Contrato de Adesão',
  termo_rescisao: 'Termo de Rescisão',
  termo_credenciamento: 'Termo de Credenciamento',
  aditivo: 'Aditivo/Atualização',
  outro: 'Outro',
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
  initialPlaceholderValues?: Record<string, string>;
  onEmpresaSelect?: (empresaId: string) => void;
  onAssociadoSelect?: (associadoId: string) => void;
  onAtendimentoSelect?: (atendimentoId: string) => void;
  onPlanoSelect?: (planoId: string) => void;
  onCredenciadoSelect?: (credenciadoId: string) => void;
  onFornecedorSelect?: (fornecedorId: string) => void;
  customTitle?: string;
  /** Quando informado, habilita o modo de posicionamento livre (drag-and-drop) da assinatura da empresa e persiste a escolha através deste callback. */
  onSaveAssinaturaConfig?: (config: AssinaturaConfig | null) => void;
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
  initialPlaceholderValues = {},
  onEmpresaSelect,
  onAssociadoSelect,
  onAtendimentoSelect,
  onPlanoSelect,
  onCredenciadoSelect,
  onFornecedorSelect,
  customTitle,
  onSaveAssinaturaConfig,
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
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [parcelasReceber, setParcelasReceber] = useState<ParcelaReceber[]>([]);
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);

  // Seleções ativas
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');
  const [selectedAssociadoId, setSelectedAssociadoId] = useState<string>('');
  const [selectedDependenteId, setSelectedDependenteId] = useState<string>('');
  const [selectedAtendimentoId, setSelectedAtendimentoId] = useState<string>('');
  const [selectedPlanoId, setSelectedPlanoId] = useState<string>('');
  const [selectedCredenciadoId, setSelectedCredenciadoId] = useState<string>('');
  const [selectedFornecedorId, setSelectedFornecedorId] = useState<string>('');
  const [selectedReceitaId, setSelectedReceitaId] = useState<string>('');
  const [selectedParcelaReceberId, setSelectedParcelaReceberId] = useState<string>('');
  const [selectedRequisicaoId, setSelectedRequisicaoId] = useState<string>('');

  const { user: usuarioLogado } = useAuth();

  const [currentEmpresa, setCurrentEmpresa] = useState<Empresa | null>(initialEmpresaData || null);
  const [placeholderValues, setPlaceholderValues] =
    useState<Record<string, string>>(initialPlaceholderValues);

  // Controle de accordions/seções abertas na sidebar
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    empresa: true,
    associado: false,
    atendimento: false,
    plano: false,
    credenciado: false,
    fornecedor: false,
    financeiro: false,
    requisicao: false,
  });

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Posicionamento livre (drag-and-drop) da assinatura da empresa
  const [assinaturaConfig, setAssinaturaConfig] = useState<AssinaturaConfig | null>(null);
  const [isPosicionandoAssinatura, setIsPosicionandoAssinatura] = useState(false);
  const DEFAULT_ASSINATURA_CONFIG: AssinaturaConfig = {
    x: 35,
    y: 82,
    largura: 30,
    altura: 10,
    pagina: 0,
  };

  // Sincroniza listas vindas de props
  useEffect(() => {
    if (propEmpresas.length > 0) setEmpresas(propEmpresas);
  }, [propEmpresas]);
  useEffect(() => {
    if (propAssociados.length > 0) setAssociados(propAssociados);
  }, [propAssociados]);
  useEffect(() => {
    if (propAtendimentos.length > 0) setAtendimentos(propAtendimentos);
  }, [propAtendimentos]);
  useEffect(() => {
    if (propPlanos.length > 0) setPlanos(propPlanos);
  }, [propPlanos]);
  useEffect(() => {
    if (propCredenciados.length > 0) setCredenciados(propCredenciados);
  }, [propCredenciados]);
  useEffect(() => {
    if (propFornecedores.length > 0) setFornecedores(propFornecedores);
  }, [propFornecedores]);

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
        if (receitas.length === 0) {
          const rec = await getReceitas(true, 'all');
          setReceitas(rec || []);
        }
        if (parcelasReceber.length === 0) {
          const parc = await getParcelasReceber(true, 'all');
          setParcelasReceber(parc || []);
        }
        if (requisicoes.length === 0) {
          const reqs = await getRequisicoes(true, 'all');
          setRequisicoes(reqs || []);
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
    if (!documento?.conteudo) {
      return {
        hasAtendimento: false,
        hasAssociado: false,
        hasPlano: false,
        hasCredenciado: false,
        hasFornecedor: false,
        hasEmpresa: true,
        hasFinanceiro: false,
        hasRequisicao: false,
      };
    }
    const content = documento.conteudo.toLowerCase();

    return {
      hasAtendimento:
        /\{\{(falecido_|data_obito|hora_obito|local_obito|local_velorio|local_sepultamento|data_velorio|data_sepultamento|atendimento_|declaracao|medico_|crm_medico|rqe_medico|tanato|datanasc_falecido|cor_falecido|sexo_falecido)/i.test(
          content,
        ),
      hasAssociado:
        /\{\{(associado_|numero_contrato|contrato_|data_adesao|quantidade_dependentes|valor_mensalidade|dependente_)/i.test(
          content,
        ),
      hasPlano: /\{\{(plano_|valor_mensalidade)/i.test(content),
      hasCredenciado: /\{\{credenciado_/i.test(content),
      hasFornecedor: /\{\{fornecedor_/i.test(content),
      hasEmpresa: /\{\{empresa_/i.test(content),
      hasFinanceiro: /\{\{(receita_|parcela_|devedor_|forma_pagamento)/i.test(content),
      hasRequisicao: /\{\{requisicao_/i.test(content),
    };
  }, [documento?.conteudo]);

  // Inicializa valores de placeholders e abre accordions relevantes
  useEffect(() => {
    if (!documento || !isOpen) return;

    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [...(documento.conteudo || '').matchAll(regex)];
    const initialVals: Record<string, string> = { ...initialPlaceholderValues };

    // Valores automáticos: data/hora do sistema, empresa atual e usuário logado
    const autoValues: Record<string, string> = {
      ...resolverVariaveisSistema(),
      ...(currentEmpresa ? resolverVariaveisEmpresa(currentEmpresa) : {}),
      ...(usuarioLogado ? resolverVariaveisUsuario(usuarioLogado) : {}),
    };

    matches.forEach((match) => {
      const varKey = match[0];
      if (initialVals[varKey] === undefined) {
        initialVals[varKey] = autoValues[varKey] || '';
      }
    });

    setPlaceholderValues(initialVals);
    setAssinaturaConfig(documento.assinatura_config ?? null);
    setIsPosicionandoAssinatura(false);

    // Ajusta seções abertas com base no tipo de documento detectado
    setOpenSections({
      empresa: true,
      atendimento: modulosDetectados.hasAtendimento,
      associado: modulosDetectados.hasAssociado,
      plano: modulosDetectados.hasPlano,
      credenciado: modulosDetectados.hasCredenciado,
      financeiro: modulosDetectados.hasFinanceiro,
      requisicao: modulosDetectados.hasRequisicao,
      fornecedor: modulosDetectados.hasFornecedor,
    });
  }, [documento, isOpen, modulosDetectados]);

  // ── Posicionamento livre (drag-and-drop) da assinatura ──
  const handleIniciarPosicionamentoAssinatura = () => {
    setAssinaturaConfig((prev) => prev || DEFAULT_ASSINATURA_CONFIG);
    setIsPosicionandoAssinatura(true);
  };

  const handleAssinaturaDragResizeStop = (
    xPx: number,
    yPx: number,
    larguraPx: number,
    alturaPx: number,
  ) => {
    // Usa clientWidth/clientHeight (espaço de layout) em vez de getBoundingClientRect() (espaço visual),
    // pois o zoom da folha é aplicado via CSS transform: scale() num ancestral — o Rnd posiciona a
    // assinatura em coordenadas de layout, não visuais, então a conversão precisa usar a mesma base.
    const container = printAreaRef.current;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    setAssinaturaConfig({
      x: (xPx / width) * 100,
      y: (yPx / height) * 100,
      largura: (larguraPx / width) * 100,
      altura: (alturaPx / height) * 100,
      pagina: 0,
    });
  };

  const handleSalvarPosicaoAssinatura = () => {
    setIsPosicionandoAssinatura(false);
    if (onSaveAssinaturaConfig) onSaveAssinaturaConfig(assinaturaConfig);
  };

  const handleRemoverPosicaoPersonalizada = () => {
    setAssinaturaConfig(null);
    setIsPosicionandoAssinatura(false);
    if (onSaveAssinaturaConfig) onSaveAssinaturaConfig(null);
  };

  // Manipulador de troca de empresa
  const handleEmpresaChange = (empresaId: string) => {
    setSelectedEmpresaId(empresaId);
    const emp = empresas.find((e) => e.id === empresaId) || null;
    setCurrentEmpresa(emp);

    if (emp) {
      setPlaceholderValues((prev) => ({ ...prev, ...resolverVariaveisEmpresa(emp) }));
    }

    if (onEmpresaSelect) {
      onEmpresaSelect(empresaId);
    }
  };

  // Manipulador de seleção de associado para preenchimento rápido
  const handleAssociadoChange = (associadoId: string) => {
    setSelectedAssociadoId(associadoId);
    setSelectedDependenteId('');
    const assoc = associados.find((a) => a.id === associadoId);
    if (!assoc) return;

    setPlaceholderValues((prev) => ({
      ...prev,
      ...resolverVariaveisAssociado(assoc),
      ...resolverVariaveisContrato(assoc),
    }));

    if (onAssociadoSelect) {
      onAssociadoSelect(associadoId);
    }
  };

  // Preenche variáveis de um dependente específico do associado selecionado
  const handleDependenteChange = (dependenteId: string) => {
    setSelectedDependenteId(dependenteId);
    const assoc = associados.find((a) => a.id === selectedAssociadoId);
    const dep = assoc?.dependentes?.find((d: Dependente) => d.id === dependenteId);
    if (!dep) return;
    setPlaceholderValues((prev) => ({ ...prev, ...resolverVariaveisDependente(dep) }));
  };

  // Manipulador de seleção de Atendimento Funerário / Óbito
  const handleAtendimentoChange = (atendimentoId: string) => {
    setSelectedAtendimentoId(atendimentoId);
    const atd = atendimentos.find((a) => a.id === atendimentoId);
    if (!atd) return;

    setPlaceholderValues((prev) => ({ ...prev, ...resolverVariaveisAtendimento(atd) }));

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
    const plano = planos.find((p) => p.id === planoId);
    if (!plano) return;

    setPlaceholderValues((prev) => ({ ...prev, ...resolverVariaveisPlano(plano) }));

    if (onPlanoSelect) {
      onPlanoSelect(planoId);
    }
  };

  // Manipulador de seleção de Rede Credenciada / Prestadores
  const handleCredenciadoChange = (credenciadoId: string) => {
    setSelectedCredenciadoId(credenciadoId);
    const cred = credenciados.find((c) => c.id === credenciadoId);
    if (!cred) return;

    setPlaceholderValues((prev) => ({ ...prev, ...resolverVariaveisCredenciado(cred) }));

    if (onCredenciadoSelect) {
      onCredenciadoSelect(credenciadoId);
    }
  };

  // Manipulador de seleção de Fornecedores
  const handleFornecedorChange = (fornecedorId: string) => {
    setSelectedFornecedorId(fornecedorId);
    const forn = fornecedores.find((f) => f.id === fornecedorId);
    if (!forn) return;

    setPlaceholderValues((prev) => ({ ...prev, ...resolverVariaveisFornecedor(forn) }));

    if (onFornecedorSelect) {
      onFornecedorSelect(fornecedorId);
    }
  };

  // Manipulador de seleção de Receita (financeiro)
  const handleReceitaChange = (receitaId: string) => {
    setSelectedReceitaId(receitaId);
    const receita = receitas.find((r) => r.id === receitaId);
    if (!receita) return;
    setPlaceholderValues((prev) => ({ ...prev, ...resolverVariaveisReceita(receita) }));
  };

  // Manipulador de seleção de Parcela a Receber (financeiro — ideal para recibos)
  const handleParcelaReceberChange = (parcelaId: string) => {
    setSelectedParcelaReceberId(parcelaId);
    const parcela = parcelasReceber.find((p) => p.id === parcelaId);
    if (!parcela) return;
    setPlaceholderValues((prev) => ({ ...prev, ...resolverVariaveisParcelaReceber(parcela) }));
  };

  // Manipulador de seleção de Requisição / Guia
  const handleRequisicaoChange = (requisicaoId: string) => {
    setSelectedRequisicaoId(requisicaoId);
    const req = requisicoes.find((r) => r.id === requisicaoId);
    if (!req) return;
    setPlaceholderValues((prev) => ({ ...prev, ...resolverVariaveisRequisicao(req) }));
  };

  // Toggle de seção do accordion
  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Reset de seleções automáticas
  const handleResetSelections = () => {
    setSelectedAssociadoId('');
    setSelectedDependenteId('');
    setSelectedAtendimentoId('');
    setSelectedPlanoId('');
    setSelectedCredenciadoId('');
    setSelectedFornecedorId('');
    setSelectedReceitaId('');
    setSelectedParcelaReceberId('');
    setSelectedRequisicaoId('');
    toast.success('Seleções limpas.');
  };

  // Controles de zoom
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 40));
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
    const uniqueKeys = Array.from(new Set(matches.map((m) => m[0])));

    if (!searchVar.trim()) return uniqueKeys;
    const q = searchVar.toLowerCase();
    return uniqueKeys.filter((k) => k.toLowerCase().includes(q));
  }, [documento?.conteudo, searchVar]);

  // Conteúdo HTML final processado com substituição de variáveis
  const renderedHtml = useMemo(() => {
    if (!documento?.conteudo) {
      return '<p class="text-center italic text-slate-400 py-12">Documento sem conteúdo cadastrado.</p>';
    }

    let html = documento.conteudo;
    Object.entries(placeholderValues).forEach(([key, value]) => {
      const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const displayValue =
        value && value.trim()
          ? `<span class="font-semibold text-slate-900">${value}</span>`
          : `<span class="text-rose-500 font-bold bg-rose-50 px-1 py-0.5 rounded border border-rose-200 print:border-0 print:bg-transparent print:text-black">${key}</span>`;
      html = html.replace(regex, displayValue);
    });

    return html;
  }, [documento?.conteudo, placeholderValues]);

  // Contadores
  const totalVars = Object.keys(placeholderValues).length;
  const preenchidasVars = Object.values(placeholderValues).filter(
    (v) => v && v.trim().length > 0,
  ).length;

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

    const printHtml = montarHtmlImpressaoDocumento(
      documento?.nome || 'Documento Oficial',
      printArea.innerHTML,
      orientation,
    );

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
        format: 'a4',
      });

      const pageWidth = orientation === 'landscape' ? 297 : 210;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

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
        autoPaging: 'text',
      });
    } catch (err) {
      console.error('Erro ao gerar PDF do documento:', err);
      toast.error('Não foi possível gerar o PDF direto. Abrindo diálogo de impressão...', {
        id: 'export-doc-pdf',
      });
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
              <h2
                className="text-sm sm:text-base font-bold text-white tracking-wide truncate max-w-xs sm:max-w-md"
                title={documento.nome}
              >
                {customTitle || documento.nome}
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                {TIPO_LABELS[documento.tipo as TipoDocumento] || documento.tipo}
              </span>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border shrink-0 ${
                  documento.ativo
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-700/50 text-slate-400 border-slate-600'
                }`}
              >
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
              showSidebar
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
            title={showSidebar ? 'Ocultar Painel Lateral' : 'Exibir Painel Lateral'}
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

          {onSaveAssinaturaConfig && (
            <>
              <div className="h-4 w-px bg-[#2d3544]" />
              {!isPosicionandoAssinatura ? (
                <button
                  onClick={handleIniciarPosicionamentoAssinatura}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544] transition-colors"
                  title="Escolher livremente onde a assinatura da empresa aparece no documento"
                >
                  <Move className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span className="hidden md:inline">Posicionar Assinatura</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="hidden md:inline text-[10px] text-fuchsia-300 font-semibold">
                    Arraste/redimensione a assinatura na folha
                  </span>
                  {assinaturaConfig && (
                    <button
                      onClick={handleRemoverPosicaoPersonalizada}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-300 hover:bg-[#2d3544] transition-colors"
                      title="Remover posicionamento personalizado (voltar ao rodapé padrão)"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={handleSalvarPosicaoAssinatura}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg text-xs font-bold transition-colors"
                    title="Concluir e salvar a posição da assinatura"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Concluir</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Lado Direito: Ações (Salvar PDF, Imprimir, Fechar) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || isPosicionandoAssinatura}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-emerald-600/20 active:scale-95"
            title={
              isPosicionandoAssinatura
                ? 'Conclua o posicionamento da assinatura antes de exportar'
                : 'Baixar arquivo PDF diretamente'
            }
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Salvar PDF</span>
          </button>

          <button
            onClick={handleImprimir}
            disabled={isPosicionandoAssinatura}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-blue-600/20 active:scale-95"
            title={
              isPosicionandoAssinatura
                ? 'Conclua o posicionamento da assinatura antes de imprimir'
                : 'Abrir impressão limpa nativa / Salvar como PDF'
            }
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          <div className="h-6 w-px bg-[#2d3544]" />

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#2d3544] transition-colors"
            title="Fechar Visualizador (ESC)"
            aria-label="Fechar"
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
                    {selectedEmpresaId && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-400"
                        title="Empresa Selecionada"
                      />
                    )}
                    {openSections.empresa ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
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
                      {empresas.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nome_fantasia || emp.razao_social}
                        </option>
                      ))}
                    </select>
                    {currentEmpresa && (
                      <div className="text-[10px] text-slate-400 pt-1.5 flex flex-wrap items-center gap-2 border-t border-[#2d3544]">
                        <span className="flex items-center gap-1">
                          {currentEmpresa.logo_url ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                          )}
                          Logo: {currentEmpresa.logo_url ? 'Vinculado' : 'Sem logo'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {currentEmpresa.assinatura_url ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                          )}
                          Assinatura:{' '}
                          {currentEmpresa.assinatura_url ? 'Vinculada' : 'Sem assinatura'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── SELETOR 2: ATENDIMENTO / ÓBITO ── */}
              <div
                className={`bg-[#181d27] rounded-xl border transition-all ${
                  modulosDetectados.hasAtendimento
                    ? 'border-indigo-500/50 shadow-md shadow-indigo-500/5'
                    : 'border-[#2d3544]'
                } overflow-hidden`}
              >
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
                    {selectedAtendimentoId && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-400"
                        title="Atendimento Selecionado"
                      />
                    )}
                    {openSections.atendimento ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
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
                      {atendimentos.map((atd) => (
                        <option key={atd.id} value={atd.id}>
                          {atd.falecido_nome}{' '}
                          {atd.data_obito ? `(Óbito: ${formatLocalDate(atd.data_obito)})` : ''} -
                          Status: {(atd.status || '').toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche falecido, datas de óbito, velório, sepultamento, médico, CRM,
                      tanatopraxia e vincula associado se houver.
                    </p>
                  </div>
                )}
              </div>

              {/* ── SELETOR 3: ASSOCIADO & CONTRATO ── */}
              <div
                className={`bg-[#181d27] rounded-xl border transition-all ${
                  modulosDetectados.hasAssociado
                    ? 'border-blue-500/50 shadow-md shadow-blue-500/5'
                    : 'border-[#2d3544]'
                } overflow-hidden`}
              >
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
                    {selectedAssociadoId && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-400"
                        title="Associado Selecionado"
                      />
                    )}
                    {openSections.associado ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
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
                      {associados.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nome} {a.cpf ? `(CPF: ${a.cpf})` : ''}{' '}
                          {a.numero_contrato ? `[Contrato: ${a.numero_contrato}]` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche nome, CPF, endereço, número do contrato, plano, dependentes e data de
                      adesão.
                    </p>

                    {selectedAssociadoId &&
                      (() => {
                        const assocSelecionado = associados.find(
                          (a) => a.id === selectedAssociadoId,
                        );
                        const dependentes = assocSelecionado?.dependentes || [];
                        if (dependentes.length === 0) return null;
                        return (
                          <div className="pt-2 border-t border-[#2d3544]/60 space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-300 uppercase tracking-wider">
                              <UserCircle2 className="w-3 h-3" />
                              Dependente (opcional)
                            </label>
                            <select
                              value={selectedDependenteId}
                              onChange={(e) => handleDependenteChange(e.target.value)}
                              className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 outline-none transition-colors"
                            >
                              <option value="">Selecione um dependente...</option>
                              {dependentes.map((d: Dependente) => (
                                <option key={d.id} value={d.id}>
                                  {d.nome} {d.cpf ? `(CPF: ${d.cpf})` : ''}{' '}
                                  {d.parentesco ? `[${d.parentesco}]` : ''}
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-slate-400">
                              Preenche nome, CPF, data de nascimento e parentesco do dependente
                              selecionado.
                            </p>
                          </div>
                        );
                      })()}
                  </div>
                )}
              </div>

              {/* ── SELETOR 4: PLANO PAX ── */}
              <div
                className={`bg-[#181d27] rounded-xl border transition-all ${
                  modulosDetectados.hasPlano
                    ? 'border-emerald-500/50 shadow-md shadow-emerald-500/5'
                    : 'border-[#2d3544]'
                } overflow-hidden`}
              >
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
                    {selectedPlanoId && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-400"
                        title="Plano Selecionado"
                      />
                    )}
                    {openSections.plano ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
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
                      {planos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} ({p.codigo}) -{' '}
                          {p.tipo_plano === 'individual' ? 'Individual' : 'Coletivo'} -{' '}
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(p.valor_mensalidade || 0)}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche nome do plano, código, tipo, valor de mensalidade, taxa de adesão e
                      carências.
                    </p>
                  </div>
                )}
              </div>

              {/* ── SELETOR 5: REDE CREDENCIADA / PRESTADOR ── */}
              <div
                className={`bg-[#181d27] rounded-xl border transition-all ${
                  modulosDetectados.hasCredenciado
                    ? 'border-rose-500/50 shadow-md shadow-rose-500/5'
                    : 'border-[#2d3544]'
                } overflow-hidden`}
              >
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
                    {selectedCredenciadoId && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-400"
                        title="Credenciado Selecionado"
                      />
                    )}
                    {openSections.credenciado ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
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
                      {credenciados.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''} -{' '}
                          {c.ramo_atividade || 'Saúde'}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche razão social, nome fantasia, CNPJ/CPF, endereço, telefone, e-mail e
                      responsável.
                    </p>
                  </div>
                )}
              </div>

              {/* ── SELETOR 6: FORNECEDOR ── */}
              <div
                className={`bg-[#181d27] rounded-xl border transition-all ${
                  modulosDetectados.hasFornecedor
                    ? 'border-orange-500/50 shadow-md shadow-orange-500/5'
                    : 'border-[#2d3544]'
                } overflow-hidden`}
              >
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
                    {selectedFornecedorId && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-400"
                        title="Fornecedor Selecionado"
                      />
                    )}
                    {openSections.fornecedor ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
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
                      {fornecedores.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.razao_social} {f.nome_fantasia ? `(${f.nome_fantasia})` : ''} -{' '}
                          {f.cnpj_cpf}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche razão social, CNPJ/CPF, endereço, telefone, contato e dados
                      bancários/PIX.
                    </p>
                  </div>
                )}
              </div>

              {/* ── SELETOR 7: FINANCEIRO (RECEITA / PARCELA A RECEBER) ── */}
              <div
                className={`bg-[#181d27] rounded-xl border transition-all ${
                  modulosDetectados.hasFinanceiro
                    ? 'border-teal-500/50 shadow-md shadow-teal-500/5'
                    : 'border-[#2d3544]'
                } overflow-hidden`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection('financeiro')}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase tracking-wider">
                    <Wallet className="w-4 h-4" />
                    <span>Financeiro (Receita / Recibo)</span>
                    {modulosDetectados.hasFinanceiro && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Detectado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(selectedReceitaId || selectedParcelaReceberId) && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400" title="Selecionado" />
                    )}
                    {openSections.financeiro ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {openSections.financeiro && (
                  <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
                    <select
                      value={selectedReceitaId}
                      onChange={(e) => handleReceitaChange(e.target.value)}
                      className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-teal-500 outline-none transition-colors"
                    >
                      <option value="">Selecione a receita...</option>
                      {receitas.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.descricao} -{' '}
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(r.valor_total || 0)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedParcelaReceberId}
                      onChange={(e) => handleParcelaReceberChange(e.target.value)}
                      className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-teal-500 outline-none transition-colors"
                    >
                      <option value="">Selecione a parcela a receber...</option>
                      {parcelasReceber.map((p) => (
                        <option key={p.id} value={p.id}>
                          Parcela {p.numero_parcela} - {p.devedor_nome || 'Sem devedor'} -{' '}
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(p.valor || 0)}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche descrição, categoria, valores, vencimento/pagamento, status e dados
                      do devedor — ideal para recibos.
                    </p>
                  </div>
                )}
              </div>

              {/* ── SELETOR 8: REQUISIÇÃO / GUIA ── */}
              <div
                className={`bg-[#181d27] rounded-xl border transition-all ${
                  modulosDetectados.hasRequisicao
                    ? 'border-cyan-500/50 shadow-md shadow-cyan-500/5'
                    : 'border-[#2d3544]'
                } overflow-hidden`}
              >
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
                    {selectedRequisicaoId && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-400"
                        title="Requisição Selecionada"
                      />
                    )}
                    {openSections.requisicao ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
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
                      {requisicoes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.codigo_requisicao} - {r.paciente_nome} (
                          {(r.status || '').toUpperCase()})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Preenche código, datas, paciente, credenciado, médico solicitante, itens e
                      valor total.
                    </p>
                  </div>
                )}
              </div>

              {/* Botão para limpar seleções */}
              {(selectedAssociadoId ||
                selectedAtendimentoId ||
                selectedPlanoId ||
                selectedCredenciadoId ||
                selectedFornecedorId ||
                selectedReceitaId ||
                selectedParcelaReceberId ||
                selectedRequisicaoId) && (
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
                    <button
                      onClick={() => setSearchVar('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Campos de Inserção Manual/Ajuste de Variáveis */}
              <div className="space-y-3 pt-1">
                {variaveisDoDocumento.length > 0 ? (
                  variaveisDoDocumento.map((variable) => {
                    const isFilled = Boolean(
                      placeholderValues[variable] && placeholderValues[variable].trim(),
                    );
                    const labelFriendly = variable.replace(/[{}]/g, '').replace(/_/g, ' ');

                    return (
                      <div
                        key={variable}
                        className="bg-[#181d27] p-3 rounded-xl border border-[#2d3544] space-y-1.5 hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <label
                            className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate"
                            title={variable}
                          >
                            {labelFriendly}
                          </label>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                              isFilled
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {isFilled ? 'OK' : 'PENDENTE'}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-blue-400/80 truncate">
                          {variable}
                        </p>

                        {variable === '{{associado_dependentes}}' ||
                        variable.includes('conteudo') ||
                        variable.includes('texto') ? (
                          <textarea
                            rows={3}
                            value={placeholderValues[variable] || ''}
                            onChange={(e) =>
                              setPlaceholderValues((prev) => ({
                                ...prev,
                                [variable]: e.target.value,
                              }))
                            }
                            placeholder="Digite o valor..."
                            className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 outline-none transition-colors resize-none"
                          />
                        ) : (
                          <input
                            type="text"
                            value={placeholderValues[variable] || ''}
                            onChange={(e) =>
                              setPlaceholderValues((prev) => ({
                                ...prev,
                                [variable]: e.target.value,
                              }))
                            }
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
                    <p className="text-xs text-slate-300 font-semibold">
                      Nenhuma variável dinâmica
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Este documento não possui tags de substituição identificadas.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé da Sidebar */}
            <div className="p-3 border-t border-[#2d3544] bg-[#181d27] flex items-center justify-between text-xs text-slate-400">
              <button
                onClick={() => {
                  const now = new Date();
                  setPlaceholderValues((prev) => ({
                    ...prev,
                    '{{data_atual}}': formatLocalDate(now),
                    '{{hora_atual}}': now.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
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
                    Object.keys(placeholderValues).forEach((k) => {
                      emptyVals[k] = '';
                    });
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
              transition: 'transform 0.15s ease-out',
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
                boxSizing: 'border-box',
                position: 'relative',
              }}
              className="bg-white text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-sm flex flex-col justify-between"
            >
              <div>
                {/* Cabeçalho Oficial da Empresa */}
                {currentEmpresa?.logo_url ? (
                  <div className="doc-header w-full pb-4 mb-6 border-b-2 border-slate-900 flex items-center justify-center text-center">
                    <img
                      src={currentEmpresa.logo_url}
                      alt={currentEmpresa.nome_fantasia || 'Logotipo'}
                      style={{ maxHeight: '85px', maxWidth: '100%', objectFit: 'contain' }}
                      className="mx-auto block"
                    />
                  </div>
                ) : (
                  <div className="doc-header w-full pb-3 mb-6 border-b-2 border-slate-900 text-center">
                    <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900 m-0">
                      {currentEmpresa?.nome_fantasia ||
                        currentEmpresa?.razao_social ||
                        'SISTEMA ERAS PAX'}
                    </h2>
                    {currentEmpresa?.cnpj && (
                      <p className="text-xs text-slate-600 font-medium mt-1">
                        CNPJ: {currentEmpresa.cnpj}
                      </p>
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
                    fontFamily: 'Arial, Helvetica, sans-serif',
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeDocumentoHtml(renderedHtml) }}
                />
              </div>

              {/* Rodapé Oficial da Empresa com Assinatura (comportamento padrão/legado: rodapé fixo centralizado) */}
              {!assinaturaConfig && (
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
                    {currentEmpresa?.nome_fantasia ||
                      currentEmpresa?.razao_social ||
                      'Assinatura Autorizada'}
                  </p>
                  {currentEmpresa?.cnpj && (
                    <p className="text-[10px] text-slate-600">CNPJ: {currentEmpresa.cnpj}</p>
                  )}
                </div>
              )}

              {/* Assinatura com posicionamento livre (drag-and-drop), quando configurada */}
              {assinaturaConfig && isPosicionandoAssinatura && (
                <Rnd
                  bounds="parent"
                  position={{
                    x: (assinaturaConfig.x / 100) * (printAreaRef.current?.clientWidth || 1),
                    y: (assinaturaConfig.y / 100) * (printAreaRef.current?.clientHeight || 1),
                  }}
                  size={{
                    width:
                      (assinaturaConfig.largura / 100) * (printAreaRef.current?.clientWidth || 1),
                    height:
                      (assinaturaConfig.altura / 100) * (printAreaRef.current?.clientHeight || 1),
                  }}
                  onDragStop={(_e: any, d: any) =>
                    handleAssinaturaDragResizeStop(
                      d.x,
                      d.y,
                      (assinaturaConfig.largura / 100) * (printAreaRef.current?.clientWidth || 1),
                      (assinaturaConfig.altura / 100) * (printAreaRef.current?.clientHeight || 1),
                    )
                  }
                  onResizeStop={(_e: any, _dir: any, ref: any, _delta: any, pos: any) =>
                    handleAssinaturaDragResizeStop(pos.x, pos.y, ref.offsetWidth, ref.offsetHeight)
                  }
                  className="border-2 border-dashed border-fuchsia-500 bg-fuchsia-500/5 flex flex-col items-center justify-center text-center cursor-move z-10"
                >
                  {currentEmpresa?.assinatura_url && (
                    <img
                      src={currentEmpresa.assinatura_url}
                      alt="Assinatura da Empresa"
                      className="max-h-full max-w-full object-contain pointer-events-none"
                    />
                  )}
                  <div className="signature-line w-4/5 border-t border-slate-900 my-1 pointer-events-none"></div>
                  <p className="text-[10px] font-bold text-slate-900 uppercase pointer-events-none">
                    {currentEmpresa?.nome_fantasia ||
                      currentEmpresa?.razao_social ||
                      'Assinatura Autorizada'}
                  </p>
                </Rnd>
              )}

              {assinaturaConfig && !isPosicionandoAssinatura && (
                <div
                  className="absolute flex flex-col items-center justify-center text-center"
                  style={{
                    left: `${assinaturaConfig.x}%`,
                    top: `${assinaturaConfig.y}%`,
                    width: `${assinaturaConfig.largura}%`,
                    height: `${assinaturaConfig.altura}%`,
                  }}
                >
                  {currentEmpresa?.assinatura_url && (
                    <img
                      src={currentEmpresa.assinatura_url}
                      alt="Assinatura da Empresa"
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                  <div className="signature-line w-4/5 border-t border-slate-900 my-1"></div>
                  <p className="text-[10px] font-bold text-slate-900 uppercase">
                    {currentEmpresa?.nome_fantasia ||
                      currentEmpresa?.razao_social ||
                      'Assinatura Autorizada'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
