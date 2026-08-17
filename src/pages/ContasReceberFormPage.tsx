import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { salvarReceita, Receita, ParcelaReceber } from '../services/financeiroService';
import { getAssociados, Associado } from '../services/associadosService';
import { getContasBancariasAtivas } from '../services/contasBancariasService';
import { ContaBancaria } from '../types/contasBancarias';
import { getFromIDB, getAllFromIDB } from '../lib/idb';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { format, lastDayOfMonth } from 'date-fns';

import { useOptions } from '../hooks/useOptions';
import { OptionsModal } from '../components/OptionsModal';
import { Settings } from 'lucide-react';


const receitaSchema = z.object({
  tipo_devedor: z.enum(['associado', 'cliente_pf', 'cliente_pj']),
  associado_id: z.string().optional(),
  cliente_tipo: z.enum(['pf', 'pj']).optional(),
  cliente_nome: z.string().optional(),
  cliente_cpf_cnpj: z.string().optional(),
  
  descricao: z.string().min(3, "Descrição muito curta (mínimo 3 caracteres)"),
  categoria: z.string().min(1, "Selecione uma categoria"),
  data_emissao: z.string().min(1, "Data de emissão obrigatória"),
  data_inicio_cobranca: z.string().min(1, "Data de início obrigatória"),
  valor_total: z.preprocess((v) => (v === '' || v === undefined ? 0 : Number(v)), z.number().min(0.01, "O valor deve ser maior que zero")),
  qtd_parcelas: z.preprocess((v) => (v === '' || v === undefined ? 1 : Number(v)), z.number().min(1, "Mínimo 1 parcela").max(120, "Máximo 120 parcelas")),
  forma_pagamento_padrao: z.string().min(1, "Selecione a forma de pagamento"),
  conta_bancaria_id: z.string().optional(),
  observacoes: z.string().optional(),
  
  parcelas: z.array(z.object({
    id: z.string().optional(),
    numero_parcela: z.number(),
    data_vencimento: z.string(),
    valor: z.number().min(0.01),
    forma_pagamento: z.string(),
    observacao: z.string().optional()
  })).optional()
}).superRefine((data, ctx) => {
  if (data.tipo_devedor === 'associado' && (!data.associado_id || data.associado_id.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selecione um associado",
      path: ["associado_id"]
    });
  }
  if (data.tipo_devedor !== 'associado') {
    if (!data.cliente_nome || data.cliente_nome.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nome do cliente é obrigatório",
        path: ["cliente_nome"]
      });
    }
  }
});

type ReceitaFormData = z.infer<typeof receitaSchema>;

