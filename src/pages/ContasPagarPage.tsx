import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Building2, 
  Search, 
  Filter, 
  DollarSign, 
  Calendar, 
  Eye, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Printer, 
  Plus, 
  CreditCard, 
  X,
  Lock,
  ChevronUp,
  ChevronDown,
  FileText,
  User,
  AlertTriangle,
  Wallet,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { 
  getParcelasPagar, 
  getDespesas,
  getDespesaById,
  registrarPagamento, 
  excluirParcelaPagar, 
  excluirDespesa, 
  ParcelaPagar, 
  Despesa 
} from '../services/financeiroService';
import { getLoteAbertoAtivo, registrarMovimentacao } from '../services/caixasService';
import { LoteCaixa } from '../types/caixas';
import { getContasBancariasAtivas } from '../services/contasBancariasService';
import { ContaBancaria } from '../types/contasBancarias';
import { getEmpresaById, Empresa } from '../services/empresasService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { parseLocalDate, formatLocalDate, formatLocalDateTime, isDateBeforeToday, isDateToday } from '../utils/dateUtils';
import { canDelete, canEditFinanceiro, alertPermissionRestriction } from '../utils/permissions';
import { useConfirm } from '../context/ConfirmContext';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { AdvancedFilterBar } from '../components/layout/AdvancedFilterBar';
import { RelatorioContasPagarModal } from '../components/financeiro/RelatorioContasPagarModal';
import { VisualizadorReciboModal, ReciboDados } from '../components/financeiro/VisualizadorReciboModal';
import { IndicadoresContasPagar } from '../components/financeiro/IndicadoresContasPagar';

