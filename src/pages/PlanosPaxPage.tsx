import React, { useState, useMemo } from 'react';
import { usePlanosPax } from '../hooks/usePlanosPax';
import { usePlanosAnalytics } from '../hooks/usePlanosAnalytics';
import { PlanoPaxForm } from '../components/planos-pax/PlanoPaxForm';
import { PlanoPaxCompleto } from '../types/planosPax';
import { canDelete } from '../utils/permissions';
import { useAppContext } from '../context/AppContext';
import {
  Plus, Search, Power, PowerOff, ShieldCheck, ShieldAlert,
  Trash2, User, Users, CircleDollarSign, Check, Clock, MapPin,
  LayoutGrid, List, TrendingUp, BarChart2, DollarSign, Activity,
  ChevronDown, ChevronUp, PieChart, Award, Zap, RefreshCw,
  AlertTriangle, FileCheck, TrendingDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirm } from '../context/ConfirmContext';
import { systemAlert } from '../utils/systemAlert';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts';

// ─── Formatação ───────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtN = (v: number) => v.toLocaleString('pt-BR');

// ─── Tooltip customizado ──────────────────────────────────────────────────────
const CustomTooltipBar = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-3 shadow-xl text-xs z-50">
      <p className="font-bold text-text-base mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mt-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.fill || p.color }} />
          <span className="text-text-subtle">{p.name}:</span>
          <span className="font-semibold" style={{ color: p.fill || p.color }}>
            {p.value > 100 ? fmtBRL(p.value) : fmtN(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const CustomTooltipPie = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-3 shadow-xl text-xs">
      <p className="font-bold text-text-base">{d.name}</p>
      <p style={{ color: d.payload.fill }} className="font-semibold mt-0.5">
        {d.value} plano(s) — {d.payload.pct}
      </p>
      {d.payload.contratos !== undefined && (
        <p className="text-text-subtle mt-0.5">Contratos ativos: {d.payload.contratos}</p>
      )}
      {d.payload.receita !== undefined && (
        <p className="text-text-subtle mt-0.5">Receita efetiva: {fmtBRL(d.payload.receita)}</p>
      )}
    </div>
  );
};

// ─── Mini progress bar ────────────────────────────────────────────────────────
const MiniBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-bg-base/60 rounded-full h-1.5 mt-1.5">
      <div
        className="h-1.5 rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
};

