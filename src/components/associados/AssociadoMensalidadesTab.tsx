import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  getReceitas, getParcelasReceber, salvarReceita, atualizarReceita,
  atualizarParcelaReceber, excluirReceita, excluirParcelaReceber,
  registrarRecebimento, Receita, ParcelaReceber
} from '../../services/financeiroService';
import { getLoteAbertoAtivo, registrarMovimentacao } from '../../services/caixasService';
import { getContasBancariasAtivas } from '../../services/contasBancariasService';
import { getEmpresaById, Empresa } from '../../services/empresasService';
import { ContaBancaria } from '../../types/contasBancarias';
import { VisualizadorReciboModal, ReciboDados } from '../financeiro/VisualizadorReciboModal';
import { OrganogramaMensalidadesCanvas } from './OrganogramaMensalidadesCanvas';
import { RegrasCalculoInfo } from './RegrasCalculoInfo';
import { useSeletorPlanoPax } from '../../hooks/useSeletorPlanoPax';
import { canDelete } from '../../utils/permissions';
import { formatLocalDate } from '../../utils/dateUtils';
import { format, addMonths } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import {
  DollarSign, CheckCircle, Clock, AlertCircle, Trash2, Plus,
  Printer, Layers, List, Edit3, X, Lock, Wallet, AlertTriangle,
  ArrowRight, CheckCircle2, Search, ChevronDown, ChevronRight,
  Sparkles, RefreshCw, Calendar, FileText
} from 'lucide-react';
import { registrarAuditoria } from '../../lib/supabase';
import { formatCurrency } from '../../utils/formatters';
import {
  ultrapassaLimiteColetivo,
  calcularValorMensalidadeBase,
  descricaoCalculoMensalidade,
  gerarProjecaoParcelas,
  filtrarReceitasDoAssociado,
  filtrarParcelasDoAssociado,
  agruparParcelasPorStatusComTotais,
  filtrarParcelasTabela,
} from '../../utils/mensalidadesAssociadoHelpers';
import { MensalidadesGeracaoWizard } from './MensalidadesGeracaoWizard';
import { ParcelaRecebimentoModal } from './ParcelaRecebimentoModal';
import { MensalidadesListaParcelas } from './MensalidadesListaParcelas';


