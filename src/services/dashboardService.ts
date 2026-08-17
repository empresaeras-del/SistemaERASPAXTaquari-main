import { supabase } from '../lib/supabase';
import { getAssociados } from './associadosService';
import { getLogsAuditoria } from './auditoriaService';
import { getAllFromIDB, saveToIDB } from '../lib/idb';
import { getParcelasReceber, getParcelasPagar } from './financeiroService';
import { isSameMonth, parseISO } from 'date-fns';
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

export const getDashboardStats = async (isOnline: boolean, tenantId: string | null, period: DashboardPeriod = 'mensal'): Promise<DashboardStats> => {
  let stats: DashboardStats = {
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

    const allAssociados = await getAssociados(isOnline, tenantId);
    let allPlanos: any[] = [];
    if (isOnline) {
      try {
        let query = supabase.from('planos_pax').select('*').is('deleted_at', null);
        if (tenantId && tenantId !== 'all') {
           query = query.eq('tenant_id', tenantId);
        }
        const { data } = await query;
        if (data) {
           allPlanos = data;
        }
      } catch (e) {
        allPlanos = await getAllFromIDB('planos_pax');
      }
    } else {
      allPlanos = await getAllFromIDB('planos_pax');
    }
    
    stats.totalAssociados = allAssociados.length;
    stats.associadosAtivos = allAssociados.filter(a => a.status === 'ativo').length;

    // Filter associados by period for 'novosAssociados'
    const associadosInPeriod = allAssociados.filter(a => {
      if (!a.data_adesao && !a.created_at) return true; // keep if no date
      const d = new Date(a.data_adesao || a.created_at!);
      return d >= limitDate;
    });

    stats.novosAssociados = associadosInPeriod.length;
    
    // Faturamento Estimado (geral de ativos)
    stats.faturamentoEstimado = allAssociados
      .filter(a => a.status === 'ativo')
      .reduce((sum, a) => sum + (a.valor_plano || 0), 0);

    // Taxa de Conversão (Ativos / Total)
    if (stats.totalAssociados > 0) {
      stats.taxaConversao = Number(((stats.associadosAtivos / stats.totalAssociados) * 100).toFixed(1));
    }


    const parcelas = await getParcelasReceber(isOnline, tenantId || '');
    const parcelasPagar = await getParcelasPagar(isOnline, tenantId || '');
    const hoje = new Date();
    
    parcelas.forEach(p => {
      const dataVenc = new Date(p.data_vencimento + 'T12:00:00');
      if (isSameMonth(dataVenc, hoje)) {
        if (p.status !== 'cancelado') {
          stats.receitaProjetadaMes += p.valor;
        }
        if (p.status === 'recebido') {
          stats.receitaArrecadadaMes += (p.valor_recebido || p.valor);
        }
      }
    });


    parcelasPagar.forEach(p => {
      const dataVenc = new Date(p.data_vencimento + 'T12:00:00');
      if (isSameMonth(dataVenc, hoje)) {
        if (p.status !== 'cancelado') {
          stats.despesaProjetadaMes += p.valor;
        }
        if (p.status === 'pago') {
          stats.despesaPagaMes += (p.valor_pago || p.valor);
        }
      }
    });

    // Calcular vidas por plano

    const vidasMap: Record<string, number> = {};
    allAssociados.forEach(a => {
       if (a.status !== 'ativo') return;
       
       let nomePlano = a.plano_nome;
       if (a.plano_pax_id) {
          const planoDb = allPlanos.find(p => p.id === a.plano_pax_id);
          if (planoDb) nomePlano = planoDb.nome;
       }
       if (!nomePlano) nomePlano = 'Sem Plano';
       
       const vidas = 1 + (a.dependentes ? a.dependentes.length : (a.n_vidas || 0));
       vidasMap[nomePlano] = (vidasMap[nomePlano] || 0) + vidas;
    });
    
    stats.vidasPorPlano = Object.keys(vidasMap)
      .map(k => ({ plano: k, vidas: vidasMap[k] }))
      .sort((a, b) => b.vidas - a.vidas);

    // Atendimentos
    let atendimentosData: any[] = [];
    if (isOnline) {
      try {
        let query = supabase.from('atendimentos').select('*').is('deleted_at', null);
        if (tenantId && tenantId !== 'all') {
           query = query.eq('tenant_id', tenantId);
        }
        const { data, error } = await query;
        if (!error && data) {
           atendimentosData = data;
           for (const item of data) {
             await saveToIDB('atendimentos', item);
           }
        }
      } catch (e) {
        console.warn('Atendimentos query failed');
        atendimentosData = await getAllFromIDB('atendimentos');
      }
    } else {
      atendimentosData = await getAllFromIDB('atendimentos');
    }
    
    if (tenantId && tenantId !== 'all') {
      atendimentosData = atendimentosData.filter(a => a.tenant_id === tenantId);
    }
    atendimentosData = atendimentosData.filter(a => !a.deleted_at && a.status !== 'cancelado');

    // Atendimentos in period
    const atendimentosInPeriod = atendimentosData.filter(a => {
      const d = new Date(a.data || a.created_at);
      return d >= limitDate;
    });
    stats.atendimentosPeriodo = atendimentosInPeriod.length;
    
    // Grafico
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let i = numMonthsChart - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth();
      const y = d.getFullYear();
      
      const total = atendimentosData.filter(a => {
          const ad = new Date(a.data || a.created_at);
          return ad.getMonth() === m && ad.getFullYear() === y;
      }).length;
      
      stats.atendimentosGrafico.push({ name: meses[m], total });

      let projetado = 0;
      let recebido = 0;
      
      parcelas.forEach(p => {
        const ad = new Date(p.data_vencimento + 'T12:00:00');
        if (ad.getMonth() === m && ad.getFullYear() === y) {
           if (p.status !== 'cancelado') projetado += p.valor;
           if (p.status === 'recebido') recebido += (p.valor_recebido || p.valor);
        }
      });
      
      stats.recebimentosGrafico.push({ name: meses[m], projetado, recebido });

      let despesas = 0;
      parcelasPagar.forEach(p => {
        const ad = new Date(p.data_vencimento + 'T12:00:00');
        if (ad.getMonth() === m && ad.getFullYear() === y) {
           if (p.status !== 'cancelado') despesas += p.valor;
        }
      });
      
      stats.financeiroGrafico.push({ name: meses[m], receitas: projetado, despesas, saldo: projetado - despesas });

    }

    // Ações recentes
    try {
      const logs = await getLogsAuditoria(isOnline, tenantId);
      stats.acoesRecentes = logs.slice(0, 4).map(log => {
        let color = 'bg-[#60A5FA]';
        if (log.acao.toLowerCase().includes('excluir')) color = 'bg-[#F43F5E]';
        else if (log.acao.toLowerCase().includes('atualizar') || log.acao.toLowerCase().includes('editar')) color = 'bg-[#F59E0B]';
        else if (log.acao.toLowerCase().includes('salvar') || log.acao.toLowerCase().includes('criar')) color = 'bg-[#10B981]';
        
        let userName = log.usuarios?.nome || 'Usuário';
        let desc = `${userName} realizou esta ação`;
        
        if (log.detalhes) {
          if (typeof log.detalhes === 'object' && log.detalhes.nome) {
            desc = `Em: ${log.detalhes.nome}`;
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
      console.warn('Falha ao carregar auditoria', e);
    }

    stats.parcelasReceberRaw = parcelas;
    stats.parcelasPagarRaw = parcelasPagar;
  } catch (error) {
    console.error('Erro ao buscar stats do dashboard', error);
  }
  return stats;
};