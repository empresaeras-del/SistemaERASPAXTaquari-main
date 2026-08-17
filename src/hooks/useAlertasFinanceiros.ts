import { useState, useEffect } from 'react';
import { getParcelasPagar, ParcelaPagar, getParcelasReceber, ParcelaReceber } from '../services/financeiroService';
import { useAppContext } from '../context/AppContext';

export function useAlertasFinanceiros(diasAviso = 7) {
  const { state } = useAppContext();
  const [alertasPagar, setAlertasPagar] = useState<ParcelaPagar[]>([]);
  const [alertasReceber, setAlertasReceber] = useState<ParcelaReceber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlertas = async () => {
      setLoading(true);
      try {
        const tenantId = state.empresaSelecionada || 'default_tenant';
        
        const [parcelasPagar, parcelasReceber] = await Promise.all([
          getParcelasPagar(state.isOnline, tenantId),
          getParcelasReceber(state.isOnline, tenantId)
        ]);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const limite = new Date(hoje);
        limite.setDate(limite.getDate() + diasAviso);

        const pagarProximas = parcelasPagar.filter(p => {
          if (p.status === 'pago' || p.status === 'cancelado') return false;
          if (!p.data_vencimento) return false;
          const venc = new Date(p.data_vencimento);
          venc.setHours(0,0,0,0);
          return venc <= limite;
        }).sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());

        const receberProximas = parcelasReceber.filter(p => {
          if (p.status === 'recebido' || p.status === 'cancelado') return false;
          if (!p.data_vencimento) return false;
          const venc = new Date(p.data_vencimento);
          venc.setHours(0,0,0,0);
          return venc <= limite;
        }).sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());

        setAlertasPagar(pagarProximas);
        setAlertasReceber(receberProximas);
      } catch (error) {
        console.error('Erro ao buscar alertas financeiros:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlertas();
    const interval = setInterval(fetchAlertas, 3600000);
    return () => clearInterval(interval);
  }, [state.isOnline, state.empresaSelecionada, diasAviso]);

  return { alertasPagar, alertasReceber, loading };
}