export const ContasPagarPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useAppContext();
  const { confirm } = useConfirm();


  const [parcelas, setParcelas] = useState<ParcelaPagar[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRelatorioModal, setShowRelatorioModal] = useState(false);
  const [showReciboModal, setShowReciboModal] = useState(false);
  const [reciboModalData, setReciboModalData] = useState<ReciboDados | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (parcelas.length > 0 && location.state?.openDetails) {
      const p = parcelas.find((x: any) => x.id === location.state.openDetails);
      if (p) {
        setParcelaDetalhes(p);
        setShowDetalhesModal(true);
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [parcelas, location.state, navigate, location.pathname]);

  const { visibleColumns, isVisible, setVisibleColumns } = useColumnVisibility(['credor', 'descricao', 'vencimento', 'valor', 'status', 'acoes']);
  const columns = [
    { id: 'credor', label: 'Credor / Fornecedor' },
    { id: 'descricao', label: 'Descrição' },
    { id: 'vencimento', label: 'Vencimento' },
    { id: 'valor', label: 'Valor' },
    { id: 'status', label: 'Status' },
    { id: 'acoes', label: 'Ações' }
  ];
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [formaPagamentoFilter, setFormaPagamentoFilter] = useState('');
  const [sortField, setSortField] = useState<'credor' | 'vencimento' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal de Baixa/Pagamento
  const [showBaixaModal, setShowBaixaModal] = useState(false);
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaPagar | null>(null);
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [valorPago, setValorPago] = useState<number>(0);
  const [formaPagamentoEfetiva, setFormaPagamentoEfetiva] = useState<string>('pix');
  const [observacaoPagamento, setObservacaoPagamento] = useState<string>('');
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [contaBancariaId, setContaBancariaId] = useState<string>('');

  // Verificação e fluxo do Lote de Caixa
  const [modalStage, setModalStage] = useState<'form' | 'confirmacao' | 'bloqueio'>('form');
  const [loteAberto, setLoteAberto] = useState<LoteCaixa | null>(null);
  const [checkingLote, setCheckingLote] = useState(false);
  const [submittingBaixa, setSubmittingBaixa] = useState(false);

  // Modal de Detalhes
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [parcelaDetalhes, setParcelaDetalhes] = useState<ParcelaPagar | null>(null);
  const [despesaPai, setDespesaPai] = useState<Despesa | null>(null);
  const [empresaData, setEmpresaData] = useState<Empresa | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      if (state.empresaSelecionada) {
        const [contas, emp] = await Promise.all([
          getContasBancariasAtivas(state.empresaSelecionada, state.isOnline),
          getEmpresaById(state.empresaSelecionada, state.isOnline)
        ]);
        setContasBancarias(contas);
        if (emp) setEmpresaData(emp);
      }
      const [dataParcelas, dataDespesas] = await Promise.all([
        getParcelasPagar(state.isOnline, state.empresaSelecionada || 'all'),
        getDespesas(state.isOnline, state.empresaSelecionada || 'all')
      ]);
      setParcelas(dataParcelas);
      setDespesas(dataDespesas);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar parcelas a pagar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  const filteredParcelas = useMemo(() => {
    return parcelas.filter(p => {
      const matchesSearch = (p.credor_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (p.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (p.credor_cpf_cnpj || '').includes(searchTerm);
      
      let matchesStatus = true;
      if (statusFilter === 'pendente') {
        matchesStatus = p.status === 'pendente';
      } else if (statusFilter === 'vencido') {
        matchesStatus = p.status === 'pendente' && isDateBeforeToday(p.data_vencimento);
      } else if (statusFilter === 'vence_hoje') {
        matchesStatus = p.status === 'pendente' && isDateToday(p.data_vencimento);
      } else if (statusFilter === 'a_vencer') {
        matchesStatus = p.status === 'pendente' && !isDateBeforeToday(p.data_vencimento) && !isDateToday(p.data_vencimento);
      } else if (statusFilter === 'pago') {
        matchesStatus = p.status === 'pago';
      } else if (statusFilter === 'cancelado') {
        matchesStatus = p.status === 'cancelado';
      } else if (statusFilter) {
        matchesStatus = p.status === statusFilter;
      }

      const matchesForma = formaPagamentoFilter ? p.forma_pagamento === formaPagamentoFilter : true;
      
      let matchesData = true;
      if (dataInicial || dataFinal) {
        const pDate = parseLocalDate(p.data_vencimento);
        if (pDate) {
          pDate.setHours(0, 0, 0, 0);
          if (dataInicial) {
            const dInit = parseLocalDate(dataInicial);
            if (dInit) {
              dInit.setHours(0, 0, 0, 0);
              if (dInit > pDate) matchesData = false;
            }
          }
          if (dataFinal) {
            const dEnd = parseLocalDate(dataFinal);
            if (dEnd) {
              dEnd.setHours(23, 59, 59, 999);
              if (dEnd < pDate) matchesData = false;
            }
          }
        }
      }
      
      return matchesSearch && matchesStatus && matchesForma && matchesData;
    });
  }, [parcelas, searchTerm, statusFilter, formaPagamentoFilter, dataInicial, dataFinal]);

  const sortedParcelas = useMemo(() => {
    if (!sortField) return filteredParcelas;
    return [...filteredParcelas].sort((a, b) => {
      if (sortField === 'credor') {
        const nameA = a.credor_nome || '';
        const nameB = b.credor_nome || '';
        return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (sortField === 'vencimento') {
        const dateA = parseLocalDate(a.data_vencimento)?.getTime() || 0;
        const dateB = parseLocalDate(b.data_vencimento)?.getTime() || 0;
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      return 0;
    });
  }, [filteredParcelas, sortField, sortDirection]);

  const openBaixaModal = (parcela: ParcelaPagar) => {
    setParcelaSelecionada(parcela);
    setDataPagamento(format(new Date(), 'yyyy-MM-dd'));
    setValorPago(parcela.valor);
    setFormaPagamentoEfetiva(parcela.forma_pagamento || 'pix');
    setContaBancariaId(parcela.conta_bancaria_id || (contasBancarias.length > 0 ? contasBancarias[0].id : ''));
    setObservacaoPagamento('');
    setLoteAberto(null);
    setModalStage('form');
    setShowBaixaModal(true);
  };

  const handleBaixa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcelaSelecionada) return;

    setCheckingLote(true);
    try {
      const activeLote = await getLoteAbertoAtivo(state.isOnline, state.empresaSelecionada || 'tenant-default');
      if (!activeLote) {
        setLoteAberto(null);
        setModalStage('bloqueio');
      } else {
        setLoteAberto(activeLote);
        setModalStage('confirmacao');
      }
    } catch (err) {
      console.error('Erro ao verificar lote de caixa:', err);
      toast.error('Erro ao verificar status do Lote de Caixa');
    } finally {
      setCheckingLote(false);
    }
  };

  const handleEfetivarPagamento = async () => {
    if (!state.isOnline) {
      toast.error('Baixa de pagamento bloqueada no Modo de Visualização (Offline).');
      return;
    }
    if (!parcelaSelecionada || !loteAberto) return;

    setSubmittingBaixa(true);
    try {
      await registrarPagamento(state.isOnline, parcelaSelecionada.id, {
        data_pagamento: dataPagamento ? new Date(dataPagamento + "T12:00:00").toISOString() : new Date().toISOString(),
        valor_pago: Number(valorPago) || parcelaSelecionada.valor,
        forma_pagamento_efetivo: formaPagamentoEfetiva,
        conta_bancaria_id: formaPagamentoEfetiva !== 'dinheiro' ? contaBancariaId : null,
        pago_por: state.user?.nome || 'Sistema',
        observacao: observacaoPagamento
      });

      // Registra a movimentação financeira diretamente no Lote de Caixa Aberto
      await registrarMovimentacao(state.isOnline, {
        tenant_id: state.empresaSelecionada || 'tenant-default',
        lote_id: loteAberto.id,
        tipo: 'saida',
        origem: 'contas_pagar',
        categoria: 'Despesa / Pagamento',
        descricao: `Pagamento: ${parcelaSelecionada.credor_nome} - ${parcelaSelecionada.descricao}`,
        valor: Number(valorPago) || parcelaSelecionada.valor,
        forma_pagamento: formaPagamentoEfetiva as any,
        data_movimentacao: dataPagamento ? new Date(dataPagamento + "T12:00:00").toISOString() : new Date().toISOString(),
        referencia_id: parcelaSelecionada.id,
        documento_ref: `Parc. ${parcelaSelecionada.numero_parcela}/${parcelaSelecionada.total_parcelas || 1}`,
        operador_nome: state.user?.nome || loteAberto.operador_nome || 'Sistema',
        observacao: observacaoPagamento
      });

      toast.success(`Pagamento registrado com sucesso no Lote ${loteAberto.codigo_lote}!`);
      setShowBaixaModal(false);
      loadData();
    } catch (err: any) {
      console.error('Erro ao efetivar pagamento:', err);
      toast.error(err?.message || 'Erro ao efetivar pagamento');
    } finally {
      setSubmittingBaixa(false);
    }
  };

  const openDetalhes = async (parcela: ParcelaPagar) => {
    setParcelaDetalhes(parcela);
    setShowDetalhesModal(true);
    if (parcela.despesa_id) {
      const parent = await getDespesaById(state.isOnline, parcela.despesa_id);
      setDespesaPai(parent);
    } else {
      setDespesaPai(null);
    }
  };

  const handleExcluirParcela = (parcela: ParcelaPagar) => {
    if (!canDelete(state.user, state.isOnline)) {
      toast.error(
        !state.isOnline
          ? 'Exclusão bloqueada no Modo de Visualização (Offline).'
          : 'Permissão negada. Somente usuários Administradores podem excluir registros no sistema.'
      );
      return;
    }

    confirm({
      title: 'Excluir Parcela',
      message: `Deseja realmente excluir a parcela ${parcela.numero_parcela}/${parcela.total_parcelas} de R$ ${parcela.valor.toFixed(2)} (${parcela.credor_nome})?`,
      confirmText: 'Excluir Parcela',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        try {
          await excluirParcelaPagar(state.isOnline, parcela.id);
          setParcelas(prev => prev.filter(p => p.id !== parcela.id));
          toast.success('Parcela excluída com sucesso!');
          loadData();
        } catch (e) {
          toast.error('Erro ao excluir parcela');
        }
      }
    });
  };

  const handleExcluirDespesaCompleta = (despesaId: string, descricao: string) => {
    if (!canDelete(state.user, state.isOnline)) {
      toast.error(
        !state.isOnline
          ? 'Exclusão bloqueada no Modo de Visualização (Offline).'
          : 'Permissão negada. Somente usuários Administradores podem excluir registros no sistema.'
      );
      return;
    }

    confirm({
      title: 'Excluir Despesa Inteira',
      message: `Atenção: Esta ação excluirá permanentemente a despesa "${descricao}" e TODAS as suas parcelas vinculadas. Deseja continuar?`,
      confirmText: 'Excluir Tudo',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        try {
          await excluirDespesa(state.isOnline, despesaId);
          setParcelas(prev => prev.filter(p => p.despesa_id !== despesaId));
          toast.success('Despesa e parcelas excluídas com sucesso!');
          if (showDetalhesModal) setShowDetalhesModal(false);
          loadData();
        } catch (e) {
          toast.error('Erro ao excluir despesa');
        }
      }
    });
  };

  const getStatusBadge = (status: string, vencimento: string) => {
    if (status === 'pago') return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">Pago</span>;
    if (status === 'cancelado') return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-text-subtle">Cancelado</span>;

    if (isDateBeforeToday(vencimento)) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500">Vencido</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">Pendente</span>;
  };

  const handleImprimirComprovante = (parcela: ParcelaPagar) => {
    const despesaPai = despesas.find(d => d.id === parcela.despesa_id);
    const dataVenc = formatLocalDate(parcela.data_vencimento);
    const dataPag = formatLocalDateTime(parcela.data_pagamento || parcela.pago_em);
    const numDoc = (parcela.id || '').substring(0, 8).toUpperCase();
    const credorNome = parcela.credor_nome || despesaPai?.fornecedor_nome || despesaPai?.funcionario_nome || despesaPai?.credor_nome || 'Credor / Fornecedor';
    const credorDoc = parcela.credor_cpf_cnpj || despesaPai?.fornecedor_cnpj_cpf || despesaPai?.funcionario_cpf || despesaPai?.credor_cpf_cnpj || 'Não informado';
    const categoriaInfo = despesaPai?.categoria || 'Despesas';
    const formaEfetiva = (parcela.forma_pagamento_efetivo || parcela.forma_pagamento || 'PIX').toUpperCase();
    const pagoPor = parcela.pago_por || state.user?.nome || 'Sistema';

    setReciboModalData({
      numRecibo: numDoc,
      tipo: 'pagamento',
      titulo: 'Comprovante de Pagamento',
      pagadorNome: credorNome,
      pagadorDoc: credorDoc,
      descricao: parcela.descricao || despesaPai?.descricao || 'Despesa',
      parcelaInfo: `Parcela ${parcela.numero_parcela} de ${parcela.total_parcelas || 1}`,
      categoria: categoriaInfo,
      vencimentoOriginal: dataVenc,
      dataLiquidacao: dataPag,
      formaPagamento: formaEfetiva,
      valor: Number(parcela.valor_pago || parcela.valor),
      operadorNome: pagoPor,
      observacoes: parcela.observacao_pagamento
    });
    setShowReciboModal(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-text-base">Contas a Pagar</h1>
          <p className="text-text-subtle mt-1">Gestão de despesas, fornecedores e vencimentos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRelatorioModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border-default text-text-subtle text-sm font-semibold rounded-xl hover:text-text-base hover:bg-bg-hover transition-colors"
            title="Exportar listagem para PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
          <button 
            disabled={!state.isOnline}
            onClick={() => navigate('/financeiro/contas-a-pagar/nova')} 
            title={!state.isOnline ? "Inclusão bloqueada no Modo Offline" : "Nova Despesa"}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            Nova Despesa
          </button>
        </div>
      </div>

      {/* PAINEL DE INDICADORES FINANCEIROS PROFISSIONAIS */}
      <IndicadoresContasPagar 
        parcelas={parcelas}
        despesas={despesas}
        activeStatusFilter={statusFilter}
        onSelectStatusFilter={(st) => setStatusFilter(st)}
      />

      <div className="bg-bg-subtle border border-border-default rounded-2xl flex-1 flex flex-col overflow-hidden print:hidden">
        <div className="p-4 border-b border-border-default">
          <div className="p-4 border-b border-border-default">
          <AdvancedFilterBar
            pageKey="contas-pagar"
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            currentFilters={{ searchTerm, statusFilter, formaPagamentoFilter, dataInicial, dataFinal }}
            onApplyFilters={(filters) => {
              setSearchTerm(filters.searchTerm || '');
              setStatusFilter(filters.statusFilter || '');
              setFormaPagamentoFilter(filters.formaPagamentoFilter || '');
              setDataInicial(filters.dataInicial || '');
              setDataFinal(filters.dataFinal || '');
            }}
            onClearFilters={() => {
              setSearchTerm('');
              setStatusFilter('');
              setFormaPagamentoFilter('');
              setDataInicial('');
              setDataFinal('');
            }}
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-subtle">Busca Rápida</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                <input
                  type="text"
                  placeholder="Credor, documento ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-subtle">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              >
                <option value="">Todos os Status</option>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-subtle">Forma de Pagamento</label>
              <select
                value={formaPagamentoFilter}
                onChange={(e) => setFormaPagamentoFilter(e.target.value)}
                className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              >
                <option value="">Todas</option>
                <option value="pix">PIX</option>                <option value="dinheiro">Dinheiro</option>                <option value="cartao_credito">Cartão de Crédito</option>                <option value="cartao_debito">Cartão de Débito</option>                <option value="boleto">Boleto</option>                <option value="transferencia">Transferência</option>              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-subtle">Período Vencimento (Inicial)</label>
              <input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-subtle">Período Vencimento (Final)</label>
              <input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              />
            </div>
          </AdvancedFilterBar>
        </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-surface border-b border-border-default text-xs uppercase tracking-wider text-text-subtle font-semibold">
                <th 
                  className="px-6 py-4 cursor-pointer hover:bg-bg-hover transition-colors"
                  onClick={() => {
                    if (sortField === 'credor') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('credor');
                      setSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Credor
                    {sortField === 'credor' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                </th>
                {isVisible('descricao') && <th className="px-6 py-4">Descrição</th>}
                <th 
                  className="px-6 py-4 cursor-pointer hover:bg-bg-hover transition-colors"
                  onClick={() => {
                    if (sortField === 'vencimento') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('vencimento');
                      setSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Vencimento
                    {sortField === 'vencimento' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                </th>
                {isVisible('valor') && <th className="px-6 py-4 text-right">Valor</th>}
                {isVisible('status') && <th className="px-6 py-4">Status</th>}
                {isVisible('acoes') && <th className="px-6 py-4 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#475569]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-subtle">
                    <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    Carregando parcelas...
                  </td>
                </tr>
              ) : sortedParcelas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-subtle">
                    Nenhuma parcela encontrada.
                  </td>
                </tr>
              ) : (
                sortedParcelas.map((parcela) => (
                  <tr key={parcela.id} className="hover:bg-[#1A1D36] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-text-base">{parcela.credor_nome || 'Não informado'}</div>
                      <div className="text-sm text-text-subtle">{(parcela.tipo_credor || 'fornecedor').replace('_', ' ').toUpperCase()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-text-base">{parcela.descricao}</div>
                      <div className="text-sm text-text-subtle">Parc. {parcela.numero_parcela}/{parcela.total_parcelas || 1}</div>
                    </td>
                    <td className="px-6 py-4">
                      {formatLocalDate(parcela.data_vencimento)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-text-base">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcela.valor)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(parcela.status, parcela.data_vencimento)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Ver Detalhes */}
                        <button
                          onClick={() => openDetalhes(parcela)}
                          title="Ver Detalhes"
                          className="p-1.5 rounded-lg bg-bg-surface hover:bg-bg-hover text-text-subtle hover:text-text-base border border-border-default transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Editar */}
                        <button
                          onClick={() => {
                            if (!canEditFinanceiro(state.user, state.isOnline)) {
                              alertPermissionRestriction('Financeiro (Contas a Pagar)', 'editar despesas ou parcelas existentes');
                              return;
                            }
                            navigate(`/financeiro/contas-a-pagar/${parcela.despesa_id || parcela.id}/editar?parcela=${parcela.id}`);
                          }}
                          title="Editar Despesa"
                          disabled={parcela.status === 'pago'}
                          className={`p-1.5 rounded-lg transition-colors ${parcela.status === 'pago' ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400'}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Excluir Parcela */}
                        <button
                          onClick={() => handleExcluirParcela(parcela)}
                          title="Excluir Parcela"
                          disabled={parcela.status === 'pago'}
                          className={`p-1.5 rounded-lg transition-colors ${parcela.status === 'pago' ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {/* Botão Pagar */}
                        {(parcela.status === 'pendente' || parcela.status === 'atrasado') && (
                          <button
                            onClick={() => openBaixaModal(parcela)}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ml-1"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Pagar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE BAIXA / PAGAMENTO */}
      {showBaixaModal && parcelaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:static print:bg-transparent print:p-0 print:block">
          <div className="bg-bg-subtle border border-border-default rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            
            {/* ETAPA 1: FORMULÁRIO DE PAGAMENTO */}
            {modalStage === 'form' && (
              <>
                <div className="flex items-center justify-between p-6 border-b border-border-default">
                  <h3 className="text-xl font-bold text-text-base flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    Registrar Pagamento
                  </h3>
                  <button
                    onClick={() => setShowBaixaModal(false)}
                    className="text-text-subtle hover:text-text-base transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form onSubmit={handleBaixa} className="p-6 space-y-4">
                  <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-1">
                    <p className="text-xs text-text-subtle uppercase tracking-wider">Parcela {parcelaSelecionada.numero_parcela}/{parcelaSelecionada.total_parcelas || 1}</p>
                    <p className="text-lg font-bold text-text-base">{parcelaSelecionada.descricao}</p>
                    <p className="text-sm text-text-subtle">Credor: <span className="text-text-base font-medium">{parcelaSelecionada.credor_nome}</span></p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-subtle mb-1">Data do Pagamento *</label>
                    <input
                      type="date"
                      value={dataPagamento}
                      onChange={(e) => setDataPagamento(e.target.value)}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-subtle mb-1">Valor Pago (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorPago}
                      onChange={(e) => setValorPago(Number(e.target.value))}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-subtle mb-1">Forma de Pagamento Efetiva *</label>
                    <select
                      value={formaPagamentoEfetiva}
                      onChange={(e) => setFormaPagamentoEfetiva(e.target.value)}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                    >
                      <option value="pix">PIX</option>
                      <option value="boleto">Boleto</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                      <option value="transferencia">Transferência</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cheque">Cheque</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  {formaPagamentoEfetiva !== 'dinheiro' && (
                  <div>
                    <label className="block text-sm font-medium text-text-subtle mb-1">Conta Bancária Referencial *</label>
                    <select
                      value={contaBancariaId}
                      onChange={(e) => setContaBancariaId(e.target.value)}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                    >
                      {contasBancarias.map(conta => (
                        <option key={conta.id} value={conta.id}>{conta.nome} ({conta.banco})</option>
                      ))}
                    </select>
                  </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text-subtle mb-1">Observações do Pagamento</label>
                    <textarea
                      rows={2}
                      value={observacaoPagamento}
                      onChange={(e) => setObservacaoPagamento(e.target.value)}
                      placeholder="Ex: Pago via PIX pelo App do Banco"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                    <button
                      type="button"
                      onClick={() => setShowBaixaModal(false)}
                      className="px-5 py-2.5 rounded-xl text-text-muted hover:text-text-base hover:bg-bg-hover transition-colors font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={checkingLote}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                    >
                      {checkingLote ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Verificando Caixa...
                        </>
                      ) : (
                        'Confirmar Pagamento'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* ETAPA 2: TELA DE BLOQUEIO (SEM LOTE DE CAIXA ABERTO) */}
            {modalStage === 'bloqueio' && (
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between border-b border-border-default pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-text-base">Operação Bloqueada</h3>
                      <p className="text-xs text-rose-400 font-semibold">Nenhum Lote de Caixa Aberto Encontrado</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowBaixaModal(false)}
                    className="text-text-subtle hover:text-text-base transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      Não é possível registrar o pagamento
                    </div>
                    <p className="text-sm text-text-subtle leading-relaxed">
                      Para efetivar este pagamento de despesa, o sistema exige que exista um <strong>Lote de Caixa aberto</strong> ativo para registrar a saída de caixa.
                    </p>
                  </div>

                  <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-2">
                    <p className="text-sm font-semibold text-text-base flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-[#3B82F6]" />
                      Orientação ao Usuário:
                    </p>
                    <p className="text-xs text-text-subtle leading-relaxed">
                      Por favor, acesse o módulo de <strong>Caixas / Lotes</strong> e realize a abertura de um novo lote de caixa antes de realizar este pagamento.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
                  <button
                    type="button"
                    onClick={() => setModalStage('form')}
                    className="px-5 py-2.5 rounded-xl text-text-muted hover:text-text-base hover:bg-bg-hover transition-colors font-medium text-sm"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBaixaModal(false);
                      navigate('/financeiro/caixas');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
                  >
                    <Wallet className="w-4 h-4" />
                    Abrir Lote de Caixa
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 3: TELA DE CONFIRMAÇÃO DE REGISTRO NO LOTE */}
            {modalStage === 'confirmacao' && loteAberto && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-border-default pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-base">Confirmação de Registro no Lote</h3>
                      <p className="text-xs text-text-subtle">Confira as informações do Lote de Caixa antes de efetivar</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowBaixaModal(false)}
                    className="text-text-subtle hover:text-text-base transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* INFO DO LOTE DE CAIXA */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                      <Wallet className="w-4 h-4" /> Lote de Caixa Origem
                    </span>
                    <span className="px-2.5 py-1 text-xs font-bold bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/30">
                      {loteAberto.codigo_lote}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-text-subtle pt-2 border-t border-emerald-500/20">
                    <div>
                      <span className="block text-text-muted">Terminal / Caixa:</span>
                      <strong className="text-text-base font-semibold">{loteAberto.terminal_caixa}</strong>
                    </div>
                    <div>
                      <span className="block text-text-muted">Operador Responsável:</span>
                      <strong className="text-text-base font-semibold">{loteAberto.operador_nome}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-text-muted">Data/Hora de Abertura:</span>
                      <strong className="text-text-base font-semibold">
                        {format(new Date(loteAberto.data_abertura), "dd/MM/yyyy 'às' HH:mm")}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* RESUMO DA TRANSAÇÃO */}
                <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-2.5 text-sm">
                  <p className="text-xs text-text-subtle uppercase tracking-wider font-semibold">Resumo do Pagamento</p>
                  
                  <div className="flex justify-between items-center py-1 border-b border-border-default">
                    <span className="text-text-subtle text-xs">Credor:</span>
                    <span className="font-semibold text-text-base text-xs">{parcelaSelecionada.credor_nome}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-border-default">
                    <span className="text-text-subtle text-xs">Descrição / Parcela:</span>
                    <span className="font-medium text-text-base text-xs">
                      {parcelaSelecionada.descricao} ({parcelaSelecionada.numero_parcela}/{parcelaSelecionada.total_parcelas || 1})
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-border-default">
                    <span className="text-text-subtle text-xs">Forma de Pagamento:</span>
                    <span className="uppercase font-bold text-xs text-[#3B82F6] bg-blue-500/10 px-2 py-0.5 rounded">
                      {formaPagamentoEfetiva}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-text-subtle font-medium text-sm">Valor a Efetivar (Débito):</span>
                    <span className="text-xl font-bold text-rose-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorPago)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
                  <button
                    type="button"
                    onClick={() => setModalStage('form')}
                    className="px-5 py-2.5 rounded-xl text-text-muted hover:text-text-base hover:bg-bg-hover transition-colors font-medium text-sm"
                  >
                    Ajustar Dados
                  </button>
                  <button
                    type="button"
                    onClick={handleEfetivarPagamento}
                    disabled={submittingBaixa}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    {submittingBaixa ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Efetivando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmar e Registrar no Lote
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DO REGISTRO */}
      {showDetalhesModal && parcelaDetalhes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:static print:bg-transparent print:p-0 print:block">
          <div className="bg-bg-subtle border border-border-default rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none print:bg-transparent">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border-default bg-bg-surface/50 print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-base">Detalhes da Contas a Pagar</h3>
                  <p className="text-sm text-text-subtle">Parcela {parcelaDetalhes.numero_parcela} de {parcelaDetalhes.total_parcelas || 1}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetalhesModal(false)}
                className="p-2 rounded-xl text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 print:hidden">
              
              {/* Credor Info */}
              <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-3">
                <div className="flex items-center gap-2 text-text-subtle text-xs font-semibold uppercase tracking-wider border-b border-border-default pb-2">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  Informações do Credor / Beneficiário
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-subtle block">Nome / Razão Social</span>
                    <span className="font-semibold text-text-base">{parcelaDetalhes.credor_nome || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">CPF / CNPJ</span>
                    <span className="font-semibold text-text-base">{parcelaDetalhes.credor_cpf_cnpj || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Tipo de Credor</span>
                    <span className="font-semibold text-text-base capitalize">{(parcelaDetalhes.tipo_credor || 'fornecedor').replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Centro de Custo</span>
                    <span className="font-semibold text-indigo-400">{despesaPai?.centro_custo || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* Parcela & Despesa Info */}
              <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-3">
                <div className="flex items-center gap-2 text-text-subtle text-xs font-semibold uppercase tracking-wider border-b border-border-default pb-2">
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  Dados da Parcela & Despesa
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-subtle block">Descrição</span>
                    <span className="font-semibold text-text-base">{parcelaDetalhes.descricao}</span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Categoria</span>
                    <span className="font-semibold text-text-base capitalize">{despesaPai?.categoria || 'Não informada'}</span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Valor da Parcela</span>
                    <span className="text-lg font-bold text-indigo-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcelaDetalhes.valor)}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Status</span>
                    <div className="mt-1">{getStatusBadge(parcelaDetalhes.status, parcelaDetalhes.data_vencimento)}</div>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Data de Vencimento</span>
                    <span className="font-semibold text-text-base">
                      {formatLocalDate(parcelaDetalhes.data_vencimento)}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Forma de Pagamento Prevista</span>
                    <span className="font-semibold text-text-base uppercase">{parcelaDetalhes.forma_pagamento || 'pix'}</span>
                  </div>
                  {despesaPai && (
                    <div>
                      <span className="text-text-subtle block">Valor Total da Despesa</span>
                      <span className="font-semibold text-text-base">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(despesaPai.valor_total)} ({despesaPai.qtd_parcelas}x)
                      </span>
                    </div>
                  )}
                  {despesaPai?.codigo_barras && (
                    <div className="md:col-span-2">
                      <span className="text-text-subtle block">Código de Barras / Linha Digitável</span>
                      <span className="font-mono text-xs bg-bg-base p-2 rounded block border border-border-default text-text-base select-all overflow-x-auto">
                        {despesaPai.codigo_barras}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status do Pagamento (Se Pago) */}
              {parcelaDetalhes.status === 'pago' && (
                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider border-b border-emerald-500/20 pb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Informações do Pagamento Efetivado
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-text-subtle block">Data do Pagamento</span>
                      <span className="font-semibold text-text-base">
                        {formatLocalDateTime(parcelaDetalhes.data_pagamento)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-subtle block">Valor Pago</span>
                      <span className="font-bold text-emerald-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcelaDetalhes.valor_pago || parcelaDetalhes.valor)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-subtle block">Forma Efetiva</span>
                      <span className="font-semibold text-text-base uppercase">{parcelaDetalhes.forma_pagamento_efetivo || 'pix'}</span>
                    </div>
                    <div>
                      <span className="text-text-subtle block">Pago Por</span>
                      <span className="font-semibold text-text-base">{parcelaDetalhes.pago_por || 'Sistema'}</span>
                    </div>
                    {parcelaDetalhes.observacao_pagamento && (
                      <div className="md:col-span-2">
                        <span className="text-text-subtle block">Observação do Pagamento</span>
                        <span className="font-medium text-text-base">{parcelaDetalhes.observacao_pagamento}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Observações da despesa */}
              {despesaPai?.observacoes && (
                <div className="bg-bg-surface p-4 rounded-xl border border-border-default">
                  <span className="text-text-subtle text-xs font-semibold uppercase tracking-wider block mb-1">Observações da Despesa</span>
                  <p className="text-sm text-text-base">{despesaPai.observacoes}</p>
                </div>
              )}

            </div>

            {/* Modal Footer Actions */}
            <div className="p-6 border-t border-border-default bg-bg-surface/50 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!canEditFinanceiro(state.user, state.isOnline)) {
                      alertPermissionRestriction('Financeiro (Contas a Pagar)', 'editar despesas ou parcelas existentes');
                      return;
                    }
                    setShowDetalhesModal(false);
                    navigate(`/financeiro/contas-a-pagar/${parcelaDetalhes.despesa_id || parcelaDetalhes.id}/editar?parcela=${parcelaDetalhes.id}`);
                  }}
                  disabled={parcelaDetalhes.status === 'pago'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${parcelaDetalhes.status === 'pago' ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400'}`}
                >
                  <Pencil className="w-4 h-4" />
                  Editar Despesa
                </button>
                <button
                  onClick={() => {
                    if (parcelaDetalhes.despesa_id) {
                      handleExcluirDespesaCompleta(parcelaDetalhes.despesa_id, parcelaDetalhes.descricao || '');
                    } else {
                      handleExcluirParcela(parcelaDetalhes);
                      setShowDetalhesModal(false);
                    }
                  }}
                  disabled={parcelaDetalhes.status === 'pago'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${parcelaDetalhes.status === 'pago' ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'}`}
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Despesa
                </button>
              </div>

              <div className="flex items-center gap-2">
                {(parcelaDetalhes.status === 'pendente' || parcelaDetalhes.status === 'atrasado') && (
                  <button
                    onClick={() => {
                      setShowDetalhesModal(false);
                      openBaixaModal(parcelaDetalhes);
                    }}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm transition-colors"
                  >
                    <DollarSign className="w-4 h-4" />
                    Pagar
                  </button>
                )}
                {parcelaDetalhes.status === 'pago' && (
                  <button
                    onClick={() => handleImprimirComprovante(parcelaDetalhes)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-500/20"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Comprovante
                  </button>
                )}
                <button
                  onClick={() => setShowDetalhesModal(false)}
                  className="px-5 py-2 rounded-xl bg-bg-surface border border-border-default text-text-muted hover:text-text-base transition-colors font-medium text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Relatório Interativo Modal */}
      <RelatorioContasPagarModal
        isOpen={showRelatorioModal}
        onClose={() => setShowRelatorioModal(false)}
        parcelas={filteredParcelas}
        despesas={despesas}
        empresaData={empresaData}
        currentFilters={{
          searchTerm,
          statusFilter,
          formaPagamentoFilter,
          dataInicial,
          dataFinal
        }}
        userName={state.user?.nome || 'Operador'}
      />

      {/* Visualizador de Comprovante / Recibo Modal */}
      {showReciboModal && reciboModalData && (
        <VisualizadorReciboModal
          isOpen={showReciboModal}
          onClose={() => setShowReciboModal(false)}
          dados={reciboModalData}
          empresaData={empresaData}
        />
      )}
    </div>
  );
};

