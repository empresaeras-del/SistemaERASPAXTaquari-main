import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { usePrintPreview } from '../hooks/usePrintPreview';
import { RemessaFaturamento, StatusRemessa, TipoPrestadorFaturamento, FiltroRemessas } from '../types/faturamento';
import { Requisicao } from '../types/requisicoes';
import { 
  getRemessas, 
  criarRemessa, 
  atualizarRemessa, 
  fecharRemessaEGerarContaPagar,
  reabrirRemessa, 
  gerarPDFRelatorioFaturamento 
} from '../services/faturamentoService';
import { getRequisicoes } from '../services/requisicoesService';
import { getEmpresaById } from '../services/empresasService';
import { useCredenciados } from '../hooks/useCredenciados';
import { FormaPagamento } from '../types/financeiro';
import { 
  Receipt as ReceiptIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  Building2 as Building2Icon,
  CheckCircle2 as CheckCircle2Icon,
  Clock as ClockIcon,
  XCircle as XCircleIcon,
  Printer as PrinterIcon,
  FileCheck2 as FileCheck2Icon,
  Calendar as CalendarIcon,
  DollarSign as DollarSignIcon,
  Eye as EyeIcon,
  X as XIcon,
  Check as CheckIcon,
  FileText as FileTextIcon,
  ShieldCheck as ShieldCheckIcon,
  AlertCircle as AlertCircleIcon,
  Trash2 as Trash2Icon,
  Lock as LockIcon,
  ChevronRight as ChevronRightIcon
, RefreshCw, Pencil as PencilIcon } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { formatLocalDate, formatLocalDateTime } from '../utils/dateUtils';
import toast from 'react-hot-toast';

