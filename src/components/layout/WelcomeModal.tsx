import React, { useState, useEffect } from 'react';
import { X, Layers, TrendingUp, TrendingDown, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../../context/AppContext';
import { getLoteAbertoAtivo } from '../../services/caixasService';
import { getParcelasReceber, getParcelasPagar } from '../../services/financeiroService';
import { format, isToday } from 'date-fns';

export const WelcomeModal = () => {
  const { state } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [caixaStatus, setCaixaStatus] = useState<any>(null);
  const [receberHoje, setReceberHoje] = useState<any[]>([]);
  const [pagarHoje, setPagarHoje] = useState<any[]>([]);
  
  
  const loadData = async () => {
    if (!state.empresaSelecionada || !state.user) return;
    setLoading(true);
    try {
      const lote = await getLoteAbertoAtivo(state.isOnline, state.empresaSelecionada);
      setCaixaStatus(lote);
      
      const parcelasReceber = await getParcelasReceber(state.isOnline, state.empresaSelecionada);
      const parcelasPagar = await getParcelasPagar(state.isOnline, state.empresaSelecionada);
      
      const hojeReceber = parcelasReceber.filter(p => p.status === 'pendente' && p.data_vencimento && isToday(new Date(p.data_vencimento + 'T12:00:00')));
      const hojePagar = parcelasPagar.filter(p => p.status === 'pendente' && p.data_vencimento && isToday(new Date(p.data_vencimento + 'T12:00:00')));
      
      setReceberHoje(hojeReceber);
      setPagarHoje(hojePagar);
    } catch (error) {
      console.error("Erro ao carregar dados do welcome modal:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hasSeen = sessionStorage.getItem('has_seen_welcome_modal');
    if (!hasSeen && state.empresaSelecionada && state.user) {
      loadData().then(() => {
        setIsOpen(true);
        sessionStorage.setItem('has_seen_welcome_modal', 'true');
      });
    }
  }, [state.empresaSelecionada, state.isOnline, state.user]);

  useEffect(() => {
    const handleOpen = () => {
      loadData().then(() => setIsOpen(true));
    };
    window.addEventListener('open-welcome-modal', handleOpen);
    return () => window.removeEventListener('open-welcome-modal', handleOpen);
  }, [state.empresaSelecionada, state.isOnline, state.user]);


  const activeCompany = null as any;
  const logoUrl = activeCompany?.logo_url;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-bg-base rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-border-default z-10"
        >
          {/* Header Image/Logo */}
          <div className="bg-bg-subtle p-8 flex flex-col items-center justify-center border-b border-border-default relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/10 to-transparent" />
            
            {logoUrl ? (
              <img src={logoUrl} alt="Logo da Empresa" className="h-20 object-contain z-10 mb-4 drop-shadow-md" />
            ) : (
              <div className="w-20 h-20 bg-bg-hover rounded-2xl flex items-center justify-center mb-4 z-10 shadow-lg border border-border-default">
                <ShieldCheck className="w-10 h-10 text-[#3B82F6]" />
              </div>
            )}
            
            <h2 className="text-2xl font-bold text-text-base z-10 text-center">
              Bem-vindo(a), {state.user?.nome?.split(' ')[0] || 'Usuário'}!
            </h2>
            <p className="text-text-subtle text-sm text-center z-10 mt-1">
              Resumo diário da sua operação ({format(new Date(), 'dd/MM/yyyy')})
            </p>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
            
            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-[#3B82F6] border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Caixa Status */}
                <div className={`p-5 rounded-2xl border ${caixaStatus ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'} flex flex-col`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-xl ${caixaStatus ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                      <Layers className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-text-base">Situação do Caixa</h3>
                  </div>
                  <div className="mt-auto">
                    {caixaStatus ? (
                      <div>
                        <p className="text-emerald-400 font-bold text-lg mb-1">Caixa Aberto</p>
                        <p className="text-xs text-text-subtle">Terminal: {caixaStatus.terminal_caixa}</p>
                        <p className="text-xs text-text-subtle mt-0.5">Aberto às: {format(new Date(caixaStatus.data_abertura), 'HH:mm')}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-amber-500 font-bold text-lg mb-1">Caixa Fechado</p>
                        <p className="text-xs text-text-subtle text-justify">Não há um lote em aberto. Você precisará abrir um caixa para registrar novas movimentações hoje.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Receber Hoje */}
                <div className="p-5 rounded-2xl bg-bg-surface border border-border-default flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-[#3B82F6]/10 text-[#3B82F6]">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-text-base">Contas a Receber</h3>
                  </div>
                  <div className="mt-auto">
                    <p className="text-2xl font-bold text-text-base mb-1">
                      {receberHoje.length} <span className="text-sm font-normal text-text-subtle">vencendo hoje</span>
                    </p>
                    <p className="text-sm text-emerald-400 font-medium mt-1">
                      R$ {receberHoje.reduce((acc, curr) => acc + curr.valor, 0).toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>

                {/* Pagar Hoje */}
                <div className="p-5 rounded-2xl bg-bg-surface border border-border-default flex flex-col md:col-span-2">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-text-base">Contas a Pagar (Hoje)</h3>
                  </div>
                  <div className="mt-auto flex justify-between items-end">
                    <div>
                      <p className="text-2xl font-bold text-text-base mb-1">
                        {pagarHoje.length} <span className="text-sm font-normal text-text-subtle">títulos para pagamento</span>
                      </p>
                    </div>
                    <p className="text-lg text-rose-500 font-medium">
                      R$ {pagarHoje.reduce((acc, curr) => acc + curr.valor, 0).toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border-default flex justify-end bg-bg-base shrink-0">
            <button 
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl font-medium shadow-lg hover:opacity-90 transition-opacity"
            >
              Iniciar Operação
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
