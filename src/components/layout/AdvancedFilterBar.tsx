import { get, set } from "idb-keyval";
import React, { useState, useEffect } from 'react';
import { Filter, Save, Bookmark, X, ChevronDown, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, any>;
}

interface AdvancedFilterBarProps {
  pageKey: string;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  currentFilters: Record<string, any>;
  onApplyFilters: (filters: Record<string, any>) => void;
  onClearFilters: () => void;
  children?: React.ReactNode;
}

export const AdvancedFilterBar: React.FC<AdvancedFilterBarProps> = ({
  pageKey,
  showFilters,
  setShowFilters,
  currentFilters,
  onApplyFilters,
  onClearFilters,
  children
}) => {
  const toast = useToast();
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);

  useEffect(() => {
    get(`saved_filters_${pageKey}`).then((saved) => {
      if (saved) {
        try {
          setSavedFilters(JSON.parse(saved));
        } catch (e) {
          // ignore
        }
      }
    });
  }, [pageKey]);

  const saveFilter = () => {
    if (!newFilterName.trim()) return;
    
    const newFilter: SavedFilter = {
      id: crypto.randomUUID(),
      name: newFilterName,
      filters: currentFilters
    };
    
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    set(`saved_filters_${pageKey}`, JSON.stringify(updated));
    setNewFilterName('');
    setIsSaving(false);
    toast.success('Filtro salvo com sucesso!');
  };

  const deleteFilter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedFilters.filter(f => f.id !== id);
    setSavedFilters(updated);
    set(`saved_filters_${pageKey}`, JSON.stringify(updated));
    toast.success('Filtro removido.');
  };

  const applySaved = (filter: SavedFilter) => {
    onApplyFilters(filter.filters);
    setShowSavedDropdown(false);
  };

  const hasActiveFilters = Object.values(currentFilters).some(v => v !== '' && v !== null && v !== undefined && v !== 'todos');

  return (
    <div className="w-full flex flex-col gap-4 mb-6 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${showFilters ? 'bg-[#3B82F6]/10 border-[#3B82F6] text-[#3B82F6]' : 'bg-bg-subtle border-border-default text-text-muted hover:bg-bg-hover'}`}
          >
            <Filter className="w-4 h-4" />
            Filtros Avançados
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-[#3B82F6] ml-1" />
            )}
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-xs text-text-subtle hover:text-text-base underline px-2"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowSavedDropdown(!showSavedDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm font-medium text-text-muted hover:bg-bg-hover transition-colors"
          >
            <Bookmark className="w-4 h-4" />
            Filtros Salvos
            <ChevronDown className="w-4 h-4 ml-1 opacity-50" />
          </button>
          
          {showSavedDropdown && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-bg-subtle border border-border-default rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-2">
                {savedFilters.length > 0 ? (
                  savedFilters.map(f => (
                    <div
                      key={f.id}
                      onClick={() => applySaved(f)}
                      className="flex items-center justify-between p-2 hover:bg-bg-hover rounded-lg cursor-pointer group transition-colors"
                    >
                      <span className="text-sm text-text-base">{f.name}</span>
                      <button
                        onClick={(e) => deleteFilter(f.id, e)}
                        className="text-text-subtle hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-subtle text-center py-4">Nenhum filtro salvo.</p>
                )}
              </div>
              
              {hasActiveFilters && (
                <div className="border-t border-border-default p-3 bg-bg-surface">
                  {isSaving ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Nome do filtro..."
                        value={newFilterName}
                        onChange={(e) => setNewFilterName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm bg-bg-subtle border border-border-default rounded focus:outline-none focus:border-[#3B82F6] text-text-base"
                        onKeyDown={(e) => e.key === 'Enter' && saveFilter()}
                      />
                      <button onClick={saveFilter} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setIsSaving(false)} className="p-1 bg-bg-hover text-text-subtle rounded hover:text-text-base">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsSaving(true)}
                      className="w-full flex items-center justify-center gap-2 py-1.5 text-sm text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Salvar Atual
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="p-4 bg-bg-subtle border border-border-default rounded-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
          {children}
        </div>
      )}
    </div>
  );
};
