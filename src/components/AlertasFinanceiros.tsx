import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Calendar, ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useAlertasFinanceiros } from '../hooks/useAlertasFinanceiros';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const AlertasFinanceiros: React.FC = () => {
  const { alertasPagar, alertasReceber, loading } = useAlertasFinanceiros(7); // 7 dias
  const navigate = useNavigate();
  const [isPagarExpanded, setIsPagarExpanded] = React.useState(true);
  const [isReceberExpanded, setIsReceberExpanded] = React.useState(true);

  if (loading || (alertasPagar.length === 0 && alertasReceber.length === 0)) return null;

  return (
    <div className={`grid grid-cols-1 ${alertasPagar.length > 0 && alertasReceber.length > 0 ? "lg:grid-cols-2" : ""} gap-6 mb-8`}>
      {alertasPagar.length > 0 && (
        <div className="bg-bg-surface border-l-4 border-l-rose-500 border-y border-r border-border-default rounded-2xl p-4 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500 opacity-[0.02] blur-2xl rounded-full" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div 
                className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95"
                onClick={() => setIsPagarExpanded(!isPagarExpanded)}
                title={isPagarExpanded ? "Ocultar itens" : "Expandir itens"}
              >
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                <div className="bg-rose-500/10 p-2.5 rounded-xl shrink-0 text-rose-500">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="text-text-base font-bold text-base tracking-tight">Contas a Pagar</h3>
                <p className="text-rose-500/80 text-xs mt-0.5 font-medium">
                  {alertasPagar.length} {alertasPagar.length === 1 ? 'conta vence' : 'contas vencem'} nos próximos 7 dias.
                </p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/financeiro/contas-a-pagar')}
              className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 py-1.5 px-3 rounded-lg transition-all"
            >
              Ver Todas
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {isPagarExpanded && (
            <div className="space-y-2 relative z-10">
              {alertasPagar.slice(0, 3).map((conta, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                key={conta.id} 
                onClick={() => navigate('/financeiro/contas-a-pagar', { state: { openDetails: conta.id } })}
                className="flex justify-between items-center bg-bg-subtle p-3 rounded-xl border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
              >
                <div className="flex flex-col min-w-0 mr-4">
                  <span className="font-semibold text-sm text-text-base truncate" title={conta.descricao || 'Despesa/Repasse'}>{conta.descricao || 'Despesa/Repasse'}</span>
                  <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {conta.data_vencimento ? format(new Date(conta.data_vencimento), 'dd/MM/yyyy') : 'Sem data'}
                  </div>
                </div>
                <span className="font-bold text-rose-500 text-sm whitespace-nowrap">
                  {formatCurrency(conta.valor)}
                </span>
              </motion.div>
            ))}
            {alertasPagar.length > 3 && (
              <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 transition={{ delay: 0.3, duration: 0.3 }}
                 onClick={() => navigate('/financeiro/contas-a-pagar')}
                 className="flex items-center justify-center p-2 rounded-xl cursor-pointer transition-colors hover:bg-rose-500/5 group/more"
              >
                 <span className="text-text-muted group-hover/more:text-rose-500 font-semibold text-xs transition-colors">+{alertasPagar.length - 3} outras contas</span>
              </motion.div>
            )}
            </div>
          )}
        </div>
      )}

      {alertasReceber.length > 0 && (
        <div className="bg-bg-surface border-l-4 border-l-emerald-500 border-y border-r border-border-default rounded-2xl p-4 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 opacity-[0.02] blur-2xl rounded-full" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div 
                className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95"
                onClick={() => setIsReceberExpanded(!isReceberExpanded)}
                title={isReceberExpanded ? "Ocultar itens" : "Expandir itens"}
              >
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <div className="bg-emerald-500/10 p-2.5 rounded-xl shrink-0 text-emerald-500">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="text-text-base font-bold text-base tracking-tight">Contas a Receber</h3>
                <p className="text-emerald-500/80 text-xs mt-0.5 font-medium">
                  {alertasReceber.length} {alertasReceber.length === 1 ? 'conta vence' : 'contas vencem'} nos próximos 7 dias.
                </p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/financeiro/contas-a-receber')}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 py-1.5 px-3 rounded-lg transition-all"
            >
              Ver Todas
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {isReceberExpanded && (
            <div className="space-y-2 relative z-10">
              {alertasReceber.slice(0, 3).map((conta, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                key={conta.id} 
                onClick={() => navigate('/financeiro/contas-a-receber', { state: { openDetails: conta.id } })}
                className="flex justify-between items-center bg-bg-subtle p-3 rounded-xl border border-transparent hover:border-emerald-500/30 transition-colors cursor-pointer"
              >
                <div className="flex flex-col min-w-0 mr-4">
                  <span className="font-semibold text-sm text-text-base truncate" title={conta.descricao || 'Mensalidade/Receita'}>{conta.descricao || 'Mensalidade/Receita'}</span>
                  <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {conta.data_vencimento ? format(new Date(conta.data_vencimento), 'dd/MM/yyyy') : 'Sem data'}
                  </div>
                </div>
                <span className="font-bold text-emerald-500 text-sm whitespace-nowrap">
                  {formatCurrency(conta.valor)}
                </span>
              </motion.div>
            ))}
            {alertasReceber.length > 3 && (
              <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 transition={{ delay: 0.3, duration: 0.3 }}
                 onClick={() => navigate('/financeiro/contas-a-receber')}
                 className="flex items-center justify-center p-2 rounded-xl cursor-pointer transition-colors hover:bg-emerald-500/5 group/more"
              >
                 <span className="text-text-muted group-hover/more:text-emerald-500 font-semibold text-xs transition-colors">+{alertasReceber.length - 3} outras contas</span>
              </motion.div>
            )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
