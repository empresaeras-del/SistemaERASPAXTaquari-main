import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, FileText, X } from 'lucide-react';

/**
 * Uma linha do resumo do que será criado se o usuário confirmar.
 *
 * Existe porque "deseja gerar a cobrança?" não é uma confirmação de risco, é uma
 * **decisão**: para responder, o operador precisa ver o que vai nascer — valor,
 * vencimento, de quem se cobra. Enfiar isso na `message` produziria um parágrafo que
 * ninguém lê; em linhas rotuladas, o valor e a data saltam à vista.
 */
export interface LinhaResumoConfirm {
  rotulo: string;
  valor: string;
  /** Dá peso visual ao número que decide a resposta — tipicamente o valor. */
  destaque?: boolean;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  /**
   * Chamado quando o usuário responde **não** (botão de cancelar).
   *
   * Opcional, e por isso todo chamador anterior segue igual: sem ele, cancelar só fecha
   * o diálogo. Existe para a pergunta em que as duas respostas precisam continuar o
   * fluxo — "deseja gerar a cobrança?" é uma pergunta, não uma confirmação de risco: o
   * "não" também tem de fechar a tela e finalizar o cadastro.
   */
  onCancel?: () => void | Promise<void>;
  danger?: boolean;
  /**
   * Resumo do registro que será criado. Quando presente, o diálogo abre mais largo e
   * mostra as linhas num cartão entre a mensagem e os botões.
   */
  resumo?: LinhaResumoConfirm[];
  /** Aviso em destaque âmbar, para o que o operador precisa saber antes de decidir. */
  aviso?: string | null;
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

  const handleCancel = async () => {
    // Fecha primeiro: o `onCancel` pode abrir outro diálogo, e os dois não podem
    // disputar a tela. O erro é engolido de propósito — "não" é a resposta segura, e
    // travar o diálogo aberto deixaria o usuário sem saída.
    handleClose();
    try {
      await options?.onCancel?.();
    } catch (e) {
      console.error('Erro ao processar a recusa da confirmação:', e);
    }
  };

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

  const temResumo = Boolean(options?.resumo && options.resumo.length > 0);

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
              className={`bg-bg-subtle rounded-3xl shadow-2xl w-full flex flex-col border border-border-default overflow-hidden ${temResumo ? 'max-w-md' : 'max-w-sm'}`}
            >
              <div className="p-6 flex flex-col items-center text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${options.danger ? 'bg-rose-500/10 text-rose-500' : 'bg-[#3B82F6]/10 text-[#3B82F6]'}`}>
                  {temResumo && !options.danger ? <FileText className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <h3 className="text-xl font-bold text-text-base mb-2">{options.title}</h3>
                <p className="text-text-subtle text-sm">{options.message}</p>
              </div>

              {temResumo && (
                <div className="px-6 pb-5 -mt-1">
                  <dl className="bg-bg-surface rounded-2xl border border-border-default divide-y divide-border-default overflow-hidden">
                    {options.resumo!.map((linha) => (
                      <div key={linha.rotulo} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                        <dt className="text-[11px] uppercase tracking-wider font-semibold text-text-subtle shrink-0">
                          {linha.rotulo}
                        </dt>
                        <dd className={`text-right ${linha.destaque
                          ? 'text-lg font-bold text-emerald-400 font-mono tabular-nums'
                          : 'text-sm font-medium text-text-base'}`}>
                          {linha.valor}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {options.aviso && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] leading-snug text-amber-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                      <span>{options.aviso}</span>
                    </p>
                  )}
                </div>
              )}
              <div className="px-6 py-4 bg-bg-surface/50 border-t border-border-default flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCancel}
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
