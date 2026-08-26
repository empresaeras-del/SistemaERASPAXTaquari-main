import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  PieChart as PieChartIcon, 
  BarChart3, 
  CreditCard, 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Layers,
  Users,
  Wallet,
  ShieldCheck,
  Shield,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { ParcelaReceber, Receita } from '../../services/financeiroService';
import { Associado } from '../../services/associadosService';
import { parseLocalDate, isDateBeforeToday, isDateToday } from '../../utils/dateUtils';

interface IndicadoresContasReceberProps {
  parcelas: ParcelaReceber[];
  receitas?: Receita[];
  associados?: Associado[];
  activeStatusFilter?: string;
  onSelectStatusFilter?: (status: string) => void;
}

type PeriodoAnalise = 'todos' | 'mes_atual' | 'proximo_mes' | 'ultimos_3_meses' | 'ano_atual';
type AbaAnalise = 'categorias' | 'planos' | 'mensal' | 'formas_recebimento';

const COLORS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', 
  '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#14B8A6'
];

export const IndicadoresContasReceber: React.FC<IndicadoresContasReceberProps> = ({
  parcelas,
  receitas = [],
  associados = [],
  activeStatusFilter = '',
  onSelectStatusFilter
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoAnalise>('todos');
  const [abaAtiva, setAbaAtiva] = useState<AbaAnalise>('categorias');

  // Mapeamentos para enriquecimento dos dados
  const receitaMap = useMemo(() => {
    const map = new Map<string, Receita>();
    receitas.forEach(r => {
      if (r.id) map.set(r.id, r);
    });
    return map;
  }, [receitas]);

  const associadoMap = useMemo(() => {
    const map = new Map<string, Associado>();
    associados.forEach(a => {
      if (a.id) map.set(a.id, a);
      if (a.cpf) map.set(a.cpf, a);
    });
    return map;
  }, [associados]);

  // Formatação monetária
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatShortMoney = (val: number) => {
    if (!val || val === 0) return 'R$ 0';
    const abs = Math.abs(val);
    if (abs >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `R$ ${(val / 1000).toFixed(1)}k`;
    return formatMoney(val);
  };

  // 1. KPIs Gerais de Topo
  const totais = useMemo(() => {
    let aReceber = 0;
    let countAReceber = 0;
    let vencidas = 0;
    let countVencidas = 0;
    let venceHoje = 0;
    let countVenceHoje = 0;
    let aVencer = 0;
    let countAVencer = 0;
    let recebidas = 0;
    let countRecebidas = 0;
    let totalGeral = 0;

    parcelas.forEach(p => {
      if (p.status === 'cancelado') return;

      const valor = p.valor || 0;
      totalGeral += valor;

      if (p.status === 'recebido' || p.status === 'pago') {
        const valRec = p.valor_recebido !== undefined && p.valor_recebido !== null 
          ? p.valor_recebido 
          : (p.valor_pago !== undefined && p.valor_pago !== null ? p.valor_pago : valor);
        recebidas += valRec;
        countRecebidas++;
      } else {
        // Pendentes / Em aberto
        aReceber += valor;
        countAReceber++;

        if (isDateBeforeToday(p.data_vencimento)) {
          vencidas += valor;
          countVencidas++;
        } else if (isDateToday(p.data_vencimento)) {
          venceHoje += valor;
          countVenceHoje++;
        } else {
          aVencer += valor;
          countAVencer++;
        }
      }
    });

    const taxaRecuperacao = (totalGeral > 0) ? (recebidas / totalGeral) * 100 : 0;
    const taxaInadimplencia = (aReceber > 0) ? (vencidas / aReceber) * 100 : 0;

    return {
      aReceber,
      countAReceber,
      vencidas,
      countVencidas,
      venceHoje,
      countVenceHoje,
      aVencer,
      countAVencer,
      recebidas,
      countRecebidas,
      totalGeral,
      taxaRecuperacao,
      taxaInadimplencia
    };
  }, [parcelas]);

  // 2. Parcelas filtradas pelo período selecionado
  const parcelasFiltradasPeriodo = useMemo(() => {
    if (periodo === 'todos') return parcelas.filter(p => p.status !== 'cancelado');

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();

    return parcelas.filter(p => {
      if (p.status === 'cancelado') return false;
      const dataRef = parseLocalDate(p.data_vencimento);
      if (!dataRef) return false;

      const ano = dataRef.getFullYear();
      const mes = dataRef.getMonth();

      if (periodo === 'mes_atual') {
        return ano === anoAtual && mes === mesAtual;
      }
      if (periodo === 'proximo_mes') {
        const proxMesDate = new Date(anoAtual, mesAtual + 1, 1);
        return ano === proxMesDate.getFullYear() && mes === proxMesDate.getMonth();
      }
      if (periodo === 'ultimos_3_meses') {
        const diffMonths = (anoAtual - ano) * 12 + (mesAtual - mes);
        return diffMonths >= 0 && diffMonths < 3;
      }
      if (periodo === 'ano_atual') {
        return ano === anoAtual;
      }
      return true;
    });
  }, [parcelas, periodo]);

  // 3. Agrupamento por Categoria / Origem da Receita
  const dadosPorCategoria = useMemo(() => {
    const map = new Map<string, { categoria: string; total: number; recebido: number; pendente: number; count: number }>();
    let grandTotal = 0;

    parcelasFiltradasPeriodo.forEach(p => {
      const parentReceita = p.receita_id ? receitaMap.get(p.receita_id) : null;
      let cat = (parentReceita?.categoria || (p as any).categoria || '').trim();
      
      if (!cat) {
        if (p.tipo_devedor === 'associado' || parentReceita?.tipo_devedor === 'associado') {
          cat = 'Mensalidade de Plano';
        } else if (p.descricao?.toLowerCase().includes('adesao') || p.descricao?.toLowerCase().includes('adesão')) {
          cat = 'Taxa de Adesão';
        } else if (p.descricao?.toLowerCase().includes('funer') || p.descricao?.toLowerCase().includes('atendimento')) {
          cat = 'Serviço Funerário';
        } else {
          cat = 'Receita Operacional / Geral';
        }
      }

      const valor = p.valor || 0;
      grandTotal += valor;

      if (!map.has(cat)) {
        map.set(cat, { categoria: cat, total: 0, recebido: 0, pendente: 0, count: 0 });
      }

      const item = map.get(cat)!;
      item.total += valor;
      item.count++;

      if (p.status === 'recebido' || p.status === 'pago') {
        const valRec = p.valor_recebido !== undefined && p.valor_recebido !== null 
          ? p.valor_recebido 
          : (p.valor_pago !== undefined && p.valor_pago !== null ? p.valor_pago : valor);
        item.recebido += valRec;
      } else {
        item.pendente += valor;
      }
    });

    return Array.from(map.values())
      .map(item => ({
        ...item,
        percentual: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [parcelasFiltradasPeriodo, receitaMap]);

  // 4. Agrupamento por Plano PAX & Tipo de Devedor
  const dadosPorPlanoEDevedor = useMemo(() => {
    const planosMap = new Map<string, { plano: string; total: number; recebido: number; pendente: number; count: number }>();
    const devedorTipoMap = new Map<string, { tipo: string; total: number; count: number }>();
    let grandTotal = 0;

    parcelasFiltradasPeriodo.forEach(p => {
      const parentReceita = p.receita_id ? receitaMap.get(p.receita_id) : null;
      const assoc = parentReceita?.associado_id 
        ? associadoMap.get(parentReceita.associado_id) 
        : (p.devedor_cpf_cnpj ? associadoMap.get(p.devedor_cpf_cnpj) : null);

      // Resolução do Plano
      let planoNome = (parentReceita?.associado_plano || assoc?.plano_nome || (assoc as any)?.plano || '').trim();
      if (!planoNome) {
        if (p.tipo_devedor === 'associado' || parentReceita?.tipo_devedor === 'associado') {
          planoNome = 'Plano PAX Padrão';
        } else {
          planoNome = 'Sem Plano / Venda Avulsa';
        }
      }

      // Resolução do Tipo de Devedor
      let tipoDev = p.tipo_devedor || parentReceita?.tipo_devedor;
      let tipoLabel = 'Cliente Geral';
      if (tipoDev === 'associado') tipoLabel = 'Associados PAX';
      else if (tipoDev === 'cliente_pj' || (parentReceita?.cliente_tipo === 'pj')) tipoLabel = 'Clientes PJ / Empresas';
      else if (tipoDev === 'cliente_pf' || (parentReceita?.cliente_tipo === 'pf')) tipoLabel = 'Clientes PF Avulsos';
      else if (tipoDev === 'convenio') tipoLabel = 'Convênios & Parceiros';

      const valor = p.valor || 0;
      grandTotal += valor;

      // Planos
      if (!planosMap.has(planoNome)) {
        planosMap.set(planoNome, { plano: planoNome, total: 0, recebido: 0, pendente: 0, count: 0 });
      }
      const plItem = planosMap.get(planoNome)!;
      plItem.total += valor;
      plItem.count++;
      if (p.status === 'recebido' || p.status === 'pago') {
        const valRec = p.valor_recebido !== undefined && p.valor_recebido !== null 
          ? p.valor_recebido 
          : (p.valor_pago !== undefined && p.valor_pago !== null ? p.valor_pago : valor);
        plItem.recebido += valRec;
      } else {
        plItem.pendente += valor;
      }

      // Tipos de Devedor
      if (!devedorTipoMap.has(tipoLabel)) {
        devedorTipoMap.set(tipoLabel, { tipo: tipoLabel, total: 0, count: 0 });
      }
      const dtItem = devedorTipoMap.get(tipoLabel)!;
      dtItem.total += valor;
      dtItem.count++;
    });

    const planos = Array.from(planosMap.values())
      .map(item => ({
        ...item,
        percentual: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    const devedores = Array.from(devedorTipoMap.values())
      .map(item => ({
        ...item,
        percentual: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    return { planos, devedores };
  }, [parcelasFiltradasPeriodo, receitaMap, associadoMap]);

  // 5. Agrupamento por Mês (Evolução Temporal)
  const dadosPorMes = useMemo(() => {
    const map = new Map<string, { key: string; mesLabel: string; previsto: number; recebido: number; pendente: number; sortKey: number }>();
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    parcelasFiltradasPeriodo.forEach(p => {
      const d = parseLocalDate(p.data_vencimento);
      if (!d) return;

      const ano = d.getFullYear();
      const mes = d.getMonth();
      const key = `${ano}-${String(mes + 1).padStart(2, '0')}`;
      const mesLabel = `${mesesNomes[mes]}/${String(ano).slice(2)}`;
      const sortKey = ano * 100 + mes;

      if (!map.has(key)) {
        map.set(key, { key, mesLabel, previsto: 0, recebido: 0, pendente: 0, sortKey });
      }

      const item = map.get(key)!;
      const valor = p.valor || 0;
      item.previsto += valor;

      if (p.status === 'recebido' || p.status === 'pago') {
        const valRec = p.valor_recebido !== undefined && p.valor_recebido !== null 
          ? p.valor_recebido 
          : (p.valor_pago !== undefined && p.valor_pago !== null ? p.valor_pago : valor);
        item.recebido += valRec;
      } else {
        item.pendente += valor;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [parcelasFiltradasPeriodo]);

  // 6. Agrupamento por Forma de Recebimento
  const dadosPorFormaRecebimento = useMemo(() => {
    const map = new Map<string, { forma: string; total: number; recebido: number; pendente: number; count: number }>();
    let grandTotal = 0;

    const formatarNomeForma = (forma: string) => {
      const f = (forma || '').toLowerCase();
      if (f === 'pix') return 'PIX';
      if (f === 'boleto') return 'Boleto Bancário';
      if (f === 'carne' || f === 'carnê') return 'Carnê PAX';
      if (f === 'cartao_credito' || f === 'credito') return 'Cartão de Crédito';
      if (f === 'cartao_debito' || f === 'debito') return 'Cartão de Débito';
      if (f === 'dinheiro') return 'Dinheiro';
      if (f === 'transferencia' || f === 'ted' || f === 'doc') return 'Transferência Bancária';
      if (f === 'cobranca_domicilio') return 'Cobrança em Domicílio';
      return forma || 'Outros / Não especificado';
    };

    parcelasFiltradasPeriodo.forEach(p => {
      const formaRaw = p.forma_pagamento_efetivo || p.forma_pagamento || 'pix';
      const formaLabel = formatarNomeForma(formaRaw);
      const valor = p.valor || 0;
      grandTotal += valor;

      if (!map.has(formaLabel)) {
        map.set(formaLabel, { forma: formaLabel, total: 0, recebido: 0, pendente: 0, count: 0 });
      }

      const item = map.get(formaLabel)!;
      item.total += valor;
      item.count++;

      if (p.status === 'recebido' || p.status === 'pago') {
        const valRec = p.valor_recebido !== undefined && p.valor_recebido !== null 
          ? p.valor_recebido 
          : (p.valor_pago !== undefined && p.valor_pago !== null ? p.valor_pago : valor);
        item.recebido += valRec;
      } else {
        item.pendente += valor;
      }
    });

    return Array.from(map.values())
      .map(item => ({
        ...item,
        percentual: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [parcelasFiltradasPeriodo]);

  return (
    <div className="space-y-4 mb-8 print:hidden">
      {/* 1. CARDS DE KPI DE ALTO NÍVEL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total a Receber */}
        <div 
          onClick={() => onSelectStatusFilter && onSelectStatusFilter(activeStatusFilter === 'pendente' ? '' : 'pendente')}
          className={`bg-bg-subtle border p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-md ${
            activeStatusFilter === 'pendente' 
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/5' 
              : 'border-border-default hover:border-indigo-500/40'
          }`}
          title="Clique para filtrar apenas receitas pendentes"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-subtle uppercase tracking-wider">Total a Receber</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-text-base tracking-tight">
            {formatMoney(totais.aReceber)}
          </div>
          <div className="flex items-center justify-between text-xs text-text-subtle mt-1.5 pt-1.5 border-t border-border-subtle/50">
            <span>{totais.countAReceber} {totais.countAReceber === 1 ? 'parcela' : 'parcelas'}</span>
            <span className="text-indigo-500 font-medium">Em carteira</span>
          </div>
        </div>

        {/* Vencidas (Inadimplência) */}
        <div 
          onClick={() => onSelectStatusFilter && onSelectStatusFilter(activeStatusFilter === 'vencido' ? '' : 'vencido')}
          className={`bg-bg-subtle border p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-md ${
            activeStatusFilter === 'vencido' 
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5' 
              : 'border-border-default hover:border-rose-500/40'
          }`}
          title="Clique para filtrar títulos vencidos / inadimplentes"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Vencidas</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
            {formatMoney(totais.vencidas)}
          </div>
          <div className="flex items-center justify-between text-xs text-text-subtle mt-1.5 pt-1.5 border-t border-border-subtle/50">
            <span className="text-rose-500 font-medium">{totais.countVencidas} em atraso</span>
            <span className="text-rose-500 font-semibold">{totais.taxaInadimplencia.toFixed(1)}% inadimpl.</span>
          </div>
        </div>

        {/* Vence Hoje */}
        <div 
          onClick={() => onSelectStatusFilter && onSelectStatusFilter(activeStatusFilter === 'vence_hoje' ? '' : 'vence_hoje')}
          className={`bg-bg-subtle border p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-md ${
            activeStatusFilter === 'vence_hoje' 
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5' 
              : 'border-border-default hover:border-amber-500/40'
          }`}
          title="Clique para filtrar títulos que vencem hoje"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Vence Hoje</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
            {formatMoney(totais.venceHoje)}
          </div>
          <div className="flex items-center justify-between text-xs text-text-subtle mt-1.5 pt-1.5 border-t border-border-subtle/50">
            <span>{totais.countVenceHoje} {totais.countVenceHoje === 1 ? 'título' : 'títulos'}</span>
            <span className="text-amber-500 font-medium">Previsto p/ hoje</span>
          </div>
        </div>

        {/* A Vencer */}
        <div 
          onClick={() => onSelectStatusFilter && onSelectStatusFilter(activeStatusFilter === 'a_vencer' ? '' : 'a_vencer')}
          className={`bg-bg-subtle border p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-md ${
            activeStatusFilter === 'a_vencer' 
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5' 
              : 'border-border-default hover:border-emerald-500/40'
          }`}
          title="Clique para filtrar recebimentos futuros no prazo"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-subtle uppercase tracking-wider">A Vencer</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-text-base tracking-tight">
            {formatMoney(totais.aVencer)}
          </div>
          <div className="flex items-center justify-between text-xs text-text-subtle mt-1.5 pt-1.5 border-t border-border-subtle/50">
            <span>{totais.countAVencer} no prazo</span>
            <span className="text-emerald-500 font-medium">Fluxo futuro</span>
          </div>
        </div>

        {/* Total Recebido */}
        <div 
          onClick={() => onSelectStatusFilter && onSelectStatusFilter(activeStatusFilter === 'recebido' ? '' : 'recebido')}
          className={`bg-bg-subtle border p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-md ${
            activeStatusFilter === 'recebido' 
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5' 
              : 'border-border-default hover:border-emerald-500/40'
          }`}
          title="Clique para filtrar recebimentos já quitados"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Total Recebido</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatMoney(totais.recebidas)}
          </div>
          <div className="flex items-center justify-between text-xs text-text-subtle mt-1.5 pt-1.5 border-t border-border-subtle/50">
            <span>{totais.countRecebidas} liquidadas</span>
            <span className="text-emerald-500 font-semibold">{totais.taxaRecuperacao.toFixed(1)}% arrecadação</span>
          </div>
        </div>
      </div>

      {/* 2. PAINEL DE ANÁLISE DETALHADA E INDICADORES INTELIGENTES */}
      <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm transition-all duration-200">
        {/* Cabeçalho do Painel Analítico */}
        <div className="p-4 bg-bg-surface/50 border-b border-border-default flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-base flex items-center gap-2">
                Painel Analítico de Receitas & Planos
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Gestão de Arrecadação
                </span>
              </h2>
              <p className="text-xs text-text-subtle">
                Demonstrativo de faturamento por categoria, planos PAX, evolução e meios de recebimento
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
            {/* Filtro de Período */}
            <div className="flex items-center bg-bg-base border border-border-default rounded-xl p-1 text-xs">
              <button
                onClick={() => setPeriodo('todos')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  periodo === 'todos' ? 'bg-emerald-500 text-white shadow-sm' : 'text-text-subtle hover:text-text-base'
                }`}
              >
                Tudo
              </button>
              <button
                onClick={() => setPeriodo('mes_atual')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  periodo === 'mes_atual' ? 'bg-emerald-500 text-white shadow-sm' : 'text-text-subtle hover:text-text-base'
                }`}
              >
                Este Mês
              </button>
              <button
                onClick={() => setPeriodo('proximo_mes')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  periodo === 'proximo_mes' ? 'bg-emerald-500 text-white shadow-sm' : 'text-text-subtle hover:text-text-base'
                }`}
              >
                Próximo Mês
              </button>
              <button
                onClick={() => setPeriodo('ultimos_3_meses')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  periodo === 'ultimos_3_meses' ? 'bg-emerald-500 text-white shadow-sm' : 'text-text-subtle hover:text-text-base'
                }`}
              >
                3 Meses
              </button>
              <button
                onClick={() => setPeriodo('ano_atual')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  periodo === 'ano_atual' ? 'bg-emerald-500 text-white shadow-sm' : 'text-text-subtle hover:text-text-base'
                }`}
              >
                Este Ano
              </button>
            </div>

            {/* Toggle Recolher/Expandir */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-text-subtle hover:text-text-base bg-bg-base border border-border-default rounded-xl transition-colors"
              title={isExpanded ? 'Minimizar Painel' : 'Expandir Painel'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Conteúdo Expansível */}
        {isExpanded && (
          <div className="p-5 space-y-6">
            {/* Abas de Navegação Analítica */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle pb-3">
              <button
                onClick={() => setAbaAtiva('categorias')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  abaAtiva === 'categorias'
                    ? 'bg-bg-surface text-emerald-500 shadow-sm border border-border-default'
                    : 'text-text-subtle hover:text-text-base hover:bg-bg-hover'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Por Origem & Categoria</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-500">
                  {dadosPorCategoria.length}
                </span>
              </button>

              <button
                onClick={() => setAbaAtiva('planos')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  abaAtiva === 'planos'
                    ? 'bg-bg-surface text-emerald-500 shadow-sm border border-border-default'
                    : 'text-text-subtle hover:text-text-base hover:bg-bg-hover'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Por Plano PAX & Devedores</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-500">
                  {dadosPorPlanoEDevedor.planos.length}
                </span>
              </button>

              <button
                onClick={() => setAbaAtiva('mensal')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  abaAtiva === 'mensal'
                    ? 'bg-bg-surface text-emerald-500 shadow-sm border border-border-default'
                    : 'text-text-subtle hover:text-text-base hover:bg-bg-hover'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Evolução Mensal (Previsto x Arrecadado)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-500">
                  {dadosPorMes.length} {dadosPorMes.length === 1 ? 'mês' : 'meses'}
                </span>
              </button>

              <button
                onClick={() => setAbaAtiva('formas_recebimento')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  abaAtiva === 'formas_recebimento'
                    ? 'bg-bg-surface text-emerald-500 shadow-sm border border-border-default'
                    : 'text-text-subtle hover:text-text-base hover:bg-bg-hover'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Formas de Recebimento</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-500">
                  {dadosPorFormaRecebimento.length}
                </span>
              </button>
            </div>

            {/* ABA 1: POR CATEGORIA / ORIGEM */}
            {abaAtiva === 'categorias' && (
              <div className="space-y-4">
                {dadosPorCategoria.length === 0 ? (
                  <div className="text-center py-8 text-text-subtle text-xs">
                    Nenhuma receita encontrada para o período selecionado.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {dadosPorCategoria.map((cat, idx) => (
                      <div 
                        key={cat.categoria} 
                        className="bg-bg-surface border border-border-default rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/40 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-text-base truncate max-w-[170px]" title={cat.categoria}>
                              {cat.categoria}
                            </span>
                            <span 
                              className="text-xs font-bold px-2 py-0.5 rounded-md"
                              style={{ 
                                backgroundColor: `${COLORS[idx % COLORS.length]}15`, 
                                color: COLORS[idx % COLORS.length] 
                              }}
                            >
                              {cat.percentual.toFixed(1)}%
                            </span>
                          </div>

                          <div className="text-lg font-bold text-text-base mb-2">
                            {formatMoney(cat.total)}
                          </div>

                          <div className="w-full bg-bg-subtle rounded-full h-2 overflow-hidden mb-3">
                            <div 
                              className="h-full rounded-full transition-all duration-500" 
                              style={{ 
                                width: `${Math.min(cat.percentual, 100)}%`,
                                backgroundColor: COLORS[idx % COLORS.length]
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-text-subtle pt-2 border-t border-border-subtle">
                          <span className="text-emerald-500 font-medium">Recebido: {formatMoney(cat.recebido)}</span>
                          <span className="text-amber-500 font-medium">Aberto: {formatMoney(cat.pendente)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: POR PLANO PAX & DEVEDORES */}
            {abaAtiva === 'planos' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Por Plano */}
                <div className="bg-bg-surface border border-border-default rounded-xl p-4">
                  <h4 className="text-xs font-bold text-text-base uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Faturamento por Plano PAX
                  </h4>
                  <div className="space-y-3">
                    {dadosPorPlanoEDevedor.planos.length === 0 ? (
                      <div className="text-xs text-text-subtle text-center py-4">Sem registros no período</div>
                    ) : (
                      dadosPorPlanoEDevedor.planos.map((pl, idx) => (
                        <div key={pl.plano} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 truncate max-w-[200px]">
                              <span className="font-semibold text-text-base truncate" title={pl.plano}>{pl.plano}</span>
                              <span className="text-[10px] text-text-subtle shrink-0">({pl.count} parc.)</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-text-base">{formatMoney(pl.total)}</span>
                              <span className="text-emerald-500 text-[11px] font-semibold">({pl.percentual.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="w-full bg-bg-subtle rounded-full h-2 overflow-hidden">
                            <div 
                              className="h-full rounded-full" 
                              style={{ 
                                width: `${Math.min(pl.percentual, 100)}%`,
                                backgroundColor: COLORS[idx % COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Por Tipo de Devedor */}
                <div className="bg-bg-surface border border-border-default rounded-xl p-4">
                  <h4 className="text-xs font-bold text-text-base uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-500" />
                    Distribuição por Perfil de Cliente / Devedor
                  </h4>
                  <div className="space-y-3">
                    {dadosPorPlanoEDevedor.devedores.length === 0 ? (
                      <div className="text-xs text-text-subtle text-center py-4">Sem registros no período</div>
                    ) : (
                      dadosPorPlanoEDevedor.devedores.map((dev, idx) => (
                        <div key={dev.tipo} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-text-base">{dev.tipo}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-text-base">{formatMoney(dev.total)}</span>
                              <span className="text-text-subtle text-[11px]">({dev.percentual.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="w-full bg-bg-subtle rounded-full h-2 overflow-hidden">
                            <div 
                              className="h-full rounded-full" 
                              style={{ 
                                width: `${Math.min(dev.percentual, 100)}%`,
                                backgroundColor: COLORS[idx % COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ABA 3: EVOLUÇÃO MENSAL */}
            {abaAtiva === 'mensal' && (
              <div className="space-y-4">
                {dadosPorMes.length === 0 ? (
                  <div className="text-center py-8 text-text-subtle text-xs">
                    Sem dados temporais disponíveis no período selecionado.
                  </div>
                ) : (
                  <div className="bg-bg-surface border border-border-default rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-xs font-bold text-text-base uppercase tracking-wider">
                          Fluxo Mensal de Recebimentos (Previsto vs Arrecadado)
                        </h4>
                        <p className="text-xs text-text-subtle mt-0.5">
                          Comparação entre cobranças geradas e valores efetivamente liquidados
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-indigo-500" />
                          <span className="text-text-subtle">Previsto</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                          <span className="text-text-subtle">Arrecadado</span>
                        </div>
                      </div>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dadosPorMes} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
                          <XAxis 
                            dataKey="mesLabel" 
                            tick={{ fill: 'var(--color-text-subtle)', fontSize: 12 }} 
                            axisLine={{ stroke: 'var(--color-border-default)' }}
                          />
                          <YAxis 
                            tickFormatter={formatShortMoney} 
                            tick={{ fill: 'var(--color-text-subtle)', fontSize: 11 }} 
                            axisLine={{ stroke: 'var(--color-border-default)' }}
                          />
                          <Tooltip 
                            formatter={(value: any) => [formatMoney(Number(value)), '']}
                            contentStyle={{ 
                              backgroundColor: 'var(--color-bg-surface)', 
                              borderColor: 'var(--color-border-default)',
                              borderRadius: '0.75rem',
                              color: 'var(--color-text-base)',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                          <Bar dataKey="previsto" name="Previsto" fill="#6366F1" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="recebido" name="Arrecadado" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA 4: FORMAS DE RECEBIMENTO */}
            {abaAtiva === 'formas_recebimento' && (
              <div className="space-y-4">
                {dadosPorFormaRecebimento.length === 0 ? (
                  <div className="text-center py-8 text-text-subtle text-xs">
                    Nenhuma movimentação para exibir.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {dadosPorFormaRecebimento.map((fr, idx) => (
                      <div 
                        key={fr.forma} 
                        className="bg-bg-surface border border-border-default rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/40 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-bg-subtle text-emerald-500">
                                <CreditCard className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-bold text-text-base">{fr.forma}</span>
                            </div>
                            <span 
                              className="text-xs font-bold px-2 py-0.5 rounded-md"
                              style={{ 
                                backgroundColor: `${COLORS[idx % COLORS.length]}15`, 
                                color: COLORS[idx % COLORS.length] 
                              }}
                            >
                              {fr.percentual.toFixed(1)}%
                            </span>
                          </div>

                          <div className="text-lg font-bold text-text-base mb-2">
                            {formatMoney(fr.total)}
                          </div>

                          <div className="w-full bg-bg-subtle rounded-full h-2 overflow-hidden mb-3">
                            <div 
                              className="h-full rounded-full transition-all duration-500" 
                              style={{ 
                                width: `${Math.min(fr.percentual, 100)}%`,
                                backgroundColor: COLORS[idx % COLORS.length]
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-text-subtle pt-2 border-t border-border-subtle">
                          <span>{fr.count} {fr.count === 1 ? 'título' : 'títulos'}</span>
                          <span className="text-emerald-500 font-medium">Recebido: {formatMoney(fr.recebido)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
