import React, { useState, useEffect } from 'react';
import { useFornecedores } from '../hooks/useFornecedores';
import { FornecedorFormModal } from '../components/fornecedores/FornecedorFormModal';
import { FornecedorDetailsModal } from '../components/fornecedores/FornecedorDetailsModal';
import { 
  Fornecedor, 
  StatusFornecedor, 
  CategoriaFornecedor 
} from '../types/fornecedores';
import { 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  Eye, 
  Building, 
  Package, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  AlertOctagon, 
  Filter, 
  Download, 
  RefreshCw, 
  LayoutGrid, 
  List, 
  Phone, 
  Mail, 
  MapPin, 
  Building2,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirm } from '../context/ConfirmContext';


const defaultCategoriasList = [
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


export const FornecedoresPage: React.FC = () => {
  const [categorias, setCategorias] = useState<string[]>(defaultCategoriasList);
  const [tiposFornecimento, setTiposFornecimento] = useState<string[]>(defaultTiposFornecimentoList);

  useEffect(() => {
    const savedCats = localStorage.getItem('categorias_fornecedores');
    if (savedCats) setCategorias(JSON.parse(savedCats));
    
    const savedTipos = localStorage.getItem('tipos_fornecimento');
    if (savedTipos) setTiposFornecimento(JSON.parse(savedTipos));
  }, []);

  const { 
    fornecedores, 
    loading, 
    filtros, 
    setFiltros, 
    criar, 
    editar, 
    alterarStatus, 
    excluir, 
    restaurarDadosExemplo 
  } = useFornecedores();

  const { confirm } = useConfirm();

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);

  // Calculate Stats
  const totalFornecedores = fornecedores.length;
  const totalAtivos = fornecedores.filter(f => f.status === 'ativo').length;
  const totalProdutos = fornecedores.filter(f => f.tipo_fornecedor === 'produtos' || f.tipo_fornecedor === 'ambos').length;
  const totalServicos = fornecedores.filter(f => f.tipo_fornecedor === 'servicos' || f.tipo_fornecedor === 'ambos').length;

  // Next generated code
  const proximoCodigoCalculado = `FORN${String(totalFornecedores + 1).padStart(4, '0')}`;

  const handleOpenCreate = () => {
    setEditingFornecedor(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    setIsFormOpen(true);
  };

  const handleSaveFornecedor = async (data: any) => {
    if (editingFornecedor) {
      await editar(editingFornecedor.id, data);
    } else {
      await criar(data);
    }
  };

  const handleExcluir = (fornecedor: Fornecedor) => {
    confirm({
      title: 'Excluir Fornecedor?',
      message: `Tem certeza que deseja excluir o fornecedor "${fornecedor.nome_fantasia}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        try {
          await excluir(fornecedor.id);
          toast.success('Fornecedor excluído com sucesso!');
          if (selectedFornecedor?.id === fornecedor.id) {
            setSelectedFornecedor(null);
          }
        } catch (err: any) {
          toast.error(err.message || 'Erro ao excluir fornecedor.');
        }
      }
    });
  };

  const exportarCSV = () => {
    if (fornecedores.length === 0) {
      toast.error('Nenhum fornecedor para exportar.');
      return;
    }

    const headers = ['Código', 'Razão Social', 'Nome Fantasia', 'CNPJ/CPF', 'Tipo', 'Categoria', 'Status', 'Telefone', 'E-mail', 'Cidade/UF'];
    const rows = fornecedores.map(f => [
      f.codigo,
      `"${f.razao_social}"`,
      `"${f.nome_fantasia}"`,
      f.cnpj_cpf,
      f.tipo_fornecedor,
      `"${f.categoria}"`,
      f.status,
      f.telefone || f.celular_whatsapp || '',
      f.email || '',
      `"${f.cidade || ''}/${f.uf || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fornecedores_eras_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Arquivo CSV exportado com sucesso!');
  };

  const getStatusBadge = (status: StatusFornecedor) => {
    switch (status) {
      case 'ativo':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Ativo
          </span>
        );
      case 'inativo':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <XCircle className="w-3 h-3" />
            Inativo
          </span>
        );
      case 'bloqueado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertOctagon className="w-3 h-3" />
            Bloqueado
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      
      {/* HEADER PAGE TITLE & BREADCRUMB */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-subtle mb-1">
            <span>Administração</span>
            <span>/</span>
            <span className="text-[#3B82F6] font-semibold">Fornecedores & Prestadores</span>
          </div>
          <h1 className="text-2xl font-bold text-text-base tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-[#3B82F6]" />
            <span>Gestão de Fornecedores e Prestadores</span>
          </h1>
          <p className="text-xs text-text-subtle mt-1">
            Cadastre, controle e gerencie fornecedores de produtos funerários e prestadores de serviços parceiros
          </p>
        </div>

        {/* PRIMARY ACTIONS */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-bg-surface text-text-base border border-border-default rounded-xl text-xs font-semibold hover:bg-bg-hover transition-colors shadow-sm"
            title="Exportar fornecedores filtrados em CSV"
          >
            <Download className="w-4 h-4 text-text-subtle" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={restaurarDadosExemplo}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-bg-surface text-text-subtle border border-border-default rounded-xl text-xs font-medium hover:text-text-base hover:bg-bg-hover transition-colors"
            title="Restaurar lista de fornecedores de demonstração"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exemplos</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-blue-400 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Fornecedor</span>
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20 shrink-0">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Total de Cadastros</p>
            <p className="text-xl font-extrabold text-text-base mt-0.5">{totalFornecedores}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Fornecedores Ativos</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{totalAtivos}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Fornecem Produtos</p>
            <p className="text-xl font-extrabold text-blue-400 mt-0.5">{totalProdutos}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20 shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Prestadores de Serviços</p>
            <p className="text-xl font-extrabold text-purple-400 mt-0.5">{totalServicos}</p>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* SEARCH BAR */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            type="text"
            placeholder="Buscar por razão social, nome fantasia, código, CNPJ/CPF, cidade..."
            value={filtros.busca || ''}
            onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
            className="w-full bg-bg-subtle border border-border-default rounded-xl pl-10 pr-4 py-2 text-xs text-text-base focus:outline-none focus:border-[#3B82F6]"
          />
        </div>

        {/* DROPDOWN FILTERS */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1 text-text-subtle mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold">Filtros:</span>
          </div>

          <select
            value={filtros.categoria || 'todas'}
            onChange={(e) => setFiltros(prev => ({ ...prev, categoria: e.target.value }))}
            className="bg-bg-subtle border border-border-default rounded-xl px-3 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]"
          >
            <option value="todas">Todas as Categorias</option>
            {categorias.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={filtros.tipo_fornecedor || 'todos'}
            onChange={(e) => setFiltros(prev => ({ ...prev, tipo_fornecedor: e.target.value }))}
            className="bg-bg-subtle border border-border-default rounded-xl px-3 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="produtos">Apenas Produtos</option>
            <option value="servicos">Apenas Serviços</option>
            <option value="ambos">Produtos e Serviços</option>
          </select>

          <select
            value={filtros.status || 'todos'}
            onChange={(e) => setFiltros(prev => ({ ...prev, status: e.target.value }))}
            className="bg-bg-subtle border border-border-default rounded-xl px-3 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
            <option value="bloqueado">Bloqueados</option>
          </select>

          {/* VIEW SWITCHER */}
          <div className="flex items-center bg-bg-subtle border border-border-default p-1 rounded-xl ml-auto md:ml-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#3B82F6] text-white' : 'text-text-subtle hover:text-text-base'}`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-[#3B82F6] text-white' : 'text-text-subtle hover:text-text-base'}`}
              title="Visualização em Tabela"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT: GRID OR TABLE */}
      {loading ? (
        <div className="py-20 text-center text-text-subtle flex flex-col items-center">
          <div className="w-8 h-8 border-3 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-medium">Carregando lista de fornecedores...</p>
        </div>
      ) : fornecedores.length === 0 ? (
        <div className="py-20 text-center bg-bg-surface border border-border-default rounded-3xl p-8 space-y-3">
          <Building className="w-12 h-12 text-text-subtle mx-auto opacity-50" />
          <h3 className="text-base font-bold text-text-base">Nenhum fornecedor encontrado</h3>
          <p className="text-xs text-text-subtle max-w-md mx-auto">
            Não encontramos nenhum fornecedor ou prestador cadastrado com os filtros aplicados.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#3B82F6] text-white rounded-xl text-xs font-semibold hover:bg-[#3B82F6]/90 transition-colors mt-2"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Fornecedor
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {fornecedores.map(fornecedor => (
            <div
              key={fornecedor.id}
              className="bg-bg-surface border border-border-default rounded-2xl p-5 hover:border-[#3B82F6]/50 transition-all shadow-sm hover:shadow-md flex flex-col justify-between group"
            >
              <div>
                {/* CARD HEADER */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] font-bold text-text-subtle bg-bg-subtle px-2 py-0.5 rounded-md border border-border-default">
                        {fornecedor.codigo}
                      </span>
                      {getStatusBadge(fornecedor.status)}
                    </div>
                    <h3 className="text-base font-bold text-text-base mt-1.5 group-hover:text-[#3B82F6] transition-colors line-clamp-1">
                      {fornecedor.nome_fantasia}
                    </h3>
                    <p className="text-xs text-text-subtle line-clamp-1">{fornecedor.razao_social}</p>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-bg-subtle text-text-subtle border border-border-default shrink-0">
                    {fornecedor.tipo_pessoa || 'PJ'}
                  </span>
                </div>

                {/* BADGES */}
                <div className="flex items-center gap-2 my-3 flex-wrap text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] font-semibold border border-[#3B82F6]/20">
                    {fornecedor.categoria}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-bg-subtle text-text-subtle font-medium border border-border-default">
                    {fornecedor.tipo_fornecedor === 'produtos' ? 'Produtos' : fornecedor.tipo_fornecedor === 'servicos' ? 'Serviços' : fornecedor.tipo_fornecedor === 'ambos' ? 'Produtos & Serviços' : fornecedor.tipo_fornecedor}
                  </span>
                </div>

                {/* DETAILS LIST */}
                <div className="space-y-1.5 text-xs text-text-muted my-3 border-t border-border-default/50 pt-3">
                  <p className="flex items-center gap-2">
                    <strong className="text-text-subtle min-w-[70px]">CNPJ/CPF:</strong>
                    <span className="font-mono text-text-base">{fornecedor.cnpj_cpf}</span>
                  </p>
                  
                  {(fornecedor.telefone || fornecedor.celular_whatsapp) && (
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                      <span>{fornecedor.celular_whatsapp || fornecedor.telefone}</span>
                      {fornecedor.celular_whatsapp && (
                        <a
                          href={`https://wa.me/55${fornecedor.celular_whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:underline inline-flex items-center gap-0.5 text-[10px] ml-auto font-semibold"
                          title="Abrir WhatsApp"
                        >
                          <MessageSquare className="w-3 h-3" /> WhatsApp
                        </a>
                      )}
                    </p>
                  )}

                  {fornecedor.email && (
                    <p className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                      <span className="truncate">{fornecedor.email}</span>
                    </p>
                  )}

                  {fornecedor.cidade && (
                    <p className="flex items-center gap-2 text-text-subtle">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{fornecedor.cidade}/{fornecedor.uf}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* CARD FOOTER ACTIONS */}
              <div className="flex items-center justify-between pt-3 border-t border-border-default/60 mt-2 gap-2">
                <button
                  onClick={() => setSelectedFornecedor(fornecedor)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-bg-subtle text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors text-xs font-semibold"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver Detalhes</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(fornecedor)}
                    className="p-1.5 rounded-lg text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-colors"
                    title="Editar fornecedor"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleExcluir(fornecedor)}
                    className="p-1.5 rounded-lg text-text-subtle hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Excluir fornecedor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-bg-surface rounded-2xl border border-border-default overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-text-base">
              <thead className="bg-bg-subtle/80 text-text-subtle uppercase text-[10px] font-bold tracking-wider border-b border-border-default">
                <tr>
                  <th className="p-4">Código</th>
                  <th className="p-4">Fornecedor / Razão Social</th>
                  <th className="p-4">CNPJ/CPF</th>
                  <th className="p-4">Categoria</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Contato / Localidade</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default/60">
                {fornecedores.map(fornecedor => (
                  <tr key={fornecedor.id} className="hover:bg-bg-subtle/50 transition-colors">
                    <td className="p-4 font-mono font-bold text-text-subtle">{fornecedor.codigo}</td>
                    <td className="p-4">
                      <div className="font-bold text-text-base">{fornecedor.nome_fantasia}</div>
                      <div className="text-[11px] text-text-subtle truncate max-w-xs">{fornecedor.razao_social}</div>
                    </td>
                    <td className="p-4 font-mono text-text-subtle">{fornecedor.cnpj_cpf}</td>
                    <td className="p-4 font-medium">{fornecedor.categoria}</td>
                    <td className="p-4 capitalize text-text-subtle">{fornecedor.tipo_fornecedor}</td>
                    <td className="p-4 text-text-subtle">
                      <div>{fornecedor.celular_whatsapp || fornecedor.telefone || '-'}</div>
                      <div className="text-[11px]">{fornecedor.cidade ? `${fornecedor.cidade}/${fornecedor.uf}` : '-'}</div>
                    </td>
                    <td className="p-4">{getStatusBadge(fornecedor.status)}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedFornecedor(fornecedor)}
                          className="p-1.5 rounded-lg text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-colors"
                          title="Visualizar Detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(fornecedor)}
                          className="p-1.5 rounded-lg text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExcluir(fornecedor)}
                          className="p-1.5 rounded-lg text-text-subtle hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FORM MODAL */}
      {isFormOpen && (
        <FornecedorFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSaveFornecedor}
          initialData={editingFornecedor}
          proximoCodigo={proximoCodigoCalculado}
        />
      )}

      {/* DETAILS MODAL */}
      {selectedFornecedor && (
        <FornecedorDetailsModal
          fornecedor={selectedFornecedor}
          onClose={() => setSelectedFornecedor(null)}
          onEdit={() => {
            const f = selectedFornecedor;
            setSelectedFornecedor(null);
            handleOpenEdit(f);
          }}
          onStatusChange={async (id, status) => {
            await alterarStatus(id, status);
            setSelectedFornecedor(prev => prev ? { ...prev, status } : null);
            toast.success(`Status alterado para ${status}!`);
          }}
        />
      )}
    </div>
  );
};
