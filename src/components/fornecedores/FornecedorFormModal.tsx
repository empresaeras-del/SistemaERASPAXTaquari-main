import React, { useState, useEffect, useMemo } from 'react';
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
  AlertTriangle,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BotaoSalvar } from '../common/BotaoSalvar';
import { AlertaAlteracoesPendentes } from '../common/AlertaAlteracoesPendentes';
import { FornecedorAssociadosTab } from './FornecedorAssociadosTab';
import { CATEGORIA_EMPRESA_CONVENIADA } from '../../utils/empresaVinculada';
import { opcoesTipoFornecimento } from '../../config/tiposFornecimento.config';
import { useCategoriasFornecedor } from '../../hooks/useCategoriasFornecedor';
import { CategoriasFornecedorModal } from './CategoriasFornecedorModal';
import {
  categoriaIdParaGravacao,
  nomesDeCategoriaParaSelecao,
} from '../../utils/categoriasFornecedor';
import {
  Fornecedor,
  FornecedorInsert,
  FornecedorUpdate,
  TipoPessoa,
  TipoFornecedor,
  StatusFornecedor,
} from '../../types/fornecedores';

const maskPhone = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 10) {
    return v.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (v.length > 6) {
    return v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  } else if (v.length > 2) {
    return v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  }
  return v;
};

const maskCEP = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (v.length > 8) v = v.slice(0, 8);
  return v.replace(/^(\d{5})(\d)/, '$1-$2');
};

