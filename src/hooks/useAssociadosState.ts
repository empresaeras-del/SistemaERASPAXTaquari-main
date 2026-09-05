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
import { formatLocalDate, formatLocalDateTime, formatDateSafe } from '../utils/dateUtils';
import {
  filtrarEOrdenarAssociados,
  extrairTodosDependentes,
  filtrarDependentes,
  calcularEstatisticasAssociados,
  encontrarAssociadoComCpfDuplicado,
  calcularNVidasEIdades,
  construirEntradaHistoricoContrato,
  aplicarEnderecoViaCep,
  aplicarMudancaCampoAssociado,
} from '../utils/associadoHelpers';
import { validarDadosAssociado } from '../utils/associadoValidation';
import { RelatorioAssociadosModal } from '../components/associados/RelatorioAssociadosModal';
import { VisualizadorReciboModal, ReciboDados } from '../components/financeiro/VisualizadorReciboModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchImageWithDimensions } from '../utils/imageUtils';

export const MensalidadesTab = AssociadoMensalidadesTab;
export function useAssociadosState() {
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

  const filtered = React.useMemo(
    () => filtrarEOrdenarAssociados(associados, { searchTerm, statusFilter, planoFilter, sortBy }),
    [associados, searchTerm, statusFilter, planoFilter, sortBy]
  );

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
    
    const { nVidas, idadesDependentes } = calcularNVidasEIdades(editingAssociado.dependentes);

    const result = calcularValor(planoCompleto, nVidas, idadesDependentes);
    return result.total;
  }, [editingAssociado, planosCompletos, calcularValor]);

  const todosDependentes = React.useMemo(() => extrairTodosDependentes(associados), [associados]);

  const dependentesFiltrados = filtrarDependentes(todosDependentes, buscaDependentes);
  
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
          const cepFormatado = cepLimpo.replace(/^(\d{5})(\d{3})/, '$1-$2');
          // SÓ substitui logradouro e bairro se o ViaCEP retornou valor preenchido
          return aplicarEnderecoViaCep(prev, data, cepFormatado);
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
      const updated = aplicarMudancaCampoAssociado(editingAssociado, field, value);
      const finalValue = (updated as any)[field];

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
        const duplicateUser = encontrarAssociadoComCpfDuplicado(associados, editingAssociado.cpf, editingAssociado.id);
        if (duplicateUser) {
          toast.error(`Não é possível registrar. Este CPF já está sendo usado pelo associado ativo: ${duplicateUser.nome}`);
          setIsSavingAssociado(false);
          return;
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
      
      const { nVidas: nVidasCalculadas } = calcularNVidasEIdades(editingAssociado.dependentes);

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
          const { idadesDependentes } = calcularNVidasEIdades(novoAssociado.dependentes);
          const resultado = calcularValor(planoCompleto, nVidasCalculadas, idadesDependentes);
          novoAssociado.valor_plano = resultado.total;
        }
      }
      
      if ((novoAssociado as any).justificativa_modificacao_plano) {
        const original = associados.find(a => a.id === novoAssociado.id);
        
        if (original && original.plano_pax_id && original.plano_pax_id !== novoAssociado.plano_pax_id) {
            const hist = novoAssociado.historico_contratos ? [...novoAssociado.historico_contratos] : [];
            hist.push(construirEntradaHistoricoContrato(original, uuidv4(), format(new Date(), "yyyy-MM-dd")));
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

  const { totalTitulares, totalDependentes, vidasProtegidas, inadimplentes, qtdAssociadosAtivosSemParcelas } =
    calcularEstatisticasAssociados(associados, parcelasAbertasMap);

  return {
    state,
    toast,
    confirm,
    planos,
    planosCompletos,
    calcularValor,
    fornecedores,
    associados, setAssociados,
    loading, setLoading,
    previewAssociado, setPreviewAssociado,
    empresaData, setEmpresaData,
    showRelatorioModal, setShowRelatorioModal,
    relatorioReportType, setRelatorioReportType,
    viewMode, setViewMode,
    searchTerm, setSearchTerm,
    visibleColumns, isVisible, setVisibleColumns,
    columns,
    statusFilter, setStatusFilter,
    planoFilter, setPlanoFilter,
    sortBy, setSortBy,
    showFilters, setShowFilters,
    filtered,
    activeTab, setActiveTab,
    isModalOpen, setIsModalOpen,
    editingAssociado, setEditingAssociado,
    dependenteFormModalOpen, setDependenteFormModalOpen,
    dependenteEmEdicao, setDependenteEmEdicao,
    selectedContratoId, setSelectedContratoId,
    isEditingMode, setIsEditingMode,
    documentoVisualizando, setDocumentoVisualizando,
    isUploadingDoc, setIsUploadingDoc,
    isDraggingDoc, setIsDraggingDoc,
    isSavingAssociado, setIsSavingAssociado,
    isSavedAssociado, setIsSavedAssociado,
    initialAssociadoSnapshot, setInitialAssociadoSnapshot,
    hasUnsavedChanges,
    handleWhatsAppMenu,
    activeSubTab, setActiveSubTab,
    showDependentesModal, setShowDependentesModal,
    buscaDependenteInterno, setBuscaDependenteInterno,
    buscaDependentes, setBuscaDependentes,
    showModificarPlanoModal, setShowModificarPlanoModal,
    showNovoContrato, setShowNovoContrato,
    modificarPlanoStep, setModificarPlanoStep,
    justificativaModificacao, setJustificativaModificacao,
    novoPlanoSelecionado, setNovoPlanoSelecionado,
    parcelasAbertasMap, setParcelasAbertasMap,
    valorPlanoAtivo,
    todosDependentes,
    dependentesFiltrados,
    loadData,
    fieldErrors, setFieldErrors,
    buscandoCep, setBuscandoCep,
    buscarCepViaCep,
    executarValidacaoOuAlertar,
    handleFieldChange,
    handleOpenModal,
    handleCloseModal,
    handleSave,
    handleDelete,
    handleExcluirDependente,
    handleExportPDF,
    handleExportDependentesPDF,
    totalTitulares,
    totalDependentes,
    vidasProtegidas,
    inadimplentes,
    qtdAssociadosAtivosSemParcelas
  };
}
