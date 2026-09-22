import React from 'react';
import { format } from 'date-fns';
import { AlertTriangle, ArrowRight, CheckCircle2, DollarSign, Lock, Wallet, X } from 'lucide-react';
import type { useContasReceber } from '../../hooks/useContasReceber';

type EstadoContasReceber = ReturnType<typeof useContasReceber>;

type Props = Pick<EstadoContasReceber, 'checkingLote' | 'contaBancariaId' | 'contasBancarias' | 'dataRecebimento' | 'formaPagamentoEfetiva' | 'handleBaixa' | 'handleEfetivarRecebimento' | 'loteAberto' | 'modalStage' | 'navigate' | 'observacaoRecebimento' | 'parcelaSelecionada' | 'setContaBancariaId' | 'setDataRecebimento' | 'setFormaPagamentoEfetiva' | 'setModalStage' | 'setObservacaoRecebimento' | 'setShowBaixaModal' | 'setValorRecebido' | 'showBaixaModal' | 'submittingBaixa' | 'valorRecebido'>;

/**
 * O modal de recebimento, nas três etapas: o formulário, o BLOQUEIO quando não há lote de
 * caixa aberto, e a confirmação que mostra em qual lote o dinheiro vai entrar.
 *
 * A etapa de bloqueio é a única que não grava nada, e é a que mais importa: sem lote aberto a
 * baixa seguiria sem movimentação de caixa, e o dinheiro recebido não apareceria no caixa de
 * ninguém.
 */