// ─── PlanoCard ────────────────────────────────────────────────────────────────
const PlanoCard = ({
  plano, handleOpenForm, handleToggleStatus, handleDelete, metrica
}: {
  plano: PlanoPaxCompleto;
  handleOpenForm: any;
  handleToggleStatus: any;
  handleDelete: any;
  metrica?: any;
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div
      onClick={() => handleOpenForm(plano)}
      onMouseMove={(e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="bg-bg-surface border border-border-default rounded-2xl p-5 hover:border-transparent transition-all cursor-pointer relative group flex flex-col h-full overflow-hidden shadow-sm"
    >
      {/* Glow Effect */}
      <div
        className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: isHovering
            ? `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59,130,246,0.15), transparent 40%)`
            : 'none',
        }}
      />
      <div
        className="absolute inset-0 z-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none p-[1px]"
        style={{
          background: isHovering
            ? `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59,130,246,0.5), rgba(139,92,246,0.5), transparent 40%)`
            : 'none',
        }}
      >
        <div className="absolute inset-[1px] bg-bg-surface rounded-2xl z-0" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <div className={`absolute top-[-20px] right-[-20px] px-3 py-1 text-xs font-semibold rounded-bl-lg ${plano.ativo ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
          {plano.ativo ? 'ATIVO' : 'INATIVO'}
        </div>

        <div className="mb-4 pt-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#3B82F6]/10 text-[#3B82F6] uppercase tracking-wider mb-2 inline-block">
            {plano.codigo}
          </span>
          <h3 className="font-bold text-xl text-text-base line-clamp-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-[#3B82F6] group-hover:to-purple-400 transition-all">
            {plano.nome}
          </h3>
          <p className="text-sm text-text-subtle mt-1 flex items-center gap-1.5">
            {plano.tipo_plano === 'individual' ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
            <span className="capitalize">
              {plano.tipo_plano === 'individual' ? 'Individual' : `Coletivo (${plano.limite_vidas} vidas)`}
            </span>
          </p>
        </div>

        <div className="flex-1 space-y-4">
          {/* Mensalidade */}
          <div className="bg-bg-base/50 p-3 rounded-xl border border-border-default/50 group-hover:border-[#3B82F6]/20 transition-colors">
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="text-text-subtle flex items-center gap-1.5 font-medium">
                <CircleDollarSign className="w-4 h-4 text-emerald-500" />
                Mensalidade
              </span>
              <span className="font-bold text-emerald-500 text-right">
                {plano.regra_calculo === 'faixa_etaria'
                  ? 'Por Idade'
                  : fmtBRL(plano.valor_mensalidade || 0)}
              </span>
            </div>
            {plano.regra_calculo === 'por_vida' && (
              <div className="text-right text-[10px] text-text-subtle font-medium">Valor cobrado por vida</div>
            )}
          </div>

          {/* Contratos ativos reais */}
          {metrica && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-2 text-center">
                <p className="text-[9px] text-text-subtle uppercase tracking-wider font-semibold mb-0.5">Contratos Ativos</p>
                <p className="text-base font-extrabold text-emerald-400">{metrica.contratos_ativos}</p>
              </div>
              <div className={`border rounded-lg p-2 text-center ${metrica.contratos_inadimplentes > 0 ? 'bg-rose-500/5 border-rose-500/15' : 'bg-bg-base/30 border-border-default/50'}`}>
                <p className="text-[9px] text-text-subtle uppercase tracking-wider font-semibold mb-0.5">Inadimplentes</p>
                <p className={`text-base font-extrabold ${metrica.contratos_inadimplentes > 0 ? 'text-rose-400' : 'text-text-subtle'}`}>
                  {metrica.contratos_inadimplentes}
                </p>
              </div>
            </div>
          )}

          {/* Coberturas */}
          <div>
            <div className="text-[11px] font-bold text-text-subtle uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#3B82F6]" />
              Principais Coberturas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'coberto').slice(0, 3).map((c: any, i: number) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 text-[10px] font-medium whitespace-nowrap">
                  <Check className="w-3 h-3" />
                  {c.item?.nome || 'Item'}
                </span>
              ))}
              {(plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'coberto').length || 0) > 3 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-bg-base text-text-subtle border border-border-default text-[10px] font-medium">
                  +{(plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'coberto').length || 0) - 3} itens
                </span>
              )}
              {(plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'coberto').length || 0) === 0 && (
                <span className="text-[11px] text-text-muted italic">Nenhum item coberto</span>
              )}
            </div>
          </div>

          {(plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'excluido').length || 0) > 0 && (
            <div>
              <div className="text-[11px] font-bold text-text-subtle uppercase tracking-wider mb-2 flex items-center gap-1.5 mt-1">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                Não Cobertos
              </div>
              <div className="flex flex-wrap gap-1.5">
                {plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'excluido').slice(0, 2).map((c: any, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-medium line-through decoration-red-500/50 whitespace-nowrap">
                    {c.item?.nome || 'Item'}
                  </span>
                ))}
                {(plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'excluido').length || 0) > 2 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-bg-base text-text-subtle border border-border-default text-[10px] font-medium">
                    +{(plano.coberturas?.filter((c: any) => c.tipo_cobertura === 'excluido').length || 0) - 2} itens
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <div className="flex-1 bg-bg-base/50 rounded-lg p-2.5 border border-border-default/50 flex flex-col justify-center items-center text-center">
              <span className="text-[10px] text-text-subtle uppercase tracking-wider mb-1 flex items-center gap-1 font-semibold">
                <Clock className="w-3.5 h-3.5" />
                Carência
              </span>
              <span className="text-sm font-bold text-text-base">{plano.carencia_geral_dias || 0} dias</span>
            </div>
            <div className="flex-1 bg-bg-base/50 rounded-lg p-2.5 border border-border-default/50 flex flex-col justify-center items-center text-center">
              <span className="text-[10px] text-text-subtle uppercase tracking-wider mb-1 flex items-center gap-1 font-semibold">
                <MapPin className="w-3.5 h-3.5" />
                Translado
              </span>
              <span className="text-sm font-bold text-text-base">
                {plano.km_translado_coberto ? `${plano.km_translado_coberto} km` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-border-default flex justify-end gap-2 relative z-20" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleToggleStatus(plano)}
            className={`p-2 rounded-lg transition-colors ${plano.ativo ? 'text-text-subtle hover:text-red-500 hover:bg-red-500/10' : 'text-text-subtle hover:text-emerald-500 hover:bg-emerald-500/10'}`}
            title={plano.ativo ? 'Desativar' : 'Ativar'}
          >
            {plano.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleDelete(plano)}
            className="p-2 text-text-subtle hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Seção Analytics com dados reais ─────────────────────────────────────────
const AnalyticsSection = ({
  planos, analytics
}: {
  planos: PlanoPaxCompleto[];
  analytics: ReturnType<typeof usePlanosAnalytics>;
}) => {
  const [expanded, setExpanded] = useState(true);
  const { metricas, totais, loading: analyticsLoading, recarregar } = analytics;

  const planosAtivos = planos.filter(p => p.ativo);

  // ── Dados derivados para gráficos ─────────────────────────────────────────
  const chartData = useMemo(() => {
    // Bar chart — top 6 por receita efetiva real (contratos_ativos × mensalidade)
    const barData = planosAtivos
      .map(p => {
        const m = metricas[p.id];
        return {
          nome: p.nome.length > 14 ? p.nome.slice(0, 14) + '…' : p.nome,
          nomeCompleto: p.nome,
          receita_efetiva: m?.receita_mensal_efetiva ?? 0,
          receita_recebida: m?.receita_recebida_mes ?? 0,
          contratos: m?.contratos_ativos ?? 0,
          tipo: p.tipo_plano,
        };
      })
      .filter(d => d.contratos > 0 || d.receita_efetiva > 0)
      .sort((a, b) => b.receita_efetiva - a.receita_efetiva)
      .slice(0, 6);

    // Pie chart — distribuição por tipo (com contagem de contratos)
    const indiv = planosAtivos.filter(p => p.tipo_plano === 'individual');
    const colet = planosAtivos.filter(p => p.tipo_plano === 'coletivo');

    const ctAtivosInd = indiv.reduce((s, p) => s + (metricas[p.id]?.contratos_ativos ?? 0), 0);
    const ctAtivosCol = colet.reduce((s, p) => s + (metricas[p.id]?.contratos_ativos ?? 0), 0);
    const recInd = indiv.reduce((s, p) => s + (metricas[p.id]?.receita_mensal_efetiva ?? 0), 0);
    const recCol = colet.reduce((s, p) => s + (metricas[p.id]?.receita_mensal_efetiva ?? 0), 0);

    const pieData = [
      { name: 'Individual', value: indiv.length, fill: '#3B82F6', contratos: ctAtivosInd, receita: recInd, pct: fmtPct(planosAtivos.length > 0 ? (indiv.length / planosAtivos.length) * 100 : 0) },
      { name: 'Coletivo', value: colet.length, fill: '#8B5CF6', contratos: ctAtivosCol, receita: recCol, pct: fmtPct(planosAtivos.length > 0 ? (colet.length / planosAtivos.length) * 100 : 0) },
    ].filter(d => d.value > 0);

    // Ranking por receita real
    const ranking = planosAtivos
      .map(p => ({
        plano: p,
        m: metricas[p.id] || null,
        receita: metricas[p.id]?.receita_mensal_efetiva ?? 0,
      }))
      .sort((a, b) => b.receita - a.receita);

    const maxReceita = Math.max(...ranking.map(r => r.receita), 1);

    return { barData, pieData, ranking, maxReceita };
  }, [planosAtivos, metricas]);

  // KPI Cards com dados reais
  const kpiCards = [
    {
      label: 'Receita Mensal Efetiva',
      tooltip: 'Contratos ativos × mensalidade de cada plano',
      value: fmtBRL(totais.receita_mensal_efetiva),
      sub: `${totais.contratos_ativos} contrato(s) ativo(s)`,
      icon: <DollarSign className="w-5 h-5" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      badge: totais.receita_mensal_efetiva > 0 ? '+' + fmtBRL(totais.receita_mensal_efetiva) : 'R$ 0,00',
      badgeColor: 'text-emerald-400',
    },
    {
      label: 'Ticket Médio Real',
      tooltip: 'Média ponderada dos valores dos contratos ativos',
      value: fmtBRL(totais.ticket_medio_real),
      sub: `Sobre ${totais.contratos_ativos} contrato(s) ativo(s)`,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-[#3B82F6]',
      bg: 'bg-[#3B82F6]/10',
      border: 'border-[#3B82F6]/20',
      badge: fmtBRL(totais.ticket_medio_real) + '/mês',
      badgeColor: 'text-[#3B82F6]',
    },
    {
      label: 'Recebido no Mês',
      tooltip: 'Parcelas efetivamente recebidas no mês corrente',
      value: fmtBRL(totais.receita_recebida_mes),
      sub: `Proj. ${fmtBRL(totais.receita_projetada_mes)} · ${totais.receita_projetada_mes > 0 ? fmtPct((totais.receita_recebida_mes / totais.receita_projetada_mes) * 100) : '—'} cobrado`,
      icon: <FileCheck className="w-5 h-5" />,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      badge: totais.receita_projetada_mes > 0 ? fmtPct((totais.receita_recebida_mes / totais.receita_projetada_mes) * 100) + ' de atingimento' : 'Sem parcelas',
      badgeColor: totais.receita_recebida_mes >= totais.receita_projetada_mes * 0.8 ? 'text-emerald-400' : 'text-amber-400',
    },
    {
      label: 'Taxa de Inadimplência',
      tooltip: 'Percentual de contratos inadimplentes sobre o total',
      value: fmtPct(totais.taxa_inadimplencia),
      sub: `${totais.contratos_inadimplentes} inadimpl. de ${totais.contratos_total} total`,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: totais.taxa_inadimplencia > 10 ? 'text-rose-400' : totais.taxa_inadimplencia > 5 ? 'text-amber-400' : 'text-emerald-400',
      bg: totais.taxa_inadimplencia > 10 ? 'bg-rose-500/10' : totais.taxa_inadimplencia > 5 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
      border: totais.taxa_inadimplencia > 10 ? 'border-rose-500/20' : totais.taxa_inadimplencia > 5 ? 'border-amber-500/20' : 'border-emerald-500/20',
      badge: totais.taxa_inadimplencia <= 5 ? 'Baixa ✓' : totais.taxa_inadimplencia <= 10 ? 'Moderada' : 'Alta ⚠',
      badgeColor: totais.taxa_inadimplencia <= 5 ? 'text-emerald-400' : totais.taxa_inadimplencia <= 10 ? 'text-amber-400' : 'text-rose-400',
    },
  ];

  if (planos.length === 0) return null;

  return (
    <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm">
      {/* Header colapsável */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-border-default bg-bg-surface/60 hover:bg-bg-surface transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#3B82F6]/10 text-[#3B82F6] rounded-xl border border-[#3B82F6]/20">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-bold text-text-base">Painel de Indicadores Financeiros</h2>
            <p className="text-[11px] text-text-subtle">
              Análise real de desempenho · Baseado em contratos e parcelas do banco de dados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analyticsLoading && (
            <RefreshCw className="w-3.5 h-3.5 text-text-subtle animate-spin" />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); recarregar(); }}
            className="p-1.5 text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors"
            title="Recarregar indicadores"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[11px] font-semibold">
            <Activity className="w-3 h-3" />
            {totais.contratos_ativos} contrato(s)
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-text-subtle" /> : <ChevronDown className="w-4 h-4 text-text-subtle" />}
        </div>
      </button>

      {expanded && (
        <div className="p-5 space-y-6">

          {/* ── KPI Cards com dados reais ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {kpiCards.map((kpi, i) => (
              <div key={i} className="bg-bg-surface rounded-2xl p-4 border border-border-default shadow-sm flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider leading-tight pr-1">{kpi.label}</p>
                  <div className={`p-2 ${kpi.bg} ${kpi.color} rounded-xl border ${kpi.border} shrink-0`}>
                    {kpi.icon}
                  </div>
                </div>
                <p className={`text-xl font-extrabold ${kpi.color} leading-tight`}>
                  {analyticsLoading ? (
                    <span className="inline-block w-24 h-5 bg-bg-base/50 rounded animate-pulse" />
                  ) : kpi.value}
                </p>
                <div>
                  <p className="text-[10px] text-text-subtle leading-snug">{kpi.sub}</p>
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${kpi.bg} ${kpi.badgeColor} ${kpi.border}`}>
                    {kpi.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Resumo global ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Vidas Cobertas', value: fmtN(totais.vidas_cobertas), icon: <Users className="w-3.5 h-3.5" />, color: 'text-purple-400' },
              { label: 'Total Recebido (Histórico)', value: fmtBRL(totais.total_recebido_historico), icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-emerald-400' },
              { label: 'Projeção do Mês', value: fmtBRL(totais.receita_projetada_mes), icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-[#3B82F6]' },
              { label: 'Contratos Inativos', value: fmtN(totais.contratos_total - totais.contratos_ativos - totais.contratos_inadimplentes), icon: <TrendingDown className="w-3.5 h-3.5" />, color: 'text-slate-400' },
            ].map((item, i) => (
              <div key={i} className="bg-bg-surface rounded-xl border border-border-default p-3 flex items-center gap-3">
                <div className={`p-2 bg-bg-base/50 rounded-lg ${item.color} shrink-0`}>{item.icon}</div>
                <div>
                  <p className="text-[10px] text-text-subtle">{item.label}</p>
                  <p className={`text-sm font-extrabold ${item.color}`}>
                    {analyticsLoading ? '...' : item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Gráficos ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Gráfico 1: Distribuição por tipo (Pie) */}
            <div className="bg-bg-surface rounded-2xl border border-border-default p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-[#3B82F6]" />
                <p className="text-sm font-bold text-text-base">Distribuição por Tipo</p>
              </div>
              {chartData.pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={170}>
                    <RechartsPieChart>
                      <Pie
                        data={chartData.pieData}
                        cx="50%" cy="50%"
                        innerRadius={45} outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartData.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} />
                        ))}
                        <LabelList dataKey="value" position="inside" className="text-[10px] font-bold fill-white" />
                      </Pie>
                      <Tooltip content={<CustomTooltipPie />} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {chartData.pieData.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                          <span className="text-text-subtle font-medium">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <span className="text-text-subtle text-[10px]">{d.contratos} contr.</span>
                          <span className="font-bold text-text-base">{d.value} plano(s)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-40 flex items-center justify-center text-text-subtle text-xs">Nenhum plano ativo</div>
              )}
            </div>

            {/* Gráfico 2: Receita real por plano (Bar) */}
            <div className="bg-bg-surface rounded-2xl border border-border-default p-4 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#3B82F6]" />
                  <p className="text-sm font-bold text-text-base">Receita Efetiva Real por Plano (Top 6)</p>
                </div>
                <span className="text-[10px] text-text-subtle bg-bg-base/50 border border-border-default px-2 py-0.5 rounded-full">
                  Contratos × Mensalidade
                </span>
              </div>
              {chartData.barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData.barData} margin={{ top: 4, right: 4, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" vertical={false} />
                    <XAxis
                      dataKey="nome"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `R$${v}`}
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false} tickLine={false} width={55}
                    />
                    <Tooltip content={<CustomTooltipBar />} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
                    <Bar dataKey="receita_efetiva" name="Receita Efetiva (R$)" radius={[6, 6, 0, 0]} maxBarSize={44}>
                      {chartData.barData.map((entry, index) => (
                        <Cell
                          key={`bar-cell-${index}`}
                          fill={entry.tipo === 'individual' ? '#3B82F6' : '#8B5CF6'}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="receita_recebida" name="Recebido no Mês (R$)" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={44} />
                    <Bar dataKey="contratos" name="Contratos Ativos" fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-text-subtle text-xs">
                  {analyticsLoading ? 'Carregando dados reais...' : 'Nenhum contrato ativo encontrado'}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-2 justify-center">
                <div className="flex items-center gap-1.5 text-[10px] text-text-subtle"><span className="w-3 h-3 rounded-sm bg-[#3B82F6]" /> Individual</div>
                <div className="flex items-center gap-1.5 text-[10px] text-text-subtle"><span className="w-3 h-3 rounded-sm bg-[#8B5CF6]" /> Coletivo</div>
                <div className="flex items-center gap-1.5 text-[10px] text-text-subtle"><span className="w-3 h-3 rounded-sm bg-[#10B981]" /> Recebido/Mês</div>
                <div className="flex items-center gap-1.5 text-[10px] text-text-subtle"><span className="w-3 h-3 rounded-sm bg-[#F59E0B]" /> Qtd. Contratos</div>
              </div>
            </div>
          </div>

          {/* ── Ranking real por receita efetiva ── */}
          <div className="bg-bg-surface rounded-2xl border border-border-default p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-bold text-text-base">Ranking de Desempenho — Planos Ativos</p>
              <span className="ml-auto text-[10px] text-text-subtle bg-bg-base/60 border border-border-default px-2 py-0.5 rounded-full">
                {planosAtivos.length} plano(s) · Dados reais
              </span>
            </div>

            <div className="space-y-3">
              {chartData.ranking.map(({ plano: p, m }, i) => {
                const medalColor = i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#B45309' : '#475569';
                const receita = m?.receita_mensal_efetiva ?? 0;
                const contratos = m?.contratos_ativos ?? 0;
                const inadimpl = m?.contratos_inadimplentes ?? 0;
                const vidas = m?.vidas_cobertas ?? 0;
                const pct = chartData.maxReceita > 0 ? (receita / chartData.maxReceita) * 100 : 0;

                return (
                  <div key={p.id} className="bg-bg-base/30 border border-border-default/50 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0"
                        style={{ background: medalColor + '22', color: medalColor, border: `1px solid ${medalColor}44` }}
                      >
                        {i + 1}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-text-base truncate">{p.nome}</span>
                          <span className="text-xs font-extrabold text-emerald-400 ml-2 shrink-0">
                            {fmtBRL(receita)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MiniBar value={receita} max={chartData.maxReceita} color={p.tipo_plano === 'individual' ? '#3B82F6' : '#8B5CF6'} />
                          <span className="text-[10px] text-text-subtle shrink-0 w-10 text-right">{fmtPct(pct)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${p.tipo_plano === 'individual' ? 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                          {p.tipo_plano === 'individual' ? 'IND' : 'COL'}
                        </span>
                      </div>
                    </div>

                    {/* Linha de detalhes */}
                    <div className="mt-2 flex flex-wrap gap-3 pl-10">
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-text-subtle">Contratos:</span>
                        <span className="font-bold text-emerald-400">{contratos} ativo(s)</span>
                        {inadimpl > 0 && <span className="text-rose-400 font-semibold">· {inadimpl} inad.</span>}
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-text-subtle">Vidas:</span>
                        <span className="font-bold text-purple-400">{vidas}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-text-subtle">Mensalidade base:</span>
                        <span className="font-bold text-text-base">{fmtBRL(p.valor_mensalidade)}</span>
                      </div>
                      {m && m.ticket_medio_real !== p.valor_mensalidade && m.contratos_ativos > 0 && (
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className="text-text-subtle">Ticket real:</span>
                          <span className="font-bold text-cyan-400">{fmtBRL(m.ticket_medio_real)}</span>
                        </div>
                      )}
                      {m && m.receita_recebida_mes > 0 && (
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className="text-text-subtle">Recebido/mês:</span>
                          <span className="font-bold text-amber-400">{fmtBRL(m.receita_recebida_mes)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {planosAtivos.length === 0 && (
                <p className="text-xs text-text-subtle text-center py-6">Nenhum plano ativo para exibir.</p>
              )}
            </div>

            {/* Resumo financeiro rodapé */}
            {planosAtivos.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border-default grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Receita Efetiva Total', value: fmtBRL(totais.receita_mensal_efetiva), color: 'text-emerald-400' },
                  { label: 'Ticket Médio Real', value: fmtBRL(totais.ticket_medio_real), color: 'text-[#3B82F6]' },
                  { label: 'Vidas Cobertas', value: fmtN(totais.vidas_cobertas), color: 'text-purple-400' },
                  { label: 'Taxa Inadimplência', value: fmtPct(totais.taxa_inadimplencia), color: totais.taxa_inadimplencia > 10 ? 'text-rose-400' : 'text-emerald-400' },
                ].map((item, i) => (
                  <div key={i} className="bg-bg-base/50 rounded-xl p-3 border border-border-default/50 text-center">
                    <p className="text-[10px] text-text-subtle uppercase tracking-wider mb-1">{item.label}</p>
                    <p className={`text-sm font-extrabold ${item.color}`}>
                      {analyticsLoading ? '...' : item.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const PlanosPaxPage: React.FC = () => {
  const { state } = useAppContext();
  const { planos, loading, criar, editar, desativar, reativar, excluir, verificarVinculosPlano } = usePlanosPax();
  const analytics = usePlanosAnalytics(planos);
  const { confirm } = useConfirm();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<PlanoPaxCompleto | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [filtros, setFiltros] = useState({ busca: '', tipo_plano: '', ativo: '' });

  const handleOpenForm = (plano?: PlanoPaxCompleto) => {
    setEditingPlano(plano || null);
    setIsFormOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingPlano) {
      await editar(editingPlano.id, data);
    } else {
      await criar(data);
    }
  };

  const handleDelete = async (plano: PlanoPaxCompleto) => {
    if (!canDelete(state.user, state.isOnline)) {
      systemAlert(
        'Exclusão Não Permitida',
        !state.isOnline
          ? 'Operações de exclusão estão bloqueadas no Modo de Visualização (Offline).'
          : 'Somente usuários Administradores e Super Administradores possuem permissão para excluir planos no sistema.',
        'warning'
      );
      return;
    }
    try {
      const vinculos = await verificarVinculosPlano(plano.id);
      if (vinculos.total > 0) {
        const detalhe =
          vinculos.associados > 0 && vinculos.contratos > 0
            ? `${vinculos.associados} associado(s) e ${vinculos.contratos} contrato(s) ativo(s)`
            : vinculos.associados > 0
            ? `${vinculos.associados} associado(s) ativo(s)`
            : `${vinculos.contratos} contrato(s) ativo(s)`;
        systemAlert(
          'Exclusão Não Permitida',
          `Não é possível excluir o plano "${plano.nome}": Existem ${detalhe} vinculados a este plano.\n\nPara preservar a integridade dos dados e o histórico dos associados, você pode desativar o plano para bloquear novas contratações.`,
          'warning'
        );
        return;
      }
    } catch (e) {
      console.warn('Erro ao verificar vínculos do plano:', e);
    }
    confirm({
      title: 'Excluir Plano',
      message: `Tem certeza que deseja excluir o plano "${plano.nome}"? Esta ação não pode ser desfeita.`,
      danger: true,
      confirmText: 'Excluir',
      onConfirm: async () => {
        try {
          await excluir(plano.id);
          toast.success('Plano excluído com sucesso!');
        } catch (error: any) {
          systemAlert('Exclusão Não Permitida', error.message || 'Ocorreu um erro ao tentar excluir o plano.', 'error');
        }
      },
    });
  };

  const handleToggleStatus = async (plano: PlanoPaxCompleto) => {
    if (!state.isOnline) {
      toast.error('Alteração de status bloqueada no Modo de Visualização (Offline).');
      return;
    }
    try {
      if (plano.ativo) {
        await desativar(plano.id);
        toast.success('Plano desativado.');
      } else {
        await reativar(plano.id);
        toast.success('Plano ativado com sucesso!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao alterar status do plano.');
    }
  };

  const planosFiltrados = planos.filter(p => {
    if (filtros.ativo && p.ativo.toString() !== filtros.ativo) return false;
    if (filtros.tipo_plano && p.tipo_plano !== filtros.tipo_plano) return false;
    if (filtros.busca) {
      const search = filtros.busca.toLowerCase();
      return p.nome.toLowerCase().includes(search) || p.codigo.toLowerCase().includes(search);
    }
    return true;
  });

  const kpis = {
    total: planos.length,
    ativos: planos.filter(p => p.ativo).length,
    individual: planos.filter(p => p.tipo_plano === 'individual' && p.ativo).length,
    coletivo: planos.filter(p => p.tipo_plano === 'coletivo' && p.ativo).length,
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-subtle mb-1">
            <span>Administração</span>
            <span className="w-1 h-1 rounded-full bg-border-default" />
            <span>Planos</span>
          </div>
          <h1 className="text-2xl font-bold text-text-base flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#3B82F6]" />
            Gestão de Planos
          </h1>
          <p className="text-sm text-text-subtle mt-1">Configure os planos e serviços oferecidos aos associados</p>
        </div>
        <button
          disabled={!state.isOnline}
          onClick={() => handleOpenForm()}
          title={!state.isOnline ? 'Inclusão bloqueada no Modo Offline' : 'Novo Plano'}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(59,130,246,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Novo Plano
        </button>
      </div>

      {/* ── KPI CARDS SUMÁRIO ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Total de Planos</p>
            <p className="text-xl font-extrabold text-text-base mt-0.5">{kpis.total}</p>
          </div>
        </div>
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Planos Ativos</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{kpis.ativos}</p>
          </div>
        </div>
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20 shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Ativos (Individuais)</p>
            <p className="text-xl font-extrabold text-purple-400 mt-0.5">{kpis.individual}</p>
          </div>
        </div>
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Ativos (Coletivos)</p>
            <p className="text-xl font-extrabold text-blue-400 mt-0.5">{kpis.coletivo}</p>
          </div>
        </div>
      </div>

      {/* ── PAINEL DE INDICADORES FINANCEIROS REAIS ── */}
      {!loading && (
        <AnalyticsSection planos={planos} analytics={analytics} />
      )}

      {/* ── LISTA / GRID DE PLANOS ── */}
      <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-default flex flex-col sm:flex-row gap-4 justify-between bg-bg-surface/50">
          <div className="relative w-full max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="Buscar por código ou nome..."
              value={filtros.busca}
              onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
              className="w-full bg-bg-surface border border-border-default rounded-xl pl-10 pr-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={filtros.tipo_plano}
              onChange={(e) => setFiltros(prev => ({ ...prev, tipo_plano: e.target.value }))}
              className="bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">Todos Tipos</option>
              <option value="individual">Individual</option>
              <option value="coletivo">Coletivo</option>
            </select>
            <select
              value={filtros.ativo}
              onChange={(e) => setFiltros(prev => ({ ...prev, ativo: e.target.value }))}
              className="bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">Todos Status</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>
          <div className="flex items-center gap-2 border-l border-border-default pl-4 pr-2">
            <div className="flex items-center bg-bg-subtle border border-border-default rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#3B82F6] text-white' : 'text-text-subtle hover:text-text-base'}`}
                title="Visualização em Cards"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-[#3B82F6] text-white' : 'text-text-subtle hover:text-text-base'}`}
                title="Visualização em Tabela"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto w-full p-6">
          {loading ? (
            <div className="p-8 text-center text-text-subtle">Carregando planos...</div>
          ) : planosFiltrados.length === 0 ? (
            <div className="p-8 text-center text-text-subtle">Nenhum plano encontrado.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {planosFiltrados.map((plano) => (
                <PlanoCard
                  key={plano.id}
                  plano={plano}
                  metrica={analytics.metricas[plano.id]}
                  handleOpenForm={handleOpenForm}
                  handleToggleStatus={handleToggleStatus}
                  handleDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <PlanoPaxForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        initialData={editingPlano}
      />
    </div>
  );
};
