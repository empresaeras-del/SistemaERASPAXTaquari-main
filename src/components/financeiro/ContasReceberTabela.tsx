import React from 'react';

import { formatLocalDate } from '../../utils/dateUtils';
import { alertPermissionRestriction, canEditFinanceiro } from '../../utils/permissions';
import { MENSAGEM_PARCELA_LIQUIDADA, parcelaLiquidada } from '../../utils/statusParcela';

import { ChevronDown, ChevronUp, DollarSign, Eye, Lock, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import type { useContasReceber } from '../../hooks/useContasReceber';

type EstadoContasReceber = ReturnType<typeof useContasReceber>;

interface Props extends Pick<EstadoContasReceber, 'getDevedorContato' | 'handleExcluirParcela' | 'handleWhatsAppCobrança' | 'isVisible' | 'loading' | 'navigate' | 'openBaixaModal' | 'openDetalhes' | 'setSortDirection' | 'setSortField' | 'sortDirection' | 'sortField' | 'sortedParcelas' | 'state'> {
  getStatusBadge: (status: string, vencimento: string) => React.ReactNode;
}

/**
 * A tabela de parcelas: cabeçalho ordenável, as linhas e os botões de ação.
 *
 * Recebe `sortedParcelas` já filtrada e ordenada pelo hook — a decisão de o quê mostrar não
 * mora aqui. `getStatusBadge` vem por prop porque é declarado no componente-pai, ao lado do
 * modal de detalhes, que usa o mesmo.
 */
export const ContasReceberTabela: React.FC<Props> = ({ getDevedorContato, getStatusBadge, handleExcluirParcela, handleWhatsAppCobrança, isVisible, loading, navigate, openBaixaModal, openDetalhes, setSortDirection, setSortField, sortDirection, sortField, sortedParcelas, state }) => {
  return (
    <>
    <div className="flex-1 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-bg-surface border-b border-border-default text-xs uppercase tracking-wider text-text-subtle font-semibold">
            <th 
              className="px-6 py-4 cursor-pointer hover:bg-bg-hover transition-colors"
              onClick={() => {
                if (sortField === 'devedor') {
                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortField('devedor');
                  setSortDirection('asc');
                }
              }}
            >
              <div className="flex items-center gap-2">
                Devedor
                {sortField === 'devedor' && (
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
                  <div className="font-medium text-text-base">{parcela.devedor_nome || 'Não informado'}</div>
                  <div className="text-sm text-text-subtle">{(parcela.tipo_devedor || 'associado').replace('_', ' ').toUpperCase()}</div>
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

                    {/* WhatsApp Cobrança */}
                    <button
                      type="button"
                      onClick={() => handleWhatsAppCobrança(parcela)}
                      title={
                        (() => {
                          const contato = getDevedorContato(parcela);
                          return contato.telefone 
                            ? `Enviar Cobrança via WhatsApp (${contato.telefone})` 
                            : 'Enviar Cobrança via WhatsApp (Sem telefone cadastrado)';
                        })()
                      }
                      className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>

                    {/* Ver Detalhes */}
                    <button
                      type="button"
                      onClick={() => openDetalhes(parcela)}
                      title="Ver Detalhes"
                      className="p-1.5 rounded-lg bg-bg-surface hover:bg-bg-hover text-text-subtle hover:text-text-base border border-border-default transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Parcela liquidada não mostra editar nem excluir. Antes os
                        dois ficavam `disabled` — e só olhavam 'recebido', então uma
                        parcela 'pago' seguia editável e excluível aqui. */}
                    {!parcelaLiquidada(parcela.status) && (
                      <>
                        {/* Editar */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!canEditFinanceiro(state.user, state.isOnline)) {
                              alertPermissionRestriction('Financeiro (Contas a Receber)', 'editar parcelas ou receitas existentes');
                              return;
                            }
                            navigate(`/financeiro/contas-a-receber/${parcela.receita_id || parcela.id}/editar?parcela=${parcela.id}`);
                          }}
                          title="Editar Receita"
                          className="p-1.5 rounded-lg transition-colors bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Excluir Parcela */}
                        <button
                          type="button"
                          onClick={() => handleExcluirParcela(parcela)}
                          title="Excluir Parcela"
                          className="p-1.5 rounded-lg transition-colors bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {parcelaLiquidada(parcela.status) && (
                      <span title={MENSAGEM_PARCELA_LIQUIDADA} className="p-1.5 text-text-subtle/60">
                        <Lock className="w-4 h-4" />
                      </span>
                    )}

                    {/* Botão Receber */}
                    {(parcela.status === 'pendente' || parcela.status === 'atrasado') && (
                      <button
                        type="button"
                        onClick={() => openBaixaModal(parcela)}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ml-1"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Receber
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
