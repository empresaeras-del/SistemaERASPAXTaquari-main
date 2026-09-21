import React from 'react';
import { Search, Tag, User, X } from 'lucide-react';
import { getUserRoleBadge, type FiltrosAuditoria } from '../../utils/auditoriaHelpers';
import type { UsuarioCadastro } from '../../services/usuariosService';

interface Props {
  filtros: FiltrosAuditoria;
  usuariosList: UsuarioCadastro[];
  hasActiveFilters: boolean;
  setSearchTerm: (v: string) => void;
  setDataInicio: (v: string) => void;
  setDataFim: (v: string) => void;
  setModuloFiltro: (v: string) => void;
  setTipoAcaoFiltro: (v: FiltrosAuditoria['tipoAcaoFiltro']) => void;
  setUsuarioFiltro: (v: string) => void;
  handleSetQuickPeriod: (dias: number | 'hoje' | 'limpar') => void;
  clearAllFilters: () => void;
}

/**
 * A barra de filtros. Ela só **pede** o recorte; quem aplica é `filtrarLogsAuditoria`, que
 * já era função pura e testada.
 *
 * As opções de operador saem de `usuariosList`, carregado com o MESMO tenant da consulta de
 * logs — pedir com `'all'` traria usuários de todas as empresas só para montar um select.
 */
