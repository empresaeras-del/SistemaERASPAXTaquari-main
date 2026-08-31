import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { salvarDespesa, getDespesaCompleta, Despesa, ParcelaPagar } from '../services/financeiroService';
import { getAllFromIDB } from '../lib/idb';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Save, Settings, Loader2 } from 'lucide-react';
import { generateUUID } from '../utils/uuid';
import toast from 'react-hot-toast';
import { format, lastDayOfMonth } from 'date-fns';
import { getContasBancariasAtivas } from '../services/contasBancariasService';
import { ContaBancaria } from '../types/contasBancarias';
import { useOptions } from '../hooks/useOptions';
import { OptionsModal } from '../components/OptionsModal';
import { BotaoSalvar } from '../components/common/BotaoSalvar';
import { canEditFinanceiro, alertPermissionRestriction } from '../utils/permissions';

const defaultCategoriasDespesa = [
  'Repasse Credenciados / Prestadores',
  'Fornecedores',
  'Aluguel',
  'Salários e Encargos',
  'Impostos e Taxas',
  'Água / Luz / Telefone',
  'Serviços de Terceiros',
  'Manutenção e Conservação',
  'Combustível e Transporte',
  'Marketing e Publicidade',
  'Material de Escritório',
  'Despesas Bancárias',
  'Outros'
];

const defaultCentrosCusto = [
  'Rede Assistencial',
  'Funerária',
  'Cemitério',
  'Administrativo',
  'Financeiro',
  'Comercial / Vendas',
  'Operacional',
  'TI e Sistemas',
  'Geral'
];

const defaultFormasPagamento = [
  'PIX',
  'Boleto',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Transferência',
  'Dinheiro',
  'Cheque',
  'Outro'
];

const despesaSchema = z.object({
  tipo_credor: z.enum(['fornecedor_pf', 'fornecedor_pj', 'funcionario', 'outro']),
  credor_nome: z.string().min(3, "Nome muito curto (mínimo 3 caracteres)"),
  credor_cpf_cnpj: z.string().optional(),
  
  descricao: z.string().min(3, "Descrição muito curta (mínimo 3 caracteres)"),
  categoria: z.string().min(1, "Selecione uma categoria"),
  centro_custo: z.string().optional(),
  data_emissao: z.string().min(1, "Data de emissão obrigatória"),
  data_inicio_pagamento: z.string().min(1, "Data de início obrigatória"),
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
});

type DespesaFormData = z.infer<typeof despesaSchema>;

