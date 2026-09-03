import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, FileText, DollarSign, Activity, TrendingUp,
  ShieldAlert, Settings2, Heart, UserPlus, Stethoscope, ArrowRight,
} from 'lucide-react';
import { DashboardSettingsModal, WidgetConfig, WidgetId, defaultWidgets } from '../components/DashboardSettingsModal';
import { useAppContext } from '../context/AppContext';
import { getDashboardStats, DashboardStats, DashboardPeriod } from '../services/dashboardService';
import { get, set } from '../lib/idb-safe';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { RefreshCw, CheckCircle2, WifiOff } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAvisoExpiracaoContratos } from '../hooks/useAvisoExpiracaoContratos';
import { StatCard } from '../components/common/StatCard';
import { SkeletonWidget } from '../components/common/Skeleton';

// Agrupamento visual dos widgets em zonas (Visão geral / Análises / Operação).
// Não afeta a lógica de reordenação/visibilidade — só como os widgets visíveis
// são distribuídos entre os 3 sub-grids na tela.
const OVERVIEW_IDS: WidgetId[] = [
  'stat_associados', 'stat_atendimentos', 'stat_conversao',
  'stat_receitas', 'stat_despesas', 'stat_faturamento', 'stat_vidas_planos',
];
const ANALISES_IDS: WidgetId[] = ['chart_atendimentos', 'chart_recebimentos', 'chart_saude_financeira'];
const OPERACAO_IDS: WidgetId[] = ['acoes_recentes', 'status_sistema'];

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-3">
    <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-text-subtle whitespace-nowrap">
      {children}
    </span>
    <div className="h-px flex-1 bg-border-subtle" />
  </div>
);

