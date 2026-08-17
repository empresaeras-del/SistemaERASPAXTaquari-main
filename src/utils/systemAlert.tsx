import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

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
    info: <Info className="w-6 h-6" />,
    success: <CheckCircle className="w-6 h-6" />,
    warning: <AlertTriangle className="w-6 h-6" />,
    error: <XCircle className="w-6 h-6" />
  };

  const colors = {
    info: 'bg-[#3B82F6]/10 text-[#3B82F6]',
    success: 'bg-emerald-500/10 text-emerald-500',
    warning: 'bg-amber-500/10 text-amber-500',
    error: 'bg-rose-500/10 text-rose-500'
  };

  const btnColors = {
    info: 'bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:opacity-90 shadow-[#3B82F6]/25',
    success: 'bg-gradient-to-r from-emerald-500 to-emerald-400 hover:opacity-90 shadow-emerald-500/25',
    warning: 'bg-gradient-to-r from-amber-500 to-amber-400 hover:opacity-90 shadow-amber-500/25',
    error: 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
  };

  return (
    <AnimatePresence>
      {alertState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-bg-base/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-sm flex flex-col border border-border-default overflow-hidden"
          >
            <div className="p-6 flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${colors[alertState.type]}`}>
                {icons[alertState.type]}
              </div>
              <h3 className="text-xl font-bold text-text-base mb-2">{alertState.title}</h3>
              <p className="text-text-subtle text-sm">{alertState.message}</p>
            </div>
            <div className="px-6 py-4 bg-bg-surface/50 border-t border-border-default flex items-center justify-center">
              <button
                type="button"
                onClick={close}
                className={`w-full px-4 py-2 rounded-xl font-medium text-white transition-all shadow-lg ${btnColors[alertState.type]}`}
              >
                Entendi
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
