import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { WifiOff, AlertTriangle, Database } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const { state } = useAppContext();
  const { lastSyncFormatted } = useOfflineSync();

  if (state.isOnline) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm animate-fadeIn">
      <div className="flex items-center gap-2.5 max-w-4xl">
        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/40">
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div>
          <span className="font-semibold text-amber-200">Modo Offline Ativo:</span>{' '}
          <span className="text-amber-300/90">
            Você está navegando sem conexão à internet. Todas as visualizações utilizam os dados salvos localmente no dispositivo.
          </span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-1.5 text-xs text-amber-300/80 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 shrink-0">
        <Database className="w-3.5 h-3.5 text-amber-400" />
        <span>Última sincronização: <strong className="text-amber-200">{lastSyncFormatted}</strong></span>
      </div>
    </div>
  );
};
