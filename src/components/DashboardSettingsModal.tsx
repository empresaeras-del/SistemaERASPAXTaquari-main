import React, { useState, useEffect } from 'react';
import { X, GripVertical, Check, Eye, EyeOff } from 'lucide-react';

export type WidgetId = 'atalhos_rapidos' | 'stat_associados' | 'stat_atendimentos' | 'stat_faturamento' | 'stat_conversao' | 'stat_vidas_planos' | 'chart_atendimentos' | 'chart_recebimentos' | 'acoes_recentes' | 'status_sistema' | 'stat_receitas' | 'stat_despesas' | 'chart_saude_financeira' | 'widget_assoc_sem_mensalidade';

export interface WidgetConfig {
  id: WidgetId;
  visible: boolean;
  title: string;
}

export const defaultWidgets: WidgetConfig[] = [
  { id: 'atalhos_rapidos', visible: true, title: 'Atalhos Rápidos' },
  { id: 'widget_assoc_sem_mensalidade', visible: true, title: 'Alertas: Sem Mensalidade' },
  { id: 'stat_associados', visible: true, title: 'Total Associados' },
  { id: 'stat_atendimentos', visible: true, title: 'Atendimentos (Período)' },
  { id: 'stat_faturamento', visible: true, title: 'Faturamento Estimado' },
  { id: 'stat_receitas', visible: true, title: 'Receitas (Projetado vs Arrecadado)' },
  { id: 'stat_despesas', visible: true, title: 'Despesas (Projetado vs Pago)' },
  { id: 'stat_conversao', visible: true, title: 'Conversão' },
  { id: 'stat_vidas_planos', visible: true, title: 'Vidas por Plano' },
  { id: 'chart_atendimentos', visible: true, title: 'Gráfico Atendimentos Mensais' },
  { id: 'chart_recebimentos', visible: true, title: 'Gráfico Recebimentos (KPI)' },
  { id: 'chart_saude_financeira', visible: true, title: 'Gráfico Saúde Financeira (Receitas x Despesas)' },
  { id: 'acoes_recentes', visible: true, title: 'Ações Recentes' },
  { id: 'status_sistema', visible: true, title: 'Status do Sistema' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  layout: WidgetConfig[];
  onSave: (layout: WidgetConfig[]) => void;
}

export const DashboardSettingsModal: React.FC<Props> = ({ isOpen, onClose, layout, onSave }) => {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(layout.length ? layout : defaultWidgets);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Ensure any new default widgets are merged if missing
      let current = layout.length ? [...layout] : [...defaultWidgets];
      const missing = defaultWidgets.filter(dw => !current.find(cw => cw.id === dw.id));
      if (missing.length) {
        current = [...current, ...missing];
      }
      setWidgets(current);
    }
  }, [isOpen, layout]);

  if (!isOpen) return null;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to allow the drag image to be generated before styling
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.classList.add('opacity-50');
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIdx === null || draggedIdx === index) return;

    const newWidgets = [...widgets];
    const draggedItem = newWidgets[draggedIdx];
    
    // Remove from old pos
    newWidgets.splice(draggedIdx, 1);
    // Insert in new pos
    newWidgets.splice(index, 0, draggedItem);
    
    setDraggedIdx(index);
    setWidgets(newWidgets);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIdx(null);
    if (e.target instanceof HTMLElement) {
      e.target.classList.remove('opacity-50');
    }
  };

  const toggleVisibility = (id: string) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-subtle border border-border-default rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-border-default flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-xl font-bold text-text-base">Personalizar Dashboard</h3>
            <p className="text-sm text-text-subtle mt-1">Arraste para reordenar ou oculte widgets</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-text-subtle hover:text-text-base bg-bg-surface rounded-lg transition-colors border border-border-default"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-2">
          {widgets.map((widget, index) => (
            <div
              key={widget.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-move ${
                draggedIdx === index 
                  ? 'border-[#3B82F6] bg-[#3B82F6]/10' 
                  : 'border-border-default bg-bg-surface hover:border-[#64748B]'
              }`}
            >
              <div className="flex items-center gap-3">
                <GripVertical className="w-5 h-5 text-text-subtle" />
                <span className={`text-sm font-medium ${widget.visible ? 'text-text-base' : 'text-text-subtle line-through'}`}>
                  {widget.title}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => toggleVisibility(widget.id)}
                className={`p-2 rounded-lg transition-colors ${widget.visible ? 'text-[#3B82F6] hover:bg-[#3B82F6]/10' : 'text-text-subtle hover:bg-bg-surface'}`}
              >
                {widget.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-border-default bg-bg-surface/50 shrink-0">
          <button
            onClick={() => {
              onSave(widgets);
              onClose();
            }}
            className="w-full py-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Salvar Layout
          </button>
        </div>
      </div>
    </div>
  );
};
