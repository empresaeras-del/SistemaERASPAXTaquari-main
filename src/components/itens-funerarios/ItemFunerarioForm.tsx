import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  X,
  Save,
  Package,
  Layers,
  Search,
  ShieldCheck,
  ShieldAlert,
  CheckSquare,
  Square,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ItemFunerario,
  ItemFunerarioInsert,
  ItemFunerarioUpdate,
  CategoriaItemFunerario,
  PlanoVinculadoItem,
} from '../../types/itensFunerarios';
import { usePlanosPax } from '../../hooks/usePlanosPax';
import { getCoberturasDoItem } from '../../hooks/useItensFunerarios';
import { useAppContext } from '../../context/AppContext';
import { BotaoSalvar } from '../common/BotaoSalvar';
import { AlertaAlteracoesPendentes } from '../common/AlertaAlteracoesPendentes';

const schema = z.object({
  codigo: z
    .string()
    .min(1, 'Código é obrigatório')
    .max(50, 'Máximo 50 caracteres')
    .transform((v) => v.toUpperCase()),
  nome: z.string().min(1, 'Nome é obrigatório').max(120, 'Máximo 120 caracteres'),
  categoria: z.enum([
    'translado',
    'preparacao',
    'urna',
    'velorio',
    'cortejo',
    'sepultamento',
    'documentacao',
    'flores',
    'apoio_familia',
    'outros',
  ]),
  descricao: z.string().max(500, 'Máximo 500 caracteres').optional().nullable(),
  unidade: z.string().min(1, 'Unidade é obrigatória'),
  valor_referencia: z.number().min(0, 'Valor deve ser positivo').optional().nullable(),
  ordem_exibicao: z.number().int(),
  ativo: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: (ItemFunerarioInsert | ItemFunerarioUpdate) & { planosVinculados?: PlanoVinculadoItem[] },
  ) => Promise<void>;
  initialData?: ItemFunerario | null;
  ultimoOrdem?: number;
}

const categorias: { value: CategoriaItemFunerario; label: string }[] = [
  { value: 'translado', label: 'Translado' },
  { value: 'preparacao', label: 'Preparação' },
  { value: 'urna', label: 'Urna' },
  { value: 'velorio', label: 'Velório' },
  { value: 'cortejo', label: 'Cortejo' },
  { value: 'sepultamento', label: 'Sepultamento' },
  { value: 'documentacao', label: 'Documentação' },
  { value: 'flores', label: 'Flores' },
  { value: 'apoio_familia', label: 'Apoio à Família' },
  { value: 'outros', label: 'Outros' },
];

