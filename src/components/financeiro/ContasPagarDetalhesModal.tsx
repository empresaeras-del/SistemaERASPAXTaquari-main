import React from 'react';

import { formatLocalDate, formatLocalDateTime } from '../../utils/dateUtils';
import { alertPermissionRestriction, canEditFinanceiro } from '../../utils/permissions';

import { Building2, CheckCircle2, CreditCard, DollarSign, FileText, Pencil, Printer, Trash2, X } from 'lucide-react';
import type { useContasPagar } from '../../hooks/useContasPagar';

type EstadoContasPagar = ReturnType<typeof useContasPagar>;

interface Props extends Pick<EstadoContasPagar, 'despesaPai' | 'despesas' | 'handleExcluirDespesaCompleta' | 'handleExcluirParcela' | 'handleImprimirComprovante' | 'navigate' | 'openBaixaModal' | 'parcelaDetalhes' | 'parcelas' | 'setShowDetalhesModal' | 'showDetalhesModal' | 'state'> {
  getStatusBadge: (status: string, vencimento: string) => React.ReactNode;
}

/**
 * O modal de detalhes da parcela.
 *
 * Mistura duas fontes: o que a tela já tinha em memória (a parcela) e o que `openDetalhes`
 * busca depois de abrir (a despesa pai — categoria, valor total, código de barras,
 * observações). Ao mexer aqui, lembre que os dois lados renderizam juntos e que só o segundo
 * pode faltar.
 */
