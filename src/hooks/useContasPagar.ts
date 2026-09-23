import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAppContext } from '../context/AppContext';
import { getParcelasPagar, getDespesas, getDespesaById, registrarPagamento, excluirParcelaPagar, excluirDespesa, ParcelaPagar, Despesa } from '../services/financeiroService';
import { getLoteAbertoAtivo, registrarMovimentacao } from '../services/caixasService';
import { tenantDeEscrita, MENSAGEM_TENANT_INDEFINIDO } from '../utils/tenant';
import { avisoLiquidacaoSemCaixa } from '../utils/avisoLiquidacaoSemCaixa';
import { usePlanoContabil } from '../hooks/usePlanoContabil';
import { useCentrosCusto } from '../hooks/useCentrosCusto';
import { indicePorLancamento, parcelaCasaClassificacao } from '../utils/filtrosClassificacao';
import { LoteCaixa } from '../types/caixas';
import { getContasBancariasAtivas } from '../services/contasBancariasService';
import { ContaBancaria } from '../types/contasBancarias';
import { getEmpresaById, Empresa } from '../services/empresasService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { parseLocalDate, formatLocalDate, formatLocalDateTime, isDateBeforeToday, isDateToday } from '../utils/dateUtils';
import { canDelete } from '../utils/permissions';
import { useConfirm } from '../context/ConfirmContext';
import { useColumnVisibility } from '../hooks/useColumnVisibility';

import { ReciboDados } from '../components/financeiro/VisualizadorReciboModal';

/**
 * O estado e os dados da tela de Contas a Pagar, extraídos VERBATIM do corpo de
 * `pages/ContasPagarPage.tsx` (1333 linhas) — carga, filtros, ordenação, os dois modais e os
 * handlers de baixa, exclusão e comprovante.
 *
 * A fronteira é "não devolve JSX": `getStatusBadge` ficou no componente, e não por
 * conveniência — é a única função daquele corpo que vira pixel, e um `.ts` sequer compila com
 * ela dentro.
 *
 * As fatias de UI tipam as próprias props com `Pick<ReturnType<typeof useContasPagar>, …>`,
 * então acrescentar ou renomear um campo do retorno é cobrado pelo `tsc` em cada uma delas.
 */
export const useContasPagar = () => {
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
  const [contaContabilFilter, setContaContabilFilter] = useState('');
  const [centroCustoFilter, setCentroCustoFilter] = useState('');

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

  // Opções dos filtros de classificação. Inclui conta/centro desativados de propósito: um
  // lançamento antigo pode apontar para um deles, e sem a opção na lista ele viraria
  // infiltrável.
  const { contas: contasContabeis } = usePlanoContabil();
  const { centros: centrosCusto } = useCentrosCusto();
  const contasDespesa = useMemo(
    () => contasContabeis.filter((c) => c.tipo === 'analitica' && c.natureza === 'despesa'),
    [contasContabeis],
  );

  // A parcela não carrega a classificação — quem carrega é a despesa. O índice resolve o pai
  // em O(1) por linha, em vez de varrer a lista de despesas a cada parcela filtrada.
  const indiceDespesas = useMemo(() => indicePorLancamento(despesas), [despesas]);

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
      
      const matchesClassificacao = parcelaCasaClassificacao(p.despesa_id, indiceDespesas, {
        contaContabilId: contaContabilFilter,
        centroCustoId: centroCustoFilter,
      });

      return matchesSearch && matchesStatus && matchesForma && matchesData && matchesClassificacao;
    });
  }, [parcelas, searchTerm, statusFilter, formaPagamentoFilter, dataInicial, dataFinal,
      indiceDespesas, contaContabilFilter, centroCustoFilter]);

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

    // O lote precisa ser o DESTA empresa. `getLotesCaixa` trata 'all' como "sem filtro",
    // então o super_admin sem empresa escolhida pegaria o lote aberto de outra e o
    // pagamento cairia no caixa dela — o mesmo defeito já corrigido do lado do recebimento.
    const tenantId = tenantDeEscrita(state.empresaSelecionada, state.user?.tenant_id);
    if (!tenantId) {
      toast.error(MENSAGEM_TENANT_INDEFINIDO);
      return;
    }

    setCheckingLote(true);
    try {
      const activeLote = await getLoteAbertoAtivo(state.isOnline, tenantId);
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

    // A empresa da movimentação é a MESMA do lote já aberto, não a do seletor do topo:
    // é nela que o dinheiro está saindo. Resolver de novo pelo seletor abriria espaço para
    // as duas discordarem se a seleção mudar entre abrir o modal e confirmar a baixa.
    const tenantId = tenantDeEscrita(loteAberto.tenant_id, state.user?.tenant_id);
    if (!tenantId) {
      toast.error(MENSAGEM_TENANT_INDEFINIDO);
      return;
    }

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

      // Registra a movimentação financeira diretamente no Lote de Caixa Aberto.
      // A baixa acima já valeu: uma recusa aqui não a desfaz, e o aviso diz o que faltou.
      let caixaLancado = true;
      try {
        await registrarMovimentacao(state.isOnline, {
        tenant_id: tenantId,
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
      } catch (errCaixa: any) {
        caixaLancado = false;
        console.error('Movimentação de caixa recusada após a baixa da parcela:', errCaixa);
        toast.error(avisoLiquidacaoSemCaixa('pagamento', errCaixa?.message), { duration: 12000 });
      }

      if (caixaLancado) {
        toast.success(`Pagamento registrado com sucesso no Lote ${loteAberto.codigo_lote}!`);
      }
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

  return {
    navigate,
    state,
    parcelas,
    despesas,
    loading,
    showRelatorioModal,
    setShowRelatorioModal,
    showReciboModal,
    setShowReciboModal,
    reciboModalData,
    searchTerm,
    setSearchTerm,
    contaContabilFilter,
    setContaContabilFilter,
    centroCustoFilter,
    setCentroCustoFilter,
    isVisible,
    statusFilter,
    setStatusFilter,
    showFilters,
    setShowFilters,
    dataInicial,
    setDataInicial,
    dataFinal,
    setDataFinal,
    formaPagamentoFilter,
    setFormaPagamentoFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    showBaixaModal,
    setShowBaixaModal,
    parcelaSelecionada,
    dataPagamento,
    setDataPagamento,
    valorPago,
    setValorPago,
    formaPagamentoEfetiva,
    setFormaPagamentoEfetiva,
    observacaoPagamento,
    setObservacaoPagamento,
    contasBancarias,
    contaBancariaId,
    setContaBancariaId,
    modalStage,
    setModalStage,
    loteAberto,
    checkingLote,
    submittingBaixa,
    showDetalhesModal,
    setShowDetalhesModal,
    parcelaDetalhes,
    despesaPai,
    empresaData,
    centrosCusto,
    contasDespesa,
    filteredParcelas,
    sortedParcelas,
    openBaixaModal,
    handleBaixa,
    handleEfetivarPagamento,
    openDetalhes,
    handleExcluirParcela,
    handleExcluirDespesaCompleta,
    handleImprimirComprovante,
  };
};
