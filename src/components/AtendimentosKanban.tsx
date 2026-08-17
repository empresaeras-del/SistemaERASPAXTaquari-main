import React, { useState } from 'react';
import { Atendimento } from '../types/atendimentos';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface AtendimentosKanbanProps {
  atendimentos: Atendimento[];
  onStatusChangeRequest: (atendimento: Atendimento, novoStatus: Atendimento['status']) => void;
  onViewAtendimento: (atendimento: Atendimento) => void;
}

const STATUSES: { id: Atendimento['status'], label: string, color: string, icon: React.ReactNode }[] = [
  { id: 'aberto', label: 'Aberto', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: <AlertCircle className="w-4 h-4" /> },
  { id: 'em_andamento', label: 'Em Andamento', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: <Clock className="w-4 h-4" /> },
  { id: 'concluido', label: 'Concluído', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: <CheckCircle className="w-4 h-4" /> },
  { id: 'cancelado', label: 'Cancelado', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20', icon: <XCircle className="w-4 h-4" /> },
];

export const AtendimentosKanban: React.FC<AtendimentosKanbanProps> = ({ atendimentos, onStatusChangeRequest, onViewAtendimento }) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: Atendimento['status']) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    
    const atendimento = atendimentos.find(a => a.id === id);
    if (atendimento && atendimento.status !== newStatus) {
      onStatusChangeRequest(atendimento, newStatus);
    }
    setDraggedId(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full min-h-[500px]">
      {STATUSES.map(statusCol => {
        const columnItems = atendimentos.filter(a => a.status === statusCol.id);
        
        return (
          <div 
            key={statusCol.id}
            className="flex-shrink-0 w-80 bg-bg-surface/50 border border-border-default rounded-xl flex flex-col"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, statusCol.id)}
          >
            <div className="p-3 border-b border-border-default flex items-center justify-between bg-bg-surface rounded-t-xl">
              <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-bold uppercase border ${statusCol.color}`}>
                {statusCol.icon}
                {statusCol.label}
              </div>
              <span className="text-text-subtle text-sm font-semibold bg-bg-subtle px-2 py-0.5 rounded-full">
                {columnItems.length}
              </span>
            </div>
            
            <div className="p-3 flex-1 overflow-y-auto space-y-3">
              {columnItems.map(item => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onClick={() => onViewAtendimento(item)}
                  className={`bg-bg-surface border border-border-default rounded-xl p-4 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors ${draggedId === item.id ? 'opacity-50' : 'opacity-100'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-bold text-text-base line-clamp-1" title={item.falecido_nome}>{item.falecido_nome}</h4>
                  </div>
                  <div className="text-xs text-text-subtle mb-3 flex flex-col gap-1">
                    <div>Tipo: <span className="capitalize text-text-base font-medium">{item.tipo_cliente}</span></div>
                    <div>Data: {new Date(item.created_at || '').toLocaleDateString()}</div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border-default/50">
                    <span className="text-xs font-semibold text-text-base">
                      R$ {item.valor_total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              {columnItems.length === 0 && (
                <div className="text-center py-6 text-text-muted text-sm border-2 border-dashed border-border-default/50 rounded-xl">
                  Arraste para cá
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
