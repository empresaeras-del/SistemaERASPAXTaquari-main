import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-react';

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
  type: AlertType;
}

let emitAlert: (title: string, message: string, type?: AlertType) => void = () => {};

export const systemAlert = (title: string, message: string, type: AlertType = 'warning') => {
  emitAlert(title, message, type);
};

export const SystemAlertProvider: React.FC = () => {
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning'
  });

  useEffect(() => {
    emitAlert = (title, message, type = 'warning') => {
      setAlertState({ isOpen: true, title, message, type });
    };
  }, []);

  const close = () => setAlertState(prev => ({ ...prev, isOpen: false }));

  const icons = {
    info: <Info className="w-7 h-7" />,
    success: <CheckCircle className="w-7 h-7" />,
    warning: <AlertTriangle className="w-7 h-7" />,
    error: <XCircle className="w-7 h-7" />
  };

  const colors = {
    info: 'bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30',
    success: 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-500 border border-amber-500/30',
    error: 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
  };

  const btnColors = {
    info: 'bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:opacity-90 shadow-[#3B82F6]/25',
    success: 'bg-gradient-to-r from-emerald-500 to-emerald-400 hover:opacity-90 shadow-emerald-500/25',
    warning: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90 shadow-amber-500/25',
    error: 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
  };

  return (
    <AnimatePresence>
      {alertState.isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#0A0C16]/80 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ duration: 0.2 }}
            className="bg-[#181B34] rounded-3xl shadow-2xl w-full max-w-md flex flex-col border border-[#262A45] overflow-hidden relative"
          >
            {/* Botão de Fechar no Topo */}
            <button
              onClick={close}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 pt-8 flex flex-col items-center text-center">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${colors[alertState.type]}`}>
                {icons[alertState.type]}
              </div>
              <h3 className="text-xl font-bold text-white mb-2.5 tracking-tight">
                {alertState.title}
              </h3>
              <div className="bg-[#101223] border border-[#262A45] rounded-2xl p-4 text-slate-300 text-sm leading-relaxed text-left w-full">
                {alertState.message}
              </div>
            </div>

            <div className="px-6 py-4 bg-[#101223]/50 border-t border-[#262A45] flex items-center justify-end gap-3 rounded-b-3xl">
              <button
                type="button"
                onClick={close}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-white transition-all text-sm shadow-md ${btnColors[alertState.type]}`}
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
