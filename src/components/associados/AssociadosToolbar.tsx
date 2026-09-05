import React from 'react';
import { Users, Printer, Plus } from 'lucide-react';

interface AssociadosToolbarProps {
  handleExportPDF: () => void;
  handleOpenModal: () => void;
  isOnline: boolean;
}

export const AssociadosToolbar: React.FC<AssociadosToolbarProps> = ({
  handleExportPDF,
  handleOpenModal,
  isOnline
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-xs text-text-subtle mb-1">
          <span>Administração</span>
          <span className="w-1 h-1 rounded-full bg-border-default"></span>
          <span>Associados</span>
        </div>
        <h1 className="text-2xl font-bold text-text-base flex items-center gap-2">
          <Users className="w-6 h-6 text-[#3B82F6]" />
          Gestão de Associados
        </h1>
        <p className="text-sm text-text-subtle mt-1">
          Gerenciamento de titulares e dependentes.
        </p>
      </div>
      
      <div className="flex items-center gap-3">
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-4 py-2.5 bg-bg-surface border border-border-default text-text-subtle text-sm font-semibold rounded-xl hover:text-text-base hover:bg-bg-hover transition-colors"
          title="Gerar relatório em PDF"
        >
          <Printer className="w-4 h-4" />
          <span>Gerar Relatório</span>
        </button>
        <button
          disabled={!isOnline}
          onClick={() => handleOpenModal()}
          title={!isOnline ? "Inclusão bloqueada no Modo Offline" : "Novo Associado"}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(59,130,246,0.25)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Associado
        </button>
      </div>
    </div>
  );
};
