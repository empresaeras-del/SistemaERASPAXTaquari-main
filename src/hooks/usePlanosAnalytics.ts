/**
 * usePlanosAnalytics
 *
 * Busca dados reais de desempenho por plano consultando:
 *  - Associados vinculados a cada plano (plano_pax_id)
 *  - Tabela contratos (plano_pax_id)
 *  - Parcelas recebidas (receitas com associado_plano)
 *
 * Fallback: IndexedDB local caso Supabase esteja offline.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getAllFromIDB } from '../lib/idb';
import { useAppContext } from '../context/AppContext';
import { PlanoPaxCompleto } from '../types/planosPax';
import { isSameMonth } from 'date-fns';

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface PlanoMetrica {
  plano_id: string;
  /** Contratos/associados com status ativo */
  contratos_ativos: number;
  /** Contratos/associados com status inadimplente */
  contratos_inadimplentes: number;
  /** Contratos com qualquer status (exceto excluído) */
  contratos_total: number;
  /** Total de vidas cobertas (titular + dependentes) */
  vidas_cobertas: number;
  /** Receita mensal efetiva = contratos_ativos × valor_mensalidade do plano */
  receita_mensal_efetiva: number;
  /** Receita realmente recebida no mês corrente (parcelas recebidas) */
  receita_recebida_mes: number;
  /** Receita projetada no mês corrente (parcelas pendentes + recebidas) */
  receita_projetada_mes: number;
  /** Total de receitas de mensalidades efetivamente recebidas (histórico) */
  total_recebido_historico: number;
  /** Taxa de inadimplência % */
  taxa_inadimplencia: number;
  /** Ticket médio real (media de valor_plano dos associados ativos) */
  ticket_medio_real: number;
}

