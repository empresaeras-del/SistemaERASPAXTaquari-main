import React, { useState } from 'react';
import { useItensFunerarios } from '../hooks/useItensFunerarios';
import { ItemFunerarioForm } from '../components/itens-funerarios/ItemFunerarioForm';
import { ItemFunerarioDetailsModal } from '../components/itens-funerarios/ItemFunerarioDetailsModal';
import { ItemFunerario } from '../types/itensFunerarios';
import { useAppContext } from '../context/AppContext';
import { Building2, Plus, Search, Pencil, Power, PowerOff, Package, CheckCircle, XCircle, LayoutGrid, List, Filter } from 'lucide-react';
import toast from 'react-hot-toast';


const categoriaCores: Record<string, string> = {
  translado: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  urna: 'bg-slate-700/50 text-text-muted border-slate-600/50',
  velorio: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  sepultamento: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  default: 'bg-bg-hover text-text-muted border-[#64748B]',
};

export const ItensFunerariosPage: React.FC = () => {
  const { state } = useAppContext();
  const { itens, loading, filtros, setFiltros, criar, editar, desativar, reativar } = useItensFunerarios();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemFunerario | null>(null);
  const [previewItem, setPreviewItem] = useState<ItemFunerario | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const handleOpenForm = (item?: ItemFunerario) => {
    setEditingItem(item || null);
    setIsFormOpen(true);
  };

  const handleSave = async (data: any) => {
    if (!state.isOnline) {
      toast.error('Operação bloqueada no Modo de Visualização (Offline).');
      return;
    }
    if (editingItem) {
      await editar(editingItem.id, data);
    } else {
      await criar(data);
    }
  };

  const handleToggleStatus = async (item: ItemFunerario) => {
    if (!state.isOnline) {
      toast.error('Alteração de status bloqueada no Modo de Visualização (Offline).');
      return;
    }
    try {
      if (item.ativo) {
        await desativar(item.id);
        toast.success('Item desativado.');
      } else {
        await reativar(item.id);
        toast.success('Item ativado.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar status.');
    }
  };

  const ultimoOrdem = itens.length > 0 ? Math.max(...itens.map(i => i.ordem_exibicao)) : 0;

  const totalItens = itens.length;
  const ativos = itens.filter(i => i.ativo).length;
  const inativos = totalItens - ativos;
  const categoriasUnicas = new Set(itens.map(i => i.categoria)).size;

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-subtle mb-1">
            <span>Administração</span>
            <span className="w-1 h-1 rounded-full bg-border-default"></span>
            <span>Itens Funerários</span>
          </div>
          <h1 className="text-2xl font-bold text-text-base flex items-center gap-2">
            <Package className="w-6 h-6 text-[#3B82F6]" />
            Gestão de Itens Funerários
          </h1>
          <p className="text-sm text-text-subtle mt-1">
            Gerencie os serviços e itens que compõem os planos PAX
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            disabled={!state.isOnline}
            onClick={() => handleOpenForm()}
            title={!state.isOnline ? "Inclusão bloqueada no Modo Offline" : "Novo Item"}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(59,130,246,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Novo Item
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20 shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Total de Itens</p>
            <p className="text-xl font-extrabold text-text-base mt-0.5">{totalItens}</p>
          </div>
        </div>
        
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Itens Ativos</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{ativos}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20 shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Itens Inativos</p>
            <p className="text-xl font-extrabold text-rose-400 mt-0.5">{inativos}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20 shrink-0">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Categorias Ativas</p>
            <p className="text-xl font-extrabold text-purple-400 mt-0.5">{categoriasUnicas}</p>
          </div>
        </div>
      </div>

      <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
        <div className="p-4 border-b border-border-default flex flex-col sm:flex-row gap-4 justify-between bg-bg-surface/50">
          <div className="relative w-full max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="Buscar por código ou nome..."
              value={filtros.busca || ''}
              onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
              className="w-full bg-bg-surface border border-border-default rounded-xl pl-10 pr-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
          
          <div className="flex gap-4">
            <select
              value={filtros.categoria || ''}
              onChange={(e) => setFiltros(prev => ({ ...prev, categoria: e.target.value as any || undefined }))}
              className="bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">Todas Categorias</option>
              <option value="translado">Translado</option>
              <option value="preparacao">Preparação</option>
              <option value="urna">Urna</option>
              <option value="velorio">Velório</option>
              <option value="cortejo">Cortejo</option>
              <option value="sepultamento">Sepultamento</option>
              <option value="documentacao">Documentação</option>
              <option value="flores">Flores</option>
              <option value="apoio_familia">Apoio à Família</option>
              <option value="outros">Outros</option>
            </select>
            
            <select
              value={filtros.ativo === undefined ? '' : filtros.ativo.toString()}
              onChange={(e) => setFiltros(prev => ({ ...prev, ativo: e.target.value === '' ? undefined : e.target.value === 'true' }))}
              className="bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">Todos Status</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>

        {/* VIEW MODE TOGGLES */}
        <div className="flex items-center gap-2 border-l border-border-default pl-4 pr-2">
          <div className="flex items-center bg-bg-subtle border border-border-default rounded-xl p-1">
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

      <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto w-full">
          {loading ? (
            <div className="p-8 text-center text-text-subtle">Carregando itens...</div>
          ) : itens.length === 0 ? (
            <div className="p-8 text-center text-text-subtle">Nenhum item encontrado.</div>

          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-4">
              {itens.map((item) => {
                const badgeClass = categoriaCores[item.categoria] || categoriaCores.default;
                return (
                  <div
                    key={item.id}
                    className="bg-bg-surface border border-border-default rounded-2xl p-5 hover:border-[#3B82F6]/50 transition-all shadow-sm hover:shadow-md flex flex-col justify-between group cursor-pointer"
                    onClick={() => setPreviewItem(item)}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            item.ativo 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.ativo ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                            {item.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                          <h3 className="text-base font-bold text-text-base mt-2 group-hover:text-[#3B82F6] transition-colors line-clamp-1">
                            {item.nome}
                          </h3>
                          <p className="font-mono text-xs text-text-muted mt-0.5">{item.codigo}</p>
                        </div>
                        
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 border ${badgeClass}`}>
                          {item.categoria.replace('_', ' ')}
                        </span>
                      </div>
                      
                      {item.descricao && (
                        <p className="text-sm text-text-subtle line-clamp-2 mt-2 mb-4">
                          {item.descricao}
                        </p>
                      )}
                    </div>
                    
                    <div className="pt-4 mt-auto border-t border-border-default flex items-center justify-between">
                      <div>
                        <p className="text-xs text-text-muted mb-0.5">Valor de Referência</p>
                        <p className="text-sm font-semibold text-text-base">
                          {item.valor_referencia ? Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_referencia) : 'Sob Consulta'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenForm(item); }}
                          className="p-2 text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
                          className={`p-2 rounded-lg transition-colors ${
                            item.ativo 
                              ? 'text-text-subtle hover:text-red-400 hover:bg-red-500/10' 
                              : 'text-text-subtle hover:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                          title={item.ativo ? "Desativar" : "Ativar"}
                        >
                          {item.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (

            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-bg-surface/50 border-b border-border-default">
                  <th className="px-6 py-4 text-xs font-semibold text-text-subtle uppercase tracking-wider">Código</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-subtle uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-subtle uppercase tracking-wider">Categoria</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-subtle uppercase tracking-wider text-right">Valor Ref.</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-subtle uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-subtle uppercase tracking-wider text-center">Ordem</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-subtle uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#475569]">
                {itens.map((item) => {
                  const badgeClass = categoriaCores[item.categoria] || categoriaCores.default;
                  
                  return (
                    <tr key={item.id} className="hover:bg-bg-surface/30 transition-colors cursor-pointer"
                    onClick={() => setPreviewItem(item)}>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-text-muted">{item.codigo}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-text-base">{item.nome}</p>
                        {item.descricao && <p className="text-sm text-text-subtle truncate max-w-xs">{item.descricao}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badgeClass}`}>
                          {item.categoria.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-text-muted">
                        {item.valor_referencia ? Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_referencia) : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          item.ativo 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.ativo ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                          {item.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-text-subtle text-sm">
                        {item.ordem_exibicao}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenForm(item); }}
                            className="p-2 text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
                            className={`p-2 rounded-lg transition-colors ${
                              item.ativo 
                                ? 'text-text-subtle hover:text-red-400 hover:bg-red-400/10' 
                                : 'text-text-subtle hover:text-emerald-400 hover:bg-emerald-400/10'
                            }`}
                            title={item.ativo ? "Desativar" : "Ativar"}
                          >
                            {item.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ItemFunerarioForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        initialData={editingItem}
        ultimoOrdem={ultimoOrdem}
      />

      {previewItem && (
        <ItemFunerarioDetailsModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onEdit={() => {
            const itemToEdit = previewItem;
            setPreviewItem(null);
            handleOpenForm(itemToEdit);
          }}
        />
      )}
    </div>
  );
};
