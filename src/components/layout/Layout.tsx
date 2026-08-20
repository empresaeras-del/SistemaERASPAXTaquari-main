import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { WifiOff, Eye } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { TopNav } from './TopNav';
import { useAppContext } from '../../context/AppContext';
import { useBackgroundChecks } from '../../hooks/useBackgroundChecks';
import { useScheduledBackup } from '../../hooks/useScheduledBackup';
import { WelcomeModal } from './WelcomeModal';
import { InactivityManager } from '../auth/InactivityManager';

export const Layout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { state } = useAppContext();
  useBackgroundChecks();
  useScheduledBackup();

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
          {!state.isOnline && (
            <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-amber-300 backdrop-blur-md shrink-0 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400">
                  <WifiOff className="w-4 h-4" />
                </div>
                <span>
                  <strong>Modo de Visualização (Offline):</strong> Sem conexão com a internet. O sistema está liberado para consultas, buscas e relatórios. Operações de inclusão, edição e exclusão estão bloqueadas até restabelecer a conexão.
                </span>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 font-bold px-2.5 py-1 rounded-full text-[11px] uppercase border border-amber-500/30 shrink-0">
                <Eye className="w-3.5 h-3.5" />
                Somente Leitura
              </span>
            </div>
          )}
        </div>

        <main className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
          <div className="max-w-7xl mx-auto print:max-w-none print:m-0">
            <Outlet />
          </div>
        </main>
      </div>
      <WelcomeModal />
    </div>
  );
};
