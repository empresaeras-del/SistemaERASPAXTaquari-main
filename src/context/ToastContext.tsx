import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, XCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextData {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { id, message, type, duration };
    setToasts(current => [...current, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((message: string, duration?: number) => showToast(message, 'success', duration), [showToast]);
  const error = useCallback((message: string, duration?: number) => showToast(message, 'error', duration), [showToast]);
  const info = useCallback((message: string, duration?: number) => showToast(message, 'info', duration), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="pointer-events-auto"
            >
              <ToastItem toast={toast} onDismiss={() => removeToast(toast.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const ToastItem = ({ toast, onDismiss }: { toast: Toast, onDismiss: () => void }) => {
  const { type, message } = toast;
  
  const getColors = () => {
    switch (type) {
      case 'success':
        return 'bg-bg-subtle border-emerald-500/20 text-emerald-400';
      case 'error':
        return 'bg-bg-subtle border-rose-500/20 text-rose-400';
      case 'info':
      default:
        return 'bg-bg-subtle border-[#3B82F6]/20 text-[#3B82F6]';
    }
  };

  const Icon = type === 'success' ? CheckCircle2 : type === 'error' ? XCircle : AlertCircle;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border ${getColors()} backdrop-blur-md relative overflow-hidden min-w-[300px]`}>
      <Icon className="w-5 h-5 shrink-0" />
      <p className="text-sm font-medium text-text-base flex-1">{message}</p>
      <button 
        onClick={onDismiss}
        className="p-1 text-text-subtle hover:text-text-base transition-colors rounded-full hover:bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