const schema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório').toUpperCase(),
  razao_social: z.string().min(2, 'Razão Social / Nome Completo é obrigatório'),
  nome_fantasia: z.string().min(1, 'Nome Fantasia é obrigatório'),
  cnpj_cpf: z
    .string()
    .min(11, 'CPF ou CNPJ inválido')
    .refine((val) => isValidCPFOrCNPJ(val), { message: 'CPF ou CNPJ inválido' }),
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
  proximoCodigo = 'FORN0001',
}) => {
  const [activeTab, setActiveTab] = useState<'dados' | 'contato' | 'financeiro' | 'associados'>('dados');

  /**
   * A aba da carteira só existe para empresa conveniada JÁ GRAVADA, e o predicado usa a
   * categoria **salva** (`initialData`), não a que está no formulário: trocar o select faria a
   * aba piscar enquanto se edita, e os associados estão vinculados ao registro como ele está no
   * banco, não como está na tela.
   */
  const mostrarAbaAssociados =
    Boolean(initialData?.id) && initialData?.categoria === CATEGORIA_EMPRESA_CONVENIADA;

  // Categoria deixou de ser a de convênios e a aba estava aberta: volta para a primeira, senão
  // o formulário ficaria sem nenhum painel renderizado.
  useEffect(() => {
    if (activeTab === 'associados' && !mostrarAbaAssociados) setActiveTab('dados');
  }, [activeTab, mostrarAbaAssociados]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fornecedores } = useFornecedores();
  /**
   * As categorias vêm da tabela da empresa (migration `20260918010924`), não mais do
   * `localStorage` de cada navegador. Enquanto a empresa não tiver nenhuma cadastrada,
   * `nomesDeCategoriaParaSelecao` cai na lista modelo — senão o select abriria vazio e não
   * daria para salvar fornecedor nenhum.
   */
  const { categorias: categoriasCadastradas, carregar: recarregarCategorias } =
    useCategoriasFornecedor();
  const [showCategoriasModal, setShowCategoriasModal] = useState(false);

  const [buscandoCep, setBuscandoCep] = useState(false);

  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      codigo: proximoCodigo,
      razao_social: '',
      nome_fantasia: '',
      cnpj_cpf: '',
      tipo_pessoa: 'PJ',
      tipo_fornecedor: 'produtos',
      // Vazio, e não um nome cravado: as categorias vêm da tabela e o `reset` do efeito abaixo
      // escolhe a primeira da lista real assim que ela chega.
      categoria: '',
      status: 'ativo',
      tipo_conta: 'corrente',
    },
  });

  const categoriaSelecionada = watch('categoria');
  /**
   * A categoria JÁ GRAVADA continua na lista mesmo depois de desativada — sem isso, abrir para
   * editar perderia a seleção na tela e reescreveria o campo ao salvar, em silêncio. Mesma
   * escolha do seletor de conta contábil e de `idJaSelecionado`.
   */
  const categorias = useMemo(
    () => nomesDeCategoriaParaSelecao(categoriasCadastradas, categoriaSelecionada || initialData?.categoria),
    [categoriasCadastradas, categoriaSelecionada, initialData?.categoria],
  );


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
          categoria: initialData.categoria || categorias[0] || '',
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
          observacoes: initialData.observacoes || '',
        });
      } else {
        reset({
          codigo: proximoCodigo,
          razao_social: '',
          nome_fantasia: '',
          cnpj_cpf: '',
          tipo_pessoa: 'PJ',
          tipo_fornecedor: 'produtos',
          categoria: categorias[0] || '',
          status: 'ativo',
          tipo_conta: 'corrente',
        });
      }
    }
    // `categorias` entra nas deps porque é de onde sai o default do cadastro novo: com a
    // lista cravada em literal, o default apontava para uma categoria que a empresa pode
    // ter desativado ou renomeado.
  }, [isOpen, initialData, reset, proximoCodigo, categorias]);

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
        // `null`, nunca `undefined`: JSON.stringify descarta chave `undefined` e o update
        // chegaria ao Postgres sem a coluna, deixando o id antigo no banco depois de o
        // operador ter trocado a categoria na tela.
        categoria_id: categoriaIdParaGravacao(categoriasCadastradas, values.categoria),
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
        dados_bancarios: values.banco
          ? {
              banco: values.banco,
              agencia: values.agencia || '',
              conta: values.conta || '',
              tipo_conta: (values.tipo_conta || 'corrente') as 'corrente' | 'poupanca',
              chave_pix: values.chave_pix || undefined,
            }
          : undefined,
        observacoes: values.observacoes || undefined,
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
      {/* A carteira é uma grade de 12 meses; nos 768px que bastam para os formulários ela
          viraria rolagem horizontal do começo ao fim. O modal alarga só nessa aba. */}
      <div
        className={`bg-bg-subtle rounded-3xl shadow-2xl w-full ${
          activeTab === 'associados' ? 'max-w-6xl' : 'max-w-3xl'
        } max-h-[90vh] flex flex-col border border-border-default overflow-hidden animate-in fade-in zoom-in-95 transition-[max-width] duration-200`}
      >
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
                {isEditing
                  ? `Código: ${initialData?.codigo}`
                  : 'Cadastre um parceiro comercial de produtos ou serviços'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-subtle hover:text-text-base transition-colors p-2 rounded-xl hover:bg-bg-hover"
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

          {mostrarAbaAssociados && (
            <button
              type="button"
              onClick={() => setActiveTab('associados')}
              className={`flex items-center gap-2 py-3.5 px-4 border-b-2 font-semibold text-sm transition-all ${
                activeTab === 'associados'
                  ? 'border-[#3B82F6] text-[#3B82F6] bg-bg-surface/80 rounded-t-xl'
                  : 'border-transparent text-text-subtle hover:text-text-base'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Associados & Mensalidades</span>
            </button>
          )}
        </div>

        {/* FORM CONTENT */}
        <form
          id="fornecedor-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 overflow-hidden"
        >
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
                  {errors.codigo && (
                    <p className="text-red-400 text-xs mt-1">{errors.codigo.message}</p>
                  )}
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
                  {errors.cnpj_cpf && (
                    <p className="text-red-400 text-xs mt-1">{errors.cnpj_cpf.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                    {tipoPessoaWatch === 'PJ' ? 'Razão Social *' : 'Nome Completo *'}
                  </label>
                  <input
                    {...register('razao_social')}
                    placeholder={
                      tipoPessoaWatch === 'PJ'
                        ? 'Ex: Pax Brasil Indústria e Comércio Ltda'
                        : 'Ex: João da Silva'
                    }
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                  />
                  {errors.razao_social && (
                    <p className="text-red-400 text-xs mt-1">{errors.razao_social.message}</p>
                  )}
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
                  {errors.nome_fantasia && (
                    <p className="text-red-400 text-xs mt-1">{errors.nome_fantasia.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  {/*
                    Sem "Gerenciar": tipo de fornecimento é um domínio fechado de três valores,
                    não um catálogo da empresa. Acrescentar um quarto valor produzia um
                    fornecedor sem rótulo, fora do filtro e fora dos contadores da listagem.
                    O domínio vale também no banco — `fornecedores_tipo_fornecedor_check`.
                  */}
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                    Tipo de Fornecimento *
                  </label>
                  <select
                    {...register('tipo_fornecedor')}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {opcoesTipoFornecimento(initialData?.tipo_fornecedor).map((tipo) => (
                      <option key={tipo.valor} value={tipo.valor}>
                        {tipo.rotulo}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
                      Categoria *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCategoriasModal(true)}
                      className="text-[10px] font-bold text-[#3B82F6] hover:underline"
                    >
                      Gerenciar
                    </button>
                  </div>
                  <select
                    {...register('categoria')}
                    className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {categorias.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
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
                    {errors.email && (
                      <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
                    )}
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

          {/* TAB 4: ASSOCIADOS VINCULADOS E MENSALIDADES (só para empresa conveniada) */}
          {activeTab === 'associados' && mostrarAbaAssociados && (
            <FornecedorAssociadosTab
              fornecedorId={initialData?.id}
              tenantId={initialData?.tenant_id}
              nomeEmpresa={initialData?.razao_social || initialData?.nome_fantasia}
              documentoEmpresa={initialData?.cnpj_cpf}
            />
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
      {showCategoriasModal && (
        <CategoriasFornecedorModal
          onClose={() => setShowCategoriasModal(false)}
          onAlterou={recarregarCategorias}
        />
      )}
    </div>
  );
};
