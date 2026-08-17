import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, Users, User } from 'lucide-react';

export const RegrasCalculoInfo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'individual' | 'coletivo'>('individual');

  return (
    <div className="w-full bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-6 shadow-xl text-white overflow-hidden mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-white/10 rounded-lg">
          <Info className="w-5 h-5 text-blue-300" />
        </div>
        <h3 className="text-lg font-bold">Regras de Cálculo de Mensalidades</h3>
      </div>

      <div className="flex p-1 bg-black/20 rounded-xl mb-6 w-full max-w-md mx-auto relative">
        <button
          type="button"
          onClick={() => setActiveTab('individual')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors relative z-10 flex items-center justify-center gap-2 ${
            activeTab === 'individual' ? 'text-white' : 'text-blue-200 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          Planos Individuais
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('coletivo')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors relative z-10 flex items-center justify-center gap-2 ${
            activeTab === 'coletivo' ? 'text-white' : 'text-blue-200 hover:text-white'
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

      <div className="relative min-h-[160px]">
        <AnimatePresence mode="wait">
          {activeTab === 'individual' ? (
            <motion.div
              key="individual"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors">
                <h4 className="font-semibold text-blue-300 mb-2">Se Vidas Cadastradas ≤ Mínimo Exigido</h4>
                <p className="text-sm text-blue-100 leading-relaxed">
                  O sistema calcula utilizando a <strong>quantidade mínima de vidas exigida pelo plano</strong> multiplicada pelo valor da mensalidade (somada à taxa de adesão, se aplicável).
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors">
                <h4 className="font-semibold text-blue-300 mb-2">Se Vidas Cadastradas &gt; Mínimo Exigido</h4>
                <p className="text-sm text-blue-100 leading-relaxed">
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
              className="space-y-4"
            >
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors">
                <h4 className="font-semibold text-blue-300 mb-2">Dentro do Limite de Vidas</h4>
                <p className="text-sm text-blue-100 leading-relaxed">
                  Se o número de vidas cadastradas for <strong>menor ou igual</strong> à quantidade máxima permitida, utiliza-se o <strong>valor base do plano coletivo</strong> (somado à taxa de adesão, se aplicável).
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors">
                <h4 className="font-semibold text-blue-300 mb-2">Acima do Limite de Vidas</h4>
                <p className="text-sm text-blue-100 leading-relaxed">
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
