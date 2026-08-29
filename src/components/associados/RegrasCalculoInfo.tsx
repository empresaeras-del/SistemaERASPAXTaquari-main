import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, Users, User } from 'lucide-react';

export interface RegrasCalculoInfoProps {
  initialTab?: 'individual' | 'coletivo';
  controlledTab?: 'individual' | 'coletivo';
  onTabChange?: (tab: 'individual' | 'coletivo') => void;
  className?: string;
}

export const RegrasCalculoInfo: React.FC<RegrasCalculoInfoProps> = ({
  initialTab = 'individual',
  controlledTab,
  onTabChange,
  className = ''
}) => {
  const [internalTab, setInternalTab] = useState<'individual' | 'coletivo'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setInternalTab(initialTab);
    }
  }, [initialTab]);

  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;

  const handleTabChange = (tab: 'individual' | 'coletivo') => {
    setInternalTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  return (
    <div className={`w-full bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-5 sm:p-6 shadow-xl text-white overflow-hidden ${className}`}>
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-white/10 rounded-lg">
          <Info className="w-5 h-5 text-blue-300" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold leading-tight">Regras de Cálculo de Mensalidades</h3>
          <p className="text-xs text-blue-200/80 mt-0.5">Entenda como o sistema calcula as parcelas para cada tipo de plano</p>
        </div>
      </div>

      <div className="flex p-1 bg-black/20 rounded-xl mb-5 w-full max-w-md mx-auto relative">
        <button
          type="button"
          onClick={() => handleTabChange('individual')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors relative z-10 flex items-center justify-center gap-2 ${
            activeTab === 'individual' ? 'text-white font-bold' : 'text-blue-200 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          Planos Individuais
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('coletivo')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors relative z-10 flex items-center justify-center gap-2 ${
            activeTab === 'coletivo' ? 'text-white font-bold' : 'text-blue-200 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Planos Coletivos
        </button>
        
        <div 
          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-blue-500 rounded-lg shadow-sm transition-transform duration-300 ease-in-out ${
            activeTab === 'coletivo' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
          }`} 
        />
      </div>

      <div className="relative min-h-[140px]">
        <AnimatePresence mode="wait">
          {activeTab === 'individual' ? (
            <motion.div
              key="individual"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors">
                <h4 className="font-semibold text-blue-300 mb-1 text-sm">Se Vidas Cadastradas ≤ Mínimo Exigido</h4>
                <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                  O sistema calcula utilizando a <strong>quantidade mínima de vidas exigida pelo plano</strong> multiplicada pelo valor da mensalidade (somada à taxa de adesão, se aplicável).
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors">
                <h4 className="font-semibold text-blue-300 mb-1 text-sm">Se Vidas Cadastradas &gt; Mínimo Exigido</h4>
                <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                  O sistema calcula utilizando a <strong>quantidade real de vidas cadastradas</strong> multiplicada pelo valor da mensalidade (somada à taxa de adesão, se aplicável).
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="coletivo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors">
                <h4 className="font-semibold text-blue-300 mb-1 text-sm">Dentro do Limite de Vidas</h4>
                <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                  Se o número de vidas cadastradas for <strong>menor ou igual</strong> à quantidade máxima permitida, utiliza-se o <strong>valor base do plano coletivo</strong> (somado à taxa de adesão, se aplicável).
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors">
                <h4 className="font-semibold text-blue-300 mb-1 text-sm">Acima do Limite de Vidas</h4>
                <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                  Se ultrapassar o máximo, o sistema emite um alerta e exige que seja informado um <strong>valor extra</strong> para cobrir as vidas excedentes, que será somado ao valor base.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
