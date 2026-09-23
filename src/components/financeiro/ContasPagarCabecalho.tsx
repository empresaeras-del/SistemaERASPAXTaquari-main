import React from 'react';

import { Plus, Printer } from 'lucide-react';
import type { useContasPagar } from '../../hooks/useContasPagar';

type EstadoContasPagar = ReturnType<typeof useContasPagar>;

type Props = Pick<EstadoContasPagar, 'despesas' | 'navigate' | 'setShowRelatorioModal' | 'state'>;

/**
 * Título da tela, o botão "Exportar PDF" e o de Nova Despesa.
 *
 * Aqui o relatório é UM e o botão é direto — ao contrário de Contas a Receber, que ganhou um
 * menu de escolha quando o segundo relatório entrou. Não é assimetria a corrigir: são telas
 * com números diferentes de relatórios.
 */
export const ContasPagarCabecalho: React.FC<Props> = ({ despesas, navigate, setShowRelatorioModal, state }) => {
  return (
    <>
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 print:hidden">
      <div>
        <h1 className="text-2xl font-bold text-text-base">Contas a Pagar</h1>
        <p className="text-text-subtle mt-1">Gestão de despesas, fornecedores e vencimentos</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowRelatorioModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border-default text-text-subtle text-sm font-semibold rounded-xl hover:text-text-base hover:bg-bg-hover transition-colors"
          title="Exportar listagem para PDF"
        >
          <Printer className="w-4 h-4" />
          <span>Exportar PDF</span>
        </button>
        <button 
          type="button"
          disabled={!state.isOnline}
          onClick={() => navigate('/financeiro/contas-a-pagar/nova')} 
          title={!state.isOnline ? "Inclusão bloqueada no Modo Offline" : "Nova Despesa"}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          Nova Despesa
        </button>
      </div>
    </div>
    </>
  );
};
