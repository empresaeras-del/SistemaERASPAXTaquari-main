import React from 'react';
import { AlertCircle, Calendar, ArrowRight } from 'lucide-react';
import { useContasAPagarAlert } from '../hooks/useContasAPagarAlert';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const ContasAPagarAlert: React.FC = () => {
  const { alertas, loading } = useContasAPagarAlert(5); // Avisar com 5 dias de antecedência
  const navigate = useNavigate();

  if (loading || alertas.length === 0) return null;

  return (
    <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-6 mb-8 shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-rose-500/20 p-3 rounded-2xl shrink-0">
            <AlertCircle className="w-7 h-7 text-rose-500" />
          </div>
          <div>
            <h3 className="text-rose-600 dark:text-rose-400 font-bold text-xl tracking-tight">Contas a Pagar com Vencimento Próximo</h3>
            <p className="text-rose-600/80 dark:text-rose-400/80 text-sm mt-1">
              Existem {alertas.length} {alertas.length === 1 ? 'conta' : 'contas'} com vencimento nos próximos 5 dias ou já em atraso.
            </p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/financeiro')}
          className="flex items-center gap-2 text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white py-2.5 px-6 rounded-xl transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap shadow-lg shadow-rose-500/25"
        >
          Acessar Financeiro
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alertas.slice(0, 3).map(conta => (
          <div key={conta.id} className="flex flex-col bg-bg-surface p-4 rounded-2xl border border-border-default hover:border-rose-500/30 transition-colors shadow-sm">
            <span className="font-bold text-text-base truncate mb-3" title={conta.descricao || 'Despesa/Repasse'}>{conta.descricao || 'Despesa/Repasse'}</span>
            <div className="flex justify-between items-end mt-auto">
              <div className="flex items-center gap-2 text-xs text-rose-500 font-bold bg-rose-500/10 px-2.5 py-1.5 rounded-lg">
                <Calendar className="w-4 h-4" />
                {conta.data_vencimento ? format(new Date(conta.data_vencimento), 'dd/MM/yyyy') : 'Sem data'}
              </div>
              <span className="font-black text-text-base text-lg">
                {formatCurrency(conta.valor)}
              </span>
            </div>
          </div>
        ))}
        {alertas.length > 3 && (
          <div 
             onClick={() => navigate('/financeiro')}
             className="flex flex-col items-center justify-center bg-rose-500/5 hover:bg-rose-500/10 p-4 rounded-2xl border border-dashed border-rose-500/30 cursor-pointer transition-colors min-h-[100px]"
          >
             <span className="text-rose-500 font-black text-2xl">+{alertas.length - 3}</span>
             <span className="text-rose-500/80 text-sm font-bold mt-1 uppercase tracking-wider">Outras Contas</span>
          </div>
        )}
      </div>
    </div>
  );
};
