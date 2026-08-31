import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Save, ChevronRight, ChevronLeft, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { PlanoPaxFormData, PlanoPaxFaixa } from '../../types/planosPax';
import { SeletorItensPax } from './SeletorItensPax';
import { useAppContext } from '../../context/AppContext';
import { getAssociados } from '../../services/associadosService';
import { Info, DollarSign, Clock, List as ListIcon, Users, MapPin, Shield, CreditCard, ArrowRight, ArrowLeft } from 'lucide-react';
import { RegrasCalculoInfo } from '../associados/RegrasCalculoInfo';
import { BotaoSalvar } from '../common/BotaoSalvar';
import { AlertaAlteracoesPendentes } from '../common/AlertaAlteracoesPendentes';


const optNum = z.preprocess(val => (val === '' || val === null || val === undefined || Number.isNaN(val as any)) ? null : val, z.coerce.number().nullable().optional()) as unknown as z.ZodType<number | null | undefined>;
const reqNum = z.preprocess(val => (val === '' || val === null || val === undefined || Number.isNaN(val as any)) ? 0 : val, z.coerce.number().min(0)) as unknown as z.ZodType<number>;

const schema = z.object({
  codigo: z.string().min(1, 'Obrigatório').transform(v => v.toUpperCase()),
  nome: z.string().min(1, 'Obrigatório'),
  descricao: z.string().optional().nullable(),
  tipo_plano: z.enum(['individual', 'coletivo']),
  limite_vidas: optNum,
  minimo_vidas_calculo: optNum,
  ativo: z.boolean(),
  vigencia_inicio: z.string().optional().nullable(),
  vigencia_fim: z.string().optional().nullable(),
  regra_calculo: z.enum(['fixo', 'por_vida', 'faixa_etaria']),
  valor_mensalidade: reqNum,
  taxa_adesao: reqNum,
  idade_minima: reqNum,
  idade_maxima: optNum,
  carencia_geral_dias: reqNum,
  carencia_acidente_dias: reqNum,
  carencia_morte_natural_dias: reqNum,
  km_translado_coberto: optNum,
  faixas: z.array(z.object({
    idade_de: reqNum,
    idade_ate: reqNum,
    valor: reqNum
  })).optional(),
}).refine(data => {
  if (data.tipo_plano === 'coletivo' && data.limite_vidas === null) return false;
  return true;
}, {
  message: "Plano coletivo requer informar o limite máximo de vidas",
  path: ["limite_vidas"]
}).refine(data => {
  if (data.regra_calculo === 'faixa_etaria' && (!data.faixas || data.faixas.length === 0)) return false;
  return true;
}, {
  message: "Regra por faixa etária requer ao menos uma faixa cadastrada",
  path: ["regra_calculo"]
});

type FormData = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PlanoPaxFormData) => Promise<void>;
  initialData?: any;
}

