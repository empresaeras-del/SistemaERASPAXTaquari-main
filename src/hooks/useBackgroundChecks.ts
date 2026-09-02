import { useEffect } from 'react';
import { getParcelasReceber } from '../services/financeiroService';
import { getAssociados, saveAssociado } from '../services/associadosService';
import { useAppContext } from '../context/AppContext';
import { isBefore, startOfDay } from 'date-fns';

export function useBackgroundChecks() {
  const { state } = useAppContext();
  
  useEffect(() => {
    if (!state.empresaSelecionada || !state.isOnline) return;
    const empresaSelecionada = state.empresaSelecionada;

    const isMounted = true;

    const runChecks = async () => {
      try {
        const associados = await getAssociados(state.isOnline, empresaSelecionada);
        const parcelas = await getParcelasReceber(state.isOnline, empresaSelecionada);
        
        const today = startOfDay(new Date());
        const overdueMap: Record<string, number> = {};
        
        parcelas.forEach(p => {
          if (p.tipo_devedor === 'associado' && (p.status === 'pendente' || p.status === 'vencido')) {
            const vencimento = startOfDay(new Date(p.data_vencimento + 'T12:00:00'));
            if (isBefore(vencimento, today)) {
              const cpf = p.devedor_cpf_cnpj;
              if (cpf) {
                overdueMap[cpf] = (overdueMap[cpf] || 0) + 1;
              }
            }
          }
        });
        
        for (const associado of associados) {
          if (associado.status === 'ativo' && associado.cpf && overdueMap[associado.cpf] > 2) {
            // Update to Suspended ('inadimplente')
            console.log(`Associado ${associado.nome} suspenso por inadimplência (mais de 2 parcelas vencidas).`);
            await saveAssociado({
              ...associado,
              status: 'inadimplente'
            }, state.isOnline);
          }
        }
      } catch (err) {
        console.warn("Failed to run background checks:", err);
      }
    };
    
    runChecks();
    
    // Podia ter um setInterval mas um check no load da app já resolve.
    
  }, [state.empresaSelecionada, state.isOnline]);
}
