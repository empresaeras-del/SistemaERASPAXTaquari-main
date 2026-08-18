import { useColumnVisibility } from '../hooks/useColumnVisibility';
import React, { useState, useEffect, useMemo } from 'react';
import { AdvancedFilterBar } from '../components/layout/AdvancedFilterBar';
import { useAppContext } from '../context/AppContext';
import { getContasBancariasAtivas } from '../services/contasBancariasService';
import { ContaBancaria } from '../types/contasBancarias';
import { useConfirm } from '../context/ConfirmContext';
import {
  getParcelasReceber,
  ParcelaReceber,
  registrarRecebimento,
  excluirParcelaReceber,
  excluirReceita,
  getReceitaById,
  Receita
} from '../services/financeiroService';
import { getLoteAbertoAtivo, registrarMovimentacao } from '../services/caixasService';
import { getEmpresaById, Empresa } from '../services/empresasService';
import { LoteCaixa } from '../types/caixas';
import { canDelete } from '../utils/permissions';
import {
   Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Eye,
  Pencil,
  Trash2,
  DollarSign,
  FileText,
  User,
  Calendar,
  CreditCard,
  Building2,
  AlertTriangle,
  Lock,
  Wallet,
  ArrowRight,
  ShieldAlert
, ChevronUp, ChevronDown, Printer, MessageCircle } from "lucide-react";
import { format } from 'date-fns';
import { parseLocalDate, formatLocalDate, formatLocalDateTime, isDateBeforeToday, isDateToday } from '../utils/dateUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { sendWhatsAppMessage, generateCobrançaTemplate } from '../utils/whatsapp';

