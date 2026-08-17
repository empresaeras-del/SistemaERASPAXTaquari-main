import { useToast } from "../context/ToastContext";
import { v4 as uuidv4 } from 'uuid';
import { useConfirm } from "../context/ConfirmContext";
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getPlanos, savePlano, deletePlano, Plano } from '../services/planosService';
import { Plus, Edit2, Trash2, Package, Search, X, Save, Filter } from 'lucide-react';

export const PlanosPage: React.FC = () => {
  const { state } = useAppContext();
  const toast = useToast();
  const { confirm } = useConfirm();
  
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPlano, setPreviewPlano] = useState<Plano | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<Partial<Plano> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [periodoFilter, setPeriodoFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = planos.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? p.status === statusFilter : true;
    const matchesPeriodo = periodoFilter ? p.periodicidade === periodoFilter : true;
    return matchesSearch && matchesStatus && matchesPeriodo;
  });

  const loadData = async () => {
    setLoading(true);
    try {
      if (state.empresaSelecionada) {
        const planosData = await getPlanos(state.isOnline, state.empresaSelecionada);
        setPlanos(planosData);
      } else {
        setPlanos([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);


  const handleOpenModal = (plano?: Plano) => {
    if (plano) {
      setEditingPlano({ ...plano });
    } else {
      setEditingPlano({
        id: uuidv4(),
        tenant_id: state.empresaSelecionada || '',
        periodicidade: 'mensal',
        status: 'ativo',
        preco: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPlano(null);
  };

  const handleSavePlano = async (e: React.FormEvent) => {
    if (editingPlano?.tenant_id === 'all') { toast.error('Selecione uma empresa específica antes de criar um plano.'); return; }
    if (editingPlano?.tenant_id === 'all') { toast.error('Selecione uma empresa específica antes de criar um plano.'); return; }
    e.preventDefault();
    if (!editingPlano || !editingPlano.id) return;
    
    try {
      const novoPlano = editingPlano as Plano;
      await savePlano(novoPlano, state.isOnline);
      await loadData();
      handleCloseModal();
      toast.success("Plano salvo com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar plano', error);
      toast.error('Erro ao salvar plano. Verifique se você está online.');
    }
  };

  const handleDeletePlano = async (id: string) => {
    confirm({
      title: "Excluir Plano",
      message: "Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.",
      danger: true,
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await deletePlano(id, state.isOnline);
          await loadData();
          toast.success("Plano excluído com sucesso!");
        } catch (error) {
          console.error('Erro ao excluir plano', error);
          toast.error('Erro ao excluir plano. Verifique se você está online.');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Planos</h2>
          <p className="text-text-subtle mt-1">Gerenciamento de planos de adesão.</p>
        </div>
        
        <button 
          disabled={!state.isOnline || !state.empresaSelecionada || state.empresaSelecionada === 'all'}
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          Novo Plano
        </button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
      <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col ${previewPlano ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-text-subtle" />
              <h3 className="font-semibold text-slate-700">Planos Cadastrados</h3>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                <input 
                  type="text" 
                  placeholder="Buscar planos..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Filter className="w-4 h-4" />
                Filtros
              </button>
            </div>
          </div>
          
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label className="block text-xs font-semibold text-text-subtle uppercase tracking-wider mb-1.5">Status</label>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-subtle uppercase tracking-wider mb-1.5">Periodicidade</label>
                <select 
                  value={periodoFilter} 
                  onChange={(e) => setPeriodoFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                >
                  <option value="">Todas</option>
                  <option value="mensal">Mensal</option>
                  <option value="anual">Anual</option>
                  <option value="unico">Único</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1">
          {loading ? (
             <div className="text-center text-text-subtle py-8">Carregando planos...</div>
          ) : !state.empresaSelecionada ? (
             <div className="text-center text-text-subtle py-8">Nenhuma empresa selecionada.</div>
          ) : filtered.length === 0 ? (
             <div className="text-center text-text-subtle py-8">Nenhum plano encontrado.</div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {filtered.map((plano) => (
                 <div 
                   key={plano.id}
                   className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col group relative"
                   onClick={() => setPreviewPlano(plano)}
                 >
                   <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={(e) => { e.stopPropagation(); handleOpenModal(plano); }} className="p-2 bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shadow-sm" title="Editar">
                       <Edit2 className="w-4 h-4" />
                     </button>
                     <button 
                       disabled={!state.isOnline}
                       onClick={(e) => { e.stopPropagation(); handleDeletePlano(plano.id); }}
                       className="p-2 bg-slate-50 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                       title="Excluir"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                   
                   <div className="mb-4 pr-20">
                     <h3 className="font-bold text-slate-800 text-lg line-clamp-1">{plano.nome}</h3>
                     <span className={`inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                       plano.status === 'ativo' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                     }`}>
                       {plano.status === 'ativo' ? 'Ativo' : 'Inativo'}
                     </span>
                   </div>

                   <div className="mt-auto pt-4 border-t border-slate-100">
                     <div className="flex items-baseline gap-1">
                       <span className="text-sm font-semibold text-text-subtle">R$</span>
                       <span className="text-3xl font-black text-slate-800 tracking-tight">
                         {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(plano.preco)}
                       </span>
                       <span className="text-sm font-medium text-text-subtle capitalize ml-1">
                         / {plano.periodicidade === 'unico' ? 'único' : plano.periodicidade}
                       </span>
                     </div>
                     {plano.descricao && (
                       <p className="text-sm text-text-subtle mt-3 line-clamp-2 leading-relaxed">
                         {plano.descricao}
                       </p>
                     )}
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      </div>
      {previewPlano && (
        <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0 bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="font-semibold text-slate-800">Detalhes do Plano</h3>
            <button onClick={() => setPreviewPlano(null)} className="text-text-subtle hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div>
              <h4 className="text-xl font-bold text-slate-800 mb-1 capitalize">{previewPlano.nome}</h4>
              <div className="flex items-baseline gap-1 text-blue-600">
                <span className="text-sm font-semibold">R$</span>
                <span className="text-2xl font-black tracking-tight">
                  {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(previewPlano.preco)}
                </span>
                <span className="text-sm font-medium capitalize ml-1">
                  / {previewPlano.periodicidade === 'unico' ? 'único' : previewPlano.periodicidade}
                </span>
              </div>
            </div>
            
            {previewPlano.descricao && (
              <div>
                <h5 className="text-sm font-medium text-slate-700 mb-2 border-b border-slate-200 pb-2">Descrição</h5>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {previewPlano.descricao}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-center items-center text-center">
                <p className="text-xs text-text-subtle mb-2 uppercase tracking-wider font-semibold">Status</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${previewPlano.status === 'ativo' ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  {previewPlano.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-center items-center text-center">
                <p className="text-xs text-text-subtle mb-2 uppercase tracking-wider font-semibold">Periodicidade</p>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border bg-blue-100 text-blue-700 border-blue-200 capitalize">
                  {previewPlano.periodicidade}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); handleOpenModal(previewPlano); setPreviewPlano(null); }} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
              Editar Plano
            </button>
            <button 
              disabled={!state.isOnline}
              onClick={(e) => { e.stopPropagation(); handleDeletePlano(previewPlano.id); setPreviewPlano(null); }} 
              className="px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-600 rounded-lg text-sm font-medium transition-colors border border-slate-200 disabled:opacity-50"
            >
              Excluir
            </button>
          </div>
        </div>
      )}
      </div>
      {isModalOpen && editingPlano && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4">
          <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-border-default overflow-hidden">
            <div className="px-6 py-4 border-b border-border-default flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-text-base tracking-tight">
                {editingPlano.nome ? 'Editar Plano' : 'Novo Plano'}
              </h3>
              <button onClick={handleCloseModal} className="text-text-subtle hover:text-text-base transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="planoForm" onSubmit={handleSavePlano} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-text-subtle mb-1">Nome do Plano *</label>
                  <input 
                    type="text" required
                    value={editingPlano.nome || ''}
                    onChange={e => setEditingPlano({...editingPlano, nome: e.target.value})}
                    className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-subtle mb-1">Descrição</label>
                  <textarea 
                    value={editingPlano.descricao || ''}
                    onChange={e => setEditingPlano({...editingPlano, descricao: e.target.value})}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-subtle mb-1">Preço (R$) *</label>
                    <input 
                      type="number" step="0.01" required min="0"
                      value={editingPlano.preco || 0}
                      onChange={e => setEditingPlano({...editingPlano, preco: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-subtle mb-1">Periodicidade *</label>
                    <select 
                      required
                      value={editingPlano.periodicidade || 'mensal'}
                      onChange={e => setEditingPlano({...editingPlano, periodicidade: e.target.value as any})}
                      className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all appearance-none"
                    >
                      <option value="mensal" className="bg-bg-surface">Mensal</option>
                      <option value="anual" className="bg-bg-surface">Anual</option>
                      <option value="unico" className="bg-bg-surface">Pagamento Único</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-subtle mb-1">Status</label>
                  <select 
                    value={editingPlano.status || 'ativo'}
                    onChange={e => setEditingPlano({...editingPlano, status: e.target.value as any})}
                    className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all appearance-none"
                  >
                    <option value="ativo" className="bg-bg-surface">Ativo</option>
                    <option value="inativo" className="bg-bg-surface">Inativo</option>
                  </select>
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-border-default bg-bg-surface/50 flex items-center justify-end gap-3 shrink-0 rounded-b-3xl">
              <button 
                type="button" 
                onClick={handleCloseModal}
                className="px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="planoForm"
                disabled={!state.isOnline}
                className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Salvar Plano
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
