import React from 'react';

import { formatLocalDate, formatLocalDateTime } from '../../utils/dateUtils';
import { alertPermissionRestriction, canEditFinanceiro } from '../../utils/permissions';
import { MENSAGEM_PARCELA_LIQUIDADA, parcelaLiquidada } from '../../utils/statusParcela';

import { CheckCircle2, CreditCard, DollarSign, FileText, Lock, MessageCircle, Pencil, Printer, Trash2, User, X } from 'lucide-react';
import type { useContasReceber } from '../../hooks/useContasReceber';

type EstadoContasReceber = ReturnType<typeof useContasReceber>;

interface Props extends Pick<EstadoContasReceber, 'getDevedorContato' | 'handleExcluirParcela' | 'handleExcluirReceitaCompleta' | 'handleImprimirRecibo' | 'handleWhatsAppCobrança' | 'navigate' | 'openBaixaModal' | 'parcelaDetalhes' | 'receitaPai' | 'setShowDetalhesModal' | 'showDetalhesModal' | 'state'> {
  getStatusBadge: (status: string, vencimento: string) => React.ReactNode;
}

/**
 * O modal de detalhes da parcela.
 *
 * Mistura duas fontes: o que a tela já tinha em memória (a parcela) e o que `openDetalhes`
 * busca depois de abrir (a receita pai — categoria, valor total, observações). Ao mexer aqui,
 * lembre que os dois lados renderizam juntos e que só o segundo pode faltar.
 */
