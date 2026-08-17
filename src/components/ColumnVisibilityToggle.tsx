import React, { useState, useRef, useEffect } from 'react';
import { Columns, Check } from 'lucide-react';

interface ColumnVisibilityToggleProps {
  columns: { id: string; label: string }[];
  visibleColumns: string[];
  onChange: (visibleColumns: string[]) => void;
}

export const ColumnVisibilityToggle: React.FC<ColumnVisibilityToggleProps> = ({ columns, visibleColumns, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (id: string) => {
    if (visibleColumns.includes(id)) {
      if (visibleColumns.length > 1) { // Prevent hiding all
        onChange(visibleColumns.filter(c => c !== id));
      }
    } else {
      onChange([...visibleColumns, id]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-bg-surface border border-border-default hover:bg-bg-hover text-text-base rounded-xl text-sm font-medium transition-colors shadow-sm no-print"
        title="Colunas Visíveis"
      >
        <Columns className="w-4 h-4 text-text-subtle" />
        <span className="hidden sm:inline">Colunas</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-bg-surface border border-border-default rounded-xl shadow-xl z-50 py-2 no-print overflow-hidden">
          <div className="px-3 pb-2 mb-2 border-b border-border-default">
            <p className="text-xs font-semibold text-text-subtle uppercase tracking-wider">Visibilidade</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {columns.map(col => (
              <button
                key={col.id}
                onClick={(e) => {
                  e.preventDefault();
                  toggleColumn(col.id);
                }}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-bg-hover text-sm text-text-base text-left transition-colors"
              >
                <span>{col.label}</span>
                {visibleColumns.includes(col.id) && <Check className="w-4 h-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
