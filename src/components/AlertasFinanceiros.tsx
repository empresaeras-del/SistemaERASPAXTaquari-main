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

  if (loading || (alertasPagar.length === 0 && alertasReceber.length === 0)) return null;

  return (
    <div className={`grid grid-cols-1 ${alertasPagar.length > 0 && alertasReceber.length > 0 ? "lg:grid-cols-2" : ""} gap-6 mb-8`}>
      {alertasPagar.length > 0 && (
        <div className="bg-bg-subtle border border-rose-500/30 rounded-3xl p-6 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500 opacity-[0.03] blur-3xl rounded-full" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl shrink-0 text-rose-500">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-text-base font-bold text-xl tracking-tight">Contas a Pagar</h3>
                <p className="text-rose-500 text-sm mt-0.5 font-bold">
                  {alertasPagar.length} {alertasPagar.length === 1 ? 'conta vence' : 'contas vencem'} nos próximos 7 dias.
                </p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/financeiro/contas-a-pagar')}
              className="flex items-center gap-2 text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white py-2 px-4 rounded-xl transition-all shadow-lg shadow-rose-500/20"
            >
              Ver Todas
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 relative z-10">
            {alertasPagar.slice(0, 3).map((conta, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                key={conta.id} 
                onClick={() => navigate('/financeiro/contas-a-pagar', { state: { openDetails: conta.id } })}
                className="flex justify-between items-center bg-bg-surface p-4 rounded-2xl border border-border-default hover:border-rose-500/50 transition-colors shadow-sm cursor-pointer"
              >
                <div className="flex flex-col min-w-0 mr-4">
                  <span className="font-bold text-text-base truncate" title={conta.descricao || 'Despesa/Repasse'}>{conta.descricao || 'Despesa/Repasse'}</span>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {conta.data_vencimento ? format(new Date(conta.data_vencimento), 'dd/MM/yyyy') : 'Sem data'}
                  </div>
                </div>
                <span className="font-black text-rose-500 text-lg whitespace-nowrap">
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
                 className="flex items-center justify-center bg-bg-surface hover:bg-rose-500/5 p-3 rounded-2xl border border-dashed border-rose-500/30 cursor-pointer transition-colors"
              >
                 <span className="text-text-muted hover:text-rose-500 font-bold text-sm transition-colors uppercase tracking-wider">+{alertasPagar.length - 3} outras contas</span>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {alertasReceber.length > 0 && (
        <div className="bg-bg-subtle border border-emerald-500/30 rounded-3xl p-6 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-[0.03] blur-3xl rounded-full" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl shrink-0 text-emerald-500">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-text-base font-bold text-xl tracking-tight">Contas a Receber</h3>
                <p className="text-emerald-500 text-sm mt-0.5 font-bold">
                  {alertasReceber.length} {alertasReceber.length === 1 ? 'conta vence' : 'contas vencem'} nos próximos 7 dias.
                </p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/financeiro/contas-a-receber')}
              className="flex items-center gap-2 text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
            >
              Ver Todas
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 relative z-10">
            {alertasReceber.slice(0, 3).map((conta, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                key={conta.id} 
                onClick={() => navigate('/financeiro/contas-a-receber', { state: { openDetails: conta.id } })}
                className="flex justify-between items-center bg-bg-surface p-4 rounded-2xl border border-border-default hover:border-emerald-500/50 transition-colors shadow-sm cursor-pointer"
              >
                <div className="flex flex-col min-w-0 mr-4">
                  <span className="font-bold text-text-base truncate" title={conta.descricao || 'Mensalidade/Receita'}>{conta.descricao || 'Mensalidade/Receita'}</span>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {conta.data_vencimento ? format(new Date(conta.data_vencimento), 'dd/MM/yyyy') : 'Sem data'}
                  </div>
                </div>
                <span className="font-black text-emerald-500 text-lg whitespace-nowrap">
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
                 className="flex items-center justify-center bg-bg-surface hover:bg-emerald-500/5 p-3 rounded-2xl border border-dashed border-emerald-500/30 cursor-pointer transition-colors"
              >
                 <span className="text-text-muted hover:text-emerald-500 font-bold text-sm transition-colors uppercase tracking-wider">+{alertasReceber.length - 3} outras contas</span>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
