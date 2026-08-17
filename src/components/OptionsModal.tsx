import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface OptionsModalProps {
  title: string;
  options: string[];
  onAdd: (option: string) => void;
  onRemove: (option: string) => void;
  onClose: () => void;
}

export const OptionsModal: React.FC<OptionsModalProps> = ({ title, options, onAdd, onRemove, onClose }) => {
  const [newOption, setNewOption] = useState('');

  const handleAdd = () => {
    if (!newOption.trim()) {
      toast.error("O nome da opção não pode ser vazio");
      return;
    }
    if (options.includes(newOption.trim())) {
      toast.error("Essa opção já existe");
      return;
    }
    onAdd(newOption.trim());
    setNewOption('');
    toast.success("Opção adicionada!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-surface rounded-3xl shadow-2xl w-full max-w-md flex flex-col border border-border-default overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="flex items-center justify-between p-6 border-b border-border-default">
          <h2 className="text-xl font-bold text-text-base">{title}</h2>
          <button onClick={onClose} className="p-2 text-text-subtle hover:bg-bg-subtle hover:text-text-base rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto max-h-[60vh]">
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Nova opção..."
              className="flex-1 bg-bg-subtle border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] outline-none"
            />
            <button
              onClick={handleAdd}
              className="bg-[#3B82F6] hover:bg-blue-600 text-white p-2 rounded-xl transition-colors flex items-center justify-center"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt} className="flex justify-between items-center p-3 bg-bg-subtle rounded-xl border border-border-default">
                <span className="text-text-base font-medium">{opt}</span>
                <button
                  onClick={() => onRemove(opt)}
                  className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {options.length === 0 && (
              <div className="text-center py-4 text-text-muted text-sm">
                Nenhuma opção cadastrada
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
