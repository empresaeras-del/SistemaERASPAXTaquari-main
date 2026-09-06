import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { useFinanceiroAlerts } from '../../hooks/useFinanceiroAlerts';
import { LayoutDashboard, Users, DollarSign, Settings, ShieldAlert, Package, ClipboardList, Building2, ChevronLeft, ChevronDown, Info, GripVertical, Briefcase, GraduationCap } from 'lucide-react';
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
  { id: 'planos', icon: ClipboardList, label: 'Planos', path: '/planos' },
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
  { id: 'tutorial', icon: GraduationCap, label: 'Tutorial & Guia', path: '/tutorial' },
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
  // Tooltip próprio do menu recolhido — substitui o `title` nativo, que só
  // aparece depois de ~1s e é renderizado pelo sistema operacional, fora do tema.
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);
  const location = useLocation();
  const { alertasReceber, alertasPagar } = useFinanceiroAlerts();

  // Ao expandir o menu, o tooltip perde o sentido (o rótulo volta a ficar visível).
  useEffect(() => {
    if (!isCollapsed) setTooltip(null);
  }, [isCollapsed]);

  const showTooltip = (e: React.MouseEvent<HTMLElement>, label: string) => {
    if (!isCollapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 12 });
  };

  const hideTooltip = () => setTooltip(null);

  useEffect(() => {
    const loadOrder = async () => {
      try {
        const pref = await getFromIDB<{id: string, order: string[]}>('preferencias', 'sidebar_menu_order');
        if (pref && pref.order) {
          // If the saved order contains spaces, it's the old label-based format. We should ignore it to let it reset.
          if (pref.order.length > 0 && pref.order[0].includes(' ')) {
             return;
          }
          const newOrder = pref.order.map(id => defaultNavItems.find(item => item.id === id)).filter(Boolean) as NavItem[];
          const missingItems = defaultNavItems.filter(item => !pref.order.includes(item.id));
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
      await saveToIDB('preferencias', { id: 'sidebar_menu_order', order: newOrder.map(item => item.id) });
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
      <div className={`h-16 flex items-center border-b border-border-default relative shrink-0 ${isCollapsed ? "justify-center" : "px-4"}`}>
        {!isCollapsed && (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl font-bold text-text-base tracking-tight">ERAS<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] to-[#60A5FA]">.</span></h1>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-welcome-modal'))}
                className="text-text-subtle hover:text-[#3B82F6] transition-colors"
                title="Informações do Sistema"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onToggle}
              title="Recolher menu"
              className="ml-auto p-1.5 rounded-lg text-text-subtle hover:bg-bg-hover hover:text-text-base transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        )}
        {isCollapsed && (
          <button
            onClick={onToggle}
            title="Expandir menu"
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] text-white font-bold text-sm flex items-center justify-center shadow-lg shadow-[#3B82F6]/20 hover:opacity-90 transition-opacity"
          >
            E
          </button>
        )}
      </div>
      
      {/* O tooltip é posicionado em coordenadas de viewport; rolar a lista o
          deixaria fora do lugar, então ele é dispensado ao rolar. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col" onScroll={hideTooltip}>
        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-3">
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
                    onMouseEnter={(e) => showTooltip(e, item.label)}
                    onMouseLeave={hideTooltip}
                    aria-label={isCollapsed ? item.label : undefined}
                    className={`nav-glass-wrapper p-[1px] rounded-xl block group cursor-pointer ${active && !expanded ? "active-nav" : ""}`}
                  >
                    <div
                      className={`relative z-10 flex items-center ${isCollapsed ? "justify-center" : "justify-between"} px-3 py-2.5 rounded-xl transition-all w-full h-full text-sm ${
                        active && !expanded
                          ? "bg-[#3B82F6]/15 text-text-base font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                          : active
                            ? "bg-transparent text-text-base font-medium"
                            : "bg-transparent text-text-subtle group-hover:bg-bg-hover group-hover:text-text-base"
                      }`}
                    >
                      {active && !expanded && !isCollapsed && (
                        <span className="absolute left-[3px] top-1/2 -translate-y-1/2 w-[3px] h-[17px] rounded-full bg-gradient-to-b from-[#60A5FA] to-[#3B82F6]" />
                      )}
                      {!isCollapsed && (
                        <GripVertical className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 text-text-subtle/60 opacity-0 group-hover/item:opacity-100 cursor-grab transition-opacity" />
                      )}
                      <div className={`flex items-center min-w-0 ${isCollapsed ? "justify-center" : "gap-3"}`}>
                        <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-[#3B82F6]" : "text-text-subtle group-hover:text-text-base"}`} />

                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                        {item.label === 'Financeiro' && (alertasReceber + alertasPagar) > 0 && isCollapsed && (
                           <div className="w-2 h-2 rounded-full bg-amber-500 absolute top-1 right-1" />
                        )}

                      </div>
                      {!isCollapsed && (
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {item.label === 'Financeiro' && (alertasReceber + alertasPagar) > 0 && (
                            <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-tight">
                              {alertasReceber + alertasPagar}
                            </span>
                          )}
                          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {!isCollapsed && (
                    /* `grid-rows-[0fr] → [1fr]` anima a mesma abertura sem depender de uma
                       altura máxima fixa: nada é cortado quando um submenu ganha itens. */
                    <div className={`grid transition-all duration-300 ${expanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"}`}>
                      <div className="flex flex-col gap-1 min-h-0 overflow-hidden">
                        {item.subItems.map(sub => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            className={({ isActive }) =>
                              `relative flex items-center gap-3 pr-3 pl-[42px] py-1.5 rounded-lg transition-all w-full text-[13px] ${
                                isActive
                                  ? "text-text-base bg-[#3B82F6]/15 font-semibold"
                                  : "text-text-subtle hover:text-text-base hover:bg-bg-hover"
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && (
                                  <span className="absolute left-[3px] top-1/2 -translate-y-1/2 w-[3px] h-[15px] rounded-full bg-gradient-to-b from-[#60A5FA] to-[#3B82F6]" />
                                )}
                                <div className="flex items-center justify-between w-full">
                                  <span className="truncate">{sub.label}</span>
                                  {sub.path.includes('contas-a-receber') && alertasReceber > 0 && (
                                    <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 leading-tight">
                                      {alertasReceber}
                                    </span>
                                  )}
                                  {sub.path.includes('contas-a-pagar') && alertasPagar > 0 && (
                                    <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 leading-tight">
                                      {alertasPagar}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </NavLink>
                        ))}
                      </div>
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
                  onMouseEnter={(e) => showTooltip(e, item.label)}
                  onMouseLeave={hideTooltip}
                  aria-label={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `nav-glass-wrapper p-[1px] rounded-xl block group ${
                      isActive ? "active-nav" : ""
                    }`
                  }
                >
                  {({ isActive }) => (
                    <div
                      className={`relative z-10 flex items-center ${isCollapsed ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl transition-all w-full h-full text-sm ${
                        isActive
                          ? "bg-[#3B82F6]/15 text-text-base font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                          : "bg-transparent text-text-subtle group-hover:bg-bg-hover group-hover:text-text-base"
                      }`}
                    >
                      {isActive && !isCollapsed && (
                        <span className="absolute left-[3px] top-1/2 -translate-y-1/2 w-[3px] h-[17px] rounded-full bg-gradient-to-b from-[#60A5FA] to-[#3B82F6]" />
                      )}
                      {!isCollapsed && (
                        <GripVertical className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 text-text-subtle/60 opacity-0 group-hover/item:opacity-100 cursor-grab transition-opacity" />
                      )}
                      <div className={`flex items-center min-w-0 ${isCollapsed ? "justify-center" : "gap-3"}`}>
                        <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-[#3B82F6]" : "text-text-subtle group-hover:text-text-base"}`} />

                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>
                    </div>
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>
      </div>
      
      {/* O botão de recolher/expandir vive no cabeçalho; aqui fica só a versão. */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-t border-border-default">
          <span className="text-[11px] text-text-subtle/70 font-medium tracking-wide uppercase">
            ERAS ERP v1.0
          </span>
        </div>
      )}

      {/* Portal para o body: a lista de itens tem `overflow-x-hidden`, que cortaria
          um tooltip posicionado à direita do menu. */}
      {tooltip && createPortal(
        <div
          role="tooltip"
          style={{ top: tooltip.top, left: tooltip.left }}
          className="fixed z-[60] -translate-y-1/2 pointer-events-none px-2.5 py-1.5 rounded-lg bg-bg-surface border border-border-default text-text-base text-xs font-medium whitespace-nowrap shadow-lg"
        >
          {tooltip.label}
        </div>,
        document.body
      )}
    </aside>
  );
};
