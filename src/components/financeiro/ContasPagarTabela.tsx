import React from 'react';

import { formatLocalDate } from '../../utils/dateUtils';
import { alertPermissionRestriction, canEditFinanceiro } from '../../utils/permissions';

import { ChevronDown, ChevronUp, DollarSign, Eye, Pencil, Trash2 } from 'lucide-react';
import type { useContasPagar } from '../../hooks/useContasPagar';

type EstadoContasPagar = ReturnType<typeof useContasPagar>;

interface Props extends Pick<EstadoContasPagar, 'despesas' | 'handleExcluirParcela' | 'isVisible' | 'loading' | 'navigate' | 'openBaixaModal' | 'openDetalhes' | 'parcelas' | 'setSortDirection' | 'setSortField' | 'sortDirection' | 'sortField' | 'sortedParcelas' | 'state'> {
  getStatusBadge: (status: string, vencimento: string) => React.ReactNode;
}

/**
 * A tabela de parcelas: cabeçalho ordenável, as linhas e os botões de ação.
 *
 * Recebe `sortedParcelas` já filtrada e ordenada pelo hook — a decisão de o quê mostrar não
 * mora aqui. `getStatusBadge` vem por prop porque é declarado no componente-pai, ao lado do
 * modal de detalhes, que usa o mesmo.
 *
 * **Quirk preservado**: parcela paga apenas DESABILITA editar e excluir, em vez de removê-los
 * como o lado das receitas faz desde 14/09/2026 — e a condição é `status === 'pago'` escrita à
 * mão, não `parcelaLiquidada`. Ver `e2e/contas-pagar.spec.ts`, que trava o estado atual.
 */
export const ContasPagarTabela: React.FC<Props> = ({ despesas, getStatusBadge, handleExcluirParcela, isVisible, loading, navigate, openBaixaModal, openDetalhes, parcelas, setSortDirection, setSortField, sortDirection, sortField, sortedParcelas, state }) => {
  return (
    <>
    <div className="flex-1 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-bg-surface border-b border-border-default text-xs uppercase tracking-wider text-text-subtle font-semibold">
            <th 
              className="px-6 py-4 cursor-pointer hover:bg-bg-hover transition-colors"
              onClick={() => {
                if (sortField === 'credor') {
                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortField('credor');
                  setSortDirection('asc');
                }
              }}
            >
              <div className="flex items-center gap-2">
                Credor
                {sortField === 'credor' && (
                  sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />
                )}
              </div>
            </th>
            {isVisible('descricao') && <th className="px-6 py-4">Descrição</th>}
            <th 
              className="px-6 py-4 cursor-pointer hover:bg-bg-hover transition-colors"
              onClick={() => {
                if (sortField === 'vencimento') {
                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortField('vencimento');
                  setSortDirection('asc');
                }
              }}
            >
              <div className="flex items-center gap-2">
                Vencimento
                {sortField === 'vencimento' && (
                  sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />
                )}
              </div>
            </th>
            {isVisible('valor') && <th className="px-6 py-4 text-right">Valor</th>}
            {isVisible('status') && <th className="px-6 py-4">Status</th>}
            {isVisible('acoes') && <th className="px-6 py-4 text-center">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#475569]">
          {loading ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-text-subtle">
                <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                Carregando parcelas...
              </td>
            </tr>
          ) : sortedParcelas.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-text-subtle">
                Nenhuma parcela encontrada.
              </td>
            </tr>
          ) : (
            sortedParcelas.map((parcela) => (
              <tr key={parcela.id} className="hover:bg-[#1A1D36] transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-text-base">{parcela.credor_nome || 'Não informado'}</div>
                  <div className="text-sm text-text-subtle">{(parcela.tipo_credor || 'fornecedor').replace('_', ' ').toUpperCase()}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-text-base">{parcela.descricao}</div>
                  <div className="text-sm text-text-subtle">Parc. {parcela.numero_parcela}/{parcela.total_parcelas || 1}</div>
                </td>
                <td className="px-6 py-4">
                  {formatLocalDate(parcela.data_vencimento)}
                </td>
                <td className="px-6 py-4 text-right font-medium text-text-base">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcela.valor)}
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(parcela.status, parcela.data_vencimento)}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {/* Ver Detalhes */}
                    <button
                      type="button"
                      onClick={() => openDetalhes(parcela)}
                      title="Ver Detalhes"
                      className="p-1.5 rounded-lg bg-bg-surface hover:bg-bg-hover text-text-subtle hover:text-text-base border border-border-default transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Editar */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!canEditFinanceiro(state.user, state.isOnline)) {
                          alertPermissionRestriction('Financeiro (Contas a Pagar)', 'editar despesas ou parcelas existentes');
                          return;
                        }
                        navigate(`/financeiro/contas-a-pagar/${parcela.despesa_id || parcela.id}/editar?parcela=${parcela.id}`);
                      }}
                      title="Editar Despesa"
                      disabled={parcela.status === 'pago'}
                      className={`p-1.5 rounded-lg transition-colors ${parcela.status === 'pago' ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400'}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* Excluir Parcela */}
                    <button
                      type="button"
                      onClick={() => handleExcluirParcela(parcela)}
                      title="Excluir Parcela"
                      disabled={parcela.status === 'pago'}
                      className={`p-1.5 rounded-lg transition-colors ${parcela.status === 'pago' ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Botão Pagar */}
                    {(parcela.status === 'pendente' || parcela.status === 'atrasado') && (
                      <button
                        type="button"
                        onClick={() => openBaixaModal(parcela)}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ml-1"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Pagar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    </>
  );
};