export const AssociadoMensalidadesTab: React.FC<{
  associado: any;
  onSuccess?: () => void;
}> = ({ associado, onSuccess }) => {
  const { state } = useAppContext();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaReceber[]>([]);
  const [viewMode, setViewMode] = useState<'organograma' | 'tabela'>('organograma');

  // Geração Wizard
  const [showGeracao, setShowGeracao] = useState(false);
  const [initialDataInicio, setInitialDataInicio] = useState<string | undefined>();

  // Filtros da Tabela
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroPeriodoInicio, setFiltroPeriodoInicio] = useState('');
  const [filtroPeriodoFim, setFiltroPeriodoFim] = useState('');
  const [selectedParcelas, setSelectedParcelas] = useState<string[]>([]);
  const [showMassDeleteJustificativa, setShowMassDeleteJustificativa] = useState(false);
  const [massDeleteJustificativa, setMassDeleteJustificativa] = useState('');

  // Modais de Edição/Exclusão de Receita e Parcela (para Admins/Super Admins)
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);
  const [receitaToDelete, setReceitaToDelete] = useState<Receita | null>(null);
  const [deleteReceitaJustificativa, setDeleteReceitaJustificativa] = useState('');

  const [editingParcela, setEditingParcela] = useState<ParcelaReceber | null>(null);
  const [parcelaToDelete, setParcelaToDelete] = useState<ParcelaReceber | null>(null);
  const [deleteParcelaJustificativa, setDeleteParcelaJustificativa] = useState('');

  // Modal de Baixa / Recebimento de Mensalidade
  const [showBaixaModal, setShowBaixaModal] = useState(false);
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaReceber | null>(null);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [empresaData, setEmpresaData] = useState<Empresa | null>(null);

  // Modal de Recibo
  const [showReciboModal, setShowReciboModal] = useState(false);
  const [reciboModalData, setReciboModalData] = useState<ReciboDados | null>(null);

  // Verificação de permissões do usuário
  const isAdmin = useMemo(() => {
    return state.user?.nivel === 'super_admin' || state.user?.nivel === 'admin';
  }, [state.user?.nivel]);

  const canDeleteFinancial = useMemo(() => {
    return canDelete(state.user, state.isOnline);
  }, [state.user, state.isOnline]);

  // Carregar dados de Receitas e Parcelas pertencentes a este Associado
  const carregarDadosFinanceiros = useCallback(async () => {
    setLoading(true);
    try {
      const [todasReceitas, todasParcelas] = await Promise.all([
        getReceitas(state.isOnline, state.empresaSelecionada || 'all'),
        getParcelasReceber(state.isOnline, state.empresaSelecionada || 'all')
      ]);

      // Filtrar receitas e parcelas pertencentes a este associado
      const receitasFiltradas = filtrarReceitasDoAssociado(todasReceitas, associado);
      const parcelasFiltradas = filtrarParcelasDoAssociado(todasParcelas, receitasFiltradas, associado);

      setReceitas(receitasFiltradas);
      setParcelas(parcelasFiltradas);
    } catch (e) {
      console.error('Erro ao carregar receitas e parcelas do associado:', e);
      toast.error('Erro ao carregar dados financeiros do associado');
    } finally {
      setLoading(false);
    }
  }, [state.isOnline, state.empresaSelecionada, associado.id, associado.cpf, associado.nome, toast]);

  useEffect(() => {
    carregarDadosFinanceiros();
  }, [carregarDadosFinanceiros]);

  // Carregar dados auxiliares de contas bancárias e empresa para recibo
  useEffect(() => {
    const loadExtras = async () => {
      if (state.empresaSelecionada) {
        try {
          const [contas, emp] = await Promise.all([
            getContasBancariasAtivas(state.empresaSelecionada, state.isOnline),
            getEmpresaById(state.empresaSelecionada, state.isOnline)
          ]);
          setContasBancarias(contas);
          if (emp) setEmpresaData(emp);
        } catch (e) {
          console.error('Erro ao carregar extras:', e);
        }
      }
    };
    loadExtras();
  }, [state.empresaSelecionada, state.isOnline]);

  // Abrir modal de baixa/recebimento
  const openBaixaModal = (parcela: ParcelaReceber) => {
    setParcelaSelecionada(parcela);
    setShowBaixaModal(true);
  };



  // Visualizar / Imprimir recibo
  const handleImprimirRecibo = (parcela: ParcelaReceber) => {
    const dataVenc = parcela.data_vencimento ? format(new Date(parcela.data_vencimento + 'T12:00:00'), 'dd/MM/yyyy') : '-';
    const dataRec = (parcela.data_recebimento || parcela.recebido_em)
      ? formatLocalDate(parcela.data_recebimento || parcela.recebido_em, "dd/MM/yyyy 'às' HH:mm")
      : formatLocalDate(new Date(), "dd/MM/yyyy 'às' HH:mm");
    const numRecibo = (parcela.id || '').substring(0, 8).toUpperCase();
    const devedorNome = parcela.devedor_nome || associado.nome || 'Cliente';
    const devedorDoc = parcela.devedor_cpf_cnpj || associado.cpf || 'Não informado';
    const formaEfetiva = (parcela.forma_pagamento_efetivo || parcela.forma_pagamento || 'PIX').toUpperCase();

    setReciboModalData({
      numRecibo,
      tipo: 'recebimento',
      titulo: 'Recibo de Pagamento',
      pagadorNome: devedorNome,
      pagadorDoc: devedorDoc,
      descricao: parcela.descricao || 'Mensalidade',
      parcelaInfo: `Parcela ${parcela.numero_parcela} de ${parcela.total_parcelas || 1}`,
      categoria: 'Mensalidades',
      vencimentoOriginal: dataVenc,
      dataLiquidacao: dataRec,
      formaPagamento: formaEfetiva,
      valor: Number(parcela.valor_recebido || parcela.valor),
      operadorNome: parcela.recebido_por || state.user?.nome || 'Sistema',
      observacoes: parcela.observacao_recebimento || (parcela as any).observacoes,
      planoInfo: associado.plano_nome
    });
    setShowReciboModal(true);
  };

  // Salvar Edição de Receita Pai
  const handleSalvarEdicaoReceita = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingReceita) return;
    if (!isAdmin) {
      toast.error('Apenas Administradores e Super Admins podem editar receitas.');
      return;
    }
    setLoading(true);
    try {
      await atualizarReceita(state.isOnline, editingReceita);
      toast.success('Receita Pai atualizada com sucesso!');
      setEditingReceita(null);
      carregarDadosFinanceiros();
    } catch (err: any) {
      console.error('Erro ao atualizar receita:', err);
      toast.error('Erro ao salvar alterações da receita');
    } finally {
      setLoading(false);
    }
  };

  // Confirmar Exclusão de Receita Pai
  const handleConfirmarExcluirReceita = async () => {
    if (!receitaToDelete) return;
    if (!canDeleteFinancial) {
      toast.error('Permissão negada. Somente Administradores podem excluir receitas.');
      return;
    }
    if (!deleteReceitaJustificativa.trim()) {
      toast.error('Informe a justificativa da exclusão.');
      return;
    }
    setLoading(true);
    try {
      await excluirReceita(state.isOnline, receitaToDelete.id);
      await registrarAuditoria('EXCLUSAO_RECEITA_PAI', {
        receita_id: receitaToDelete.id,
        associado_id: associado.id,
        descricao: receitaToDelete.descricao,
        justificativa: deleteReceitaJustificativa,
        online: state.isOnline
      });
      toast.success('Receita e parcelas vinculadas excluídas com sucesso!');
      setReceitaToDelete(null);
      setDeleteReceitaJustificativa('');
      carregarDadosFinanceiros();
    } catch (err) {
      console.error('Erro ao excluir receita:', err);
      toast.error('Erro ao excluir receita mestre');
    } finally {
      setLoading(false);
    }
  };

  // Salvar Edição de Parcela
  const handleSalvarEdicaoParcela = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingParcela) return;
    if (!isAdmin) {
      toast.error('Apenas Administradores e Super Admins podem editar parcelas.');
      return;
    }
    setLoading(true);
    try {
      await atualizarParcelaReceber(state.isOnline, editingParcela);
      toast.success('Parcela atualizada com sucesso!');
      setEditingParcela(null);
      carregarDadosFinanceiros();
    } catch (err: any) {
      console.error('Erro ao atualizar parcela:', err);
      toast.error('Erro ao salvar alterações da parcela');
    } finally {
      setLoading(false);
    }
  };

  // Confirmar Exclusão de Parcela
  const handleConfirmarExcluirParcela = async () => {
    if (!parcelaToDelete) return;
    if (!canDeleteFinancial) {
      toast.error('Permissão negada. Somente Administradores podem excluir parcelas.');
      return;
    }
    if (!deleteParcelaJustificativa.trim()) {
      toast.error('Informe a justificativa da exclusão.');
      return;
    }
    setLoading(true);
    try {
      await excluirParcelaReceber(state.isOnline, parcelaToDelete.id);
      await registrarAuditoria('EXCLUSAO_PARCELA_MENSALIDADE', {
        parcela_id: parcelaToDelete.id,
        associado_id: associado.id,
        descricao: parcelaToDelete.descricao,
        justificativa: deleteParcelaJustificativa,
        online: state.isOnline
      });
      toast.success('Parcela excluída com sucesso!');
      setParcelaToDelete(null);
      setDeleteParcelaJustificativa('');
      carregarDadosFinanceiros();
    } catch (err) {
      console.error('Erro ao excluir parcela:', err);
      toast.error('Erro ao excluir parcela');
    } finally {
      setLoading(false);
    }
  };

  // Exclusão em Massa (Modo Tabela)
  const handleMassDelete = async () => {
    if (!massDeleteJustificativa.trim()) {
      toast.error('Informe a justificativa');
      return;
    }
    setLoading(true);
    try {
      for (const id of selectedParcelas) {
        await excluirParcelaReceber(state.isOnline, id);
      }
      await registrarAuditoria('EXCLUSAO_MASSA_MENSALIDADES', {
        associado_id: associado.id,
        parcelas_ids: selectedParcelas,
        justificativa: massDeleteJustificativa,
        online: state.isOnline
      });
      toast.success('Parcelas selecionadas excluídas com sucesso');
      setSelectedParcelas([]);
      setShowMassDeleteJustificativa(false);
      setMassDeleteJustificativa('');
      carregarDadosFinanceiros();
    } catch (e) {
      toast.error('Erro ao excluir parcelas selecionadas');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Handler para iniciar o wizard de geração de novas mensalidades
  const handleAbrirGeracao = () => {
    const proximaData = format(new Date(), 'yyyy-MM-dd');
    const pendentes = parcelas.filter(p => p.status === 'pendente' || p.status === 'vencido' || p.status === 'atrasado');

    if (pendentes.length > 0) {
      confirm.confirm({
        title: "Existem Mensalidades Pendentes",
        message: "Este associado já possui mensalidades em aberto ou atrasadas. Deseja continuar com a geração de novas parcelas?",
        confirmText: "Prosseguir",
        cancelText: "Cancelar",
        onConfirm: () => {
          const sorted = [...pendentes].sort((a, b) => new Date(b.data_vencimento).getTime() - new Date(a.data_vencimento).getTime());
          const ultima = new Date(sorted[0].data_vencimento + "T12:00:00");
          const proximoMes = addMonths(ultima, 1);
          setInitialDataInicio(format(proximoMes, 'yyyy-MM-dd'));
          setShowGeracao(true);
        }
      });
      return;
    }

    setInitialDataInicio(proximaData);
    setShowGeracao(true);
  };

  if (showGeracao) {
    return (
      <MensalidadesGeracaoWizard
        associado={associado}
        defaultDataInicio={initialDataInicio}
        onSuccess={() => {
          setShowGeracao(false);
          carregarDadosFinanceiros();
          if (onSuccess) onSuccess();
        }}
        onCancel={() => setShowGeracao(false)}
      />
    );
  }

  // Cálculos de KPI de topo
  const { pagas, emAberto, atrasadas, valorPagas, valorAberto, valorAtrasadas } =
    agruparParcelasPorStatusComTotais(parcelas);

  // Filtragem para tabela
  const filtradasTabela = filtrarParcelasTabela(parcelas, { filtroStatus, filtroPeriodoInicio, filtroPeriodoFim });

  return (
    <div
      className="space-y-6"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        // Previne que submissões internas alcancem o form mestre do associado
        e.stopPropagation();
      }}
    >
      {/* HEADER DA ABA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-default pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-text-base font-bold text-lg">Mensalidades do Associado</h4>
            {isAdmin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30">
                ADMIN
              </span>
            )}
          </div>
          <p className="text-xs text-text-subtle mt-0.5">
            Acompanhe as receitas mestre, histórico de parcelas e realize baixas e edições.
          </p>
        </div>

        {/* CONTROLES DE VISUALIZAÇÃO E AÇÕES */}
        <div className="flex items-center gap-2">
          {/* Seletor de Visão */}
          <div className="flex items-center bg-bg-surface p-1 rounded-xl border border-border-default shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('organograma')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'organograma'
                  ? 'bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/20'
                  : 'text-text-subtle hover:text-text-base'
              }`}
              title="Visualização em Organograma Interativo (Canvas)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Organograma</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tabela')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'tabela'
                  ? 'bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/20'
                  : 'text-text-subtle hover:text-text-base'
              }`}
              title="Visualização em Lista / Tabela"
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabela</span>
            </button>
          </div>

          <button
            type="button"
            onClick={carregarDadosFinanceiros}
            disabled={loading}
            className="p-2 bg-bg-surface hover:bg-bg-hover text-text-subtle hover:text-text-base rounded-xl border border-border-default transition-colors"
            title="Recarregar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-bg-surface/80 p-3.5 rounded-2xl border border-border-default flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-text-subtle block">Receitas Pai</span>
            <h5 className="text-lg font-extrabold text-white">{receitas.length} <span className="text-xs font-normal text-text-subtle">registros</span></h5>
          </div>
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-bg-surface/80 p-3.5 rounded-2xl border border-border-default flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-text-subtle block">Pagas / Recebidas</span>
            <h5 className="text-lg font-extrabold text-emerald-400">{pagas.length} <span className="text-xs font-normal text-text-subtle font-mono">({formatCurrency(valorPagas)})</span></h5>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-bg-surface/80 p-3.5 rounded-2xl border border-border-default flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-text-subtle block">Em Aberto</span>
            <h5 className="text-lg font-extrabold text-amber-400">{emAberto.length} <span className="text-xs font-normal text-text-subtle font-mono">({formatCurrency(valorAberto)})</span></h5>
          </div>
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-bg-surface/80 p-3.5 rounded-2xl border border-border-default flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-text-subtle block">Atrasadas / Vencidas</span>
            <h5 className="text-lg font-extrabold text-rose-400">{atrasadas.length} <span className="text-xs font-normal text-text-subtle font-mono">({formatCurrency(valorAtrasadas)})</span></h5>
          </div>
          <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* CONTEÚDO PRINCIPAL: CANVAS OU TABELA */}
      {/* ============================================================ */}
      {viewMode === 'organograma' ? (
        <OrganogramaMensalidadesCanvas
          associado={associado}
          receitas={receitas}
          parcelas={parcelas}
          isAdmin={isAdmin}
          isOnline={state.isOnline}
          onEditReceita={(rec) => setEditingReceita({ ...rec })}
          onDeleteReceita={(rec) => setReceitaToDelete(rec)}
          onEditParcela={(parc) => setEditingParcela({ ...parc })}
          onDeleteParcela={(parc) => setParcelaToDelete(parc)}
          onReceberParcela={openBaixaModal}
          onImprimirRecibo={handleImprimirRecibo}
          onOpenGerarModal={handleAbrirGeracao}
        />
      ) : (
        /* VISUALIZAÇÃO EM TABELA HIERÁRQUICA */
        <MensalidadesListaParcelas
          filtradasTabela={filtradasTabela}
          loading={loading}
          isAdmin={isAdmin}
          selectedParcelas={selectedParcelas}
          setSelectedParcelas={setSelectedParcelas}
          filtroStatus={filtroStatus}
          setFiltroStatus={setFiltroStatus}
          filtroPeriodoInicio={filtroPeriodoInicio}
          setFiltroPeriodoInicio={setFiltroPeriodoInicio}
          filtroPeriodoFim={filtroPeriodoFim}
          setFiltroPeriodoFim={setFiltroPeriodoFim}
          setShowMassDeleteJustificativa={setShowMassDeleteJustificativa}
          openBaixaModal={openBaixaModal}
          handleImprimirRecibo={handleImprimirRecibo}
          setEditingParcela={setEditingParcela}
          setParcelaToDelete={setParcelaToDelete}
        />
      )}

      {/* ============================================================ */}
      {/* MODAIS DE ADMIN: EDITAR / EXCLUIR RECEITAS E PARCELAS */}
      {/* ============================================================ */}

      {/* MODAL EDITAR RECEITA PAI */}
      {editingReceita && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-bg-subtle border border-border-default rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border-default">
              <h3 className="text-lg font-bold text-text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-400" />
                Editar Receita Pai
              </h3>
              <button
                type="button"
                onClick={() => setEditingReceita(null)}
                className="text-text-subtle hover:text-text-base"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSalvarEdicaoReceita} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-text-subtle mb-1">Descrição / Nome do Contrato</label>
                <input
                  type="text"
                  required
                  value={editingReceita.descricao}
                  onChange={e => setEditingReceita({ ...editingReceita, descricao: e.target.value })}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base text-xs focus:border-[#3B82F6] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-text-subtle mb-1">Categoria</label>
                  <input
                    type="text"
                    value={editingReceita.categoria}
                    onChange={e => setEditingReceita({ ...editingReceita, categoria: e.target.value })}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-3 py-2 text-text-base text-xs focus:border-[#3B82F6] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-text-subtle mb-1">Status</label>
                  <select
                    value={editingReceita.status}
                    onChange={e => setEditingReceita({ ...editingReceita, status: e.target.value as any })}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-3 py-2 text-text-base text-xs focus:border-[#3B82F6] outline-none"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="quitado">Quitado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="rascunho">Rascunho</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-text-subtle mb-1">Forma de Pagamento Padrão</label>
                <select
                  value={editingReceita.forma_pagamento_padrao || 'boleto'}
                  onChange={e => setEditingReceita({ ...editingReceita, forma_pagamento_padrao: e.target.value })}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-3 py-2 text-text-base text-xs focus:border-[#3B82F6] outline-none"
                >
                  <option value="boleto">Boleto</option>
                  <option value="pix">PIX</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-text-subtle mb-1">Observações</label>
                <textarea
                  rows={3}
                  value={editingReceita.observacoes || ''}
                  onChange={e => setEditingReceita({ ...editingReceita, observacoes: e.target.value })}
                  className="w-full bg-bg-surface border border-border-default rounded-xl p-3 text-text-base text-xs focus:border-[#3B82F6] outline-none resize-none"
                  placeholder="Informações complementares sobre este lançamento..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setEditingReceita(null)}
                  className="px-4 py-2 rounded-xl text-text-subtle hover:bg-bg-hover text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR RECEITA PAI (CASCATA) */}
      {receitaToDelete && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-bg-subtle border border-border-default rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-rose-500">
                <div className="p-2.5 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Excluir Receita Mestre</h3>
                  <p className="text-xs text-rose-400 font-semibold">Exclusão em Cascata</p>
                </div>
              </div>

              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-text-subtle space-y-2">
                <p>
                  Você está prestes a excluir a receita <strong className="text-white">&quot;{receitaToDelete.descricao}&quot;</strong>.
                </p>
                <p className="text-rose-400 font-medium">
                  ⚠️ Atenção: Esta ação excluirá permanentemente a receita mestre e todas as parcelas vinculadas a ela.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">
                  Justificativa da Exclusão (Obrigatório) *
                </label>
                <textarea
                  rows={3}
                  value={deleteReceitaJustificativa}
                  onChange={e => setDeleteReceitaJustificativa(e.target.value)}
                  placeholder="Informe o motivo da exclusão desta receita..."
                  className="w-full bg-bg-surface border border-border-default rounded-xl p-3 text-text-base text-xs focus:border-rose-500 outline-none resize-none"
                  required
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-bg-surface/50 border-t border-border-default flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setReceitaToDelete(null); setDeleteReceitaJustificativa(''); }}
                className="px-4 py-2 rounded-xl text-text-subtle hover:bg-bg-hover text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExcluirReceita}
                disabled={loading || !deleteReceitaJustificativa.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-lg shadow-rose-600/20"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR PARCELA */}
      {editingParcela && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-bg-subtle border border-border-default rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border-default">
              <h3 className="text-lg font-bold text-text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-400" />
                Editar Parcela
              </h3>
              <button
                type="button"
                onClick={() => setEditingParcela(null)}
                className="text-text-subtle hover:text-text-base"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSalvarEdicaoParcela} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-text-subtle mb-1">Descrição da Parcela</label>
                <input
                  type="text"
                  required
                  value={editingParcela.descricao || ''}
                  onChange={e => setEditingParcela({ ...editingParcela, descricao: e.target.value })}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base text-xs focus:border-[#3B82F6] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-text-subtle mb-1">Data de Vencimento</label>
                  <input
                    type="date"
                    required
                    value={editingParcela.data_vencimento ? editingParcela.data_vencimento.split('T')[0] : ''}
                    onChange={e => setEditingParcela({ ...editingParcela, data_vencimento: e.target.value })}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-3 py-2 text-text-base text-xs focus:border-[#3B82F6] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-text-subtle mb-1">Valor Nominal (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editingParcela.valor || ''}
                    onChange={e => setEditingParcela({ ...editingParcela, valor: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-3 py-2 text-text-base text-xs focus:border-[#3B82F6] outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-text-subtle mb-1">Status</label>
                  <select
                    value={editingParcela.status}
                    onChange={e => setEditingParcela({ ...editingParcela, status: e.target.value as any })}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-3 py-2 text-text-base text-xs focus:border-[#3B82F6] outline-none"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="recebido">Recebido / Pago</option>
                    <option value="vencido">Vencido</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-text-subtle mb-1">Forma de Pagamento</label>
                  <select
                    value={editingParcela.forma_pagamento || 'boleto'}
                    onChange={e => setEditingParcela({ ...editingParcela, forma_pagamento: e.target.value })}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-3 py-2 text-text-base text-xs focus:border-[#3B82F6] outline-none"
                  >
                    <option value="boleto">Boleto</option>
                    <option value="pix">PIX</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-text-subtle mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={editingParcela.observacoes || ''}
                  onChange={e => setEditingParcela({ ...editingParcela, observacoes: e.target.value })}
                  className="w-full bg-bg-surface border border-border-default rounded-xl p-3 text-text-base text-xs focus:border-[#3B82F6] outline-none resize-none"
                  placeholder="Anotações internas..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setEditingParcela(null)}
                  className="px-4 py-2 rounded-xl text-text-subtle hover:bg-bg-hover text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR PARCELA */}
      {parcelaToDelete && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-bg-subtle border border-border-default rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-rose-500">
                <div className="p-2.5 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Excluir Parcela</h3>
                  <p className="text-xs text-rose-400 font-semibold">Exclusão de Registro</p>
                </div>
              </div>

              <p className="text-xs text-text-subtle">
                Você está prestes a excluir a parcela <strong className="text-white">&quot;{parcelaToDelete.descricao}&quot;</strong> no valor de <strong className="text-emerald-400">{formatCurrency(parcelaToDelete.valor)}</strong>.
              </p>

              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">
                  Justificativa da Exclusão (Obrigatório) *
                </label>
                <textarea
                  rows={3}
                  value={deleteParcelaJustificativa}
                  onChange={e => setDeleteParcelaJustificativa(e.target.value)}
                  placeholder="Informe o motivo da exclusão desta parcela..."
                  className="w-full bg-bg-surface border border-border-default rounded-xl p-3 text-text-base text-xs focus:border-rose-500 outline-none resize-none"
                  required
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-bg-surface/50 border-t border-border-default flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setParcelaToDelete(null); setDeleteParcelaJustificativa(''); }}
                className="px-4 py-2 rounded-xl text-text-subtle hover:bg-bg-hover text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExcluirParcela}
                disabled={loading || !deleteParcelaJustificativa.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-lg shadow-rose-600/20"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUSÃO EM MASSA */}
      {showMassDeleteJustificativa && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-bg-subtle border border-border-default rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-rose-500">
                <div className="p-2.5 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Exclusão em Massa</h3>
                  <p className="text-xs text-rose-400 font-semibold">{selectedParcelas.length} parcelas selecionadas</p>
                </div>
              </div>

              <p className="text-xs text-text-subtle">
                Por favor, informe a justificativa para a exclusão das {selectedParcelas.length} parcelas selecionadas:
              </p>

              <textarea
                rows={3}
                value={massDeleteJustificativa}
                onChange={e => setMassDeleteJustificativa(e.target.value)}
                placeholder="Motivo da exclusão..."
                className="w-full bg-bg-surface border border-border-default rounded-xl p-3 text-text-base text-xs focus:border-rose-500 outline-none resize-none"
                required
              />
            </div>

            <div className="px-6 py-4 bg-bg-surface/50 border-t border-border-default flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowMassDeleteJustificativa(false); setMassDeleteJustificativa(''); }}
                className="px-4 py-2 rounded-xl text-text-subtle hover:bg-bg-hover text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleMassDelete}
                disabled={loading || !massDeleteJustificativa.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-lg shadow-rose-600/20"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {showBaixaModal && (
        <ParcelaRecebimentoModal
          parcelaSelecionada={parcelaSelecionada}
          associadoNome={associado.nome}
          contasBancarias={contasBancarias}
          onClose={() => setShowBaixaModal(false)}
          onSuccess={carregarDadosFinanceiros}
        />
      )}

      {/* MODAL VISUALIZADOR DE RECIBO */}
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