export const ContasPagarDetalhesModal: React.FC<Props> = ({ despesaPai, despesas, getStatusBadge, handleExcluirDespesaCompleta, handleExcluirParcela, handleImprimirComprovante, navigate, openBaixaModal, parcelaDetalhes, parcelas, setShowDetalhesModal, showDetalhesModal, state }) => {
  return (
    <>
    {showDetalhesModal && parcelaDetalhes && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:static print:bg-transparent print:p-0 print:block">
        <div className="bg-bg-subtle border border-border-default rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none print:bg-transparent">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border-default bg-bg-surface/50 print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text-base">Detalhes da Contas a Pagar</h3>
                <p className="text-sm text-text-subtle">Parcela {parcelaDetalhes.numero_parcela} de {parcelaDetalhes.total_parcelas || 1}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDetalhesModal(false)}
              className="p-2 rounded-xl text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 print:hidden">

            {/* Credor Info */}
            <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-3">
              <div className="flex items-center gap-2 text-text-subtle text-xs font-semibold uppercase tracking-wider border-b border-border-default pb-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                Informações do Credor / Beneficiário
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-subtle block">Nome / Razão Social</span>
                  <span className="font-semibold text-text-base">{parcelaDetalhes.credor_nome || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-text-subtle block">CPF / CNPJ</span>
                  <span className="font-semibold text-text-base">{parcelaDetalhes.credor_cpf_cnpj || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-text-subtle block">Tipo de Credor</span>
                  <span className="font-semibold text-text-base capitalize">{(parcelaDetalhes.tipo_credor || 'fornecedor').replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-text-subtle block">Centro de Custo</span>
                  <span className="font-semibold text-indigo-400">{despesaPai?.centro_custo || 'Não informado'}</span>
                </div>
              </div>
            </div>

            {/* Parcela & Despesa Info */}
            <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-3">
              <div className="flex items-center gap-2 text-text-subtle text-xs font-semibold uppercase tracking-wider border-b border-border-default pb-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                Dados da Parcela & Despesa
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-subtle block">Descrição</span>
                  <span className="font-semibold text-text-base">{parcelaDetalhes.descricao}</span>
                </div>
                <div>
                  <span className="text-text-subtle block">Categoria</span>
                  <span className="font-semibold text-text-base capitalize">{despesaPai?.categoria || 'Não informada'}</span>
                </div>
                <div>
                  <span className="text-text-subtle block">Valor da Parcela</span>
                  <span className="text-lg font-bold text-indigo-400">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcelaDetalhes.valor)}
                  </span>
                </div>
                <div>
                  <span className="text-text-subtle block">Status</span>
                  <div className="mt-1">{getStatusBadge(parcelaDetalhes.status, parcelaDetalhes.data_vencimento)}</div>
                </div>
                <div>
                  <span className="text-text-subtle block">Data de Vencimento</span>
                  <span className="font-semibold text-text-base">
                    {formatLocalDate(parcelaDetalhes.data_vencimento)}
                  </span>
                </div>
                <div>
                  <span className="text-text-subtle block">Forma de Pagamento Prevista</span>
                  <span className="font-semibold text-text-base uppercase">{parcelaDetalhes.forma_pagamento || 'pix'}</span>
                </div>
                {despesaPai && (
                  <div>
                    <span className="text-text-subtle block">Valor Total da Despesa</span>
                    <span className="font-semibold text-text-base">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(despesaPai.valor_total)} ({despesaPai.qtd_parcelas}x)
                    </span>
                  </div>
                )}
                {despesaPai?.codigo_barras && (
                  <div className="md:col-span-2">
                    <span className="text-text-subtle block">Código de Barras / Linha Digitável</span>
                    <span className="font-mono text-xs bg-bg-base p-2 rounded block border border-border-default text-text-base select-all overflow-x-auto">
                      {despesaPai.codigo_barras}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status do Pagamento (Se Pago) */}
            {parcelaDetalhes.status === 'pago' && (
              <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider border-b border-emerald-500/20 pb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Informações do Pagamento Efetivado
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-subtle block">Data do Pagamento</span>
                    <span className="font-semibold text-text-base">
                      {formatLocalDateTime(parcelaDetalhes.data_pagamento)}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Valor Pago</span>
                    <span className="font-bold text-emerald-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcelaDetalhes.valor_pago || parcelaDetalhes.valor)}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Forma Efetiva</span>
                    <span className="font-semibold text-text-base uppercase">{parcelaDetalhes.forma_pagamento_efetivo || 'pix'}</span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Pago Por</span>
                    <span className="font-semibold text-text-base">{parcelaDetalhes.pago_por || 'Sistema'}</span>
                  </div>
                  {parcelaDetalhes.observacao_pagamento && (
                    <div className="md:col-span-2">
                      <span className="text-text-subtle block">Observação do Pagamento</span>
                      <span className="font-medium text-text-base">{parcelaDetalhes.observacao_pagamento}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Observações da despesa */}
            {despesaPai?.observacoes && (
              <div className="bg-bg-surface p-4 rounded-xl border border-border-default">
                <span className="text-text-subtle text-xs font-semibold uppercase tracking-wider block mb-1">Observações da Despesa</span>
                <p className="text-sm text-text-base">{despesaPai.observacoes}</p>
              </div>
            )}

          </div>

          {/* Modal Footer Actions */}
          <div className="p-6 border-t border-border-default bg-bg-surface/50 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!canEditFinanceiro(state.user, state.isOnline)) {
                    alertPermissionRestriction('Financeiro (Contas a Pagar)', 'editar despesas ou parcelas existentes');
                    return;
                  }
                  setShowDetalhesModal(false);
                  navigate(`/financeiro/contas-a-pagar/${parcelaDetalhes.despesa_id || parcelaDetalhes.id}/editar?parcela=${parcelaDetalhes.id}`);
                }}
                disabled={parcelaDetalhes.status === 'pago'}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${parcelaDetalhes.status === 'pago' ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400'}`}
              >
                <Pencil className="w-4 h-4" />
                Editar Despesa
              </button>
              <button
                type="button"
                onClick={() => {
                  if (parcelaDetalhes.despesa_id) {
                    handleExcluirDespesaCompleta(parcelaDetalhes.despesa_id, parcelaDetalhes.descricao || '');
                  } else {
                    handleExcluirParcela(parcelaDetalhes);
                    setShowDetalhesModal(false);
                  }
                }}
                disabled={parcelaDetalhes.status === 'pago'}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${parcelaDetalhes.status === 'pago' ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'}`}
              >
                <Trash2 className="w-4 h-4" />
                Excluir Despesa
              </button>
            </div>

            <div className="flex items-center gap-2">
              {(parcelaDetalhes.status === 'pendente' || parcelaDetalhes.status === 'atrasado') && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDetalhesModal(false);
                    openBaixaModal(parcelaDetalhes);
                  }}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm transition-colors"
                >
                  <DollarSign className="w-4 h-4" />
                  Pagar
                </button>
              )}
              {parcelaDetalhes.status === 'pago' && (
                <button
                  type="button"
                  onClick={() => handleImprimirComprovante(parcelaDetalhes)}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-500/20"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Comprovante
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowDetalhesModal(false)}
                className="px-5 py-2 rounded-xl bg-bg-surface border border-border-default text-text-muted hover:text-text-base transition-colors font-medium text-sm"
              >
                Fechar
              </button>
            </div>
          </div>

        </div>
      </div>
    )}
    </>
  );
};
