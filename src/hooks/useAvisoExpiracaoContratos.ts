import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { getParcelasReceber } from '../services/financeiroService';
import { useAppContext } from '../context/AppContext';
import { isBefore, startOfDay, addDays } from 'date-fns';

export function useAvisoExpiracaoContratos(diasAviso = 15) {
  const { state } = useAppContext();
  const alerted = useRef(false);

  useEffect(() => {
    if (!state.empresaSelecionada || !state.isOnline || alerted.current) return;
    const empresaSelecionada = state.empresaSelecionada;

    const check = async () => {
      try {
        const parcelas = await getParcelasReceber(state.isOnline, empresaSelecionada);
        const today = startOfDay(new Date());
        const limit = addDays(today, diasAviso);
        
        // Group by receita_id (which represents a contract billing cycle)
        const groupedByReceita = parcelas.reduce((acc, p) => {
           if (p.tipo_devedor === 'associado') {
              if (!acc[p.receita_id]) acc[p.receita_id] = [];
              acc[p.receita_id].push(p);
           }
           return acc;
        }, {} as Record<string, typeof parcelas>);

        let expiringContractsCount = 0;
        
        for (const receitaId in groupedByReceita) {
           const ps = groupedByReceita[receitaId];
           // find the last parcela (highest date)
           ps.sort((a, b) => new Date(b.data_vencimento).getTime() - new Date(a.data_vencimento).getTime());
           const lastParcela = ps[0];
           
           if (lastParcela.status !== 'recebido' && lastParcela.status !== 'cancelado') {
              const venc = startOfDay(new Date(lastParcela.data_vencimento + 'T12:00:00'));
              // If the LAST parcela is due within the warning period, the contract cycle is expiring
              if (!isBefore(venc, today) && isBefore(venc, limit)) {
                 expiringContractsCount++;
              } else if (isBefore(venc, today) && lastParcela.status === 'pendente') {
                 // Already expired and still pending? That means it's an expired contract needing renewal
                 expiringContractsCount++;
              }
           }
        }

        if (expiringContractsCount > 0) {
           toast.error(
             `Atenção: ${expiringContractsCount} contrato(s) próximo(s) à data de vencimento!`, 
             { duration: 8000, icon: '⚠️' }
           );
           alerted.current = true;
        }
      } catch(e) {
         console.warn("Erro ao verificar expiração de contratos:", e);
      }
    };

    check();
  }, [state.empresaSelecionada, state.isOnline, diasAviso]);
}
