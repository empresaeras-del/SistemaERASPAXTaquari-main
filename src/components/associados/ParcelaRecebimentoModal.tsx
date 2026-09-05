import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { DollarSign, CheckCircle2, Lock, Wallet, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { ParcelaReceber, registrarRecebimento } from '../../services/financeiroService';
import { getLoteAbertoAtivo, registrarMovimentacao } from '../../services/caixasService';
import { ContaBancaria } from '../../types/contasBancarias';
import { formatCurrency } from '../../utils/formatters';

interface ParcelaRecebimentoModalProps {
  parcelaSelecionada: ParcelaReceber | null;
  associadoNome: string;
  contasBancarias: ContaBancaria[];
  onClose: () => void;
  onSuccess: () => void;
}

export const ParcelaRecebimentoModal: React.FC<ParcelaRecebimentoModalProps> = ({
  parcelaSelecionada,
  associadoNome,
  contasBancarias,
  onClose,
  onSuccess
}) => {
  const { state } = useAppContext();
  const toast = useToast();
  const navigate = useNavigate();

  const [dataRecebimento, setDataRecebimento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [valorRecebido, setValorRecebido] = useState<number>(0);
  const [formaPagamentoEfetiva, setFormaPagamentoEfetiva] = useState<string>('pix');
  const [contaBancariaId, setContaBancariaId] = useState<string>('');
  const [observacaoRecebimento, setObservacaoRecebimento] = useState<string>('');
  
  const [modalStage, setModalStage] = useState<'form' | 'confirmacao' | 'bloqueio'>('form');
  const [loteAberto, setLoteAberto] = useState<any | null>(null);
  const [checkingLote, setCheckingLote] = useState(false);
  const [submittingBaixa, setSubmittingBaixa] = useState(false);

  useEffect(() => {
    if (parcelaSelecionada) {
      setDataRecebimento(format(new Date(), 'yyyy-MM-dd'));
      setValorRecebido(parcelaSelecionada.valor);
      setFormaPagamentoEfetiva(parcelaSelecionada.forma_pagamento || 'pix');
      setContaBancariaId(parcelaSelecionada.conta_bancaria_id || (contasBancarias.length > 0 ? contasBancarias[0].id! : ''));
      setObservacaoRecebimento('');
      setLoteAberto(null);
      setModalStage('form');
    }
  }, [parcelaSelecionada, contasBancarias]);

  const handleVerificarLoteBaixa = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!parcelaSelecionada) return;
    setCheckingLote(true);
    try {
      const activeLote = await getLoteAbertoAtivo(state.isOnline, state.empresaSelecionada || 'tenant-default');
      if (!activeLote) {
        setLoteAberto(null);
        setModalStage('bloqueio');
      } else {
        setLoteAberto(activeLote);
        setModalStage('confirmacao');
      }
    } catch (err) {
      console.error('Erro ao verificar lote de caixa:', err);
      toast.error('Erro ao verificar status do Lote de Caixa');
    } finally {
      setCheckingLote(false);
    }
  };

  const handleEfetivarRecebimento = async () => {
    if (!state.isOnline) {
      toast.error('Baixa de recebimento bloqueada no Modo de Visualização (Offline).');
      return;
    }
    if (!parcelaSelecionada || !loteAberto) return;
    setSubmittingBaixa(true);
    try {
      await registrarRecebimento(state.isOnline, parcelaSelecionada.id, {
        data_recebimento: dataRecebimento ? new Date(dataRecebimento + "T12:00:00").toISOString() : new Date().toISOString(),
        valor_recebido: Number(valorRecebido) || parcelaSelecionada.valor,
        forma_pagamento_efetivo: formaPagamentoEfetiva,
        conta_bancaria_id: formaPagamentoEfetiva !== 'dinheiro' ? contaBancariaId : null,
        recebido_por: state.user?.nome || 'Sistema',
        observacao: observacaoRecebimento
      });

      await registrarMovimentacao(state.isOnline, {
        tenant_id: state.empresaSelecionada || 'tenant-default',
        lote_id: loteAberto.id,
        tipo: 'entrada',
        origem: 'contas_receber',
        categoria: 'Receita / Mensalidade',
        descricao: `Recebimento: ${parcelaSelecionada.devedor_nome || associadoNome} - ${parcelaSelecionada.descricao}`,
        valor: Number(valorRecebido) || parcelaSelecionada.valor,
        forma_pagamento: formaPagamentoEfetiva as any,
        data_movimentacao: dataRecebimento ? new Date(dataRecebimento + "T12:00:00").toISOString() : new Date().toISOString(),
        referencia_id: parcelaSelecionada.id,
        documento_ref: `Parc. ${parcelaSelecionada.numero_parcela}/${parcelaSelecionada.total_parcelas || 1}`,
        operador_nome: state.user?.nome || loteAberto.operador_nome || 'Sistema',
        observacao: observacaoRecebimento
      });

      toast.success(`Recebimento registrado com sucesso no Lote ${loteAberto.codigo_lote}!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao efetivar recebimento:', err);
      toast.error(err?.message || 'Erro ao efetivar recebimento');
    } finally {
      setSubmittingBaixa(false);
    }
  };

  if (!parcelaSelecionada) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-bg-subtle border border-border-default rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {modalStage === 'form' && (
          <>
            <div className="flex items-center justify-between p-6 border-b border-border-default">
              <h3 className="text-base font-bold text-text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                Registrar Recebimento
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-text-subtle hover:text-text-base"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerificarLoteBaixa} className="p-6 space-y-4 text-xs">
              <div className="bg-bg-surface p-4 rounded-xl border border-border-default space-y-1">
                <p className="text-[10px] text-text-subtle uppercase tracking-wider">
                  Parcela {parcelaSelecionada.numero_parcela}/{parcelaSelecionada.total_parcelas || 1}
                </p>
                <p className="text-base font-bold text-text-base">{parcelaSelecionada.descricao}</p>
                <p className="text-xs text-text-subtle">Associado: <strong className="text-text-base">{associadoNome}</strong></p>
              </div>

              <div>
                <label className="block font-medium text-text-subtle mb-1">Data do Recebimento *</label>
                <input
                  type="date"
                  value={dataRecebimento}
                  onChange={(e) => setDataRecebimento(e.target.value)}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-text-subtle mb-1">Valor Recebido (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorRecebido}
                  onChange={(e) => setValorRecebido(Number(e.target.value))}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] outline-none font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-text-subtle mb-1">Forma de Pagamento Efetiva *</label>
                <select
                  value={formaPagamentoEfetiva}
                  onChange={(e) => setFormaPagamentoEfetiva(e.target.value)}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] outline-none"
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

              {formaPagamentoEfetiva !== 'dinheiro' && contasBancarias.length > 0 && (
                <div>
                  <label className="block font-medium text-text-subtle mb-1">Conta Bancária Referencial</label>
                  <select
                    value={contaBancariaId}
                    onChange={(e) => setContaBancariaId(e.target.value)}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] outline-none"
                  >
                    <option value="">Selecione a conta...</option>
                    {contasBancarias.map(conta => (
                      <option key={conta.id} value={conta.id}>{conta.nome} ({conta.banco})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-medium text-text-subtle mb-1">Observações do Recebimento</label>
                <textarea
                  rows={2}
                  value={observacaoRecebimento}
                  onChange={(e) => setObservacaoRecebimento(e.target.value)}
                  placeholder="Ex: Recebido em dinheiro no balcão"
                  className="w-full bg-bg-surface border border-border-default rounded-xl p-3 text-text-base text-xs focus:border-[#3B82F6] outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-text-subtle hover:bg-bg-hover text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={checkingLote}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  {checkingLote ? 'Verificando Caixa...' : 'Avançar'}
                </button>
              </div>
            </form>
          </>
        )}

        {modalStage === 'bloqueio' && (
          <div className="p-6 space-y-5 text-xs">
            <div className="flex items-start justify-between border-b border-border-default pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Operação Bloqueada</h3>
                  <p className="text-[11px] text-rose-400 font-semibold">Nenhum Lote de Caixa Aberto Encontrado</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-text-subtle hover:text-text-base"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl space-y-2">
              <p className="text-text-subtle leading-relaxed">
                Para efetivar este registro de recebimento, o sistema exige que exista um <strong>Lote de Caixa aberto</strong> ativo para receber a movimentação financeira.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
              <button
                type="button"
                onClick={() => setModalStage('form')}
                className="px-4 py-2 rounded-xl text-text-subtle hover:bg-bg-hover text-xs font-semibold"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/financeiro/caixas');
                }}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5" />
                Abrir Lote de Caixa
              </button>
            </div>
          </div>
        )}

        {modalStage === 'confirmacao' && loteAberto && (
          <div className="p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-default pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Confirmar Registro no Caixa
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-text-subtle hover:text-text-base"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-400">Lote Destino:</span>
                <span className="px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300">
                  {loteAberto.codigo_lote}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-subtle">Operador:</span>
                <strong className="text-white">{loteAberto.operador_nome}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-text-subtle">Terminal / Caixa:</span>
                <strong className="text-white">{loteAberto.terminal_caixa}</strong>
              </div>
            </div>

            <div className="bg-bg-surface p-3.5 rounded-xl border border-border-default space-y-2">
              <div className="flex justify-between">
                <span className="text-text-subtle">Associado:</span>
                <strong className="text-white">{associadoNome}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-text-subtle">Parcela:</span>
                <span className="text-white font-medium">{parcelaSelecionada.descricao}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-subtle">Forma de Pagamento:</span>
                <span className="uppercase font-bold text-blue-400">{formaPagamentoEfetiva}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/10 items-baseline">
                <span className="text-text-subtle font-medium">Valor Efetivo:</span>
                <span className="text-lg font-extrabold text-emerald-400 font-mono">
                  {formatCurrency(valorRecebido)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-default">
              <button
                type="button"
                onClick={() => setModalStage('form')}
                className="px-4 py-2 rounded-xl text-text-subtle hover:bg-bg-hover text-xs font-semibold"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleEfetivarRecebimento}
                disabled={submittingBaixa}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
              >
                {submittingBaixa ? 'Efetivando...' : 'Confirmar e Efetivar Baixa'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
