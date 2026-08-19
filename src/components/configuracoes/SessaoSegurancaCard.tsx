import React, { useState, useEffect } from 'react';
import { Clock, Shield, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { 
  getInactivityTimeoutMinutes, 
  setInactivityTimeoutMinutes,
  DEFAULT_INACTIVITY_MINUTES 
} from '../auth/InactivityManager';

export const SessaoSegurancaCard: React.FC = () => {
  const toast = useToast();
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(DEFAULT_INACTIVITY_MINUTES);

  useEffect(() => {
    setTimeoutMinutes(getInactivityTimeoutMinutes());
  }, []);

  const handleSelectTimeout = (mins: number) => {
    setTimeoutMinutes(mins);
    setInactivityTimeoutMinutes(mins);
    toast.success(`Tempo de inatividade para logoff definido para ${mins} minutos.`);
  };

  const opcoes = [
    { label: '1 minuto', value: 1, desc: 'Teste Rápido (aviso aos 20s)' },
    { label: '2 minutos', value: 2, desc: 'Modo Demonstração (aviso aos 30s)' },
    { label: '5 minutos', value: 5, desc: 'Ambientes compartilhados' },
    { label: '15 minutos', value: 15, desc: 'Padrão recomendado' },
    { label: '30 minutos', value: 30, desc: 'Equilíbrio segurança/conveniência' },
    { label: '60 minutos', value: 60, desc: 'Sessão estendida' }
  ];

  return (
    <div className="bg-[#181B34] border border-[#262A45] rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-[#7E4CF3]/15 text-[#7E4CF3] border border-[#7E4CF3]/30 rounded-xl">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            Segurança de Sessão e Logoff Automático
          </h3>
          <p className="text-xs text-slate-400">
            Defina o tempo limite de inatividade do usuário antes de desconectar automaticamente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
        {opcoes.map((opt) => {
          const isSelected = timeoutMinutes === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelectTimeout(opt.value)}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between relative ${
                isSelected
                  ? 'bg-gradient-to-br from-[#7E4CF3]/20 to-[#4A88E9]/15 border-[#7E4CF3] shadow-md shadow-[#7E4CF3]/10'
                  : 'bg-[#101223] border-[#262A45] hover:border-slate-600 opacity-75 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#7E4CF3]" />
                  {opt.label}
                </span>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-[#7E4CF3]" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                {opt.desc}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 p-3 rounded-xl bg-[#101223] border border-[#262A45] flex items-center gap-2.5 text-xs text-slate-400">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          O sistema emite um aviso prévio com <strong>contagem regressiva de 60 segundos</strong> antes de desconectar o usuário inativo.
        </span>
      </div>
    </div>
  );
};