export const FaturamentosPage: React.FC = () => {
  const { state } = useAppContext();
  const { credenciados } = useCredenciados();

  // Data States
  const [remessas, setRemessas] = useState<RemessaFaturamento[]>([]);
  const [todasRequisicoes, setTodasRequisicoes] = useState<Requisicao[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filtros, setFiltros] = useState<FiltroRemessas>({
    busca: '',
    status: '',
    tipoPrestador: ''
  });

  // Modals
  const [modalNovaRemessa, setModalNovaRemessa] = useState(false);
  const [isPreviewPrint, setIsPreviewPrint] = useState(false);
  usePrintPreview(isPreviewPrint);
  const [editingRemessa, setEditingRemessa] = useState<RemessaFaturamento | null>(null);
  const [modalDetalhes, setModalDetalhes] = useState<RemessaFaturamento | null>(null);
  const [modalFecharRemessa, setModalFecharRemessa] = useState<RemessaFaturamento | null>(null);

  const [modalReabrirRemessa, setModalReabrirRemessa] = useState<RemessaFaturamento | null>(null);
  const [justificativaReabertura, setJustificativaReabertura] = useState('');


  // Form State: Nova Remessa
  const [tipoPrestador, setTipoPrestador] = useState<TipoPrestadorFaturamento>('credenciado');
  const [selCredenciadoId, setSelCredenciadoId] = useState('');
  const [redeExternaNome, setRedeExternaNome] = useState('');
  const [redeExternaCnpj, setRedeExternaCnpj] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [valorGlosa, setValorGlosa] = useState<number | ''>(0);

  // Selected Requisition IDs for inclusion
  const [requisicoesSelecionadasIds, setRequisicoesSelecionadasIds] = useState<string[]>([]);

  // Form State: Fechamento & Financeiro
  const [dataVencimentoFinanceiro, setDataVencimentoFinanceiro] = useState(
    format(addDays(new Date(), 15), 'yyyy-MM-dd')
  );
  const [formaPagamentoFinanceiro, setFormaPagamentoFinanceiro] = useState<FormaPagamento>('pix');
  const [processandoFechamento, setProcessandoFechamento] = useState(false);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const tenantId = state.empresaSelecionada || 'all';
      const [rems, reqs] = await Promise.all([
        getRemessas(state.isOnline, tenantId),
        getRequisicoes(state.isOnline, tenantId)
      ]);
      setRemessas(rems);
      setTodasRequisicoes(reqs);
    } catch (e) {
      console.error('Erro ao carregar remessas de faturamento:', e);
      toast.error('Erro ao carregar dados de faturamento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  // Find set of requisition IDs already assigned to active (non-cancelled) remittances
  const reqsJaFaturadasIds = useMemo(() => {
    const setIds = new Set<string>();
    remessas.forEach(r => {
      if (r.status !== 'cancelada' && r.id !== editingRemessa?.id) {
        r.requisicao_ids.forEach(id => setIds.add(id));
      }
    });
    return setIds;
  }, [remessas, editingRemessa]);

  // Filter requisitions available for billing based on selected provider
  const requisicoesElegiveisParaRemessa = useMemo(() => {
    return todasRequisicoes.filter(req => {
      // Must be valid (not cancelled)
      // Only allow 'realizada' status
      if (req.status !== 'realizada') return false;

      // Must not already be included in another non-cancelled remittance
      if (reqsJaFaturadasIds.has(req.id)) return false;

      // Filter by Provider type
      if (tipoPrestador === 'credenciado') {
        if (!selCredenciadoId) return false;
        const credObj = credenciados.find(c => c.id === selCredenciadoId);
        const credNome = credObj ? (credObj.nome_fantasia || credObj.razao_social) : '';
        return (
          req.credenciado_id === selCredenciadoId ||
          (Boolean(credNome) && Boolean(req.credenciado_nome) && req.credenciado_nome.toLowerCase().trim() === credNome.toLowerCase().trim())
        );
      } else {
        if (!redeExternaNome) return false;
        return (
          req.tipo_prestador === 'rede_externa' &&
          Boolean(req.credenciado_nome) &&
          req.credenciado_nome.toLowerCase().trim() === redeExternaNome.toLowerCase().trim()
        );
      }
    });
  }, [todasRequisicoes, reqsJaFaturadasIds, tipoPrestador, selCredenciadoId, redeExternaNome, credenciados]);

  // Selected requisitions objects
  const reqsSelecionadasObjs = useMemo(() => {
    return requisicoesElegiveisParaRemessa.filter(r => requisicoesSelecionadasIds.includes(r.id));
  }, [requisicoesElegiveisParaRemessa, requisicoesSelecionadasIds]);

  // Calculation of totals for the new remittance
  const valorBrutoNovaRemessa = useMemo(() => {
    return reqsSelecionadasObjs.reduce((acc, r) => acc + r.valor_total, 0);
  }, [reqsSelecionadasObjs]);

  const valorLiquidoNovaRemessa = useMemo(() => {
    const glosa = Number(valorGlosa) || 0;
    return Math.max(0, valorBrutoNovaRemessa - glosa);
  }, [valorBrutoNovaRemessa, valorGlosa]);

  // Handle Select All / Unselect All
  const handleToggleSelectAll = () => {
    if (requisicoesSelecionadasIds.length === requisicoesElegiveisParaRemessa.length) {
      setRequisicoesSelecionadasIds([]);
    } else {
      setRequisicoesSelecionadasIds(requisicoesElegiveisParaRemessa.map(r => r.id));
    }
  };

  const handleToggleRequisicao = (id: string) => {
    if (requisicoesSelecionadasIds.includes(id)) {
      setRequisicoesSelecionadasIds(requisicoesSelecionadasIds.filter(i => i !== id));
    } else {
      setRequisicoesSelecionadasIds([...requisicoesSelecionadasIds, id]);
    }
  };

  // Submit Nova Remessa
  const handleCriarRemessa = async (e: React.FormEvent) => {
    e.preventDefault();

    if (tipoPrestador === 'credenciado' && !selCredenciadoId) {
      toast.error('Selecione um Credenciado da rede.');
      return;
    }

    if (tipoPrestador === 'rede_externa' && !redeExternaNome) {
      toast.error('Informe o nome da Rede Externa.');
      return;
    }

    if (requisicoesSelecionadasIds.length === 0) {
      toast.error('Selecione ao menos uma guia/requisição para incluir na remessa.');
      return;
    }

    let credNome = redeExternaNome;
    let credCnpj = redeExternaCnpj;

    if (tipoPrestador === 'credenciado') {
      const c = credenciados.find(item => item.id === selCredenciadoId);
      if (c) {
        credNome = c.nome_fantasia || c.razao_social;
        credCnpj = c.cnpj_cpf;
      }
    }

    const tenantId = state.empresaSelecionada || 'default_tenant';

    try {
      if (editingRemessa) {
        const atualizada: RemessaFaturamento = {
          ...editingRemessa,
          tipo_prestador: tipoPrestador,
          credenciado_id: tipoPrestador === 'credenciado' ? selCredenciadoId : undefined,
          credenciado_nome: credNome,
          credenciado_cnpj_cpf: credCnpj,
          requisicao_ids: requisicoesSelecionadasIds,
          qtd_guias: requisicoesSelecionadasIds.length,
          valor_bruto: valorBrutoNovaRemessa,
          valor_desconto_glosa: Number(valorGlosa) || 0,
          valor_liquido: valorLiquidoNovaRemessa,
          observacoes,
          updated_at: new Date().toISOString()
        };
        await atualizarRemessa(state.isOnline, atualizada);
        toast.success(`Remessa ${atualizada.codigo_remessa} atualizada com sucesso!`);
      } else {
        const nova = await criarRemessa(state.isOnline, tenantId, {
          tenant_id: tenantId,
          tipo_prestador: tipoPrestador,
          credenciado_id: tipoPrestador === 'credenciado' ? selCredenciadoId : undefined,
          credenciado_nome: credNome,
          credenciado_cnpj_cpf: credCnpj,
          requisicao_ids: requisicoesSelecionadasIds,
          qtd_guias: requisicoesSelecionadasIds.length,
          valor_bruto: valorBrutoNovaRemessa,
          valor_desconto_glosa: Number(valorGlosa) || 0,
          valor_liquido: valorLiquidoNovaRemessa,
          status: 'em_aberto',
          observacoes
        });
        toast.success(`Remessa ${nova.codigo_remessa} criada em aberto!`);
      }
      setModalNovaRemessa(false);
      resetNovaRemessaForm();
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar remessa de faturamento.');
    }
  };

  const resetNovaRemessaForm = () => {
    setTipoPrestador('credenciado');
    setSelCredenciadoId('');
    setRedeExternaNome('');
    setRedeExternaCnpj('');
    setObservacoes('');
    setValorGlosa(0);
    setRequisicoesSelecionadasIds([]);
    setEditingRemessa(null);
  };

  // Submit Fechamento de Remessa & Financeiro
  
  const [submitting, setSubmitting] = useState(false);
  const handleConfirmarReabertura = async () => {
    const tenantId = state.empresaSelecionada || 'default_tenant';
    if (!modalReabrirRemessa) return;
    if (!justificativaReabertura.trim()) {
      toast.error('Informe uma justificativa para a reabertura.');
      return;
    }

    setSubmitting(true);
    try {
      await reabrirRemessa(
        state.isOnline,
        tenantId,
        modalReabrirRemessa.id,
        justificativaReabertura,
        state.user?.nome || 'Operador'
      );
      toast.success('Remessa reaberta e parcelas financeiras canceladas.');
      setModalReabrirRemessa(null);
      setJustificativaReabertura('');
      loadData();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao reabrir remessa: ' + (e?.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmarFechamentoRemessa = async () => {
    if (!modalFecharRemessa) return;

    if (!dataVencimentoFinanceiro) {
      toast.error('Informe a data de vencimento para o lançamento no Contas a Pagar.');
      return;
    }

    setProcessandoFechamento(true);
    const tenantId = state.empresaSelecionada || 'default_tenant';

    try {
      const remFechada = await fecharRemessaEGerarContaPagar(
        state.isOnline,
        tenantId,
        modalFecharRemessa.id,
        dataVencimentoFinanceiro,
        formaPagamentoFinanceiro,
        state.user?.nome || 'Operador'
      );

      toast.success(`Remessa ${remFechada.codigo_remessa} FECHADA! Lançada em Contas a Pagar.`);
      
      // Auto-download PDF
      const reqsInclusas = todasRequisicoes.filter(r => remFechada.requisicao_ids.includes(r.id));
      const empresa = await getEmpresaById(tenantId, state.isOnline);
      await gerarPDFRelatorioFaturamento(remFechada, reqsInclusas, empresa?.logo_url, empresa?.assinatura_url, empresa);

      setModalFecharRemessa(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao fechar remessa.');
    } finally {
      setProcessandoFechamento(false);
    }
  };

  // Filtered List of Remessas
  const remessasFiltradas = useMemo(() => {
    return remessas.filter(r => {
      const matchStatus = !filtros.status || r.status === filtros.status;
      const matchTipo = !filtros.tipoPrestador || r.tipo_prestador === filtros.tipoPrestador;
      const q = (filtros.busca || '').toLowerCase();
      const matchBusca = !q || (
        r.codigo_remessa.toLowerCase().includes(q) ||
        r.credenciado_nome.toLowerCase().includes(q)
      );
      return matchStatus && matchTipo && matchBusca;
    });
  }, [remessas, filtros]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-bg-surface border border-border-default p-6 rounded-2xl shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center shrink-0">
            <ReceiptIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-base">Faturamento da Rede Credenciada</h1>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Submódulo Credenciados
              </span>
            </div>
            <p className="text-text-subtle text-sm mt-1">
              Agrupar requisições em remessas, realizar gestão de glosas e gerar Contas a Pagar no módulo financeiro.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsPreviewPrint(!isPreviewPrint)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm shrink-0 preview-toggle ${isPreviewPrint ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-bg-surface border border-border-default hover:bg-bg-hover text-text-base'}`}
            title={isPreviewPrint ? 'Sair da Visualização' : 'Visualizar Impressão'}
          >
            <PrinterIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{isPreviewPrint ? 'Sair Visualização' : 'Ver Impressão'}</span>
          </button>
          
          <button
            onClick={() => {
              resetNovaRemessaForm();
              setModalNovaRemessa(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-colors shadow-sm shrink-0 no-print"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Remessa</span>
          </button>
        </div>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-subtle border border-border-default p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-subtle text-sm font-medium">Total de Remessas</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FileTextIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-base">{remessas.length}</div>
          <div className="text-xs text-text-subtle mt-1">Lotes de faturamento</div>
        </div>

        <div className="bg-bg-subtle border border-border-default p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-subtle text-sm font-medium">Remessas Em Aberto</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ClockIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-500">
            {remessas.filter(r => r.status === 'em_aberto').length}
          </div>
          <div className="text-xs text-text-subtle mt-1">Aguardando conferência e fechamento</div>
        </div>

        <div className="bg-bg-subtle border border-border-default p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-subtle text-sm font-medium">Remessas Fechadas</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2Icon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-500">
            {remessas.filter(r => r.status === 'fechada' || r.status === 'paga').length}
          </div>
          <div className="text-xs text-text-subtle mt-1">Enviadas ao Contas a Pagar</div>
        </div>

        <div className="bg-bg-subtle border border-border-default p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-subtle text-sm font-medium">Valor Total Faturado</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <DollarSignIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-base">
            {formatCurrency(remessas.filter(r => r.status !== 'cancelada').reduce((acc, r) => acc + r.valor_liquido, 0))}
          </div>
          <div className="text-xs text-text-subtle mt-1">Valor líquido acumulado</div>
        </div>
      </div>

      {/* REMESSAS LIST TABLE */}
      <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm flex flex-col">
        
        {/* SEARCH & FILTERS */}
        <div className="p-4 border-b border-border-default flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full sm:w-auto">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle" />
            <input
              type="text"
              placeholder="Buscar por código da remessa ou nome do prestador..."
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              className="w-full bg-bg-surface border border-border-default rounded-xl pl-9 pr-4 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filtros.status}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
              className="bg-bg-surface border border-border-default text-text-base text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">Todos os Status</option>
              <option value="em_aberto">Em Aberto</option>
              <option value="fechada">Fechada (Contas a Pagar)</option>
              <option value="paga">Paga</option>
              <option value="cancelada">Cancelada</option>
            </select>

            <select
              value={filtros.tipoPrestador}
              onChange={(e) => setFiltros({ ...filtros, tipoPrestador: e.target.value })}
              className="bg-bg-surface border border-border-default text-text-base text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">Todas as Redes</option>
              <option value="credenciado">Rede Credenciada</option>
              <option value="rede_externa">Rede Externa</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-surface border-b border-border-default text-xs uppercase tracking-wider text-text-subtle font-semibold">
                <th className="px-6 py-3.5">Cód. / Data Criação</th>
                <th className="px-6 py-3.5">Prestador de Serviço</th>
                <th className="px-6 py-3.5 text-center">Guias Inclusas</th>
                <th className="px-6 py-3.5 text-right">Valor Bruto</th>
                <th className="px-6 py-3.5 text-right">Glosas/Desc.</th>
                <th className="px-6 py-3.5 text-right">Valor Líquido</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-text-subtle">
                    <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Carregando remessas de faturamento...
                  </td>
                </tr>
              ) : remessasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-text-subtle">
                    Nenhuma remessa de faturamento registrada.
                  </td>
                </tr>
              ) : (
                remessasFiltradas.map(rem => (
                  <tr key={rem.id} className="hover:bg-bg-surface/50 transition-colors">
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-text-base">{rem.codigo_remessa}</div>
                      <div className="text-xs text-text-subtle">
                        {formatLocalDateTime(rem.data_criacao)}
                      </div>
                    </td>

                    <td className="px-6 py-3.5">
                      <div className="font-medium text-text-base">{rem.credenciado_nome}</div>
                      <div className="text-xs text-text-subtle">
                        {rem.tipo_prestador === 'credenciado' ? 'Rede Credenciada' : 'Rede Externa'}
                        {rem.credenciado_cnpj_cpf ? ` • ${rem.credenciado_cnpj_cpf}` : ''}
                      </div>
                    </td>

                    <td className="px-6 py-3.5 text-center font-semibold text-text-base whitespace-nowrap">
                      {rem.qtd_guias} {rem.qtd_guias === 1 ? 'guia' : 'guias'}
                    </td>

                    <td className="px-6 py-3.5 text-right text-text-subtle whitespace-nowrap">
                      {formatCurrency(rem.valor_bruto)}
                    </td>

                    <td className="px-6 py-3.5 text-right text-rose-500 font-medium whitespace-nowrap">
                      {rem.valor_desconto_glosa > 0 ? `- ${formatCurrency(rem.valor_desconto_glosa)}` : 'R$ 0,00'}
                    </td>

                    <td className="px-6 py-3.5 text-right font-bold text-text-base whitespace-nowrap">
                      {formatCurrency(rem.valor_liquido)}
                    </td>

                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        rem.status === 'em_aberto' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        rem.status === 'fechada' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        rem.status === 'paga' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                        'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}>
                        {rem.status === 'em_aberto' && <ClockIcon className="w-3 h-3" />}
                        {rem.status === 'fechada' && <LockIcon className="w-3 h-3" />}
                        {rem.status === 'paga' && <CheckCircle2Icon className="w-3 h-3" />}
                        {rem.status === 'cancelada' && <XCircleIcon className="w-3 h-3" />}
                        {rem.status === 'em_aberto' ? 'EM ABERTO' :
                         rem.status === 'fechada' ? 'FECHADA (A PAGAR)' :
                         rem.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-6 py-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">                        {rem.status === 'fechada' && (
                          <button
                            onClick={() => setModalReabrirRemessa(rem)}
                            title="Reabrir Remessa"
                            className="p-1.5 text-amber-500 hover:text-white bg-bg-surface hover:bg-amber-600 rounded-lg border border-border-default transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setModalDetalhes(rem)}
                          className="p-1.5 text-text-subtle hover:text-text-base bg-bg-surface hover:bg-bg-hover rounded-lg border border-border-default transition-colors"
                          title="Ver detalhes da remessa"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>

                        <button
                          onClick={async () => {
                            const reqsInclusas = todasRequisicoes.filter(r => rem.requisicao_ids.includes(r.id));
                            const tenantId = state.empresaSelecionada || 'default_tenant';
                            const empresa = await getEmpresaById(tenantId, state.isOnline);
                            await gerarPDFRelatorioFaturamento(rem, reqsInclusas, empresa?.logo_url, empresa?.assinatura_url, empresa);
                          }}
                          className="p-1.5 text-blue-500 hover:text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg border border-blue-500/20 transition-colors"
                          title="Imprimir Relatório da Remessa"
                        >
                          <PrinterIcon className="w-4 h-4" />
                        </button>

                        {rem.status === 'em_aberto' && (
                          <button
                            onClick={() => {
                              setDataVencimentoFinanceiro(format(addDays(new Date(), 15), 'yyyy-MM-dd'));
                              setModalFecharRemessa(rem);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-lg transition-colors"
                          >
                            <LockIcon className="w-3 h-3" />
                            <span>Fechar e Gerar CP</span>
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

      {/* MODAL: NOVA REMESSA DE FATURAMENTO (INCLUSÃO DE GUIAS) */}
      {modalNovaRemessa && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-bg-surface border border-border-default rounded-2xl max-w-4xl w-full p-6 shadow-2xl my-8 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border-default shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center">
                  <PlusIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-text-base">{editingRemessa ? "Editar Remessa de Faturamento" : "Nova Remessa de Faturamento"}</h3>
                  <p className="text-xs text-text-subtle">Selecione o prestador e selecione as guias/requisições a incluir no lote</p>
                </div>
              </div>
              <button onClick={() => { setModalNovaRemessa(false); resetNovaRemessaForm(); }} className="text-text-subtle hover:text-text-base p-1 rounded-lg">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCriarRemessa} className="space-y-6 pt-4 overflow-y-auto pr-1 flex-1">
              
              {/* STEP 1: PRESTADOR */}
              <div className="bg-bg-subtle p-4 rounded-xl border border-border-default space-y-4">
                <h4 className="font-semibold text-sm text-text-base flex items-center gap-2">
                  <Building2Icon className="w-4 h-4 text-[#3B82F6]" />
                  1. Seleção do Prestador de Serviço
                </h4>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-text-base cursor-pointer">
                    <input
                      type="radio"
                      name="tipoPrestadorRemessa"
                      checked={tipoPrestador === 'credenciado'}
                      onChange={() => {
                        setTipoPrestador('credenciado');
                        setSelCredenciadoId('');
                        setRequisicoesSelecionadasIds([]);
                      }}
                      className="text-[#3B82F6]"
                    />
                    <span className="font-medium">Rede Credenciada Ativa</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-text-base cursor-pointer">
                    <input
                      type="radio"
                      name="tipoPrestadorRemessa"
                      checked={tipoPrestador === 'rede_externa'}
                      onChange={() => {
                        setTipoPrestador('rede_externa');
                        setSelCredenciadoId('');
                        setRequisicoesSelecionadasIds([]);
                      }}
                      className="text-[#3B82F6]"
                    />
                    <span className="font-medium">Rede Externa</span>
                  </label>
                </div>

                {tipoPrestador === 'credenciado' ? (
                  <div>
                    <label className="block text-xs font-medium text-text-subtle mb-1">Credenciado *</label>
                    <select
                      required
                      value={selCredenciadoId}
                      onChange={(e) => {
                        setSelCredenciadoId(e.target.value);
                        setRequisicoesSelecionadasIds([]);
                      }}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                    >
                      <option value="">Selecione o credenciado para faturamento...</option>
                      {credenciados.filter(c => c.status === 'ativo').map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome_fantasia || c.razao_social} ({c.ramo_atividade})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-subtle mb-1">Nome Exato do Prestador Externo *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Laboratório Dra. Maria"
                        value={redeExternaNome}
                        onChange={(e) => {
                          setRedeExternaNome(e.target.value);
                          setRequisicoesSelecionadasIds([]);
                        }}
                        className="w-full bg-bg-surface border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-subtle mb-1">CNPJ / CPF do Prestador</label>
                      <input
                        type="text"
                        placeholder="Opcional"
                        value={redeExternaCnpj}
                        onChange={(e) => setRedeExternaCnpj(e.target.value)}
                        className="w-full bg-bg-surface border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: INCLUSÃO DE GUIAS E REQUISIÇÕES */}
              <div className="bg-bg-subtle p-4 rounded-xl border border-border-default space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-text-base flex items-center gap-2">
                    <FileCheck2Icon className="w-4 h-4 text-[#3B82F6]" />
                    2. Selecionar Guias / Requisições para esta Remessa
                  </h4>

                  {requisicoesElegiveisParaRemessa.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-xs text-[#3B82F6] hover:underline font-medium"
                    >
                      {requisicoesSelecionadasIds.length === requisicoesElegiveisParaRemessa.length
                        ? 'Desmarcar Todas'
                        : `Marcar Todas (${requisicoesElegiveisParaRemessa.length})`}
                    </button>
                  )}
                </div>

                {/* AVAILABLE REQUISITIONS TABLE */}
                <div className="overflow-x-auto border border-border-default rounded-xl bg-bg-surface max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-bg-subtle text-text-subtle border-b border-border-default sticky top-0 font-semibold">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              requisicoesElegiveisParaRemessa.length > 0 &&
                              requisicoesSelecionadasIds.length === requisicoesElegiveisParaRemessa.length
                            }
                            onChange={handleToggleSelectAll}
                            className="rounded text-[#3B82F6]"
                          />
                        </th>
                        <th className="p-3">Código Guia</th>
                        <th className="p-3">Emissão</th>
                        <th className="p-3">Paciente</th>
                        <th className="p-3">Itens / Procedimentos</th>
                        <th className="p-3 text-right">Valor Guia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {(!selCredenciadoId && tipoPrestador === 'credenciado') || (!redeExternaNome && tipoPrestador === 'rede_externa') ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-text-subtle">
                            Selecione o prestador acima para listar as guias pendentes.
                          </td>
                        </tr>
                      ) : requisicoesElegiveisParaRemessa.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-text-subtle">
                            Nenhuma guia/requisição pendente encontrada para este prestador.
                          </td>
                        </tr>
                      ) : (
                        requisicoesElegiveisParaRemessa.map(req => {
                          const isChecked = requisicoesSelecionadasIds.includes(req.id);
                          return (
                            <tr
                              key={req.id}
                              onClick={() => handleToggleRequisicao(req.id)}
                              className={`cursor-pointer hover:bg-blue-500/5 transition-colors ${
                                isChecked ? 'bg-blue-500/10' : ''
                              }`}
                            >
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleRequisicao(req.id)}
                                  className="rounded text-[#3B82F6]"
                                />
                              </td>
                              <td className="p-3 font-bold text-text-base whitespace-nowrap">{req.codigo_requisicao}</td>
                              <td className="p-3 text-text-subtle whitespace-nowrap">
                                {formatLocalDate(req.data_emissao)}
                              </td>
                              <td className="p-3 text-text-base">{req.paciente_nome}</td>
                              <td className="p-3 text-text-subtle">
                                {req.itens.map(i => i.descricao).join(', ')}
                              </td>
                              <td className="p-3 text-right font-bold text-text-base whitespace-nowrap">
                                {formatCurrency(req.valor_total)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* SUMMARY & DISCOUNTS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="bg-bg-surface p-3 rounded-xl border border-border-default">
                    <span className="text-xs text-text-subtle">Guias Selecionadas:</span>
                    <div className="text-lg font-bold text-text-base">
                      {requisicoesSelecionadasIds.length} {requisicoesSelecionadasIds.length === 1 ? 'guia' : 'guias'}
                    </div>
                  </div>

                  <div className="bg-bg-surface p-3 rounded-xl border border-border-default">
                    <span className="text-xs text-text-subtle">Valor Bruto Total:</span>
                    <div className="text-lg font-bold text-text-base">
                      {formatCurrency(valorBrutoNovaRemessa)}
                    </div>
                  </div>

                  <div className="bg-bg-surface p-3 rounded-xl border border-border-default">
                    <label className="block text-xs text-text-subtle mb-1">Glosas / Descontos (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorGlosa}
                      onChange={(e) => setValorGlosa(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="0,00"
                      className="w-full bg-bg-base border border-border-default rounded-lg px-2.5 py-1 text-sm text-rose-500 font-bold focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                  <span className="text-sm font-semibold text-emerald-500">Valor Líquido da Remessa:</span>
                  <span className="text-xl font-bold text-emerald-500">{formatCurrency(valorLiquidoNovaRemessa)}</span>
                </div>
              </div>

              {/* STEP 3: OBSERVAÇÕES */}
              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">Observações da Remessa</label>
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Informações sobre a remessa de faturamento..."
                  className="w-full bg-bg-base border border-border-default rounded-xl p-3 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              {/* FOOTER */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border-default shrink-0">
                <button
                  type="button"
                  onClick={() => { setModalNovaRemessa(false); resetNovaRemessaForm(); }}
                  className="px-4 py-2.5 bg-bg-subtle text-text-subtle hover:text-text-base rounded-xl text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                >
                  <CheckIcon className="w-4 h-4" />
                  <span>Criar Remessa em Aberto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      
      {modalReabrirRemessa && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-default rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <h2 className="text-xl font-bold text-text-base flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              Reabrir Remessa
            </h2>
            
            <p className="text-sm text-text-subtle">
              Deseja reabrir a remessa <strong>{modalReabrirRemessa.codigo_remessa}</strong>?
              As parcelas no Contas a Pagar serão <strong>canceladas</strong>.
            </p>

            <div>
              <label className="block text-sm font-medium text-text-subtle mb-1">Justificativa *</label>
              <textarea 
                value={justificativaReabertura}
                onChange={(e) => setJustificativaReabertura(e.target.value)}
                placeholder="Informe o motivo da reabertura..."
                className="w-full bg-bg-subtle border border-border-default rounded-xl px-4 py-3 text-text-base focus:border-[#3B82F6] outline-none min-h-[100px]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
              <button 
                onClick={() => setModalReabrirRemessa(null)}
                className="px-4 py-2 bg-bg-subtle text-text-subtle hover:text-text-base rounded-xl font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmarReabertura}
                disabled={submitting}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? 'Aguarde...' : 'Confirmar Reabertura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FECHAR REMESSA & GERAR FINANCEIRO */}
      {modalFecharRemessa && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-default rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <LockIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-text-base">Fechamento de Remessa</h3>
                  <p className="text-xs text-text-subtle">Gerar lançamento no Contas a Pagar</p>
                </div>
              </div>
              <button onClick={() => setModalFecharRemessa(null)} className="text-text-subtle hover:text-text-base">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-bg-subtle p-4 rounded-xl border border-border-default space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-subtle">Remessa:</span>
                <span className="font-bold text-text-base">{modalFecharRemessa.codigo_remessa}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-subtle">Prestador:</span>
                <span className="font-medium text-text-base">{modalFecharRemessa.credenciado_nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-subtle">Guias Inclusas:</span>
                <span className="font-medium text-text-base">{modalFecharRemessa.qtd_guias} guias</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border-default font-bold">
                <span>Valor Líquido a Pagar:</span>
                <span className="text-emerald-500 text-base">{formatCurrency(modalFecharRemessa.valor_liquido)}</span>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">
                  Data de Vencimento do Pagamento (Contas a Pagar) *
                </label>
                <input
                  type="date"
                  required
                  value={dataVencimentoFinanceiro}
                  onChange={(e) => setDataVencimentoFinanceiro(e.target.value)}
                  className="w-full bg-bg-base border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">Forma de Pagamento Prevista</label>
                <select
                  value={formaPagamentoFinanceiro}
                  onChange={(e) => setFormaPagamentoFinanceiro(e.target.value as FormaPagamento)}
                  className="w-full bg-bg-base border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                >
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferência / TED / DOC</option>
                  <option value="boleto">Boleto Bancário</option>
                  <option value="cheque">Cheque</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
              <button
                type="button"
                onClick={() => setModalFecharRemessa(null)}
                className="px-4 py-2 bg-bg-subtle text-text-subtle hover:text-text-base rounded-xl text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={processandoFechamento}
                onClick={handleConfirmarFechamentoRemessa}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-2 shadow-sm"
              >
                {processandoFechamento ? (
                  <span>Processando...</span>
                ) : (
                  <>
                    <LockIcon className="w-3.5 h-3.5" />
                    <span>Confirmar e Gerar Conta a Pagar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VER DETALHES DA REMESSA */}
      {modalDetalhes && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-default rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div>
                <h3 className="font-bold text-lg text-text-base">Remessa {modalDetalhes.codigo_remessa}</h3>
                <p className="text-xs text-text-subtle">
                  Criada em {formatLocalDateTime(modalDetalhes.data_criacao)}
                </p>
              </div>
              <button onClick={() => setModalDetalhes(null)} className="text-text-subtle hover:text-text-base">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-bg-subtle p-3.5 rounded-xl space-y-1 border border-border-default">
                <div className="font-semibold text-text-base">Prestador: {modalDetalhes.credenciado_nome}</div>
                <div className="text-xs text-text-subtle">
                  CNPJ/CPF: {modalDetalhes.credenciado_cnpj_cpf || 'Não informado'} | Tipo: {modalDetalhes.tipo_prestador === 'credenciado' ? 'Rede Credenciada' : 'Rede Externa'}
                </div>
              </div>

              <div>
                <div className="font-semibold text-xs text-text-subtle mb-1 uppercase tracking-wider">
                  Guias Inclusas na Remessa ({modalDetalhes.qtd_guias}):
                </div>
                <div className="border border-border-default rounded-xl overflow-hidden text-xs max-h-48 overflow-y-auto">
                  {todasRequisicoes
                    .filter(r => modalDetalhes.requisicao_ids.includes(r.id))
                    .map((req, idx) => (
                      <div key={idx} className="p-2.5 bg-bg-subtle border-b border-border-default flex justify-between items-center last:border-b-0">
                        <div>
                          <span className="font-bold text-text-base">{req.codigo_requisicao}</span>
                          <span className="text-text-subtle ml-2">({req.paciente_nome})</span>
                          <div className="text-text-subtle text-[10px]">
                            {req.itens.map(i => i.descricao).join(', ')}
                          </div>
                        </div>
                        <span className="font-bold text-text-base">{formatCurrency(req.valor_total)}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-bg-subtle p-3 rounded-xl border border-border-default space-y-1">
                <div className="flex justify-between text-xs text-text-subtle">
                  <span>Valor Bruto das Guias:</span>
                  <span>{formatCurrency(modalDetalhes.valor_bruto)}</span>
                </div>
                <div className="flex justify-between text-xs text-rose-500">
                  <span>Glosas / Descontos:</span>
                  <span>- {formatCurrency(modalDetalhes.valor_desconto_glosa)}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-emerald-500 pt-1 border-t border-border-default">
                  <span>Valor Líquido:</span>
                  <span>{formatCurrency(modalDetalhes.valor_liquido)}</span>
                </div>
              </div>

              {modalDetalhes.observacoes && (
                <div className="text-xs text-text-subtle bg-bg-subtle p-2.5 rounded-lg">
                  Observações: {modalDetalhes.observacoes}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border-default">
              {modalDetalhes.status === 'em_aberto' && (
                <button
                  onClick={() => {
                    setEditingRemessa(modalDetalhes);
                    setTipoPrestador(modalDetalhes.tipo_prestador);
                    if (modalDetalhes.tipo_prestador === 'credenciado') {
                      setSelCredenciadoId(modalDetalhes.credenciado_id || '');
                    } else {
                      setRedeExternaNome(modalDetalhes.credenciado_nome || '');
                      setRedeExternaCnpj(modalDetalhes.credenciado_cnpj_cpf || '');
                    }
                    setObservacoes(modalDetalhes.observacoes || '');
                    setValorGlosa(modalDetalhes.valor_desconto_glosa || 0);
                    setRequisicoesSelecionadasIds(modalDetalhes.requisicao_ids);
                    setModalDetalhes(null);
                    setModalNovaRemessa(true);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-medium flex items-center gap-1.5"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              )}

              <button
                onClick={() => setModalDetalhes(null)}
                className="px-4 py-2 bg-bg-subtle text-text-subtle hover:text-text-base rounded-xl text-xs font-medium"
              >
                Fechar
              </button>
              <button
                onClick={async () => {
                  const reqsInclusas = todasRequisicoes.filter(r => modalDetalhes.requisicao_ids.includes(r.id));
                  const tenantId = state.empresaSelecionada || 'default_tenant';
                  const empresa = await getEmpresaById(tenantId, state.isOnline);
                  await gerarPDFRelatorioFaturamento(modalDetalhes, reqsInclusas, empresa?.logo_url, empresa?.assinatura_url, empresa);
                }}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-medium flex items-center gap-1.5"
              >
                <PrinterIcon className="w-3.5 h-3.5" />
                <span>Imprimir PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
