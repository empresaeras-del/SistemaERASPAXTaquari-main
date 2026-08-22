import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, DollarSign, Activity, TrendingUp, ShieldAlert, Settings2, Heart, Zap, UserPlus, Stethoscope, ArrowRight } from 'lucide-react';
import { DashboardSettingsModal, WidgetConfig, defaultWidgets } from '../components/DashboardSettingsModal';
import { useAppContext } from '../context/AppContext';
import { getDashboardStats, DashboardStats, DashboardPeriod } from '../services/dashboardService';
import { get, set } from '../lib/idb-safe';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { RefreshCw, CheckCircle2, WifiOff } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertasFinanceiros } from '../components/AlertasFinanceiros';
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3B82F6]"></div>
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
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-text-base">Dashboard</h2>
          <p className="text-text-subtle mt-2 text-base">Visão geral do sistema e indicadores de performance em tempo real.</p>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center bg-bg-subtle border border-border-default rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setPeriod('mensal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${period === 'mensal' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-text-subtle hover:text-text-base'}`}
            >
              Mensal
            </button>
            <button
              onClick={() => setPeriod('trimestral')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${period === 'trimestral' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-text-subtle hover:text-text-base'}`}
            >
              Trimestral
            </button>
            <button
              onClick={() => setPeriod('anual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${period === 'anual' ? 'bg-[#3B82F6] text-white shadow-sm' : 'text-text-subtle hover:text-text-base'}`}
            >
              Anual
            </button>
          </div>

          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 h-[42px] w-[42px] flex items-center justify-center bg-bg-subtle border border-border-default text-text-subtle hover:text-text-base rounded-xl shadow-sm transition-colors"
            title="Personalizar Dashboard"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <AlertasFinanceiros />

      <DashboardSettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        layout={layout}
        onSave={handleSaveLayout}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 grid-flow-row-dense">
        {layout.filter(w => w.visible).map((widget) => {
          switch (widget.id) {
            case 'atalhos_rapidos':
              return (
                <div key="atalhos_rapidos" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 lg:col-span-4 flex flex-col justify-center gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-[0.03] blur-3xl rounded-full" />
                  <div className="flex items-center gap-2 mb-2 relative z-10">
                    <Zap className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-lg font-bold text-text-base">Atalhos Rápidos</h3>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                    <Link
                      to="/associados"
                      state={{ openNew: true }}
                      className="flex-1 flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <UserPlus className="w-6 h-6" />
                      Novo Associado
                    </Link>
                    <Link
                      to="/atendimentos"
                      state={{ openNew: true }}
                      className="flex-1 flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Stethoscope className="w-6 h-6" />
                      Novo Atendimento
                    </Link>
                  </div>
                </div>
              );

            case 'stat_associados':
              return (
                <div key="stat_associados" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 flex flex-col justify-between hover:border-[#3B82F6]/50 transition-colors relative overflow-hidden group col-span-1">
                  <div className="absolute -right-8 -top-8 w-32 h-32 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#60A5FA] group-hover:opacity-40 transition-opacity" />
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#3B82F6] to-[#60A5FA] text-white shadow-lg">
                      <Users className="w-6 h-6" />
                    </div>
                    <span className="flex items-center text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20" title="Novos no período">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      +{stats?.novosAssociados || 0}
                    </span>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-3xl font-bold text-text-base tracking-tight">{stats?.associadosAtivos || 0}</h3>
                    <p className="text-sm font-medium text-text-subtle mt-1">Associados Ativos</p>
                    <p className="text-[11px] font-medium text-text-muted mt-0.5 opacity-80" title="Total de dependentes ativos">
                      + {stats?.totalDependentes || 0} dependentes
                    </p>
                  </div>
                </div>
              );
            case 'stat_atendimentos':
              return (
                <div key="stat_atendimentos" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 flex flex-col justify-between hover:border-[#3B82F6]/50 transition-colors relative overflow-hidden group col-span-1">
                  <div className="absolute -right-8 -top-8 w-32 h-32 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-[#F43F5E] to-[#F97316] group-hover:opacity-40 transition-opacity" />
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#F43F5E] to-[#F97316] text-white shadow-lg">
                      <FileText className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-3xl font-bold text-text-base tracking-tight">{stats?.atendimentosPeriodo || 0}</h3>
                    <p className="text-sm font-medium text-text-subtle mt-1">Atendimentos ({period === 'anual' ? 'Anual' : period === 'trimestral' ? 'Trimestral' : 'Mensal'})</p>
                  </div>
                </div>
              );
            case 'stat_receitas': {
              const valores = getValoresFinanceiros(stats?.parcelasReceberRaw || [], filtroReceitas, 'receber');
              return (
                <div key="stat_receitas" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 flex flex-col justify-between hover:border-[#3B82F6]/50 transition-colors relative overflow-hidden group col-span-1 lg:col-span-2">
                  <div className="absolute -right-8 -top-8 w-32 h-32 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#3B82F6] group-hover:opacity-40 transition-opacity" />
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#3B82F6] to-[#3B82F6] text-white shadow-lg">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-text-base">Receitas</h3>
                    </div>
                    <select 
                      value={filtroReceitas}
                      onChange={(e) => setFiltroReceitas(e.target.value)}
                      className="text-xs font-bold text-text-muted bg-bg-surface px-2.5 py-1 rounded-full border border-border-default focus:outline-none cursor-pointer hover:bg-bg-hover"
                    >
                      <option value="todos">Todos os registros</option>
                      <option value="mensal">Mês Atual</option>
                      <option value="trimestral">Trimestre Atual</option>
                      <option value="anual">Ano Atual</option>
                    </select>
                  </div>
                  <div className="relative z-10 grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-sm font-medium text-text-subtle mb-1">Projetado</p>
                      <h3 className="text-2xl font-bold text-text-base tracking-tight">R$ {(valores.projetado || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-subtle mb-1">Arrecadado</p>
                      <h3 className="text-2xl font-bold text-emerald-400 tracking-tight">R$ {(valores.realizado || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                    </div>
                  </div>
                  <div className="w-full bg-bg-hover rounded-full h-1.5 mt-4 overflow-hidden">
                    <div 
                      className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(((valores.realizado || 0) / (valores.projetado || 1)) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              );
            }
            case 'stat_faturamento':
              return (
                <div key="stat_faturamento" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 flex flex-col justify-between hover:border-[#3B82F6]/50 transition-colors relative overflow-hidden group col-span-1">
                  <div className="absolute -right-8 -top-8 w-32 h-32 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-[#10B981] to-[#3B82F6] group-hover:opacity-40 transition-opacity" />
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#10B981] to-[#3B82F6] text-white shadow-lg">
                      <DollarSign className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-3xl font-bold text-text-base tracking-tight">R$ {(stats?.faturamentoEstimado || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                    <p className="text-sm font-medium text-text-subtle mt-1">Faturamento Mensal Estimado</p>
                  </div>
                </div>
              );
            case 'stat_despesas': {
              const valores = getValoresFinanceiros(stats?.parcelasPagarRaw || [], filtroDespesas, 'pagar');
              return (
                <div key="stat_despesas" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 flex flex-col justify-between hover:border-rose-500/50 transition-colors relative overflow-hidden group col-span-1 lg:col-span-2">
                  <div className="absolute -right-8 -top-8 w-32 h-32 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-rose-500 to-rose-600 group-hover:opacity-40 transition-opacity" />
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-gradient-to-tr from-rose-500 to-rose-600 text-white shadow-lg">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-text-base">Despesas</h3>
                    </div>
                    <select 
                      value={filtroDespesas}
                      onChange={(e) => setFiltroDespesas(e.target.value)}
                      className="text-xs font-bold text-text-muted bg-bg-surface px-2.5 py-1 rounded-full border border-border-default focus:outline-none cursor-pointer hover:bg-bg-hover"
                    >
                      <option value="todos">Todos os registros</option>
                      <option value="mensal">Mês Atual</option>
                      <option value="trimestral">Trimestre Atual</option>
                      <option value="anual">Ano Atual</option>
                    </select>
                  </div>
                  <div className="relative z-10 grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-sm font-medium text-text-subtle mb-1">Projetado</p>
                      <h3 className="text-2xl font-bold text-text-base tracking-tight">R$ {(valores.projetado || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-subtle mb-1">Pago</p>
                      <h3 className="text-2xl font-bold text-rose-400 tracking-tight">R$ {(valores.realizado || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                    </div>
                  </div>
                  <div className="w-full bg-bg-hover rounded-full h-1.5 mt-4 overflow-hidden">
                    <div 
                      className="bg-rose-500 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(((valores.realizado || 0) / (valores.projetado || 1)) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              );
            }
            case 'stat_conversao':
              return (
                <div key="stat_conversao" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 flex flex-col justify-between hover:border-[#3B82F6]/50 transition-colors relative overflow-hidden group col-span-1">
                  <div className="absolute -right-8 -top-8 w-32 h-32 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-[#8B5CF6] to-[#D946EF] group-hover:opacity-40 transition-opacity" />
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] to-[#D946EF] text-white shadow-lg">
                      <Activity className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-3xl font-bold text-text-base tracking-tight">{stats?.taxaConversao || 0}%</h3>
                    <p className="text-sm font-medium text-text-subtle mt-1">Taxa de Ativos</p>
                  </div>
                </div>
              );

            case 'stat_vidas_planos':
              return (
                <div key="stat_vidas_planos" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 lg:col-span-2 flex flex-col hover:border-[#3B82F6]/50 transition-colors relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-[0.03] blur-3xl rounded-full" />
                  <div className="flex items-start justify-between mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-500 text-white shadow-lg">
                        <Heart className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-text-base tracking-tight">Vidas por Plano</h3>
                        <p className="text-sm font-medium text-text-subtle">Total de vidas ativas (Titulares + Dependentes)</p>
                      </div>
                    </div>
                  </div>
                  <div className="relative z-10 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                    {stats?.vidasPorPlano && stats.vidasPorPlano.length > 0 ? (
                      stats.vidasPorPlano.map((vp, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-bg-surface/50 border border-border-default">
                          <span className="font-medium text-text-muted">{vp.plano}</span>
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">{vp.vidas} {vp.vidas === 1 ? 'vida' : 'vidas'}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-text-subtle text-sm italic py-4">Nenhum dado encontrado.</p>
                    )}
                  </div>
                </div>
              );
            case 'chart_atendimentos':
              return (
                <div key="chart_atendimentos" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 lg:col-span-2 flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#3B82F6] opacity-[0.03] blur-3xl rounded-full" />
                  <div className="mb-6 relative z-10">
                    <h3 className="text-lg font-bold text-text-base">Atendimentos Mensais</h3>
                    <p className="text-sm text-text-subtle">Volume de serviços funerários realizados</p>
                  </div>
                  <div className="flex-1 min-h-[250px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.atendimentosGrafico || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#60A5FA" stopOpacity={1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8B95A5', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#8B95A5', fontSize: 12 }} />
                        <Tooltip 
                          cursor={{ fill: '#475569', opacity: 0.3 }}
                          contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: '1px solid #475569', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value: any) => [`${value} atendimento(s)`, 'Total']}
                        />
                        <Bar dataKey="total" radius={[8, 8, 8, 8]} maxBarSize={40}>
                          {
                            (stats?.atendimentosGrafico || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill="url(#colorUv)" />
                            ))
                          }
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            case 'chart_recebimentos':
              return (
                <div key="chart_recebimentos" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 lg:col-span-2 flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-[0.03] blur-3xl rounded-full" />
                  <div className="mb-6 relative z-10">
                    <h3 className="text-lg font-bold text-text-base">Recebimentos Pendentes (KPI)</h3>
                    <p className="text-sm text-text-subtle">Comparativo entre projetado e arrecadado</p>
                  </div>
                  <div className="flex-1 min-h-[250px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.recebimentosGrafico || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8B95A5', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8B95A5', fontSize: 12 }} tickFormatter={formatCurrencyTick} />
                        <Tooltip 
                          cursor={{ fill: '#475569', opacity: 0.3 }}
                          contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: '1px solid #475569', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value: any) => [`R$ ${Number(value || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, undefined]}
                        />
                        <Bar dataKey="projetado" name="Projetado" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        <Bar dataKey="recebido" name="Recebido" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            case 'chart_saude_financeira':
              return (
                <div key="chart_saude_financeira" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 lg:col-span-2 flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 opacity-[0.03] blur-3xl rounded-full" />
                  <div className="mb-6 relative z-10">
                    <h3 className="text-lg font-bold text-text-base">Saúde Financeira</h3>
                    <p className="text-sm text-text-subtle">Comparativo entre receitas e despesas projetadas</p>
                  </div>
                  <div className="flex-1 min-h-[250px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.financeiroGrafico || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8B95A5', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8B95A5', fontSize: 12 }} tickFormatter={formatCurrencyTick} />
                        <Tooltip 
                          cursor={{ fill: '#475569', opacity: 0.3 }}
                          contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: '1px solid #475569', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value: any, name: any) => [`R$ ${Number(value || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, String(name || '').charAt(0).toUpperCase() + String(name || '').slice(1)]}
                        />
                        <Bar dataKey="receitas" name="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        <Bar dataKey="despesas" name="Despesas" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        <Bar dataKey="saldo" name="Saldo" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            case 'acoes_recentes':
              return (
                <div key="acoes_recentes" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 lg:col-span-1 flex flex-col relative overflow-hidden">
                  <div className="mb-6 flex items-center justify-between relative z-10">
                    <h3 className="text-lg font-bold text-text-base">Ações Recentes</h3>
                  </div>
                  <div className="space-y-4 flex-1 relative z-10">
                    {(stats?.acoesRecentes || []).length > 0 ? (stats?.acoesRecentes || []).map((item, i) => (
                      <div key={`acao-${i}`} className="flex items-start gap-4 p-3 rounded-2xl hover:bg-bg-hover transition-colors border border-transparent hover:border-[#64748B]">
                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.color} shadow-[0_0_8px_currentColor]`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-text-base truncate">{item.title}</p>
                          <p className="text-xs text-text-subtle truncate">{item.desc}</p>
                        </div>
                        <span className="text-xs font-medium text-text-subtle whitespace-nowrap">{item.time}</span>
                      </div>
                    )) : (
                      <div className="flex items-center justify-center h-full text-text-subtle text-sm">
                        Nenhuma ação recente registrada.
                      </div>
                    )}
                  </div>
                </div>
              );
            case 'status_sistema':
              return (
                <div key="status_sistema" className="bg-gradient-to-br from-[#1E2341] to-[#121426] rounded-3xl shadow-lg border border-[#64748B] p-6 lg:col-span-1 text-white relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <ShieldAlert className="w-40 h-40" />
                  </div>
                  <div className="relative z-10 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                      <ShieldAlert className="w-6 h-6 text-emerald-400" />
                      <h3 className="text-lg font-bold text-text-base">Status do Sistema</h3>
                    </div>
                    
                    <div className="mt-auto space-y-5">
                      <div className="bg-bg-surface/50 p-4 rounded-2xl border border-[#64748B]/50">
                        <p className="text-text-subtle text-xs font-semibold uppercase tracking-wider mb-2">Conexão Backend</p>
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${state.isOnline ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]' : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)] animate-pulse'}`} />
                          <span className="font-bold text-text-base">{state.isOnline ? 'Supabase Conectado' : 'Modo Offline (IDB)'}</span>
                        </div>
                      </div>
                      
                      <div className="bg-bg-surface/50 p-4 rounded-2xl border border-[#64748B]/50">
                        <p className="text-text-subtle text-xs font-semibold uppercase tracking-wider mb-2">Sincronização</p>
                        <div className="flex items-center gap-3">
                          {state.isOnline ? (
                            pendingCount > 0 ? (
                              <>
                                <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)] animate-pulse" />
                                <span className="font-bold text-amber-400 flex items-center gap-2">
                                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                  Sincronizando ({pendingCount})
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.6)]" />
                                <span className="font-bold text-blue-400 flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4" />
                                  Sincronizado
                                </span>
                              </>
                            )
                          ) : (
                            <>
                              <div className="w-3 h-3 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.6)] animate-pulse" />
                              <span className="font-bold text-rose-400 flex items-center gap-2">
                                <WifiOff className="w-4 h-4" />
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
            case 'widget_assoc_sem_mensalidade': {
              const assocs = stats?.associadosSemMensalidadesAberto || [];
              if (assocs.length === 0) return null;
              
              return (
                <div key="widget_assoc_sem_mensalidade" className="bg-bg-surface border-l-4 border-l-amber-500 border-y border-r border-border-default rounded-2xl p-4 shadow-sm lg:col-span-4 flex flex-col relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500 opacity-[0.02] blur-2xl rounded-full" />
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div 
                        className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95"
                        onClick={() => setIsAssocExpanded(!isAssocExpanded)}
                        title={isAssocExpanded ? "Ocultar itens" : "Expandir itens"}
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
                            {assoc.telefone || assoc.celular_whatsapp || 'Sem telefone'} • Adesão: {assoc.data_adesao ? new Date(assoc.data_adesao + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}
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
