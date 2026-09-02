import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingDown, TrendingUp, Calendar, ArrowRight,
  ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react';
import { useAlertasFinanceiros } from '../../hooks/useAlertasFinanceiros';
import { formatLocalDate } from '../../utils/dateUtils';
import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { getFromIDB, saveToIDB } from '../../lib/idb';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface AlertasPanelProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export const AlertasPanel: React.FC<AlertasPanelProps> = ({ isCollapsed, onToggle }) => {
  const { state } = useAppContext();
  const { alertasPagar, alertasReceber, loading } = useAlertasFinanceiros(7);
  const navigate = useNavigate();
  const [isPagarExpanded, setIsPagarExpanded] = useState(true);
  const [isReceberExpanded, setIsReceberExpanded] = useState(true);

  const isAuthorized =
    state.user?.nivel === 'super_admin' || state.user?.nivel === 'admin';

  const hasAlerts = alertasPagar.length > 0 || alertasReceber.length > 0;

  if (loading || !isAuthorized || !hasAlerts) return null;

  const totalPagar = alertasPagar.length;
  const totalReceber = alertasReceber.length;

  return (
    <aside
      className={`
        hidden lg:flex flex-col h-full
        bg-bg-surface border-l border-border-default
        transition-all duration-300 ease-in-out shrink-0
        ${isCollapsed ? 'w-[52px]' : 'w-72'}
      `}
    >
      {/* Header / Toggle */}
      <div
        className={`h-16 flex items-center border-b border-border-default shrink-0 relative
          ${isCollapsed ? 'justify-center' : 'justify-between px-4'}
        `}
      >
        {!isCollapsed && (
          <span className="text-xs font-bold text-text-subtle uppercase tracking-widest select-none">
            Alertas Financeiros
          </span>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg bg-bg-hover hover:bg-bg-subtle text-text-subtle hover:text-text-base transition-colors shrink-0"
          title={isCollapsed ? 'Expandir alertas' : 'Recolher alertas'}
        >
          {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Collapsed view — icon badges only */}
      {isCollapsed && (
        <div className="flex flex-col items-center gap-3 py-4">
          {totalPagar > 0 && (
            <button
              onClick={onToggle}
              title={`${totalPagar} conta(s) a pagar vencendo`}
              className="relative p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
            >
              <TrendingDown className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {totalPagar}
              </span>
            </button>
          )}
          {totalReceber > 0 && (
            <button
              onClick={onToggle}
              title={`${totalReceber} conta(s) a receber vencendo`}
              className="relative p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
            >
              <TrendingUp className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {totalReceber}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Expanded view */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-4 px-3 space-y-4">

          {/* — Contas a Pagar — */}
          {totalPagar > 0 && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 overflow-hidden">
              {/* Section header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-rose-500/10">
                <button
                  onClick={() => setIsPagarExpanded(v => !v)}
                  className="flex items-center gap-2 group/hdr"
                  title={isPagarExpanded ? 'Ocultar itens' : 'Expandir itens'}
                >
                  <div className="relative">
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
                    <div className="bg-rose-500/15 p-1.5 rounded-lg text-rose-500">
                      <TrendingDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-text-base leading-none">Contas a Pagar</p>
                    <p className="text-[10px] text-rose-400/80 mt-0.5 font-medium">
                      {totalPagar} {totalPagar === 1 ? 'vence' : 'vencem'} em 7 dias
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-text-subtle ml-1 transition-transform duration-200 ${isPagarExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                <button
                  onClick={() => navigate('/financeiro/contas-a-pagar')}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-400 flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all shrink-0"
                >
                  Ver <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <AnimatePresence initial={false}>
                {isPagarExpanded && (
                  <motion.div
                    key="pagar-list"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-2 py-2 space-y-1.5">
                      {alertasPagar.slice(0, 5).map((conta, i) => (
                        <motion.div
                          key={conta.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() =>
                            navigate('/financeiro/contas-a-pagar', {
                              state: { openDetails: conta.id },
                            })
                          }
                          className="flex items-center justify-between p-2 rounded-xl bg-bg-surface hover:bg-bg-subtle border border-transparent hover:border-rose-500/25 transition-all cursor-pointer group/item"
                        >
                          <div className="flex flex-col min-w-0 flex-1 mr-2">
                            <span
                              className="text-[11px] font-semibold text-text-base truncate leading-tight"
                              title={conta.descricao || 'Despesa/Repasse'}
                            >
                              {conta.descricao || 'Despesa/Repasse'}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-text-muted mt-0.5">
                              <Calendar className="w-2.5 h-2.5 shrink-0" />
                              {conta.data_vencimento
                                ? formatLocalDate(conta.data_vencimento)
                                : 'Sem data'}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-rose-500 whitespace-nowrap shrink-0">
                            {formatCurrency(conta.valor)}
                          </span>
                        </motion.div>
                      ))}
                      {totalPagar > 5 && (
                        <button
                          onClick={() => navigate('/financeiro/contas-a-pagar')}
                          className="w-full text-center text-[10px] font-semibold text-text-muted hover:text-rose-500 py-1.5 rounded-lg hover:bg-rose-500/5 transition-colors"
                        >
                          +{totalPagar - 5} outras contas
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* — Contas a Receber — */}
          {totalReceber > 0 && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
              {/* Section header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-emerald-500/10">
                <button
                  onClick={() => setIsReceberExpanded(v => !v)}
                  className="flex items-center gap-2 group/hdr"
                  title={isReceberExpanded ? 'Ocultar itens' : 'Expandir itens'}
                >
                  <div className="relative">
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                    <div className="bg-emerald-500/15 p-1.5 rounded-lg text-emerald-500">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-text-base leading-none">Contas a Receber</p>
                    <p className="text-[10px] text-emerald-400/80 mt-0.5 font-medium">
                      {totalReceber} {totalReceber === 1 ? 'vence' : 'vencem'} em 7 dias
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-text-subtle ml-1 transition-transform duration-200 ${isReceberExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                <button
                  onClick={() => navigate('/financeiro/contas-a-receber')}
                  className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-all shrink-0"
                >
                  Ver <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <AnimatePresence initial={false}>
                {isReceberExpanded && (
                  <motion.div
                    key="receber-list"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-2 py-2 space-y-1.5">
                      {alertasReceber.slice(0, 5).map((conta, i) => (
                        <motion.div
                          key={conta.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() =>
                            navigate('/financeiro/contas-a-receber', {
                              state: { openDetails: conta.id },
                            })
                          }
                          className="flex items-center justify-between p-2 rounded-xl bg-bg-surface hover:bg-bg-subtle border border-transparent hover:border-emerald-500/25 transition-all cursor-pointer group/item"
                        >
                          <div className="flex flex-col min-w-0 flex-1 mr-2">
                            <span
                              className="text-[11px] font-semibold text-text-base truncate leading-tight"
                              title={conta.descricao || 'Mensalidade/Receita'}
                            >
                              {conta.descricao || 'Mensalidade/Receita'}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-text-muted mt-0.5">
                              <Calendar className="w-2.5 h-2.5 shrink-0" />
                              {conta.data_vencimento
                                ? formatLocalDate(conta.data_vencimento)
                                : 'Sem data'}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-500 whitespace-nowrap shrink-0">
                            {formatCurrency(conta.valor)}
                          </span>
                        </motion.div>
                      ))}
                      {totalReceber > 5 && (
                        <button
                          onClick={() => navigate('/financeiro/contas-a-receber')}
                          className="w-full text-center text-[10px] font-semibold text-text-muted hover:text-emerald-500 py-1.5 rounded-lg hover:bg-emerald-500/5 transition-colors"
                        >
                          +{totalReceber - 5} outras contas
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Footer spacer */}
      <div className="h-4 shrink-0" />
    </aside>
  );
};
