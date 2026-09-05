import React from 'react';
import { Trash2, DollarSign, Printer, Edit3 } from 'lucide-react';
import { ParcelaReceber } from '../../services/financeiroService';
import { formatLocalDate, formatCurrency } from '../../utils/formatters';

interface MensalidadesListaParcelasProps {
  filtradasTabela: ParcelaReceber[];
  loading: boolean;
  isAdmin: boolean;
  selectedParcelas: string[];
  setSelectedParcelas: (ids: string[]) => void;
  filtroStatus: string;
  setFiltroStatus: (status: string) => void;
  filtroPeriodoInicio: string;
  setFiltroPeriodoInicio: (inicio: string) => void;
  filtroPeriodoFim: string;
  setFiltroPeriodoFim: (fim: string) => void;
  setShowMassDeleteJustificativa: (show: boolean) => void;
  openBaixaModal: (parcela: ParcelaReceber) => void;
  handleImprimirRecibo: (parcela: ParcelaReceber) => void;
  setEditingParcela: (parcela: ParcelaReceber) => void;
  setParcelaToDelete: (parcela: ParcelaReceber) => void;
}

export const MensalidadesListaParcelas: React.FC<MensalidadesListaParcelasProps> = ({
  filtradasTabela,
  loading,
  isAdmin,
  selectedParcelas,
  setSelectedParcelas,
  filtroStatus,
  setFiltroStatus,
  filtroPeriodoInicio,
  setFiltroPeriodoInicio,
  filtroPeriodoFim,
  setFiltroPeriodoFim,
  setShowMassDeleteJustificativa,
  openBaixaModal,
  handleImprimirRecibo,
  setEditingParcela,
  setParcelaToDelete
}) => {
  return (
    <div className="space-y-4">
      {/* BARRA DE FILTROS DA TABELA */}
      <div className="flex flex-col sm:flex-row gap-3 items-end bg-bg-surface p-3.5 rounded-2xl border border-border-default">
        <div className="w-full sm:w-auto">
          <label className="block text-[10px] font-bold uppercase text-text-subtle mb-1">Situação</label>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="w-full bg-bg-subtle border border-border-default rounded-xl px-3 py-1.5 text-xs text-text-base focus:border-[#3B82F6] outline-none"
          >
            <option value="all">Todas as Situações</option>
            <option value="pendente">Pendentes</option>
            <option value="recebido">Pagas</option>
            <option value="vencido">Vencidas</option>
            <option value="cancelado">Canceladas</option>
          </select>
        </div>

        <div className="w-full sm:w-auto">
          <label className="block text-[10px] font-bold uppercase text-text-subtle mb-1">Período de Vencimento</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filtroPeriodoInicio}
              onChange={(e) => setFiltroPeriodoInicio(e.target.value)}
              className="bg-bg-subtle border border-border-default rounded-xl px-2.5 py-1 text-xs text-text-base focus:border-[#3B82F6] outline-none"
            />
            <span className="text-text-subtle text-xs">até</span>
            <input
              type="date"
              value={filtroPeriodoFim}
              onChange={(e) => setFiltroPeriodoFim(e.target.value)}
              className="bg-bg-subtle border border-border-default rounded-xl px-2.5 py-1 text-xs text-text-base focus:border-[#3B82F6] outline-none"
            />
          </div>
        </div>

        <div className="flex-1 flex justify-end gap-2 items-center">
          {selectedParcelas.length > 0 && isAdmin && (
            <button
              type="button"
              onClick={() => setShowMassDeleteJustificativa(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir ({selectedParcelas.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => { setFiltroStatus('all'); setFiltroPeriodoInicio(''); setFiltroPeriodoFim(''); }}
            className="text-xs font-medium text-[#3B82F6] hover:text-blue-400 px-2 py-1.5"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* TABELA DE PARCELAS */}
      <div className="border border-border-default rounded-2xl overflow-hidden bg-bg-surface shadow-sm">
        <table className="w-full text-left text-xs text-text-subtle">
          <thead className="bg-bg-subtle border-b border-border-default text-[10px] uppercase font-bold text-text-muted">
            <tr>
              {isAdmin && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-border-default text-[#3B82F6] focus:ring-[#3B82F6]"
                    checked={filtradasTabela.length > 0 && selectedParcelas.length === filtradasTabela.filter(p => ['pendente', 'vencido'].includes(p.status)).length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const selectable = filtradasTabela.filter(p => ['pendente', 'vencido'].includes(p.status)).map(p => p.id);
                        setSelectedParcelas(selectable);
                      } else {
                        setSelectedParcelas([]);
                      }
                    }}
                  />
                </th>
              )}
              <th className="px-4 py-3">Parcela / Descrição</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Forma Pagto</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center">Carregando dados financeiros...</td></tr>
            ) : filtradasTabela.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Nenhuma mensalidade encontrada com os filtros selecionados.</td></tr>
            ) : (
              filtradasTabela.map(p => {
                const isSelectable = ['pendente', 'vencido'].includes(p.status);
                const isPendente = p.status === 'pendente' || p.status === 'vencido';
                const isRecebido = p.status === 'recebido' || p.status === 'pago';

                return (
                  <tr key={p.id} className="hover:bg-bg-subtle/50 transition-colors">
                    {isAdmin && (
                      <td className="px-4 py-3">
                        {isSelectable && (
                          <input
                            type="checkbox"
                            className="rounded border-border-default text-[#3B82F6] focus:ring-[#3B82F6]"
                            checked={selectedParcelas.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedParcelas([...selectedParcelas, p.id]);
                              } else {
                                setSelectedParcelas(selectedParcelas.filter(id => id !== p.id));
                              }
                            }}
                          />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-base">{p.descricao}</div>
                      <span className="text-[10px] text-text-subtle font-mono">#{p.numero_parcela}/{p.total_parcelas || 1}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {formatLocalDate(p.data_vencimento)}
                    </td>
                    <td className="px-4 py-3 font-bold text-white font-mono">
                      {formatCurrency(p.valor)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        p.status === 'recebido' || p.status === 'pago' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        p.status === 'pendente' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        p.status === 'vencido' || p.status === 'atrasado' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {p.status ? p.status.toUpperCase() : 'PENDENTE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 uppercase text-[10px] font-semibold text-text-subtle">
                      {p.forma_pagamento || 'Boleto'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {isPendente && (
                          <button
                            type="button"
                            onClick={() => openBaixaModal(p)}
                            title="Registrar recebimento desta parcela"
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <DollarSign className="w-3 h-3" />
                            Receber
                          </button>
                        )}
                        {isRecebido && (
                          <button
                            type="button"
                            onClick={() => handleImprimirRecibo(p)}
                            title="Imprimir recibo desta parcela"
                            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <Printer className="w-3 h-3" />
                            Recibo
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingParcela({ ...p })}
                              title="Editar parcela"
                              className="p-1 rounded text-text-subtle hover:text-blue-400 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setParcelaToDelete(p)}
                              title="Excluir parcela"
                              className="p-1 rounded text-text-subtle hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
