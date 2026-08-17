import React, { ReactNode } from 'react';
import { Printer, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  onPrint?: () => void;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  title = 'Pré-visualização de Impressão',
  children,
  onPrint
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex bg-[#323639] print:bg-white">
        {/* Top Bar - Hidden on print */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-[#202124] border-b border-[#404040] flex items-center justify-between px-6 z-10 print:hidden shadow-md">
          <div className="flex items-center gap-4">
            <h2 className="text-white font-medium">{title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl transition-all font-bold text-sm"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 w-full pt-16 overflow-y-auto custom-scrollbar flex justify-center pb-20 print:p-0 print:overflow-visible">
          <div className="mt-8 mb-8 print:m-0 print:w-full">
            <div className="a4-simulated shadow-2xl relative print:shadow-none bg-white text-black">
              {children}
            </div>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
};
