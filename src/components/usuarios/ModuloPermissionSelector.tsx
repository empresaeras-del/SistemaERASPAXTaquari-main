import React, { useState, useMemo } from 'react';
import { 
  Check, ChevronDown, ChevronRight, Layers, Search, Shield, 
  Sparkles, CheckSquare, Square, MinusSquare, Info,
  LayoutDashboard, Users, DollarSign, Package, Building2, 
  Briefcase, ShieldAlert, Settings, FileText, CheckCheck, XSquare
} from 'lucide-react';
import { NivelAcesso, Usuario } from '../../types';
import { 
  MODULOS_SISTEMA, 
  ModuloInfo, 
  SubModuloInfo, 
  PERFIS_PERMISSAO_PRESETS,
  getAllModuleAndSubmoduleIds,
  hasModuleAccess
} from '../../utils/permissions';

interface ModuloPermissionSelectorProps {
  selectedModulos: string[];
  onChange: (modulos: string[]) => void;
  userNivel: NivelAcesso;
  currentUser: Usuario | null;
  disabled?: boolean;
}

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'LayoutDashboard': return LayoutDashboard;
    case 'Users': return Users;
    case 'DollarSign': return DollarSign;
    case 'Package': return Package;
    case 'Building2': return Building2;
    case 'Briefcase': return Briefcase;
    case 'ShieldAlert': return ShieldAlert;
    case 'Settings': return Settings;
    default: return Layers;
  }
};

