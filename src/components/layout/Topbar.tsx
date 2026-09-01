import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Wifi, WifiOff, Bell, User, Building, Building2, Lock, Maximize, Minimize, Sun, Moon, ChevronDown } from 'lucide-react';
import { getEmpresas, getEmpresaById, Empresa } from '../../services/empresasService';
import { NotificationCenter } from './NotificationCenter';
import { useNotifications } from '../../hooks/useNotifications';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { RefreshCw, CheckCircle2, LogOut, Database } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import toast from 'react-hot-toast';

export const Topbar: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const { totalAlertsCount } = useNotifications();
  const { pendingCount, isSyncing: isQueueSyncing } = useSyncStatus();
  const { isPriming, lastSyncFormatted, syncNow } = useOfflineSync();
  const { signOut } = useAuth();
  const { confirm } = useConfirm();

  const handleManualSync = async () => {
    if (!state.isOnline) {
      toast.error('Sem conexão para sincronização.');
      return;
    }
    const toastId = toast.loading('Sincronizando dados para uso offline...');
    try {
      const res = await syncNow();
      if (res?.success) {
        toast.success('Base de dados atualizada para uso offline!', { id: toastId });
      } else {
        toast.error(res?.error || 'Erro ao sincronizar base.', { id: toastId });
      }
    } catch (e: any) {
      toast.error(e?.message || 'Falha na sincronização.', { id: toastId });
    }
  };

  const handleLogout = () => {
    confirm({
      title: 'Sair do Sistema',
      message: 'Tem certeza que deseja encerrar sua sessão agora?',
      confirmText: 'Sair',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        await signOut();
      }
    });
  };

  useEffect(() => {
    const loadEmpresas = async () => {
      try {
        const data = await getEmpresas(state.isOnline);
        if (data && data.length > 0) {
          setEmpresas(data);
        } else if (state.user?.tenant_id) {
          const emp = await getEmpresaById(state.user.tenant_id, state.isOnline);
          if (emp) setEmpresas([emp]);
        }
      } catch (error) {
        console.error('Failed to load empresas', error);
      }
    };
    loadEmpresas();
  }, [state.isOnline, state.user?.tenant_id]);

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

  const isAnySyncing = isQueueSyncing || isPriming;

  const currentEmpresa = empresas.find(e => e.id === state.empresaSelecionada)
    || empresas.find(e => e.id === state.user?.tenant_id)
    || (empresas.length === 1 ? empresas[0] : null);

  return (
    <header className="h-16 bg-bg-base/80 backdrop-blur-xl border-b border-border-default flex items-center justify-between px-6 shrink-0 z-50 sticky top-0">
      <div className="flex items-center gap-4">
        {/* Company Selector */}
        <div className="flex items-center gap-2">
          {state.user?.nivel === 'super_admin' ? (
            // Super-admin: seletor interativo completo
            <div className="flex items-center gap-2.5">
              {currentEmpresa?.logo_url ? (
                <img
                  src={currentEmpresa.logo_url}
                  alt={currentEmpresa.nome_fantasia || 'Logo da Empresa'}
                  className="h-7 max-w-[100px] object-contain rounded shrink-0 drop-shadow-sm"
                />
              ) : (
                <Building className="w-5 h-5 text-text-subtle shrink-0" />
              )}
              <div className="relative">
                <select
                  value={state.empresaSelecionada || ''}
                  onChange={(e) => dispatch({ type: 'SET_EMPRESA', payload: e.target.value })}
                  className="bg-transparent text-sm font-semibold text-text-base focus:outline-none focus:ring-0 border-none cursor-pointer p-0 pr-6 appearance-none hover:text-text-base transition-colors"
                >
                  {empresas.length === 0 ? (
                    <option value="" disabled className="bg-bg-surface">Carregando...</option>
                  ) : (
                    <>
                      <option value="all" className="bg-bg-surface">Todas as Empresas</option>
                      {empresas.map((empresa) => (
                        <option key={empresa.id} value={empresa.id} className="bg-bg-surface">
                          {empresa.nome_fantasia}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <ChevronDown className="w-3 h-3 text-text-subtle absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          ) : (
            // Usuário comum: badge somente leitura — com logo da empresa
            <div
              className="flex items-center gap-2.5 px-3 py-1.5 bg-bg-subtle border border-border-default rounded-xl cursor-default select-none shadow-sm"
              title="Você está vinculado a esta empresa. Somente o Super Admin pode alterar."
            >
              {currentEmpresa?.logo_url ? (
                <img
                  src={currentEmpresa.logo_url}
                  alt={currentEmpresa.nome_fantasia || 'Logo da Empresa'}
                  className="h-7 max-w-[110px] object-contain rounded shrink-0 drop-shadow-sm"
                />
              ) : (
                <Building2 className="w-4 h-4 text-[#3B82F6] shrink-0" />
              )}
              <span className="text-sm font-semibold text-text-base max-w-[220px] truncate">
                {currentEmpresa?.nome_fantasia
                  || state.user?.tenant_id
                  || 'Carregando...'}
              </span>
              <Lock className="w-3.5 h-3.5 text-text-subtle shrink-0" />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          {state.isOnline ? (
            isAnySyncing ? (
              <span className="flex items-center gap-1.5 text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20 text-xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Sincronizando base...
              </span>
            ) : (
              <button
                onClick={handleManualSync}
                className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 px-2.5 py-1 rounded-full border border-emerald-400/20 text-xs transition-colors cursor-pointer group"
                title={`Última sincronização completa: ${lastSyncFormatted}. Clique para forçar nova atualização local.`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">Base Offline:</span>
                <span className="font-semibold">{lastSyncFormatted}</span>
                <RefreshCw className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-emerald-300" />
              </button>
            )
          ) : (
            <span
              className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 text-xs font-semibold"
              title={`O sistema está em modo offline de visualização. Dados sincronizados: ${lastSyncFormatted}`}
            >
              <WifiOff className="w-3.5 h-3.5" />
              Modo Offline (Visualização)
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

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 pl-6 border-l border-border-default hover:opacity-80 transition-opacity cursor-pointer group"
          title="Sair do sistema"
        >
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-text-base group-hover:text-rose-500 transition-colors">{state.user?.nome}</span>
            <span className="text-xs text-text-subtle capitalize">{state.user?.nivel}</span>
          </div>
          <div className="w-9 h-9 bg-gradient-to-tr from-[#3B82F6] to-[#60A5FA] group-hover:from-rose-500 group-hover:to-rose-400 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300">
            <LogOut className="w-4 h-4 translate-x-0.5" />
          </div>
        </button>
      </div>
    </header>
  );
};