export const AuditoriaFiltros: React.FC<Props> = ({
  filtros: { searchTerm, dataInicio, dataFim, moduloFiltro, tipoAcaoFiltro, usuarioFiltro },
  usuariosList,
  hasActiveFilters,
  setSearchTerm,
  setDataInicio,
  setDataFim,
  setModuloFiltro,
  setTipoAcaoFiltro,
  setUsuarioFiltro,
  handleSetQuickPeriod,
  clearAllFilters,
}) => (
  <div className="p-4 sm:p-5 border-b border-border-default bg-bg-surface space-y-4 shrink-0">
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
      {/* Search Input */}
      <div className="md:col-span-4 relative">
        <label className="block text-[11px] font-bold text-text-subtle mb-1 uppercase tracking-wider">
          Busca Livre
        </label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input 
            type="text" 
            placeholder="Buscar ação, ID, campos..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm border border-border-default rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-bg-subtle/50 text-text-base transition-all"
          />
          {searchTerm && (
            <button 
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-bg-hover text-text-subtle hover:text-text-base"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* User / Operator Selector */}
      <div className="md:col-span-3">
        <label className="block text-[11px] font-bold text-text-subtle mb-1 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-blue-500" /> Operador / Usuário
          </span>
          {usuarioFiltro !== 'todos' && (
            <button
              type="button"
              onClick={() => setUsuarioFiltro('todos')}
              className="text-blue-500 hover:text-blue-600 text-[10px] lowercase font-normal"
            >
              ver todos
            </button>
          )}
        </label>
        <select
          value={usuarioFiltro}
          onChange={(e) => setUsuarioFiltro(e.target.value)}
          className="w-full px-3 py-2 text-xs sm:text-sm border border-border-default rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-bg-subtle/50 text-text-base transition-all font-medium"
        >
          <option value="todos">Todos os Operadores ({usuariosList.length + 1})</option>
          <option value="sistema">🤖 Sistema / Ações Automáticas</option>
          <optgroup label="Usuários Cadastrados">
            {usuariosList.map((u) => {
              const role = getUserRoleBadge(u.nivel).label;
              return (
                <option key={u.id} value={u.id}>
                  {u.nome} ({role} - {u.email})
                </option>
              );
            })}
          </optgroup>
        </select>
      </div>

      {/* Module Selector */}
      <div className="md:col-span-2">
        <label className="block text-[11px] font-bold text-text-subtle mb-1 uppercase tracking-wider">
          Módulo
        </label>
        <select
          value={moduloFiltro}
          onChange={(e) => setModuloFiltro(e.target.value)}
          className="w-full px-3 py-2 text-xs sm:text-sm border border-border-default rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-bg-subtle/50 text-text-base transition-all"
        >
          <option value="todos">Todos</option>
          <option value="contrato">Contratos</option>
          <option value="financeiro">Financeiro</option>
          <option value="caixa">Caixas</option>
          <option value="remessa">Remessas</option>
          <option value="plano">Planos</option>
          <option value="backup">Backup</option>
          <option value="empresa">Empresas</option>
          <option value="usuario">Usuários</option>
          <option value="atendimento">Guias</option>
        </select>
      </div>

      {/* Date Range */}
      <div className="md:col-span-3 flex items-center gap-2">
        <div className="flex-1">
          <label className="block text-[11px] font-bold text-text-subtle mb-1 uppercase tracking-wider">
            Início
          </label>
          <input 
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full px-2 py-2 text-xs border border-border-default rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-bg-subtle/50 text-text-base"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[11px] font-bold text-text-subtle mb-1 uppercase tracking-wider">
            Fim
          </label>
          <input 
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full px-2 py-2 text-xs border border-border-default rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-bg-subtle/50 text-text-base"
          />
        </div>
      </div>
    </div>

    {/* Quick Filter Tags & Period Shortcuts */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border-default/50">
      {/* Type Tags */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
        <span className="text-[11px] font-semibold text-text-subtle mr-1 uppercase flex items-center gap-1">
          <Tag className="w-3 h-3" /> Tipo:
        </span>
        <button
          type="button"
          onClick={() => setTipoAcaoFiltro('todos')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
            tipoAcaoFiltro === 'todos' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'bg-bg-subtle hover:bg-bg-hover text-text-subtle'
          }`}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => setTipoAcaoFiltro('create')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
            tipoAcaoFiltro === 'create' 
              ? 'bg-emerald-600 text-white shadow-sm' 
              : 'bg-bg-subtle hover:bg-bg-hover text-text-subtle'
          }`}
        >
          Criações
        </button>
        <button
          type="button"
          onClick={() => setTipoAcaoFiltro('update')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
            tipoAcaoFiltro === 'update' 
              ? 'bg-blue-500 text-white shadow-sm' 
              : 'bg-bg-subtle hover:bg-bg-hover text-text-subtle'
          }`}
        >
          Edições
        </button>
        <button
          type="button"
          onClick={() => setTipoAcaoFiltro('delete')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
            tipoAcaoFiltro === 'delete' 
              ? 'bg-rose-600 text-white shadow-sm' 
              : 'bg-bg-subtle hover:bg-bg-hover text-text-subtle'
          }`}
        >
          Exclusões
        </button>
        <button
          type="button"
          onClick={() => setTipoAcaoFiltro('backup')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
            tipoAcaoFiltro === 'backup' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'bg-bg-subtle hover:bg-bg-hover text-text-subtle'
          }`}
        >
          Backup
        </button>
        <button
          type="button"
          onClick={() => setTipoAcaoFiltro('finance')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
            tipoAcaoFiltro === 'finance' 
              ? 'bg-amber-600 text-white shadow-sm' 
              : 'bg-bg-subtle hover:bg-bg-hover text-text-subtle'
          }`}
        >
          Financeiro
        </button>
      </div>

      {/* Period Shortcuts & Clear */}
      <div className="flex items-center gap-1.5 shrink-0 text-xs">
        <span className="text-[11px] font-semibold text-text-subtle uppercase">Período:</span>
        <button 
          type="button"
          onClick={() => handleSetQuickPeriod('hoje')} 
          className="px-2 py-0.5 rounded bg-bg-subtle hover:bg-bg-hover text-text-subtle hover:text-text-base text-xs font-medium"
        >
          Hoje
        </button>
        <button 
          type="button"
          onClick={() => handleSetQuickPeriod(7)} 
          className="px-2 py-0.5 rounded bg-bg-subtle hover:bg-bg-hover text-text-subtle hover:text-text-base text-xs font-medium"
        >
          7 Dias
        </button>
        <button 
          type="button"
          onClick={() => handleSetQuickPeriod(30)} 
          className="px-2 py-0.5 rounded bg-bg-subtle hover:bg-bg-hover text-text-subtle hover:text-text-base text-xs font-medium"
        >
          30 Dias
        </button>
        {hasActiveFilters && (
          <button 
            type="button"
            onClick={clearAllFilters}
            className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1 ml-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpar Filtros
          </button>
        )}
      </div>
    </div>
  </div>
);
