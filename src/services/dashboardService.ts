import { supabase } from '../lib/supabase';
import { getAssociados } from './associadosService';
import { getAtendimentos } from './atendimentosService';
import { getLogsAuditoria } from './auditoriaService';
import { getAllFromIDB } from '../lib/idb';
import { getParcelasReceber, getParcelasPagar } from './financeiroService';
import { isSameMonth } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type DashboardPeriod = 'mensal' | 'trimestral' | 'anual';

export interface DashboardStats {
  totalAssociados: number;
  associadosAtivos: number;
  novosAssociados: number;
  atendimentosPeriodo: number;
  faturamentoEstimado: number;
  taxaConversao: number;
  receitaProjetadaMes: number;
  receitaArrecadadaMes: number;
  despesaProjetadaMes: number;
  despesaPagaMes: number;
  atendimentosGrafico: { name: string; total: number }[];
  recebimentosGrafico: { name: string; projetado: number; recebido: number }[];
  financeiroGrafico: { name: string; receitas: number; despesas: number; saldo: number }[];
  acoesRecentes: { title: string; desc: string; time: string; color: string }[];
  vidasPorPlano: { plano: string; vidas: number }[];
  parcelasReceberRaw: any[];
  parcelasPagarRaw: any[];
}

export const getDashboardStats = async (
  isOnline: boolean, 
  tenantId: string | null, 
  period: DashboardPeriod = 'mensal'
): Promise<DashboardStats> => {
  const stats: DashboardStats = {
    totalAssociados: 0,
    associadosAtivos: 0,
    novosAssociados: 0,
    atendimentosPeriodo: 0,
    faturamentoEstimado: 0,
    taxaConversao: 0,
    receitaProjetadaMes: 0,
    receitaArrecadadaMes: 0,
    despesaProjetadaMes: 0,
    despesaPagaMes: 0,
    atendimentosGrafico: [],
    recebimentosGrafico: [],
    financeiroGrafico: [],
    acoesRecentes: [],
    vidasPorPlano: [],
    parcelasReceberRaw: [],
    parcelasPagarRaw: []
  };

  try {
    const limitDate = new Date();
    let numMonthsChart = 6;
    
    if (period === 'mensal') {
      limitDate.setMonth(limitDate.getMonth() - 1);
      numMonthsChart = 6;
    } else if (period === 'trimestral') {
      limitDate.setMonth(limitDate.getMonth() - 3);
      numMonthsChart = 6;
    } else if (period === 'anual') {
      limitDate.setFullYear(limitDate.getFullYear() - 1);
      numMonthsChart = 12;
    }

    // 1. Associados e Planos
    const allAssociados = await getAssociados(isOnline, tenantId);
    let allPlanos: any[] = [];
    if (isOnline) {
      try {
        let query = supabase.from('planos_pax').select('*').is('deleted_at', null);
        if (tenantId && tenantId !== 'all') {
          query = query.eq('tenant_id', tenantId);
        }
        const { data } = await query;
        if (data) allPlanos = data;
        else allPlanos = await getAllFromIDB('planos_pax');
      } catch (e) {
        allPlanos = await getAllFromIDB('planos_pax');
      }
    } else {
      allPlanos = await getAllFromIDB('planos_pax');
    }
    
    stats.totalAssociados = allAssociados.length;
    stats.associadosAtivos = allAssociados.filter(a => a.status === 'ativo').length;

    // Novos associados no período selecionado
    const associadosInPeriod = allAssociados.filter(a => {
      const dataRef = a.data_adesao || a.created_at;
      if (!dataRef) return false;
      const d = new Date(dataRef);
      return d >= limitDate;
    });
    stats.novosAssociados = associadosInPeriod.length;
    
    // Faturamento Mensal Estimado de associados ativos
    stats.faturamentoEstimado = allAssociados
      .filter(a => a.status === 'ativo')
      .reduce((sum, a) => {
        const plano = allPlanos.find(p => p.id === a.plano_pax_id);
        const valor = Number(a.valor_plano) || Number(plano?.valor_mensalidade) || Number(plano?.preco_mensal) || 0;
        return sum + valor;
      }, 0);

    // Taxa de Conversão / Retenção (% de Ativos em relação ao Total)
    if (stats.totalAssociados > 0) {
      stats.taxaConversao = Number(((stats.associadosAtivos / stats.totalAssociados) * 100).toFixed(1));
    }

    // 2. Vidas por Plano (Titulares + Dependentes)
    const vidasMap: Record<string, number> = {};
    allAssociados.forEach(a => {
      if (a.status !== 'ativo') return;
      
      let nomePlano = a.plano_nome;
      if (a.plano_pax_id) {
        const planoDb = allPlanos.find(p => p.id === a.plano_pax_id);
        if (planoDb?.nome) nomePlano = planoDb.nome;
      }
      if (!nomePlano) nomePlano = 'Plano Padrão';
      
      const vidas = 1 + (a.dependentes ? a.dependentes.length : (Number(a.n_vidas) || 0));
      vidasMap[nomePlano] = (vidasMap[nomePlano] || 0) + vidas;
    });
    
    stats.vidasPorPlano = Object.keys(vidasMap)
      .map(k => ({ plano: k, vidas: vidasMap[k] }))
      .sort((a, b) => b.vidas - a.vidas);

    // 3. Contas a Receber e a Pagar
    const parcelasReceber = await getParcelasReceber(isOnline, tenantId || '');
    const parcelasPagar = await getParcelasPagar(isOnline, tenantId || '');
    const hoje = new Date();
    
    parcelasReceber.forEach(p => {
      if (p.deleted_at) return;
      const dataVenc = new Date(p.data_vencimento + 'T12:00:00');
      if (isSameMonth(dataVenc, hoje)) {
        if (p.status !== 'cancelado') {
          stats.receitaProjetadaMes += Number(p.valor) || 0;
        }
        if (p.status === 'recebido') {
          stats.receitaArrecadadaMes += Number(p.valor_recebido || p.valor) || 0;
        }
      }
    });

    parcelasPagar.forEach(p => {
      if (p.deleted_at) return;
      const dataVenc = new Date(p.data_vencimento + 'T12:00:00');
      if (isSameMonth(dataVenc, hoje)) {
        if (p.status !== 'cancelado') {
          stats.despesaProjetadaMes += Number(p.valor) || 0;
        }
        if (p.status === 'pago') {
          stats.despesaPagaMes += Number(p.valor_pago || p.valor) || 0;
        }
      }
    });

    // 4. Atendimentos Funerários
    const atendimentosData = await getAtendimentos(isOnline, tenantId || undefined);
    const atendimentosValidos = atendimentosData.filter(a => a.status !== 'cancelado');

    const atendimentosInPeriod = atendimentosValidos.filter(a => {
      const dataRef = a.data_obito || a.data_sepultamento || a.created_at;
      if (!dataRef) return false;
      const d = new Date(dataRef);
      return d >= limitDate;
    });
    stats.atendimentosPeriodo = atendimentosInPeriod.length;
    
    // 5. Histórico e Gráficos Mensais
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let i = numMonthsChart - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth();
      const y = d.getFullYear();
      
      const totalAtend = atendimentosValidos.filter(a => {
        const dataRef = a.data_obito || a.data_sepultamento || a.created_at;
        if (!dataRef) return false;
        const ad = new Date(dataRef);
        return ad.getMonth() === m && ad.getFullYear() === y;
      }).length;
      
      stats.atendimentosGrafico.push({ name: meses[m], total: totalAtend });

      let projetado = 0;
      let recebido = 0;
      parcelasReceber.forEach(p => {
        if (p.deleted_at) return;
        const ad = new Date(p.data_vencimento + 'T12:00:00');
        if (ad.getMonth() === m && ad.getFullYear() === y) {
          if (p.status !== 'cancelado') projetado += Number(p.valor) || 0;
          if (p.status === 'recebido') recebido += Number(p.valor_recebido || p.valor) || 0;
        }
      });
      stats.recebimentosGrafico.push({ name: meses[m], projetado, recebido });

      let despesas = 0;
      let despesasPagas = 0;
      parcelasPagar.forEach(p => {
        if (p.deleted_at) return;
        const ad = new Date(p.data_vencimento + 'T12:00:00');
        if (ad.getMonth() === m && ad.getFullYear() === y) {
          if (p.status !== 'cancelado') despesas += Number(p.valor) || 0;
          if (p.status === 'pago') despesasPagas += Number(p.valor_pago || p.valor) || 0;
        }
      });
      
      stats.financeiroGrafico.push({ 
        name: meses[m], 
        receitas: projetado, 
        despesas, 
        saldo: projetado - despesas 
      });
    }

    // 6. Ações Recentes (Auditoria)
    try {
      const logs = await getLogsAuditoria(isOnline, tenantId);
      stats.acoesRecentes = logs.slice(0, 5).map(log => {
        let color = 'bg-[#60A5FA]';
        const acaoLower = (log.acao || '').toLowerCase();
        if (acaoLower.includes('excluir') || acaoLower.includes('cancel')) color = 'bg-[#F43F5E]';
        else if (acaoLower.includes('atualizar') || acaoLower.includes('editar') || acaoLower.includes('estorno')) color = 'bg-[#F59E0B]';
        else if (acaoLower.includes('salvar') || acaoLower.includes('criar') || acaoLower.includes('recebimento') || acaoLower.includes('abertura')) color = 'bg-[#10B981]';
        
        const userName = log.usuarios?.nome || 'Usuário';
        let desc = `${userName} realizou esta ação`;
        
        if (log.detalhes) {
          if (typeof log.detalhes === 'object') {
            if (log.detalhes.descricao) desc = log.detalhes.descricao;
            else if (log.detalhes.nome) desc = `Em: ${log.detalhes.nome}`;
            else if (log.detalhes.codigo) desc = `Lote: ${log.detalhes.codigo}`;
          } else if (typeof log.detalhes === 'string') {
            desc = log.detalhes;
          }
        }

        return {
          title: log.acao,
          desc: desc,
          time: formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR }),
          color
        };
      });
    } catch (e) {
      console.warn('Falha ao carregar auditoria para dashboard', e);
    }

    stats.parcelasReceberRaw = parcelasReceber;
    stats.parcelasPagarRaw = parcelasPagar;
  } catch (error) {
    console.error('Erro ao buscar stats do dashboard', error);
  }
  return stats;
};