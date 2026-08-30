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

// Helper de formatação de moeda
const formatCurrency = (val: number = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

// Wizard de Geração de Mensalidades
const MensalidadesGeracaoSubView = ({
  associado,
  onSuccess,
  onCancel,
  defaultDataInicio
}: {
  associado: any;
  onSuccess: () => void;
  onCancel: () => void;
  defaultDataInicio?: string;
}) => {
  const toast = useToast();
  const { state } = useAppContext();
  const isAdminOrSuperAdmin = state.user?.nivel === 'super_admin' || state.user?.nivel === 'admin';
  const { selecionarPlano, planoSelecionado } = useSeletorPlanoPax();
  const [dataInicio, setDataInicio] = useState<string>(defaultDataInicio || format(new Date(), 'yyyy-MM-dd'));
  const [qtdParcelas, setQtdParcelas] = useState<number>(12);
  const [diaVencimento, setDiaVencimento] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [valorExtra, setValorExtra] = useState<number>(0);
  const [valorParcelaManual, setValorParcelaManual] = useState<string>('');

  useEffect(() => {
    if (associado.plano_pax_id) {
      selecionarPlano(associado.plano_pax_id);
    }
  }, [associado.plano_pax_id, selecionarPlano]);

  const vidasCadastradas = associado.n_vidas || 1;

  const ultrapassouLimiteColetivo = useMemo(() => {
    if (!planoSelecionado) return false;
    if (planoSelecionado.tipo_plano === 'coletivo') {
      const limite = planoSelecionado.limite_vidas || 999;
      return vidasCadastradas > limite;
    }
    return false;
  }, [planoSelecionado, vidasCadastradas]);

  const valorMensalidadeBase = useMemo(() => {
    if (!planoSelecionado) return 0;
    if (planoSelecionado.tipo_plano === 'individual') {
      const minVidas = planoSelecionado.minimo_vidas_calculo || 1;
      const vidasParaCalculo = vidasCadastradas <= minVidas ? minVidas : vidasCadastradas;
      return planoSelecionado.valor_mensalidade * vidasParaCalculo;
    }
    return planoSelecionado.valor_mensalidade + (Number(valorExtra) || 0);
  }, [planoSelecionado, vidasCadastradas, valorExtra]);

  const descricaoCalculo = useMemo(() => {
    if (!planoSelecionado) return '';
    if (planoSelecionado.tipo_plano === 'individual') {
      const minVidas = planoSelecionado.minimo_vidas_calculo || 1;
      if (vidasCadastradas <= minVidas) {
        return `Valor Base x ${minVidas} (Mínimo de vidas exigido)`;
      }
      return `Valor Base x ${vidasCadastradas} vidas`;
    }
    return 'Valor Base Coletivo' + (Number(valorExtra) > 0 ? ' + Valor Extra' : '');
  }, [planoSelecionado, vidasCadastradas, valorExtra]);

  const gerarProjecao = useCallback(() => {
    if (!planoSelecionado) return;

    let dt = new Date(dataInicio + "T12:00:00");
    const arr = [];
    const adesao = planoSelecionado.taxa_adesao || 0;
    const baseParcela = (isAdminOrSuperAdmin && valorParcelaManual !== '' && !isNaN(Number(valorParcelaManual)) && Number(valorParcelaManual) >= 0)
      ? Number(valorParcelaManual)
      : valorMensalidadeBase;

    for (let i = 1; i <= qtdParcelas; i++) {
      const vencimento = new Date(dt.getFullYear(), dt.getMonth() + (i - 1), diaVencimento);
      const valorParcela = i === 1 ? (baseParcela + adesao) : baseParcela;
      const descAdesao = i === 1 && adesao > 0 ? " (Inc. Adesão)" : "";

      arr.push({
        numero_parcela: i,
        descricao: `Mensalidade ${i}/${qtdParcelas} - ${planoSelecionado.nome}${descAdesao}`,
        data_vencimento: format(vencimento, 'yyyy-MM-dd'),
        valor: valorParcela
      });
    }
    setParcelas(arr);
  }, [planoSelecionado, dataInicio, qtdParcelas, diaVencimento, valorMensalidadeBase, valorParcelaManual, isAdminOrSuperAdmin]);

  useEffect(() => {
    gerarProjecao();
  }, [gerarProjecao]);

  const confirmarGeracao = async () => {
    if (parcelas.length === 0) return;
    setLoading(true);
    try {
      const mestreId = uuidv4();
      const totalReceita = parcelas.reduce((acc, p) => acc + p.valor, 0);
      const targetTenant = (associado.tenant_id && associado.tenant_id !== 'all')
        ? associado.tenant_id
        : (state.empresaSelecionada && state.empresaSelecionada !== 'all' ? state.empresaSelecionada : 'default_tenant');

      const receitaMestre = {
        id: mestreId,
        tenant_id: targetTenant,
        empresa_id: targetTenant,
        tipo_devedor: 'associado',
        associado_id: associado.id,
        associado_nome: associado.nome,
        associado_cpf: associado.cpf,
        associado_plano: planoSelecionado?.nome,
        descricao: `Contrato de Plano: ${planoSelecionado?.nome}`,
        categoria: 'Mensalidades',
        data_emissao: format(new Date(), 'yyyy-MM-dd'),
        data_inicio_cobranca: parcelas[0].data_vencimento,
        valor_total: totalReceita,
        qtd_parcelas: qtdParcelas,
        forma_pagamento_padrao: 'boleto',
        status: 'ativo',
        criado_por: state.user?.id || null
      };

      const parcelasGeradas = parcelas.map(p => ({
        id: uuidv4(),
        tenant_id: targetTenant,
        empresa_id: targetTenant,
        receita_id: mestreId,
        numero_parcela: p.numero_parcela,
        total_parcelas: qtdParcelas,
        tipo_devedor: 'associado',
        devedor_nome: associado.nome,
        devedor_cpf_cnpj: associado.cpf || '',
        descricao: p.descricao,
        data_vencimento: p.data_vencimento,
        valor: p.valor,
        forma_pagamento: 'boleto',
        status: 'pendente'
      }));

      await salvarReceita(state.isOnline, receitaMestre as any, parcelasGeradas as any);

      await registrarAuditoria('MENSALIDADES_GERADAS', {
        receita_mestre_id: mestreId,
        associado_id: associado.id,
        qtd_parcelas: parcelasGeradas.length,
        valor_total: totalReceita,
        online: state.isOnline
      });

      toast.success("Mensalidades geradas com sucesso no Financeiro!");
      onSuccess();
    } catch (e: any) {
      console.error(e);
      await registrarAuditoria('FALHA_GERACAO_MENSALIDADES', {
        associado_id: associado.id,
        plano_id: planoSelecionado?.id,
        erro: e.message || String(e),
        online: state.isOnline
      });
      toast.error("Erro ao gerar mensalidades no financeiro");
    } finally {
      setLoading(false);
    }
  };

  if (!associado.plano_pax_id) {
    return (
      <div className="p-8 text-center text-text-subtle bg-bg-surface rounded-2xl border border-dashed border-border-default space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
        <p className="font-medium text-text-base">Nenhum plano selecionado</p>
        <p className="text-xs">Selecione um plano na aba "Contratos" antes de gerar mensalidades para este associado.</p>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-bg-subtle border border-border-default rounded-xl text-xs font-semibold hover:bg-bg-hover"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border-default pb-4">
        <div>
          <h4 className="text-text-base font-bold text-lg">Geração de Mensalidades</h4>
          <p className="text-xs text-text-subtle">Configure a periodicidade e valores das parcelas a serem geradas.</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-bg-subtle border border-border-default text-text-subtle hover:text-text-base rounded-xl text-xs font-semibold"
        >
          Voltar ao Organograma
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <div className="flex-1 space-y-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-bg-surface p-4 rounded-2xl border border-border-default">
            <div>
              <p className="text-xs text-text-subtle mb-1">Plano Selecionado</p>
              <p className="text-sm text-text-base font-bold">{planoSelecionado?.nome || 'Carregando...'}</p>
            </div>
            <div>
              <p className="text-xs text-text-subtle mb-1">Taxa de Adesão</p>
              <p className="text-sm text-text-base font-bold">
                {formatCurrency(planoSelecionado?.taxa_adesao || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-subtle mb-1">Total de Vidas</p>
              <p className="text-sm text-text-base font-bold">{associado.n_vidas || 1}</p>
            </div>
            <div>
              <p className="text-xs text-text-subtle mb-1">Valor Calculado p/ Mensalidade</p>
              <p className="text-sm text-emerald-400 font-extrabold font-mono">
                {formatCurrency(valorMensalidadeBase)}
              </p>
              <p className="text-[10px] text-text-subtle mt-0.5">{descricaoCalculo}</p>
            </div>
          </div>

          {ultrapassouLimiteColetivo && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Atenção: Limite de Vidas Excedido</span>
              </div>
              <p className="text-xs text-text-subtle">
                A quantidade de vidas cadastradas ({vidasCadastradas}) é superior ao máximo permitido ({planoSelecionado?.limite_vidas}) para este plano coletivo.
              </p>
              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">Valor Extra a Cobrar (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorExtra || ''}
                  onChange={e => setValorExtra(parseFloat(e.target.value) || 0)}
                  className="w-full max-w-[200px] bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] transition-all text-sm font-bold"
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          <div className={`grid grid-cols-1 ${isAdminOrSuperAdmin ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
            <div>
              <label className="block text-xs font-medium text-text-subtle mb-1">Data Base / Início</label>
              <input
                required
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base text-sm focus:border-[#3B82F6] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-subtle mb-1">Qtd Parcelas (Meses)</label>
              <input
                type="number"
                min="1"
                max="120"
                value={qtdParcelas}
                onChange={e => setQtdParcelas(parseInt(e.target.value) || 1)}
                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base text-sm focus:border-[#3B82F6] outline-none"
              />
            </div>
            {isAdminOrSuperAdmin && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-text-subtle flex items-center gap-1.5">
                    <span>Valor Parcela (R$)</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-500 font-bold rounded border border-amber-500/20">Admin</span>
                  </label>
                  {valorParcelaManual !== '' && (
                    <button
                      type="button"
                      onClick={() => setValorParcelaManual('')}
                      className="text-[10px] text-[#3B82F6] hover:underline"
                      title="Restaurar cálculo automático"
                    >
                      Restaurar
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Auto (R$ ${valorMensalidadeBase.toFixed(2).replace('.', ',')})`}
                  value={valorParcelaManual}
                  onChange={e => setValorParcelaManual(e.target.value)}
                  className={`w-full bg-bg-surface border rounded-xl px-4 py-2 text-text-base text-sm outline-none transition-all ${
                    valorParcelaManual !== '' 
                      ? 'border-amber-500 ring-1 ring-amber-500/30' 
                      : 'border-border-default focus:border-[#3B82F6]'
                  }`}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-text-subtle mb-1">Dia de Vencimento</label>
              <input
                type="number"
                min="1"
                max="31"
                value={diaVencimento}
                onChange={e => setDiaVencimento(parseInt(e.target.value) || 1)}
                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base text-sm focus:border-[#3B82F6] outline-none"
              />
            </div>
          </div>

          {parcelas.length > 0 && (
            <div className="space-y-4">
              <h5 className="text-xs font-bold text-text-base uppercase tracking-wider border-b border-border-default pb-2">
                Prévia das Parcelas Calculadas ({parcelas.length})
              </h5>
              <div className="max-h-[260px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {parcelas.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-bg-surface border border-border-default rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-bg-subtle flex items-center justify-center text-xs font-bold text-text-subtle">
                        {p.numero_parcela}
                      </div>
                      <div>
                        <p className="text-xs text-text-base font-semibold">{p.descricao}</p>
                        <p className="text-[10px] text-text-subtle">Vence em: {formatLocalDate(p.data_vencimento)}</p>
                      </div>
                    </div>
                    <div className="text-emerald-400 font-bold flex items-center gap-1 text-xs">
                      R$
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-24 bg-bg-subtle border border-border-default rounded px-2 py-1 text-right focus:border-[#3B82F6] text-text-base font-bold text-xs"
                        value={p.valor || ''}
                        onChange={(e) => {
                          const newVal = parseFloat(e.target.value) || 0;
                          const newParcelas = [...parcelas];
                          newParcelas[idx].valor = newVal;
                          setParcelas(newParcelas);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-border-default">
                <div className="text-xs text-text-subtle">
                  Total a gerar: <strong className="text-sm font-bold text-emerald-400">{formatCurrency(parcelas.reduce((acc, p) => acc + p.valor, 0))}</strong>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={loading}
                    className="px-4 py-2 bg-bg-subtle border border-border-default text-text-base hover:bg-bg-hover text-xs font-semibold rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarGeracao}
                    disabled={loading || (ultrapassouLimiteColetivo && (!valorExtra || valorExtra <= 0))}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25"
                  >
                    {loading ? 'Gerando...' : 'Confirmar e Lançar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full xl:w-[320px] shrink-0">
          <RegrasCalculoInfo />
        </div>
      </div>
    </div>
  );
};

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
  const [dataRecebimento, setDataRecebimento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [valorRecebido, setValorRecebido] = useState<number>(0);
  const [formaPagamentoEfetiva, setFormaPagamentoEfetiva] = useState<string>('pix');
  const [observacaoRecebimento, setObservacaoRecebimento] = useState<string>('');
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [contaBancariaId, setContaBancariaId] = useState<string>('');
  const [modalStage, setModalStage] = useState<'form' | 'confirmacao' | 'bloqueio'>('form');
  const [loteAberto, setLoteAberto] = useState<any | null>(null);
  const [checkingLote, setCheckingLote] = useState(false);
  const [submittingBaixa, setSubmittingBaixa] = useState(false);
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

      const assocCpf = associado.cpf?.replace(/\D/g, '');
      const assocNome = associado.nome?.toLowerCase().trim();

      // Filtrar receitas pertencentes a este associado
      const receitasFiltradas = todasReceitas.filter(r => {
        if (r.associado_id && r.associado_id === associado.id) return true;
        const rCpf = (r.associado_cpf || r.cliente_cpf_cnpj)?.replace(/\D/g, '');
        if (assocCpf && rCpf && rCpf === assocCpf) return true;
        if (assocNome && (r.associado_nome?.toLowerCase().trim() === assocNome || r.cliente_nome?.toLowerCase().trim() === assocNome)) return true;
        return false;
      });

      const idsReceitasAssociado = new Set(receitasFiltradas.map(r => r.id));

      // Filtrar parcelas pertencentes a este associado
      const parcelasFiltradas = todasParcelas.filter(p => {
        if (p.receita_id && idsReceitasAssociado.has(p.receita_id)) return true;
        const pCpf = p.devedor_cpf_cnpj?.replace(/\D/g, '');
        if (assocCpf && pCpf && pCpf === assocCpf) return true;
        if (assocNome && p.devedor_nome?.toLowerCase().trim() === assocNome) return true;
        return false;
      });

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
    setDataRecebimento(format(new Date(), 'yyyy-MM-dd'));
    setValorRecebido(parcela.valor);
    setFormaPagamentoEfetiva(parcela.forma_pagamento || 'pix');
    setContaBancariaId(parcela.conta_bancaria_id || (contasBancarias.length > 0 ? contasBancarias[0].id : ''));
    setObservacaoRecebimento('');
    setLoteAberto(null);
    setModalStage('form');
    setShowBaixaModal(true);
  };

  // Verificar se há lote de caixa aberto antes de efetivar baixa
  const handleVerificarLoteBaixa = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  // Efetivar recebimento e movimentação no caixa
  const handleEfetivarRecebimento = async () => {
    if (!state.isOnline) {
      toast.error('Baixa de recebimento bloqueada no Modo de Visualização (Offline).');
      return;
    }
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

      await registrarMovimentacao(state.isOnline, {
        tenant_id: state.empresaSelecionada || 'tenant-default',
        lote_id: loteAberto.id,
        tipo: 'entrada',
        origem: 'contas_receber',
        categoria: 'Receita / Mensalidade',
        descricao: `Recebimento: ${parcelaSelecionada.devedor_nome || associado.nome} - ${parcelaSelecionada.descricao}`,
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
      carregarDadosFinanceiros();
    } catch (err: any) {
      console.error('Erro ao efetivar recebimento:', err);
      toast.error(err?.message || 'Erro ao efetivar recebimento');
    } finally {
      setSubmittingBaixa(false);
    }
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
    let proximaData = format(new Date(), 'yyyy-MM-dd');
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
      <MensalidadesGeracaoSubView
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
  const pagas = parcelas.filter(p => p.status === 'recebido' || p.status === 'pago');
  const emAberto = parcelas.filter(p => p.status === 'pendente');
  const atrasadas = parcelas.filter(p => p.status === 'vencido' || p.status === 'atrasado');

  const valorPagas = pagas.reduce((acc, p) => acc + (p.valor_recebido || p.valor || 0), 0);
  const valorAberto = emAberto.reduce((acc, p) => acc + (p.valor || 0), 0);
  const valorAtrasadas = atrasadas.reduce((acc, p) => acc + (p.valor || 0), 0);

  // Filtragem para tabela
  const filtradasTabela = parcelas.filter(p => {
    let matchStatus = filtroStatus === 'all' || p.status === filtroStatus;
    let matchPeriodo = true;
    if (filtroPeriodoInicio) {
      matchPeriodo = matchPeriodo && new Date(p.data_vencimento) >= new Date(filtroPeriodoInicio);
    }
    if (filtroPeriodoFim) {
      matchPeriodo = matchPeriodo && new Date(p.data_vencimento) <= new Date(filtroPeriodoFim);
    }
    return matchStatus && matchPeriodo;
  });

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
        <div className="space-y-4">
          {/* BARRA DE FILTROS DA TABELA */}
          <div className="flex flex-col sm:flex-row gap-3 items-end bg-bg-surface p-3.5 rounded-2xl border border-border-default">
            <div className="w-full sm:w-auto">
              <label className="block text-[10px] font-bold uppercase text-text-subtle mb-1">Situação</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full bg-bg-subtle border border-border-default rounded-xl px-3 py-1.5 text-xs text-text-base focus:border-[#3B82F6] outline-none"
              >
                <option value="all">Todas as Situações</option>
                <option value="pendente">Pendentes</option>
                <option value="recebido">Pagas</option>
                <option value="vencido">Vencidas</option>
                <option value="cancelado">Canceladas</option>
              </select>
            </div>

            <div className="w-full sm:w-auto">
              <label className="block text-[10px] font-bold uppercase text-text-subtle mb-1">Período de Vencimento</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filtroPeriodoInicio}
                  onChange={(e) => setFiltroPeriodoInicio(e.target.value)}
                  className="bg-bg-subtle border border-border-default rounded-xl px-2.5 py-1 text-xs text-text-base focus:border-[#3B82F6] outline-none"
                />
                <span className="text-text-subtle text-xs">até</span>
                <input
                  type="date"
                  value={filtroPeriodoFim}
                  onChange={(e) => setFiltroPeriodoFim(e.target.value)}
                  className="bg-bg-subtle border border-border-default rounded-xl px-2.5 py-1 text-xs text-text-base focus:border-[#3B82F6] outline-none"
                />
              </div>
            </div>

            <div className="flex-1 flex justify-end gap-2 items-center">
              {selectedParcelas.length > 0 && isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowMassDeleteJustificativa(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir ({selectedParcelas.length})
                </button>
              )}

              <button
                type="button"
                onClick={() => { setFiltroStatus('all'); setFiltroPeriodoInicio(''); setFiltroPeriodoFim(''); }}
                className="text-xs font-medium text-[#3B82F6] hover:text-blue-400 px-2 py-1.5"
              >
                Limpar Filtros
              </button>
            </div>
          </div>

          {/* TABELA DE PARCELAS */}
          <div className="border border-border-default rounded-2xl overflow-hidden bg-bg-surface shadow-sm">
            <table className="w-full text-left text-xs text-text-subtle">
              <thead className="bg-bg-subtle border-b border-border-default text-[10px] uppercase font-bold text-text-muted">
                <tr>
                  {isAdmin && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        className="rounded border-border-default text-[#3B82F6] focus:ring-[#3B82F6]"
                        checked={filtradasTabela.length > 0 && selectedParcelas.length === filtradasTabela.filter(p => ['pendente', 'vencido'].includes(p.status)).length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const selectable = filtradasTabela.filter(p => ['pendente', 'vencido'].includes(p.status)).map(p => p.id);
                            setSelectedParcelas(selectable);
                          } else {
                            setSelectedParcelas([]);
                          }
                        }}
                      />
                    </th>
                  )}
                  <th className="px-4 py-3">Parcela / Descrição</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Forma Pagto</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center">Carregando dados financeiros...</td></tr>
                ) : filtradasTabela.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Nenhuma mensalidade encontrada com os filtros selecionados.</td></tr>
                ) : (
                  filtradasTabela.map(p => {
                    const isSelectable = ['pendente', 'vencido'].includes(p.status);
                    const isPendente = p.status === 'pendente' || p.status === 'vencido';
                    const isRecebido = p.status === 'recebido' || p.status === 'pago';

                    return (
                      <tr key={p.id} className="hover:bg-bg-subtle/50 transition-colors">
                        {isAdmin && (
                          <td className="px-4 py-3">
                            {isSelectable && (
                              <input
                                type="checkbox"
                                className="rounded border-border-default text-[#3B82F6] focus:ring-[#3B82F6]"
                                checked={selectedParcelas.includes(p.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedParcelas([...selectedParcelas, p.id]);
                                  } else {
                                    setSelectedParcelas(selectedParcelas.filter(id => id !== p.id));
                                  }
                                }}
                              />
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-text-base">{p.descricao}</div>
                          <span className="text-[10px] text-text-subtle font-mono">#{p.numero_parcela}/{p.total_parcelas || 1}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-200">
                          {formatLocalDate(p.data_vencimento)}
                        </td>
                        <td className="px-4 py-3 font-bold text-white font-mono">
                          {formatCurrency(p.valor)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            p.status === 'recebido' || p.status === 'pago' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            p.status === 'pendente' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            p.status === 'vencido' || p.status === 'atrasado' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }`}>
                            {p.status ? p.status.toUpperCase() : 'PENDENTE'}
                          </span>
                        </td>
                        <td className="px-4 py-3 uppercase text-[10px] font-semibold text-text-subtle">
                          {p.forma_pagamento || 'Boleto'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPendente && (
                              <button
                                type="button"
                                onClick={() => openBaixaModal(p)}
                                title="Registrar recebimento desta parcela"
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                              >
                                <DollarSign className="w-3 h-3" />
                                Receber
                              </button>
                            )}
                            {isRecebido && (
                              <button
                                type="button"
                                onClick={() => handleImprimirRecibo(p)}
                                title="Imprimir recibo desta parcela"
                                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                              >
                                <Printer className="w-3 h-3" />
                                Recibo
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditingParcela({ ...p })}
                                  title="Editar parcela"
                                  className="p-1 rounded text-text-subtle hover:text-blue-400 transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setParcelaToDelete(p)}
                                  title="Excluir parcela"
                                  className="p-1 rounded text-text-subtle hover:text-rose-400 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
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
                  Você está prestes a excluir a receita <strong className="text-white">"{receitaToDelete.descricao}"</strong>.
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
                Você está prestes a excluir a parcela <strong className="text-white">"{parcelaToDelete.descricao}"</strong> no valor de <strong className="text-emerald-400">{formatCurrency(parcelaToDelete.valor)}</strong>.
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

      {/* MODAL DE BAIXA / RECEBIMENTO */}
      {showBaixaModal && parcelaSelecionada && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-bg-subtle border border-border-default rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* ETAPA 1: FORMULÁRIO */}
            {modalStage === 'form' && (
              <>
                <div className="flex items-center justify-between p-6 border-b border-border-default">
                  <h3 className="text-base font-bold text-text-base flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    Registrar Recebimento
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowBaixaModal(false)}
                    className="text-text-subtle hover:text-text-base"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleVerificarLoteBaixa} className="p-6 space-y-4 text-xs">
                  <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-1">
                    <p className="text-[10px] text-text-subtle uppercase tracking-wider">
                      Parcela {parcelaSelecionada.numero_parcela}/{parcelaSelecionada.total_parcelas || 1}
                    </p>
                    <p className="text-base font-bold text-text-base">{parcelaSelecionada.descricao}</p>
                    <p className="text-xs text-text-subtle">Associado: <strong className="text-text-base">{associado.nome}</strong></p>
                  </div>

                  <div>
                    <label className="block font-medium text-text-subtle mb-1">Data do Recebimento *</label>
                    <input
                      type="date"
                      value={dataRecebimento}
                      onChange={(e) => setDataRecebimento(e.target.value)}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-text-subtle mb-1">Valor Recebido (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorRecebido}
                      onChange={(e) => setValorRecebido(Number(e.target.value))}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] outline-none font-bold text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-text-subtle mb-1">Forma de Pagamento Efetiva *</label>
                    <select
                      value={formaPagamentoEfetiva}
                      onChange={(e) => setFormaPagamentoEfetiva(e.target.value)}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] outline-none"
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

                  {formaPagamentoEfetiva !== 'dinheiro' && contasBancarias.length > 0 && (
                    <div>
                      <label className="block font-medium text-text-subtle mb-1">Conta Bancária Referencial</label>
                      <select
                        value={contaBancariaId}
                        onChange={(e) => setContaBancariaId(e.target.value)}
                        className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] outline-none"
                      >
                        <option value="">Selecione a conta...</option>
                        {contasBancarias.map(conta => (
                          <option key={conta.id} value={conta.id}>{conta.nome} ({conta.banco})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block font-medium text-text-subtle mb-1">Observações do Recebimento</label>
                    <textarea
                      rows={2}
                      value={observacaoRecebimento}
                      onChange={(e) => setObservacaoRecebimento(e.target.value)}
                      placeholder="Ex: Recebido em dinheiro no balcão"
                      className="w-full bg-bg-surface border border-border-default rounded-xl p-3 text-text-base text-xs focus:border-[#3B82F6] outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                    <button
                      type="button"
                      onClick={() => setShowBaixaModal(false)}
                      className="px-4 py-2 rounded-xl text-text-subtle hover:bg-bg-hover text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={checkingLote}
                      className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                    >
                      {checkingLote ? 'Verificando Caixa...' : 'Avançar'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* ETAPA 2: BLOQUEIO */}
            {modalStage === 'bloqueio' && (
              <div className="p-6 space-y-5 text-xs">
                <div className="flex items-start justify-between border-b border-border-default pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Operação Bloqueada</h3>
                      <p className="text-[11px] text-rose-400 font-semibold">Nenhum Lote de Caixa Aberto Encontrado</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBaixaModal(false)}
                    className="text-text-subtle hover:text-text-base"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl space-y-2">
                  <p className="text-text-subtle leading-relaxed">
                    Para efetivar este registro de recebimento, o sistema exige que exista um <strong>Lote de Caixa aberto</strong> ativo para receber a movimentação financeira.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
                  <button
                    type="button"
                    onClick={() => setModalStage('form')}
                    className="px-4 py-2 rounded-xl text-text-subtle hover:bg-bg-hover text-xs font-semibold"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBaixaModal(false);
                      navigate('/financeiro/caixas');
                    }}
                    className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Abrir Lote de Caixa
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 3: CONFIRMAÇÃO */}
            {modalStage === 'confirmacao' && loteAberto && (
              <div className="p-6 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-border-default pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Confirmar Registro no Caixa
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowBaixaModal(false)}
                    className="text-text-subtle hover:text-text-base"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-400">Lote Destino:</span>
                    <span className="px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300">
                      {loteAberto.codigo_lote}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Operador:</span>
                    <strong className="text-white">{loteAberto.operador_nome}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Terminal / Caixa:</span>
                    <strong className="text-white">{loteAberto.terminal_caixa}</strong>
                  </div>
                </div>

                <div className="bg-bg-surface p-3.5 rounded-xl border border-border-default space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Associado:</span>
                    <strong className="text-white">{associado.nome}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Parcela:</span>
                    <span className="text-white font-medium">{parcelaSelecionada.descricao}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Forma de Pagamento:</span>
                    <span className="uppercase font-bold text-blue-400">{formaPagamentoEfetiva}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10 items-baseline">
                    <span className="text-text-subtle font-medium">Valor Efetivo:</span>
                    <span className="text-lg font-extrabold text-emerald-400 font-mono">
                      {formatCurrency(valorRecebido)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-default">
                  <button
                    type="button"
                    onClick={() => setModalStage('form')}
                    className="px-4 py-2 rounded-xl text-text-subtle hover:bg-bg-hover text-xs font-semibold"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleEfetivarRecebimento}
                    disabled={submittingBaixa}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                  >
                    {submittingBaixa ? 'Efetivando...' : 'Confirmar e Efetivar Baixa'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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
