import React from 'react';
import { Loader2, CheckCircle2, Sparkles, Cloud } from 'lucide-react';

export interface SavingOverlayProps {
  isVisible: boolean;
  mensagem?: string;
  subMensagem?: string;
  sucesso?: boolean;
}

export const SavingOverlay: React.FC<SavingOverlayProps> = ({
  isVisible,
  mensagem = 'Salvando alterações...',
  subMensagem = 'Gravando dados com segurança e sincronizando...',
  sucesso = false,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-[#181d27] border border-[#2d3544] rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
        
        {/* Ícone com animação */}
        <div className="relative mb-5">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              sucesso
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 scale-110'
                : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
            }`}
          >
            {sucesso ? (
              <CheckCircle2 className="w-9 h-9 animate-in zoom-in-75 duration-300" />
            ) : (
              <Loader2 className="w-9 h-9 animate-spin text-blue-400" />
            )}
          </div>

          {!sucesso && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
              <Sparkles className="w-3 h-3 text-blue-300" />
            </div>
          )}
        </div>

        {/* Textos */}
        <h3 className="text-lg font-bold text-white mb-1.5 leading-tight">
          {sucesso ? 'Sucesso!' : mensagem}
        </h3>
        
        <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
          {sucesso ? 'As informações foram salvas com êxito.' : subMensagem}
        </p>

        {/* Barra de progresso indeterminada */}
        {!sucesso && (
          <div className="w-full bg-[#13171f] h-1.5 rounded-full overflow-hidden mt-6 border border-[#2d3544]">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-[shimmer_1.5s_infinite]"
              style={{
                width: '60%',
                animation: 'pulse 1.2s ease-in-out infinite alternate',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
