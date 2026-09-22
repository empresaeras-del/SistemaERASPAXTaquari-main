import React from 'react';
import { CheckCircle2, Layers, Search, X } from 'lucide-react';

interface Props {
  documento: any;
  placeholderValues: any;
  preenchidasVars: any;
  searchVar: any;
  setPlaceholderValues: (atualizar: (anterior: any) => any) => void;
  setSearchVar: any;
  totalVars: any;
  variaveisDoDocumento: any[];
}

export const VisualizadorDocumentoVariaveis: React.FC<Props> = ({ placeholderValues, preenchidasVars, searchVar, setPlaceholderValues, setSearchVar, totalVars, variaveisDoDocumento }) => {
  return (
    <>
    {/* Divisor */}
    <div className="border-t border-[#2d3544] pt-2">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          Variáveis do Documento
        </h4>
        <span className="text-[10px] font-mono text-slate-400">
          {preenchidasVars} de {totalVars} preenchidas
        </span>
      </div>
    </div>

    {/* Busca de Variáveis */}
    {variaveisDoDocumento.length > 4 && (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          value={searchVar}
          onChange={(e) => setSearchVar(e.target.value)}
          placeholder="Filtrar variáveis..."
          className="w-full pl-8 pr-7 py-1.5 bg-[#181d27] border border-[#2d3544] rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
        {searchVar && (
          <button
            type="button"
            onClick={() => setSearchVar('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    )}

    {/* Campos de Inserção Manual/Ajuste de Variáveis */}
    <div className="space-y-3 pt-1">
      {variaveisDoDocumento.length > 0 ? (
        variaveisDoDocumento.map((variable) => {
          const isFilled = Boolean(
            placeholderValues[variable] && placeholderValues[variable].trim(),
          );
          const labelFriendly = variable.replace(/[{}]/g, '').replace(/_/g, ' ');

          return (
            <div
              key={variable}
              className="bg-[#181d27] p-3 rounded-xl border border-[#2d3544] space-y-1.5 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <label
                  className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate"
                  title={variable}
                >
                  {labelFriendly}
                </label>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                    isFilled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {isFilled ? 'OK' : 'PENDENTE'}
                </span>
              </div>
              <p className="text-[10px] font-mono text-blue-400/80 truncate">
                {variable}
              </p>

              {variable === '{{associado_dependentes}}' ||
              variable.includes('conteudo') ||
              variable.includes('texto') ? (
                <textarea
                  rows={3}
                  value={placeholderValues[variable] || ''}
                  onChange={(e) =>
                    setPlaceholderValues((prev) => ({
                      ...prev,
                      [variable]: e.target.value,
                    }))
                  }
                  placeholder="Digite o valor..."
                  className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 outline-none transition-colors resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={placeholderValues[variable] || ''}
                  onChange={(e) =>
                    setPlaceholderValues((prev) => ({
                      ...prev,
                      [variable]: e.target.value,
                    }))
                  }
                  placeholder="Digite o valor..."
                  className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 outline-none transition-colors"
                />
              )}
            </div>
          );
        })
      ) : (
        <div className="text-center py-8 bg-[#181d27] rounded-xl border border-[#2d3544] p-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
          <p className="text-xs text-slate-300 font-semibold">
            Nenhuma variável dinâmica
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Este documento não possui tags de substituição identificadas.
          </p>
        </div>
      )}
    </div>
    </>
  );
};
