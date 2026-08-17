import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
}

interface ConfirmContextData {
  confirm: (options: ConfirmOptions) => void;
}

const ConfirmContext = createContext<ConfirmContextData>({} as ConfirmContextData);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      setOptions(null);
      setLoading(false);
    }, 300);
  }, []);

  const handleConfirm = async () => {
    if (!options) return;
    setLoading(true);
    try {
      await options.onConfirm();
      handleClose();
    } catch (e) {
      setLoading(false);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {isOpen && options && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-bg-base/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-sm flex flex-col border border-border-default overflow-hidden"
            >
              <div className="p-6 flex flex-col items-center text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${options.danger ? 'bg-rose-500/10 text-rose-500' : 'bg-[#3B82F6]/10 text-[#3B82F6]'}`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-text-base mb-2">{options.title}</h3>
                <p className="text-text-subtle text-sm">{options.message}</p>
              </div>
              <div className="px-6 py-4 bg-bg-surface/50 border-t border-border-default flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleClose}
                  className="px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors disabled:opacity-50"
                >
                  {options.cancelText || 'Cancelar'}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleConfirm}
                  className={`px-4 py-2 rounded-xl font-medium text-white transition-all shadow-lg disabled:opacity-50 ${options.danger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:opacity-90 shadow-[#3B82F6]/25'}`}
                >
                  {loading ? 'Aguarde...' : (options.confirmText || 'Confirmar')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => useContext(ConfirmContext);