export interface PlanosAnalyticsData {
  metricas: Record<string, PlanoMetrica>;
  /** Totais consolidados */
  totais: {
    contratos_ativos: number;
    contratos_inadimplentes: number;
    contratos_total: number;
    vidas_cobertas: number;
    receita_mensal_efetiva: number;
    receita_recebida_mes: number;
    receita_projetada_mes: number;
    total_recebido_historico: number;
    taxa_inadimplencia: number;
    ticket_medio_real: number;
  };
  loading: boolean;
  error: string | null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePlanosAnalytics(planos: PlanoPaxCompleto[]) {
  const { state: { isOnline, empresaSelecionada } } = useAppContext();

  const [data, setData] = useState<PlanosAnalyticsData>({
    metricas: {},
    totais: {
      contratos_ativos: 0,
      contratos_inadimplentes: 0,
      contratos_total: 0,
      vidas_cobertas: 0,
      receita_mensal_efetiva: 0,
      receita_recebida_mes: 0,
      receita_projetada_mes: 0,
      total_recebido_historico: 0,
      taxa_inadimplencia: 0,
      ticket_medio_real: 0,
    },
    loading: true,
    error: null,
  });

  const calcular = useCallback(async () => {
    if (planos.length === 0) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      // ── 1. Buscar todos associados com plano_pax_id ─────────────────────
      let allAssociados: any[] = [];

      if (isOnline) {
        try {
          let q = supabase
            .from('associados')
            .select('id, plano_pax_id, plano_id, status, valor_plano, n_vidas, dependentes')
            .is('deleted_at', null)
            .not('plano_pax_id', 'is', null);

          if (empresaSelecionada && empresaSelecionada !== 'all') {
            q = q.or(
              `tenant_id.eq.${empresaSelecionada},empresa_id.eq.${empresaSelecionada}`
            );
          }

          const { data: assocData, error: assocErr } = await q;
          if (!assocErr && assocData) {
            allAssociados = assocData;
          } else {
            throw assocErr || new Error('Supabase returned no data');
          }
        } catch {
          // Fallback IDB
          const idb = await getAllFromIDB<any>('associados');
          allAssociados = idb.filter(
            a => a && !a.deleted_at && a.plano_pax_id &&
              (!empresaSelecionada || empresaSelecionada === 'all' ||
                a.tenant_id === empresaSelecionada || a.empresa_id === empresaSelecionada)
          );
        }
      } else {
        const idb = await getAllFromIDB<any>('associados');
        allAssociados = idb.filter(
          a => a && !a.deleted_at && a.plano_pax_id &&
            (!empresaSelecionada || empresaSelecionada === 'all' ||
              a.tenant_id === empresaSelecionada || a.empresa_id === empresaSelecionada)
        );
      }

      // ── 2. Buscar contratos da tabela `contratos` (complemento) ──────────
      let allContratos: any[] = [];

      if (isOnline) {
        try {
          let q = supabase
            .from('contratos')
            .select('id, plano_pax_id, associado_id, status, valor_mensalidade')
            .is('deleted_at', null)
            .not('plano_pax_id', 'is', null);

          if (empresaSelecionada && empresaSelecionada !== 'all') {
            q = q.or(
              `tenant_id.eq.${empresaSelecionada},empresa_id.eq.${empresaSelecionada}`
            );
          }

          const { data: ctData } = await q;
          if (ctData) allContratos = ctData;
        } catch {
          const idb = await getAllFromIDB<any>('contratos');
          allContratos = idb.filter(
            c => c && !c.deleted_at && c.plano_pax_id &&
              (!empresaSelecionada || empresaSelecionada === 'all' ||
                c.tenant_id === empresaSelecionada || c.empresa_id === empresaSelecionada)
          );
        }
      } else {
        const idb = await getAllFromIDB<any>('contratos');
        allContratos = idb.filter(
          c => c && !c.deleted_at && c.plano_pax_id &&
            (!empresaSelecionada || empresaSelecionada === 'all' ||
              c.tenant_id === empresaSelecionada || c.empresa_id === empresaSelecionada)
        );
      }

      // ── 3. Buscar parcelas recebidas do mês ──────────────────────────────
      let parcelas: any[] = [];

      if (isOnline) {
        try {
          let q = supabase
            .from('parcelas_receber')
            .select('id, receita_id, status, valor, valor_recebido, data_vencimento')
            .is('deleted_at', null)
            .neq('status', 'cancelado');

          if (empresaSelecionada && empresaSelecionada !== 'all') {
            q = q.or(
              `tenant_id.eq.${empresaSelecionada},empresa_id.eq.${empresaSelecionada}`
            );
          }

          const { data: parData } = await q;
          if (parData) parcelas = parData;
        } catch {
          parcelas = await getAllFromIDB<any>('parcelas_receber');
        }
      } else {
        parcelas = await getAllFromIDB<any>('parcelas_receber');
      }

      // ── 4. Buscar receitas com associado_plano para cruzar parcelas ───────
      let receitas: any[] = [];

      if (isOnline) {
        try {
          let q = supabase
            .from('receitas')
            .select('id, associado_id, associado_plano, status')
            .is('deleted_at', null)
            .eq('tipo_devedor', 'associado');

          if (empresaSelecionada && empresaSelecionada !== 'all') {
            q = q.or(
              `tenant_id.eq.${empresaSelecionada},empresa_id.eq.${empresaSelecionada}`
            );
          }

          const { data: recData } = await q;
          if (recData) receitas = recData;
        } catch {
          receitas = await getAllFromIDB<any>('receitas');
        }
      } else {
        receitas = await getAllFromIDB<any>('receitas');
      }

      // ── 5. Montar mapa associado_id → plano_pax_id (fonte primária: associados) ──
      const assocPlanoMap = new Map<string, string>();
      allAssociados.forEach(a => {
        if (a.id && a.plano_pax_id) assocPlanoMap.set(a.id, a.plano_pax_id);
      });

      // Também indexar por contratos (complemento)
      allContratos.forEach(c => {
        if (c.associado_id && c.plano_pax_id && !assocPlanoMap.has(c.associado_id)) {
          assocPlanoMap.set(c.associado_id, c.plano_pax_id);
        }
      });

      // ── 6. Mapear receita_id → plano_pax_id via associado ────────────────
      const receitaPlanoMap = new Map<string, string>();
      receitas.forEach(r => {
        const planoId = r.associado_id ? assocPlanoMap.get(r.associado_id) : undefined;
        if (planoId && r.id) {
          receitaPlanoMap.set(r.id, planoId);
        }
      });

      // ── 7. Calcular métricas por plano ───────────────────────────────────
      const hoje = new Date();
      const metricas: Record<string, PlanoMetrica> = {};

      // Inicializar todos os planos
      planos.forEach(p => {
        metricas[p.id] = {
          plano_id: p.id,
          contratos_ativos: 0,
          contratos_inadimplentes: 0,
          contratos_total: 0,
          vidas_cobertas: 0,
          receita_mensal_efetiva: 0,
          receita_recebida_mes: 0,
          receita_projetada_mes: 0,
          total_recebido_historico: 0,
          taxa_inadimplencia: 0,
          ticket_medio_real: 0,
        };
      });

      // Acumular dados dos associados
      // Usar associados como fonte principal (mais confiável que tabela contratos)
      const sumValores: Record<string, number> = {};
      const countAtivos: Record<string, number> = {};

      allAssociados.forEach(a => {
        const planoId = a.plano_pax_id;
        if (!planoId || !metricas[planoId]) return;

        const m = metricas[planoId];
        m.contratos_total++;

        const status = (a.status || '').toLowerCase();
        if (status === 'ativo') {
          m.contratos_ativos++;
          // Vidas = titular + dependentes
          const deps = Array.isArray(a.dependentes)
            ? a.dependentes.length
            : (Number(a.n_vidas) > 0 ? Number(a.n_vidas) - 1 : 0);
          m.vidas_cobertas += 1 + deps;

          // Valor real do associado (pode diferir do plano base se houve negociação)
          const valor = Number(a.valor_plano) || 0;
          if (valor > 0) {
            sumValores[planoId] = (sumValores[planoId] || 0) + valor;
            countAtivos[planoId] = (countAtivos[planoId] || 0) + 1;
          }
        } else if (status === 'inadimplente') {
          m.contratos_inadimplentes++;
        }
      });

      // Acumular dados dos contratos (sem duplicar associados)
      const contratosAssocIds = new Set(allAssociados.map(a => a.id));
      allContratos.forEach(c => {
        // Evitar duplicação
        if (c.associado_id && contratosAssocIds.has(c.associado_id)) return;

        const planoId = c.plano_pax_id;
        if (!planoId || !metricas[planoId]) return;

        const m = metricas[planoId];
        m.contratos_total++;

        const status = (c.status || '').toLowerCase();
        if (status === 'ativo') {
          m.contratos_ativos++;
          m.vidas_cobertas += 1;
        } else if (status === 'inadimplente') {
          m.contratos_inadimplentes++;
        }
      });

      // Calcular receita mensal efetiva (contratos_ativos × mensalidade do plano)
      // e ticket médio real baseado nos valores dos associados
      planos.forEach(p => {
        const m = metricas[p.id];
        m.receita_mensal_efetiva = m.contratos_ativos * (p.valor_mensalidade || 0);

        // Ticket médio real: usa valor_plano dos associados se disponível
        const count = countAtivos[p.id] || 0;
        const sum = sumValores[p.id] || 0;
        if (count > 0 && sum > 0) {
          m.ticket_medio_real = sum / count;
        } else {
          m.ticket_medio_real = p.valor_mensalidade || 0;
        }

        // Taxa de inadimplência
        if (m.contratos_total > 0) {
          m.taxa_inadimplencia = (m.contratos_inadimplentes / m.contratos_total) * 100;
        }
      });

      // Acumular parcelas por plano
      parcelas.forEach(par => {
        if (!par || par.deleted_at) return;

        const planoId = receitaPlanoMap.get(par.receita_id);
        if (!planoId || !metricas[planoId]) return;

        const m = metricas[planoId];
        const valor = Number(par.valor) || 0;
        const valorRecebido = Number(par.valor_recebido || par.valor_pago || 0);

        // Histórico total
        if (par.status === 'recebido' || par.status === 'pago') {
          m.total_recebido_historico += valorRecebido || valor;
        }

        // Mês corrente
        try {
          const dataVenc = new Date(par.data_vencimento + 'T12:00:00');
          if (isSameMonth(dataVenc, hoje)) {
            if (par.status !== 'cancelado') {
              m.receita_projetada_mes += valor;
            }
            if (par.status === 'recebido' || par.status === 'pago') {
              m.receita_recebida_mes += valorRecebido || valor;
            }
          }
        } catch {
          // data inválida
        }
      });

      // ── 8. Consolidar totais ─────────────────────────────────────────────
      let totais = {
        contratos_ativos: 0,
        contratos_inadimplentes: 0,
        contratos_total: 0,
        vidas_cobertas: 0,
        receita_mensal_efetiva: 0,
        receita_recebida_mes: 0,
        receita_projetada_mes: 0,
        total_recebido_historico: 0,
        taxa_inadimplencia: 0,
        ticket_medio_real: 0,
      };

      let sumTicket = 0;
      let countTicket = 0;

      Object.values(metricas).forEach(m => {
        totais.contratos_ativos += m.contratos_ativos;
        totais.contratos_inadimplentes += m.contratos_inadimplentes;
        totais.contratos_total += m.contratos_total;
        totais.vidas_cobertas += m.vidas_cobertas;
        totais.receita_mensal_efetiva += m.receita_mensal_efetiva;
        totais.receita_recebida_mes += m.receita_recebida_mes;
        totais.receita_projetada_mes += m.receita_projetada_mes;
        totais.total_recebido_historico += m.total_recebido_historico;
        if (m.contratos_ativos > 0 && m.ticket_medio_real > 0) {
          sumTicket += m.ticket_medio_real * m.contratos_ativos;
          countTicket += m.contratos_ativos;
        }
      });

      if (totais.contratos_total > 0) {
        totais.taxa_inadimplencia = (totais.contratos_inadimplentes / totais.contratos_total) * 100;
      }

      if (countTicket > 0) {
        totais.ticket_medio_real = sumTicket / countTicket;
      }

      setData({ metricas, totais, loading: false, error: null });
    } catch (err: any) {
      console.error('usePlanosAnalytics error:', err);
      setData(prev => ({
        ...prev,
        loading: false,
        error: err?.message || 'Erro ao calcular métricas',
      }));
    }
  }, [planos, isOnline, empresaSelecionada]);

  useEffect(() => {
    calcular();
  }, [calcular]);

  return { ...data, recarregar: calcular };
}
