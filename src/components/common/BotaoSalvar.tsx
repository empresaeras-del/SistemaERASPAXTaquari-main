import React from 'react';
import { Loader2, Check, CheckCircle2, Save } from 'lucide-react';

export interface BotaoSalvarProps {
  salvando?: boolean;
  salvo?: boolean;
  texto?: string;
  textoSalvando?: string;
  textoSalvo?: string;
  icone?: React.ReactNode;
  variante?: 'primary' | 'emerald' | 'indigo' | 'gradient' | 'danger';
  tamanho?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit';
  className?: string;
  form?: string;
  fullWidth?: boolean;
}

export const BotaoSalvar: React.FC<BotaoSalvarProps> = ({
  salvando = false,
  salvo = false,
  texto = 'Salvar',
  textoSalvando = 'Salvando...',
  textoSalvo = 'Salvo!',
  icone,
  variante = 'primary',
  tamanho = 'md',
  disabled = false,
  onClick,
  type = 'submit',
  className = '',
  form,
  fullWidth = false,
}) => {
  // Tamanhos
  const tamanhoClasses = {
    sm: 'px-3.5 py-1.5 text-xs rounded-lg gap-1.5 font-medium',
    md: 'px-5 py-2.5 text-sm rounded-xl gap-2 font-semibold',
    lg: 'px-6 py-3 text-base rounded-2xl gap-2.5 font-bold',
  }[tamanho];

  // Variantes
  const varianteClasses = {
    primary:
      'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 border border-blue-400/20 active:scale-[0.98]',
    gradient:
      'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:opacity-95 text-white shadow-lg shadow-blue-500/25 border border-blue-400/20 active:scale-[0.98]',
    emerald:
      'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 border border-emerald-400/20 active:scale-[0.98]',
    indigo:
      'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/20 active:scale-[0.98]',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25 border border-rose-400/20 active:scale-[0.98]',
  }[variante];

  const iconePadrao = icone || <CheckCircle2 className="w-4 h-4" />;

  return (
    <button
      type={type}
      form={form}
      disabled={disabled || salvando}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center transition-all duration-200 overflow-hidden select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${tamanhoClasses} ${
        salvo
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
          : varianteClasses
      } ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {/* Efeito shimmer durante o salvamento */}
      {salvando && (
        <span
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_infinite]"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%)',
          }}
        />
      )}

      {/* Conteúdo Dinâmico */}
      {salvo ? (
        <>
          <Check className="w-4 h-4 animate-in zoom-in-50 duration-200" />
          <span className="animate-in fade-in slide-in-from-bottom-1 duration-200">{textoSalvo}</span>
        </>
      ) : salvando ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-white/90" />
          <span className="animate-pulse">{textoSalvando}</span>
        </>
      ) : (
        <>
          {iconePadrao}
          <span>{texto}</span>
        </>
      )}
    </button>
  );
};
