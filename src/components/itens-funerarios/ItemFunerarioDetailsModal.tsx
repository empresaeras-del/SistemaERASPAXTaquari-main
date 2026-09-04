import React, { useEffect, useState } from 'react';
import { ItemFunerario } from '../../types/itensFunerarios';
import { getCoberturasDoItem } from '../../hooks/useItensFunerarios';
import { usePlanosPax } from '../../hooks/usePlanosPax';
import { useAppContext } from '../../context/AppContext';
import { X, Pencil, ShieldCheck, ShieldAlert, Package, Layers, Info } from 'lucide-react';
import { PlanoPaxCobertura } from '../../types/planosPax';

interface Props {
  item: ItemFunerario;
  onClose: () => void;
  onEdit: () => void;
}

export const ItemFunerarioDetailsModal: React.FC<Props> = ({ item, onClose, onEdit }) => {
  const [coberturas, setCoberturas] = useState<PlanoPaxCobertura[]>([]);
  const [loading, setLoading] = useState(true);
  const { planos } = usePlanosPax();
  const {
    state: { isOnline },
  } = useAppContext();

  useEffect(() => {
    setLoading(true);
    getCoberturasDoItem(item.id, isOnline)
      .then((data) => setCoberturas(data))
      .catch((err) => console.warn('Erro ao carregar coberturas:', err))
      .finally(() => setLoading(false));
  }, [item.id, isOnline]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4">
      <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-border-default overflow-hidden animate-in fade-in zoom-in-95">
        {/* HEADER */}
        <div className="p-6 border-b border-border-default bg-bg-surface/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-subtle">{item.codigo}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    item.ativo
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}
                >
                  {item.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <h3 className="text-xl font-bold text-text-base">{item.nome}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 rounded-xl text-xs font-semibold transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-text-subtle hover:text-text-base rounded-xl transition-colors hover:bg-bg-hover"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* GENERAL DATA GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-bg-surface p-4 rounded-2xl border border-border-default/60">
            <div>
              <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">
                Categoria
              </p>
              <p className="text-sm font-medium text-text-base capitalize mt-0.5">
                {item.categoria.replace('_', ' ')}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">
                Valor Referência
              </p>
              <p className="text-sm font-medium text-text-base mt-0.5">
                {item.valor_referencia
                  ? Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.valor_referencia,
                    )
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">
                Unidade
              </p>
              <p className="text-sm font-medium text-text-base mt-0.5">
                {item.unidade || 'Unidade'}
              </p>
            </div>
          </div>

          {item.descricao && (
            <div>
              <p className="text-xs font-semibold text-text-subtle mb-1">Descrição do Item</p>
              <p className="text-sm text-text-muted bg-bg-surface p-3.5 rounded-xl border border-border-default/50 leading-relaxed">
                {item.descricao}
              </p>
            </div>
          )}

          {/* COVERAGE IN PLANS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#3B82F6]" />
                <h4 className="text-sm font-bold text-text-base">
                  Planos Vinculados ({coberturas.length})
                </h4>
              </div>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-text-subtle">
                Carregando vínculos de planos...
              </div>
            ) : coberturas.length === 0 ? (
              <div className="p-4 bg-bg-surface border border-border-default/50 rounded-2xl text-center text-xs text-text-subtle">
                Este item ainda não está vinculado a nenhum Plano PAX. Clique em{' '}
                <strong className="text-[#3B82F6]">Editar</strong> para vincular a planos.
              </div>
            ) : (
              <div className="space-y-2.5">
                {coberturas.map((cob) => {
                  const plano = planos.find((p) => p.id === cob.plano_id);
                  const isCoberto = cob.tipo_cobertura === 'coberto';

                  return (
                    <div
                      key={cob.id || cob.plano_id}
                      className="p-3.5 rounded-xl bg-bg-surface border border-border-default flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-text-base">
                            {plano?.nome || 'Plano PAX'}
                          </span>
                          {plano?.codigo && (
                            <span className="text-xs font-mono text-text-subtle">
                              ({plano.codigo})
                            </span>
                          )}
                        </div>
                        {cob.observacao && (
                          <p className="text-xs text-text-subtle mt-1 italic">
                            Obs: &quot;{cob.observacao}&quot;
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 self-start sm:self-auto">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            isCoberto
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {isCoberto ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Coberto</span>
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Excluído</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-border-default bg-bg-surface/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-bg-hover text-text-base rounded-xl text-xs font-medium hover:bg-[#64748B] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
