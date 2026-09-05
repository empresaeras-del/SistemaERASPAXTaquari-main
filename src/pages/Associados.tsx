import React from "react";
import { useAssociadosState } from '../hooks/useAssociadosState';
import { AssociadosToolbar } from '../components/associados/AssociadosToolbar';
import { AssociadosListTable } from '../components/associados/AssociadosListTable';
import { AssociadosListGrid } from '../components/associados/AssociadosListGrid';
import { AssociadoDetailsModal } from '../components/associados/AssociadoDetailsModal';
import { AssociadoFormModal } from '../components/associados/AssociadoFormModal';
import { AdvancedFilterBar } from '../components/layout/AdvancedFilterBar';
import { PlanoPaxSelect } from '../components/planos-pax/PlanoPaxSelect';
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle';
import { Users, Search, Filter, ShieldCheck, Heart, AlertCircle, AlertTriangle, LayoutGrid, List } from "lucide-react";

export const AssociadosPage: React.FC = () => {
  const associadosState = useAssociadosState();

  const {
    state,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    planoFilter, setPlanoFilter,
    sortBy, setSortBy,
    showFilters, setShowFilters,
    viewMode, setViewMode,
    loading,
    filtered,
    planos,
    parcelasAbertasMap,
    previewAssociado,
    setPreviewAssociado,
    handleWhatsAppMenu,
    handleOpenModal,
    handleDelete,
    totalTitulares,
    totalDependentes,
    vidasProtegidas,
    inadimplentes,
    qtdAssociadosAtivosSemParcelas,
    handleExportPDF,
    isVisible,
    visibleColumns,
    setVisibleColumns,
    columns
  } = associadosState;

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <AssociadosToolbar 
        handleExportPDF={handleExportPDF}
        handleOpenModal={handleOpenModal}
        isOnline={state.isOnline}
      />

      {/* STATS SECTION */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Titulares</p>
            <p className="text-xl font-extrabold text-text-base mt-0.5">{totalTitulares}</p>
          </div>
        </div>
        
        <div 
          onClick={() => associadosState.setShowDependentesModal(true)}
          className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4 cursor-pointer hover:border-[#8B5CF6]/50 transition-colors"
        >
          <div className="p-3 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-2xl border border-[#8B5CF6]/20 shrink-0">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Dependentes</p>
            <p className="text-xl font-extrabold text-[#8B5CF6] mt-0.5">{totalDependentes}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Vidas Protegidas</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{vidasProtegidas}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Inadimplentes</p>
            <p className="text-xl font-extrabold text-rose-400 mt-0.5">{inadimplentes}</p>
          </div>
        </div>
      </div>

      {qtdAssociadosAtivosSemParcelas > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3 mt-4 mb-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-500">Atenção: Associados sem mensalidades geradas</p>
            <p className="text-sm text-amber-500/80 mt-1">Existem {qtdAssociadosAtivosSemParcelas} associado(s) ativo(s) sem nenhuma parcela ou faturamento gerado em aberto no financeiro. Verifique e gere os faturamentos para evitar perda de receitas.</p>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex gap-6 flex-1 min-h-0">
        <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
          
          <div className="p-4 border-b border-border-default bg-bg-surface/50 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1 w-full min-w-0">
              <AdvancedFilterBar
                pageKey="associados"
                showFilters={showFilters}
                setShowFilters={setShowFilters}
                currentFilters={{ searchTerm, statusFilter, planoFilter, sortBy }}
                onApplyFilters={(filters) => {
                  setSearchTerm(filters.searchTerm || '');
                  setStatusFilter(filters.statusFilter || '');
                  setPlanoFilter(filters.planoFilter || '');
                  setSortBy(filters.sortBy || 'nome_asc');
                }}
                onClearFilters={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setPlanoFilter('');
                  setSortBy('nome_asc');
                }}
              >
                <>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[11px] font-bold text-text-subtle uppercase tracking-wider">Busca Rápida</label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                      <input
                        type="text"
                        placeholder="Nome ou CPF..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-sm text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[11px] font-bold text-text-subtle uppercase tracking-wider">Status</label>
                    <div className="relative">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-sm text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Todos os Status</option>
                        <option value="ativo">Ativos</option>
                        <option value="inativo">Encerrados</option>
                        <option value="inadimplente">Inadimplentes</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-subtle">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[11px] font-bold text-text-subtle uppercase tracking-wider">Plano PAX</label>
                    <div className="[&>div]:mt-0 [&>div>button]:py-2.5 [&>div>button]:h-auto [&>div>button]:rounded-xl [&>div>button]:border-border-default [&>div>button]:bg-bg-surface h-full">
                      <PlanoPaxSelect
                        value={planoFilter}
                        onChange={setPlanoFilter}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[11px] font-bold text-text-subtle uppercase tracking-wider">Ordenação</label>
                    <div className="relative">
                      <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 bg-bg-surface border border-border-default rounded-xl text-sm text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all appearance-none cursor-pointer"
                      >
                        <option value="nome_asc">Nome (A-Z)</option>
                        <option value="nome_desc">Nome (Z-A)</option>
                        <option value="adesao_desc">Adesão (Mais Recente)</option>
                        <option value="adesao_asc">Adesão (Mais Antigo)</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-subtle">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>
                </>
              </AdvancedFilterBar>
            </div>
            
            <div className="flex items-center bg-bg-subtle border border-border-default p-1 rounded-xl shrink-0">
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
            {viewMode === 'table' && (
              <ColumnVisibilityToggle
                columns={columns}
                visibleColumns={visibleColumns}
                onChange={setVisibleColumns}
              />
            )}
          </div>

          <div className="overflow-x-auto flex-1 p-4">
            {loading ? (
              <div className="py-20 text-center text-text-subtle flex flex-col items-center">
                <div className="w-8 h-8 border-3 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm font-medium">Carregando associados...</p>
              </div>
            ) : viewMode === 'table' ? (
              <AssociadosListTable 
                filtered={filtered}
                isVisible={isVisible}
                planos={planos}
                parcelasAbertasMap={parcelasAbertasMap}
                setPreviewAssociado={setPreviewAssociado}
                handleWhatsAppMenu={handleWhatsAppMenu}
                handleOpenModal={handleOpenModal}
                handleDelete={handleDelete}
              />
            ) : (
              <AssociadosListGrid 
                filtered={filtered}
                planos={planos}
                parcelasAbertasMap={parcelasAbertasMap}
                isOnline={state.isOnline}
                setPreviewAssociado={setPreviewAssociado}
                handleWhatsAppMenu={handleWhatsAppMenu}
                handleOpenModal={handleOpenModal}
                handleDelete={handleDelete}
              />
            )}
          </div>

        </div>
      </div>

      <AssociadoFormModal {...associadosState} />

      {previewAssociado && (
        <AssociadoDetailsModal
          associado={previewAssociado}
          onClose={() => setPreviewAssociado(null)}
          onEdit={handleOpenModal}
        />
      )}

    </div>
  );
};

export default AssociadosPage;