export const PlanoPaxForm: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
  const [activeTab, setActiveTab] = useState('identificacao');
  const [step, setStep] = useState(1);

  const { state } = useAppContext();
  const [associadosVinculados, setAssociadosVinculados] = useState<any[]>([]);
  const [loadingAssociados, setLoadingAssociados] = useState(false);

  useEffect(() => {
    const fetchAssociados = async () => {
      if (initialData?.id && state.empresaSelecionada) {
        setLoadingAssociados(true);
        try {
          const todos = await getAssociados(state.isOnline, state.empresaSelecionada);
          const vinculados = todos.filter(a => a.plano_pax_id === initialData.id && a.status === 'ativo');
          setAssociadosVinculados(vinculados);
        } catch (e) {
          console.error("Erro ao buscar associados vinculados:", e);
        } finally {
          setLoadingAssociados(false);
        }
      }
    };
    fetchAssociados();
  }, [initialData, state.empresaSelecionada, state.isOnline]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itensCobertos, setItensCobertos] = useState<string[]>([]);
  const [itensExcluidos, setItensExcluidos] = useState<string[]>([]);
  const [observacoesItens, setObservacoesItens] = useState<Record<string, string>>({});
  const [incluiTranslado, setIncluiTranslado] = useState(true);
  const [tipoTranslado, setTipoTranslado] = useState<'local' | 'raio'>('local');

  const { register, control, handleSubmit, watch, reset, setValue, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema as any),
    defaultValues: {
      codigo: '',
      nome: '',
      tipo_plano: 'individual',
      limite_vidas: 0,
      minimo_vidas_calculo: 0,
      regra_calculo: 'fixo',
      valor_mensalidade: 0,
      taxa_adesao: 0,
      carencia_geral_dias: 30,
      carencia_acidente_dias: 0,
      carencia_morte_natural_dias: 90,
      idade_minima: 0,
      ativo: true,
      faixas: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "faixas"
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          ...initialData,
          limite_vidas: initialData.limite_vidas !== undefined && initialData.limite_vidas !== null ? initialData.limite_vidas : 0,
          minimo_vidas_calculo: initialData.minimo_vidas_calculo !== undefined && initialData.minimo_vidas_calculo !== null ? initialData.minimo_vidas_calculo : 0,
          idade_maxima: initialData.idade_maxima || null,
          vigencia_inicio: initialData.vigencia_inicio || null,
          vigencia_fim: initialData.vigencia_fim || null,
        });
        
        if (initialData.km_translado_coberto === null) {
          setIncluiTranslado(false);
        } else {
          setIncluiTranslado(true);
          if (initialData.km_translado_coberto === 0) setTipoTranslado('local');
          else setTipoTranslado('raio');
        }

        if (initialData.coberturas) {
          const cob = initialData.coberturas.filter((c: any) => c.tipo_cobertura === 'coberto').map((c: any) => c.item_id);
          const exc = initialData.coberturas.filter((c: any) => c.tipo_cobertura === 'excluido').map((c: any) => c.item_id);
          const obs: Record<string, string> = {};
          initialData.coberturas.forEach((c: any) => {
            if (c.observacao) obs[c.item_id] = c.observacao;
          });
          setItensCobertos(cob);
          setItensExcluidos(exc);
          setObservacoesItens(obs);
        }
      } else {
        reset({
          codigo: 'PLN' + Math.floor(Math.random() * 100000).toString().padStart(5, '0'),
          nome: '',
          tipo_plano: 'individual',
          limite_vidas: 0,
          minimo_vidas_calculo: 0,
          regra_calculo: 'fixo',
          valor_mensalidade: 0,
          taxa_adesao: 0,
          carencia_geral_dias: 30,
          carencia_acidente_dias: 0,
          carencia_morte_natural_dias: 90,
          idade_minima: 0,
          ativo: true,
          faixas: []
        });
        setItensCobertos([]);
        setItensExcluidos([]);
        setObservacoesItens({});
        setIncluiTranslado(true);
        setTipoTranslado('local');
      }
      setActiveTab('identificacao');
    }
  }, [isOpen, initialData, reset]);

  const tipo_plano = watch('tipo_plano');
  const regra_calculo = watch('regra_calculo');

  useEffect(() => {
    if (tipo_plano === 'coletivo') {
      setValue('regra_calculo', 'fixo', { shouldValidate: true });
    }
  }, [tipo_plano, setValue]);

  if (!isOpen) return null;

  const onSubmit = async (data: any) => {
    if (!state.isOnline) {
      toast.error('Operação bloqueada no Modo de Visualização (Offline).');
      return;
    }
    setIsSubmitting(true);
    try {
      let km = null;
      if (incluiTranslado) {
        km = tipoTranslado === 'local' ? 0 : data.km_translado_coberto || 0;
      }
      if (data.tipo_plano === 'individual') {
        data.limite_vidas = 0;
      }
      if (data.regra_calculo !== 'por_vida') {
        data.minimo_vidas_calculo = 0;
      }
      
      const vigencia_inicio = data.vigencia_inicio === '' ? null : data.vigencia_inicio;
      const vigencia_fim = data.vigencia_fim === '' ? null : data.vigencia_fim;
      
      await onSave({
        ...data,
        vigencia_inicio,
        vigencia_fim,
        km_translado_coberto: km,
        itensCobertos,
        itensExcluidos,
        observacoesItens,
        faixas: data.faixas as Omit<PlanoPaxFaixa, 'id' | 'plano_id'>[]
      } as PlanoPaxFormData);
      
      toast.success(initialData ? 'Plano atualizado!' : 'Plano criado!');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar o plano.');
    } finally {
      setIsSubmitting(false);
    }
  };

  
  const nextStep = () => {
    if (initialData) return;
    setStep(s => Math.min(4, s + 1));
  };
  
  const prevStep = () => {
    if (initialData) return;
    setStep(s => Math.max(1, s - 1));
  };

  const onError = (errors: any) => {
    console.error("Erros de validação:", errors);
    const errorFields = Object.keys(errors).map(key => key.replace(/_/g, ' ')).join(', ');
    toast.error(`Existem campos inválidos: ${errorFields}. Volte nas etapas anteriores para corrigir.`);
  };

  
  

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-surface rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-border-default overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-default shrink-0 bg-bg-surface/95 backdrop-blur z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-[#3B82F6]/20 to-blue-500/10 rounded-2xl border border-[#3B82F6]/20">
              <Shield className="w-6 h-6 text-[#3B82F6]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-base tracking-tight">
                {initialData ? 'Editar Plano PAX' : 'Novo Plano PAX'}
              </h2>
              {!initialData ? (
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 4].map(s => (
                    <div key={s} className={`h-1.5 w-16 rounded-full ${s <= step ? 'bg-[#3B82F6]' : 'bg-bg-hover'}`} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-subtle font-medium">
                  Configure as regras, valores e carências do plano.
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-subtle hover:bg-bg-subtle hover:text-text-base rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          {initialData && (
            <div className="w-64 border-r border-border-default bg-bg-subtle/30 flex flex-col py-4 shrink-0 overflow-y-auto">
              <button
              type="button"
              onClick={() => setActiveTab('identificacao')}
              className={`px-6 py-3.5 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                activeTab === 'identificacao'
                  ? 'border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10'
                  : 'border-transparent text-text-subtle hover:text-text-base hover:bg-white/5'
              }`}
            >
              <Info className="w-4 h-4" />
              Identificação
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('valores')}
              className={`px-6 py-3.5 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                activeTab === 'valores'
                  ? 'border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10'
                  : 'border-transparent text-text-subtle hover:text-text-base hover:bg-white/5'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Valores e Limites
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('carencia')}
              className={`px-6 py-3.5 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                activeTab === 'carencia'
                  ? 'border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10'
                  : 'border-transparent text-text-subtle hover:text-text-base hover:bg-white/5'
              }`}
            >
              <Clock className="w-4 h-4" />
              Carência e Translado
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('itens')}
              className={`px-6 py-3.5 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                activeTab === 'itens'
                  ? 'border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10'
                  : 'border-transparent text-text-subtle hover:text-text-base hover:bg-white/5'
              }`}
            >
              <ListIcon className="w-4 h-4" />
              Itens e Coberturas
            </button>
            {initialData && (
              <button
                type="button"
                onClick={() => setActiveTab('associados')}
                className={`px-6 py-3.5 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                  activeTab === 'associados'
                    ? 'border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10'
                    : 'border-transparent text-text-subtle hover:text-text-base hover:bg-white/5'
                }`}
              >
                <Users className="w-4 h-4" />
                Associados Vinculados
              </button>
            )}
            </div>
          )}

          {/* Form Content */}
          <form id="plano-pax-form" onSubmit={handleSubmit(onSubmit, onError)} className="flex-1 flex flex-col overflow-hidden">
            {isDirty && (
              <div className="px-8 pt-4 shrink-0">
                <AlertaAlteracoesPendentes
                  visivel={isDirty}
                  formId="plano-pax-form"
                  salvando={isSubmitting}
                  posicao="compact"
                  mensagem="Existem alterações pendentes nas regras ou valores deste plano PAX. Salve para registrar no banco de dados."
                />
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-8">
              
              {(!initialData ? step === 1 : activeTab === 'identificacao') && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-3xl">
                  <div className="bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6">
                    <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                      <div className="p-2 bg-[#3B82F6]/10 rounded-xl text-[#3B82F6]">
                        <Info className="w-5 h-5" />
                      </div>
                      <h4 className="text-lg font-bold text-text-base tracking-tight">
                        Identificação do Plano
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Código do Plano *</label>
                        <input
                          {...register('codigo')}
                          className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-subtle focus:outline-none cursor-not-allowed uppercase transition-all"
                          placeholder="Gerado Autom." readOnly
                        />
                        {errors.codigo && <p className="text-red-400 text-xs mt-1">{errors.codigo.message}</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Nome do Plano *</label>
                        <input
                          {...register('nome')}
                          className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all"
                          placeholder="Ex: Plano Ouro"
                        />
                        {errors.nome && <p className="text-red-400 text-xs mt-1">{errors.nome.message}</p>}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Descrição</label>
                      <textarea
                        {...register('descricao')}
                        rows={3}
                        className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all resize-none"
                        placeholder="Detalhes internos do plano..."
                      />
                    </div>

                    <div className="p-5 bg-bg-surface rounded-2xl border border-border-default space-y-4 shadow-sm">
                      <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider">Tipo de Plano</label>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            value="individual"
                            {...register('tipo_plano')}
                            className="w-4 h-4 text-[#3B82F6] bg-bg-surface border-border-default focus:ring-[#3B82F6] focus:ring-2"
                          />
                          <span className="text-text-base font-medium group-hover:text-[#3B82F6] transition-colors">Individual</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            value="coletivo"
                            {...register('tipo_plano')}
                            className="w-4 h-4 text-[#3B82F6] bg-bg-surface border-border-default focus:ring-[#3B82F6] focus:ring-2"
                          />
                          <span className="text-text-base font-medium group-hover:text-[#3B82F6] transition-colors">Coletivo (Familiar)</span>
                        </label>
                      </div>

                      {/* Card com as Regras de Cálculo de Mensalidades para Planos Individuais e Coletivos */}
                      <div className="pt-2">
                        <RegrasCalculoInfo 
                          initialTab={watch('tipo_plano') === 'coletivo' ? 'coletivo' : 'individual'}
                          onTabChange={(tab) => {
                            setValue('tipo_plano', tab, { shouldValidate: true, shouldDirty: true });
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Início da Vigência</label>
                        <input
                          type="date"
                          {...register('vigencia_inicio')}
                          className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Fim da Vigência</label>
                        <input
                          type="date"
                          {...register('vigencia_fim')}
                          className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <input
                        type="checkbox"
                        id="ativo"
                        {...register('ativo')}
                        className="w-5 h-5 rounded border-border-default bg-bg-surface text-[#3B82F6] focus:ring-[#3B82F6] focus:ring-2"
                      />
                      <label htmlFor="ativo" className="text-sm font-semibold text-text-base cursor-pointer">
                        Plano Ativo para comercialização
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {(!initialData ? step === 2 : activeTab === 'valores') && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-4xl">
                  
                  <div className="bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6">
                    <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                      <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                        <Users className="w-5 h-5" />
                      </div>
                      <h4 className="text-lg font-bold text-text-base tracking-tight">
                        Configurações e Limites
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {watch('tipo_plano') === 'coletivo' && (
                        <div className="space-y-1">
                          <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Limite Máximo de Vidas *</label>
                          <input
                            type="number"
                            {...register('limite_vidas', { valueAsNumber: true })}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all"
                          />
                          {errors.limite_vidas && <p className="text-red-400 text-xs mt-1">{errors.limite_vidas.message}</p>}
                        </div>
                      )}
                      
                                            {watch('tipo_plano') !== 'coletivo' && (
                        <div className="space-y-1">
                          <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Mínimo de Vidas (Cálculo)</label>
                          <input
                            type="number"
                            {...register('minimo_vidas_calculo', { valueAsNumber: true })}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6">
                    <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                      <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <h4 className="text-lg font-bold text-text-base tracking-tight">
                        Regra de Mensalidade
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className={`flex items-start p-4 border rounded-xl cursor-pointer transition-colors ${watch('regra_calculo') === 'fixo' ? 'border-[#3B82F6] bg-[#3B82F6]/5' : 'border-border-default bg-bg-surface hover:bg-bg-hover'}`}>
                        <div className="flex items-center h-5">
                          <input
                            type="radio"
                            value="fixo"
                            {...register('regra_calculo')}
                            className="w-4 h-4 text-[#3B82F6] bg-bg-surface border-border-default focus:ring-[#3B82F6]"
                          />
                        </div>
                        <div className="ml-3 flex flex-col">
                          <span className="text-sm font-bold text-text-base mb-1">Valor Fixo</span>
                          <span className="text-xs text-text-muted">Valor único independente do número de vidas.</span>
                        </div>
                      </label>
                      <label className={`flex items-start p-4 border rounded-xl transition-colors ${watch('regra_calculo') === 'por_vida' ? 'border-[#3B82F6] bg-[#3B82F6]/5' : 'border-border-default bg-bg-surface'} ${watch('tipo_plano') === 'coletivo' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-bg-hover'}`}>
                        <div className="flex items-center h-5">
                          <input
                            type="radio"
                            value="por_vida"
                            {...register('regra_calculo')}
                            className="w-4 h-4 text-[#3B82F6] bg-bg-surface border-border-default focus:ring-[#3B82F6]" disabled={watch('tipo_plano') === 'coletivo'} />
                        </div>
                        <div className="ml-3 flex flex-col">
                          <span className="text-sm font-bold text-text-base mb-1">Por Vida</span>
                          <span className="text-xs text-text-muted">Multiplica o valor pelo total de associado + dependentes.</span>
                        </div>
                      </label>
                      <label className={`flex items-start p-4 border rounded-xl transition-colors ${watch('regra_calculo') === 'faixa_etaria' ? 'border-[#3B82F6] bg-[#3B82F6]/5' : 'border-border-default bg-bg-surface'} ${watch('tipo_plano') === 'coletivo' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-bg-hover'}`}>
                        <div className="flex items-center h-5">
                          <input
                            type="radio"
                            value="faixa_etaria"
                            {...register('regra_calculo')}
                            className="w-4 h-4 text-[#3B82F6] bg-bg-surface border-border-default focus:ring-[#3B82F6]" disabled={watch('tipo_plano') === 'coletivo'} />
                        </div>
                        <div className="ml-3 flex flex-col">
                          <span className="text-sm font-bold text-text-base mb-1">Faixa Etária</span>
                          <span className="text-xs text-text-muted">Valor varia conforme a idade de cada vida.</span>
                        </div>
                      </label>
                    </div>

                    {(watch('regra_calculo') === 'fixo' || watch('regra_calculo') === 'por_vida') && (
                      <div className="w-1/3 pt-2">
                        <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                          Valor Base (R$) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          {...register('valor_mensalidade', { valueAsNumber: true })}
                          className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all"
                        />
                      </div>
                    )}

                    {watch('regra_calculo') === 'faixa_etaria' && (
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-text-base">Tabela de Faixas</h4>
                          <button
                            type="button"
                            onClick={() => append({ idade_de: 0, idade_ate: 0, valor: 0 })}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg text-sm font-medium hover:bg-[#3B82F6]/20 transition-colors"
                          >
                            <Plus className="w-4 h-4" /> Adicionar Faixa
                          </button>
                        </div>
                        {errors.regra_calculo && <p className="text-red-400 text-xs mb-3">{errors.regra_calculo.message}</p>}
                        
                        <div className="space-y-3">
                          {fields.map((field, index) => (
                            <div key={field.id} className="flex gap-4 items-end bg-bg-surface p-4 rounded-xl border border-border-default">
                              <div className="flex-1">
                                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">De (anos)</label>
                                <input
                                  type="number"
                                  {...register(`faixas.${index}.idade_de`, { valueAsNumber: true })}
                                  className="w-full bg-bg-subtle border border-border-default rounded-lg px-3 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Até (anos)</label>
                                <input
                                  type="number"
                                  {...register(`faixas.${index}.idade_ate`, { valueAsNumber: true })}
                                  className="w-full bg-bg-subtle border border-border-default rounded-lg px-3 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Valor (R$)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  {...register(`faixas.${index}.valor`, { valueAsNumber: true })}
                                  className="w-full bg-bg-subtle border border-border-default rounded-lg px-3 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors mb-0.5"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          {fields.length === 0 && (
                            <p className="text-sm text-amber-500 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 flex items-center gap-2">
                              <Info className="w-4 h-4" />
                              Adicione ao menos uma faixa etária para prosseguir.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-border-default/50">
                      <div className="w-1/3">
                        <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Taxa de Adesão (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          {...register('taxa_adesao', { valueAsNumber: true })}
                          className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {(!initialData ? step === 3 : activeTab === 'carencia') && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-3xl">
                  <div className="bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6">
                    <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                      <div className="p-2 bg-orange-500/10 rounded-xl text-orange-400">
                        <Clock className="w-5 h-5" />
                      </div>
                      <h4 className="text-lg font-bold text-text-base tracking-tight">
                        Regras de Carência (dias)
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Geral</label>
                        <input
                          type="number"
                          {...register('carencia_geral_dias', { valueAsNumber: true })}
                          className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Morte Acidental</label>
                        <input
                          type="number"
                          {...register('carencia_acidente_dias', { valueAsNumber: true })}
                          className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Morte Natural</label>
                        <input
                          type="number"
                          {...register('carencia_morte_natural_dias', { valueAsNumber: true })}
                          className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6">
                    <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                      <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <h4 className="text-lg font-bold text-text-base tracking-tight">
                        Translado
                      </h4>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="incluiTranslado"
                          checked={incluiTranslado}
                          onChange={(e) => setIncluiTranslado(e.target.checked)}
                          className="w-5 h-5 rounded border-border-default bg-bg-surface text-[#3B82F6] focus:ring-[#3B82F6] focus:ring-2"
                        />
                        <label htmlFor="incluiTranslado" className="text-sm font-bold text-text-base cursor-pointer">
                          Inclui serviço de translado
                        </label>
                      </div>
                      
                      {incluiTranslado && (
                        <div className="pl-8 pt-2 space-y-6">
                          <div className="flex gap-6">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="radio" 
                                name="tipoTranslado" 
                                checked={tipoTranslado === 'local'} 
                                onChange={() => setTipoTranslado('local')}
                                className="w-4 h-4 text-[#3B82F6] focus:ring-[#3B82F6] bg-bg-surface border-border-default" 
                              />
                              <span className="text-sm font-medium text-text-base group-hover:text-[#3B82F6] transition-colors">Translado local apenas</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="radio" 
                                name="tipoTranslado" 
                                checked={tipoTranslado === 'raio'} 
                                onChange={() => setTipoTranslado('raio')}
                                className="w-4 h-4 text-[#3B82F6] focus:ring-[#3B82F6] bg-bg-surface border-border-default" 
                              />
                              <span className="text-sm font-medium text-text-base group-hover:text-[#3B82F6] transition-colors">Raio de cobertura (KM)</span>
                            </label>
                          </div>
                          
                          {tipoTranslado === 'raio' && (
                            <div className="w-1/3 space-y-1">
                              <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">Até ___ km</label>
                              <input
                                type="number"
                                {...register('km_translado_coberto', { valueAsNumber: true })}
                                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(!initialData ? step === 4 : activeTab === 'itens') && (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 flex-1 flex flex-col min-h-0">
                    <div className="flex items-center gap-3 border-b border-border-default/50 pb-4 mb-4 shrink-0">
                      <div className="p-2 bg-teal-500/10 rounded-xl text-teal-400">
                        <ListIcon className="w-5 h-5" />
                      </div>
                      <h4 className="text-lg font-bold text-text-base tracking-tight">
                        Itens e Coberturas do Plano
                      </h4>
                    </div>
                    <div className="flex-1 min-h-0">
                      <SeletorItensPax
                        itensCobertos={itensCobertos}
                        itensExcluidos={itensExcluidos}
                        observacoes={observacoesItens}
                        onChange={(cob, exc, obs) => {
                          setItensCobertos(cob);
                          setItensExcluidos(exc);
                          setObservacoesItens(obs);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {initialData && activeTab === 'associados' && (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 flex flex-col flex-1 min-h-0">
                    <div className="flex items-center justify-between border-b border-border-default/50 pb-4 mb-4 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-pink-500/10 rounded-xl text-pink-400">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Associados Vinculados
                          </h4>
                          <p className="text-sm text-text-subtle">
                            {associadosVinculados.length} associado(s) ativo(s) neste plano.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-[#3B82F6]/10 px-4 py-2 rounded-xl border border-[#3B82F6]/20">
                        <CreditCard className="w-5 h-5 text-[#3B82F6]" />
                        <span className="font-bold text-[#3B82F6]">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                            associadosVinculados.reduce((acc, a) => acc + (a.valor_plano || 0), 0)
                          )}
                        </span>
                        <span className="text-xs text-[#3B82F6]/70 ml-1">/mês total</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto bg-bg-surface rounded-xl border border-border-default">
                      {loadingAssociados ? (
                        <div className="flex items-center justify-center h-40">
                          <div className="w-8 h-8 border-4 border-[#3B82F6]/20 border-t-[#3B82F6] rounded-full animate-spin"></div>
                        </div>
                      ) : associadosVinculados.length > 0 ? (
                        <table className="w-full text-left text-sm text-text-subtle">
                          <thead className="bg-bg-subtle border-b border-border-default text-xs uppercase font-semibold text-text-muted sticky top-0 z-10">
                            <tr>
                              <th className="px-6 py-4">Nome / CPF</th>
                              <th className="px-6 py-4">Vidas</th>
                              <th className="px-6 py-4">Valor Mensalidade</th>
                              <th className="px-6 py-4">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-default">
                            {associadosVinculados.map((a) => (
                              <tr key={a.id} className="hover:bg-bg-hover/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-medium text-text-base">{a.nome}</div>
                                  <div className="text-xs">{a.cpf}</div>
                                </td>
                                <td className="px-6 py-4 font-medium text-text-base">
                                  {a.n_vidas}
                                </td>
                                <td className="px-6 py-4 font-bold text-emerald-400">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(a.valor_plano || 0)}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-bold uppercase tracking-wider">
                                    Ativo
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-text-muted">
                          <Users className="w-8 h-8 mb-2 opacity-20" />
                          <p>Nenhum associado vinculado a este plano.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
            
            {/* Footer Form Actions */}
            <div className="p-6 border-t border-border-default bg-bg-surface/50 flex justify-between shrink-0">
              <button
                type="button"
                onClick={!initialData && step > 1 ? prevStep : onClose}
                className="px-6 py-2.5 bg-bg-hover text-text-base rounded-xl font-medium hover:bg-[#64748B] transition-colors"
              >
                {!initialData && step > 1 ? 'Voltar' : 'Cancelar'}
              </button>
              
              <div className="flex gap-3">
                {!initialData && step < 4 ? (
                  <button
                    key="btn-next"
                    type="button"
                    onClick={nextStep}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
                  >
                    Próximo <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <BotaoSalvar
                    key="btn-submit"
                    type="submit"
                    salvando={isSubmitting}
                    texto={initialData ? 'Salvar Alterações' : 'Salvar Plano'}
                    textoSalvando="Salvando Plano..."
                    textoSalvo="Plano Salvo com Sucesso!"
                    variante="emerald"
                  />
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
