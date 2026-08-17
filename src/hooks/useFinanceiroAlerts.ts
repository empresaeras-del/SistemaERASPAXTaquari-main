import { useState, useEffect } from 'react';
import { getParcelasReceber, getParcelasPagar } from '../services/financeiroService';
import { useAppContext } from '../context/AppContext';

export const useFinanceiroAlerts = () => {
  const { state } = useAppContext();
  const [alertasReceber, setAlertasReceber] = useState(0);
  const [alertasPagar, setAlertasPagar] = useState(0);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const tenantId = state.empresaSelecionada || 'all';
        const [receber, pagar] = await Promise.all([
          getParcelasReceber(state.isOnline, tenantId),
          getParcelasPagar(state.isOnline, tenantId)
        ]);

        const now = new Date();
        const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        const countReceber = receber.filter(p => {
          if (p.status === 'recebido' || p.status === 'cancelado') return false;
          const venc = new Date(p.data_vencimento + 'T12:00:00');
          return venc >= now && venc <= in48Hours;
        }).length;

        const countPagar = pagar.filter(p => {
          if (p.status === 'pago' || p.status === 'cancelado') return false;
          const venc = new Date(p.data_vencimento + 'T12:00:00');
          return venc >= now && venc <= in48Hours;
        }).length;

        setAlertasReceber(countReceber);
        setAlertasPagar(countPagar);
      } catch (err) {
        console.error('Erro ao buscar alertas financeiros:', err);
      }
    };

    fetchAlerts();
    
    // Set up polling every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.isOnline, state.empresaSelecionada]);

  return { alertasReceber, alertasPagar };
};
