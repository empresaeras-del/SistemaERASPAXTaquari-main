import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Wifi, WifiOff, Bell, User, Building, Maximize, Minimize, Sun, Moon } from 'lucide-react';
import { getEmpresas, Empresa } from '../../services/empresasService';
import { NotificationCenter } from './NotificationCenter';
import { useNotifications } from '../../hooks/useNotifications';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

export const Topbar: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const { totalAlertsCount } = useNotifications();
  const { pendingCount, isSyncing } = useSyncStatus();

  useEffect(() => {
    const loadEmpresas = async () => {
      try {
        const data = await getEmpresas(state.isOnline);
        setEmpresas(data);
      } catch (error) {
        console.error('Failed to load empresas', error);
      }
    };
    loadEmpresas();
  }, [state.isOnline]);

  useEffect(() => {
    if (empresas.length > 0 && !state.empresaSelecionada) {
      if (state.user?.nivel === 'super_admin') { dispatch({ type: 'SET_EMPRESA', payload: 'all' }); return; }
      dispatch({ type: 'SET_EMPRESA', payload: empresas[0].id });
    }
  }, [empresas, state.empresaSelecionada, dispatch]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.error(`Error attempting to enable full-screen mode:`, err);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <header className="h-16 bg-bg-base/80 backdrop-blur-xl border-b border-border-default flex items-center justify-between px-6 shrink-0 z-50 sticky top-0">
      <div className="flex items-center gap-4">
        {/* Company Selector */}
        <div className="flex items-center gap-2">
          <Building className="w-5 h-5 text-text-subtle" />
          
          <select
            value={state.empresaSelecionada || ''}
            onChange={(e) => dispatch({ type: 'SET_EMPRESA', payload: e.target.value })}
            className="bg-transparent text-sm font-semibold text-text-base focus:outline-none focus:ring-0 border-none cursor-pointer p-0 pr-6 appearance-none hover:text-text-base transition-colors"
          >
            {empresas.length === 0 ? (
              <option value="" disabled className="bg-bg-surface">Carregando...</option>
            ) : (
              <>
                {state.user?.nivel === 'super_admin' && <option value="all" className="bg-bg-surface">Todas as Empresas</option>}
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id} className="bg-bg-surface">
                    {empresa.nome_fantasia}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          {state.isOnline ? (
            pendingCount > 0 ? (
              <span className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                Sincronizando...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                <CheckCircle2 className="w-4 h-4" />
                Sincronizado
              </span>
            )
          ) : (
            <span className="flex items-center gap-1.5 text-rose-400 bg-rose-400/10 px-2.5 py-1 rounded-full border border-rose-400/20">
              <WifiOff className="w-4 h-4" />
              Aguardando Sincronização ({pendingCount})
            </span>
          )}
        </div>

        <button 
          onClick={() => dispatch({ type: 'SET_THEME', payload: state.theme === 'dark' ? 'light' : 'dark' })} 
          className="text-text-subtle hover:text-text-base transition-colors" 
          title="Alternar Tema"
        >
          {state.theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button onClick={toggleFullscreen} className="text-text-subtle hover:text-text-base transition-colors" title="Tela Cheia">
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>

        <div className="relative">
          <button 
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className={`transition-colors relative p-2 rounded-xl hover:bg-bg-subtle ${isNotificationOpen ? 'text-[#3B82F6]' : 'text-text-subtle hover:text-text-base'}`}
            title="Central de Notificações e Alertas"
          >
            <Bell className="w-5 h-5" />
            {totalAlertsCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-4 px-1 bg-[#3B82F6] rounded-full text-[9px] font-bold text-white flex items-center justify-center border-2 border-bg-base shadow-sm animate-pulse">
                {totalAlertsCount > 99 ? '99+' : totalAlertsCount}
              </span>
            )}
          </button>
          
          <NotificationCenter 
            isOpen={isNotificationOpen} 
            onClose={() => setIsNotificationOpen(false)} 
          />
        </div>

        <div className="flex items-center gap-3 pl-6 border-l border-border-default">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-text-base">{state.user?.nome}</span>
            <span className="text-xs text-text-subtle capitalize">{state.user?.nivel}</span>
          </div>
          <div className="w-9 h-9 bg-gradient-to-tr from-[#3B82F6] to-[#60A5FA] rounded-full flex items-center justify-center text-white shadow-lg">
            <User className="w-5 h-5" />
          </div>
        </div>
      </div>
    </header>
  );
};
