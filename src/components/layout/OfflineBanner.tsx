import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { isSupabaseConfigured } from '../../lib/supabase';
import { WifiOff, AlertTriangle, Database } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const { state } = useAppContext();
  const { lastSyncFormatted } = useOfflineSync();

  if (state.isOnline) return null;

  const isConfigIssue = !isSupabaseConfigured;

  return (
    <div className={`${isConfigIssue ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' : 'bg-amber-500/15 border-amber-500/30 text-amber-300'} border-b px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm animate-fadeIn`}>
      <div className="flex items-center gap-2.5 max-w-4xl">
        <div className={`w-6 h-6 rounded-full ${isConfigIssue ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : 'bg-amber-500/20 border-amber-500/40 text-amber-400'} flex items-center justify-center shrink-0 border`}>
          {isConfigIssue ? <AlertTriangle className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        </div>
        <div>
          <span className={`font-semibold ${isConfigIssue ? 'text-rose-200' : 'text-amber-200'}`}>
            {isConfigIssue ? 'Supabase não conectado:' : 'Modo Offline Ativo:'}
          </span>{' '}
          <span className={isConfigIssue ? 'text-rose-300/90' : 'text-amber-300/90'}>
            {isConfigIssue 
              ? 'As chaves VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão configuradas no arquivo .env. Seus cadastros estão salvos localmente e serão sincronizados assim que as chaves forem configuradas.'
              : 'Você está navegando sem conexão à internet. Todas as visualizações utilizam os dados salvos localmente no dispositivo.'}
          </span>
        </div>
      </div>

      <div className={`hidden md:flex items-center gap-1.5 text-xs ${isConfigIssue ? 'text-rose-300/80 bg-rose-500/10 border-rose-500/20' : 'text-amber-300/80 bg-amber-500/10 border-amber-500/20'} px-2.5 py-1 rounded-md border shrink-0`}>
        <Database className={`w-3.5 h-3.5 ${isConfigIssue ? 'text-rose-400' : 'text-amber-400'}`} />
        <span>Última sincronização: <strong className={isConfigIssue ? 'text-rose-200' : 'text-amber-200'}>{lastSyncFormatted}</strong></span>
      </div>
    </div>
  );
};
