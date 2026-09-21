import React from 'react';
import { Printer, Download, ArrowLeft } from 'lucide-react';

interface Props {
  onBaixarPdf: () => void;
  onVoltar: () => void;
}

/** A faixa âmbar do modo de impressão. Ela é `no-print`: some na folha de verdade. */
export const AuditoriaBannerImpressao: React.FC<Props> = ({ onBaixarPdf, onVoltar }) => (
  <div className="bg-amber-500/15 border-2 border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md no-print">
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-xl bg-amber-500 text-white font-bold">
        <Printer className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-bold text-base text-text-base">Modo de Visualização para Impressão</h3>
        <p className="text-xs text-text-subtle">
          Layout formatado para folha A4 e emissão de relatório oficial.
        </p>
      </div>
    </div>

    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onBaixarPdf}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition-all"
      >
        <Download className="w-4 h-4" />
        <span>Baixar Relatório (PDF)</span>
      </button>

      <button
        type="button"
        onClick={() => window.print()}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition-all"
      >
        <Printer className="w-4 h-4" />
        <span>Imprimir Página</span>
      </button>

      <button
        type="button"
        onClick={onVoltar}
        className="flex items-center gap-1.5 px-3.5 py-2 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl font-medium text-xs sm:text-sm shadow-sm transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar ao Sistema</span>
      </button>
    </div>
  </div>
);
