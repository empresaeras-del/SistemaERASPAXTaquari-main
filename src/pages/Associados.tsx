import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import React, { useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { useSeletorPlanoPax } from "../hooks/useSeletorPlanoPax";
import { format, addMonths } from "date-fns";
import { sendWhatsAppMessage, generateBoasVindasTemplate, generateRenovacaoTemplate } from '../utils/whatsapp';
import { formatPhone } from "../utils/formatters";
import { isValidCPFOrCNPJ, maskCPFOrCNPJ } from "../utils/validators";
import { v4 as uuidv4 } from "uuid";
import { salvarReceita, ParcelaReceber, getParcelasReceber, excluirParcelaReceber, registrarRecebimento, Receita, getReceitaById } from "../services/financeiroService";
import {
  getAssociados,
  saveAssociado,
  softDeleteAssociado,
  Associado,
  Dependente,
  DocumentoAssociado,
  uploadDocumentoAssociado,
} from "../services/associadosService";
import { DependenteFormModal } from "../components/associados/DependenteFormModal";
import { BotaoSalvar } from "../components/common/BotaoSalvar";
import { AlertaAlteracoesPendentes } from "../components/common/AlertaAlteracoesPendentes";
import { usePlanosPax } from "../hooks/usePlanosPax";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { ColumnVisibilityToggle } from "../components/ColumnVisibilityToggle";
import { useFornecedores } from "../hooks/useFornecedores";
import { registrarAuditoria } from "../lib/supabase";
import { canDelete, canDeleteDependente, alertPermissionRestriction } from "../utils/permissions";
import { MessageCircle, Phone, ClipboardList, Activity, MapPin, User, FileText, CreditCard, FolderOpen, Folder, File, Plus, Search, Filter, Edit2, Trash2, X, Users, Heart, AlertCircle, ShieldCheck, CheckCircle, Clock, XCircle, DollarSign, Calendar, LayoutGrid, List , Printer, Eye, Download, UploadCloud, AlertTriangle, Image as ImageIcon, Lock, Wallet, ArrowRight, CheckCircle2 } from "lucide-react";
import { PlanoPaxSelect } from "../components/planos-pax/PlanoPaxSelect";
import { AssociadoRequisicoesTab } from "../components/associados/AssociadoRequisicoesTab";
import { AssociadoResumoFinanceiroTab } from "../components/associados/AssociadoResumoFinanceiroTab";
import { AssociadoAtendimentosTab } from "../components/associados/AssociadoAtendimentosTab";
import { AssociadoMensalidadesTab } from "../components/associados/AssociadoMensalidadesTab";
import { NovoContratoWizard } from "../components/contratos/NovoContratoWizard";
import { ContratoDocumentosGenerator } from '../components/associados/ContratoDocumentosGenerator';
import { AssociadoDetailsModal } from "../components/associados/AssociadoDetailsModal";
import { AdvancedFilterBar } from "../components/layout/AdvancedFilterBar";
import { RegrasCalculoInfo } from "../components/associados/RegrasCalculoInfo";
import { contratoSchema } from "../schemas/contratoSchema";
import { VisualizadorDocumentoModal } from "../components/associados/VisualizadorDocumentoModal";
import { downloadDocumento, isPdfDocument, isImageDocument } from "../utils/documentUtils";
import { getEmpresaById, Empresa } from '../services/empresasService';
import { getContasBancariasAtivas } from '../services/contasBancariasService';
import { ContaBancaria } from '../types/contasBancarias';
import { getLoteAbertoAtivo, registrarMovimentacao } from '../services/caixasService';
import { formatLocalDate, formatLocalDateTime } from '../utils/dateUtils';
import { RelatorioAssociadosModal } from '../components/associados/RelatorioAssociadosModal';
import { VisualizadorReciboModal, ReciboDados } from '../components/financeiro/VisualizadorReciboModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchImageWithDimensions } from '../utils/imageUtils';

const formatDateSafe = (dateStr: string | undefined) => {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return new Date(dateStr).toLocaleDateString("pt-BR");
};

export const MensalidadesTab = AssociadoMensalidadesTab;
export const AssociadosPage: React.FC = () => {
  const { state } = useAppContext();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { planosAtivos: planos, planos: planosCompletos, calcularValor } = usePlanosPax();
  const { fornecedores } = useFornecedores();

  const [associados, setAssociados] = useState<Associado[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewAssociado, setPreviewAssociado] = useState<Associado | null>(null);
  const [empresaData, setEmpresaData] = useState<Empresa | null>(null);
  const [showRelatorioModal, setShowRelatorioModal] = useState(false);
  const [relatorioReportType, setRelatorioReportType] = useState<'titulares' | 'dependentes'>('titulares');
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const { visibleColumns, isVisible, setVisibleColumns } = useColumnVisibility(['nome', 'cpf', 'plano', 'status', 'adesao', 'acoes']);
  const columns = [
    { id: 'nome', label: 'Nome' },
    { id: 'cpf', label: 'CPF' },
    { id: 'plano', label: 'Plano' },
    { id: 'status', label: 'Status' },
    { id: 'adesao', label: 'Adesão' },
    { id: 'acoes', label: 'Ações' }
  ];
  const [statusFilter, setStatusFilter] = useState("");
  const [planoFilter, setPlanoFilter] = useState("");
  const [sortBy, setSortBy] = useState("nome_asc");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = React.useMemo(() => {
    const result = associados.filter((a) => {
      if (!a) return false;
      const s = (searchTerm || '').trim().toLowerCase();
      const sDigits = s.replace(/\D/g, '');
      const nome = (a.nome || '').toLowerCase();
      const cpf = a.cpf || '';
      const cpfDigits = cpf.replace(/\D/g, '');

      const matchesSearch = !s || 
        nome.includes(s) || 
        (sDigits.length > 0 && cpfDigits.includes(sDigits)) || 
        cpf.includes(s);
      const matchesStatus = statusFilter ? a.status === statusFilter : true;
      const matchesPlano = planoFilter ? a.plano_pax_id === planoFilter : true;
      return matchesSearch && matchesStatus && matchesPlano;
    });

    switch (sortBy) {
      case 'nome_asc':
        result.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        break;
      case 'nome_desc':
        result.sort((a, b) => (b.nome || '').localeCompare(a.nome || ''));
        break;
      case 'adesao_asc':
        result.sort((a, b) => new Date(a.data_adesao || 0).getTime() - new Date(b.data_adesao || 0).getTime());
        break;
      case 'adesao_desc':
        result.sort((a, b) => new Date(b.data_adesao || 0).getTime() - new Date(a.data_adesao || 0).getTime());
        break;
    }
    return result;
  }, [associados, searchTerm, statusFilter, planoFilter, sortBy]);

  const [activeTab, setActiveTab] = useState<
    "resumo" | "principal" | "dependentes" | "contratos" | "mensalidades" | "documentos" | "requisicoes" | "atendimentos"
  >("principal");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssociado, setEditingAssociado] =
    useState<Associado | null>(null);
  const [dependenteFormModalOpen, setDependenteFormModalOpen] = useState(false);
  const [dependenteEmEdicao, setDependenteEmEdicao] = useState<Dependente | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<string | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [documentoVisualizando, setDocumentoVisualizando] = useState<DocumentoAssociado | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);
  const [isSavingAssociado, setIsSavingAssociado] = useState(false);
  const [isSavedAssociado, setIsSavedAssociado] = useState(false);
  const [initialAssociadoSnapshot, setInitialAssociadoSnapshot] = useState<string>('');

  const hasUnsavedChanges = React.useMemo(() => {
    if (!isModalOpen || !editingAssociado || !initialAssociadoSnapshot) return false;
    return JSON.stringify(editingAssociado) !== initialAssociadoSnapshot;
  }, [isModalOpen, editingAssociado, initialAssociadoSnapshot]);

  const handleWhatsAppMenu = async (associado: Associado) => {
    const opcao = window.prompt(
      `Enviar WhatsApp para ${associado.nome}\n\nDigite o número da opção:\n1 - Boas Vindas\n2 - Lembrete de Renovação\n3 - Mensagem Livre`,
      "1"
    );
    
    if (!opcao) return;
    
    let msg = "";
    if (opcao === "1") {
      msg = await generateBoasVindasTemplate(associado.nome);
    } else if (opcao === "2") {
      msg = await generateRenovacaoTemplate(associado.nome, (associado as any).plano || "");
    }
    
    const phone = associado.telefone || window.prompt(`WhatsApp de ${associado.nome} (com DDD):`, "");
    if (phone) {
        const success = sendWhatsAppMessage(phone, msg);
        if (!success) toast.error("Número de telefone inválido.");
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<"basicas" | "filiacao" | "contato" | "endereco" | "sistema">("basicas");
  const [showDependentesModal, setShowDependentesModal] = useState(false);
  const [buscaDependenteInterno, setBuscaDependenteInterno] = useState("");
  const [buscaDependentes, setBuscaDependentes] = useState("");
  const [showModificarPlanoModal, setShowModificarPlanoModal] = useState(false);
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const [modificarPlanoStep, setModificarPlanoStep] = useState<"confirmar" | "justificativa" | "selecionar">("confirmar");

  const [justificativaModificacao, setJustificativaModificacao] = useState("");
  const [novoPlanoSelecionado, setNovoPlanoSelecionado] = useState("");
  const [parcelasAbertasMap, setParcelasAbertasMap] = useState<Record<string, number>>({});



  const valorPlanoAtivo = React.useMemo(() => {
    if (!editingAssociado?.plano_pax_id) return editingAssociado?.valor_plano || 0;
    
    // Check if we should calculate
    const planoCompleto = planosCompletos.find(p => p.id === editingAssociado.plano_pax_id);
    if (!planoCompleto) return editingAssociado?.valor_plano || 0;
    
    const nVidas = 1 + (editingAssociado.dependentes?.length || 0);
    const dependentesIds = (editingAssociado.dependentes || []).map(d => {
      if (d.data_nascimento) {
        const bdate = new Date(d.data_nascimento);
        return new Date().getFullYear() - bdate.getFullYear();
      }
      return 0;
    });
    
    const result = calcularValor(planoCompleto, nVidas, dependentesIds);
    return result.total;
  }, [editingAssociado, planosCompletos, calcularValor]);

  const todosDependentes = React.useMemo(() => {
    const deps: any[] = [];
    associados.forEach(a => {
      if (a && a.dependentes && Array.isArray(a.dependentes)) {
        a.dependentes.forEach(d => {
          deps.push({
            ...d,
            titular_nome: a.nome,
            titular_status: a.status
          });
        });
      }
    });
    return deps;
  }, [associados]);

  const dependentesFiltrados = todosDependentes.filter(d => {
    if (!d) return false;
    const q = (buscaDependentes || '').toLowerCase();
    const nome = (d.nome || '').toLowerCase();
    const titular = (d.titular_nome || '').toLowerCase();
    return !q || nome.includes(q) || titular.includes(q);
  });
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [data, emp] = await Promise.all([
        getAssociados(state.isOnline, state.empresaSelecionada),
        getEmpresaById(state.empresaSelecionada || 'default_tenant', state.isOnline)
      ]);
      setAssociados(data || []);
      if (emp) setEmpresaData(emp);

      try {
        const allParcelas = await getParcelasReceber(state.isOnline, state.empresaSelecionada || 'all');
        const pMap: Record<string, number> = {};
        (data || []).forEach(a => {
          if (a && a.id) pMap[a.id] = 0;
        });

        (allParcelas || []).forEach(p => {
          if (p && (p.status === 'pendente' || p.status === 'vencido' || p.status === 'atrasado')) {
            const assoc = (data || []).find(a => 
              a && (
                (a.cpf && p.devedor_cpf_cnpj && a.cpf.replace(/\D/g, '') === (p.devedor_cpf_cnpj || '').replace(/\D/g, '')) || 
                (p.devedor_nome && a.nome && p.devedor_nome.trim().toLowerCase() === a.nome.trim().toLowerCase())
              )
            );
            if (assoc && assoc.id) {
              pMap[assoc.id] = (pMap[assoc.id] || 0) + 1;
            }
          }
        });
        setParcelasAbertasMap(pMap);
      } catch (pErr) {
        console.warn('Erro ao carregar parcelas de associados:', pErr);
      }
    } catch (e) {
      console.error('Erro ao carregar associados:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [buscandoCep, setBuscandoCep] = useState(false);

  const buscarCepViaCep = async (cepInput: string) => {
    const cepLimpo = (cepInput || '').replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      toast.error('Informe um CEP válido com 8 dígitos.');
      return;
    }

    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error('CEP não encontrado na base postal.');
      } else {
        setEditingAssociado(prev => {
          if (!prev) return prev;
          const logr = (data.logradouro || '').toUpperCase().trim();
          const bai = (data.bairro || '').toUpperCase().trim();
          const cid = (data.localidade ? `${data.localidade}${data.uf ? ' - ' + data.uf : ''}` : '').toUpperCase().trim();
          const est = (data.uf || '').toUpperCase().trim();
          const cepFormatado = cepLimpo.replace(/^(\d{5})(\d{3})/, '$1-$2');

          return {
            ...prev,
            endereco_cep: cepFormatado,
            cep: cepFormatado,
            // SÓ substitui logradouro e bairro se o ViaCEP retornou valor preenchido
            endereco_logradouro: logr || prev.endereco_logradouro || prev.logradouro || '',
            logradouro: logr || prev.endereco_logradouro || prev.logradouro || '',
            endereco_bairro: bai || prev.endereco_bairro || prev.bairro || '',
            bairro: bai || prev.endereco_bairro || prev.bairro || '',
            endereco_cidade: cid || prev.endereco_cidade || prev.cidade || '',
            cidade: cid || prev.endereco_cidade || prev.cidade || '',
            municipio: data.localidade?.toUpperCase().trim() || prev.cidade || prev.endereco_cidade || '',
            endereco_estado: est || prev.endereco_estado || prev.uf || '',
            uf: est || prev.endereco_estado || prev.uf || ''
          };
        });

        // Limpa mensagens de erro dos campos preenchidos
        setFieldErrors(prev => {
          const next = { ...prev };
          delete next.endereco_cep;
          delete next.cep;
          if (data.logradouro) {
            delete next.endereco_logradouro;
            delete next.logradouro;
          }
          if (data.bairro) {
            delete next.endereco_bairro;
            delete next.bairro;
          }
          if (data.localidade) {
            delete next.endereco_cidade;
            delete next.cidade;
          }
          return next;
        });

        toast.success('Endereço preenchido com sucesso!');
      }
    } catch (e) {
      console.warn('Erro ao consultar ViaCEP:', e);
      toast.error('Erro ao consultar CEP.');
    } finally {
      setBuscandoCep(false);
    }
  };

  const validarDadosAssociado = (assoc: Associado | null): { valido: boolean; erros: Array<{ campo: string; label: string; subTab: "basicas" | "filiacao" | "contato" | "endereco" | "sistema"; mensagem: string }> } => {
    if (!assoc) return { valido: false, erros: [] };

    const erros: Array<{ campo: string; label: string; subTab: "basicas" | "filiacao" | "contato" | "endereco" | "sistema"; mensagem: string }> = [];

    // Informações Básicas
    if (!assoc.nome || !assoc.nome.trim()) {
      erros.push({
        campo: 'nome',
        label: 'Nome Completo',
        subTab: 'basicas',
        mensagem: 'Nome completo é obrigatório.'
      });
    }

    const cpfLimpo = (assoc.cpf || '').replace(/\D/g, '');
    if (!assoc.cpf || !assoc.cpf.trim() || cpfLimpo.length === 0) {
      erros.push({
        campo: 'cpf',
        label: 'CPF',
        subTab: 'basicas',
        mensagem: 'CPF é obrigatório.'
      });
    } else if (!isValidCPFOrCNPJ(assoc.cpf, false)) {
      erros.push({
        campo: 'cpf',
        label: 'CPF',
        subTab: 'basicas',
        mensagem: 'CPF inválido.'
      });
    }

    if (!assoc.data_nascimento || !assoc.data_nascimento.trim()) {
      erros.push({
        campo: 'data_nascimento',
        label: 'Data de Nascimento',
        subTab: 'basicas',
        mensagem: 'Data de nascimento é obrigatória.'
      });
    }

    if (!assoc.sexo || !assoc.sexo.trim()) {
      erros.push({
        campo: 'sexo',
        label: 'Sexo',
        subTab: 'basicas',
        mensagem: 'Selecione o sexo.'
      });
    }

    // Contato
    const telLimpo = (assoc.telefone || '').replace(/\D/g, '');
    if (!assoc.telefone || !assoc.telefone.trim() || telLimpo.length < 10) {
      erros.push({
        campo: 'telefone',
        label: 'Telefone',
        subTab: 'contato',
        mensagem: 'Telefone com DDD é obrigatório.'
      });
    }

    // Endereço
    const cep = ((assoc.endereco_cep || assoc.cep || '') + '').trim();
    if (!cep) {
      erros.push({
        campo: 'endereco_cep',
        label: 'CEP',
        subTab: 'endereco',
        mensagem: 'CEP é obrigatório.'
      });
    }

    const logradouro = ((assoc.endereco_logradouro || assoc.logradouro || '') + '').trim();
    if (!logradouro) {
      erros.push({
        campo: 'endereco_logradouro',
        label: 'Logradouro',
        subTab: 'endereco',
        mensagem: 'Logradouro é obrigatório.'
      });
    }

    const numero = ((assoc.endereco_numero || assoc.numero || '') + '').trim();
    if (!numero) {
      erros.push({
        campo: 'endereco_numero',
        label: 'Número',
        subTab: 'endereco',
        mensagem: 'Número é obrigatório.'
      });
    }

    const bairro = ((assoc.endereco_bairro || assoc.bairro || '') + '').trim();
    if (!bairro) {
      erros.push({
        campo: 'endereco_bairro',
        label: 'Bairro',
        subTab: 'endereco',
        mensagem: 'Bairro é obrigatório.'
      });
    }

    const cidade = ((assoc.endereco_cidade || assoc.cidade || assoc.municipio || '') + '').trim();
    if (!cidade) {
      erros.push({
        campo: 'endereco_cidade',
        label: 'Município / UF',
        subTab: 'endereco',
        mensagem: 'Município / UF é obrigatório.'
      });
    }

    // Sistema
    if (!assoc.data_adesao || !assoc.data_adesao.trim()) {
      erros.push({
        campo: 'data_adesao',
        label: 'Data de Adesão',
        subTab: 'sistema',
        mensagem: 'Data de adesão é obrigatória.'
      });
    }

    return {
      valido: erros.length === 0,
      erros
    };
  };

  const executarValidacaoOuAlertar = (): boolean => {
    const { valido, erros } = validarDadosAssociado(editingAssociado);
    if (!valido) {
      const errorMap: Record<string, string> = {};
      erros.forEach(e => {
        errorMap[e.campo] = e.mensagem;
      });
      setFieldErrors(errorMap);

      const nomesCampos = erros.map(e => e.label).join(', ');
      toast.error(`Atenção: Campos obrigatórios pendentes (${erros.length}): ${nomesCampos}. Preencha os campos destacados em vermelho.`);

      if (erros[0]?.subTab) {
        setActiveSubTab(erros[0].subTab);
      }
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const handleFieldChange = (field: keyof Associado, value: any) => {
    if (editingAssociado) {
      let finalValue = (typeof value === 'string' && (field as string) !== 'email' && (field as string) !== 'senha' && (field as string) !== 'status') ? value.toUpperCase() : value;
      
      if (field === 'endereco_cep' || field === 'cep') {
        const rawCep = (value || '').replace(/\D/g, '');
        finalValue = rawCep.replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
      }

      const updated: any = {
        ...editingAssociado,
        [field]: finalValue
      };

      // Sincronização dos aliases de endereço
      if (field === 'endereco_logradouro' || field === 'logradouro') {
        updated.endereco_logradouro = finalValue;
        updated.logradouro = finalValue;
      } else if (field === 'endereco_numero' || field === 'numero') {
        updated.endereco_numero = finalValue;
        updated.numero = finalValue;
      } else if (field === 'endereco_bairro' || field === 'bairro') {
        updated.endereco_bairro = finalValue;
        updated.bairro = finalValue;
      } else if (field === 'endereco_cidade' || field === 'cidade' || (field as string) === 'municipio') {
        updated.endereco_cidade = finalValue;
        updated.cidade = finalValue;
        updated.municipio = finalValue;
      } else if (field === 'endereco_cep' || field === 'cep') {
        updated.endereco_cep = finalValue;
        updated.cep = finalValue;
      } else if (field === 'endereco_estado' || field === 'uf') {
        updated.endereco_estado = finalValue;
        updated.uf = finalValue;
      }

      setEditingAssociado(updated);

      // Limpeza de erros em tempo real
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[field as string];
        if (field === 'endereco_logradouro') delete next.logradouro;
        if (field === 'endereco_numero') delete next.numero;
        if (field === 'endereco_bairro') delete next.bairro;
        if (field === 'endereco_cidade' || (field as string) === 'municipio') {
          delete next.cidade;
          delete next.endereco_cidade;
        }
        if (field === 'endereco_cep') delete next.cep;
        return next;
      });

      // Auto-busca do CEP ao completar 8 dígitos
      if ((field === 'endereco_cep' || field === 'cep') && finalValue.replace(/\D/g, '').length === 8) {
        buscarCepViaCep(finalValue);
      }
    }
  };

  const handleOpenModal = (associado?: Associado) => {
    setDependenteEmEdicao(null);
    setDependenteFormModalOpen(false);
    setBuscaDependenteInterno("");
    setFieldErrors({});
    if (associado) {
      const cloned = { ...associado };
      setEditingAssociado(cloned);
      setInitialAssociadoSnapshot(JSON.stringify(cloned));
      setIsEditingMode(true);
    } else {
      const defaultTenant = (state.empresaSelecionada && state.empresaSelecionada !== 'all') 
        ? state.empresaSelecionada 
        : 'default_tenant';
      const novoAssoc: Associado = {
        id: uuidv4(),
        tenant_id: defaultTenant,
        nome: "",
        cpf: "",
        status: "ativo",
        data_adesao: format(new Date(), "yyyy-MM-dd"),
        dependentes: [],
      };
      setEditingAssociado(novoAssoc);
      setInitialAssociadoSnapshot(JSON.stringify(novoAssoc));
      setIsEditingMode(false);
    }
    setActiveTab("principal");
    setActiveSubTab("basicas");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAssociado(null);
    setInitialAssociadoSnapshot('');
    setDependenteEmEdicao(null);
    setDependenteFormModalOpen(false);
    setSelectedContratoId(null);
    setFieldErrors({});
    setIsSavingAssociado(false);
    setIsSavedAssociado(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Previne que submissão de formulários internos ou cliques em botões internos de abas como Mensalidades disparem o salvamento do Associado
    if (e.target !== e.currentTarget && (e.target as HTMLElement)?.id !== 'associado-form') {
      return;
    }
    if (!state.isOnline) {
      toast.error("Operação bloqueada no Modo de Visualização (Offline).");
      return;
    }
    if (!editingAssociado || !editingAssociado.id) return;
    if (!executarValidacaoOuAlertar()) return;
    setIsSavingAssociado(true);
    try {
      if (editingAssociado.cpf) {
        if (!isValidCPFOrCNPJ(editingAssociado.cpf, false)) {
          toast.error("CPF do titular inválido.");
          setIsSavingAssociado(false);
          return;
        }
        const cpfLimpo = editingAssociado.cpf.replace(/\D/g, '');
        if (cpfLimpo.length > 0) {
          const duplicateUser = associados.find(a => 
            a &&
            a.status === 'ativo' && 
            a.cpf?.replace(/\D/g, '') === cpfLimpo && 
            a.id !== editingAssociado.id
          );
          if (duplicateUser) {
            toast.error(`Não é possível registrar. Este CPF já está sendo usado pelo associado ativo: ${duplicateUser.nome}`);
            setIsSavingAssociado(false);
            return;
          }
        }
      }
      
      if (editingAssociado.dependentes && editingAssociado.dependentes.length > 0) {
        for (const dep of editingAssociado.dependentes) {
          if (dep && dep.cpf && !isValidCPFOrCNPJ(dep.cpf, false)) {
             toast.error(`CPF do dependente ${dep.nome || ''} é inválido.`);
             setIsSavingAssociado(false);
             return;
          }
        }
      }
      
      const nVidasCalculadas = 1 + (editingAssociado.dependentes?.length || 0);
      
      // Validação do contrato se o plano foi selecionado
      if (editingAssociado.plano_pax_id) {
        const contratoResult = contratoSchema.safeParse({
          plano_pax_id: editingAssociado.plano_pax_id,
          tipo_plano: planos.find(p => p.id === editingAssociado.plano_pax_id)?.tipo_plano,
          n_vidas: nVidasCalculadas
        });
        
        if (!contratoResult.success) {
          toast.error(contratoResult.error.issues[0].message);
          setIsSavingAssociado(false);
          return;
        }
      }

      const targetTenant = (state.empresaSelecionada && state.empresaSelecionada !== 'all')
        ? state.empresaSelecionada
        : (editingAssociado.tenant_id && editingAssociado.tenant_id !== 'all' && editingAssociado.tenant_id !== '')
          ? editingAssociado.tenant_id
          : 'default_tenant';

      const novoAssociado = {
        ...editingAssociado,
        n_vidas: nVidasCalculadas,
        tenant_id: targetTenant,
      } as Associado;

      if (novoAssociado.plano_pax_id) {
        const plano = planos.find(p => p.id === novoAssociado.plano_pax_id);
        if (plano) {
          novoAssociado.plano_nome = plano.nome;
        }
        
        const planoCompleto = planosCompletos.find(p => p.id === novoAssociado.plano_pax_id);
        if (planoCompleto) {
          const dependentesIds = (novoAssociado.dependentes || []).map(d => {
            if (d && d.data_nascimento) {
              const bdate = new Date(d.data_nascimento);
              const age = new Date().getFullYear() - bdate.getFullYear();
              return age;
            }
            return 0;
          });
          const resultado = calcularValor(planoCompleto, nVidasCalculadas, dependentesIds);
          novoAssociado.valor_plano = resultado.total;
        }
      }
      
      if ((novoAssociado as any).justificativa_modificacao_plano) {
        const original = associados.find(a => a.id === novoAssociado.id);
        
        if (original && original.plano_pax_id && original.plano_pax_id !== novoAssociado.plano_pax_id) {
            const hist = novoAssociado.historico_contratos ? [...novoAssociado.historico_contratos] : [];
            hist.push({
                id: uuidv4(),
                plano: original.plano_nome || "Anterior",
                valor: original.valor_plano || 0,
                data_inicio: original.data_adesao,
                data_fim: format(new Date(), "yyyy-MM-dd")
            });
            novoAssociado.historico_contratos = hist;
            novoAssociado.data_adesao = format(new Date(), "yyyy-MM-dd");
        }

        const originalPlano = original?.plano_nome || "Nenhum";
        
        await registrarAuditoria('Atualizar Plano', {
          modulo: 'Associados',
          descricao: `Plano do associado ${novoAssociado.nome} modificado de ${originalPlano} para ${novoAssociado.plano_nome}. Justificativa: ${(novoAssociado as any).justificativa_modificacao_plano}`,
          usuario_id: state.user?.id || 'sistema',
          tenant_id: targetTenant,
          dados_novos: { 
            plano_anterior: originalPlano,
            novo_plano: novoAssociado.plano_nome,
            justificativa: (novoAssociado as any).justificativa_modificacao_plano 
          }
        });
      }
      
      await saveAssociado(novoAssociado, state.isOnline);
      setIsSavedAssociado(true);
      await loadData();
      toast.success("Associado salvo com sucesso!");
      setTimeout(() => {
        handleCloseModal();
      }, 400);
    } catch (error) {
      console.error("Erro ao salvar associado", error);
      toast.error("Erro ao salvar associado.");
    } finally {
      setIsSavingAssociado(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!canDelete(state.user, state.isOnline)) {
      toast.error(
        !state.isOnline
          ? "Exclusão bloqueada no Modo de Visualização (Offline)."
          : "Permissão negada. Somente usuários Administradores podem excluir registros no sistema."
      );
      return;
    }

    confirm({
      title: "Excluir Associado",
      message:
        "Tem certeza que deseja excluir este associado? Esta ação moverá o registro para a lixeira.",
      danger: true,
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await softDeleteAssociado(id, state.isOnline);
          setAssociados((current) => current.filter((a) => a.id !== id));
          toast.success("Associado excluído com sucesso!");
        } catch (error) {
          console.error("Erro ao excluir", error);
          toast.error(
            "Erro ao excluir associado.",
          );
        }
      },
    });
  };

  const handleExcluirDependente = (dep: Dependente, index?: number) => {
    if (!canDeleteDependente(state.user, state.isOnline)) {
      if (state.user?.nivel === 'funcionario') {
        alertPermissionRestriction('Associados', 'excluir dependentes vinculados ao plano');
      } else {
        toast.error("Exclusão bloqueada no Modo de Visualização (Offline).");
      }
      return;
    }

    confirm({
      title: "Excluir Dependente",
      message: `Deseja realmente remover o dependente "${dep.nome || 'selecionado'}" deste associado? Isso atualizará a contagem de vidas do plano.`,
      confirmText: "Sim, Excluir",
      cancelText: "Cancelar",
      danger: true,
      onConfirm: () => {
        setEditingAssociado((prev) => {
          if (!prev) return null;
          const novosDeps = (prev.dependentes || []).filter(
            (d, idx) => (dep.id && d.id ? d.id !== dep.id : (d.nome !== dep.nome || (index !== undefined && idx !== index)))
          );
          return {
            ...prev,
            dependentes: novosDeps,
          };
        });
        setDependenteFormModalOpen(false);
        setDependenteEmEdicao(null);
        toast.success("Dependente removido com sucesso.");
      },
    });
  };

  const handleExportPDF = () => {
    setRelatorioReportType('titulares');
    setShowRelatorioModal(true);
  };

  const handleExportDependentesPDF = () => {
    setRelatorioReportType('dependentes');
    setShowRelatorioModal(true);
  };

  const totalTitulares = associados.length;
  const totalDependentes = associados.reduce((acc, a) => acc + (a.dependentes?.length || 0), 0);
  const vidasProtegidas = totalTitulares + totalDependentes;
  const inadimplentes = associados.filter((a) => a.status === "inadimplente").length;
  const qtdAssociadosAtivosSemParcelas = associados.filter((a) => a.status === 'ativo' && (parcelasAbertasMap[a.id] || 0) === 0).length;

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-subtle mb-1">
            <span>Administração</span>
            <span className="w-1 h-1 rounded-full bg-border-default"></span>
            <span>Associados</span>
          </div>
          <h1 className="text-2xl font-bold text-text-base flex items-center gap-2">
            <Users className="w-6 h-6 text-[#3B82F6]" />
            Gestão de Associados
          </h1>
          <p className="text-sm text-text-subtle mt-1">
            Gerenciamento de titulares e dependentes.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-bg-surface border border-border-default text-text-subtle text-sm font-semibold rounded-xl hover:text-text-base hover:bg-bg-hover transition-colors"
            title="Gerar relatório em PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Gerar Relatório</span>
          </button>
          <button
            disabled={!state.isOnline}
            onClick={() => handleOpenModal()}
            title={!state.isOnline ? "Inclusão bloqueada no Modo Offline" : "Novo Associado"}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(59,130,246,0.25)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Associado
          </button>
        </div>
      </div>

      {true && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
            <div className="p-3 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-subtle">Titulares</p>
              <p className="text-xl font-extrabold text-text-base mt-0.5">{totalTitulares}</p>
            </div>
          </div>
          
          <div 
            onClick={() => setShowDependentesModal(true)}
            className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4 cursor-pointer hover:border-[#8B5CF6]/50 transition-colors"
          >
            <div className="p-3 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-2xl border border-[#8B5CF6]/20 shrink-0">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-subtle">Dependentes</p>
              <p className="text-xl font-extrabold text-[#8B5CF6] mt-0.5">{totalDependentes}</p>
            </div>
          </div>

          <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-subtle">Vidas Protegidas</p>
              <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{vidasProtegidas}</p>
            </div>
          </div>

          <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-subtle">Inadimplentes</p>
              <p className="text-xl font-extrabold text-rose-400 mt-0.5">{inadimplentes}</p>
            </div>
          </div>
        </div>
      )}

      {qtdAssociadosAtivosSemParcelas > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3 mt-4 mb-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-500">Atenção: Associados sem mensalidades geradas</p>
            <p className="text-sm text-amber-500/80 mt-1">Existem {qtdAssociadosAtivosSemParcelas} associado(s) ativo(s) sem nenhuma parcela ou faturamento gerado em aberto no financeiro. Verifique e gere os faturamentos para evitar perda de receitas.</p>
          </div>
        </div>
      )}

      <div className="flex gap-6 flex-1 min-h-0">
      <div className={`bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col ${'flex'}`}>
        
        <div className="p-4 border-b border-border-default bg-bg-surface/50 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1 w-full min-w-0">
          <AdvancedFilterBar
            pageKey="associados"
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            currentFilters={{ searchTerm, statusFilter, planoFilter, sortBy }}
            onApplyFilters={(filters) => {
              setSearchTerm(filters.searchTerm || '');
              setStatusFilter(filters.statusFilter || '');
              setPlanoFilter(filters.planoFilter || '');
              setSortBy(filters.sortBy || 'nome_asc');
            }}
            onClearFilters={() => {
              setSearchTerm('');
              setStatusFilter('');
              setPlanoFilter('');
              setSortBy('nome_asc');
            }}
          >
            <>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[11px] font-bold text-text-subtle uppercase tracking-wider">Busca Rápida</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <input
                    type="text"
                    placeholder="Nome ou CPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-sm text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[11px] font-bold text-text-subtle uppercase tracking-wider">Status</label>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-sm text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Todos os Status</option>
                    <option value="ativo">Ativos</option>
                    <option value="inativo">Encerrados</option>
                    <option value="inadimplente">Inadimplentes</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-subtle">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[11px] font-bold text-text-subtle uppercase tracking-wider">Plano PAX</label>
                <div className="[&>div]:mt-0 [&>div>button]:py-2.5 [&>div>button]:h-auto [&>div>button]:rounded-xl [&>div>button]:border-border-default [&>div>button]:bg-bg-surface h-full">
                  <PlanoPaxSelect
                    value={planoFilter}
                    onChange={setPlanoFilter}
                  />
                </div>
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[11px] font-bold text-text-subtle uppercase tracking-wider">Ordenação</label>
                <div className="relative">
                  <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-bg-surface border border-border-default rounded-xl text-sm text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all appearance-none cursor-pointer"
                  >
                    <option value="nome_asc">Nome (A-Z)</option>
                    <option value="nome_desc">Nome (Z-A)</option>
                    <option value="adesao_desc">Adesão (Mais Recente)</option>
                    <option value="adesao_asc">Adesão (Mais Antigo)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-subtle">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
            </>
          </AdvancedFilterBar>
          </div>
          <div className="flex items-center bg-bg-subtle border border-border-default p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#3B82F6] text-white' : 'text-text-subtle hover:text-text-base'}`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-[#3B82F6] text-white' : 'text-text-subtle hover:text-text-base'}`}
              title="Visualização em Tabela"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
                <div className="overflow-x-auto flex-1 p-4">
          {loading ? (
            <div className="py-20 text-center text-text-subtle flex flex-col items-center">
              <div className="w-8 h-8 border-3 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium">Carregando associados...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center bg-bg-surface border border-border-default rounded-3xl p-8 space-y-3">
              <Users className="w-12 h-12 text-text-subtle mx-auto opacity-50" />
              <h3 className="text-base font-bold text-text-base">Nenhum associado encontrado</h3>
              <p className="text-xs text-text-subtle max-w-md mx-auto">
                Não encontramos nenhum associado com os filtros aplicados.
              </p>
            </div>
          ) : viewMode === 'table' ? (
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-bg-surface/30 border-b border-border-default">
                <tr>
                  {isVisible('nome') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Nome</th>}
                  {isVisible('cpf') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">CPF</th>}
                  {isVisible('plano') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Plano</th>}
                  {isVisible('status') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Status</th>}
                  {isVisible('adesao') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Adesão</th>}
                  {isVisible('acoes') && <th className="px-6 py-3 text-right text-xs font-semibold text-text-subtle uppercase tracking-wider">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#475569]">
                {filtered.map((associado) => (
                  <tr
                    key={associado.id}
                    className="hover:bg-bg-surface/30 transition-colors cursor-pointer"
                    onClick={() => setPreviewAssociado(associado)}
                  >
                    {isVisible('nome') && <td className="px-6 py-4 font-medium text-text-base">
                      {associado.nome}
                    </td>}
                    {isVisible('cpf') && <td className="px-6 py-4">{associado.cpf}</td>}
                    {isVisible('plano') && <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="capitalize">{associado.plano_pax_id ? planos.find(p => p.id === associado.plano_pax_id)?.nome || associado.plano_nome : associado.plano_nome || "Sem Plano"}</span>
                        {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] === 0 && (
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20" title="Contrato ativo, mas sem parcelas geradas">
                            SEM MENSALIDADES
                          </span>
                        )}
                        {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] > 0 && parcelasAbertasMap[associado.id] <= 2 && (
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Restam apenas 1 ou 2 mensalidades em aberto">
                            RESTAM {parcelasAbertasMap[associado.id]} MENSALIDADE{parcelasAbertasMap[associado.id] > 1 ? 'S' : ''}
                          </span>
                        )}
                      </div>
                    </td>}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                          associado.status === "ativo"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : associado.status === "inadimplente"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        }`}
                      >
                        {associado.status === 'inativo' ? 'encerrado' : associado.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {formatDateSafe(associado.data_adesao)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleWhatsAppMenu(associado); }}
                          className="p-1 text-emerald-500/70 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="WhatsApp Automático"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenModal(associado); }}
                          className="p-1 text-text-subtle hover:text-text-base hover:bg-white/5 rounded-lg transition-colors"
                          title="Editar Associado"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          disabled={!state.isOnline}
                          onClick={(e) => { e.stopPropagation(); handleDelete(associado.id); }}
                          className="p-1 text-text-subtle hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Excluir Associado"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 ${"xl:grid-cols-3 2xl:grid-cols-4"} gap-4`}>
              {filtered.map((associado) => (
                <div 
                  key={associado.id} 
                  className="bg-bg-surface border border-border-default rounded-2xl p-5 hover:border-[#3B82F6]/50 transition-all flex flex-col h-full shadow-sm cursor-pointer"
                  onClick={() => setPreviewAssociado(associado)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-text-base line-clamp-1">{associado.nome}</h3>
                      <p className="text-xs text-text-subtle mt-0.5">CPF: {associado.cpf}</p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
                        associado.status === "ativo"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : associado.status === "inadimplente"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      }`}
                    >
                      {associado.status === 'inativo' ? 'encerrado' : associado.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] === 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20" title="Contrato ativo, mas sem parcelas geradas">
                        SEM MENSALIDADES
                      </span>
                    )}
                    {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] > 0 && parcelasAbertasMap[associado.id] <= 2 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Restam apenas 1 ou 2 mensalidades em aberto">
                        RESTAM {parcelasAbertasMap[associado.id]} MENSALIDADE{parcelasAbertasMap[associado.id] > 1 ? 'S' : ''}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 mb-4 flex-1">
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="truncate">
                        {associado.plano_pax_id ? planos.find(p => p.id === associado.plano_pax_id)?.nome || associado.plano_nome : associado.plano_nome || "Sem Plano"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <Calendar className="w-4 h-4 text-[#3B82F6]" />
                      <span>Adesão: {formatDateSafe(associado.data_adesao)}</span>
                    </div>
                    {associado.dependentes && associado.dependentes.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Users className="w-4 h-4 text-[#8B5CF6]" />
                        <span>{associado.dependentes.length} {associado.dependentes.length === 1 ? 'dependente' : 'dependentes'}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t border-border-default flex items-center justify-between mt-auto">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewAssociado(associado); }}
                      className="text-xs font-medium text-[#3B82F6] hover:text-[#60A5FA] flex items-center gap-1 transition-colors"
                    >
                      Ver Detalhes
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleWhatsAppMenu(associado); }}
                        className="p-1.5 text-emerald-500/70 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="WhatsApp Automático"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(associado); }}
                        className="p-1.5 text-text-subtle hover:text-text-base hover:bg-white/5 rounded-lg transition-colors"
                        title="Editar Associado"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        disabled={!state.isOnline}
                        onClick={(e) => { e.stopPropagation(); handleDelete(associado.id); }}
                        className="p-1.5 text-text-subtle hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Excluir Associado"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      </div>

      {previewAssociado && (
        <AssociadoDetailsModal
          associado={previewAssociado}
          onClose={() => setPreviewAssociado(null)}
          onEdit={(associado) => {
            setPreviewAssociado(null);
            handleOpenModal(associado);
          }}
        />
      )}

      {isModalOpen && editingAssociado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4">
          <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-6xl 2xl:max-w-[1400px] max-h-[90vh] flex flex-col border border-border-default overflow-hidden">
            <div className="px-6 py-4 border-b border-border-default flex items-center justify-between shrink-0 bg-bg-surface/50">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-text-base tracking-tight">
                  {editingAssociado.nome ? "Editar Associado" : "Novo Associado"}
                </h3>
                {hasUnsavedChanges && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    Alterações pendentes
                  </span>
                )}
              </div>
              <button
                onClick={handleCloseModal}
                className="text-text-subtle hover:text-text-base transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {hasUnsavedChanges && (
              <div className="px-6 pt-3 shrink-0">
                <AlertaAlteracoesPendentes
                  visivel={hasUnsavedChanges}
                  formId="associado-form"
                  salvando={isSavingAssociado}
                  posicao="compact"
                  mensagem="Existem alterações realizadas no cadastro deste associado que necessitam de salvamento para devido registro no banco de dados."
                />
              </div>
            )}
            <div
              className={`flex flex-1 overflow-hidden ${isEditingMode ? "flex-row" : "flex-col"}`}
            >
              {isEditingMode ? (
                <div className="w-64 border-r border-border-default bg-bg-surface/30 flex flex-col py-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (!executarValidacaoOuAlertar()) return;
                      setActiveTab("resumo");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "resumo"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    Resumo Financeiro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!executarValidacaoOuAlertar()) return;
                      setActiveTab("principal");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "principal"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Dados Principais
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!executarValidacaoOuAlertar()) return;
                      setActiveTab("dependentes");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "dependentes"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Dependentes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!executarValidacaoOuAlertar()) return;
                      setActiveTab("contratos");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "contratos"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Contratos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!executarValidacaoOuAlertar()) return;
                      setActiveTab("mensalidades");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "mensalidades"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    Mensalidades
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!executarValidacaoOuAlertar()) return;
                      setActiveTab("documentos");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "documentos"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    Documentos
                  </button>
                  {isEditingMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (!executarValidacaoOuAlertar()) return;
                          setActiveTab("requisicoes");
                        }}
                        className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                          activeTab === "requisicoes"
                            ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                            : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                        }`}
                      >
                        <ClipboardList className="w-4 h-4" />
                        Requisições
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!executarValidacaoOuAlertar()) return;
                          setActiveTab("atendimentos");
                        }}
                        className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                          activeTab === "atendimentos"
                            ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                            : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                        }`}
                      >
                        <Activity className="w-4 h-4" />
                        Atendimentos
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="px-8 py-5 border-b border-border-default bg-bg-surface/30">
                  <div className="flex items-center justify-between max-w-2xl mx-auto">
                    {/* Step 1 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "principal" || activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "principal" || activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        1
                      </div>
                      <span className="text-xs font-medium">Dados Básicos</span>
                    </div>

                    <div
                      className={`w-16 h-0.5 mx-2 ${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
                    ></div>

                    {/* Step 2 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        2
                      </div>
                      <span className="text-xs font-medium">Dependentes</span>
                    </div>

                    <div
                      className={`w-16 h-0.5 mx-2 ${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
                    ></div>

                    {/* Step 3 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        3
                      </div>
                      <span className="text-xs font-medium">Contrato</span>
                    </div>

                    <div
                      className={`w-16 h-0.5 mx-2 ${activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
                    ></div>

                    {/* Step 4 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        4
                      </div>
                      <span className="text-xs font-medium">Mensalidades</span>
                    </div>

                    <div
                      className={`w-16 h-0.5 mx-2 ${activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
                    ></div>

                    {/* Step 5 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        5
                      </div>
                      <span className="text-xs font-medium">Documentos</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Content */}
              <form
                id="associado-form"
                noValidate
                onSubmit={handleSave}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  {activeTab === "resumo" ? (
                    <AssociadoResumoFinanceiroTab associado={editingAssociado} />
                  ) : activeTab === "principal" ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-full">
                      {/* Sub-tabs para Dados Principais (Fichários) */}
                      <div className="flex overflow-x-auto gap-2 pb-4 mb-4 border-b border-border-default/50 custom-scrollbar shrink-0">
                        {(() => {
                          const { erros } = validarDadosAssociado(editingAssociado);
                          const errBasicas = erros.filter(e => e.subTab === "basicas").length;
                          const errContato = erros.filter(e => e.subTab === "contato").length;
                          const errEndereco = erros.filter(e => e.subTab === "endereco").length;
                          const errSistema = erros.filter(e => e.subTab === "sistema").length;

                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => setActiveSubTab("basicas")}
                                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "basicas" ? "bg-[#3B82F6]/10 text-[#3B82F6]" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                              >
                                <span>Informações Básicas</span>
                                {Object.keys(fieldErrors).length > 0 && errBasicas > 0 && (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                                    {errBasicas}
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveSubTab("filiacao")}
                                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "filiacao" ? "bg-indigo-500/10 text-indigo-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                              >
                                <span>Filiação</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveSubTab("contato")}
                                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "contato" ? "bg-emerald-500/10 text-emerald-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                              >
                                <span>Contato</span>
                                {Object.keys(fieldErrors).length > 0 && errContato > 0 && (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                                    {errContato}
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveSubTab("endereco")}
                                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "endereco" ? "bg-amber-500/10 text-amber-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                              >
                                <span>Endereço</span>
                                {Object.keys(fieldErrors).length > 0 && errEndereco > 0 && (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                                    {errEndereco}
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveSubTab("sistema")}
                                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "sistema" ? "bg-purple-500/10 text-purple-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                              >
                                <span>Informações do Sistema</span>
                                {Object.keys(fieldErrors).length > 0 && errSistema > 0 && (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                                    {errSistema}
                                  </span>
                                )}
                              </button>
                            </>
                          );
                        })()}
                      </div>

                      <div className="space-y-8">
                      {/* Section: Informações Básicas */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "basicas" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-[#3B82F6]/10 rounded-xl text-[#3B82F6]">
                            <User className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Informações Básicas
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Nome Completo *
                            </label>
                            <input
                              type="text"
                              value={editingAssociado.nome || ""}
                              onChange={(e) => handleFieldChange("nome", e.target.value)}
                              placeholder="Digite o nome completo"
                              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                                fieldErrors.nome
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {fieldErrors.nome && (
                              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.nome}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              CPF *
                            </label>
                            <input
                              type="text"
                              maxLength={14}
                              placeholder="000.000.000-00"
                              value={editingAssociado.cpf || ""}
                              onChange={(e) => {
                                const formatted = maskCPFOrCNPJ(e.target.value, false);
                                handleFieldChange("cpf", formatted);
                                const cpfLimpo = formatted.replace(/\D/g, '');
                                if (cpfLimpo.length === 11) {
                                  const duplicateUser = associados.find(a => a.status === 'ativo' && a.cpf?.replace(/\D/g, '') === cpfLimpo && a.id !== editingAssociado.id);
                                  if (duplicateUser) {
                                    toast.error(`ATENÇÃO: CPF já cadastrado no associado ativo: ${duplicateUser.nome}`);
                                  }
                                }
                              }}
                              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                                fieldErrors.cpf
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {fieldErrors.cpf && (
                              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.cpf}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              RG
                            </label>
                            <input
                              type="text"
                              value={editingAssociado.rg || ""}
                              onChange={(e) => handleFieldChange("rg", e.target.value)}
                              placeholder="Número do RG"
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Data de Nascimento *
                            </label>
                            <input
                              type="date"
                              value={editingAssociado.data_nascimento || ""}
                              onChange={(e) => handleFieldChange("data_nascimento", e.target.value)}
                              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                                fieldErrors.data_nascimento
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {fieldErrors.data_nascimento && (
                              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.data_nascimento}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Sexo *
                            </label>
                            <select
                              value={editingAssociado.sexo || ""}
                              onChange={(e) => handleFieldChange("sexo", e.target.value)}
                              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                                fieldErrors.sexo
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            >
                              <option value="">Selecione</option>
                              <option value="M">Masculino</option>
                              <option value="F">Feminino</option>
                              <option value="O">Outro</option>
                            </select>
                            {fieldErrors.sexo && (
                              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.sexo}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section: Filiação */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "filiacao" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                            <Users className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Filiação
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Nome da Mãe
                            </label>
                            <input
                              type="text"
                              value={editingAssociado.nome_mae || ""}
                              onChange={(e) => handleFieldChange("nome_mae", e.target.value)}
                              placeholder="Nome da mãe"
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Nome do Pai
                            </label>
                            <input
                              type="text"
                              value={editingAssociado.nome_pai || ""}
                              onChange={(e) => handleFieldChange("nome_pai", e.target.value)}
                              placeholder="Nome do pai"
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Contato */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "contato" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                            <Phone className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Contato
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Telefone *
                            </label>
                            <input
                              type="tel"
                              maxLength={15}
                              placeholder="(00) 00000-0000"
                              value={editingAssociado.telefone || ""}
                              onChange={(e) => {
                                const formatted = formatPhone(e.target.value);
                                handleFieldChange("telefone", formatted);
                              }}
                              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                                fieldErrors.telefone
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {fieldErrors.telefone && (
                              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.telefone}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              E-mail
                            </label>
                            <input
                              type="email"
                              value={editingAssociado.email || ""}
                              onChange={(e) => handleFieldChange("email", e.target.value)}
                              placeholder="exemplo@email.com"
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Endereço */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "endereco" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center justify-between border-b border-border-default/50 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                              <MapPin className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-text-base tracking-tight">
                                Endereço Residencial
                              </h4>
                              <p className="text-xs text-text-subtle">Digite o CEP para buscar automaticamente ou preencha os campos abaixo</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                          {/* CEP */}
                          <div className="space-y-1 md:col-span-3">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                              CEP *
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                maxLength={9}
                                placeholder="00000-000"
                                value={editingAssociado.endereco_cep || editingAssociado.cep || ""}
                                onChange={(e) => handleFieldChange("endereco_cep", e.target.value)}
                                className={`w-full px-3.5 py-2.5 pr-10 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                                  fieldErrors.endereco_cep || fieldErrors.cep
                                    ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                    : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                                }`}
                              />
                              <button
                                type="button"
                                disabled={buscandoCep}
                                onClick={() => buscarCepViaCep(editingAssociado.endereco_cep || editingAssociado.cep || "")}
                                title="Buscar endereço pelo CEP"
                                className="absolute right-2 p-1.5 text-text-subtle hover:text-[#3B82F6] hover:bg-bg-hover rounded-lg transition-colors disabled:opacity-50"
                              >
                                {buscandoCep ? (
                                  <div className="w-4 h-4 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Search className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                            {(fieldErrors.endereco_cep || fieldErrors.cep) && (
                              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.endereco_cep || fieldErrors.cep}
                              </p>
                            )}
                          </div>

                          {/* Logradouro */}
                          <div className="space-y-1 md:col-span-6">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Logradouro *
                            </label>
                            <input
                              type="text"
                              placeholder="Rua, Avenida, Alameda, Travessa..."
                              value={editingAssociado.endereco_logradouro || editingAssociado.logradouro || ""}
                              onChange={(e) => handleFieldChange("endereco_logradouro", e.target.value)}
                              className={`w-full px-3.5 py-2.5 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                                fieldErrors.endereco_logradouro || fieldErrors.logradouro
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {(fieldErrors.endereco_logradouro || fieldErrors.logradouro) && (
                              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.endereco_logradouro || fieldErrors.logradouro}
                              </p>
                            )}
                          </div>

                          {/* Número */}
                          <div className="space-y-1 md:col-span-3">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Número *
                            </label>
                            <input
                              type="text"
                              placeholder="Nº ou S/N"
                              value={editingAssociado.endereco_numero || editingAssociado.numero || ""}
                              onChange={(e) => handleFieldChange("endereco_numero", e.target.value)}
                              className={`w-full px-3.5 py-2.5 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                                fieldErrors.endereco_numero || fieldErrors.numero
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {(fieldErrors.endereco_numero || fieldErrors.numero) && (
                              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.endereco_numero || fieldErrors.numero}
                              </p>
                            )}
                          </div>

                          {/* Bairro */}
                          <div className="space-y-1 md:col-span-6">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Bairro *
                            </label>
                            <input
                              type="text"
                              placeholder="Nome do bairro"
                              value={editingAssociado.endereco_bairro || editingAssociado.bairro || ""}
                              onChange={(e) => handleFieldChange("endereco_bairro", e.target.value)}
                              className={`w-full px-3.5 py-2.5 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                                fieldErrors.endereco_bairro || fieldErrors.bairro
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {(fieldErrors.endereco_bairro || fieldErrors.bairro) && (
                              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.endereco_bairro || fieldErrors.bairro}
                              </p>
                            )}
                          </div>

                          {/* Cidade / UF / Município */}
                          <div className="space-y-1 md:col-span-6">
                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Município / UF *
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: Coxim - MS ou Taquari"
                              value={editingAssociado.endereco_cidade || editingAssociado.cidade || editingAssociado.municipio || ""}
                              onChange={(e) => handleFieldChange("endereco_cidade", e.target.value)}
                              className={`w-full px-3.5 py-2.5 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                                fieldErrors.endereco_cidade || fieldErrors.cidade
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {(fieldErrors.endereco_cidade || fieldErrors.cidade) && (
                              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.endereco_cidade || fieldErrors.cidade}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section: Sistema */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "sistema" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Informações do Sistema
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Data de Adesão *
                            </label>
                            <input
                              type="date"
                              value={editingAssociado.data_adesao || ""}
                              onChange={(e) => handleFieldChange("data_adesao", e.target.value)}
                              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                                fieldErrors.data_adesao
                                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                              }`}
                            />
                            {fieldErrors.data_adesao && (
                              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fieldErrors.data_adesao}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Status *
                            </label>
                            <select
                              value={editingAssociado.status || "ativo"}
                              onChange={(e) => handleFieldChange("status", e.target.value as Associado["status"])}
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            >
                              <option value="ativo">Ativo</option>
                              <option value="inadimplente">Inadimplente</option>
                              <option value="inativo">Inativo</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      </div>
                    </div>
                  ) : activeTab === "dependentes" ? (
                    <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-200">
                      {/* Top Bar with Title, Total Vidas and Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bg-surface p-4 sm:p-5 rounded-2xl border border-border-default shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#3B82F6] flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base sm:text-lg font-bold text-text-base leading-tight">
                                Dependentes do Associado
                              </h4>
                              <span className="px-2.5 py-0.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded-full text-xs font-bold border border-[#3B82F6]/20">
                                {editingAssociado.dependentes?.length || 0} cadastrado(s)
                              </span>
                            </div>
                            <p className="text-xs text-text-subtle mt-0.5">
                              Contrato PAX: <strong className="text-text-base">{1 + (editingAssociado.dependentes?.length || 0)} vidas</strong> (1 Titular + {editingAssociado.dependentes?.length || 0} Dependentes)
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="relative flex-1 sm:w-64">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                              type="text"
                              placeholder="Buscar por nome, CPF..."
                              value={buscaDependenteInterno}
                              onChange={(e) => setBuscaDependenteInterno(e.target.value)}
                              className="w-full bg-bg-subtle border border-border-default rounded-xl pl-9 pr-8 py-2 text-text-base focus:outline-none focus:border-[#3B82F6] text-xs transition-colors"
                            />
                            {buscaDependenteInterno && (
                              <button
                                type="button"
                                onClick={() => setBuscaDependenteInterno("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setDependenteEmEdicao(null);
                              setDependenteFormModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 shrink-0 active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                            Novo Dependente
                          </button>
                        </div>
                      </div>

                      {/* Lista de Cards de Dependentes ou Empty State */}
                      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                        {!editingAssociado.dependentes || editingAssociado.dependentes.length === 0 ? (
                          <div className="text-center py-16 px-4 bg-bg-subtle border border-dashed border-border-default rounded-3xl flex flex-col items-center justify-center">
                            <div className="w-16 h-16 rounded-3xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center mb-4 border border-[#3B82F6]/20">
                              <Users className="w-8 h-8 opacity-80" />
                            </div>
                            <h5 className="text-base font-bold text-text-base mb-1">Nenhum dependente cadastrado</h5>
                            <p className="text-text-subtle text-xs max-w-sm mb-6">
                              Este associado ainda não possui dependentes vinculados ao seu plano PAX. Cadastre um novo dependente através do formulário individual e independente.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setDependenteEmEdicao(null);
                                setDependenteFormModalOpen(true);
                              }}
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                            >
                              <Plus className="w-4 h-4" />
                              Cadastrar Primeiro Dependente
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {editingAssociado.dependentes
                              .filter((dep) => {
                                if (!buscaDependenteInterno) return true;
                                const s = buscaDependenteInterno.toLowerCase();
                                const sDigits = s.replace(/\D/g, "");
                                return (
                                  dep.nome.toLowerCase().includes(s) ||
                                  (dep.parentesco && dep.parentesco.toLowerCase().includes(s)) ||
                                  (dep.cpf && dep.cpf.replace(/\D/g, "").includes(sDigits))
                                );
                              })
                              .map((dep, index) => {
                                const initials = (dep.nome || "D")
                                  .split(" ")
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((p) => p[0])
                                  .join("")
                                  .toUpperCase();

                                return (
                                  <div
                                    key={dep.id || index}
                                    className="p-5 bg-bg-surface border border-border-default rounded-2xl relative group hover:border-[#3B82F6]/60 transition-all hover:shadow-lg flex flex-col justify-between"
                                  >
                                    <div className="space-y-3">
                                      {/* Header do Card */}
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
                                            {initials}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-sm font-bold text-text-base truncate" title={dep.nome}>
                                              {dep.nome || "Sem Nome"}
                                            </p>
                                            <span className="inline-block mt-0.5 px-2 py-0.5 bg-blue-500/10 text-[#3B82F6] border border-blue-500/20 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                              {dep.parentesco || "Dependente"}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setDependenteEmEdicao(dep);
                                              setDependenteFormModalOpen(true);
                                            }}
                                            className="p-1.5 text-text-muted hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors"
                                            title="Editar Dependente"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleExcluirDependente(dep, index)}
                                            className={`p-1.5 rounded-lg transition-colors ${
                                              state.user?.nivel === 'funcionario'
                                                ? 'text-text-muted hover:text-amber-400 hover:bg-amber-400/10'
                                                : 'text-text-muted hover:text-rose-500 hover:bg-rose-500/10'
                                            }`}
                                            title={state.user?.nivel === 'funcionario' ? "Exclusão restrita (Nível Funcionário)" : "Excluir Dependente"}
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Informações detalhadas do dependente (Campos da tabela Supabase) */}
                                      <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-border-default/50 text-xs text-text-subtle">
                                        <div className="flex items-center justify-between">
                                          <span className="text-text-muted">CPF:</span>
                                          <span className="font-medium text-text-base">
                                            {dep.cpf ? maskCPFOrCNPJ(dep.cpf, false) : "Não informado"}
                                          </span>
                                        </div>
                                        {dep.data_nascimento && (
                                          <div className="flex items-center justify-between">
                                            <span className="text-text-muted">Nascimento:</span>
                                            <span className="font-medium text-text-base flex items-center gap-1.5">
                                              {formatDateSafe(dep.data_nascimento)}
                                              {(() => {
                                                try {
                                                  const d = new Date(dep.data_nascimento);
                                                  if (!isNaN(d.getTime())) {
                                                    const age = new Date().getFullYear() - d.getFullYear();
                                                    return age >= 0 ? (
                                                      <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                        {age}a
                                                      </span>
                                                    ) : null;
                                                  }
                                                } catch {}
                                                return null;
                                              })()}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Botão de Edição Rápida */}
                                    <div className="mt-3 pt-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDependenteEmEdicao(dep);
                                          setDependenteFormModalOpen(true);
                                        }}
                                        className="w-full py-1.5 px-3 bg-bg-subtle hover:bg-bg-hover border border-border-default rounded-xl text-xs font-semibold text-text-muted hover:text-text-base transition-colors flex items-center justify-center gap-1.5"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Editar / Gerenciar Dependente
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : activeTab === "contratos" ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-border-default pb-4">
                        <h4 className="text-text-base font-medium">
                          Contratos do Associado
                        </h4>
                      </div>
                      
                      
                      <div className="bg-bg-surface p-5 rounded-xl border border-border-default space-y-4 mb-4">
                        <h5 className="text-sm font-semibold text-text-subtle">
                          Tipo de Contrato / Pessoa
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-text-subtle mb-1">Tipo de Pessoa *</label>
                            <select 
                              value={editingAssociado.tipo_pessoa || 'PF'}
                              onChange={(e) => setEditingAssociado({ ...editingAssociado, tipo_pessoa: e.target.value as 'PF' | 'PJ' })}
                              className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-base focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none transition-all"
                            >
                              <option value="PF">Pessoa Física (PF)</option>
                              <option value="PJ">Pessoa Jurídica (PJ)</option>
                            </select>
                          </div>
                          {editingAssociado.tipo_pessoa === 'PJ' && (
                            <div>
                              <label className="block text-xs font-medium text-text-subtle mb-1">Empresa / Convenio (Fornecedor) *</label>
                              <select 
                                value={editingAssociado.fornecedor_id || ''}
                                onChange={(e) => setEditingAssociado({ ...editingAssociado, fornecedor_id: e.target.value })}
                                required
                                className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-base focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none transition-all"
                              >
                                <option value="">Selecione a empresa conveniada</option>
                                {fornecedores.filter(f => f.categoria === 'Convenios Associados' && f.status === 'ativo').map(f => (
                                  <option key={f.id} value={f.id}>{f.razao_social || f.nome_fantasia}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>

                      {!selectedContratoId ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Active Contract Widget */}
                          <div 
                            onClick={() => setSelectedContratoId('active')}
                            className="p-5 bg-bg-surface border border-[#3B82F6]/50 rounded-xl cursor-pointer hover:bg-bg-subtle transition-colors relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 px-3 py-1 bg-[#3B82F6]/10 text-[#3B82F6] text-xs font-semibold rounded-bl-lg">
                              ATIVO
                            </div>
                            <h5 className="text-lg font-bold text-text-base mb-1">
                              {editingAssociado.plano_nome || "Nenhum Plano Selecionado"}
                            </h5>
                            <p className="text-sm text-text-subtle mb-4">
                              Valor: R$ {valorPlanoAtivo.toFixed(2).replace(".", ",")}
                            </p>
                            <div className="flex justify-between items-center text-xs text-text-subtle">
                              <span>Desde {editingAssociado.data_adesao ? formatDateSafe(editingAssociado.data_adesao) : "N/A"}</span>
                              <span className="flex items-center gap-1 text-[#3B82F6]">Editar <Search className="w-3 h-3" /></span>
                            </div>
                          </div>
                          
                          {/* Inactive Contracts Widgets */}
                          {editingAssociado.historico_contratos?.map(hist => (
                            <div 
                              key={hist.id}
                              onClick={() => setSelectedContratoId(hist.id)}
                              className="p-5 bg-bg-surface border border-border-default rounded-xl cursor-pointer hover:bg-bg-subtle transition-colors relative overflow-hidden opacity-75"
                            >
                              <div className="absolute top-0 right-0 px-3 py-1 bg-slate-500/10 text-text-subtle text-xs font-semibold rounded-bl-lg">
                                INATIVO
                              </div>
                              <h5 className="text-lg font-bold text-text-base mb-1">
                                Plano {hist.plano}
                              </h5>
                              <p className="text-sm text-text-subtle mb-4">
                                Valor: R$ {hist.valor.toFixed(2).replace('.', ',')}
                              </p>
                              <div className="flex justify-between items-center text-xs text-text-subtle">
                                <span>{formatDateSafe(hist.data_inicio)} - {hist.data_fim ? formatDateSafe(hist.data_fim) : "N/A"}</span>
                                <span className="flex items-center gap-1">Ver <Search className="w-3 h-3" /></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() => setSelectedContratoId(null)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-subtle border border-border-default text-text-muted rounded-lg text-sm font-medium hover:bg-[#64748B] transition-colors"
                            >
                              Voltar
                            </button>
                          </div>
                          
                          {selectedContratoId === 'active' ? (
                            
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <div className="space-y-4 xl:col-span-7">
                          <h5 className="text-sm font-semibold text-text-subtle">
                            Dados do Contrato
                          </h5>
                          <div className="space-y-4">
                            <div className="p-5 bg-bg-surface border border-border-default rounded-xl">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <p className="text-sm font-medium text-text-subtle mb-1">Plano Atual</p>
                                  <h4 className="text-lg font-bold text-text-base capitalize">
                                    {editingAssociado.plano_pax_id ? planos.find(p => p.id === editingAssociado.plano_pax_id)?.nome || editingAssociado.plano_nome : editingAssociado.plano_nome || "Nenhum Plano Selecionado"}
                                  </h4>
                                </div>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Ativo
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                                <div>
                                  <p className="text-text-subtle">Valor Mensal</p>
                                  <p className="font-semibold text-text-base">R$ {valorPlanoAtivo.toFixed(2).replace(".", ",")}</p>
                                </div>
                                <div>
                                  <p className="text-text-subtle">Data de Adesão</p>
                                  <p className="font-semibold text-text-base">
                                    {editingAssociado.data_adesao ? formatDateSafe(editingAssociado.data_adesao) : "N/A"}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            {!editingAssociado.plano_pax_id ? (
                              <button
                                type="button"
                                onClick={() => setShowNovoContrato(true)}
                                className="w-full px-4 py-3 bg-[#3B82F6] text-white hover:bg-[#3B82F6]/90 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#3B82F6]/20"
                              >
                                <Plus className="w-4 h-4" />
                                Cadastrar Novo Contrato
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowModificarPlanoModal(true);
                                  setModificarPlanoStep("confirmar");
                                  setJustificativaModificacao("");
                                  setNovoPlanoSelecionado("");
                                }}
                                className="w-full px-4 py-3 bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Modificar Plano
                              </button>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-subtle mb-1">
                              Número de Vidas
                            </label>
                            <input
                              type="number"
                              min="1"
                              readOnly
                              value={1 + (editingAssociado.dependentes?.length || 0)}
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-subtle cursor-not-allowed focus:outline-none transition-all"
                            />
                            <p className="text-xs text-text-subtle mt-1">Calculado automaticamente (Titular + Dependentes)</p>
                          </div>
                          
                          <div className="p-4 bg-bg-surface border border-border-default rounded-xl mt-4">
                            <p className="text-sm text-text-subtle">
                              Quantidade de Dependentes Vinculados
                            </p>
                            <p className="text-2xl font-bold text-text-base mt-1">
                              {editingAssociado.dependentes?.length || 0}
                            </p>
                          </div>
                          
                        </div>
                        <div className="space-y-4 xl:col-span-5">
                          <h5 className="text-sm font-semibold text-text-subtle">
                            Histórico de Alterações
                          </h5>
                          <div className="bg-bg-surface border border-border-default rounded-xl p-4 overflow-y-auto max-h-[300px]">
                            <div className="space-y-4">
                              <div className="flex gap-4">
                                <div className="mt-1">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                  <div className="w-0.5 h-full bg-bg-hover mx-auto mt-1"></div>
                                </div>
                                <div className="pb-4">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 mb-1 border border-emerald-500/20">
                                    Contrato Ativo
                                  </span>
                                  <p className="text-sm text-text-base font-medium capitalize">
                                    Plano{" "}
                                    {editingAssociado.plano_nome || "Nenhum"}
                                  </p>
                                  <p className="text-xs text-text-muted mt-0.5">
                                    Valor: R$ {valorPlanoAtivo.toFixed(2).replace(".", ",")}
                                  </p>
                                  <p className="text-xs text-text-subtle mt-1">
                                    Desde{" "}
                                    {editingAssociado.data_adesao
                                      ? formatDateSafe(editingAssociado.data_adesao)
                                      : "Data não definida"}
                                  </p>
                                </div>
                              </div>
                              {editingAssociado.historico_contratos &&
                                editingAssociado.historico_contratos.map(
                                  (hist) => (
                                    <div className="flex gap-4" key={hist.id}>
                                      <div className="mt-1">
                                        <div className="w-2 h-2 rounded-full bg-[#60A5FA]"></div>
                                        <div className="w-0.5 h-full bg-bg-hover mx-auto mt-1"></div>
                                      </div>
                                      <div className="pb-4">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#60A5FA]/10 text-[#60A5FA] mb-1 border border-[#60A5FA]/20">
                                          Anterior
                                        </span>
                                        <p className="text-sm text-text-base font-medium capitalize">
                                          Plano {hist.plano}
                                        </p>
                                        <p className="text-xs text-text-muted mt-0.5">
                                          Valor: R 
                                          {hist.valor
                                            .toFixed(2)
                                            .replace(".", ",")}
                                        </p>
                                        <p className="text-xs text-text-subtle mt-1">
                                          {formatDateSafe(hist.data_inicio)}{" "}
                                          {hist.data_fim
                                            ? `até ${formatDateSafe(hist.data_fim)}`
                                            : ""}
                                        </p>
                                      </div>
                                    </div>
                                  ),
                                )}
                              <div className="flex gap-4">
                                <div className="mt-1">
                                  <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                                </div>
                                <div>
                                  <p className="text-sm text-text-subtle font-medium">
                                    Adesão Inicial
                                  </p>
                                  <p className="text-xs text-text-subtle mt-0.5">
                                    {editingAssociado.data_adesao
                                      ? formatDateSafe(editingAssociado.data_adesao)
                                      : "Data não definida"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                          ) : (
                            <div className="p-6 bg-bg-surface border border-border-default rounded-xl max-w-2xl">
                               {(() => {
                                 const hist = editingAssociado.historico_contratos?.find(h => h.id === selectedContratoId);
                                 if (!hist) return <p className="text-text-subtle">Contrato não encontrado.</p>;
                                 return (
                                   <div className="space-y-6">
                                     <h5 className="text-xl font-bold text-text-base">Plano {hist.plano}</h5>
                                     <div className="grid grid-cols-2 gap-6">
                                       <div className="bg-bg-subtle p-4 rounded-lg border border-border-default">
                                         <span className="text-xs font-semibold uppercase text-text-subtle block mb-1">Valor do Plano</span>
                                         <span className="text-lg font-medium text-text-base">R$ {hist.valor.toFixed(2).replace('.', ',')}</span>
                                       </div>
                                       <div className="bg-bg-subtle p-4 rounded-lg border border-border-default">
                                         <span className="text-xs font-semibold uppercase text-text-subtle block mb-1">Período</span>
                                         <span className="text-sm text-text-base">{formatDateSafe(hist.data_inicio)} a {hist.data_fim ? formatDateSafe(hist.data_fim) : "-"}</span>
                                       </div>
                                     </div>
                                   </div>
                                 );
                               })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : activeTab === "mensalidades" ? (
                    <MensalidadesTab associado={editingAssociado} onSuccess={!isEditingMode ? () => setActiveTab("documentos") : undefined} />
                  ) : activeTab === "requisicoes" ? (
                    <AssociadoRequisicoesTab associado={editingAssociado} />
                  ) : activeTab === "atendimentos" ? (
                    <AssociadoAtendimentosTab associado={editingAssociado} />
                  ) : activeTab === "documentos" ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-border-default pb-4">
                        <div>
                          <h4 className="text-text-base font-semibold text-base">
                            Documentos do Associado
                          </h4>
                          <p className="text-xs text-text-subtle mt-0.5">
                            Gere modelos de documentos ou anexe contratos assinados, documentos pessoais e comprovantes.
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-bg-subtle p-6 rounded-2xl border border-border-default/50 mb-6">
                        <ContratoDocumentosGenerator associado={editingAssociado} valorMensalidade={valorPlanoAtivo} />
                      </div>

                      <div className="space-y-4">
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingDoc(true);
                          }}
                          onDragLeave={() => setIsDraggingDoc(false)}
                          onDrop={async (e) => {
                            e.preventDefault();
                            setIsDraggingDoc(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              try {
                                setIsUploadingDoc(true);
                                const novoDoc = await uploadDocumentoAssociado(file, editingAssociado.id, state.isOnline);
                                setEditingAssociado({
                                  ...editingAssociado,
                                  documentos: [
                                    ...(editingAssociado.documentos || []),
                                    novoDoc,
                                  ],
                                });
                                toast.success("Documento anexado com sucesso!");
                              } catch (err: any) {
                                toast.error(err.message || "Falha ao anexar documento.");
                              } finally {
                                setIsUploadingDoc(false);
                              }
                            }
                          }}
                          className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all ${
                            isDraggingDoc 
                              ? 'border-[#3B82F6] bg-[#3B82F6]/10 scale-[1.01]' 
                              : 'border-border-default hover:border-[#3B82F6]/50 bg-bg-surface/50'
                          }`}
                        >
                          <input
                            type="file"
                            id="upload-doc"
                            className="hidden"
                            accept=".pdf,image/*"
                            disabled={isUploadingDoc}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  setIsUploadingDoc(true);
                                  const novoDoc = await uploadDocumentoAssociado(file, editingAssociado.id, state.isOnline);
                                  setEditingAssociado({
                                    ...editingAssociado,
                                    documentos: [
                                      ...(editingAssociado.documentos || []),
                                      novoDoc,
                                    ],
                                  });
                                  toast.success("Documento anexado com sucesso!");
                                } catch (err: any) {
                                  toast.error(err.message || "Falha ao anexar documento.");
                                } finally {
                                  setIsUploadingDoc(false);
                                  e.target.value = "";
                                }
                              }
                            }}
                          />
                          <label
                            htmlFor="upload-doc"
                            className="cursor-pointer flex flex-col items-center group w-full"
                          >
                            <div className="w-14 h-14 bg-bg-hover group-hover:bg-[#3B82F6]/10 rounded-2xl flex items-center justify-center mb-3 transition-colors">
                              {isUploadingDoc ? (
                                <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <UploadCloud className="w-7 h-7 text-[#3B82F6] group-hover:scale-110 transition-transform" />
                              )}
                            </div>
                            <p className="text-sm font-semibold text-text-base mb-1 text-center">
                              {isUploadingDoc ? "Processando e anexando arquivo..." : "Clique para enviar ou arraste um documento aqui"}
                            </p>
                            <p className="text-xs text-text-subtle text-center">
                              Suporta PDF, JPG, PNG e WebP (máx. 10MB)
                            </p>
                          </label>
                        </div>

                        {editingAssociado.documentos &&
                          editingAssociado.documentos.length > 0 && (
                            <div className="space-y-3 mt-6">
                              <div className="flex items-center justify-between">
                                <h5 className="text-sm font-semibold text-text-subtle flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-[#3B82F6]" />
                                  <span>Arquivos Salvos ({editingAssociado.documentos.length})</span>
                                </h5>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {editingAssociado.documentos.map((doc, idx) => {
                                  const isPdf = isPdfDocument(doc);
                                  const isImg = isImageDocument(doc);
                                  const isLegacyBlob = doc.url && doc.url.startsWith("blob:");

                                  return (
                                    <div
                                      key={doc.id || idx}
                                      className="flex items-center justify-between p-3.5 bg-bg-surface hover:bg-bg-subtle/80 border border-border-default rounded-xl transition-all group"
                                    >
                                      <div 
                                        onClick={() => setDocumentoVisualizando(doc)}
                                        className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1 mr-2"
                                      >
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                                          isPdf 
                                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                            : isImg 
                                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                                            : 'bg-bg-subtle text-text-subtle border border-border-default'
                                        }`}>
                                          {isPdf ? (
                                            <FileText className="w-5 h-5" />
                                          ) : isImg ? (
                                            <ImageIcon className="w-5 h-5" />
                                          ) : (
                                            <span className="uppercase">{doc.nome.split(".").pop()?.substring(0, 3)}</span>
                                          )}
                                        </div>
                                        <div className="overflow-hidden">
                                          <p className="text-sm text-text-base font-medium truncate group-hover:text-[#3B82F6] transition-colors" title={doc.nome}>
                                            {doc.nome}
                                          </p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-xs text-text-subtle">
                                              {doc.tamanho ? `${(doc.tamanho / 1024).toFixed(1)} KB` : 'Anexo'}
                                              {doc.data_upload && (
                                                <> • {new Date(doc.data_upload).toLocaleDateString("pt-BR")}</>
                                              )}
                                            </p>
                                            {isLegacyBlob && (
                                              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium" title="Arquivo anexado em sessão anterior. Reenvie para visualização permanente.">
                                                <AlertTriangle className="w-2.5 h-2.5" /> Reenvio sugerido
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setDocumentoVisualizando(doc)}
                                          title="Visualizar documento"
                                          className="p-2 text-text-subtle hover:text-[#3B82F6] hover:bg-bg-hover rounded-xl transition-colors"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const success = await downloadDocumento(doc);
                                            if (!success) toast.error("Não foi possível baixar este arquivo.");
                                            else toast.success("Download iniciado!");
                                          }}
                                          title="Baixar arquivo"
                                          className="p-2 text-text-subtle hover:text-emerald-400 hover:bg-bg-hover rounded-xl transition-colors"
                                        >
                                          <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const novosDocs = [
                                              ...editingAssociado.documentos!,
                                            ];
                                            novosDocs.splice(idx, 1);
                                            setEditingAssociado({
                                              ...editingAssociado,
                                              documentos: novosDocs,
                                            });
                                            toast.success("Documento removido da lista.");
                                          }}
                                          title="Excluir anexo"
                                          className="p-2 text-text-subtle hover:text-rose-500 hover:bg-bg-hover rounded-xl transition-colors"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-border-default bg-bg-surface/50 flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
                  >
                    Cancelar
                  </button>
                  <div className="flex gap-3">
                    {isEditingMode ? (
                      <BotaoSalvar
                        type="submit"
                        salvando={isSavingAssociado}
                        salvo={isSavedAssociado}
                        disabled={!state.isOnline}
                        texto="Salvar Alterações"
                        textoSalvando="Salvando Alterações..."
                        textoSalvo="Alterações Salvas!"
                        variante="primary"
                      />
                    ) : (
                      <>
                        {activeTab !== "principal" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (activeTab === "atendimentos")
                                setActiveTab("requisicoes");
                              else if (activeTab === "requisicoes")
                                setActiveTab("documentos");
                              else if (activeTab === "documentos")
                                setActiveTab("mensalidades");
                              else if (activeTab === "mensalidades")
                                setActiveTab("contratos");
                              else if (activeTab === "contratos")
                                setActiveTab("dependentes");
                              else if (activeTab === "dependentes")
                                setActiveTab("principal");
                            }}
                            className="px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
                          >
                            Voltar
                          </button>
                        )}

                        {(isEditingMode ? activeTab !== "atendimentos" : activeTab !== "documentos") ? (
                          <button
                            key="btn-next"
                            type="button"
                            onClick={() => {
                              if (activeTab === "principal") {
                                if (!executarValidacaoOuAlertar()) return;
                                setActiveTab("dependentes");
                              } else if (activeTab === "dependentes")
                                setActiveTab("contratos");
                              else if (activeTab === "contratos")
                                setActiveTab("mensalidades");
                              else if (activeTab === "mensalidades")
                                setActiveTab("documentos");
                              else if (activeTab === "documentos")
                                setActiveTab("requisicoes");
                              else if (activeTab === "requisicoes")
                                setActiveTab("atendimentos");
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25"
                          >
                            Próximo
                          </button>
                        ) : (
                          <BotaoSalvar
                            key="btn-submit"
                            type="submit"
                            salvando={isSavingAssociado}
                            salvo={isSavedAssociado}
                            disabled={!state.isOnline}
                            texto="Finalizar Cadastro"
                            textoSalvando="Gravando Associado..."
                            textoSalvo="Cadastro Concluído!"
                            variante="emerald"
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDependentesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface w-full max-w-3xl rounded-3xl shadow-2xl border border-border-default overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-border-default flex items-center justify-between sticky top-0 bg-bg-surface/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl">
                  <Heart className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-text-base">Lista de Dependentes</h3>
              </div>
              <button
                onClick={() => setShowDependentesModal(false)}
                className="p-2 text-text-subtle hover:bg-bg-subtle rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 border-b border-border-default">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Buscar por nome do dependente ou titular..."
                  value={buscaDependentes}
                  onChange={(e) => setBuscaDependentes(e.target.value)}
                  className="w-full bg-bg-subtle border border-border-default rounded-xl pl-10 pr-4 py-2.5 text-text-base focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all"
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-text-subtle">
                    <thead className="bg-bg-surface border-b border-border-default text-xs uppercase font-semibold text-text-muted">
                      <tr>
                        <th className="px-6 py-4">Nome do Dependente</th>
                        <th className="px-6 py-4">Parentesco</th>
                        <th className="px-6 py-4">Titular</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {dependentesFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-text-muted">
                            Nenhum dependente encontrado.
                          </td>
                        </tr>
                      ) : (
                        dependentesFiltrados.map((d, index) => {
                          const assoc = associados.find(a => 
                            (a.nome && d.titular_nome && a.nome.trim().toLowerCase() === d.titular_nome.trim().toLowerCase()) ||
                            (a.dependentes && a.dependentes.some(dep => dep.id === d.id))
                          );
                          return (
                            <tr 
                              key={index} 
                              onClick={() => {
                                if (assoc) {
                                  setShowDependentesModal(false);
                                  handleOpenModal(assoc);
                                  setActiveTab('dependentes');
                                  setDependenteEmEdicao(d);
                                  setDependenteFormModalOpen(true);
                                }
                              }}
                              className="hover:bg-bg-surface/70 transition-colors cursor-pointer group"
                              title="Clique para abrir e gerenciar este dependente"
                            >
                              <td className="px-6 py-4 text-text-base font-medium">
                                <div className="flex items-center justify-between">
                                  <span>{d.nome}</span>
                                  <Edit2 className="w-3.5 h-3.5 text-[#3B82F6] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </td>
                              <td className="px-6 py-4 capitalize">{d.parentesco || 'Não informado'}</td>
                              <td className="px-6 py-4 text-text-base">{d.titular_nome}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-border-default flex justify-between bg-bg-subtle/50">
              <button
                onClick={handleExportDependentesPDF}
                className="flex items-center gap-2 px-6 py-2 bg-bg-surface border border-border-default text-text-subtle text-sm font-semibold rounded-xl hover:text-text-base hover:bg-bg-hover transition-colors"
                title="Gerar relatório em PDF"
              >
                <Printer className="w-4 h-4" />
                <span>Gerar Relatório</span>
              </button>
              <button
                onClick={() => setShowDependentesModal(false)}
                className="px-6 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showModificarPlanoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface w-full max-w-lg rounded-3xl shadow-2xl border border-border-default overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border-default flex items-center justify-between bg-bg-surface/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#3B82F6]/10 rounded-xl">
                  <Edit2 className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <h3 className="text-lg font-bold text-text-base">Modificar Plano</h3>
              </div>
              <button
                onClick={() => setShowModificarPlanoModal(false)}
                className="p-2 text-text-subtle hover:bg-bg-subtle rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {modificarPlanoStep === "confirmar" && (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-rose-500" />
                  </div>
                  <h4 className="text-xl font-bold text-text-base">Atenção!</h4>
                  <p className="text-text-subtle leading-relaxed">
                    Você está prestes a iniciar o processo de modificação do plano atual do associado. 
                    Esta ação afetará o contrato vigente. Deseja continuar?
                  </p>
                  
                  <div className="flex justify-center gap-4 pt-4">
                    <button
                      onClick={() => setShowModificarPlanoModal(false)}
                      className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base rounded-xl font-medium hover:bg-bg-hover transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => setModificarPlanoStep("justificativa")}
                      className="px-6 py-2.5 bg-[#3B82F6] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}
              
              {modificarPlanoStep === "justificativa" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-bold text-text-base mb-2">Justificativa</h4>
                    <p className="text-sm text-text-subtle">
                      Por favor, informe o motivo para a alteração de plano deste associado.
                    </p>
                  </div>
                  
                  <textarea
                    value={justificativaModificacao}
                    onChange={(e) => setJustificativaModificacao(e.target.value)}
                    rows={4}
                    placeholder="Ex: Upgrade de plano solicitado pelo cliente, ajuste de valores..."
                    className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-base focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all resize-none"
                  ></textarea>
                  
                  <div className="flex justify-end gap-4 pt-4">
                    <button
                      onClick={() => setModificarPlanoStep("confirmar")}
                      className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base rounded-xl font-medium hover:bg-bg-hover transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      disabled={!justificativaModificacao.trim()}
                      onClick={() => setModificarPlanoStep("selecionar")}
                      className="px-6 py-2.5 bg-[#3B82F6] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25 disabled:opacity-50"
                    >
                      Avançar
                    </button>
                  </div>
                </div>
              )}
              
              {modificarPlanoStep === "selecionar" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-bold text-text-base mb-2">Novo Plano</h4>
                    <p className="text-sm text-text-subtle">
                      Selecione o novo plano para o associado. A alteração será efetivada ao salvar o cadastro.
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <PlanoPaxSelect
                      value={novoPlanoSelecionado}
                      onChange={(id) => {
                        setNovoPlanoSelecionado(id);
                      }}
                      nVidas={1 + (editingAssociado?.dependentes?.length || 0)}
                      idadesDependentes={editingAssociado?.dependentes?.filter(d => d.data_nascimento).map(d => {
                        const ageDifMs = Date.now() - new Date(d.data_nascimento!).getTime();
                        const ageDate = new Date(ageDifMs);
                        return Math.abs(ageDate.getUTCFullYear() - 1970);
                      }) || []}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-border-default">
                    <button
                      onClick={() => setModificarPlanoStep("justificativa")}
                      className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base rounded-xl font-medium hover:bg-bg-hover transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      disabled={!novoPlanoSelecionado}
                      onClick={() => {
                        if (editingAssociado) {
                          setEditingAssociado({
                            ...editingAssociado,
                            plano_pax_id: novoPlanoSelecionado,
                            justificativa_modificacao_plano: justificativaModificacao
                          } as any);
                        }
                        setShowModificarPlanoModal(false);
                      }}
                      className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                    >
                      Confirmar Modificação
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showNovoContrato && editingAssociado && (
        <NovoContratoWizard 
          associadoInicial={editingAssociado}
          onClose={() => setShowNovoContrato(false)}
          onSuccess={() => {
            setShowNovoContrato(false);
            loadData();
            handleCloseModal();
          }}
        />
      )}

      {/* Visualizador de Documentos */}
      {documentoVisualizando && (
        <VisualizadorDocumentoModal
          documento={documentoVisualizando}
          onClose={() => setDocumentoVisualizando(null)}
        />
      )}

      {/* Modal Independente de Formulário de Dependente */}
      {dependenteFormModalOpen && editingAssociado && (
        <DependenteFormModal
          isOpen={dependenteFormModalOpen}
          onClose={() => {
            setDependenteFormModalOpen(false);
            setDependenteEmEdicao(null);
          }}
          dependente={dependenteEmEdicao}
          titularNome={editingAssociado.nome}
          existingCpfs={(editingAssociado.dependentes || []).map((d) => d.cpf || "").filter(Boolean)}
          onDelete={handleExcluirDependente}
          onSave={(salvoDep) => {
            setEditingAssociado(prev => {
              if (!prev) return null;
              const deps = prev.dependentes ? [...prev.dependentes] : [];
              const index = deps.findIndex((d) => d.id === salvoDep.id);
              if (index !== -1) {
                deps[index] = salvoDep;
              } else {
                deps.push(salvoDep);
              }
              return {
                ...prev,
                dependentes: deps,
              };
            });
            setDependenteFormModalOpen(false);
            setDependenteEmEdicao(null);
          }}
        />
      )}

      {/* Relatório Profissional Modal */}
      <RelatorioAssociadosModal
        isOpen={showRelatorioModal}
        onClose={() => setShowRelatorioModal(false)}
        associados={filtered}
        empresaData={empresaData}
        currentFilters={{
          searchTerm,
          statusFilter,
          planoFilter
        }}
        userName={state.user?.nome || 'Administrador'}
        initialReportType={relatorioReportType}
      />
    </div>
  );
};