export const ContasReceberPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useAppContext();
  const { confirm } = useConfirm();

  const handleWhatsAppCobrança = async (parcela: ParcelaReceber) => {
    const msg = await generateCobrançaTemplate(
      parcela.devedor_nome || 'Cliente', 
      parcela.valor, 
      formatLocalDate(parcela.data_vencimento)
    );
    const phonePrompt = window.prompt("Confirme ou digite o WhatsApp do cliente (com DDD):", "");
    if (phonePrompt) {
        const success = sendWhatsAppMessage(phonePrompt, msg);
        if (!success) toast.error("Número de telefone inválido.");
    }
  };


  const [parcelas, setParcelas] = useState<ParcelaReceber[]>([]);
  const [loading, setLoading] = useState(true);
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

  const { visibleColumns, isVisible, setVisibleColumns } = useColumnVisibility(['devedor', 'descricao', 'vencimento', 'valor', 'status', 'acoes']);
  const columns = [
    { id: 'devedor', label: 'Devedor' },
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
  const [sortField, setSortField] = useState<'devedor' | 'vencimento' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal de Baixa/Recebimento
  const [showBaixaModal, setShowBaixaModal] = useState(false);
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaReceber | null>(null);
  const [dataRecebimento, setDataRecebimento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [valorRecebido, setValorRecebido] = useState<number>(0);
  const [formaPagamentoEfetiva, setFormaPagamentoEfetiva] = useState<string>('pix');
  const [observacaoRecebimento, setObservacaoRecebimento] = useState<string>('');
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [contaBancariaId, setContaBancariaId] = useState<string>('');

  // Verificação e fluxo do Lote de Caixa
  const [modalStage, setModalStage] = useState<'form' | 'confirmacao' | 'bloqueio'>('form');
  const [loteAberto, setLoteAberto] = useState<LoteCaixa | null>(null);
  const [checkingLote, setCheckingLote] = useState(false);
  const [submittingBaixa, setSubmittingBaixa] = useState(false);

  // Modal de Detalhes
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [parcelaDetalhes, setParcelaDetalhes] = useState<ParcelaReceber | null>(null);
  const [receitaPai, setReceitaPai] = useState<Receita | null>(null);
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
      const data = await getParcelasReceber(state.isOnline, state.empresaSelecionada);
      setParcelas(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar parcelas a receber');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  const filteredParcelas = useMemo(() => {
    return parcelas.filter(p => {
      const matchesSearch = (p.devedor_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (p.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (p.devedor_cpf_cnpj || '').includes(searchTerm);
      const matchesStatus = statusFilter ? p.status === statusFilter : true;
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
      if (sortField === 'devedor') {
        const nameA = a.devedor_nome || '';
        const nameB = b.devedor_nome || '';
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

  const totais = useMemo(() => {
    return parcelas.reduce((acc, p) => {
      if (p.status === 'pendente') {
        acc.aReceber += p.valor;
        if (isDateBeforeToday(p.data_vencimento)) {
          acc.vencidas += p.valor;
        } else if (isDateToday(p.data_vencimento)) {
          acc.venceHoje += p.valor;
        }
      } else if (p.status === 'recebido') {
        acc.recebidas += p.valor_recebido || p.valor;
      }
      return acc;
    }, { aReceber: 0, vencidas: 0, venceHoje: 0, recebidas: 0 });
  }, [parcelas]);

  const openBaixaModal = (parcela: ParcelaReceber) => {
    setParcelaSelecionada(parcela);
    setDataRecebimento(format(new Date(), 'yyyy-MM-dd'));
    setValorRecebido(parcela.valor);
    setFormaPagamentoEfetiva(parcela.forma_pagamento || 'pix');
    setContaBancariaId(parcela.conta_bancaria_id || (contasBancarias.length > 0 ? contasBancarias[0].id : ''));
    setObservacaoRecebimento('');
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

  const handleEfetivarRecebimento = async () => {
    if (!parcelaSelecionada || !loteAberto) return;

    setSubmittingBaixa(true);
    try {
      await registrarRecebimento(state.isOnline, parcelaSelecionada.id, {
        data_recebimento: dataRecebimento ? new Date(dataRecebimento + "T12:00:00").toISOString() : new Date().toISOString(),
        valor_recebido: Number(valorRecebido) || parcelaSelecionada.valor,
        forma_pagamento_efetivo: formaPagamentoEfetiva,
        conta_bancaria_id: formaPagamentoEfetiva !== 'dinheiro' ? contaBancariaId : null,
        recebido_por: state.user?.nome || 'Sistema',
        observacao: observacaoRecebimento
      });

      // Registra a movimentação financeira diretamente no Lote de Caixa Aberto
      await registrarMovimentacao(state.isOnline, {
        tenant_id: state.empresaSelecionada || 'tenant-default',
        lote_id: loteAberto.id,
        tipo: 'entrada',
        origem: 'contas_receber',
        categoria: 'Receita / Mensalidade',
        descricao: `Recebimento: ${parcelaSelecionada.devedor_nome} - ${parcelaSelecionada.descricao}`,
        valor: Number(valorRecebido) || parcelaSelecionada.valor,
        forma_pagamento: formaPagamentoEfetiva as any,
        data_movimentacao: dataRecebimento ? new Date(dataRecebimento + "T12:00:00").toISOString() : new Date().toISOString(),
        referencia_id: parcelaSelecionada.id,
        documento_ref: `Parc. ${parcelaSelecionada.numero_parcela}/${parcelaSelecionada.total_parcelas || 1}`,
        operador_nome: state.user?.nome || loteAberto.operador_nome || 'Sistema',
        observacao: observacaoRecebimento
      });

      toast.success(`Recebimento registrado com sucesso no Lote ${loteAberto.codigo_lote}!`);
      setShowBaixaModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao efetivar recebimento');
    } finally {
      setSubmittingBaixa(false);
    }
  };

  const openDetalhes = async (parcela: ParcelaReceber) => {
    setParcelaDetalhes(parcela);
    setShowDetalhesModal(true);
    if (parcela.receita_id) {
      const parent = await getReceitaById(state.isOnline, parcela.receita_id);
      setReceitaPai(parent);
    } else {
      setReceitaPai(null);
    }
  };

  const handleExcluirParcela = (parcela: ParcelaReceber) => {
    if (!canDelete(state.user)) {
      toast.error('Permissão negada. Somente usuários Administradores podem excluir registros no sistema.');
      return;
    }

    confirm({
      title: 'Excluir Parcela',
      message: `Deseja realmente excluir a parcela ${parcela.numero_parcela}/${parcela.total_parcelas} de R$ ${parcela.valor.toFixed(2)} (${parcela.devedor_nome})?`,
      confirmText: 'Excluir Parcela',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        try {
          await excluirParcelaReceber(state.isOnline, parcela.id);
          setParcelas(prev => prev.filter(p => p.id !== parcela.id));
          toast.success('Parcela excluída com sucesso!');
          loadData();
        } catch (e) {
          toast.error('Erro ao excluir parcela');
        }
      }
    });
  };

  const handleExcluirReceitaCompleta = (receitaId: string, descricao: string) => {
    if (!canDelete(state.user)) {
      toast.error('Permissão negada. Somente usuários Administradores podem excluir registros no sistema.');
      return;
    }

    confirm({
      title: 'Excluir Receita Inteira',
      message: `Atenção: Esta ação excluirá permanentemente a receita "${descricao}" e TODAS as suas parcelas vinculadas. Deseja continuar?`,
      confirmText: 'Excluir Tudo',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        try {
          await excluirReceita(state.isOnline, receitaId);
          setParcelas(prev => prev.filter(p => p.receita_id !== receitaId));
          toast.success('Receita e parcelas excluídas com sucesso!');
          if (showDetalhesModal) setShowDetalhesModal(false);
          loadData();
        } catch (e) {
          toast.error('Erro ao excluir receita');
        }
      }
    });
  };

  const getStatusBadge = (status: string, vencimento: string) => {
    if (status === 'recebido') return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">Recebido</span>;
    if (status === 'cancelado') return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-text-subtle">Cancelado</span>;

    if (isDateBeforeToday(vencimento)) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500">Vencido</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">Pendente</span>;
  };

  return (
    <>
    <div className={`p-6 max-w-7xl mx-auto flex flex-col h-full overflow-hidden`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-text-base">Contas a Receber</h1>
          <p className="text-text-subtle mt-1">Gestão de recebimentos e mensalidades</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border-default text-text-subtle text-sm font-semibold rounded-xl hover:text-text-base hover:bg-bg-hover transition-colors"
            title="Exportar listagem para PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
          <button onClick={() => navigate('/financeiro/contas-a-receber/nova')} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/20">
          <Plus className="w-5 h-5" />
          Nova Receita
        </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 print:hidden">
        <div className="bg-bg-subtle border border-border-default p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-text-subtle font-medium">Total a Receber</span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-base">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.aReceber)}
          </div>
        </div>
        <div className="bg-bg-subtle border border-border-default p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-text-subtle font-medium">Vencidas</span>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-base">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.vencidas)}
          </div>
        </div>
        <div className="bg-bg-subtle border border-border-default p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-text-subtle font-medium">Vence Hoje</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-base">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.venceHoje)}
          </div>
        </div>
        <div className="bg-bg-subtle border border-border-default p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-text-subtle font-medium">Recebidas</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-base">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.recebidas)}
          </div>
        </div>
      </div>

      <div className="bg-bg-subtle border border-border-default rounded-2xl flex-1 flex flex-col overflow-hidden print:hidden">
        <div className="p-4 border-b border-border-default">
          <div className="p-4 border-b border-border-default">
          <AdvancedFilterBar
            pageKey="contas-receber"
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
                  placeholder="Nome, documento ou descrição..."
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
                <option value="recebido">Recebido</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-subtle">Forma de Recebimento</label>
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
                    if (sortField === 'devedor') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('devedor');
                      setSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Devedor
                    {sortField === 'devedor' && (
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
                      <div className="font-medium text-text-base">{parcela.devedor_nome || 'Não informado'}</div>
                      <div className="text-sm text-text-subtle">{(parcela.tipo_devedor || 'associado').replace('_', ' ').toUpperCase()}</div>
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
                        
                        {/* WhatsApp Cobrança */}
                        <button
                          onClick={() => handleWhatsAppCobrança(parcela)}
                          title="Enviar Cobrança via WhatsApp"
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        
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
                          onClick={() => navigate(`/financeiro/contas-a-receber/${parcela.receita_id || parcela.id}/editar?parcela=${parcela.id}`)}
                          title="Editar Receita"
                          disabled={parcela.status === 'recebido'}
                          className={`p-1.5 rounded-lg transition-colors ${parcela.status === 'recebido' ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400'}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Excluir Parcela */}
                        <button
                          onClick={() => handleExcluirParcela(parcela)}
                          title="Excluir Parcela"
                          disabled={parcela.status === 'recebido'}
                          className={`p-1.5 rounded-lg transition-colors ${parcela.status === 'recebido' ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {/* Botão Receber */}
                        {(parcela.status === 'pendente' || parcela.status === 'atrasado') && (
                          <button
                            onClick={() => openBaixaModal(parcela)}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ml-1"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Receber
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
    </div>

      {/* MODAL DE BAIXA / RECEBIMENTO */}
      {showBaixaModal && parcelaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-subtle border border-border-default rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            
            {/* ETAPA 1: FORMULÁRIO DE RECEBIMENTO */}
            {modalStage === 'form' && (
              <>
                <div className="flex items-center justify-between p-6 border-b border-border-default">
                  <h3 className="text-xl font-bold text-text-base flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    Registrar Recebimento
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
                    <p className="text-sm text-text-subtle">Devedor: <span className="text-text-base font-medium">{parcelaSelecionada.devedor_nome}</span></p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-subtle mb-1">Data do Recebimento *</label>
                    <input
                      type="date"
                      value={dataRecebimento}
                      onChange={(e) => setDataRecebimento(e.target.value)}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-subtle mb-1">Valor Recebido (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorRecebido}
                      onChange={(e) => setValorRecebido(Number(e.target.value))}
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
                    <label className="block text-sm font-medium text-text-subtle mb-1">Observações do Recebimento</label>
                    <textarea
                      rows={2}
                      value={observacaoRecebimento}
                      onChange={(e) => setObservacaoRecebimento(e.target.value)}
                      placeholder="Ex: Recebido em dinheiro no balcão"
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
                        'Confirmar Recebimento'
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
                      Não é possível registrar o recebimento
                    </div>
                    <p className="text-sm text-text-subtle leading-relaxed">
                      Para efetivar este registro de recebimento, o sistema exige que exista um <strong>Lote de Caixa aberto</strong> ativo para receber a movimentação financeira.
                    </p>
                  </div>

                  <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-2">
                    <p className="text-sm font-semibold text-text-base flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-[#3B82F6]" />
                      Orientação ao Usuário:
                    </p>
                    <p className="text-xs text-text-subtle leading-relaxed">
                      Por favor, acesse o módulo de <strong>Caixas / Lotes</strong> e realize a abertura de um novo lote de caixa antes de realizar este recebimento.
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
                      <Wallet className="w-4 h-4" /> Lote de Caixa Destino
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
                  <p className="text-xs text-text-subtle uppercase tracking-wider font-semibold">Resumo do Recebimento</p>
                  
                  <div className="flex justify-between items-center py-1 border-b border-border-default">
                    <span className="text-text-subtle text-xs">Devedor:</span>
                    <span className="font-semibold text-text-base text-xs">{parcelaSelecionada.devedor_nome}</span>
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
                    <span className="text-text-subtle font-medium text-sm">Valor a Efetivar:</span>
                    <span className="text-xl font-bold text-emerald-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorRecebido)}
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
                    onClick={handleEfetivarRecebimento}
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
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-base">Detalhes da Contas a Receber</h3>
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
              
              {/* Devedor Info */}
              <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-3">
                <div className="flex items-center gap-2 text-text-subtle text-xs font-semibold uppercase tracking-wider border-b border-border-default pb-2">
                  <User className="w-4 h-4 text-blue-400" />
                  Informações do Devedor
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-subtle block">Nome / Razão Social</span>
                    <span className="font-semibold text-text-base">{parcelaDetalhes.devedor_nome || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">CPF / CNPJ</span>
                    <span className="font-semibold text-text-base">{parcelaDetalhes.devedor_cpf_cnpj || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Tipo de Devedor</span>
                    <span className="font-semibold text-text-base capitalize">{(parcelaDetalhes.tipo_devedor || 'associado').replace('_', ' ')}</span>
                  </div>
                  {receitaPai?.associado_plano && (
                    <div>
                      <span className="text-text-subtle block">Plano do Associado</span>
                      <span className="font-semibold text-emerald-400">{receitaPai.associado_plano}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Parcela & Receita Info */}
              <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-3">
                <div className="flex items-center gap-2 text-text-subtle text-xs font-semibold uppercase tracking-wider border-b border-border-default pb-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  Dados da Parcela & Cobrança
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-subtle block">Descrição</span>
                    <span className="font-semibold text-text-base">{parcelaDetalhes.descricao}</span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Categoria</span>
                    <span className="font-semibold text-text-base capitalize">{receitaPai?.categoria || 'Não informada'}</span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Valor da Parcela</span>
                    <span className="text-lg font-bold text-emerald-400">
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
                  {receitaPai && (
                    <div>
                      <span className="text-text-subtle block">Valor Total da Receita</span>
                      <span className="font-semibold text-text-base">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitaPai.valor_total)} ({receitaPai.qtd_parcelas}x)
                      </span>
                    </div>
                  )}
                  {receitaPai?.data_emissao && (
                    <div>
                      <span className="text-text-subtle block">Data de Emissão</span>
                      <span className="font-semibold text-text-base">
                        {formatLocalDate(receitaPai.data_emissao)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status do Recebimento (Se Recebido) */}
              {parcelaDetalhes.status === 'recebido' && (
                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider border-b border-emerald-500/20 pb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Informações do Recebimento Efetivado
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-text-subtle block">Data do Recebimento</span>
                      <span className="font-semibold text-text-base">
                        {formatLocalDateTime(parcelaDetalhes.data_recebimento)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-subtle block">Valor Recebido</span>
                      <span className="font-bold text-emerald-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcelaDetalhes.valor_recebido || parcelaDetalhes.valor)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-subtle block">Forma Efetiva</span>
                      <span className="font-semibold text-text-base uppercase">{parcelaDetalhes.forma_pagamento_efetivo || 'pix'}</span>
                    </div>
                    <div>
                      <span className="text-text-subtle block">Recebido Por</span>
                      <span className="font-semibold text-text-base">{parcelaDetalhes.recebido_por || 'Sistema'}</span>
                    </div>
                    {parcelaDetalhes.observacao_recebimento && (
                      <div className="md:col-span-2">
                        <span className="text-text-subtle block">Observação do Recebimento</span>
                        <span className="font-medium text-text-base">{parcelaDetalhes.observacao_recebimento}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Observações da receita */}
              {receitaPai?.observacoes && (
                <div className="bg-bg-surface p-4 rounded-xl border border-border-default">
                  <span className="text-text-subtle text-xs font-semibold uppercase tracking-wider block mb-1">Observações da Receita</span>
                  <p className="text-sm text-text-base">{receitaPai.observacoes}</p>
                </div>
              )}

            </div>

            {/* Modal Footer Actions */}
            <div className="p-6 border-t border-border-default bg-bg-surface/50 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowDetalhesModal(false);
                    navigate(`/financeiro/contas-a-receber/${parcelaDetalhes.receita_id || parcelaDetalhes.id}/editar?parcela=${parcelaDetalhes.id}`);
                  }}
                  disabled={parcelaDetalhes.status === 'recebido'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${parcelaDetalhes.status === 'recebido' ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400'}`}
                >
                  <Pencil className="w-4 h-4" />
                  Editar Receita
                </button>
                <button
                  onClick={() => {
                    if (parcelaDetalhes.receita_id) {
                      handleExcluirReceitaCompleta(parcelaDetalhes.receita_id, parcelaDetalhes.descricao);
                    } else {
                      handleExcluirParcela(parcelaDetalhes);
                      setShowDetalhesModal(false);
                    }
                  }}
                  disabled={parcelaDetalhes.status === 'recebido'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${parcelaDetalhes.status === 'recebido' ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'}`}
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Receita
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
                    Receber
                  </button>
                )}
                {parcelaDetalhes.status === 'recebido' && (
                  <button
                    onClick={() => {
                      setTimeout(() => {
                        window.print();
                      }, 100);
                    }}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Recibo
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

            {/* Recibo de Pagamento - Somente Impressão */}
            <div className="hidden print:block p-8 font-sans bg-white text-black print:!bg-white print:!text-black">
              {/* Cabeçalho com Logotipo da Empresa alinhado às margens */}
              {empresaData?.logo_url ? (
                <div className="text-center pb-4 mb-6 border-b-2 border-black">
                  <img 
                    src={empresaData.logo_url} 
                    alt={empresaData.nome_fantasia || "Logotipo"} 
                    className="max-h-20 w-full object-contain mx-auto mb-2"
                    style={{ maxHeight: '80px', width: '100%', objectFit: 'contain' }}
                  />
                  <h1 className="text-2xl font-bold uppercase tracking-wider">Recibo de Pagamento</h1>
                  <p className="text-gray-600 text-sm">Nº {parcelaDetalhes.id.split('-')[0].toUpperCase()}</p>
                </div>
              ) : (
                <div className="text-center border-b-2 border-black pb-4 mb-6">
                  <h2 className="text-lg font-bold text-gray-800 uppercase mb-1">
                    {empresaData?.nome_fantasia || empresaData?.razao_social || 'EMPRESA'}
                  </h2>
                  <h1 className="text-3xl font-bold uppercase tracking-wider mb-1">Recibo de Pagamento</h1>
                  <p className="text-gray-600 text-sm">Nº {parcelaDetalhes.id.split('-')[0].toUpperCase()}</p>
                </div>
              )}

              <div className="flex justify-between items-center mb-8">
                <div>
                  <p className="text-gray-600 text-sm uppercase font-bold">Data de Emissão</p>
                  <p className="font-medium text-lg">{format(new Date(), "dd/MM/yyyy")}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-600 text-sm uppercase font-bold">Valor Recebido</p>
                  <p className="font-bold text-2xl">
                    {Number(parcelaDetalhes.valor_recebido || parcelaDetalhes.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-gray-600 text-sm uppercase font-bold mb-1">Recebemos de:</p>
                  <div className="border border-gray-300 p-4 rounded-lg bg-gray-50">
                    <p className="font-bold text-lg">{parcelaDetalhes.devedor_nome || 'Cliente'}</p>
                    <p className="text-gray-700">CPF/CNPJ: {parcelaDetalhes.devedor_cpf_cnpj || 'Não informado'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-600 text-sm uppercase font-bold mb-1">Referente a:</p>
                  <div className="border border-gray-300 p-4 rounded-lg bg-gray-50">
                    <p className="font-medium text-lg">{parcelaDetalhes.descricao || 'Recebimento'}</p>
                    <p className="text-gray-700">Parcela: {parcelaDetalhes.numero_parcela} de {parcelaDetalhes.total_parcelas || 1}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex justify-between text-sm border-b border-gray-300 pb-2">
                  <span className="text-gray-600 font-bold uppercase">Forma de Pagamento:</span>
                  <span className="font-medium uppercase">{parcelaDetalhes.forma_pagamento_efetivo || parcelaDetalhes.forma_pagamento || '-'}</span>
                </div>
                <div className="flex justify-between text-sm border-b border-gray-300 pb-2">
                  <span className="text-gray-600 font-bold uppercase">Data do Recebimento:</span>
                  <span className="font-medium">{formatLocalDateTime(parcelaDetalhes.data_recebimento)}</span>
                </div>
                <div className="flex justify-between text-sm border-b border-gray-300 pb-2">
                  <span className="text-gray-600 font-bold uppercase">Recebido por:</span>
                  <span className="font-medium uppercase">{parcelaDetalhes.recebido_por || 'Sistema'}</span>
                </div>
              </div>

              {/* Rodapé com Assinatura da Empresa */}
              <div className="mt-14 pt-6 border-t-2 border-black flex flex-col items-center justify-center text-center print:break-inside-avoid">
                {empresaData?.assinatura_url && (
                  <div className="mb-2 flex justify-center">
                    <img 
                      src={empresaData.assinatura_url} 
                      alt="Assinatura da Empresa" 
                      style={{ maxHeight: '75px', maxWidth: '240px', objectFit: 'contain' }}
                    />
                  </div>
                )}
                <div className="w-64 border-b border-black mb-1"></div>
                <p className="text-sm font-bold uppercase tracking-wider">
                  {empresaData?.nome_fantasia || empresaData?.razao_social || 'Assinatura / Carimbo'}
                </p>
                {empresaData?.cnpj && (
                  <p className="text-xs text-gray-600">CNPJ: {empresaData.cnpj}</p>
                )}
                <p className="text-[11px] text-gray-500 mt-1">Este recibo comprova o pagamento do valor especificado acima.</p>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

