import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { WifiOff, Eye, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { TopNav } from './TopNav';
import { useAppContext } from '../../context/AppContext';
import { useBackgroundChecks } from '../../hooks/useBackgroundChecks';
import { useScheduledBackup } from '../../hooks/useScheduledBackup';
import { WelcomeModal } from './WelcomeModal';
import { InactivityManager } from '../auth/InactivityManager';
import { OfflineBanner } from './OfflineBanner';
import { hasModuleAccess } from '../../utils/permissions';

export const Layout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { state } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  useBackgroundChecks();
  useScheduledBackup();

  const isRouteAllowed = hasModuleAccess(state.user, location.pathname);

  return (
    <div className="flex h-screen bg-bg-base text-text-base overflow-hidden font-sans selection:bg-[#3B82F6] selection:text-text-base print:block print:h-auto print:bg-white print:text-black">
      {state.layout === 'sidebar' && (
        <div className="print:hidden">
          <Sidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 print:block">
        <div className="print:hidden">
          <Topbar />
          {state.layout === 'topbar' && <TopNav />}
          <OfflineBanner />
        </div>

        <main className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
          <div className="max-w-7xl mx-auto print:max-w-none print:m-0">
            {isRouteAllowed ? (
              <Outlet />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[420px] text-center p-8 bg-[#181B34] border border-[#262A45] rounded-3xl shadow-xl">
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-4">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Acesso Restrito ao Módulo</h3>
                <p className="text-sm text-slate-400 max-w-md mb-6">
                  Seu perfil de usuário não possui permissão para visualizar ou operar este módulo / formulário. Caso necessite de acesso, solicite ao Administrador ou Super Admin da sua empresa.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#222542] hover:bg-[#2A2D48] text-white rounded-xl text-sm font-medium transition-colors border border-[#2A2D48]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para o Início
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
      <WelcomeModal />
    </div>
  );
};
