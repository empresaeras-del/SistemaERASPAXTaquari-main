import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import { format } from 'date-fns';
import { DocumentoPadrao,  AssinaturaConfig } from '../types/documentos';
import { Empresa, getEmpresas } from '../services/empresasService';
import { Associado, Dependente, getAssociados } from '../services/associadosService';
import { Atendimento } from '../types/atendimentos';
import { getAtendimentos } from '../services/atendimentosService';
import { PlanoPax } from '../types/planosPax';
import { Credenciado } from '../types/credenciados';
import { Fornecedor } from '../types/fornecedores';
import {
  Receita,
  ParcelaReceber,
  getReceitas,
  getParcelasReceber,
} from '../services/financeiroService';
import { Requisicao } from '../types/requisicoes';
import { getRequisicoes } from '../services/requisicoesService';
import { formatLocalDate } from '../utils/dateUtils';
import { getAllFromIDB } from '../lib/idb';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
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
} from '../utils/documentoVariaveis';
import { montarHtmlImpressaoDocumento } from '../utils/documentoPrintStyles';
import {

  configDeArrasto,

  configPadrao,

  normalizarConfig,
  margensOu,
  pxPorMm,

} from '../utils/assinaturaPosicao';
import type { AssinaturaConfigV2, OrientacaoPapel } from '../types/documentos';
import { sanitizeDocumentoHtml } from '../utils/sanitizeHtml';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { VisualizadorDocumentoToolbar } from '../components/documentos/VisualizadorDocumentoToolbar';
import { VisualizadorDocumentoSeletores } from '../components/documentos/VisualizadorDocumentoSeletores';
import { VisualizadorDocumentoVariaveis } from '../components/documentos/VisualizadorDocumentoVariaveis';
import { VisualizadorDocumentoFolha } from '../components/documentos/VisualizadorDocumentoFolha';


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
  /** Persiste a orientação do papel escolhida na barra de ferramentas. */
  onSaveOrientacao?: (orientacao: OrientacaoPapel) => void;
}


/**
 * Todo o estado do visualizador de documento padrão: a carga das entidades de cada módulo,
 * os oito handlers de seleção, a medição da folha, o zoom, a orientação e o HTML final com
 * as variáveis substituídas.
 *
 * Mesma divisão de `useAuditoriaState`: o componente monta, o hook guarda o estado, e as
 * funções puras (`documentoVariaveis`, `assinaturaPosicao`) decidem o conteúdo. O corpo foi
 * **movido verbatim** — inclusive o destructuring abaixo, que RENOMEIA (`associados:
 * propAssociados`) porque o corpo declara um `useState` de mesmo nome logo adiante.
 */
