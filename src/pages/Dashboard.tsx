import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, FileText, DollarSign, Activity, TrendingUp,
  ShieldAlert, Settings2, Heart, Zap, UserPlus, Stethoscope, ArrowRight,
} from 'lucide-react';
import { DashboardSettingsModal, WidgetConfig, defaultWidgets } from '../components/DashboardSettingsModal';
import { useAppContext } from '../context/AppContext';
import { getDashboardStats, DashboardStats, DashboardPeriod } from '../services/dashboardService';
import { get, set } from '../lib/idb-safe';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { RefreshCw, CheckCircle2, WifiOff } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAvisoExpiracaoContratos } from '../hooks/useAvisoExpiracaoContratos';

export const Dashboard: React.FC = () => {
  const { state } = useAppContext();
  useAvisoExpiracaoContratos(30); // Aviso de 30 dias para expiração de contratos
  const { pendingCount, isSyncing } = useSyncStatus();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<DashboardPeriod>('mensal');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [layout, setLayout] = useState<WidgetConfig[]>(defaultWidgets);
  const [filtroReceitas, setFiltroReceitas] = useState('todos');
  const [filtroDespesas, setFiltroDespesas] = useState('todos');
  const [isAssocExpanded, setIsAssocExpanded] = useState(true);

  const getValoresFinanceiros = (
    parcelas: any[],
    filtro: string,
    tipo: 'receber' | 'pagar'
  ) => {
    let projetado = 0;
    let realizado = 0;
    const hoje = new Date();

    (parcelas || []).forEach(p => {
      const dataVenc = new Date(p.data_vencimento + 'T12:00:00');
      let include = false;

      if (filtro === 'todos') {
        include = true;
      } else if (filtro === 'mensal') {
        include = dataVenc.getMonth() === hoje.getMonth() && dataVenc.getFullYear() === hoje.getFullYear();
      } else if (filtro === 'trimestral') {
        const diffMonths = (hoje.getFullYear() - dataVenc.getFullYear()) * 12 + (hoje.getMonth() - dataVenc.getMonth());
        include = diffMonths >= 0 && diffMonths < 3;
      } else if (filtro === 'anual') {
        include = dataVenc.getFullYear() === hoje.getFullYear();
      }

      if (include) {
        if (p.status !== 'cancelado') {
          projetado += p.valor;
        }
        if (tipo === 'receber' && p.status === 'recebido') {
          realizado += (p.valor_recebido || p.valor);
        } else if (tipo === 'pagar' && p.status === 'pago') {
          realizado += (p.valor_pago || p.valor);
        }
      }
    });

    return { projetado, realizado };
  };

  useEffect(() => {
    get('dashboard_layout').then(saved => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const missing = defaultWidgets.filter(dw => !parsed.find((cw: WidgetConfig) => cw.id === dw.id));
          // Se o atalhos rápidos for recém-adicionado (está em missing), coloca no topo
          const atalhos = missing.filter(m => m.id === 'atalhos_rapidos');
          const others = missing.filter(m => m.id !== 'atalhos_rapidos');
          setLayout([...atalhos, ...parsed, ...others]);
        } catch (e) {
          setLayout(defaultWidgets);
        }
      }
    });
  }, []);

  const handleSaveLayout = (newLayout: WidgetConfig[]) => {
    setLayout(newLayout);
    set('dashboard_layout', JSON.stringify(newLayout));
  };

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const data = await getDashboardStats(state.isOnline, state.empresaSelecionada, period);
        setStats(data);
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [state.isOnline, state.empresaSelecionada, period]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-14 w-14 border-2 border-transparent border-t-[#3B82F6] border-r-[#3B82F6]/40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-[#3B82F6]/20 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const formatCurrencyTick = (val: number) => {
    if (!val || val === 0) return 'R$ 0';
    const abs = Math.abs(val);
    if (abs >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `R$ ${(val / 1000).toFixed(1).replace('.0', '')}k`;
    return `R$ ${val.toLocaleString('pt-BR')}`;
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#3B82F6] to-[#60A5FA] shadow-[0_0_12px_rgba(59,130,246,0.5)]" />
            <h2 className="text-3xl font-extrabold tracking-tight text-text-base">
              Dashboard
            </h2>
          </div>
          <p className="text-text-subtle mt-1 text-sm pl-4">
            Visão geral do sistema e indicadores de performance em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center bg-bg-surface border border-border-default rounded-xl p-1 shadow-sm">
            {(['mensal', 'trimestral', 'anual'] as DashboardPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 capitalize ${
                  period === p
                    ? 'bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white shadow-sm shadow-blue-500/30'
                    : 'text-text-subtle hover:text-text-base'
                }`}
              >
                {p === 'mensal' ? 'Mensal' : p === 'trimestral' ? 'Trimestral' : 'Anual'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 h-[38px] w-[38px] flex items-center justify-center bg-bg-surface border border-border-default text-text-subtle hover:text-[#3B82F6] hover:border-[#3B82F6]/40 rounded-xl shadow-sm transition-all duration-200 hover:shadow-blue-500/10 hover:shadow-md"
            title="Personalizar Dashboard"
          >
            <Settings2 className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      <DashboardSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        layout={layout}
        onSave={handleSaveLayout}
      />

      {/* ── Widget Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 grid-flow-row-dense">
        {layout.filter(w => w.visible).map((widget) => {
          switch (widget.id) {

            /* ─── Atalhos Rápidos ─── */
            case 'atalhos_rapidos':
              return (
                <div
                  key="atalhos_rapidos"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 lg:col-span-4 flex flex-col justify-center gap-4 overflow-hidden group shadow-sm hover:shadow-md transition-shadow duration-300"
                >
                  {/* Ambient glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-blue-500/[0.04] pointer-events-none" />
                  <div className="absolute top-0 left-1/4 w-96 h-24 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />

                  <div className="flex items-center gap-2 relative z-10">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <Zap className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-text-base tracking-wide uppercase">Atalhos Rápidos</h3>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                    <Link
                      to="/associados"
                      state={{ openNew: true }}
                      className="flex-1 flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold py-3 px-5 rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-95 hover:shadow-emerald-500/40"
                    >
                      <UserPlus className="w-5 h-5" />
                      Novo Associado
                    </Link>
                    <Link
                      to="/atendimentos"
                      state={{ openNew: true }}
                      className="flex-1 flex items-center justify-center gap-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold py-3 px-5 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-95 hover:shadow-blue-500/40"
                    >
                      <Stethoscope className="w-5 h-5" />
                      Novo Atendimento
                    </Link>
                  </div>
                </div>
              );

            /* ─── Associados Ativos ─── */
            case 'stat_associados':
              return (
                <div
                  key="stat_associados"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 flex flex-col justify-between overflow-hidden group col-span-1 shadow-sm hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-500/30 transition-all duration-300"
                >
                  <div className="absolute -right-6 -top-6 w-28 h-28 opacity-10 blur-2xl rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#60A5FA] group-hover:opacity-25 transition-opacity duration-500" />
                  <div className="flex items-start justify-between mb-5 relative z-10">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] text-white shadow-lg shadow-blue-500/30">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="flex items-center text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20" title="Novos no período">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      +{stats?.novosAssociados || 0}
                    </span>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-3xl font-extrabold text-text-base tracking-tight tabular-nums">
                      {stats?.associadosAtivos || 0}
                    </h3>
                    <p className="text-sm font-semibold text-text-subtle mt-1">Associados Ativos</p>
                    <p className="text-[11px] font-medium text-text-muted mt-0.5 opacity-75">
                      + {stats?.totalDependentes || 0} dependentes
                    </p>
                  </div>
                </div>
              );

            /* ─── Atendimentos ─── */
            case 'stat_atendimentos':
              return (
                <div
                  key="stat_atendimentos"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 flex flex-col justify-between overflow-hidden group col-span-1 shadow-sm hover:shadow-lg hover:shadow-rose-500/10 hover:border-rose-500/30 transition-all duration-300"
                >
                  <div className="absolute -right-6 -top-6 w-28 h-28 opacity-10 blur-2xl rounded-full bg-gradient-to-tr from-[#F43F5E] to-[#F97316] group-hover:opacity-25 transition-opacity duration-500" />
                  <div className="flex items-start justify-between mb-5 relative z-10">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#F43F5E] to-[#F97316] text-white shadow-lg shadow-rose-500/30">
                      <FileText className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-3xl font-extrabold text-text-base tracking-tight tabular-nums">
                      {stats?.atendimentosPeriodo || 0}
                    </h3>
                    <p className="text-sm font-semibold text-text-subtle mt-1">
                      Atendimentos ({period === 'anual' ? 'Anual' : period === 'trimestral' ? 'Trimestral' : 'Mensal'})
                    </p>
                  </div>
                </div>
              );

            /* ─── Receitas ─── */
            case 'stat_receitas': {
              const valores = getValoresFinanceiros(stats?.parcelasReceberRaw || [], filtroReceitas, 'receber');
              const pct = Math.min(((valores.realizado || 0) / (valores.projetado || 1)) * 100, 100);
              return (
                <div
                  key="stat_receitas"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 flex flex-col justify-between overflow-hidden group col-span-1 lg:col-span-2 shadow-sm hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-500/30 transition-all duration-300"
                >
                  <div className="absolute -right-10 -top-10 w-48 h-48 opacity-[0.08] blur-3xl rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#60A5FA] group-hover:opacity-20 transition-opacity duration-500" />
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] text-white shadow-lg shadow-blue-500/30">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <h3 className="text-base font-bold text-text-base">Receitas</h3>
                    </div>
                    <select
                      value={filtroReceitas}
                      onChange={(e) => setFiltroReceitas(e.target.value)}
                      className="text-xs font-bold text-text-muted bg-bg-subtle px-2.5 py-1 rounded-lg border border-border-default focus:outline-none cursor-pointer hover:bg-bg-hover transition-colors"
                    >
                      <option value="todos">Todos</option>
                      <option value="mensal">Mês Atual</option>
                      <option value="trimestral">Trimestre</option>
                      <option value="anual">Ano Atual</option>
                    </select>
                  </div>
                  <div className="relative z-10 grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-xs font-semibold text-text-subtle mb-1 uppercase tracking-wide">Projetado</p>
                      <h3 className="text-xl font-extrabold text-text-base tracking-tight tabular-nums">
                        R$ {(valores.projetado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </h3>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-subtle mb-1 uppercase tracking-wide">Arrecadado</p>
                      <h3 className="text-xl font-extrabold text-emerald-400 tracking-tight tabular-nums">
                        R$ {(valores.realizado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-4 relative z-10">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Progresso</span>
                      <span className="text-[10px] text-emerald-400 font-bold">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-bg-hover rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-1.5 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            }

            /* ─── Faturamento ─── */
            case 'stat_faturamento':
              return (
                <div
                  key="stat_faturamento"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 flex flex-col justify-between overflow-hidden group col-span-1 shadow-sm hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300"
                >
                  <div className="absolute -right-6 -top-6 w-28 h-28 opacity-10 blur-2xl rounded-full bg-gradient-to-tr from-[#10B981] to-[#3B82F6] group-hover:opacity-25 transition-opacity duration-500" />
                  <div className="flex items-start justify-between mb-5 relative z-10">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#10B981] to-[#3B82F6] text-white shadow-lg shadow-emerald-500/30">
                      <DollarSign className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-2xl font-extrabold text-text-base tracking-tight tabular-nums">
                      R$ {(stats?.faturamentoEstimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-sm font-semibold text-text-subtle mt-1">Faturamento Mensal Estimado</p>
                  </div>
                </div>
              );

            /* ─── Despesas ─── */
            case 'stat_despesas': {
              const valores = getValoresFinanceiros(stats?.parcelasPagarRaw || [], filtroDespesas, 'pagar');
              const pct = Math.min(((valores.realizado || 0) / (valores.projetado || 1)) * 100, 100);
              return (
                <div
                  key="stat_despesas"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 flex flex-col justify-between overflow-hidden group col-span-1 lg:col-span-2 shadow-sm hover:shadow-lg hover:shadow-rose-500/10 hover:border-rose-500/30 transition-all duration-300"
                >
                  <div className="absolute -right-10 -top-10 w-48 h-48 opacity-[0.08] blur-3xl rounded-full bg-gradient-to-tr from-rose-500 to-rose-600 group-hover:opacity-20 transition-opacity duration-500" />
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/30">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <h3 className="text-base font-bold text-text-base">Despesas</h3>
                    </div>
                    <select
                      value={filtroDespesas}
                      onChange={(e) => setFiltroDespesas(e.target.value)}
                      className="text-xs font-bold text-text-muted bg-bg-subtle px-2.5 py-1 rounded-lg border border-border-default focus:outline-none cursor-pointer hover:bg-bg-hover transition-colors"
                    >
                      <option value="todos">Todos</option>
                      <option value="mensal">Mês Atual</option>
                      <option value="trimestral">Trimestre</option>
                      <option value="anual">Ano Atual</option>
                    </select>
                  </div>
                  <div className="relative z-10 grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-xs font-semibold text-text-subtle mb-1 uppercase tracking-wide">Projetado</p>
                      <h3 className="text-xl font-extrabold text-text-base tracking-tight tabular-nums">
                        R$ {(valores.projetado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </h3>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-subtle mb-1 uppercase tracking-wide">Pago</p>
                      <h3 className="text-xl font-extrabold text-rose-400 tracking-tight tabular-nums">
                        R$ {(valores.realizado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-4 relative z-10">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Progresso</span>
                      <span className="text-[10px] text-rose-400 font-bold">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-bg-hover rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-rose-500 to-rose-400 h-1.5 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            }

            /* ─── Taxa de Ativos ─── */
            case 'stat_conversao':
              return (
                <div
                  key="stat_conversao"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 flex flex-col justify-between overflow-hidden group col-span-1 shadow-sm hover:shadow-lg hover:shadow-purple-500/10 hover:border-purple-500/30 transition-all duration-300"
                >
                  <div className="absolute -right-6 -top-6 w-28 h-28 opacity-10 blur-2xl rounded-full bg-gradient-to-tr from-[#8B5CF6] to-[#D946EF] group-hover:opacity-25 transition-opacity duration-500" />
                  <div className="flex items-start justify-between mb-5 relative z-10">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#D946EF] text-white shadow-lg shadow-purple-500/30">
                      <Activity className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-3xl font-extrabold text-text-base tracking-tight tabular-nums">
                      {stats?.taxaConversao || 0}%
                    </h3>
                    <p className="text-sm font-semibold text-text-subtle mt-1">Taxa de Ativos</p>
                  </div>
                </div>
              );

            /* ─── Vidas por Plano ─── */
            case 'stat_vidas_planos':
              return (
                <div
                  key="stat_vidas_planos"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 lg:col-span-2 flex flex-col overflow-hidden group shadow-sm hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300"
                >
                  <div className="absolute top-0 right-0 w-64 h-48 bg-emerald-500 opacity-[0.04] blur-3xl rounded-full pointer-events-none" />
                  <div className="flex items-center gap-3 mb-5 relative z-10">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
                      <Heart className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-text-base">Vidas por Plano</h3>
                      <p className="text-xs text-text-subtle">Titulares + Dependentes ativos</p>
                    </div>
                  </div>
                  <div className="relative z-10 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {stats?.vidasPorPlano && stats.vidasPorPlano.length > 0 ? (
                      stats.vidasPorPlano.map((vp, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-bg-subtle/60 border border-border-default hover:border-emerald-500/20 transition-colors">
                          <span className="font-medium text-sm text-text-muted">{vp.plano}</span>
                          <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold tabular-nums">
                            {vp.vidas} {vp.vidas === 1 ? 'vida' : 'vidas'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-text-subtle text-sm italic py-4">Nenhum dado encontrado.</p>
                    )}
                  </div>
                </div>
              );

            /* ─── Gráfico Atendimentos ─── */
            case 'chart_atendimentos':
              return (
                <div
                  key="chart_atendimentos"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 lg:col-span-2 flex flex-col overflow-hidden shadow-sm"
                >
                  <div className="absolute top-0 right-0 w-64 h-48 bg-[#3B82F6] opacity-[0.04] blur-3xl rounded-full pointer-events-none" />
                  <div className="mb-5 relative z-10">
                    <h3 className="text-base font-bold text-text-base">Atendimentos Mensais</h3>
                    <p className="text-xs text-text-subtle mt-0.5">Volume de serviços funerários realizados</p>
                  </div>
                  <div className="flex-1 min-h-[230px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.atendimentosGrafico || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                            <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.7} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8B95A5', fontSize: 11 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#8B95A5', fontSize: 11 }} />
                        <Tooltip
                          cursor={{ fill: '#475569', opacity: 0.2 }}
                          contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: '1px solid #475569', color: '#fff', fontSize: '12px' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value: any) => [`${value} atendimento(s)`, 'Total']}
                        />
                        <Bar dataKey="total" radius={[6, 6, 4, 4]} maxBarSize={36}>
                          {(stats?.atendimentosGrafico || []).map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill="url(#colorUv)" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );

            /* ─── Recebimentos KPI ─── */
            case 'chart_recebimentos':
              return (
                <div
                  key="chart_recebimentos"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 lg:col-span-2 flex flex-col overflow-hidden shadow-sm"
                >
                  <div className="absolute top-0 right-0 w-64 h-48 bg-emerald-500 opacity-[0.04] blur-3xl rounded-full pointer-events-none" />
                  <div className="mb-5 relative z-10">
                    <h3 className="text-base font-bold text-text-base">Recebimentos Pendentes (KPI)</h3>
                    <p className="text-xs text-text-subtle mt-0.5">Comparativo entre projetado e arrecadado</p>
                  </div>
                  <div className="flex-1 min-h-[230px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.recebimentosGrafico || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8B95A5', fontSize: 11 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8B95A5', fontSize: 11 }} tickFormatter={formatCurrencyTick} />
                        <Tooltip
                          cursor={{ fill: '#475569', opacity: 0.2 }}
                          contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: '1px solid #475569', color: '#fff', fontSize: '12px' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value: any) => [`R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, undefined]}
                        />
                        <Bar dataKey="projetado" name="Projetado" fill="#64748B" radius={[4, 4, 2, 2]} maxBarSize={28} />
                        <Bar dataKey="recebido" name="Recebido" fill="#10B981" radius={[4, 4, 2, 2]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );

            /* ─── Saúde Financeira ─── */
            case 'chart_saude_financeira':
              return (
                <div
                  key="chart_saude_financeira"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 lg:col-span-2 flex flex-col overflow-hidden shadow-sm"
                >
                  <div className="absolute top-0 right-0 w-64 h-48 bg-blue-500 opacity-[0.04] blur-3xl rounded-full pointer-events-none" />
                  <div className="mb-5 relative z-10">
                    <h3 className="text-base font-bold text-text-base">Saúde Financeira</h3>
                    <p className="text-xs text-text-subtle mt-0.5">Comparativo entre receitas e despesas projetadas</p>
                  </div>
                  <div className="flex-1 min-h-[230px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.financeiroGrafico || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8B95A5', fontSize: 11 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8B95A5', fontSize: 11 }} tickFormatter={formatCurrencyTick} />
                        <Tooltip
                          cursor={{ fill: '#475569', opacity: 0.2 }}
                          contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: '1px solid #475569', color: '#fff', fontSize: '12px' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value: any, name: any) => [
                            `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                            String(name || '').charAt(0).toUpperCase() + String(name || '').slice(1),
                          ]}
                        />
                        <Bar dataKey="receitas" name="Receitas" fill="#10B981" radius={[4, 4, 2, 2]} maxBarSize={28} />
                        <Bar dataKey="despesas" name="Despesas" fill="#F43F5E" radius={[4, 4, 2, 2]} maxBarSize={28} />
                        <Bar dataKey="saldo" name="Saldo" fill="#3B82F6" radius={[4, 4, 2, 2]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );

            /* ─── Ações Recentes ─── */
            case 'acoes_recentes':
              return (
                <div
                  key="acoes_recentes"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 lg:col-span-1 flex flex-col overflow-hidden shadow-sm"
                >
                  <div className="mb-5 flex items-center justify-between relative z-10">
                    <h3 className="text-base font-bold text-text-base">Ações Recentes</h3>
                  </div>
                  <div className="space-y-3 flex-1 relative z-10">
                    {(stats?.acoesRecentes || []).length > 0 ? (
                      (stats?.acoesRecentes || []).map((item, i) => (
                        <div
                          key={`acao-${i}`}
                          className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-bg-subtle transition-colors border border-transparent hover:border-border-default"
                        >
                          <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.color} shadow-[0_0_8px_currentColor]`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-text-base truncate">{item.title}</p>
                            <p className="text-xs text-text-subtle truncate">{item.desc}</p>
                          </div>
                          <span className="text-xs font-medium text-text-subtle whitespace-nowrap">{item.time}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-full text-text-subtle text-sm py-8">
                        Nenhuma ação recente registrada.
                      </div>
                    )}
                  </div>
                </div>
              );

            /* ─── Status do Sistema ─── */
            case 'status_sistema':
              return (
                <div
                  key="status_sistema"
                  className="relative bg-bg-surface rounded-2xl border border-border-default p-5 lg:col-span-1 flex flex-col overflow-hidden shadow-sm"
                >
                  <div className="absolute top-0 right-0 p-3 opacity-[0.04] pointer-events-none">
                    <ShieldAlert className="w-32 h-32" />
                  </div>
                  <div className="relative z-10 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-bold text-text-base">Status do Sistema</h3>
                    </div>

                    <div className="mt-auto space-y-3">
                      <div className="bg-bg-subtle p-3.5 rounded-xl border border-border-default">
                        <p className="text-text-subtle text-[10px] font-bold uppercase tracking-widest mb-2">Conexão Backend</p>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${state.isOnline ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse'}`} />
                          <span className="font-bold text-sm text-text-base">{state.isOnline ? 'Supabase Conectado' : 'Modo Offline (IDB)'}</span>
                        </div>
                      </div>

                      <div className="bg-bg-subtle p-3.5 rounded-xl border border-border-default">
                        <p className="text-text-subtle text-[10px] font-bold uppercase tracking-widest mb-2">Sincronização</p>
                        <div className="flex items-center gap-2.5">
                          {state.isOnline ? (
                            pendingCount > 0 ? (
                              <>
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)] animate-pulse shrink-0" />
                                <span className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
                                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                                  Sincronizando ({pendingCount})
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.6)] shrink-0" />
                                <span className="font-bold text-blue-400 flex items-center gap-1.5 text-sm">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Sincronizado
                                </span>
                              </>
                            )
                          ) : (
                            <>
                              <div className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.6)] animate-pulse shrink-0" />
                              <span className="font-bold text-rose-400 flex items-center gap-1.5 text-sm">
                                <WifiOff className="w-3.5 h-3.5" />
                                Aguardando Sinc. ({pendingCount})
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );

            /* ─── Associados sem Mensalidade ─── */
            case 'widget_assoc_sem_mensalidade': {
              const assocs = stats?.associadosSemMensalidadesAberto || [];
              if (assocs.length === 0) return null;

              return (
                <div
                  key="widget_assoc_sem_mensalidade"
                  className="relative bg-bg-surface border-l-4 border-l-amber-500 border-y border-r border-border-default rounded-2xl p-4 shadow-sm lg:col-span-4 flex flex-col overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500 opacity-[0.02] blur-2xl rounded-full pointer-events-none" />

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div
                        className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95"
                        onClick={() => setIsAssocExpanded(!isAssocExpanded)}
                        title={isAssocExpanded ? 'Ocultar itens' : 'Expandir itens'}
                      >
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                        <div className="bg-amber-500/10 p-2.5 rounded-xl shrink-0 text-amber-500">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-text-base font-bold text-base tracking-tight">Associados sem Mensalidade</h3>
                        <p className="text-amber-500/80 text-xs mt-0.5 font-medium">
                          {assocs.length} associado(s) ativo(s) sem mensalidades geradas.
                        </p>
                      </div>
                    </div>
                  </div>

                  {isAssocExpanded && (
                    <div className="relative z-10 flex-1 min-h-[150px] max-h-[200px] overflow-y-auto pr-2 custom-scrollbar space-y-2 mt-1">
                      {assocs.map((assoc, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-xl bg-bg-subtle border border-transparent hover:border-amber-500/30 transition-colors">
                          <div>
                            <p className="font-semibold text-sm text-text-base">{assoc.nome}</p>
                            <p className="text-[11px] text-text-muted mt-0.5 font-medium">
                              {assoc.telefone || assoc.celular_whatsapp || 'Sem telefone'} • Adesão:{' '}
                              {assoc.data_adesao ? new Date(assoc.data_adesao + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                            </p>
                          </div>
                          <Link
                            to={`/associados`}
                            state={{ search: assoc.nome }}
                            className="px-3 py-1.5 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg font-bold transition-colors text-xs text-center shrink-0 flex items-center gap-1.5"
                          >
                            Ver
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
};
