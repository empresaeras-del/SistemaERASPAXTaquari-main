import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Table as TableIcon, Rows3, Columns3, Merge, Split, Trash2, Palette,
  ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, Eye, EyeOff, Sliders, Ruler,
} from 'lucide-react';
import {
  buildOccupancy, countColumns, mergeCells, splitCell,
  insertRow, deleteRow, insertColumn, deleteColumn, setColumnWidth, CellRef,
} from '../../utils/tableGridModel';

export interface DocumentoTableEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  onSave: (newHtml: string) => void;
}

interface Coord { r: number; c: number; }

export const DocumentoTableEditModal: React.FC<DocumentoTableEditModalProps> = ({
  isOpen, onClose, htmlContent, onSave,
}) => {
  const docRef = useRef<Document | null>(null);
  const [tables, setTables] = useState<HTMLTableElement[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selStart, setSelStart] = useState<Coord | null>(null);
  const [selEnd, setSelEnd] = useState<Coord | null>(null);
  const [tick, forceTick] = useState(0);
  const rerender = () => forceTick(t => t + 1);
  const [colWidthInput, setColWidthInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const parsed = new DOMParser().parseFromString(htmlContent || '<p></p>', 'text/html');
    docRef.current = parsed;
    setTables(Array.from(parsed.querySelectorAll('table')));
    setSelectedIdx(0);
    setSelStart(null);
    setSelEnd(null);
  }, [isOpen, htmlContent]);

  const table = tables[selectedIdx] || null;
  const grid = useMemo(() => (table ? buildOccupancy(table) : []), [table, tick]);
  const numCols = countColumns(grid);
  const numRows = grid.length;

  if (!isOpen) return null;

  const selRect = selStart && selEnd ? {
    rMin: Math.min(selStart.r, selEnd.r), rMax: Math.max(selStart.r, selEnd.r),
    cMin: Math.min(selStart.c, selEnd.c), cMax: Math.max(selStart.c, selEnd.c),
  } : null;

  const isSelected = (r: number, c: number) =>
    !!selRect && r >= selRect.rMin && r <= selRect.rMax && c >= selRect.cMin && c <= selRect.cMax;

  const handleCellClick = (r: number, c: number, shiftKey: boolean) => {
    if (shiftKey && selStart) {
      setSelEnd({ r, c });
    } else {
      setSelStart({ r, c });
      setSelEnd({ r, c });
    }
  };

  const currentOriginRef = (): CellRef | null => {
    if (!selStart || !table) return null;
    return grid[selStart.r]?.[selStart.c] || null;
  };

  const withTable = (fn: (t: HTMLTableElement) => void) => {
    if (!table) return;
    fn(table);
    rerender();
  };

  const handleMerge = () => {
    if (!table || !selRect) return;
    const res = mergeCells(table, selRect.rMin, selRect.cMin, selRect.rMax, selRect.cMax);
    if (!res.ok) {
      alert(res.motivo);
      return;
    }
    setSelStart({ r: selRect.rMin, c: selRect.cMin });
    setSelEnd({ r: selRect.rMin, c: selRect.cMin });
    rerender();
  };

  const handleSplit = () => {
    const ref = currentOriginRef();
    if (!table || !ref) return;
    splitCell(table, ref.originRow, ref.originCol);
    rerender();
  };

  const handleInsertRow = (position: 'above' | 'below') => {
    const row = selStart?.r ?? 0;
    withTable(t => insertRow(t, row, position));
  };

  const handleDeleteRow = () => {
    const row = selStart?.r ?? 0;
    withTable(t => deleteRow(t, row));
    setSelStart(null);
    setSelEnd(null);
  };

  const handleInsertColumn = (position: 'left' | 'right') => {
    const col = selStart?.c ?? 0;
    withTable(t => insertColumn(t, col, position));
  };

  const handleDeleteColumn = () => {
    const col = selStart?.c ?? 0;
    withTable(t => deleteColumn(t, col));
    setSelStart(null);
    setSelEnd(null);
  };

  const handleToggleBorder = () => {
    if (!table) return;
    table.classList.toggle('tabela-sem-grade');
    rerender();
  };

  const handleToggleZebra = () => {
    if (!table) return;
    table.classList.toggle('tabela-zebrada');
    rerender();
  };

  const handleApplyBackground = (cor: string) => {
    if (!table || !selRect) return;
    const seen = new Set<HTMLTableCellElement>();
    for (let r = selRect.rMin; r <= selRect.rMax; r++) {
      for (let c = selRect.cMin; c <= selRect.cMax; c++) {
        const ref = grid[r]?.[c];
        if (ref && !seen.has(ref.el)) {
          seen.add(ref.el);
          ref.el.style.backgroundColor = cor;
        }
      }
    }
    rerender();
  };

  const handleApplyColumnWidth = () => {
    const width = parseInt(colWidthInput, 10);
    if (!table || !selStart || !width || width <= 0) return;
    setColumnWidth(table, selStart.c, width);
    rerender();
  };

  const handleDeleteTable = () => {
    if (!table) return;
    if (!window.confirm('Excluir esta tabela do documento?')) return;
    table.remove();
    const remaining = docRef.current ? Array.from(docRef.current.querySelectorAll('table')) : [];
    setTables(remaining);
    setSelectedIdx(0);
    setSelStart(null);
    setSelEnd(null);
  };

  const handleSaveAll = () => {
    if (!docRef.current) return;
    onSave(docRef.current.body.innerHTML);
    onClose();
  };

  const origin = currentOriginRef();
  const canSplit = !!origin && (origin.rowSpan > 1 || origin.colSpan > 1);
  const canMerge = !!selRect && (selRect.rMax > selRect.rMin || selRect.cMax > selRect.cMin);

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#181d27] border border-[#2d3544] w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#2d3544] flex items-center justify-between bg-[#13171f] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <TableIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Editor de Tabelas (modelo Office)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Mescle, divida, redimensione e formate células como no Word/Excel</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-[#232936] rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {tables.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            Nenhuma tabela encontrada no conteúdo do documento. Use &quot;Tabelas &amp; Grades&quot; para inserir uma primeiro.
          </div>
        ) : (
          <>
            {/* Seletor de tabela (quando há mais de uma) */}
            {tables.length > 1 && (
              <div className="px-5 py-2.5 border-b border-[#2d3544] bg-[#13171f] flex items-center gap-2 overflow-x-auto shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold shrink-0">Tabelas no documento:</span>
                {tables.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setSelectedIdx(i); setSelStart(null); setSelEnd(null); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-colors ${
                      i === selectedIdx ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-[#1e2533] text-slate-400 border border-[#2d3544] hover:text-slate-200'
                    }`}
                  >
                    Tabela {i + 1} ({t.rows.length}×{countColumns(buildOccupancy(t))})
                  </button>
                ))}
              </div>
            )}

            {/* Barra de ferramentas */}
            <div className="px-5 py-3 border-b border-[#2d3544] bg-[#13171f] flex flex-wrap items-center gap-2 shrink-0">
              <button type="button" onClick={handleMerge} disabled={!canMerge}
                className="px-2.5 py-1.5 bg-[#1e2533] hover:bg-indigo-500/20 disabled:opacity-30 disabled:hover:bg-[#1e2533] text-slate-200 hover:text-indigo-300 border border-[#2d3544] rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5">
                <Merge className="w-3.5 h-3.5" /> Mesclar
              </button>
              <button type="button" onClick={handleSplit} disabled={!canSplit}
                className="px-2.5 py-1.5 bg-[#1e2533] hover:bg-indigo-500/20 disabled:opacity-30 disabled:hover:bg-[#1e2533] text-slate-200 hover:text-indigo-300 border border-[#2d3544] rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5">
                <Split className="w-3.5 h-3.5" /> Dividir
              </button>

              <div className="w-px h-5 bg-[#2d3544] mx-1" />

              <button type="button" onClick={() => handleInsertRow('above')} className="px-2.5 py-1.5 bg-[#1e2533] hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-[#2d3544] rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5">
                <ArrowUpToLine className="w-3.5 h-3.5" /> Linha acima
              </button>
              <button type="button" onClick={() => handleInsertRow('below')} className="px-2.5 py-1.5 bg-[#1e2533] hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-[#2d3544] rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5">
                <ArrowDownToLine className="w-3.5 h-3.5" /> Linha abaixo
              </button>
              <button type="button" onClick={handleDeleteRow} disabled={numRows <= 1} className="px-2.5 py-1.5 bg-[#1e2533] hover:bg-rose-500/20 disabled:opacity-30 text-slate-200 hover:text-rose-300 border border-[#2d3544] rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5">
                <Rows3 className="w-3.5 h-3.5" /> Excluir linha
              </button>

              <div className="w-px h-5 bg-[#2d3544] mx-1" />

              <button type="button" onClick={() => handleInsertColumn('left')} className="px-2.5 py-1.5 bg-[#1e2533] hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-[#2d3544] rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5">
                <ArrowLeftToLine className="w-3.5 h-3.5" /> Coluna à esq.
              </button>
              <button type="button" onClick={() => handleInsertColumn('right')} className="px-2.5 py-1.5 bg-[#1e2533] hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-[#2d3544] rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5">
                <ArrowRightToLine className="w-3.5 h-3.5" /> Coluna à dir.
              </button>
              <button type="button" onClick={handleDeleteColumn} disabled={numCols <= 1} className="px-2.5 py-1.5 bg-[#1e2533] hover:bg-rose-500/20 disabled:opacity-30 text-slate-200 hover:text-rose-300 border border-[#2d3544] rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5">
                <Columns3 className="w-3.5 h-3.5" /> Excluir coluna
              </button>

              <div className="w-px h-5 bg-[#2d3544] mx-1" />

              <button type="button" onClick={handleToggleBorder} className="px-2.5 py-1.5 bg-[#1e2533] hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-[#2d3544] rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5">
                {table?.classList.contains('tabela-sem-grade') ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} Bordas
              </button>
              <button type="button" onClick={handleToggleZebra} className="px-2.5 py-1.5 bg-[#1e2533] hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-[#2d3544] rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> Zebrado
              </button>
              <label className="px-2.5 py-1.5 bg-[#1e2533] hover:bg-fuchsia-500/20 text-slate-200 hover:text-fuchsia-300 border border-[#2d3544] rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer">
                <Palette className="w-3.5 h-3.5" /> Cor de fundo
                <input type="color" className="w-4 h-4 rounded cursor-pointer" onChange={(e) => handleApplyBackground(e.target.value)} />
              </label>

              <div className="w-px h-5 bg-[#2d3544] mx-1" />

              <div className="flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="number"
                  min={10}
                  placeholder="Largura (px)"
                  value={colWidthInput}
                  onChange={(e) => setColWidthInput(e.target.value)}
                  className="w-24 bg-[#0f1219] border border-[#2d3544] rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500"
                />
                <button type="button" onClick={handleApplyColumnWidth} className="px-2 py-1 bg-[#1e2533] hover:bg-indigo-500/20 text-slate-200 hover:text-indigo-300 border border-[#2d3544] rounded-lg text-[11px] font-semibold transition-all">
                  Aplicar
                </button>
              </div>

              <div className="ml-auto">
                <button type="button" onClick={handleDeleteTable} className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir tabela
                </button>
              </div>
            </div>

            {/* Grade de edição */}
            <div className="flex-1 overflow-auto p-6 bg-[#0f1219]">
              {table && (
                <table className="border-collapse select-none mx-auto" style={{ minWidth: '60%' }}>
                  <tbody>
                    {grid.map((row, r) => (
                      <tr key={r}>
                        {row.map((ref, c) => {
                          if (!ref || ref.originRow !== r || ref.originCol !== c) return null;
                          const selected = isSelected(r, c);
                          return (
                            <td
                              key={c}
                              rowSpan={ref.rowSpan}
                              colSpan={ref.colSpan}
                              onClick={(e) => handleCellClick(r, c, e.shiftKey)}
                              className={`border px-3 py-2 text-[11px] cursor-pointer align-top min-w-[70px] transition-colors ${
                                selected ? 'border-indigo-400 bg-indigo-500/20 text-white' : 'border-[#2d3544] bg-[#181d27] text-slate-300 hover:bg-[#1e2533]'
                              }`}
                              style={{ backgroundColor: !selected ? (ref.el.style.backgroundColor || undefined) : undefined }}
                              title="Clique para selecionar · Shift+clique para selecionar um intervalo"
                            >
                              {ref.el.textContent?.trim() ? ref.el.textContent.trim().slice(0, 40) : <span className="italic text-slate-500">(vazio)</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-center text-[10px] text-slate-500 mt-4">
                Clique em uma célula para selecioná-la · Shift+clique para selecionar um intervalo e mesclar
              </p>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-[#2d3544] flex items-center justify-end gap-3 bg-[#13171f] shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-[#232936] hover:bg-[#2e3748] text-slate-300 rounded-xl text-xs font-semibold transition-colors">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={tables.length === 0}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            Aplicar Alterações ao Documento
          </button>
        </div>
      </div>
    </div>
  );
};
