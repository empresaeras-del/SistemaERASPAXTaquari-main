import React, { useState, useEffect } from 'react';
import { Atendimento } from '../../types/atendimentos';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { 
  verificarFinanceiroAtendimento, 
  VerificacaoFinanceiraAtendimento 
} from '../../services/financeiroService';
import { excluirAtendimento } from '../../services/atendimentosService';
import { 
  AlertTriangle, 
  Trash2, 
  X, 
  ShieldAlert, 
  Ban, 
  DollarSign, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Loader2 
} from 'lucide-react';
import { formatLocalDate } from '../../utils/dateUtils';

interface ExcluirAtendimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  atendimento: Atendimento | null;
  onSuccess: () => void;
}

export const ExcluirAtendimentoModal: React.FC<ExcluirAtendimentoModalProps> = ({
  isOpen,
  onClose,
  atendimento,
  onSuccess
}) => {
  const { state } = useAppContext();
  const toast = useToast();

  const [loadingVerificacao, setLoadingVerificacao] = useState(true);
  const [financeiroInfo, setFinanceiroInfo] = useState<VerificacaoFinanceiraAtendimento | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [justificativa, setJustificativa] = useState('');

  useEffect(() => {
    if (!isOpen || !atendimento) {
      setFinanceiroInfo(null);
      setLoadingVerificacao(false);
      setJustificativa('');
      return;
    }

    let isMounted = true;
    const checar = async () => {
      setLoadingVerificacao(true);
      try {
        const info = await verificarFinanceiroAtendimento(atendimento.id, state.isOnline);
        if (isMounted) {
          setFinanceiroInfo(info);
        }
      } catch (err) {
        console.warn('Erro ao verificar situação financeira do atendimento:', err);
      } finally {
        if (isMounted) {
          setLoadingVerificacao(false);
        }
      }
    };

    checar();

    return () => {
      isMounted = false;
    };
  }, [isOpen, atendimento, state.isOnline]);

  if (!isOpen || !atendimento) return null;

  const handleConfirmarExclusao = async () => {
    if (!state.isOnline) {
      toast.error('Operação não permitida no modo offline.');
      return;
    }

    if (financeiroInfo?.temParcelaQuitada) {
      toast.error('Exclusão bloqueada: existem parcelas quitadas vinculadas a este atendimento.');
      return;
    }

    setExcluindo(true);
    try {
      await excluirAtendimento(atendimento.id, state.isOnline, {
        falecido_nome: atendimento.falecido_nome,
        falecido_cpf: atendimento.falecido_cpf,
        tipo_cliente: atendimento.tipo_cliente,
        status: atendimento.status,
        valor_total: atendimento.valor_total,
        usuario_nome: state.user?.nome,
        usuario_email: state.user?.email,
        usuario_nivel: state.user?.nivel,
        justificativa: justificativa.trim() || 'Exclusão autorizada pelo administrador'
      });

      toast.success('Atendimento e registros financeiros vinculados excluídos com sucesso!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao excluir atendimento:', error);
      toast.error('Falha ao excluir o atendimento.');
    } finally {
      setExcluindo(false);
    }
  };

  const temParcelaQuitada = Boolean(financeiroInfo?.temParcelaQuitada);
  const temReceitaVinculada = Boolean(financeiroInfo?.temReceita);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-surface border border-border-default rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className={`p-5 border-b border-border-default flex items-center justify-between ${temParcelaQuitada ? 'bg-rose-500/10' : 'bg-bg-subtle'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${temParcelaQuitada ? 'bg-rose-500/20 text-rose-500' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
              {temParcelaQuitada ? <ShieldAlert className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-base">
                {temParcelaQuitada ? 'Exclusão Bloqueada' : 'Confirmar Exclusão de Atendimento'}
              </h3>
              <p className="text-xs text-text-subtle">
                {temParcelaQuitada 
                  ? 'Existem restrições financeiras para este atendimento'
                  : 'Esta ação removerá o atendimento do sistema'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={excluindo}
            className="p-2 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-xl transition-colors disabled:opacity-50"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-text-base">
          
          {/* IDENTIFICAÇÃO DO ATENDIMENTO */}
          <div className="p-4 rounded-2xl bg-bg-subtle border border-border-default space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Atendimento</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                atendimento.status === 'aberto' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
              }`}>
                {atendimento.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-base font-bold text-text-base line-clamp-1">{atendimento.falecido_nome}</p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-default/60 text-text-muted text-[11px]">
              <div>
                <span className="text-text-subtle">Tipo:</span> <strong className="text-text-base capitalize">{atendimento.tipo_cliente}</strong>
              </div>
              <div>
                <span className="text-text-subtle">Data:</span> <strong className="text-text-base">{formatLocalDate(atendimento.created_at || '')}</strong>
              </div>
              <div>
                <span className="text-text-subtle">CPF:</span> <strong className="text-text-base">{atendimento.falecido_cpf || 'Não informado'}</strong>
              </div>
              <div>
                <span className="text-text-subtle">Valor Extras:</span> <strong className="text-emerald-500">R$ {(atendimento.valor_total || 0).toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* STATUS DA VERIFICAÇÃO FINANCEIRA */}
          {loadingVerificacao ? (
            <div className="p-6 rounded-2xl bg-bg-subtle/50 border border-border-default flex flex-col items-center justify-center gap-2 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs font-semibold text-text-subtle">Verificando receitas e parcelas vinculadas...</p>
            </div>
          ) : temParcelaQuitada ? (
            /* CENÁRIO 1: BLOQUEIO IMPEDITIVO */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Ban className="w-5 h-5 shrink-0" />
                  <span>Não é permitido excluir este atendimento</span>
                </div>
                <p className="text-xs leading-relaxed text-text-muted">
                  O sistema identificou <strong className="text-rose-500 font-bold">{financeiroInfo?.parcelasQuitadas.length} parcela(s) já quitada(s)/recebida(s)</strong> vinculada(s) a este atendimento, totalizando <strong className="text-rose-500 font-bold">R$ {financeiroInfo?.valorTotalQuitado.toFixed(2)}</strong>.
                </p>
                <p className="text-[11px] text-text-subtle">
                  Por regras fiscais e de integridade contábil, atendimentos com movimentações financeiras liquidadas não podem ser excluídos diretamente. Caso seja necessário, estorne ou cancele as baixas financeiras no módulo de Contas a Receber antes de prosseguir.
                </p>
              </div>

              {/* LISTA DE PARCELAS QUITADAS */}
              <div className="border border-border-default rounded-2xl overflow-hidden">
                <div className="p-3 bg-bg-subtle border-b border-border-default font-bold text-text-subtle text-[11px] uppercase tracking-wider flex items-center justify-between">
                  <span>Parcelas Quitadas / Recebidas</span>
                  <span className="text-emerald-500 font-bold">Total: R$ {financeiroInfo?.valorTotalQuitado.toFixed(2)}</span>
                </div>
                <div className="divide-y divide-border-default/50 max-h-36 overflow-y-auto">
                  {financeiroInfo?.parcelasQuitadas.map((p) => (
                    <div key={p.id} className="p-3 flex items-center justify-between text-xs hover:bg-bg-hover">
                      <div>
                        <div className="font-semibold text-text-base">
                          {p.descricao || `Parcela ${p.numero_parcela}`}
                        </div>
                        <div className="text-[10px] text-text-subtle">
                          Pagamento: {p.data_pagamento ? formatLocalDate(p.data_pagamento) : p.data_recebimento ? formatLocalDate(p.data_recebimento) : '-'} • {p.forma_pagamento || p.forma_pagamento_efetivo || 'Dinheiro'}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-500 text-xs">
                          R$ {(p.valor_pago || p.valor_recebido || p.valor).toFixed(2)}
                        </span>
                        <span className="block text-[9px] uppercase font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* CENÁRIO 2: PERMITIDO, COM OU SEM RECEITAS PENDENTES */
            <div className="space-y-4">
              {temReceitaVinculada ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>Receita Pai Vinculada Detectada</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Este atendimento possui <strong className="text-amber-500 font-bold">{financeiroInfo?.receitas.length} receita(s) vinculada(s)</strong> no Contas a Receber, com <strong className="text-amber-500 font-bold">{financeiroInfo?.parcelasPendentes.length} parcela(s) pendente(s)</strong> no valor de <strong className="text-amber-500 font-bold">R$ {financeiroInfo?.valorTotalPendente.toFixed(2)}</strong>.
                  </p>
                  <p className="text-[11px] font-semibold text-amber-500">
                    ⚠️ Ao confirmar a exclusão, o atendimento e todas as receitas/parcelas pendentes vinculadas serão excluídos em conjunto do sistema financeiro.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-bg-subtle border border-border-default text-text-muted text-xs flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Não foram encontradas pendências financeiras vinculadas a este atendimento.</span>
                </div>
              )}

              {/* JUSTIFICATIVA OPCIONAL */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text-subtle">
                  Justificativa da Exclusão (para o Registro de Auditoria)
                </label>
                <textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Ex: Atendimento lançado por engano, duplicado, desistência de família..."
                  className="w-full bg-bg-subtle border border-border-default rounded-xl p-3 text-xs text-text-base focus:border-rose-500 outline-none resize-none h-20"
                />
              </div>

              <div className="text-[11px] text-text-subtle bg-bg-subtle/50 p-3 rounded-xl border border-border-default/60">
                ℹ️ Esta exclusão será devidamente registrada no <strong>Log de Auditoria</strong> com a data, o operador responsável ({state.user?.nome || 'Administrador'}) e os dados excluídos.
              </div>
            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-border-default bg-bg-surface flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={excluindo}
            className="px-4 py-2 text-xs font-semibold text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-xl transition-colors disabled:opacity-50"
          >
            {temParcelaQuitada ? 'Fechar' : 'Cancelar'}
          </button>

          {!temParcelaQuitada && !loadingVerificacao && (
            <button
              type="button"
              onClick={handleConfirmarExclusao}
              disabled={excluindo || !state.isOnline}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {excluindo ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>{temReceitaVinculada ? 'Excluir Atendimento e Receitas' : 'Confirmar Exclusão'}</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