export const ContasPagarFormPage: React.FC = () => {
  const { id } = useParams();

  const { options: categorias, addOption: addCategoria, editOption: editCategoria, removeOption: removeCategoria } = useOptions('categorias_despesa', defaultCategoriasDespesa);
  const { options: centrosCusto, addOption: addCentroCusto, editOption: editCentroCusto, removeOption: removeCentroCusto } = useOptions('centros_custo', defaultCentrosCusto);
  const { options: formasPagamento, addOption: addFormaPagamento, editOption: editFormaPagamento, removeOption: removeFormaPagamento } = useOptions('formas_pagamento', defaultFormasPagamento);
  
  const [modalOpen, setModalOpen] = useState<'categoria' | 'centro_custo' | 'forma_pagamento' | null>(null);

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
  
  const [loading, setLoading] = useState(false);
  const [loadingDados, setLoadingDados] = useState(isEditing);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);

  const form = useForm<DespesaFormData>({
    resolver: zodResolver(despesaSchema) as any,
    defaultValues: {
      tipo_credor: 'fornecedor_pj',
      credor_nome: '',
      credor_cpf_cnpj: '',
      descricao: '',
      categoria: 'Repasse Credenciados / Prestadores',
      centro_custo: 'Rede Assistencial',
      data_emissao: format(new Date(), "yyyy-MM-dd"),
      data_inicio_pagamento: format(new Date(), "yyyy-MM-dd"),
      valor_total: 0,
      qtd_parcelas: 1,
      forma_pagamento_padrao: 'pix',
      conta_bancaria_id: '',
      parcelas: []
    }
  });

  const { fields: parcelasFields, replace: replaceParcelas } = useFieldArray({
    control: form.control,
    name: "parcelas"
  });

  useEffect(() => {
    if (isEditing && id) {
      if (!canEditFinanceiro(state.user, state.isOnline)) {
        alertPermissionRestriction('Financeiro (Contas a Pagar)', 'editar despesas ou parcelas');
        navigate('/financeiro/contas-a-pagar');
        return;
      }
      const loadDespesa = async () => {
        setLoadingDados(true);
        try {
          const { despesa: desp, parcelas: parcs } = await getDespesaCompleta(state.isOnline, id, targetParcelaId);

          if (desp) {
            form.reset({
              tipo_credor: (desp.tipo_credor as any) || 'fornecedor_pj',
              credor_nome: desp.credor_nome || '',
              credor_cpf_cnpj: desp.credor_cpf_cnpj || '',
              descricao: desp.descricao || '',
              categoria: desp.categoria || 'Repasse Credenciados / Prestadores',
              centro_custo: desp.centro_custo || 'Rede Assistencial',
              data_emissao: desp.data_emissao || format(new Date(), "yyyy-MM-dd"),
              data_inicio_pagamento: desp.data_inicio_pagamento || format(new Date(), "yyyy-MM-dd"),
              valor_total: Number(desp.valor_total) || 0,
              qtd_parcelas: Number(desp.qtd_parcelas) || (parcs.length > 0 ? parcs.length : 1),
              forma_pagamento_padrao: desp.forma_pagamento_padrao || 'pix',
              conta_bancaria_id: desp.conta_bancaria_id || '',
              observacoes: desp.observacoes || '',
              parcelas: parcs.map(p => ({
                id: p.id,
                numero_parcela: p.numero_parcela,
                data_vencimento: p.data_vencimento,
                valor: Number(p.valor) || 0,
                forma_pagamento: p.forma_pagamento || desp.forma_pagamento_padrao || 'pix',
                observacao: p.observacoes || ''
              }))
            });
          } else {
            toast.error('Despesa vinculada não encontrada.');
          }
        } catch (e) {
          console.error("Erro ao carregar despesa para edição:", e);
          toast.error("Erro ao carregar os dados da despesa.");
        } finally {
          setLoadingDados(false);
        }
      };
      loadDespesa();
    }
  }, [id, isEditing, state.isOnline, targetParcelaId]);

  const gerarParcelas = (customData?: Partial<DespesaFormData>) => {
    const values = { ...form.getValues(), ...customData };
    const qtd = Number(values.qtd_parcelas) || 1;
    const total = Number(values.valor_total) || 0;
    const dataInicioStr = values.data_inicio_pagamento || format(new Date(), "yyyy-MM-dd");
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

  const onSubmit = async (data: DespesaFormData) => {
    let parcelasSubmit = data.parcelas || [];
    const totalForm = Number(data.valor_total) || 0;
    const sumParcelas = parcelasSubmit.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    
    if (parcelasSubmit.length === 0 || Math.abs(sumParcelas - totalForm) > 0.05) {
      parcelasSubmit = gerarParcelas(data);
    }

    if (parcelasSubmit.length === 0) {
      toast.error('Informe um valor total maior que zero para gerar parcelas.');
      return;
    }
    
    setLoading(true);
    try {
      const despesaId = id || generateUUID();
      const existingDbParcelas = id ? await getAllFromIDB<ParcelaPagar>(`parcelas_pagar`) : [];
      const dbParcMap = new Map(existingDbParcelas.map(p => [p.id, p]));
      
      const novaDespesa: Despesa = {
        id: despesaId,
        tenant_id: state.empresaSelecionada || 'empresa_padrao',
        tipo_credor: data.tipo_credor,
        credor_nome: data.credor_nome,
        credor_cpf_cnpj: data.credor_cpf_cnpj,
        descricao: data.descricao,
        categoria: data.categoria,
        centro_custo: data.centro_custo || 'Rede Assistencial',
        data_emissao: data.data_emissao,
        data_inicio_pagamento: data.data_inicio_pagamento,
        valor_total: totalForm,
        qtd_parcelas: Number(data.qtd_parcelas) || 1,
        forma_pagamento_padrao: data.forma_pagamento_padrao as any,
        conta_bancaria_id: data.conta_bancaria_id,
        observacoes: data.observacoes,
        status: 'ativo',
        criado_por: state.user?.nome || 'Sistema'
      };

      const parcelasGeradas: ParcelaPagar[] = parcelasSubmit.map(p => {
        const dbP = p.id ? dbParcMap.get(p.id) : null;
        return {
          id: p.id || generateUUID(),
          tenant_id: state.empresaSelecionada || 'empresa_padrao',
          despesa_id: despesaId,
          numero_parcela: p.numero_parcela,
          total_parcelas: Number(data.qtd_parcelas) || 1,
          tipo_credor: data.tipo_credor,
          credor_nome: data.credor_nome,
          credor_cpf_cnpj: data.credor_cpf_cnpj || '',
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

      await salvarDespesa(state.isOnline, novaDespesa, parcelasGeradas);
      toast.success(isEditing ? 'Despesa atualizada com sucesso!' : 'Despesa criada com sucesso!');
      navigate('/financeiro/contas-a-pagar');
    } catch (e: any) {
      console.error("Erro ao salvar despesa:", e);
      toast.error('Erro ao salvar despesa: ' + (e?.message || 'Tente novamente.'));
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
          <h1 className="text-2xl font-bold text-text-base">{isEditing ? 'Editar Despesa' : 'Nova Despesa'}</h1>
          <p className="text-text-subtle mt-1">Preencha os dados para gerar contas a pagar</p>
        </div>
      </div>

      <div className="bg-bg-subtle border border-border-default rounded-2xl flex-1 overflow-y-auto">
        {loadingDados ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-text-subtle">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
            <p className="text-sm font-medium">Carregando informações da despesa...</p>
          </div>
        ) : (
        <form onSubmit={form.handleSubmit(onSubmit as any, onInvalid)} className="p-6 space-y-8">
          
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-text-base border-b border-border-default pb-2">1. Identificação do Credor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-subtle mb-1">Tipo de Credor *</label>
                <select 
                  {...form.register("tipo_credor")}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                >
                  <option value="fornecedor_pj">Fornecedor PJ</option>
                  <option value="fornecedor_pf">Fornecedor PF</option>
                  <option value="funcionario">Funcionário</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-subtle mb-1">Nome/Razão Social *</label>
                <input 
                  type="text"
                  {...form.register("credor_nome")}
                  className={`w-full bg-bg-surface border ${errors.credor_nome ? 'border-rose-500' : 'border-border-default'} rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none`}
                />
                {errors.credor_nome && <p className="text-rose-500 text-xs mt-1">{errors.credor_nome.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-subtle mb-1">CPF/CNPJ</label>
                <input 
                  type="text"
                  {...form.register("credor_cpf_cnpj")}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-text-base border-b border-border-default pb-2">2. Dados da Despesa</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-subtle mb-1">Descrição *</label>
                <input 
                  type="text"
                  {...form.register("descricao")}
                  className={`w-full bg-bg-surface border ${errors.descricao ? 'border-rose-500' : 'border-border-default'} rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none`}
                />
                {errors.descricao && <p className="text-rose-500 text-xs mt-1">{errors.descricao.message}</p>}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-text-subtle">Categoria *</label>
                  <button 
                    type="button" 
                    onClick={() => setModalOpen('categoria')} 
                    className="text-[#3B82F6] hover:bg-[#3B82F6]/10 p-1 rounded-md transition-colors flex items-center gap-1 text-xs" 
                    title="Gerenciar Categorias"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Gerenciar</span>
                  </button>
                </div>
                <select 
                  {...form.register("categoria")}
                  className={`w-full bg-bg-surface border ${errors.categoria ? 'border-rose-500' : 'border-border-default'} rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none`}
                >
                  <option value="">Selecione a categoria...</option>
                  {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                {errors.categoria && <p className="text-rose-500 text-xs mt-1">{errors.categoria.message}</p>}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-text-subtle">Centro de Custo</label>
                  <button 
                    type="button" 
                    onClick={() => setModalOpen('centro_custo')} 
                    className="text-[#3B82F6] hover:bg-[#3B82F6]/10 p-1 rounded-md transition-colors flex items-center gap-1 text-xs" 
                    title="Gerenciar Centros de Custo"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Gerenciar</span>
                  </button>
                </div>
                <select 
                  {...form.register("centro_custo")}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                >
                  <option value="">Selecione o centro de custo...</option>
                  {centrosCusto.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-text-subtle">Forma de Pagamento Padrão *</label>
                  <button 
                    type="button" 
                    onClick={() => setModalOpen('forma_pagamento')} 
                    className="text-[#3B82F6] hover:bg-[#3B82F6]/10 p-1 rounded-md transition-colors flex items-center gap-1 text-xs" 
                    title="Gerenciar Formas de Pagamento"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Gerenciar</span>
                  </button>
                </div>
                <select 
                  {...form.register("forma_pagamento_padrao")}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none"
                >
                  {formasPagamento.map(fp => <option key={fp} value={fp.toLowerCase()}>{fp}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-subtle mb-1">
                  Conta Bancária de Origem
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
                {errors.data_emissao && <p className="text-rose-500 text-xs mt-1">{errors.data_emissao.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-subtle mb-1">Início do Pagamento *</label>
                <input 
                  type="date"
                  {...form.register("data_inicio_pagamento")}
                  className={`w-full bg-bg-surface border ${errors.data_inicio_pagamento ? 'border-rose-500' : 'border-border-default'} rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none`}
                />
                {errors.data_inicio_pagamento && <p className="text-rose-500 text-xs mt-1">{errors.data_inicio_pagamento.message}</p>}
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
                {errors.valor_total && <p className="text-rose-500 text-xs mt-1">{errors.valor_total.message}</p>}
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
                {errors.qtd_parcelas && <p className="text-rose-500 text-xs mt-1">{errors.qtd_parcelas.message}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-subtle mb-1">Observações</label>
                <textarea 
                  {...form.register("observacoes")}
                  rows={3}
                  className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:border-[#3B82F6] outline-none resize-none"
                  placeholder="Observações ou detalhes adicionais da despesa..."
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border-default pb-2">
              <h2 className="text-lg font-bold text-text-base">3. Parcelas Geradas</h2>
              <button
                type="button"
                onClick={() => gerarParcelas()}
                className="text-sm bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg font-medium transition-colors"
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
              onClick={() => navigate('/financeiro/contas-a-pagar')}
              className="px-6 py-2.5 rounded-xl text-text-muted hover:text-text-base hover:bg-bg-hover transition-colors font-medium"
            >
              Cancelar
            </button>
            <BotaoSalvar
              type="submit"
              salvando={loading}
              texto={isEditing ? 'Atualizar Despesa' : 'Salvar Despesa'}
              textoSalvando={isEditing ? 'Atualizando...' : 'Salvando Despesa...'}
              textoSalvo={isEditing ? 'Atualizado!' : 'Despesa Salva!'}
              variante="emerald"
            />
          </div>
        </form>
        )}
      </div>

      {modalOpen === 'categoria' && (
        <OptionsModal
          title="Gerenciar Categorias de Despesa"
          options={categorias}
          onAdd={addCategoria}
          onEdit={editCategoria}
          onRemove={removeCategoria}
          onClose={() => setModalOpen(null)}
        />
      )}
      {modalOpen === 'centro_custo' && (
        <OptionsModal
          title="Gerenciar Centros de Custo"
          options={centrosCusto}
          onAdd={addCentroCusto}
          onEdit={editCentroCusto}
          onRemove={removeCentroCusto}
          onClose={() => setModalOpen(null)}
        />
      )}
      {modalOpen === 'forma_pagamento' && (
        <OptionsModal
          title="Gerenciar Formas de Pagamento"
          options={formasPagamento}
          onAdd={addFormaPagamento}
          onEdit={editFormaPagamento}
          onRemove={removeFormaPagamento}
          onClose={() => setModalOpen(null)}
        />
      )}
    </div>
  );
};