export const ContasReceberDetalhesModal: React.FC<Props> = ({ getDevedorContato, getStatusBadge, handleExcluirParcela, handleExcluirReceitaCompleta, handleImprimirRecibo, handleWhatsAppCobrança, navigate, openBaixaModal, parcelaDetalhes, receitaPai, setShowDetalhesModal, showDetalhesModal, state }) => {
  return (
    <>
    {showDetalhesModal && parcelaDetalhes && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:static print:bg-transparent print:p-0 print:block">
        <div className="bg-bg-subtle border border-border-default rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none print:bg-transparent">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border-default bg-bg-surface/50 print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-text-base">Detalhes da Contas a Receber</h3>
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

            {/* Devedor Info */}
            <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-3">
              <div className="flex items-center gap-2 text-text-subtle text-xs font-semibold uppercase tracking-wider border-b border-border-default pb-2">
                <User className="w-4 h-4 text-blue-400" />
                Informações do Devedor
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-subtle block">Nome / Razão Social</span>
                  <span className="font-semibold text-text-base">{parcelaDetalhes.devedor_nome || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-text-subtle block">CPF / CNPJ</span>
                  <span className="font-semibold text-text-base">{parcelaDetalhes.devedor_cpf_cnpj || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-text-subtle block">Tipo de Devedor</span>
                  <span className="font-semibold text-text-base capitalize">{(parcelaDetalhes.tipo_devedor || 'associado').replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-text-subtle block">Telefone / WhatsApp</span>
                  <span className="font-semibold text-text-base">
                    {(() => {
                      const contato = getDevedorContato(parcelaDetalhes);
                      return contato.telefone ? (
                        <span className="font-mono text-emerald-500 font-medium">{contato.telefone}</span>
                      ) : (
                        <span className="text-text-subtle italic text-xs">Não cadastrado</span>
                      );
                    })()}
                  </span>
                </div>
                {receitaPai?.associado_plano && (
                  <div className="md:col-span-2">
                    <span className="text-text-subtle block">Plano do Associado</span>
                    <span className="font-semibold text-emerald-400">{receitaPai.associado_plano}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Parcela & Receita Info */}
            <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-3">
              <div className="flex items-center gap-2 text-text-subtle text-xs font-semibold uppercase tracking-wider border-b border-border-default pb-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Dados da Parcela & Cobrança
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-subtle block">Descrição</span>
                  <span className="font-semibold text-text-base">{parcelaDetalhes.descricao}</span>
                </div>
                <div>
                  <span className="text-text-subtle block">Categoria</span>
                  <span className="font-semibold text-text-base capitalize">{receitaPai?.categoria || 'Não informada'}</span>
                </div>
                <div>
                  <span className="text-text-subtle block">Valor da Parcela</span>
                  <span className="text-lg font-bold text-emerald-400">
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
                {receitaPai && (
                  <div>
                    <span className="text-text-subtle block">Valor Total da Receita</span>
                    <span className="font-semibold text-text-base">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitaPai.valor_total)} ({receitaPai.qtd_parcelas}x)
                    </span>
                  </div>
                )}
                {receitaPai?.data_emissao && (
                  <div>
                    <span className="text-text-subtle block">Data de Emissão</span>
                    <span className="font-semibold text-text-base">
                      {formatLocalDate(receitaPai.data_emissao)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status do Recebimento (Se Recebido) */}
            {parcelaDetalhes.status === 'recebido' && (
              <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider border-b border-emerald-500/20 pb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Informações do Recebimento Efetivado
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-subtle block">Data do Recebimento</span>
                    <span className="font-semibold text-text-base">
                      {formatLocalDateTime(parcelaDetalhes.data_recebimento)}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Valor Recebido</span>
                    <span className="font-bold text-emerald-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcelaDetalhes.valor_recebido || parcelaDetalhes.valor)}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Forma Efetiva</span>
                    <span className="font-semibold text-text-base uppercase">{parcelaDetalhes.forma_pagamento_efetivo || 'pix'}</span>
                  </div>
                  <div>
                    <span className="text-text-subtle block">Recebido Por</span>
                    <span className="font-semibold text-text-base">{parcelaDetalhes.recebido_por || 'Sistema'}</span>
                  </div>
                  {parcelaDetalhes.observacao_recebimento && (
                    <div className="md:col-span-2">
                      <span className="text-text-subtle block">Observação do Recebimento</span>
                      <span className="font-medium text-text-base">{parcelaDetalhes.observacao_recebimento}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Observações da receita */}
            {receitaPai?.observacoes && (
              <div className="bg-bg-surface p-4 rounded-xl border border-border-default">
                <span className="text-text-subtle text-xs font-semibold uppercase tracking-wider block mb-1">Observações da Receita</span>
                <p className="text-sm text-text-base">{receitaPai.observacoes}</p>
              </div>
            )}

          </div>

          {/* Modal Footer Actions */}
          <div className="p-6 border-t border-border-default bg-bg-surface/50 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2">
              {!parcelaLiquidada(parcelaDetalhes.status) && (
                <>
              <button
                type="button"
                onClick={() => {
                  if (!canEditFinanceiro(state.user, state.isOnline)) {
                    alertPermissionRestriction('Financeiro (Contas a Receber)', 'editar receitas ou parcelas existentes');
                    return;
                  }
                  setShowDetalhesModal(false);
                  navigate(`/financeiro/contas-a-receber/${parcelaDetalhes.receita_id || parcelaDetalhes.id}/editar?parcela=${parcelaDetalhes.id}`);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
              >
                <Pencil className="w-4 h-4" />
                Editar Receita
              </button>
              <button
                type="button"
                onClick={() => {
                  if (parcelaDetalhes.receita_id) {
                    handleExcluirReceitaCompleta(parcelaDetalhes.receita_id, parcelaDetalhes.descricao || '');
                  } else {
                    handleExcluirParcela(parcelaDetalhes);
                    setShowDetalhesModal(false);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
              >
                <Trash2 className="w-4 h-4" />
                Excluir Receita
              </button>
                </>
              )}
              {parcelaLiquidada(parcelaDetalhes.status) && (
                <p className="text-xs text-text-subtle flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  {MENSAGEM_PARCELA_LIQUIDADA}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {parcelaDetalhes.status !== 'recebido' && parcelaDetalhes.status !== 'cancelado' && (
                <button
                  type="button"
                  onClick={() => handleWhatsAppCobrança(parcelaDetalhes)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 font-medium text-sm transition-colors"
                  title="Enviar Cobrança via WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </button>
              )}
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
                  Receber
                </button>
              )}
              {parcelaDetalhes.status === 'recebido' && (
                <button
                  type="button"
                  onClick={() => handleImprimirRecibo(parcelaDetalhes)}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-500/20"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Recibo
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
