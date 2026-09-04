import React, { useState } from 'react';
import { X, Check, Layout, RotateCcw } from 'lucide-react';

export interface MargensConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface DocumentoMargensModalProps {
  isOpen: boolean;
  onClose: () => void;
  margens: MargensConfig;
  onSave: (novasMargens: MargensConfig) => void;
}

export const PRESETS_MARGENS = [
  {
    id: 'normal',
    label: 'Normal / Padrão',
    descricao: 'Superior: 20mm · Inferior: 20mm · Esquerda: 25mm · Direita: 25mm',
    config: { top: 20, bottom: 20, left: 25, right: 25 },
  },
  {
    id: 'estreita',
    label: 'Estreita (Mais espaço)',
    descricao: 'Superior: 12.7mm · Inferior: 12.7mm · Esquerda: 12.7mm · Direita: 12.7mm',
    config: { top: 12.7, bottom: 12.7, left: 12.7, right: 12.7 },
  },
  {
    id: 'moderada',
    label: 'Moderada',
    descricao: 'Superior: 25.4mm · Inferior: 25.4mm · Esquerda: 19mm · Direita: 19mm',
    config: { top: 25.4, bottom: 25.4, left: 19, right: 19 },
  },
  {
    id: 'larga',
    label: 'Larga (Mais margem)',
    descricao: 'Superior: 25.4mm · Inferior: 25.4mm · Esquerda: 35mm · Direita: 35mm',
    config: { top: 25.4, bottom: 25.4, left: 35, right: 35 },
  },
];

export const DocumentoMargensModal: React.FC<DocumentoMargensModalProps> = ({
  isOpen,
  onClose,
  margens,
  onSave,
}) => {
  const [top, setTop] = useState(margens.top);
  const [bottom, setBottom] = useState(margens.bottom);
  const [left, setLeft] = useState(margens.left);
  const [right, setRight] = useState(margens.right);

  if (!isOpen) return null;

  const handleApplyPreset = (presetConfig: MargensConfig) => {
    setTop(presetConfig.top);
    setBottom(presetConfig.bottom);
    setLeft(presetConfig.left);
    setRight(presetConfig.right);
  };

  const handleConfirm = () => {
    onSave({
      top: Math.max(0, Number(top) || 0),
      bottom: Math.max(0, Number(bottom) || 0),
      left: Math.max(0, Number(left) || 0),
      right: Math.max(0, Number(right) || 0),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#181d27] border border-[#2d3544] w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#2d3544] flex items-center justify-between bg-[#13171f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Layout className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Margens da Página (A4)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Defina o espaçamento das margens do documento
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-[#232936] rounded-xl transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar text-white flex-1">
          {/* Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
              Modelos Predefinidos (Presets)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRESETS_MARGENS.map((preset) => {
                const isSelected =
                  top === preset.config.top &&
                  bottom === preset.config.bottom &&
                  left === preset.config.left &&
                  right === preset.config.right;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.config)}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-500/15 border-blue-500 text-blue-300 shadow-md shadow-blue-500/10'
                        : 'bg-[#13171f] border-[#2d3544] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold text-white">{preset.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      {preset.descricao}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ajuste Numérico Personalizado */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Ajuste Personalizado (Milímetros - mm)
              </label>
              <button
                type="button"
                onClick={() => handleApplyPreset({ top: 20, bottom: 20, left: 25, right: 25 })}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Restaurar Padrão
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#13171f] p-4 rounded-2xl border border-[#2d3544]">
              {/* Superior */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-400">
                  Superior (mm)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={top}
                  onChange={(e) => setTop(Number(e.target.value))}
                  className="w-full bg-[#181d27] border border-[#2d3544] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 text-center font-bold"
                />
              </div>

              {/* Inferior */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-400">
                  Inferior (mm)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={bottom}
                  onChange={(e) => setBottom(Number(e.target.value))}
                  className="w-full bg-[#181d27] border border-[#2d3544] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 text-center font-bold"
                />
              </div>

              {/* Esquerda */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-400">
                  Esquerda (mm)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={left}
                  onChange={(e) => setLeft(Number(e.target.value))}
                  className="w-full bg-[#181d27] border border-[#2d3544] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 text-center font-bold"
                />
              </div>

              {/* Direita */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-400">
                  Direita (mm)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={right}
                  onChange={(e) => setRight(Number(e.target.value))}
                  className="w-full bg-[#181d27] border border-[#2d3544] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 text-center font-bold"
                />
              </div>
            </div>
          </div>

          {/* Miniatura visual de demonstração */}
          <div className="bg-[#13171f] p-4 rounded-2xl border border-[#2d3544] flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
              Representação Visual Proporcional
            </span>
            <div
              className="w-36 h-48 bg-white rounded shadow-inner relative overflow-hidden border border-slate-300"
              style={{
                paddingTop: `${(top / 297) * 100}%`,
                paddingBottom: `${(bottom / 297) * 100}%`,
                paddingLeft: `${(left / 210) * 100}%`,
                paddingRight: `${(right / 210) * 100}%`,
              }}
            >
              <div className="w-full h-full border border-dashed border-blue-400/80 bg-blue-50/50 flex flex-col justify-between p-1">
                <div className="h-1 bg-slate-300 rounded w-3/4 mb-1" />
                <div className="h-1 bg-slate-200 rounded w-full mb-1" />
                <div className="h-1 bg-slate-200 rounded w-5/6 mb-1" />
                <div className="h-1 bg-slate-300 rounded w-1/2" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2d3544] flex items-center justify-end gap-3 bg-[#13171f]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#232936] hover:bg-[#2e3748] text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Aplicar Margens
          </button>
        </div>
      </div>
    </div>
  );
};