export const ContasReceberBaixaModal: React.FC<Props> = ({ checkingLote, contaBancariaId, contasBancarias, dataRecebimento, formaPagamentoEfetiva, handleBaixa, handleEfetivarRecebimento, loteAberto, modalStage, navigate, observacaoRecebimento, parcelaSelecionada, setContaBancariaId, setDataRecebimento, setFormaPagamentoEfetiva, setModalStage, setObservacaoRecebimento, setShowBaixaModal, setValorRecebido, showBaixaModal, submittingBaixa, valorRecebido }) => {
  return (
    <>
    {showBaixaModal && parcelaSelecionada && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-bg-subtle border border-border-default rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

          {/* ETAPA 1: FORMULÁRIO DE RECEBIMENTO */}
          {modalStage === 'form' && (
            <>
              <div className="flex items-center justify-between p-6 border-b border-border-default">
                <h3 className="text-xl font-bold text-text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  Registrar Recebimento
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBaixaModal(false)}
                  className="text-text-subtle hover:text-text-base transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleBaixa} className="p-6 space-y-4">
                <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-1">
                  <p className="text-xs text-text-subtle uppercase tracking-wider">Parcela {parcelaSelecionada.numero_parcela}/{parcelaSelecionada.total_parcelas || 1}</p>
                  <p className="text-lg font-bold text-text-base">{parcelaSelecionada.descricao}</p>
                  <p className="text-sm text-text-subtle">Devedor: <span className="text-text-base font-medium">{parcelaSelecionada.devedor_nome}</span></p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-subtle mb-1">Data do Recebimento *</label>
                  <input
                    type="date"
                    value={dataRecebimento}
                    onChange={(e) => setDataRecebimento(e.target.value)}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-subtle mb-1">Valor Recebido (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(Number(e.target.value))}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-subtle mb-1">Forma de Pagamento Efetiva *</label>
                  <select
                    value={formaPagamentoEfetiva}
                    onChange={(e) => setFormaPagamentoEfetiva(e.target.value)}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                  >
                    <option value="pix">PIX</option>
                    <option value="boleto">Boleto</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="cartao_debito">Cartão de Débito</option>
                    <option value="transferencia">Transferência</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cheque">Cheque</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                {formaPagamentoEfetiva !== 'dinheiro' && (
                <div>
                  <label className="block text-sm font-medium text-text-subtle mb-1">Conta Bancária Referencial *</label>
                  <select
                    value={contaBancariaId}
                    onChange={(e) => setContaBancariaId(e.target.value)}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                  >
                    {contasBancarias.map(conta => (
                      <option key={conta.id} value={conta.id}>{conta.nome} ({conta.banco})</option>
                    ))}
                  </select>
                </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-text-subtle mb-1">Observações do Recebimento</label>
                  <textarea
                    rows={2}
                    value={observacaoRecebimento}
                    onChange={(e) => setObservacaoRecebimento(e.target.value)}
                    placeholder="Ex: Recebido em dinheiro no balcão"
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                  <button
                    type="button"
                    onClick={() => setShowBaixaModal(false)}
                    className="px-5 py-2.5 rounded-xl text-text-muted hover:text-text-base hover:bg-bg-hover transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={checkingLote}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    {checkingLote ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Verificando Caixa...
                      </>
                    ) : (
                      'Confirmar Recebimento'
                    )}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ETAPA 2: TELA DE BLOQUEIO (SEM LOTE DE CAIXA ABERTO) */}
          {modalStage === 'bloqueio' && (
            <div className="p-6 space-y-6">
              <div className="flex items-start justify-between border-b border-border-default pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text-base">Operação Bloqueada</h3>
                    <p className="text-xs text-rose-400 font-semibold">Nenhum Lote de Caixa Aberto Encontrado</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBaixaModal(false)}
                  className="text-text-subtle hover:text-text-base transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    Não é possível registrar o recebimento
                  </div>
                  <p className="text-sm text-text-subtle leading-relaxed">
                    Para efetivar este registro de recebimento, o sistema exige que exista um <strong>Lote de Caixa aberto</strong> ativo para receber a movimentação financeira.
                  </p>
                </div>

                <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-2">
                  <p className="text-sm font-semibold text-text-base flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#3B82F6]" />
                    Orientação ao Usuário:
                  </p>
                  <p className="text-xs text-text-subtle leading-relaxed">
                    Por favor, acesse o módulo de <strong>Caixas / Lotes</strong> e realize a abertura de um novo lote de caixa antes de realizar este recebimento.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setModalStage('form')}
                  className="px-5 py-2.5 rounded-xl text-text-muted hover:text-text-base hover:bg-bg-hover transition-colors font-medium text-sm"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBaixaModal(false);
                    navigate('/financeiro/caixas');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
                >
                  <Wallet className="w-4 h-4" />
                  Abrir Lote de Caixa
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 3: TELA DE CONFIRMAÇÃO DE REGISTRO NO LOTE */}
          {modalStage === 'confirmacao' && loteAberto && (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-border-default pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-base">Confirmação de Registro no Lote</h3>
                    <p className="text-xs text-text-subtle">Confira as informações do Lote de Caixa antes de efetivar</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBaixaModal(false)}
                  className="text-text-subtle hover:text-text-base transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* INFO DO LOTE DE CAIXA */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" /> Lote de Caixa Destino
                  </span>
                  <span className="px-2.5 py-1 text-xs font-bold bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/30">
                    {loteAberto.codigo_lote}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-text-subtle pt-2 border-t border-emerald-500/20">
                  <div>
                    <span className="block text-text-muted">Terminal / Caixa:</span>
                    <strong className="text-text-base font-semibold">{loteAberto.terminal_caixa}</strong>
                  </div>
                  <div>
                    <span className="block text-text-muted">Operador Responsável:</span>
                    <strong className="text-text-base font-semibold">{loteAberto.operador_nome}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-text-muted">Data/Hora de Abertura:</span>
                    <strong className="text-text-base font-semibold">
                      {format(new Date(loteAberto.data_abertura), "dd/MM/yyyy 'às' HH:mm")}
                    </strong>
                  </div>
                </div>
              </div>

              {/* RESUMO DA TRANSAÇÃO */}
              <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-2.5 text-sm">
                <p className="text-xs text-text-subtle uppercase tracking-wider font-semibold">Resumo do Recebimento</p>

                <div className="flex justify-between items-center py-1 border-b border-border-default">
                  <span className="text-text-subtle text-xs">Devedor:</span>
                  <span className="font-semibold text-text-base text-xs">{parcelaSelecionada.devedor_nome}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border-default">
                  <span className="text-text-subtle text-xs">Descrição / Parcela:</span>
                  <span className="font-medium text-text-base text-xs">
                    {parcelaSelecionada.descricao} ({parcelaSelecionada.numero_parcela}/{parcelaSelecionada.total_parcelas || 1})
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border-default">
                  <span className="text-text-subtle text-xs">Forma de Pagamento:</span>
                  <span className="uppercase font-bold text-xs text-[#3B82F6] bg-blue-500/10 px-2 py-0.5 rounded">
                    {formaPagamentoEfetiva}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-text-subtle font-medium text-sm">Valor a Efetivar:</span>
                  <span className="text-xl font-bold text-emerald-400">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorRecebido)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setModalStage('form')}
                  className="px-5 py-2.5 rounded-xl text-text-muted hover:text-text-base hover:bg-bg-hover transition-colors font-medium text-sm"
                >
                  Ajustar Dados
                </button>
                <button
                  type="button"
                  onClick={handleEfetivarRecebimento}
                  disabled={submittingBaixa}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  {submittingBaixa ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Efetivando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar e Registrar no Lote
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    )}
    </>
  );
};
