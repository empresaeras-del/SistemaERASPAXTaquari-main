import React from 'react';
import { AlertTriangle, Save, Sparkles, AlertCircle } from 'lucide-react';

export interface AlertaAlteracoesPendentesProps {
  /**
   * Define se o alerta deve ser exibido (quando existem alterações não salvas)
   */
  visivel: boolean;
  /**
   * Título do alerta (Padrão: "Alterações Pendentes de Salvamento")
   */
  titulo?: string;
  /**
   * Mensagem descritiva do alerta
   */
  mensagem?: string;
  /**
   * Callback para acionar o salvamento direto a partir do alerta
   */
  onSalvar?: () => void | Promise<void>;
  /**
   * Estado de salvamento em andamento
   */
  salvando?: boolean;
  /**
   * ID do formulário HTML caso queira associar o botão do alerta via atributo form="id"
   */
  formId?: string;
  /**
   * Posição ou estilo de exibição:
   * - 'inline': banner expansivo com destaque no corpo do formulário
   * - 'compact': barra fina e elegante para cabeçalhos ou rodapés
   * - 'floating': barra flutuante destacada com sombra profunda
   */
  posicao?: 'inline' | 'compact' | 'floating';
  /**
   * Texto do botão de salvar
   */
  textoBotao?: string;
  /**
   * Classe CSS personalizada adicional
   */
  className?: string;
  /**
   * Variante de cor (Padrão: 'amber')
   */
  variante?: 'amber' | 'blue' | 'indigo';
}

export const AlertaAlteracoesPendentes: React.FC<AlertaAlteracoesPendentesProps> = ({
  visivel,
  titulo = 'Alterações Pendentes de Salvamento',
  mensagem = 'Existem dados modificados neste formulário que ainda não foram gravados no banco de dados. Salve para registrar as alterações.',
  onSalvar,
  salvando = false,
  formId,
  posicao = 'inline',
  textoBotao = 'Salvar Agora',
  className = '',
  variante = 'amber'
}) => {
  if (!visivel) return null;

  const variantesEstilos = {
    amber: {
      container: 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-500/30 text-amber-900 dark:text-amber-100 shadow-amber-500/5',
      badge: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
      dotPing: 'bg-amber-400',
      dotSolid: 'bg-amber-500',
      icon: 'text-amber-500',
      textMuted: 'text-amber-800/80 dark:text-amber-200/80'
    },
    blue: {
      container: 'bg-blue-500/10 dark:bg-blue-950/40 border-blue-500/30 text-blue-900 dark:text-blue-100 shadow-blue-500/5',
      badge: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
      dotPing: 'bg-blue-400',
      dotSolid: 'bg-blue-500',
      icon: 'text-blue-500',
      textMuted: 'text-blue-800/80 dark:text-blue-200/80'
    },
    indigo: {
      container: 'bg-indigo-500/10 dark:bg-indigo-950/40 border-indigo-500/30 text-indigo-900 dark:text-indigo-100 shadow-indigo-500/5',
      badge: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
      dotPing: 'bg-indigo-400',
      dotSolid: 'bg-indigo-500',
      icon: 'text-indigo-500',
      textMuted: 'text-indigo-800/80 dark:text-indigo-200/80'
    }
  }[variante];

  if (posicao === 'compact') {
    return (
      <div
        className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-1 ${variantesEstilos.container} ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${variantesEstilos.dotPing}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${variantesEstilos.dotSolid}`}></span>
          </span>
          <p className="text-xs font-bold truncate">
            {titulo}: <span className={`font-normal ${variantesEstilos.textMuted}`}>{mensagem}</span>
          </p>
        </div>
        {(onSalvar || formId) && (
          <button
            type={formId ? 'submit' : 'button'}
            form={formId}
            disabled={salvando}
            onClick={onSalvar ? () => onSalvar() : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 shrink-0 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{salvando ? 'Salvando...' : textoBotao}</span>
          </button>
        )}
      </div>
    );
  }

  if (posicao === 'floating') {
    return (
      <div
        className={`sticky top-3 z-40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${variantesEstilos.container} ${className}`}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/20 dark:bg-amber-500/30 shrink-0 border border-amber-500/30">
            <AlertTriangle className={`w-5 h-5 ${variantesEstilos.icon}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${variantesEstilos.dotPing}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${variantesEstilos.dotSolid}`}></span>
              </span>
              <h4 className="text-sm font-black tracking-tight">{titulo}</h4>
            </div>
            <p className={`text-xs mt-0.5 leading-relaxed ${variantesEstilos.textMuted}`}>
              {mensagem}
            </p>
          </div>
        </div>
        {(onSalvar || formId) && (
          <button
            type={formId ? 'submit' : 'button'}
            form={formId}
            disabled={salvando}
            onClick={onSalvar ? () => onSalvar() : undefined}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-amber-500/25 shrink-0 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{salvando ? 'Salvando...' : textoBotao}</span>
          </button>
        )}
      </div>
    );
  }

  // Padrão: 'inline'
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-4.5 backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${variantesEstilos.container} ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-amber-500/20 shrink-0 border border-amber-500/30 mt-0.5">
            <AlertTriangle className={`w-5 h-5 ${variantesEstilos.icon}`} />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${variantesEstilos.dotPing}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${variantesEstilos.dotSolid}`}></span>
              </span>
              <h4 className="text-sm font-extrabold tracking-tight">{titulo}</h4>
              <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border ${variantesEstilos.badge}`}>
                Gravação Necessária
              </span>
            </div>
            <p className={`text-xs leading-relaxed ${variantesEstilos.textMuted}`}>
              {mensagem}
            </p>
          </div>
        </div>

        {(onSalvar || formId) && (
          <div className="w-full sm:w-auto flex items-center justify-end shrink-0 pt-2 sm:pt-0">
            <button
              type={formId ? 'submit' : 'button'}
              form={formId}
              disabled={salvando}
              onClick={onSalvar ? () => onSalvar() : undefined}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{salvando ? 'Salvando Alterações...' : textoBotao}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