const chartTooltipStyle = {
  backgroundColor: 'var(--color-bg-surface)',
  borderRadius: '12px',
  border: '1px solid var(--color-border-default)',
  color: 'var(--color-text-base)',
  fontSize: '12px',
  boxShadow: '0 12px 32px -12px rgba(0,0,0,0.35)',
};
const chartTickStyle = { fill: 'var(--color-text-subtle)', fontSize: 11 };
const chartGridStroke = 'var(--color-border-subtle)';

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

  const formatCurrencyTick = (val: number) => {
    if (!val || val === 0) return 'R$ 0';
    const abs = Math.abs(val);
    if (abs >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `R$ ${(val / 1000).toFixed(1).replace('.0', '')}k`;
    return `R$ ${val.toLocaleString('pt-BR')}`;
  };

  /* ─────────────────────────── Render de cada widget ─────────────────────────── */
  const renderWidget = (widget: WidgetConfig): React.ReactNode => {
    switch (widget.id) {

      /* ─── Atalhos Rápidos ─── */
      case 'atalhos_rapidos':
        return (
          <div key="atalhos_rapidos" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to="/associados"
              state={{ openNew: true }}
              className="relative flex items-center gap-4 rounded-2xl p-5 overflow-hidden text-white bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 shadow-[0_18px_36px_-14px_rgba(5,150,105,0.55)] hover:-translate-y-0.5 hover:shadow-[0_22px_40px_-14px_rgba(5,150,105,0.6)] transition-all duration-300 group"
            >
              <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/25 blur-3xl" />
              <span className="relative z-10 w-12 h-12 rounded-2xl bg-white/15 border border-white/25 backdrop-blur flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5" />
              </span>
              <span className="relative z-10">
                <strong className="block text-[15px] font-bold">Novo Associado</strong>
                <span className="block text-xs opacity-85 mt-0.5">Cadastrar titular e dependentes</span>
              </span>
              <ArrowRight className="relative z-10 w-4.5 h-4.5 ml-auto opacity-80 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/atendimentos"
              state={{ openNew: true }}
              className="relative flex items-center gap-4 rounded-2xl p-5 overflow-hidden text-white bg-gradient-to-br from-[#4F8CF7] via-[#2563EB] to-[#1D4FC4] shadow-[0_18px_36px_-14px_rgba(37,99,235,0.55)] hover:-translate-y-0.5 hover:shadow-[0_22px_40px_-14px_rgba(37,99,235,0.6)] transition-all duration-300 group"
            >
              <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/25 blur-3xl" />
              <span className="relative z-10 w-12 h-12 rounded-2xl bg-white/15 border border-white/25 backdrop-blur flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5" />
              </span>
              <span className="relative z-10">
                <strong className="block text-[15px] font-bold">Novo Atendimento</strong>
                <span className="block text-xs opacity-85 mt-0.5">Registrar ocorrência funerária</span>
              </span>
              <ArrowRight className="relative z-10 w-4.5 h-4.5 ml-auto opacity-80 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        );

      /* ─── Associados Ativos (card herói) ─── */
      case 'stat_associados': {
        const titulares = stats?.associadosAtivos || 0;
        const dependentes = stats?.totalDependentes || 0;
        const total = titulares + dependentes || 1;
        const pctTitulares = Math.round((titulares / total) * 100);
        return (
          <StatCard
            key="stat_associados"
            tone="blue"
            size="lg"
            className="md:col-span-2 lg:row-span-2"
            icon={<Users className="w-5 h-5" />}
            label="Associados Ativos"
            value={titulares}
            sub={`${dependentes} dependentes vinculados`}
            delta={
              <span
                className="flex items-center text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20"
                title="Novos no período"
              >
                <TrendingUp className="w-3 h-3 mr-1" />
                +{stats?.novosAssociados || 0}
              </span>
            }
            extra={
              titulares + dependentes > 0 ? (
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-text-subtle mb-1.5">
                    <span>Titulares · {pctTitulares}%</span>
                    <span>Dependentes · {100 - pctTitulares}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-bg-hover overflow-hidden flex">
                    <div className="h-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA]" style={{ width: `${pctTitulares}%` }} />
                    <div className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#D946EF]" style={{ width: `${100 - pctTitulares}%` }} />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] font-medium text-text-subtle italic">Nenhum associado cadastrado ainda.</p>
              )
            }
          />
        );
      }

      /* ─── Atendimentos ─── */
      case 'stat_atendimentos':
        return (
          <StatCard
            key="stat_atendimentos"
            tone="rose"
            className="self-start"
            icon={<FileText className="w-5 h-5" />}
            label={`Atendimentos (${period === 'anual' ? 'Anual' : period === 'trimestral' ? 'Trimestral' : 'Mensal'})`}
            value={stats?.atendimentosPeriodo || 0}
          />
        );

      /* ─── Taxa de Ativos ─── */
      case 'stat_conversao': {
        const pct = Math.min(Math.max(stats?.taxaConversao || 0, 0), 100);
        const circumference = 2 * Math.PI * 24;
        const offset = circumference * (1 - pct / 100);
        return (
          <StatCard
            key="stat_conversao"
            tone="violet"
            className="self-start"
            icon={<Activity className="w-5 h-5" />}
            label="Taxa de Ativos"
            value={`${stats?.taxaConversao || 0}%`}
            extra={
              <div className="flex items-center gap-3">
                <svg width="46" height="46" viewBox="0 0 58 58" className="shrink-0">
                  <circle cx="29" cy="29" r="24" fill="none" stroke="var(--color-bg-subtle)" strokeWidth="7" />
                  <circle
                    cx="29" cy="29" r="24" fill="none"
                    stroke="#8B5CF6" strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    transform="rotate(-90 29 29)"
                  />
                </svg>
                <span className="text-[11px] text-text-subtle leading-snug">associados ativos sobre o total já cadastrado</span>
              </div>
            }
          />
        );
      }

      /* ─── Receitas ─── */
      case 'stat_receitas': {
        const valores = getValoresFinanceiros(stats?.parcelasReceberRaw || [], filtroReceitas, 'receber');
        const pct = Math.min(((valores.realizado || 0) / (valores.projetado || 1)) * 100, 100);
        return (
          <div
            key="stat_receitas"
            className="relative bg-bg-surface rounded-2xl border border-border-default p-5 md:col-span-2 flex flex-col justify-between overflow-hidden group shadow-sm hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300"
          >
            <div className="absolute -right-10 -top-10 w-48 h-48 opacity-[0.08] blur-3xl rounded-full bg-gradient-to-tr from-[#10B981] to-[#3B82F6] group-hover:opacity-20 transition-opacity duration-500" />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#10B981] to-[#0E8F58] text-white shadow-lg shadow-emerald-500/30">
                  <DollarSign className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-text-subtle">Receitas · {period}</span>
              </div>
              <select
                value={filtroReceitas}
                onChange={(e) => setFiltroReceitas(e.target.value)}
                className="text-xs font-bold text-text-muted bg-bg-subtle px-2.5 py-1 rounded-lg border border-border-default focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] cursor-pointer hover:bg-bg-hover transition-colors"
              >
                <option value="todos">Todos</option>
                <option value="mensal">Mês Atual</option>
                <option value="trimestral">Trimestre</option>
                <option value="anual">Ano Atual</option>
              </select>
            </div>
            <div className="relative z-10 flex items-baseline justify-between mt-5">
              <div>
                <p className="font-mono text-xl font-bold tabular-nums text-emerald-400">
                  R$ {(valores.realizado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wide mt-0.5">Arrecadado</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[15px] font-bold tabular-nums text-text-subtle">
                  R$ {(valores.projetado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wide mt-0.5">Projetado</p>
              </div>
            </div>
            <div className="mt-4 relative z-10">
              <div className="w-full bg-bg-hover rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#0E8F58] to-emerald-400 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[11px] text-text-subtle">
                <span>{pct.toFixed(0)}% do projetado</span>
              </div>
            </div>
          </div>
        );
      }

      /* ─── Despesas ─── */
      case 'stat_despesas': {
        const valores = getValoresFinanceiros(stats?.parcelasPagarRaw || [], filtroDespesas, 'pagar');
        const pct = Math.min(((valores.realizado || 0) / (valores.projetado || 1)) * 100, 100);
        return (
          <div
            key="stat_despesas"
            className="relative bg-bg-surface rounded-2xl border border-border-default p-5 md:col-span-2 flex flex-col justify-between overflow-hidden group shadow-sm hover:shadow-lg hover:shadow-rose-500/10 hover:border-rose-500/30 transition-all duration-300"
          >
            <div className="absolute -right-10 -top-10 w-48 h-48 opacity-[0.08] blur-3xl rounded-full bg-gradient-to-tr from-rose-500 to-rose-700 group-hover:opacity-20 transition-opacity duration-500" />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-lg shadow-rose-500/30">
                  <DollarSign className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-text-subtle">Despesas · {period}</span>
              </div>
              <select
                value={filtroDespesas}
                onChange={(e) => setFiltroDespesas(e.target.value)}
                className="text-xs font-bold text-text-muted bg-bg-subtle px-2.5 py-1 rounded-lg border border-border-default focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 cursor-pointer hover:bg-bg-hover transition-colors"
              >
                <option value="todos">Todos</option>
                <option value="mensal">Mês Atual</option>
                <option value="trimestral">Trimestre</option>
                <option value="anual">Ano Atual</option>
              </select>
            </div>
            <div className="relative z-10 flex items-baseline justify-between mt-5">
              <div>
                <p className="font-mono text-xl font-bold tabular-nums text-rose-400">
                  R$ {(valores.realizado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wide mt-0.5">Pago</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[15px] font-bold tabular-nums text-text-subtle">
                  R$ {(valores.projetado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wide mt-0.5">Projetado</p>
              </div>
            </div>
            <div className="mt-4 relative z-10">
              <div className="w-full bg-bg-hover rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-rose-600 to-rose-400 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[11px] text-text-subtle">
                <span>{pct.toFixed(0)}% do projetado</span>
              </div>
            </div>
          </div>
        );
      }

      /* ─── Faturamento ─── */
      case 'stat_faturamento':
        return (
          <StatCard
            key="stat_faturamento"
            tone="emerald"
            className="self-start"
            icon={<DollarSign className="w-5 h-5" />}
            label="Faturamento Mensal Estimado"
            value={`R$ ${(stats?.faturamentoEstimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          />
        );

      /* ─── Vidas por Plano ─── */
      case 'stat_vidas_planos': {
        const planos = stats?.vidasPorPlano || [];
        const max = Math.max(1, ...planos.map(p => p.vidas));
        return (
          <div
            key="stat_vidas_planos"
            className="relative bg-bg-surface rounded-2xl border border-border-default p-5 md:col-span-2 flex flex-col overflow-hidden group shadow-sm hover:shadow-lg hover:shadow-violet-500/10 hover:border-violet-500/30 transition-all duration-300"
          >
            <div className="absolute top-0 right-0 w-64 h-48 bg-violet-500 opacity-[0.04] blur-3xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#D946EF] text-white shadow-lg shadow-purple-500/30">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-base">Vidas por Plano</h3>
                <p className="text-xs text-text-subtle">Titulares + dependentes ativos</p>
              </div>
            </div>
            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar space-y-2.5 max-h-[210px]">
              {planos.length > 0 ? (
                planos.map((vp, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[13px] text-text-muted truncate">{vp.plano}</span>
                      <span className="font-mono text-[13px] font-bold text-text-base tabular-nums shrink-0 ml-2">{vp.vidas}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-bg-hover overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]"
                        style={{ width: `${(vp.vidas / max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-text-subtle text-sm italic py-4">Nenhum dado encontrado.</p>
              )}
            </div>
          </div>
        );
      }

      /* ─── Gráfico Atendimentos ─── */
      case 'chart_atendimentos':
        return (
          <div key="chart_atendimentos" className="relative bg-bg-surface rounded-2xl border border-border-default p-5 md:col-span-2 flex flex-col overflow-hidden shadow-sm">
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartTickStyle} dy={10} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={chartTickStyle} />
                  <Tooltip
                    cursor={{ fill: 'var(--color-bg-hover)', opacity: 0.5 }}
                    contentStyle={chartTooltipStyle}
                    itemStyle={{ color: 'var(--color-text-base)' }}
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
          <div key="chart_recebimentos" className="relative bg-bg-surface rounded-2xl border border-border-default p-5 md:col-span-2 flex flex-col overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-64 h-48 bg-emerald-500 opacity-[0.04] blur-3xl rounded-full pointer-events-none" />
            <div className="mb-5 relative z-10">
              <h3 className="text-base font-bold text-text-base">Recebimentos</h3>
              <p className="text-xs text-text-subtle mt-0.5">Comparativo entre projetado e arrecadado</p>
            </div>
            <div className="flex-1 min-h-[230px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.recebimentosGrafico || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartTickStyle} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={chartTickStyle} tickFormatter={formatCurrencyTick} />
                  <Tooltip
                    cursor={{ fill: 'var(--color-bg-hover)', opacity: 0.5 }}
                    contentStyle={chartTooltipStyle}
                    itemStyle={{ color: 'var(--color-text-base)' }}
                    formatter={(value: any) => [`R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, undefined]}
                  />
                  <Bar dataKey="projetado" name="Projetado" fill="var(--color-text-subtle)" radius={[4, 4, 2, 2]} maxBarSize={28} />
                  <Bar dataKey="recebido" name="Recebido" fill="#10B981" radius={[4, 4, 2, 2]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      /* ─── Saúde Financeira ─── */
      case 'chart_saude_financeira':
        return (
          <div key="chart_saude_financeira" className="relative bg-bg-surface rounded-2xl border border-border-default p-5 md:col-span-2 flex flex-col overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-64 h-48 bg-blue-500 opacity-[0.04] blur-3xl rounded-full pointer-events-none" />
            <div className="mb-5 relative z-10">
              <h3 className="text-base font-bold text-text-base">Saúde Financeira</h3>
              <p className="text-xs text-text-subtle mt-0.5">Comparativo entre receitas e despesas projetadas</p>
            </div>
            <div className="flex-1 min-h-[230px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.financeiroGrafico || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartTickStyle} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={chartTickStyle} tickFormatter={formatCurrencyTick} />
                  <Tooltip
                    cursor={{ fill: 'var(--color-bg-hover)', opacity: 0.5 }}
                    contentStyle={chartTooltipStyle}
                    itemStyle={{ color: 'var(--color-text-base)' }}
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
          <div key="acoes_recentes" className="relative bg-bg-surface rounded-2xl border border-border-default p-5 flex flex-col overflow-hidden shadow-sm">
            <h3 className="text-base font-bold text-text-base mb-4 relative z-10">Ações Recentes</h3>
            <div className="space-y-1 flex-1 relative z-10">
              {(stats?.acoesRecentes || []).length > 0 ? (
                (stats?.acoesRecentes || []).map((item, i) => (
                  <div key={`acao-${i}`} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-bg-subtle transition-colors border border-transparent hover:border-border-default">
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
          <div key="status_sistema" className="relative bg-bg-surface rounded-2xl border border-border-default p-5 flex flex-col overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 p-3 opacity-[0.04] pointer-events-none">
              <ShieldAlert className="w-32 h-32" />
            </div>
            <div className="relative z-10 flex-1 flex flex-col">
              <h3 className="text-base font-bold text-text-base mb-4">Status do Sistema</h3>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 bg-bg-subtle p-3 rounded-xl border border-border-default">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${state.isOnline ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse'}`} />
                  <span className="font-bold text-sm text-text-base">{state.isOnline ? 'Conectado' : 'Modo Offline'}</span>
                </div>
                <div className="flex items-center gap-2.5 bg-bg-subtle p-3 rounded-xl border border-border-default">
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
        );

      /* ─── Associados sem Mensalidade ─── */
      case 'widget_assoc_sem_mensalidade': {
        const assocs = stats?.associadosSemMensalidadesAberto || [];
        if (assocs.length === 0) return null;

        return (
          <div key="widget_assoc_sem_mensalidade" className="relative bg-bg-surface border border-amber-500/40 rounded-2xl p-5 shadow-sm flex flex-col overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/[0.06] to-transparent pointer-events-none" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 relative z-10">
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
              <div className="flex-1">
                <h3 className="text-text-base font-bold text-base tracking-tight">Associados sem Mensalidade</h3>
                <p className="text-text-subtle text-xs mt-0.5">Titulares ativos sem nenhuma parcela pendente registrada.</p>
              </div>
              <span className="text-xs font-extrabold text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-full shrink-0">
                {assocs.length} {assocs.length === 1 ? 'associado' : 'associados'}
              </span>
            </div>

            {isAssocExpanded && (
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                {assocs.map((assoc, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-bg-subtle border border-transparent hover:border-amber-500/30 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#60A5FA] to-[#8B5CF6] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {assoc.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-text-base truncate">{assoc.nome}</p>
                      <p className="text-[11px] text-text-muted truncate">
                        {assoc.telefone || assoc.celular_whatsapp || 'Sem telefone'} · desde{' '}
                        {assoc.data_adesao ? new Date(assoc.data_adesao + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                      </p>
                    </div>
                    <Link
                      to="/associados"
                      state={{ search: assoc.nome }}
                      className="text-amber-500 hover:text-amber-400 font-bold text-[11px] flex items-center gap-1 shrink-0"
                    >
                      Ver <ArrowRight className="w-3 h-3" />
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
  };

  const visible = layout.filter(w => w.visible);
  const atalhos = visible.find(w => w.id === 'atalhos_rapidos');
  const overview = visible.filter(w => OVERVIEW_IDS.includes(w.id));
  const analises = visible.filter(w => ANALISES_IDS.includes(w.id));
  const operacao = visible.filter(w => OPERACAO_IDS.includes(w.id));
  const alerta = visible.find(w => w.id === 'widget_assoc_sem_mensalidade');
  const alertaContent = alerta ? renderWidget(alerta) : null;

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1.5 h-9 rounded-full bg-gradient-to-b from-[#3B82F6] to-[#60A5FA] shadow-[0_0_14px_rgba(59,130,246,0.5)]" />
            <h2 className="text-3xl font-extrabold tracking-tight text-text-base">
              Dashboard
            </h2>
          </div>
          <p className="text-text-subtle mt-1 text-sm pl-4.5">
            Visão geral do sistema e indicadores de performance em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center bg-bg-subtle border border-border-subtle rounded-xl p-1 shadow-sm">
            {(['mensal', 'trimestral', 'anual'] as DashboardPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 capitalize ${
                  period === p
                    ? 'bg-bg-surface text-text-base shadow-sm'
                    : 'text-text-subtle hover:text-text-base'
                }`}
              >
                {p === 'mensal' ? 'Mensal' : p === 'trimestral' ? 'Trimestral' : 'Anual'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 h-[38px] w-[38px] flex items-center justify-center bg-bg-subtle border border-border-subtle text-text-subtle hover:text-[#3B82F6] hover:border-[#3B82F6]/40 hover:rotate-[28deg] rounded-xl shadow-sm transition-all duration-200"
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

      {loading ? (
        <div className="space-y-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SkeletonWidget variant="kpi" className="h-24" />
            <SkeletonWidget variant="kpi" className="h-24" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <SkeletonWidget variant="kpi-lg" className="md:col-span-2 lg:row-span-2" />
            <SkeletonWidget variant="kpi" />
            <SkeletonWidget variant="kpi" />
            <SkeletonWidget variant="progress" className="md:col-span-2" />
            <SkeletonWidget variant="progress" className="md:col-span-2" />
            <SkeletonWidget variant="kpi" />
            <SkeletonWidget variant="list" className="md:col-span-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SkeletonWidget variant="chart" />
            <SkeletonWidget variant="chart" />
          </div>
        </div>
      ) : (
        <>
          {/* ── Atalhos rápidos ── */}
          {atalhos && renderWidget(atalhos)}

          {/* ── Visão geral ── */}
          {overview.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 grid-flow-row-dense">
              {overview.map(renderWidget)}
            </div>
          )}

          {/* ── Análises ── */}
          {analises.length > 0 && (
            <div className="space-y-4">
              <SectionLabel>Análises · últimos meses</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {analises.map(renderWidget)}
              </div>
            </div>
          )}

          {/* ── Operação ── */}
          {operacao.length > 0 && (
            <div className="space-y-4">
              <SectionLabel>Operação</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {operacao.map(renderWidget)}
              </div>
            </div>
          )}

          {/* ── Alerta: associados sem mensalidade ── */}
          {alertaContent}
        </>
      )}
    </div>
  );
};