export const useVisualizadorDocumento = ({
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
  onSaveAssinaturaConfig,
  onSaveOrientacao,
}: VisualizadorDocumentoPadraoModalProps) => {
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
  const { state: { empresaSelecionada } } = useAppContext();

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
  /** Área útil da folha (dentro dos paddings) — é a referência do arrastar. */
  const areaAssinaturaRef = useRef<HTMLDivElement>(null);
  /** Documento cuja assinatura já foi inicializada, para não reconverter a cada medição. */
  const docNormalizadoRef = useRef<string | null>(null);

  // Posicionamento livre (drag-and-drop) da assinatura da empresa
  const [assinaturaConfig, setAssinaturaConfig] = useState<AssinaturaConfigV2 | null>(null);
  const [isPosicionandoAssinatura, setIsPosicionandoAssinatura] = useState(false);
  /** Pixels de layout por milímetro na folha renderizada; 0 enquanto não medida. */
  const [escalaPxPorMm, setEscalaPxPorMm] = useState(0);
  /** Altura da área útil da folha, em mm — define quantas páginas o documento ocupa. */
  const [alturaUtilFolhaMm, setAlturaUtilFolhaMm] = useState(0);
  /** Margens do documento; a folha, as guias de página e a impressão usam todas estas. */
  const margens = useMemo(() => margensOu(documento?.margens), [documento?.margens]);

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
          const assocs = await getAssociados(true, empresaSelecionada || 'empresa_padrao');
          setAssociados(assocs || []);
        }
        if (atendimentos.length === 0) {
          const atds = await getAtendimentos(true, empresaSelecionada || 'empresa_padrao');
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
          const rec = await getReceitas(true, empresaSelecionada || 'empresa_padrao');
          setReceitas(rec || []);
        }
        if (parcelasReceber.length === 0) {
          const parc = await getParcelasReceber(true, empresaSelecionada || 'empresa_padrao');
          setParcelasReceber(parc || []);
        }
        if (requisicoes.length === 0) {
          const reqs = await getRequisicoes(true, empresaSelecionada || 'empresa_padrao');
          setRequisicoes(reqs || []);
        }
      } catch (e) {
        console.warn('Erro ao carregar entidades para o visualizador:', e);
      }
    };

    carregarEntidades();
  }, [isOpen, empresaSelecionada]);

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
    setOrientation(documento.orientacao === 'paisagem' ? 'landscape' : 'portrait');
    // `assinaturaConfig` é inicializada no efeito de medição abaixo, que precisa
    // das dimensões reais da folha para converter o formato legado. Zerar aqui
    // não funcionaria: efeitos de layout rodam ANTES dos passivos no mesmo
    // commit, então este `set` desfaria a inicialização que acabou de acontecer.
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

  /**
   * Mede a folha renderizada na primeira medição válida de cada documento,
   * normaliza uma `assinatura_config` no formato legado (% da folha contínua)
   * para o formato atual (mm por página). A conversão só é possível aqui porque
   * depende da altura que a folha efetivamente tem na tela.
   *
   * Usa `clientWidth`/`clientHeight` (espaço de layout) e não
   * `getBoundingClientRect()` (espaço visual): o zoom da folha é um
   * `transform: scale()` num ancestral, e o arrastar também trabalha em
   * coordenadas de layout — as duas medidas precisam vir da mesma base.
   */
  useLayoutEffect(() => {
    if (!isOpen) {
      // Ao fechar, esquece o documento inicializado para que reabrir volte a ler
      // a posição salva em vez de manter a que estava em memória.
      docNormalizadoRef.current = null;
      return;
    }
    const folha = printAreaRef.current;
    const area = areaAssinaturaRef.current;
    if (!folha || !area) return;

    const medir = () => {
      const escala = pxPorMm(folha.clientWidth, orientation);
      if (!escala) return;
      setEscalaPxPorMm(escala);
      setAlturaUtilFolhaMm(area.clientHeight / escala);

      // Inicializa uma única vez por documento aberto: reconverter a cada
      // remedição arrastaria a assinatura sozinha conforme a folha crescesse.
      const docId = documento?.id ?? null;
      if (docNormalizadoRef.current !== docId) {
        docNormalizadoRef.current = docId;
        setAssinaturaConfig(
          normalizarConfig(
            documento?.assinatura_config ?? null,
            {
              larguraFolhaPx: folha.clientWidth,
              alturaFolhaPx: folha.clientHeight,
              paddingTopPx: area.offsetTop,
              paddingEsquerdaPx: area.offsetLeft,
            },
            orientation,
            margens,
          ),
        );
      }
    };

    medir();
    // A folha cresce conforme imagens do documento carregam; sem observar isso,
    // a contagem de páginas ficaria congelada na medição inicial.
    const observer = new ResizeObserver(medir);
    observer.observe(folha);
    return () => observer.disconnect();
  }, [isOpen, orientation, margens, documento?.id, documento?.assinatura_config]);

  /**
   * A orientação é uma propriedade do documento, não uma preferência de sessão:
   * antes vivia só em `useState` e voltava para retrato a cada reabertura, com a
   * coluna `orientacao` nula em todos os registros.
   */
  const handleTrocarOrientacao = (proxima: 'portrait' | 'landscape') => {
    if (proxima === orientation) return;
    setOrientation(proxima);
    if (onSaveOrientacao) onSaveOrientacao(proxima === 'landscape' ? 'paisagem' : 'retrato');
  };

  const handleIniciarPosicionamentoAssinatura = () => {
    setAssinaturaConfig((prev) => prev || configPadrao(alturaUtilFolhaMm, orientation, margens));
    setIsPosicionandoAssinatura(true);
  };

  const handleAssinaturaDragResizeStop = (
    xPx: number,
    yPx: number,
    larguraPx: number,
    alturaPx: number,
  ) => {
    const proxima = configDeArrasto(xPx, yPx, larguraPx, alturaPx, escalaPxPorMm, orientation, margens);
    if (proxima) setAssinaturaConfig(proxima);
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
      margens,
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
      const contentWidth = pageWidth - margens.left - margens.right;

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
        x: margens.left,
        y: margens.top,
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


  return {
    alturaUtilFolhaMm,
    areaAssinaturaRef,
    assinaturaConfig,
    associados,
    atendimentos,
    credenciados,
    currentEmpresa,
    docNormalizadoRef,
    empresas,
    escalaPxPorMm,
    fornecedores,
    handleAssinaturaDragResizeStop,
    handleAssociadoChange,
    handleAtendimentoChange,
    handleCredenciadoChange,
    handleDependenteChange,
    handleEmpresaChange,
    handleExportPDF,
    handleFornecedorChange,
    handleImprimir,
    handleIniciarPosicionamentoAssinatura,
    handleParcelaReceberChange,
    handlePlanoChange,
    handleReceitaChange,
    handleRemoverPosicaoPersonalizada,
    handleRequisicaoChange,
    handleResetSelections,
    handleSalvarPosicaoAssinatura,
    handleTrocarOrientacao,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    isExportingPDF,
    isPosicionandoAssinatura,
    margens,
    modulosDetectados,
    openSections,
    orientation,
    parcelasReceber,
    placeholderValues,
    planos,
    preenchidasVars,
    printAreaRef,
    receitas,
    renderedHtml,
    requisicoes,
    searchVar,
    selectedAssociadoId,
    selectedAtendimentoId,
    selectedCredenciadoId,
    selectedDependenteId,
    selectedEmpresaId,
    selectedFornecedorId,
    selectedParcelaReceberId,
    selectedPlanoId,
    selectedReceitaId,
    selectedRequisicaoId,
    setAlturaUtilFolhaMm,
    setAssinaturaConfig,
    setAssociados,
    setAtendimentos,
    setCredenciados,
    setCurrentEmpresa,
    setEmpresas,
    setEscalaPxPorMm,
    setFornecedores,
    setIsExportingPDF,
    setIsPosicionandoAssinatura,
    setOpenSections,
    setOrientation,
    setParcelasReceber,
    setPlaceholderValues,
    setPlanos,
    setReceitas,
    setRequisicoes,
    setSearchVar,
    setSelectedAssociadoId,
    setSelectedAtendimentoId,
    setSelectedCredenciadoId,
    setSelectedDependenteId,
    setSelectedEmpresaId,
    setSelectedFornecedorId,
    setSelectedParcelaReceberId,
    setSelectedPlanoId,
    setSelectedReceitaId,
    setSelectedRequisicaoId,
    setShowSidebar,
    setZoom,
    showSidebar,
    toggleSection,
    totalVars,
    variaveisDoDocumento,
    zoom,
  };
};