export const ContasReceberFormPage: React.FC = () => {
  const { id } = useParams();

  const { options: categorias, addOption: addCategoria, removeOption: removeCategoria } = useOptions('categorias_receita', ['Mensalidade', 'Taxa de Adesão', 'Serviço Extra', 'Outro']);
  const { options: formasPagamento, addOption: addFormaPagamento, removeOption: removeFormaPagamento } = useOptions('formas_pagamento', ['PIX', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência', 'Dinheiro', 'Cheque', 'Outro']);
  
  const [modalOpen, setModalOpen] = useState<'categoria' | 'forma_pagamento' | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetParcelaId = searchParams.get('parcela');
  const { state } = useAppContext();
  const isEditing = !!id;

  useEffect(() => {
    const fetchContas = async () => {
      const contas = await getContasBancariasAtivas(state.empresaSelecionada || 'empresa_padrao', state.isOnline);
      setContasBancarias(contas);
    };
    fetchContas();
  }, [state.empresaSelecionada, state.isOnline]);
  
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<ReceitaFormData>({
    resolver: zodResolver(receitaSchema) as any,
    defaultValues: {
      tipo_devedor: 'associado',
      associado_id: '',
      cliente_nome: '',
      cliente_cpf_cnpj: '',
      descricao: '',
      categoria: '',
      data_emissao: format(new Date(), "yyyy-MM-dd"),
      data_inicio_cobranca: format(new Date(), "yyyy-MM-dd"),
      valor_total: 0,
      qtd_parcelas: 1,
      forma_pagamento_padrao: '',
      conta_bancaria_id: '',
      parcelas: []
    }
  });

  const { fields: parcelasFields, replace: replaceParcelas } = useFieldArray({
    control: form.control,
    name: "parcelas"
  });

  useEffect(() => {
    const fetchAssociados = async () => {
      try {
        const data = await getAssociados(state.isOnline, state.empresaSelecionada);
        setAssociados(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchAssociados();
  }, [state.isOnline, state.empresaSelecionada]);

  // Carrega receita existente para edição, se id informado
  useEffect(() => {
    if (isEditing && id) {
      const loadReceita = async () => {
        try {
          const allReceitas = await getAllFromIDB<Receita>('receitas');
          const rec = allReceitas.find(r => r.id === id);
          const allParcelas = await getAllFromIDB<ParcelaReceber>('parcelas_receber');
          const parcs = allParcelas.filter(p => p.receita_id === id);

          if (rec) {
            form.reset({
              tipo_devedor: rec.tipo_devedor,
              associado_id: rec.associado_id || '',
              cliente_tipo: rec.cliente_tipo || 'pf',
              cliente_nome: rec.cliente_nome || '',
              cliente_cpf_cnpj: rec.cliente_cpf_cnpj || '',
              descricao: rec.descricao,
              categoria: rec.categoria,
              data_emissao: rec.data_emissao,
              data_inicio_cobranca: rec.data_inicio_cobranca,
              valor_total: rec.valor_total,
              qtd_parcelas: rec.qtd_parcelas,
              forma_pagamento_padrao: rec.forma_pagamento_padrao,
              conta_bancaria_id: rec.conta_bancaria_id || '',
              observacoes: rec.observacoes || '',
              parcelas: parcs.map(p => ({
                id: p.id,
                numero_parcela: p.numero_parcela,
                data_vencimento: p.data_vencimento,
                valor: p.valor,
                forma_pagamento: p.forma_pagamento || 'pix',
                observacao: p.observacoes || ''
              }))
            });
          }
        } catch (e) {
          console.error("Erro ao carregar receita para edição:", e);
        }
      };
      loadReceita();
    }
  }, [id, isEditing]);

  const gerarParcelas = (customData?: Partial<ReceitaFormData>) => {
    const values = { ...form.getValues(), ...customData };
    const qtd = Number(values.qtd_parcelas) || 1;
    const total = Number(values.valor_total) || 0;
    const dataInicioStr = values.data_inicio_cobranca || format(new Date(), "yyyy-MM-dd");
    const dataInicio = new Date(dataInicioStr + "T12:00:00");
    
    if (isNaN(dataInicio.getTime()) || !qtd || qtd <= 0 || !total || total <= 0) return [];

    const valorBase = Math.floor((total / qtd) * 100) / 100;
    const valorUltima = Number((total - (valorBase * (qtd - 1))).toFixed(2));

    const novasParcelas = [];
    const existingParcelas = form.getValues().parcelas || [];
    
    for (let i = 1; i <= qtd; i++) {
      let dataVencimento = new Date(dataInicio);
      dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));
      
      if (dataVencimento.getDate() !== dataInicio.getDate()) {
         dataVencimento = lastDayOfMonth(dataVencimento);
      }

      const existing = existingParcelas.find((p: any) => p.numero_parcela === i);
      novasParcelas.push({
        id: existing?.id, // Preserva apenas o ID para atualizar o registro existente
        numero_parcela: i,
        data_vencimento: format(dataVencimento, "yyyy-MM-dd"), // Atualiza a data de vencimento
        valor: (i === qtd ? valorUltima : valorBase), // Atualiza o valor
        forma_pagamento: existing?.forma_pagamento || values.forma_pagamento_padrao || 'pix',
        observacao: existing?.observacao || ''
      });
    }
    
    replaceParcelas(novasParcelas);
    return novasParcelas;
  };

  const onSubmit = async (data: ReceitaFormData) => {
    let parcelasSubmit = data.parcelas || [];
    const totalForm = Number(data.valor_total) || 0;
    const sumParcelas = parcelasSubmit.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    
    // Se não gerou parcelas ou se a soma não bate, gera automaticamente
    if (parcelasSubmit.length === 0 || Math.abs(sumParcelas - totalForm) > 0.05) {
      parcelasSubmit = gerarParcelas(data);
    }

    if (parcelasSubmit.length === 0) {
      toast.error('Informe um valor total maior que zero para gerar parcelas.');
      return;
    }
    
    setLoading(true);
    try {
      const receitaId = id || uuidv4();
      const existingDbParcelas = id ? await getAllFromIDB<ParcelaReceber>(`parcelas_receber`) : [];
      const dbParcMap = new Map(existingDbParcelas.map(p => [p.id, p]));
      
      let associadoSelecionado: Associado | undefined;
      if (data.tipo_devedor === 'associado' && data.associado_id) {
        associadoSelecionado = associados.find(a => a.id === data.associado_id);
      }

      const novaReceita: Receita = {
        id: receitaId,
        tenant_id: state.empresaSelecionada || 'empresa_padrao',
        tipo_devedor: data.tipo_devedor,
        
        associado_id: data.associado_id,
        associado_nome: associadoSelecionado?.nome,
        associado_cpf: associadoSelecionado?.cpf,
        associado_plano: associadoSelecionado?.plano_nome,
        
        cliente_tipo: data.cliente_tipo,
        cliente_nome: data.cliente_nome,
        cliente_cpf_cnpj: data.cliente_cpf_cnpj,
        
        descricao: data.descricao,
        categoria: data.categoria,
        data_emissao: data.data_emissao,
        data_inicio_cobranca: data.data_inicio_cobranca,
        valor_total: totalForm,
        qtd_parcelas: Number(data.qtd_parcelas) || 1,
        forma_pagamento_padrao: data.forma_pagamento_padrao as any,
        conta_bancaria_id: data.conta_bancaria_id,
        observacoes: data.observacoes,
        status: 'ativo',
        criado_por: state.user?.nome || 'Sistema'
      };

      const parcelasGeradas: ParcelaReceber[] = parcelasSubmit.map(p => {
        const dbP = p.id ? dbParcMap.get(p.id) : null;
        return {
        id: p.id || uuidv4(),
        tenant_id: state.empresaSelecionada || 'empresa_padrao',
        receita_id: receitaId,
        numero_parcela: p.numero_parcela,
        total_parcelas: Number(data.qtd_parcelas) || 1,
        tipo_devedor: data.tipo_devedor,
        devedor_nome: associadoSelecionado?.nome || data.cliente_nome || 'Desconhecido',
        devedor_cpf_cnpj: associadoSelecionado?.cpf || data.cliente_cpf_cnpj || '',
        descricao: data.descricao,
        data_vencimento: p.data_vencimento,
        valor: Number(p.valor) || 0,
        forma_pagamento: (p.forma_pagamento || data.forma_pagamento_padrao) as any,
        observacoes: p.observacao,
        status: dbP?.status || 'pendente',
        data_pagamento: dbP?.data_pagamento,
        valor_pago: dbP?.valor_pago
      };
      });

      await salvarReceita(state.isOnline, novaReceita, parcelasGeradas);
      toast.success(isEditing ? 'Receita atualizada com sucesso!' : 'Receita criada com sucesso!');
      navigate('/financeiro/contas-a-receber');
    } catch (e: any) {
      console.error("Erro ao salvar receita:", e);
      toast.error('Erro ao salvar receita: ' + (e?.message || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const onInvalid = (errors: any) => {
    console.warn("Validação do formulário falhou:", errors);
    toast.error("Preencha todos os campos obrigatórios marcados em vermelho.");
  };

  const errors = form.formState.errors;

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-bg-subtle border border-border-default text-text-subtle hover:text-text-base transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-base">{isEditing ? 'Editar Receita' : 'Nova Receita'}</h1>
          <p className="text-text-subtle mt-1">Preencha os dados para gerar contas a receber</p>
        </div>
      </div>

      <div className="bg-bg-subtle border border-border-default rounded-2xl flex-1 overflow-y-auto">
        <form onSubmit={form.handleSubmit(onSubmit as any, onInvalid)} className="p-6 space-y-8">
          
          {/* SEÇÃO 1: DEVEDOR */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-text-base border-b border-border-default pb-2">1. Identificação do Devedor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-subtle mb-1">Tipo de Devedor *</label>
                <select 
                  {...form.register("tipo_devedor")}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                >
                  <option value="associado">Associado</option>
                  <option value="cliente_pf">Cliente PF</option>
                  <option value="cliente_pj">Cliente PJ</option>
                </select>
              </div>



              {form.watch("tipo_devedor") === 'associado' && (
                <div>
                  <label className="block text-sm font-medium text-text-subtle mb-1">Associado *</label>
                  <select 
                    {...form.register("associado_id")}
                    className={`w-full bg-bg-surface border ${errors.associado_id ? 'border-rose-500' : 'border-border-default'} rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none`}
                  >
                    <option value="">Selecione um associado...</option>
                    {associados.map(a => (
                      <option key={a.id} value={a.id}>{a.nome} ({a.cpf})</option>
                    ))}
                  </select>
                  {errors.associado_id && (
                    <p className="text-rose-500 text-xs mt-1">{errors.associado_id.message}</p>
                  )}
                </div>
              )}

              {form.watch("tipo_devedor") !== 'associado' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-subtle mb-1">Nome/Razão Social *</label>
                    <input 
                      type="text"
                      {...form.register("cliente_nome")}
                      className={`w-full bg-bg-surface border ${errors.cliente_nome ? 'border-rose-500' : 'border-border-default'} rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none`}
                    />
                    {errors.cliente_nome && (
                      <p className="text-rose-500 text-xs mt-1">{errors.cliente_nome.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-subtle mb-1">CPF/CNPJ</label>
                    <input 
                      type="text"
                      {...form.register("cliente_cpf_cnpj")}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* SEÇÃO 2: DADOS DA RECEITA */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-text-base border-b border-border-default pb-2">2. Dados da Receita</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-subtle mb-1">Descrição *</label>
                <input 
                  type="text"
                  {...form.register("descricao")}
                  className={`w-full bg-bg-surface border ${errors.descricao ? 'border-rose-500' : 'border-border-default'} rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none`}
                  placeholder="Ex: Mensalidade Plano Premium"
                />
                {errors.descricao && (
                  <p className="text-rose-500 text-xs mt-1">{errors.descricao.message}</p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-text-subtle">Categoria *</label>
                  <button type="button" onClick={() => setModalOpen('categoria')} className="text-[#3B82F6] hover:bg-[#3B82F6]/10 p-1 rounded-md transition-colors" title="Gerenciar opções">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                <select 
                  {...form.register("categoria")}
                  className={`w-full bg-bg-surface border ${errors.categoria ? 'border-rose-500' : 'border-border-default'} rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none`}
                >
                  <option value="">Selecione...</option>
                  {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                {errors.categoria && <p className="text-rose-500 text-xs mt-1">{errors.categoria.message}</p>}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-text-subtle">Forma de Pagamento Padrão *</label>
                  <button type="button" onClick={() => setModalOpen('forma_pagamento')} className="text-[#3B82F6] hover:bg-[#3B82F6]/10 p-1 rounded-md transition-colors" title="Gerenciar opções">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                <select 
                  {...form.register("forma_pagamento_padrao")}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                >
                  <option value="">Selecione...</option>
                  {formasPagamento.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-subtle mb-1">
                  Conta Bancária de Destino
                </label>
                <select 
                  {...form.register("conta_bancaria_id")}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                >
                  <option value="">Nenhuma (Dinheiro/Outro)</option>
                  {contasBancarias.map(conta => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nome} ({conta.banco})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-subtle mb-1">Data de Emissão *</label>
                <input 
                  type="date"
                  {...form.register("data_emissao")}
                  className={`w-full bg-bg-surface border ${errors.data_emissao ? 'border-rose-500' : 'border-border-default'} rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none`}
                />
                {errors.data_emissao && (
                  <p className="text-rose-500 text-xs mt-1">{errors.data_emissao.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-subtle mb-1">Início da Cobrança *</label>
                <input 
                  type="date"
                  {...form.register("data_inicio_cobranca")}
                  className={`w-full bg-bg-surface border ${errors.data_inicio_cobranca ? 'border-rose-500' : 'border-border-default'} rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none`}
                />
                {errors.data_inicio_cobranca && (
                  <p className="text-rose-500 text-xs mt-1">{errors.data_inicio_cobranca.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-subtle mb-1">Valor Total (R$) *</label>
                <input 
                  type="number"
                  step="0.01"
                  disabled={isEditing}
                  {...form.register("valor_total")}
                  className={`w-full bg-bg-surface border ${errors.valor_total ? 'border-rose-500' : 'border-border-default'} rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                {errors.valor_total && (
                  <p className="text-rose-500 text-xs mt-1">{errors.valor_total.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-subtle mb-1">Quantidade de Parcelas *</label>
                <input 
                  type="number"
                  min="1"
                  max="120"
                  disabled={isEditing}
                  {...form.register("qtd_parcelas")}
                  className={`w-full bg-bg-surface border ${errors.qtd_parcelas ? 'border-rose-500' : 'border-border-default'} rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                {errors.qtd_parcelas && (
                  <p className="text-rose-500 text-xs mt-1">{errors.qtd_parcelas.message}</p>
                )}
              </div>
            </div>
          </section>

          {/* SEÇÃO 3: PARCELAS */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border-default pb-2">
              <h2 className="text-lg font-bold text-text-base">3. Parcelas Geradas</h2>
              <button
                type="button"
                onClick={() => gerarParcelas()}
                disabled={isEditing}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${isEditing ? 'bg-bg-hover text-text-subtle cursor-not-allowed opacity-50' : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'}`}
              >
                Gerar / Atualizar Parcelas
              </button>
            </div>
            
            {parcelasFields.length === 0 ? (
              <div className="text-center py-8 text-text-subtle border border-dashed border-border-default rounded-xl">
                Preencha o valor total e clique em "Gerar / Atualizar Parcelas" (ou elas serão geradas automaticamente ao salvar).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-surface border-b border-border-default text-xs uppercase tracking-wider text-text-subtle font-semibold">
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3">Valor (R$)</th>
                      <th className="px-4 py-3">Forma Pgto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#475569]">
                    {parcelasFields.map((field, index) => (
                      <tr key={field.id} className={`hover:bg-[#1A1D36] ${targetParcelaId && form.getValues(`parcelas.${index}.id`) === targetParcelaId ? 'bg-[#3B82F6]/10 border-l-4 border-[#3B82F6]' : ''}`}>
                        <td className="px-4 py-3 text-text-subtle font-medium">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="date"
                            {...form.register(`parcelas.${index}.data_vencimento`)}
                            disabled={isEditing && !!targetParcelaId && form.getValues(`parcelas.${index}.id`) !== targetParcelaId} className="w-full bg-bg-surface border border-border-default rounded-lg px-2 py-1 text-text-base text-sm focus:border-[#3B82F6] outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            {...form.register(`parcelas.${index}.valor`, { valueAsNumber: true })}
                            disabled={isEditing && !!targetParcelaId && form.getValues(`parcelas.${index}.id`) !== targetParcelaId} className="w-full bg-bg-surface border border-border-default rounded-lg px-2 py-1 text-text-base text-sm focus:border-[#3B82F6] outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            {...form.register(`parcelas.${index}.forma_pagamento`)}
                            disabled={isEditing && !!targetParcelaId && form.getValues(`parcelas.${index}.id`) !== targetParcelaId} className="w-full bg-bg-surface border border-border-default rounded-lg px-2 py-1 text-text-base text-sm focus:border-[#3B82F6] outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">(Padrão)</option>
                            {formasPagamento.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="flex justify-end pt-4 font-bold text-text-base text-lg">
              Total das Parcelas: R$ {
                (form.watch("parcelas") || []).reduce((acc, p) => acc + (Number(p?.valor) || 0), 0).toFixed(2)
              }
            </div>
          </section>

          <div className="pt-6 flex justify-end gap-3 border-t border-border-default">
            <button
              type="button"
              onClick={() => navigate('/financeiro/contas-a-receber')}
              className="px-6 py-2.5 rounded-xl text-text-muted hover:text-text-base hover:bg-bg-hover transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {isEditing ? 'Atualizar' : 'Salvar Receita'}
            </button>
          </div>
        </form>
      </div>

      {modalOpen === 'categoria' && (
        <OptionsModal
          title="Gerenciar Categorias"
          options={categorias}
          onAdd={addCategoria}
          onRemove={removeCategoria}
          onClose={() => setModalOpen(null)}
        />
      )}
      {modalOpen === 'forma_pagamento' && (
        <OptionsModal
          title="Gerenciar Formas de Pagamento"
          options={formasPagamento}
          onAdd={addFormaPagamento}
          onRemove={removeFormaPagamento}
          onClose={() => setModalOpen(null)}
        />
      )}
    </div>
  );
};
