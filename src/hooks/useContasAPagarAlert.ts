import { useState, useEffect } from 'react';
import { getParcelasPagar, ParcelaPagar } from '../services/financeiroService';
import { useAppContext } from '../context/AppContext';

export function useContasAPagarAlert(diasAviso = 5) {
  const { state } = useAppContext();
  const [alertas, setAlertas] = useState<ParcelaPagar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlertas = async () => {
      setLoading(true);
      try {
        const tenantId = state.empresaSelecionada || 'default_tenant';
        const parcelas = await getParcelasPagar(state.isOnline, tenantId);
        
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        const limite = new Date(hoje);
        limite.setDate(limite.getDate() + diasAviso);
        
        const parcelasProximas = parcelas.filter(p => {
          if (p.status === 'pago' || p.status === 'cancelado') return false;
          if (!p.data_vencimento) return false;
          const vencimento = new Date(p.data_vencimento);
          // Set time to 0 for fair comparison
          vencimento.setHours(0,0,0,0);
          return vencimento <= limite;
        });

        // Sort by data_vencimento (oldest first)
        parcelasProximas.sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());

        setAlertas(parcelasProximas);
      } catch (error) {
        console.error('Erro ao buscar contas a pagar para alerta:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlertas();
    
    // Check periodically, e.g., every 1 hour (3600000 ms)
    const interval = setInterval(fetchAlertas, 3600000);
    return () => clearInterval(interval);
  }, [state.isOnline, state.empresaSelecionada, diasAviso]);

  return { alertas, loading };
}