export const ItemFunerarioForm: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  ultimoOrdem = 0,
}) => {
  const [activeTab, setActiveTab] = useState<'dados' | 'planos'>('dados');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [buscaPlano, setBuscaPlano] = useState('');
  const [loadingCoberturas, setLoadingCoberturas] = useState(false);

  // State to hold linked plans: key = plano_id
  const [planosVinculados, setPlanosVinculados] = useState<Record<string, PlanoVinculadoItem>>({});

  const { planos: todosPlanos, loading: loadingPlanos } = usePlanosPax();
  const {
    state: { isOnline },
  } = useAppContext();
  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      codigo: '',
      nome: '',
      categoria: 'outros',
      descricao: '',
      unidade: 'unidade',
      valor_referencia: null,
      ordem_exibicao: ultimoOrdem + 10,
      ativo: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab('dados');
      setBuscaPlano('');

      if (initialData) {
        reset({
          codigo: initialData.codigo,
          nome: initialData.nome,
          categoria: initialData.categoria,
          descricao: initialData.descricao || '',
          unidade: initialData.unidade,
          valor_referencia: initialData.valor_referencia || null,
          ordem_exibicao: initialData.ordem_exibicao,
          ativo: initialData.ativo,
        });

        // Carregar coberturas atuais do item
        setLoadingCoberturas(true);
        getCoberturasDoItem(initialData.id, isOnline)
          .then((cobs) => {
            const map: Record<string, PlanoVinculadoItem> = {};
            cobs.forEach((c) => {
              map[c.plano_id] = {
                plano_id: c.plano_id,
                tipo_cobertura: c.tipo_cobertura || 'coberto',
                observacao: c.observacao || '',
              };
            });
            setPlanosVinculados(map);
          })
          .catch((err) => {
            console.warn('Erro ao carregar coberturas:', err);
          })
          .finally(() => {
            setLoadingCoberturas(false);
          });
      } else {
        reset({
          codigo:
            'ITM' +
            Math.floor(Math.random() * 100000)
              .toString()
              .padStart(5, '0'),
          nome: '',
          categoria: 'outros',
          descricao: '',
          unidade: 'unidade',
          valor_referencia: null,
          ordem_exibicao: ultimoOrdem + 10,
          ativo: true,
        });
        setPlanosVinculados({});
      }
    }
  }, [isOpen, initialData, reset, ultimoOrdem, isOnline]);

  if (!isOpen) return null;

  // Toggle selection for a plan
  const togglePlanoSelection = (planoId: string) => {
    setPlanosVinculados((prev) => {
      const next = { ...prev };
      if (next[planoId]) {
        delete next[planoId];
      } else {
        next[planoId] = {
          plano_id: planoId,
          tipo_cobertura: 'coberto',
          observacao: '',
        };
      }
      return next;
    });
  };

  // Change coverage type (coberto / excluido)
  const setTipoCobertura = (planoId: string, tipo: 'coberto' | 'excluido') => {
    setPlanosVinculados((prev) => ({
      ...prev,
      [planoId]: {
        ...prev[planoId],
        tipo_cobertura: tipo,
      },
    }));
  };

  // Change observation note
  const setObservacaoPlano = (planoId: string, obs: string) => {
    setPlanosVinculados((prev) => ({
      ...prev,
      [planoId]: {
        ...prev[planoId],
        observacao: obs,
      },
    }));
  };

  // Quick actions
  const planosFiltrados = todosPlanos.filter((p) => {
    if (!buscaPlano.trim()) return true;
    const b = buscaPlano.toLowerCase();
    return p.nome.toLowerCase().includes(b) || p.codigo.toLowerCase().includes(b);
  });

  const selecionarTodos = (tipo: 'coberto' | 'excluido') => {
    setPlanosVinculados((prev) => {
      const next = { ...prev };
      planosFiltrados.forEach((plano) => {
        next[plano.id] = {
          plano_id: plano.id,
          tipo_cobertura: tipo,
          observacao: prev[plano.id]?.observacao || '',
        };
      });
      return next;
    });
  };

  const desmarcarTodos = () => {
    setPlanosVinculados((prev) => {
      const next = { ...prev };
      planosFiltrados.forEach((plano) => {
        delete next[plano.id];
      });
      return next;
    });
  };

  const qtdPlanosVinculados = Object.keys(planosVinculados).length;

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const listVinculados = Object.values(planosVinculados);
      await onSave({
        ...data,
        planosVinculados: listVinculados,
      } as any);
      toast.success(isEditing ? 'Item e vínculos atualizados!' : 'Item e vínculos criados!');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar o item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4">
      <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-border-default overflow-hidden animate-in fade-in zoom-in-95">
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-border-default bg-bg-surface/30">
          <div>
            <h2 className="text-xl font-bold text-text-base">
              {isEditing ? 'Editar Item Funerário' : 'Novo Item Funerário'}
            </h2>
            <p className="text-xs text-text-subtle mt-0.5">
              Cadastre os detalhes do item e vincule a cobertura nos Planos PAX
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-subtle hover:text-text-base transition-colors p-1 rounded-lg hover:bg-bg-hover"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex items-center border-b border-border-default bg-bg-surface/50 px-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('dados')}
            className={`flex items-center gap-2 py-3.5 px-4 border-b-2 font-semibold text-sm transition-all ${
              activeTab === 'dados'
                ? 'border-[#3B82F6] text-[#3B82F6] bg-bg-surface/80 rounded-t-xl'
                : 'border-transparent text-text-subtle hover:text-text-base'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Dados Gerais do Item</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('planos')}
            className={`flex items-center gap-2 py-3.5 px-4 border-b-2 font-semibold text-sm transition-all ${
              activeTab === 'planos'
                ? 'border-[#3B82F6] text-[#3B82F6] bg-bg-surface/80 rounded-t-xl'
                : 'border-transparent text-text-subtle hover:text-text-base'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Planos & Coberturas</span>
            <span
              className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                qtdPlanosVinculados > 0 ? 'bg-[#3B82F6] text-white' : 'bg-bg-hover text-text-subtle'
              }`}
            >
              {qtdPlanosVinculados}
            </span>
          </button>
        </div>

        <form
          id="item-funerario-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          {isDirty && (
            <div className="px-6 pt-4 shrink-0">
              <AlertaAlteracoesPendentes
                visivel={isDirty}
                formId="item-funerario-form"
                salvando={isSubmitting}
                posicao="compact"
                mensagem="Existem alterações pendentes neste item funerário. Salve para registrar no banco de dados."
              />
            </div>
          )}

          {/* TAB 1: DADOS GERAIS */}
          {activeTab === 'dados' && (
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">Código *</label>
                  <input
                    {...register('codigo')}
                    readOnly
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-subtle focus:outline-none cursor-not-allowed uppercase font-mono"
                    placeholder="Gerado Automaticamente"
                  />
                  {errors.codigo && (
                    <p className="text-red-400 text-xs mt-1">{errors.codigo.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">
                    Nome do Item *
                  </label>
                  <input
                    {...register('nome')}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    placeholder="Ex: Urna Padrão Luxo"
                  />
                  {errors.nome && (
                    <p className="text-red-400 text-xs mt-1">{errors.nome.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">
                    Categoria *
                  </label>
                  <select
                    {...register('categoria')}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                  >
                    {categorias.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {errors.categoria && (
                    <p className="text-red-400 text-xs mt-1">{errors.categoria.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">
                    Valor de Referência (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('valor_referencia', { valueAsNumber: true })}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Descrição (opcional)
                </label>
                <textarea
                  {...register('descricao')}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] h-24 resize-none"
                  placeholder="Detalhes ou especificações técnicas sobre o item..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">Unidade</label>
                  <input
                    {...register('unidade')}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    placeholder="Ex: unidade, km, hora"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">
                    Ordem de Exibição
                  </label>
                  <input
                    type="number"
                    {...register('ordem_exibicao', { valueAsNumber: true })}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              {isEditing && (
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="ativo"
                    {...register('ativo')}
                    className="w-5 h-5 rounded border-border-default bg-bg-surface text-[#3B82F6] focus:ring-[#3B82F6]"
                  />
                  <label
                    htmlFor="ativo"
                    className="text-sm font-medium text-text-muted cursor-pointer"
                  >
                    Item Ativo
                  </label>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PLANOS & COBERTURAS */}
          {activeTab === 'planos' && (
            <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
              {/* INFO BANNER */}
              <div className="p-3.5 rounded-2xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-start gap-3">
                <Info className="w-5 h-5 text-[#3B82F6] shrink-0 mt-0.5" />
                <div className="text-xs text-text-base">
                  <span className="font-bold block mb-0.5">
                    Vincule este item a múltiplos planos PAX
                  </span>
                  Marque os planos nos quais este item estará disponível. Defina se o item é{' '}
                  <strong className="text-emerald-400">Coberto</strong> integralmente ou{' '}
                  <strong className="text-rose-400">Excluído</strong> (para opcional/adicional) e
                  adicione observações do item para o plano.
                </div>
              </div>

              {/* SEARCH & QUICK ACTIONS */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <input
                    type="text"
                    placeholder="Filtrar planos por nome ou código..."
                    value={buscaPlano}
                    onChange={(e) => setBuscaPlano(e.target.value)}
                    className="w-full bg-bg-surface border border-border-default rounded-xl pl-9 pr-4 py-2 text-xs text-text-base focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => selecionarTodos('coberto')}
                    className="px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-medium transition-colors"
                  >
                    Marcar Todos (Coberto)
                  </button>
                  <button
                    type="button"
                    onClick={() => selecionarTodos('excluido')}
                    className="px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-medium transition-colors"
                  >
                    Marcar Todos (Excluído)
                  </button>
                  <button
                    type="button"
                    onClick={desmarcarTodos}
                    className="px-2.5 py-1.5 rounded-lg border border-border-default bg-bg-surface text-text-subtle hover:text-text-base hover:bg-bg-hover font-medium transition-colors"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>

              {/* PLAN LIST */}
              {loadingPlanos || loadingCoberturas ? (
                <div className="py-12 text-center text-text-subtle flex flex-col items-center">
                  <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-sm">Carregando planos de assistência...</p>
                </div>
              ) : planosFiltrados.length === 0 ? (
                <div className="py-12 text-center text-text-subtle">
                  Nenhum plano cadastrado ou encontrado com os filtros atuais.
                </div>
              ) : (
                <div className="space-y-3">
                  {planosFiltrados.map((plano) => {
                    const isSelected = !!planosVinculados[plano.id];
                    const currentVinculo = planosVinculados[plano.id];

                    return (
                      <div
                        key={plano.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isSelected
                            ? 'border-[#3B82F6] bg-[#3B82F6]/5 shadow-sm'
                            : 'border-border-default bg-bg-surface hover:border-border-default/80'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePlanoSelection(plano.id)}
                              className="mt-1 w-5 h-5 rounded border-border-default bg-bg-surface text-[#3B82F6] focus:ring-[#3B82F6] shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-text-base text-sm truncate">
                                  {plano.nome}
                                </span>
                                <span className="text-xs font-mono text-text-subtle">
                                  ({plano.codigo})
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    plano.tipo_plano === 'individual'
                                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                      : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  }`}
                                >
                                  {plano.tipo_plano}
                                </span>
                              </div>
                              <p className="text-xs text-text-subtle mt-0.5">
                                Mensalidade: R$ {plano.valor_mensalidade?.toFixed(2)} | Limite
                                Vidas: {plano.limite_vidas || 'Sem limite'}
                              </p>
                            </div>
                          </label>

                          {/* COVERAGE STATUS BUTTONS */}
                          {isSelected && (
                            <div className="flex items-center gap-1 bg-bg-surface border border-border-default p-1 rounded-xl shrink-0 self-start sm:self-auto">
                              <button
                                type="button"
                                onClick={() => setTipoCobertura(plano.id, 'coberto')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                                  currentVinculo.tipo_cobertura === 'coberto'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-text-subtle hover:text-text-base'
                                }`}
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Coberto</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setTipoCobertura(plano.id, 'excluido')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                                  currentVinculo.tipo_cobertura === 'excluido'
                                    ? 'bg-rose-500 text-white shadow-sm'
                                    : 'text-text-subtle hover:text-text-base'
                                }`}
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span>Excluído</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* CUSTOM OBSERVATION INPUT */}
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t border-border-default/50 pl-8">
                            <label className="block text-[11px] font-medium text-text-subtle mb-1">
                              Observação / Limitações específicas para o plano {plano.nome}{' '}
                              (opcional)
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: Urna modelo luxo nº 3 inclusa, até 100km translado..."
                              value={currentVinculo.observacao || ''}
                              onChange={(e) => setObservacaoPlano(plano.id, e.target.value)}
                              className="w-full bg-bg-surface border border-border-default rounded-xl px-3 py-2 text-xs text-text-base focus:outline-none focus:border-[#3B82F6]"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* FOOTER ACTIONS */}
          <div className="p-6 border-t border-border-default bg-bg-surface/50 flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-text-subtle hidden sm:block">
              {qtdPlanosVinculados > 0 ? (
                <span className="text-[#3B82F6] font-semibold">
                  {qtdPlanosVinculados} plano(s) vinculado(s)
                </span>
              ) : (
                <span>Nenhum plano vinculado a este item</span>
              )}
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-bg-hover text-text-base rounded-xl font-medium hover:bg-[#64748B] transition-colors text-sm"
              >
                Cancelar
              </button>
              <BotaoSalvar
                type="submit"
                salvando={isSubmitting}
                texto={isEditing ? 'Salvar Alterações' : 'Salvar Item & Vínculos'}
                textoSalvando="Salvando Item..."
                textoSalvo="Item Salvo!"
                variante="primary"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
