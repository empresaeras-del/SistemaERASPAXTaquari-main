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

import { OfflineBanner } from './OfflineBanner';

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
          <OfflineBanner />
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
