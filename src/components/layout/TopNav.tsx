import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useFinanceiroAlerts } from '../../hooks/useFinanceiroAlerts';
import { 
  LayoutDashboard, Users, DollarSign, Settings, 
  ShieldAlert, Package, Building2, ChevronDown, 
  Image as ImageIcon,
  Menu
} from 'lucide-react';

export const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { 
    icon: Users, 
    label: 'Associados',
    subItems: [
      { label: 'Lista', path: '/associados' },
      { label: 'Atendimentos', path: '/atendimentos' },
      { label: 'Contratos', path: '/contratos' },
      { label: 'Requisições', path: '/requisicoes' }
    ]
  },
  { 
    icon: DollarSign, 
    label: 'Financeiro', 
    subItems: [
      { label: 'A Receber', path: '/financeiro/contas-a-receber' },
      { label: 'A Pagar', path: '/financeiro/contas-a-pagar' },
      { label: 'Caixas', path: '/caixas' }
    ]
  },
  { icon: Package, label: 'Planos', path: '/planos' },
  { icon: Package, label: 'Itens', path: '/itens-funerarios' },
  { 
    icon: Building2, 
    label: 'Credenciados', 
    subItems: [
      { label: 'Prestadores', path: '/credenciados' },
      { label: 'Procedimentos', path: '/procedimentos' },
      { label: 'Faturamento', path: '/faturamentos' }
    ]
  },
  { icon: ShieldAlert, label: 'Ata de Ocorrências', path: '/auditoria' },
  { 
    icon: Settings, 
    label: 'Config', 
    subItems: [
      { label: 'Geral', path: '/configuracoes' },
      { label: 'Docs', path: '/documentos' },
      { label: 'IA Imagens', path: '/gerador-imagens' }
    ]
  },
];

export const TopNav: React.FC = () => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const location = useLocation();
  const { alertasReceber, alertasPagar } = useFinanceiroAlerts();

  return (
    <nav className="h-auto min-h-[48px] py-2 bg-bg-surface border-b border-border-default flex flex-wrap items-center px-4 relative z-40">
      <div className="flex flex-wrap gap-2 items-center w-full">
        {navItems.map((item) => {
          const isActiveSub = item.subItems?.some(s => location.pathname.startsWith(s.path));
          const isDropdownOpen = openDropdown === item.label;

          return (
            <div 
              key={item.label}
              className="relative flex items-center"
              onMouseEnter={() => setOpenDropdown(item.label)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              {item.path && !item.subItems ? (
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `nav-glass-wrapper p-[1px] rounded-lg block group ${
                      isActive ? "active-nav" : ""
                    }`
                  }
                >
                  {({ isActive }) => (
                    <div className={`relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-[#3B82F6]/20 to-[#60A5FA]/20 text-text-base font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                        : "bg-transparent text-text-subtle group-hover:bg-[#1A1D36] group-hover:text-text-base"
                    }`}>
                      <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#3B82F6]" : "text-text-subtle group-hover:text-text-base"}`} />
                      
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.label === 'Financeiro' && (alertasReceber > 0 || alertasPagar > 0) && (
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute top-1.5 right-1.5" />
                    )}

                    </div>
                  )}
                </NavLink>
              ) : (
                <div
                  className={`nav-glass-wrapper p-[1px] rounded-lg block group cursor-pointer ${
                    isActiveSub || isDropdownOpen ? "active-nav" : ""
                  }`}
                >
                  <div className={`relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                      isActiveSub || isDropdownOpen
                        ? "bg-gradient-to-r from-[#3B82F6]/20 to-[#60A5FA]/20 text-text-base font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                        : "bg-transparent text-text-subtle group-hover:bg-[#1A1D36] group-hover:text-text-base"
                    }`}>
                    <item.icon className={`w-4 h-4 shrink-0 ${isActiveSub || isDropdownOpen ? "text-[#3B82F6]" : "text-text-subtle group-hover:text-text-base"}`} />
                    
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.label === 'Financeiro' && (alertasReceber > 0 || alertasPagar > 0) && (
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute top-1.5 right-1.5" />
                    )}

                    <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isDropdownOpen ? "rotate-180" : "opacity-50"}`} />
                  </div>
                </div>
              )}

              {item.subItems && isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 min-w-[200px] bg-bg-surface border border-border-default rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  {item.subItems.map((subItem) => {
                    const isSubActive = location.pathname.startsWith(subItem.path);
                    return (
                      <NavLink
                        key={subItem.path}
                        to={subItem.path}
                        onClick={() => setOpenDropdown(null)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                            isSubActive
                              ? 'text-[#3B82F6] bg-[#3B82F6]/5'
                              : 'text-text-subtle hover:text-text-base hover:bg-bg-subtle'
                          }`
                        }
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${isSubActive ? 'bg-[#3B82F6]' : 'bg-current opacity-50'}`}></div>
                        {subItem.label}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
};
