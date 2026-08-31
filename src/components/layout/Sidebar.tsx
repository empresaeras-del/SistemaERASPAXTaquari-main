import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useFinanceiroAlerts } from '../../hooks/useFinanceiroAlerts';
import { LayoutDashboard, Users, DollarSign, Settings, ShieldAlert, Package, Building2, ChevronLeft, ChevronRight, ChevronDown, Info, GripVertical, Briefcase } from 'lucide-react';
import { getFromIDB, saveToIDB } from '../../lib/idb';
import { useAppContext } from '../../context/AppContext';
import { hasModuleAccess } from '../../utils/permissions';

type NavItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  path?: string;
  subItems?: { label: string; path: string }[];
};

const defaultNavItems: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { 
    id: 'associados',
    icon: Users, 
    label: 'Associados',
    subItems: [
      { label: 'Lista de Associados', path: '/associados' },
      { label: 'Atendimentos', path: '/atendimentos' },
      { label: 'Contratos', path: '/contratos' },
      { label: 'Requisições / Guias', path: '/requisicoes' }
    ]
  },
  { 
    id: 'financeiro',
    icon: DollarSign, 
    label: 'Financeiro', 
    subItems: [
      { label: 'Contas a Receber', path: '/financeiro/contas-a-receber' },
      { label: 'Contas a Pagar', path: '/financeiro/contas-a-pagar' },
      { label: 'Caixas / Fluxo de Caixa', path: '/caixas' }
    ]
  },
  { id: 'planos', icon: Package, label: 'Planos', path: '/planos' },
  { id: 'itens_funerarios', icon: Package, label: 'Itens Funerários', path: '/itens-funerarios' },
  { 
    id: 'credenciados',
    icon: Building2, 
    label: 'Rede Credenciada', 
    subItems: [
      { label: 'Prestadores', path: '/credenciados' },
      { label: 'Procedimentos/Exames', path: '/procedimentos' },
      { label: 'Faturamento de Remessas', path: '/faturamentos' }
    ]
  },
  { 
    id: 'administracao',
    icon: Briefcase, 
    label: 'Administração', 
    subItems: [
      { label: 'Fornecedores/Prestadores', path: '/fornecedores' }
    ]
  },
  { id: 'auditoria', icon: ShieldAlert, label: 'Ata de Ocorrências', path: '/auditoria' },
  { 
    id: 'configuracoes',
    icon: Settings, 
    label: 'Configurações', 
    subItems: [
      { label: 'Geral', path: '/configuracoes' },
      { label: 'Documentos Padrões', path: '/documentos' },
    ]
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { state } = useAppContext();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [navItems, setNavItems] = useState<NavItem[]>(defaultNavItems);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const location = useLocation();
  const { alertasReceber, alertasPagar } = useFinanceiroAlerts();

  useEffect(() => {
    const loadOrder = async () => {
      try {
        const pref = await getFromIDB<{id: string, order: string[]}>('preferencias', 'sidebar_menu_order');
        if (pref && pref.order) {
          const newOrder = pref.order.map(label => defaultNavItems.find(item => item.label === label)).filter(Boolean) as NavItem[];
          const missingItems = defaultNavItems.filter(item => !pref.order.includes(item.label));
          setNavItems([...newOrder, ...missingItems]);
        }
      } catch (err) {
        console.error("Erro ao carregar ordem do menu", err);
      }
    };
    loadOrder();
  }, []);

  const saveOrder = async (newOrder: NavItem[]) => {
    try {
      await saveToIDB('preferencias', { id: 'sidebar_menu_order', order: newOrder.map(item => item.label) });
    } catch (err) {
      console.error("Erro ao salvar ordem do menu", err);
    }
  };

  const toggleSubMenu = (label: string) => {
    if (isCollapsed) {
      onToggle();
    }
    setExpandedMenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const isSubMenuActive = (item: NavItem) => {
    if (!item.subItems) return false;
    return item.subItems.some(sub => location.pathname === sub.path || location.pathname.startsWith(sub.path + '/'));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.classList.add('opacity-50');
      }
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIndex(null);
    if (e.target instanceof HTMLElement) {
      e.target.classList.remove('opacity-50');
    }
    saveOrder(navItems);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...navItems];
    const draggedItem = newItems[draggedIndex];
    
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    
    setNavItems(newItems);
    setDraggedIndex(index);
  };

  // Filter items and subItems according to user permissions
  const visibleNavItems = navItems
    .map(item => {
      if (item.subItems) {
        const allowedSubItems = item.subItems.filter(sub => hasModuleAccess(state.user, sub.path));
        if (allowedSubItems.length === 0) return null;
        return { ...item, subItems: allowedSubItems };
      }
      return hasModuleAccess(state.user, item.path || item.id) ? item : null;
    })
    .filter(Boolean) as NavItem[];

  return (
    <aside className={`bg-bg-surface text-text-subtle flex flex-col h-full border-r border-border-default transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"}`}>
      <div className={`h-16 flex items-center border-b border-border-default relative ${isCollapsed ? "justify-center" : "px-6"}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-base tracking-tight">ERAS<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] to-[#60A5FA]">.</span></h1>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-welcome-modal'))}
              className="text-text-subtle hover:text-[#3B82F6] transition-colors"
              title="Informações do Sistema"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        )}
        {isCollapsed && (
          <h1 className="text-xl font-bold text-text-base tracking-tight">E<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] to-[#60A5FA]">.</span></h1>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col">
        <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
          {visibleNavItems.map((item, index) => {
            if (item.subItems) {
              const active = isSubMenuActive(item);
              const expanded = expandedMenus[item.label] || active;

              return (
                <div 
                  key={item.label} 
                  className="flex flex-col group/item"
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                >
                  <div
                    onClick={() => toggleSubMenu(item.label)}
                    title={isCollapsed ? item.label : undefined}
                    className={`nav-glass-wrapper p-[1px] rounded-xl block group cursor-pointer ${active && !expanded ? "active-nav" : ""}`}
                  >
                    <div
                      className={`relative z-10 flex items-center ${isCollapsed ? "justify-center" : "justify-between"} px-3 py-3 rounded-xl transition-all w-full h-full ${
                        active && !expanded
                          ? "bg-gradient-to-r from-[#3B82F6]/20 to-[#60A5FA]/20 text-text-base font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                          : "bg-transparent text-text-subtle group-hover:bg-bg-hover group-hover:text-text-base"
                      }`}
                    >
                      <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
                        {!isCollapsed && <GripVertical className="w-4 h-4 text-slate-600 opacity-0 group-hover/item:opacity-100 cursor-grab shrink-0 -ml-1 transition-opacity" />}
                        <item.icon className={`w-5 h-5 shrink-0 ${active ? "text-[#3B82F6]" : "text-text-subtle group-hover:text-text-base"}`} />
                        
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                        {item.label === 'Financeiro' && (alertasReceber > 0 || alertasPagar > 0) && (
                           <div className={`w-2 h-2 rounded-full bg-amber-500 ${!isCollapsed ? 'ml-auto mr-2' : 'absolute top-1 right-1'}`} />
                        )}

                      </div>
                      {!isCollapsed && (
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
                      )}
                    </div>
                  </div>
                  
                  {!isCollapsed && (
                    <div className={`flex flex-col gap-1 mt-1 overflow-hidden transition-all duration-300 ${expanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
                      {item.subItems.map(sub => (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 pl-11 py-2 rounded-xl transition-all w-full text-sm ${
                              isActive
                                ? "text-text-base bg-bg-hover font-medium"
                                : "text-text-subtle hover:text-text-base hover:bg-bg-hover"
                            }`
                          }
                        >
                          
                          <div className="flex items-center justify-between w-full">
                            <span className="truncate">{sub.label}</span>
                            {sub.path.includes('contas-a-receber') && alertasReceber > 0 && (
                              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2">
                                {alertasReceber}
                              </span>
                            )}
                            {sub.path.includes('contas-a-pagar') && alertasPagar > 0 && (
                              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2">
                                {alertasPagar}
                              </span>
                            )}
                          </div>

                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div 
                key={item.path} 
                className="group/item"
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
              >
                <NavLink
                  to={item.path!}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `nav-glass-wrapper p-[1px] rounded-xl block group ${
                      isActive ? "active-nav" : ""
                    }`
                  }
                >
                  {({ isActive }) => (
                    <div
                      className={`relative z-10 flex items-center ${isCollapsed ? "justify-center" : "gap-3"} px-3 py-3 rounded-xl transition-all w-full h-full ${
                        isActive
                          ? "bg-gradient-to-r from-[#3B82F6]/20 to-[#60A5FA]/20 text-text-base font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                          : "bg-transparent text-text-subtle group-hover:bg-bg-hover group-hover:text-text-base"
                      }`}
                    >
                      <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
                        {!isCollapsed && <GripVertical className="w-4 h-4 text-slate-600 opacity-0 group-hover/item:opacity-100 cursor-grab shrink-0 -ml-1 transition-opacity" />}
                        <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-[#3B82F6]" : "text-text-subtle group-hover:text-text-base"}`} />
                        
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                        {item.label === 'Financeiro' && (alertasReceber > 0 || alertasPagar > 0) && (
                           <div className={`w-2 h-2 rounded-full bg-amber-500 ${!isCollapsed ? 'ml-auto mr-2' : 'absolute top-1 right-1'}`} />
                        )}

                      </div>
                    </div>
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>
      </div>
      
      <div className={`p-4 border-t border-border-default flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
        {!isCollapsed && (
          <span className="text-xs text-text-subtle font-medium tracking-wide">
            ERAS ERP v1.0
          </span>
        )}
        <button 
          onClick={onToggle}
          className="p-1.5 rounded-lg bg-bg-hover hover:bg-[#64748B] text-text-subtle hover:text-text-base transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