const getTipoBadge = (tipo?: string) => {
  switch (tipo) {
    case 'formulario':
      return { label: 'Formulário', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    case 'gestao':
      return { label: 'Gestão', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
    case 'operacional':
      return { label: 'Operacional', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'relatorio':
      return { label: 'Relatório/Logs', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    default:
      return { label: 'Geral', bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  }
};

export const ModuloPermissionSelector: React.FC<ModuloPermissionSelectorProps> = ({
  selectedModulos,
  onChange,
  userNivel,
  currentUser,
  disabled = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    // Começa com todos os módulos abertos para fácil visualização
    const initial: Record<string, boolean> = {};
    MODULOS_SISTEMA.forEach(m => { initial[m.id] = true; });
    return initial;
  });

  const isSuperAdmin = userNivel === 'super_admin';
  const isAdmin = currentUser?.nivel === 'admin';

  // Normaliza lista selecionada
  const currentSelected = useMemo(() => {
    if (selectedModulos.includes('*') || isSuperAdmin) {
      return getAllModuleAndSubmoduleIds();
    }
    return selectedModulos;
  }, [selectedModulos, isSuperAdmin]);

  // Filtra os módulos e submódulos com base na pesquisa
  const filteredModules = useMemo(() => {
    if (!searchTerm.trim()) return MODULOS_SISTEMA;
    const term = searchTerm.toLowerCase();

    return MODULOS_SISTEMA.filter(modulo => {
      const matchModulo = modulo.label.toLowerCase().includes(term) ||
        modulo.descricao.toLowerCase().includes(term) ||
        modulo.categoria.toLowerCase().includes(term);

      const matchSub = modulo.subModulos.some(sub => 
        sub.label.toLowerCase().includes(term) ||
        sub.descricao.toLowerCase().includes(term) ||
        sub.paths.some(p => p.toLowerCase().includes(term))
      );

      return matchModulo || matchSub;
    });
  }, [searchTerm]);

  // Verifica se o admin atual tem permissão para conceder acesso a um módulo/submódulo
  const canGrantAccess = (targetIdOrPath: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.nivel === 'super_admin') return true;
    return hasModuleAccess(currentUser, targetIdOrPath);
  };

  // Toggle do Módulo Principal (seleciona/desmarca todos os seus submódulos)
  const handleToggleModule = (modulo: ModuloInfo) => {
    if (disabled || isSuperAdmin) return;

    const subIds = modulo.subModulos.map(s => s.id);
    const allSubSelected = subIds.every(id => currentSelected.includes(id));

    let updated: string[];
    if (allSubSelected) {
      // Desmarca o pai e todos os submódulos
      updated = currentSelected.filter(id => id !== modulo.id && !subIds.includes(id));
    } else {
      // Marca o pai e todos os submódulos permitidos ao usuário
      const allowedSubs = subIds.filter(id => canGrantAccess(id));
      const newItems = [modulo.id, ...allowedSubs];
      updated = Array.from(new Set([...currentSelected, ...newItems]));
    }

    onChange(updated);
  };

  // Toggle de um Sub-módulo individual
  const handleToggleSubModule = (modulo: ModuloInfo, subModulo: SubModuloInfo) => {
    if (disabled || isSuperAdmin) return;
    if (!canGrantAccess(subModulo.id)) return;

    const isSelected = currentSelected.includes(subModulo.id);
    let updated: string[];

    if (isSelected) {
      // Remove o submódulo
      const remainingSubs = modulo.subModulos.filter(s => s.id !== subModulo.id && currentSelected.includes(s.id));
      // Se não sobrou nenhum submódulo selecionado do pai, remove também o pai
      const removeParent = remainingSubs.length === 0;
      updated = currentSelected.filter(id => id !== subModulo.id && (!removeParent || id !== modulo.id));
    } else {
      // Adiciona o submódulo e garante o pai
      updated = Array.from(new Set([...currentSelected, subModulo.id, modulo.id]));
    }

    onChange(updated);
  };

  // Marcar todos os módulos e submódulos disponíveis
  const handleSelectAll = () => {
    if (disabled || isSuperAdmin) return;
    const allAllowed: string[] = [];
    MODULOS_SISTEMA.forEach(m => {
      if (canGrantAccess(m.id)) {
        allAllowed.push(m.id);
        m.subModulos.forEach(s => {
          if (canGrantAccess(s.id)) {
            allAllowed.push(s.id);
          }
        });
      }
    });
    onChange(allAllowed);
  };

  // Desmarcar todos
  const handleDeselectAll = () => {
    if (disabled || isSuperAdmin) return;
    onChange([]);
  };

  // Aplicar Preset de Perfil
  const handleApplyPreset = (presetModules: string[]) => {
    if (disabled || isSuperAdmin) return;
    if (presetModules.includes('*')) {
      handleSelectAll();
      return;
    }
    const filteredPreset = presetModules.filter(id => canGrantAccess(id));
    onChange(filteredPreset);
  };

  // Expandir/Recolher todos
  const handleExpandAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    MODULOS_SISTEMA.forEach(m => { next[m.id] = expand; });
    setExpandedModules(next);
  };

  // Estatísticas de seleção
  const totalSubModulos = useMemo(() => {
    return MODULOS_SISTEMA.reduce((acc, m) => acc + m.subModulos.length, 0);
  }, []);

  const selectedSubModulosCount = useMemo(() => {
    let count = 0;
    MODULOS_SISTEMA.forEach(m => {
      m.subModulos.forEach(s => {
        if (currentSelected.includes(s.id)) count++;
      });
    });
    return count;
  }, [currentSelected]);

  if (isSuperAdmin) {
    return (
      <div className="pt-4 border-t border-[#262A45] space-y-3">
        <div className="bg-gradient-to-r from-[#7E4CF3]/15 to-[#3B82F6]/15 border border-[#7E4CF3]/30 rounded-2xl p-4 flex items-center gap-3.5 shadow-lg shadow-[#7E4CF3]/5">
          <div className="p-2.5 rounded-xl bg-[#7E4CF3]/20 border border-[#7E4CF3]/40 text-[#A78BFA] shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              Acesso Irrestrito (Super Admin)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7E4CF3] text-white">TOTAL</span>
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Usuários com nível <strong>Super Admin</strong> possuem acesso total a todos os módulos, sub-módulos, relatórios, configurações e formulários existentes no sistema.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-[#262A45] space-y-4">
      {/* CABEÇALHO DO SELETOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <label className="block text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#7E4CF3]" />
            Módulos, Sub-módulos e Formulários Permitidos
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#7E4CF3]/20 text-[#A78BFA] border border-[#7E4CF3]/30">
              {selectedSubModulosCount} de {totalSubModulos} permitidos
            </span>
          </label>
          <span className="text-xs text-slate-400">
            Configure detalhadamente quais telas, relatórios e formulários este usuário poderá acessar.
          </span>
        </div>

        {/* BOTÕES DE AÇÃO RÁPIDA */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#7E4CF3] hover:text-[#9B72F7] bg-[#7E4CF3]/10 hover:bg-[#7E4CF3]/20 px-2.5 py-1.5 rounded-lg transition-colors border border-[#7E4CF3]/30 disabled:opacity-50"
            title="Marcar todos os módulos disponíveis"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marcar Todos
          </button>
          <button
            type="button"
            onClick={handleDeselectAll}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-700 disabled:opacity-50"
            title="Desmarcar todos os módulos"
          >
            <XSquare className="w-3.5 h-3.5" />
            Desmarcar Todos
          </button>
        </div>
      </div>

      {/* BARRA DE PRESETS E PESQUISA */}
      <div className="bg-[#101223] border border-[#262A45] rounded-2xl p-3 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* CAMPO DE PESQUISA */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar módulo, formulário ou rota..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#181B34] border border-[#262A45] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#7E4CF3] focus:border-[#7E4CF3] transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ×
              </button>
            )}
          </div>

          {/* EXPANDIR / RECOLHER */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleExpandAll(true)}
              className="text-[11px] font-medium text-slate-400 hover:text-white px-2 py-1 rounded bg-[#181B34] border border-[#262A45] hover:border-slate-600 transition-colors"
            >
              Expandir Todos
            </button>
            <button
              type="button"
              onClick={() => handleExpandAll(false)}
              className="text-[11px] font-medium text-slate-400 hover:text-white px-2 py-1 rounded bg-[#181B34] border border-[#262A45] hover:border-slate-600 transition-colors"
            >
              Recolher
            </button>
          </div>
        </div>

        {/* ATALHOS DE PERFIS PRÉ-DEFINIDOS */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#262A45]/60">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Perfis Sugeridos:
          </span>
          {PERFIS_PERMISSAO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset.modulos)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[#181B34] hover:bg-[#7E4CF3]/20 hover:text-[#A78BFA] text-slate-300 border border-[#262A45] hover:border-[#7E4CF3]/40 transition-all"
              title={preset.descricao}
            >
              {preset.nome}
            </button>
          ))}
        </div>
      </div>

      {/* LISTA HIERÁRQUICA DE MÓDULOS E SUB-MÓDULOS */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {filteredModules.length === 0 ? (
          <div className="p-8 text-center bg-[#101223] rounded-2xl border border-[#262A45]">
            <Layers className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-slate-400">Nenhum módulo ou formulário encontrado</p>
            <p className="text-xs text-slate-500 mt-1">Tente pesquisar por outro termo ou limpe o filtro.</p>
          </div>
        ) : (
          filteredModules.map((modulo) => {
            const Icon = getIconComponent(modulo.iconName);
            const subIds = modulo.subModulos.map(s => s.id);
            const selectedSubCount = subIds.filter(id => currentSelected.includes(id)).length;
            const isAllSelected = subIds.length > 0 && selectedSubCount === subIds.length;
            const isPartiallySelected = selectedSubCount > 0 && selectedSubCount < subIds.length;
            const isExpanded = expandedModules[modulo.id] ?? true;
            const isAllowedForAdmin = canGrantAccess(modulo.id);

            return (
              <div 
                key={modulo.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isAllSelected
                    ? 'bg-[#14172D] border-[#7E4CF3]/50 shadow-md shadow-[#7E4CF3]/5'
                    : isPartiallySelected
                    ? 'bg-[#121528] border-[#7E4CF3]/30'
                    : 'bg-[#101223] border-[#262A45]'
                } ${!isAllowedForAdmin ? 'opacity-50' : ''}`}
              >
                {/* CABEÇALHO DO MÓDULO PAI */}
                <div 
                  className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
                  onClick={() => setExpandedModules(prev => ({ ...prev, [modulo.id]: !isExpanded }))}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* CHECKBOX DO PAI */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isAllowedForAdmin) handleToggleModule(modulo);
                      }}
                      className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                        isAllSelected
                          ? 'bg-[#7E4CF3] text-white shadow-sm shadow-[#7E4CF3]/40'
                          : isPartiallySelected
                          ? 'bg-[#7E4CF3]/30 text-[#A78BFA] border border-[#7E4CF3]'
                          : 'border border-slate-600 bg-[#181B34] hover:border-slate-400'
                      }`}
                    >
                      {isAllSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      {isPartiallySelected && <div className="w-2 h-2 bg-[#A78BFA] rounded-sm" />}
                    </div>

                    {/* ÍCONE DO MÓDULO */}
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isAllSelected || isPartiallySelected 
                        ? 'bg-[#7E4CF3]/20 text-[#A78BFA] border border-[#7E4CF3]/30' 
                        : 'bg-[#181B34] text-slate-400 border border-[#262A45]'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* TEXTO DO MÓDULO */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white tracking-tight">
                          {modulo.label}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#181B34] text-slate-400 border border-[#262A45]">
                          {modulo.categoria}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {modulo.descricao}
                      </p>
                    </div>
                  </div>

                  {/* LADO DIREITO: CONTADOR E EXPANSOR */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${
                      isAllSelected
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : isPartiallySelected
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {selectedSubCount}/{subIds.length} ativos
                    </span>

                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                      title={isExpanded ? "Recolher" : "Expandir"}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* SUB-MÓDULOS E FORMULÁRIOS VINCULADOS */}
                {isExpanded && (
                  <div className="p-3 pt-0 border-t border-[#262A45]/40 bg-[#0E1020]/60">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-3">
                      {modulo.subModulos.map((sub) => {
                        const isSubChecked = currentSelected.includes(sub.id);
                        const isSubAllowed = canGrantAccess(sub.id);
                        const badge = getTipoBadge(sub.tipo);

                        return (
                          <div
                            key={sub.id}
                            onClick={() => {
                              if (isSubAllowed) handleToggleSubModule(modulo, sub);
                            }}
                            className={`p-2.5 rounded-xl border transition-all flex items-start gap-2.5 select-none ${
                              isSubChecked
                                ? 'bg-gradient-to-r from-[#7E4CF3]/15 to-[#3B82F6]/10 border-[#7E4CF3]/40 text-white shadow-sm shadow-[#7E4CF3]/5'
                                : 'bg-[#181B34]/70 border-[#262A45] hover:border-slate-600 text-slate-300'
                            } ${isSubAllowed ? 'cursor-pointer hover:opacity-100' : 'cursor-not-allowed opacity-40'}`}
                          >
                            <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                              isSubChecked
                                ? 'bg-[#7E4CF3] text-white'
                                : 'border border-slate-600 bg-[#101223]'
                            }`}>
                              {isSubChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1.5 mb-0.5">
                                <span className="font-semibold text-xs text-white leading-tight">
                                  {sub.label}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${badge.bg}`}>
                                  {badge.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-tight line-clamp-2">
                                {sub.descricao}
                              </p>
                              {sub.paths.length > 0 && (
                                <span className="text-[10px] text-slate-500 font-mono block mt-1 truncate">
                                  {sub.paths[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
