import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getParcelasReceber, ParcelaReceber, getParcelasPagar, ParcelaPagar } from '../../services/financeiroService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Activity, TrendingUp, AlertCircle, CheckCircle2, DollarSign, Wallet } from 'lucide-react';
import { format, parseISO, subMonths, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  associado: any;
}

export const AssociadoResumoFinanceiroTab: React.FC<Props> = ({ associado }) => {
  const { state } = useAppContext();
  const [parcelasReceber, setParcelasReceber] = useState<ParcelaReceber[]>([]);
  const [todasParcelasReceber, setTodasParcelasReceber] = useState<ParcelaReceber[]>([]);
  const [parcelasPagar, setParcelasPagar] = useState<ParcelaPagar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [allReceber, allPagar] = await Promise.all([
          getParcelasReceber(state.isOnline, state.empresaSelecionada || 'all'),
          getParcelasPagar(state.isOnline, state.empresaSelecionada || 'all')
        ]);

        const cpfsRelacionados = [
          associado.cpf?.replace(/\D/g, ''),
          ...(associado.dependentes?.map((d: any) => d.cpf?.replace(/\D/g, '')) || [])
        ].filter(Boolean);

        const nomesRelacionados = [
          associado.nome?.toLowerCase().trim(),
          ...(associado.dependentes?.map((d: any) => d.nome?.toLowerCase().trim()) || [])
        ].filter(Boolean);

        const matchesAssociadoOuDependente = (devedor_cpf?: string, devedor_nome?: string) => {
          const cpf = devedor_cpf?.replace(/\D/g, '');
          const nome = devedor_nome?.toLowerCase().trim();
          if (cpf && cpfsRelacionados.includes(cpf)) return true;
          if (nome && nomesRelacionados.includes(nome)) return true;
          return false;
        };

        const associadoReceber = allReceber.filter(p => matchesAssociadoOuDependente(p.devedor_cpf_cnpj, p.devedor_nome));
        const associadoPagar = allPagar.filter(p => matchesAssociadoOuDependente(p.credor_cpf_cnpj, p.credor_nome));

        setTodasParcelasReceber(allReceber);
        setParcelasReceber(associadoReceber);
        setParcelasPagar(associadoPagar);
      } catch (error) {
        console.error('Erro ao buscar dados financeiros:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [associado, state.isOnline, state.empresaSelecionada]);

  const {
    totalPago,
    totalAberto,
    totalAtrasado,
    qtdAtrasos,
    qualificacao,
    qualificacaoColor,
    potencialArrecadacao,
    dadosGraficoBarras,
    dadosGraficoPizza
  } = useMemo(() => {
    let pago = 0;
    let aberto = 0;
    let atrasado = 0;
    let qtd = 0;

    const statusCount = { recebido: 0, pendente: 0, atrasado: 0, cancelado: 0 };

    parcelasReceber.forEach(p => {
      const valor = p.valor || 0;
      const valorRecebido = p.valor_recebido || valor;

      if (p.status === 'recebido' || p.status === 'pago') {
        pago += valorRecebido;
        statusCount.recebido++;
      } else if (p.status === 'cancelado') {
        statusCount.cancelado++;
      } else if (p.status === 'atrasado' || p.status === 'vencido') {
        atrasado += valor;
        aberto += valor;
        qtd++;
        statusCount.atrasado++;
      } else {
        aberto += valor;
        statusCount.pendente++;
      }
    });

    // Qualificação
    let qualif = 'A - Excelente (Sem atrasos)';
    let color = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (associado.status === 'inadimplente' || qtd > 3) {
      qualif = 'C - Risco (Inadimplente ou histórico de muitos atrasos)';
      color = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    } else if (qtd > 0) {
      qualif = 'B - Regular (Atrasos eventuais)';
      color = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    } else if (pago === 0 && aberto === 0) {
      qualif = 'S/ Dados - Novo Associado';
      color = 'text-text-subtle bg-bg-surface border-border-default';
    }

    // Potencial de Arrecadação (Total Associado / Total Geral)
    const totalEsperadoGeral = todasParcelasReceber.reduce((acc, p) => acc + (p.status !== 'cancelado' ? p.valor : 0), 0);
    const totalEsperadoAssociado = parcelasReceber.reduce((acc, p) => acc + (p.status !== 'cancelado' ? p.valor : 0), 0);
    const pot = totalEsperadoGeral > 0 ? ((totalEsperadoAssociado / totalEsperadoGeral) * 100) : 0;

    // Gráfico de Barras (Últimos 6 meses)
    const ultimosMeses = Array.from({ length: 6 }).map((_, i) => subMonths(new Date(), 5 - i));
    const dadosBarras = ultimosMeses.map(date => {
      const mesStr = format(date, 'MMM/yy', { locale: ptBR });
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const parcelasMes = parcelasReceber.filter(p => {
        const d = parseISO(p.data_vencimento);
        return d >= monthStart && d <= monthEnd;
      });

      const recebido = parcelasMes.filter(p => p.status === 'recebido' || p.status === 'pago').reduce((a, b) => a + (b.valor_recebido || b.valor), 0);
      const pendente = parcelasMes.filter(p => p.status === 'pendente').reduce((a, b) => a + b.valor, 0);
      const atrasadoValor = parcelasMes.filter(p => p.status === 'atrasado' || p.status === 'vencido').reduce((a, b) => a + b.valor, 0);

      return {
        name: mesStr,
        Recebido: recebido,
        Pendente: pendente,
        Atrasado: atrasadoValor,
      };
    });

    // Gráfico de Pizza
    const dadosPizza = [
      { name: 'Recebido', value: statusCount.recebido, color: '#10B981' },
      { name: 'Pendente', value: statusCount.pendente, color: '#3B82F6' },
      { name: 'Atrasado', value: statusCount.atrasado, color: '#F43F5E' },
    ].filter(d => d.value > 0);

    return {
      totalPago: pago,
      totalAberto: aberto,
      totalAtrasado: atrasado,
      qtdAtrasos: qtd,
      qualificacao: qualif,
      qualificacaoColor: color,
      potencialArrecadacao: pot,
      dadosGraficoBarras: dadosBarras,
      dadosGraficoPizza: dadosPizza
    };
  }, [parcelasReceber, todasParcelasReceber, associado.status]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3B82F6]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-4 mb-4">
        <h4 className="text-xl font-bold text-text-base flex items-center gap-2">
          <Activity className="w-6 h-6 text-[#3B82F6]" />
          Resumo Financeiro
        </h4>
        <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${qualificacaoColor}`}>
          Qualificação: {qualificacao}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-bg-surface p-5 rounded-xl border border-border-default hover:border-[#10B981]/50 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#10B981]/10 rounded-lg text-[#10B981]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-sm font-semibold text-text-subtle">Total Recebido</span>
          </div>
          <p className="text-2xl font-bold text-text-base">{formatCurrency(totalPago)}</p>
        </div>
        
        <div className="bg-bg-surface p-5 rounded-xl border border-border-default hover:border-[#3B82F6]/50 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#3B82F6]/10 rounded-lg text-[#3B82F6]">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-sm font-semibold text-text-subtle">Em Aberto</span>
          </div>
          <p className="text-2xl font-bold text-text-base">{formatCurrency(totalAberto)}</p>
        </div>

        <div className="bg-bg-surface p-5 rounded-xl border border-border-default hover:border-[#F43F5E]/50 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#F43F5E]/10 rounded-lg text-[#F43F5E]">
              <AlertCircle className="w-5 h-5" />
            </div>
            <span className="text-sm font-semibold text-text-subtle">Total Atrasado</span>
          </div>
          <p className="text-2xl font-bold text-text-base">{formatCurrency(totalAtrasado)}</p>
          {qtdAtrasos > 0 && <p className="text-xs text-[#F43F5E] mt-1">{qtdAtrasos} parcela(s)</p>}
        </div>

        <div className="bg-bg-surface p-5 rounded-xl border border-border-default hover:border-[#8B5CF6]/50 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#8B5CF6]/10 rounded-lg text-[#8B5CF6]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-sm font-semibold text-text-subtle">Potencial Global</span>
          </div>
          <p className="text-2xl font-bold text-text-base">{potencialArrecadacao.toFixed(2)}%</p>
          <p className="text-xs text-text-subtle mt-1">Da arrecadação total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-2 bg-bg-surface p-6 rounded-xl border border-border-default flex flex-col h-[400px]">
          <h5 className="text-sm font-bold text-text-base mb-6 uppercase tracking-wider">Evolução de Receitas (Últimos 6 meses)</h5>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGraficoBarras} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tickMargin={10} />
                <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={(value) => `R$ ${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#F8FAFC' }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Recebido" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="Pendente" stackId="a" fill="#3B82F6" />
                <Bar dataKey="Atrasado" stackId="a" fill="#F43F5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-bg-surface p-6 rounded-xl border border-border-default flex flex-col h-[400px]">
          <h5 className="text-sm font-bold text-text-base mb-6 uppercase tracking-wider">Status das Parcelas (Qtd)</h5>
          {dadosGraficoPizza.length > 0 ? (
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosGraficoPizza}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {dadosGraficoPizza.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#F8FAFC' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-subtle text-sm">
              Nenhuma parcela registrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
