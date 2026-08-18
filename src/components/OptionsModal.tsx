import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface OptionsModalProps {
  title: string;
  options: string[];
  onAdd: (option: string) => void;
  onEdit?: (oldOption: string, newOption: string) => void;
  onRemove: (option: string) => void;
  onClose: () => void;
}

export const OptionsModal: React.FC<OptionsModalProps> = ({ title, options, onAdd, onEdit, onRemove, onClose }) => {
  const [newOption, setNewOption] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const handleAdd = () => {
    const trimmed = newOption.trim();
    if (!trimmed) {
      toast.error("O nome da opção não pode ser vazio");
      return;
    }
    if (options.includes(trimmed)) {
      toast.error("Essa opção já existe");
      return;
    }
    onAdd(trimmed);
    setNewOption('');
    toast.success("Opção adicionada!");
  };

  const startEdit = (index: number, opt: string) => {
    setEditingIndex(index);
    setEditingValue(opt);
  };

  const saveEdit = (oldOpt: string) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      toast.error("O nome da opção não pode ser vazio");
      return;
    }
    if (trimmed !== oldOpt && options.includes(trimmed)) {
      toast.error("Já existe outra opção com este nome");
      return;
    }
    if (onEdit) {
      onEdit(oldOpt, trimmed);
      toast.success("Opção atualizada!");
    }
    setEditingIndex(null);
    setEditingValue('');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleRemove = (opt: string) => {
    onRemove(opt);
    toast.success("Opção removida!");
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
              className="flex-1 bg-bg-subtle border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] outline-none text-sm"
            />
            <button
              onClick={handleAdd}
              className="bg-[#3B82F6] hover:bg-blue-600 text-white px-3.5 py-2 rounded-xl transition-colors flex items-center justify-center gap-1 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar</span>
            </button>
          </div>
          <div className="space-y-2">
            {options.map((opt, index) => (
              <div key={`${opt}-${index}`} className="flex justify-between items-center p-3 bg-bg-subtle rounded-xl border border-border-default gap-2">
                {editingIndex === index ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(opt);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                      className="flex-1 bg-bg-surface border border-[#3B82F6] rounded-lg px-2.5 py-1 text-sm text-text-base outline-none"
                    />
                    <button
                      onClick={() => saveEdit(opt)}
                      className="text-emerald-500 hover:bg-emerald-500/10 p-1.5 rounded-lg transition-colors"
                      title="Salvar alteração"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-text-subtle hover:bg-bg-base p-1.5 rounded-lg transition-colors"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-text-base font-medium text-sm flex-1 break-words">{opt}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {onEdit && (
                        <button
                          onClick={() => startEdit(index, opt)}
                          className="text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 p-1.5 rounded-lg transition-colors"
                          title="Editar opção"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(opt)}
                        className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
                        title="Excluir opção"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {options.length === 0 && (
              <div className="text-center py-6 text-text-subtle text-sm">
                Nenhuma opção cadastrada
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
