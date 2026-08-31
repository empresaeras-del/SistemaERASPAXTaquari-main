import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useFornecedores } from '../../hooks/useFornecedores';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { isValidCPFOrCNPJ, maskCPFOrCNPJ } from '../../utils/validators';
import { 
  X, 
  Save, 
  Building, 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  CreditCard, 
  FileText, 
  Search,
  Globe,
  Tag,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BotaoSalvar } from '../common/BotaoSalvar';
import { AlertaAlteracoesPendentes } from '../common/AlertaAlteracoesPendentes';
import { 
  Fornecedor, 
  FornecedorInsert, 
  FornecedorUpdate, 
  CategoriaFornecedor, 
  TipoPessoa, 
  TipoFornecedor,
  StatusFornecedor 
} from '../../types/fornecedores';


const maskPhone = (value: string) => {
  let v = value.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 10) {
    return v.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (v.length > 6) {
    return v.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  } else if (v.length > 2) {
    return v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  }
  return v;
};

const maskCEP = (value: string) => {
  let v = value.replace(/\D/g, "");
  if (v.length > 8) v = v.slice(0, 8);
  return v.replace(/^(\d{5})(\d)/, "$1-$2");
};


const ListManageModal = ({ isOpen, onClose, title, items, onAdd, onRemove }: { isOpen: boolean, onClose: () => void, title: string, items: string[], onAdd: (item: string) => void, onRemove: (item: string) => void }) => {
  const [newItem, setNewItem] = useState('');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-bg-base/80 backdrop-blur-md">
      <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-md flex flex-col border border-border-default overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border-default">
          <h3 className="text-xl font-bold text-text-base">{title}</h3>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-base hover:bg-bg-hover rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto max-h-[400px]">
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={newItem} 
              onChange={e => setNewItem(e.target.value)} 
              placeholder="Adicionar nova opção..."
              className="flex-1 bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]"
            />
            <button 
              type="button"
              onClick={() => {
                if (newItem.trim() && !items.includes(newItem.trim())) {
                  onAdd(newItem.trim());
                  setNewItem('');
                }
              }}
              className="px-4 py-2 bg-[#3B82F6] text-white rounded-xl font-medium hover:bg-[#2563EB] transition-colors"
            >
              Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {items.map(item => (
              <div key={item} className="flex justify-between items-center p-3 bg-bg-surface border border-border-default rounded-xl">
                <span className="text-sm font-medium text-text-base">{item}</span>
                <button type="button" onClick={() => onRemove(item)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-text-muted text-center py-4">Nenhuma opção cadastrada.</p>}
          </div>
        </div>
      </div>

    </div>
  );
};

const defaultCategoriasList: CategoriaFornecedor[] = [
  'Urnas e Caixões',
  'Floricultura e Coroas',
  'Marmoraria e Lápides',
  'Translado e Veículos',
  'Equipamentos Médicos',
  'Tanatopraxia e Insumos',
  'Cemitério e Crematório',
  'Gráfica e Impressões',
  'Manutenção e Conservação',
  'Tecnologia e Sistemas',
  'Outros'
];


const defaultTiposFornecimentoList = [
  'produtos',
  'servicos',
  'ambos'
];

const schema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório').toUpperCase(),
  razao_social: z.string().min(2, 'Razão Social / Nome Completo é obrigatório'),
  nome_fantasia: z.string().min(1, 'Nome Fantasia é obrigatório'),
  cnpj_cpf: z.string().min(11, 'CPF ou CNPJ inválido').refine(val => isValidCPFOrCNPJ(val), { message: 'CPF ou CNPJ inválido' }),
  tipo_pessoa: z.enum(['PJ', 'PF']),
  inscricao_estadual: z.string().optional(),
  inscricao_municipal: z.string().optional(),
  tipo_fornecedor: z.string().min(1, 'Tipo de Fornecimento é obrigatório'),
  categoria: z.string().min(1, 'Selecione ou digite uma categoria'),
  status: z.enum(['ativo', 'inativo', 'bloqueado']),
  
  contato_nome: z.string().optional(),
  telefone: z.string().optional(),
  celular_whatsapp: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  website: z.string().optional(),
  
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  tipo_conta: z.enum(['corrente', 'poupanca']).optional(),
  chave_pix: z.string().optional(),
  
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: FornecedorInsert | FornecedorUpdate) => Promise<void>;
  initialData?: Fornecedor | null;
  proximoCodigo?: string;
}

export const FornecedorFormModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  proximoCodigo = 'FORN0001' 
}) => {
  const [activeTab, setActiveTab] = useState<'dados' | 'contato' | 'financeiro'>('dados');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fornecedores } = useFornecedores();
  const [categorias, setCategorias] = useState<string[]>(() => {
    const saved = localStorage.getItem('categorias_fornecedores');
    return saved ? JSON.parse(saved) : defaultCategoriasList;
  });
  const [tiposFornecimento, setTiposFornecimento] = useState<string[]>(() => {
    const saved = localStorage.getItem('tipos_fornecimento');
    return saved ? JSON.parse(saved) : defaultTiposFornecimentoList;
  });
  
  const [showCategoriasModal, setShowCategoriasModal] = useState(false);
  const [showTiposModal, setShowTiposModal] = useState(false);

  useEffect(() => {
    localStorage.setItem('categorias_fornecedores', JSON.stringify(categorias));
  }, [categorias]);

  useEffect(() => {
    localStorage.setItem('tipos_fornecimento', JSON.stringify(tiposFornecimento));
  }, [tiposFornecimento]);

  const [buscandoCep, setBuscandoCep] = useState(false);

  const isEditing = !!initialData;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      codigo: proximoCodigo,
      razao_social: '',
      nome_fantasia: '',
      cnpj_cpf: '',
      tipo_pessoa: 'PJ',
      tipo_fornecedor: 'produtos',
      categoria: 'Urnas e Caixões',
      status: 'ativo',
      tipo_conta: 'corrente'
    }
  });

  const tipoPessoaWatch = watch('tipo_pessoa');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('dados');
      if (initialData) {
        reset({
          codigo: initialData.codigo,
          razao_social: initialData.razao_social,
          nome_fantasia: initialData.nome_fantasia,
          cnpj_cpf: initialData.cnpj_cpf,
          tipo_pessoa: initialData.tipo_pessoa || 'PJ',
          inscricao_estadual: initialData.inscricao_estadual || '',
          inscricao_municipal: initialData.inscricao_municipal || '',
          tipo_fornecedor: initialData.tipo_fornecedor || 'produtos',
          categoria: initialData.categoria || 'Urnas e Caixões',
          status: initialData.status || 'ativo',
          contato_nome: initialData.contato_nome || '',
          telefone: initialData.telefone || '',
          celular_whatsapp: initialData.celular_whatsapp || '',
          email: initialData.email || '',
          website: initialData.website || '',
          cep: initialData.cep || '',
          logradouro: initialData.logradouro || '',
          numero: initialData.numero || '',
          complemento: initialData.complemento || '',
          bairro: initialData.bairro || '',
          cidade: initialData.cidade || '',
          uf: initialData.uf || '',
          banco: initialData.dados_bancarios?.banco || '',
          agencia: initialData.dados_bancarios?.agencia || '',
          conta: initialData.dados_bancarios?.conta || '',
          tipo_conta: initialData.dados_bancarios?.tipo_conta || 'corrente',
          chave_pix: initialData.dados_bancarios?.chave_pix || '',
          observacoes: initialData.observacoes || ''
        });
      } else {
        reset({
          codigo: proximoCodigo,
          razao_social: '',
          nome_fantasia: '',
          cnpj_cpf: '',
          tipo_pessoa: 'PJ',
          tipo_fornecedor: 'produtos',
          categoria: 'Urnas e Caixões',
          status: 'ativo',
          tipo_conta: 'corrente'
        });
      }
    }
  }, [isOpen, initialData, reset, proximoCodigo]);

  if (!isOpen) return null;

  const buscarCep = async () => {
    const cepValue = watch('cep')?.replace(/\D/g, '');
    if (!cepValue || cepValue.length !== 8) {
      toast.error('Informe um CEP válido com 8 dígitos.');
      return;
    }

    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepValue}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error('CEP não encontrado.');
      } else {
        setValue('logradouro', data.logradouro || '');
        setValue('bairro', data.bairro || '');
        setValue('cidade', data.localidade || '');
        setValue('uf', data.uf || '');
        toast.success('Endereço preenchido com sucesso!');
      }
    } catch (e) {
      toast.error('Erro ao consultar CEP.');
    } finally {
      setBuscandoCep(false);
    }
  };

  const onSubmit = async (values: FormData) => {
    setIsSubmitting(true);
    try {
      const payload: FornecedorInsert = {
        codigo: values.codigo,
        razao_social: values.razao_social,
        nome_fantasia: values.nome_fantasia,
        cnpj_cpf: values.cnpj_cpf,
        tipo_pessoa: values.tipo_pessoa as TipoPessoa,
        inscricao_estadual: values.inscricao_estadual || undefined,
        inscricao_municipal: values.inscricao_municipal || undefined,
        tipo_fornecedor: values.tipo_fornecedor as TipoFornecedor,
        categoria: values.categoria,
        status: values.status as StatusFornecedor,
        contato_nome: values.contato_nome || undefined,
        telefone: values.telefone || undefined,
        celular_whatsapp: values.celular_whatsapp || undefined,
        email: values.email || undefined,
        website: values.website || undefined,
        cep: values.cep || undefined,
        logradouro: values.logradouro || undefined,
        numero: values.numero || undefined,
        complemento: values.complemento || undefined,
        bairro: values.bairro || undefined,
        cidade: values.cidade || undefined,
        uf: values.uf || undefined,
        dados_bancarios: values.banco ? {
          banco: values.banco,
          agencia: values.agencia || '',
          conta: values.conta || '',
          tipo_conta: (values.tipo_conta || 'corrente') as 'corrente' | 'poupanca',
          chave_pix: values.chave_pix || undefined
        } : undefined,
        observacoes: values.observacoes || undefined
      };

      await onSave(payload);
      toast.success(isEditing ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar fornecedor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4">
      <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-border-default overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-border-default bg-bg-surface/30">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-base">
                {isEditing ? 'Editar Fornecedor / Prestador' : 'Novo Fornecedor / Prestador'}
              </h2>
              <p className="text-xs text-text-subtle mt-0.5">
                {isEditing ? `Código: ${initialData?.codigo}` : 'Cadastre um parceiro comercial de produtos ou serviços'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-text-subtle hover:text-text-base transition-colors p-2 rounded-xl hover:bg-bg-hover"
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
            <Building className="w-4 h-4" />
            <span>Dados Principais</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contato')}
            className={`flex items-center gap-2 py-3.5 px-4 border-b-2 font-semibold text-sm transition-all ${
              activeTab === 'contato'
                ? 'border-[#3B82F6] text-[#3B82F6] bg-bg-surface/80 rounded-t-xl'
                : 'border-transparent text-text-subtle hover:text-text-base'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Contato & Endereço</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('financeiro')}
            className={`flex items-center gap-2 py-3.5 px-4 border-b-2 font-semibold text-sm transition-all ${
              activeTab === 'financeiro'
                ? 'border-[#3B82F6] text-[#3B82F6] bg-bg-surface/80 rounded-t-xl'
                : 'border-transparent text-text-subtle hover:text-text-base'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Dados Bancários & Extras</span>
          </button>
        </div>

        {/* FORM CONTENT */}
        <form id="fornecedor-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          {isDirty && (
            <div className="px-6 pt-4 shrink-0">
              <AlertaAlteracoesPendentes
                visivel={isDirty}
                formId="fornecedor-form"
                salvando={isSubmitting}
                posicao="compact"
                mensagem="Existem alterações pendentes neste fornecedor/prestador. Salve para registrar no banco de dados."
              />
            </div>
          )}
          
          {/* TAB 1: DADOS PRINCIPAIS */}
          {activeTab === 'dados' && (
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                    Código Interno *
                  </label>
                  <input
                    {...register('codigo')}
                    readOnly
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-subtle focus:outline-none font-mono cursor-not-allowed"
                  />
                  {errors.codigo && <p className="text-red-400 text-xs mt-1">{errors.codigo.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                    Tipo de Pessoa *
                  </label>
                  <select
                    {...register('tipo_pessoa')}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="PJ">Pessoa Jurídica (PJ)</option>
                    <option value="PF">Pessoa Física (PF)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                    {tipoPessoaWatch === 'PJ' ? 'CNPJ *' : 'CPF *'}
                  </label>
                  <input
                    {...register('cnpj_cpf')}
                    onChange={(e) => {
                      e.target.value = maskCPFOrCNPJ(e.target.value, tipoPessoaWatch === 'PJ');
                      register('cnpj_cpf').onChange(e);
                    }}
                    placeholder={tipoPessoaWatch === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] font-mono"
                  />
                  {errors.cnpj_cpf && <p className="text-red-400 text-xs mt-1">{errors.cnpj_cpf.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                    {tipoPessoaWatch === 'PJ' ? 'Razão Social *' : 'Nome Completo *'}
                  </label>
                  <input
                    {...register('razao_social')}
                    placeholder={tipoPessoaWatch === 'PJ' ? 'Ex: Pax Brasil Indústria e Comércio Ltda' : 'Ex: João da Silva'}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                  />
                  {errors.razao_social && <p className="text-red-400 text-xs mt-1">{errors.razao_social.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                    Nome Fantasia / Nome Curto *
                  </label>
                  <input
                    {...register('nome_fantasia')}
                    placeholder="Ex: Pax Brasil Urnas"
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                  />
                  {errors.nome_fantasia && <p className="text-red-400 text-xs mt-1">{errors.nome_fantasia.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
                      Tipo de Fornecimento *
                    </label>
                    <button type="button" onClick={() => setShowTiposModal(true)} className="text-[10px] font-bold text-[#3B82F6] hover:underline">Gerenciar</button>
                  </div>
                  <select
                    {...register('tipo_fornecedor')}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] capitalize"
                  >
                    <option value="" disabled>Selecione...</option>
                    {tiposFornecimento.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo === 'produtos' ? 'Produtos / Insumos' : tipo === 'servicos' ? 'Prestador de Serviços' : tipo === 'ambos' ? 'Produtos e Serviços (Ambos)' : tipo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
                      Categoria *
                    </label>
                    <button type="button" onClick={() => setShowCategoriasModal(true)} className="text-[10px] font-bold text-[#3B82F6] hover:underline">Gerenciar</button>
                  </div>
                  <select
                    {...register('categoria')}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="" disabled>Selecione...</option>
                    {categorias.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                    Status de Operação *
                  </label>
                  <select
                    {...register('status')}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="bloqueado">Bloqueado / Suspenso</option>
                  </select>
                </div>
              </div>

              {tipoPessoaWatch === 'PJ' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border-default/50">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Inscrição Estadual (IE)
                    </label>
                    <input
                      {...register('inscricao_estadual')}
                      placeholder="Ex: 123.456.789.000"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Inscrição Municipal (IM)
                    </label>
                    <input
                      {...register('inscricao_municipal')}
                      placeholder="Ex: 987654"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONTATO & ENDEREÇO */}
          {activeTab === 'contato' && (
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span>Informações de Contato</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Nome do Responsável / Contato
                    </label>
                    <input
                      {...register('contato_nome')}
                      placeholder="Ex: Carlos Oliveira (Gerente de Contas)"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      E-mail Comercial
                    </label>
                    <input
                      type="email"
                      {...register('email')}
                      placeholder="vendas@fornecedor.com.br"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                    {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Telefone Fixo
                    </label>
                    <input
                      {...register('telefone')}
                      placeholder="(11) 3333-4444"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Celular / WhatsApp
                    </label>
                    <input
                      {...register('celular_whatsapp')}
                      placeholder="(11) 99999-8888"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Website / Catálogo
                    </label>
                    <input
                      {...register('website')}
                      placeholder="https://www.fornecedor.com.br"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                </div>
              </div>

              {/* ENDEREÇO */}
              <div className="space-y-4 pt-4 border-t border-border-default/60">
                <h3 className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>Endereço Comercial</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      CEP
                    </label>
                    <div className="flex gap-2">
                      <input
                        {...register('cep')}
                        placeholder="00000-000"
                        className="w-full bg-bg-surface border border-border-default rounded-xl px-3 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={buscarCep}
                        disabled={buscandoCep}
                        className="px-3 py-2.5 bg-[#3B82F6] text-white rounded-xl font-medium hover:bg-[#3B82F6]/90 transition-colors shrink-0 text-xs flex items-center gap-1"
                        title="Buscar endereço por CEP"
                      >
                        <Search className="w-3.5 h-3.5" />
                        {buscandoCep ? '...' : 'Buscar'}
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Logradouro / Rua
                    </label>
                    <input
                      {...register('logradouro')}
                      placeholder="Ex: Av. Paulista"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Número
                    </label>
                    <input
                      {...register('numero')}
                      placeholder="1000"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Complemento
                    </label>
                    <input
                      {...register('complemento')}
                      placeholder="Galpão 2"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Bairro
                    </label>
                    <input
                      {...register('bairro')}
                      placeholder="Centro"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Cidade / UF
                    </label>
                    <div className="flex gap-2">
                      <input
                        {...register('cidade')}
                        placeholder="São Paulo"
                        className="w-full bg-bg-surface border border-border-default rounded-xl px-3 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] text-sm"
                      />
                      <input
                        {...register('uf')}
                        placeholder="SP"
                        maxLength={2}
                        className="w-16 bg-bg-surface border border-border-default rounded-xl px-2 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] text-center uppercase text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DADOS BANCÁRIOS & EXTRAS */}
          {activeTab === 'financeiro' && (
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />
                  <span>Dados Bancários para Pagamentos</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Banco
                    </label>
                    <input
                      {...register('banco')}
                      placeholder="Ex: 341 - Itaú / 001 - Banco do Brasil"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Tipo de Conta
                    </label>
                    <select
                      {...register('tipo_conta')}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                    >
                      <option value="corrente">Conta Corrente</option>
                      <option value="poupanca">Conta Poupança</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Agência
                    </label>
                    <input
                      {...register('agencia')}
                      placeholder="Ex: 1234-5"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Número da Conta
                    </label>
                    <input
                      {...register('conta')}
                      placeholder="Ex: 56789-0"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                      Chave PIX
                    </label>
                    <input
                      {...register('chave_pix')}
                      placeholder="CNPJ, E-mail, Celular ou Aleatória"
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* OBSERVAÇÕES */}
              <div className="space-y-2 pt-4 border-t border-border-default/60">
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#3B82F6]" />
                  <span>Observações & Condições Comerciais</span>
                </label>
                <textarea
                  {...register('observacoes')}
                  rows={4}
                  placeholder="Prazo de entrega padrão, condições de pagamento, contratos vinculados, tabela de preços e notas internas..."
                  className="w-full bg-bg-surface border border-border-default rounded-xl p-4 text-text-base focus:outline-none focus:border-[#3B82F6] resize-none text-sm"
                />
              </div>
            </div>
          )}

          {/* FOOTER ACTIONS */}
          <div className="p-6 border-t border-border-default bg-bg-surface/50 flex items-center justify-between gap-3 shrink-0">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('dados')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${activeTab === 'dados' ? 'bg-[#3B82F6]/20 text-[#3B82F6]' : 'text-text-subtle'}`}
              >
                Passo 1
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('contato')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${activeTab === 'contato' ? 'bg-[#3B82F6]/20 text-[#3B82F6]' : 'text-text-subtle'}`}
              >
                Passo 2
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('financeiro')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${activeTab === 'financeiro' ? 'bg-[#3B82F6]/20 text-[#3B82F6]' : 'text-text-subtle'}`}
              >
                Passo 3
              </button>
            </div>

            <div className="flex items-center gap-3">
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
                texto={isEditing ? 'Salvar Alterações' : 'Salvar Fornecedor'}
                textoSalvando="Salvando Fornecedor..."
                textoSalvo="Fornecedor Salvo!"
                variante="primary"
              />
            </div>
          </div>
        </form>
      </div>
      <ListManageModal 
        isOpen={showCategoriasModal} 
        onClose={() => setShowCategoriasModal(false)} 
        title="Gerenciar Categorias" 
        items={categorias} 
        onAdd={cat => setCategorias([...categorias, cat])} 
        onRemove={cat => setCategorias(categorias.filter(c => c !== cat))} 
      />
      <ListManageModal 
        isOpen={showTiposModal} 
        onClose={() => setShowTiposModal(false)} 
        title="Gerenciar Tipos de Fornecimento" 
        items={tiposFornecimento} 
        onAdd={tipo => setTiposFornecimento([...tiposFornecimento, tipo])} 
        onRemove={tipo => setTiposFornecimento(tiposFornecimento.filter(t => t !== tipo))} 
      />
    </div>
  );
};
