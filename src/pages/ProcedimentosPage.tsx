import React, { useState } from 'react';
import { useProcedimentos } from '../hooks/useProcedimentos';
import { useAppContext } from '../context/AppContext';
import { CurrencyInput } from '../components/common/CurrencyInput';
import { Procedimento } from '../types/procedimentos';
import { Plus, Search, Pencil, Power, PowerOff, Trash2, Activity, Filter, X, Settings2, PlusCircle, Trash2 as TrashIcon, List, Upload } from 'lucide-react';
import { UploadProcedimentos } from '../components/procedimentos/UploadProcedimentos';
import { getFromIDB, saveToIDB } from '../lib/idb';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

export const ProcedimentosPage = () => {
  const { procedimentos, loading, criar, editar, excluir } = useProcedimentos();
  const { state: { isOnline, empresaSelecionada } } = useAppContext();
  const toast = useToast();
  const { confirm } = useConfirm();
  
  const [activeTab, setActiveTab] = useState<'lista' | 'upload'>('lista');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [tiposProcedimento, setTiposProcedimento] = useState<string[]>([
    'Consulta', 'Procedimento', 'Exames', 'Tratamento Seriado', 'Serviços Terceiros'
  ]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  React.useEffect(() => {
    const loadCategories = async () => {
      try {
        const pref = await getFromIDB<{id: string, categorias: string[]}>('preferencias', 'tipos_procedimentos');
        if (pref && pref.categorias) {
          setTiposProcedimento(pref.categorias);
        }
      } catch (err) {}
    };
    loadCategories();
  }, []);

  const saveCategories = async (newCats: string[]) => {
    setTiposProcedimento(newCats);
    try {
      await saveToIDB('preferencias', { id: 'tipos_procedimentos', categorias: newCats });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCategory = () => {
    if (newCategory.trim() && !tiposProcedimento.includes(newCategory.trim())) {
      saveCategories([...tiposProcedimento, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (cat: string) => {
    saveCategories(tiposProcedimento.filter(c => c !== cat));
  };

  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProc, setEditingProc] = useState<Partial<Procedimento> | null>(null);

  const filtered = procedimentos.filter(proc => {
    const term = searchTerm.toLowerCase();
    return proc.descricao.toLowerCase().includes(term) || proc.codigo_tuss.toLowerCase().includes(term);
  });

  const handleOpenForm = (proc?: Procedimento) => {
    setEditingProc(proc || { 
      ativo: true, 
      codigo_tuss: '',
      descricao: '',
      valor_padrao: 0,
      tipo_procedimento: tiposProcedimento[0] || '',
      empresa_id: empresaSelecionada || ''
    });
    setIsFormOpen(true);
  };

  const handleToggleStatus = async (proc: Procedimento) => {
    try {
      await editar(proc.id, { ativo: !proc.ativo });
      toast.success(`Procedimento ${!proc.ativo ? 'ativado' : 'inativado'} com sucesso!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleDelete = (proc: Procedimento) => {
    confirm({
      title: "Excluir Procedimento",
      message: `Tem certeza que deseja excluir o procedimento "${proc.descricao}"? Esta ação não pode ser desfeita.`,
      danger: true,
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await excluir(proc.id);
          toast.success('Procedimento excluído com sucesso!');
        } catch (error) {
          toast.error(error instanceof Error ? error.message : String(error));
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaSelecionada) {
      toast.error("Selecione uma empresa primeiro.");
      return;
    }
    
    try {
      if (editingProc?.id) {
        await editar(editingProc.id, editingProc);
        toast.success('Procedimento atualizado com sucesso!');
      } else {
        await criar(editingProc as any);
        toast.success('Procedimento criado com sucesso!');
      }
      setIsFormOpen(false);
      setEditingProc(null);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-base">Procedimentos e Exames</h2>
          <p className="text-text-subtle mt-1">Gerencie os procedimentos TUSS e valores padrão.</p>
        </div>
        
        {activeTab === 'lista' && (
          <button 
            onClick={() => handleOpenForm()}
            disabled={!empresaSelecionada}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            Novo Procedimento
          </button>
        )}
      </div>
      
      <div className="flex border-b border-border-default">
        <button
          onClick={() => setActiveTab("lista")}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "lista"
              ? "border-[#3B82F6] text-[#3B82F6]"
              : "border-transparent text-text-subtle hover:text-text-base hover:border-border-default"
          }`}
        >
          <List className="w-4 h-4" />
          Lista de Procedimentos
        </button>
        <button
          onClick={() => setActiveTab("upload")}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "upload"
              ? "border-[#3B82F6] text-[#3B82F6]"
              : "border-transparent text-text-subtle hover:text-text-base hover:border-border-default"
          }`}
        >
          <Upload className="w-4 h-4" />
          Importação em Massa
        </button>
      </div>

      {activeTab === 'lista' ? (
        <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
        <div className="p-4 border-b border-border-default flex flex-col sm:flex-row sm:items-center gap-4 justify-between bg-bg-surface/50">
          <div className="relative max-w-md w-full">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input 
              type="text" 
              placeholder="Buscar por código ou descrição..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-bg-surface border border-border-default rounded-xl pl-10 pr-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-border-default rounded-lg text-text-muted font-medium hover:bg-white/5 transition-colors">
            <Filter className="w-4 h-4" />
            Filtros
          </button>
        </div>

        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-text-subtle">
              <Activity className="w-8 h-8 animate-pulse text-text-subtle mb-3" />
              <span>Carregando procedimentos...</span>
            </div>
          ) : !empresaSelecionada ? (
            <div className="flex items-center justify-center h-64 text-text-subtle text-center flex-col">
              <Activity className="w-12 h-12 text-[#475569] mb-4" />
              <p>Selecione uma empresa no topo da página para ver os procedimentos.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-text-subtle text-center flex-col">
              <Activity className="w-12 h-12 text-[#475569] mb-4" />
              <p>Nenhum procedimento encontrado.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-bg-surface/50 text-text-subtle font-medium border-b border-border-default">
                <tr>
                  <th className="px-6 py-4">Código TUSS</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Valor Padrão</th>
                  <th className="px-6 py-4">Co-part.</th>
                  <th className="px-6 py-4">Total Assoc.</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#475569]">
                {filtered.map(proc => (
                  <tr 
                    key={proc.id} 
                    className="hover:bg-bg-surface/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-mono text-[#3B82F6] font-medium">{proc.codigo_tuss}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-text-base">{proc.descricao}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-bg-hover text-text-muted border border-[#64748B]">
                        {proc.tipo_procedimento || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">R$ {proc.valor_padrao?.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-amber-500">R$ {(proc.coparticipacao || 0).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-emerald-400">R$ {(proc.valor_total_associado || proc.valor_padrao || 0).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${proc.ativo ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-text-subtle border-slate-500/20"}`}>
                        {proc.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenForm(proc)}
                          className="p-2 text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(proc)}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                            proc.ativo 
                              ? "text-text-subtle hover:text-red-400 hover:bg-red-400/10" 
                              : "text-text-subtle hover:text-emerald-400 hover:bg-emerald-400/10"
                          }`}
                          title={proc.ativo ? "Desativar" : "Ativar"}
                        >
                          {proc.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(proc)}
                          className="p-2 text-text-subtle hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
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
          )}
        </div>
      </div>
      ) : (
        <UploadProcedimentos />
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
          <div className="bg-bg-base rounded-3xl shadow-2xl w-full max-w-2xl border border-border-default flex flex-col overflow-hidden max-h-[90vh]">
            <div className="bg-bg-subtle p-6 border-b border-border-default flex items-center justify-between shrink-0 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/5 to-transparent" />
              <div className="flex items-center gap-3 z-10">
                <div className="w-10 h-10 bg-bg-surface border border-border-default rounded-xl flex items-center justify-center shadow-sm">
                  <Activity className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <h3 className="text-xl font-bold text-text-base">
                  {editingProc?.id ? 'Editar Procedimento' : 'Novo Procedimento'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsFormOpen(false)} className="p-2 text-text-subtle hover:text-rose-400 bg-bg-surface rounded-xl border border-border-default hover:border-rose-500/30 transition-colors z-10">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
              <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
                
                {/* Seção 1: Informações Básicas */}
                <section>
                  <h4 className="text-sm font-bold text-text-base uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-6 h-px bg-border-default"></span>
                    Informações Básicas
                    <span className="flex-1 h-px bg-border-default"></span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="block text-sm font-semibold text-text-subtle">Descrição *</label>
                      <input
                        required
                        type="text"
                        value={editingProc?.descricao || ''}
                        onChange={e => setEditingProc({ ...editingProc, descricao: e.target.value })}
                        className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                        placeholder="Ex: Consulta Eletiva em Consultório"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-text-subtle">Código TUSS *</label>
                      <input
                        required
                        type="text"
                        value={editingProc?.codigo_tuss || ''}
                        onChange={e => setEditingProc({ ...editingProc, codigo_tuss: e.target.value })}
                        className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all font-mono placeholder:font-sans"
                        placeholder="Ex: 10101012"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-semibold text-text-subtle">Tipo *</label>
                        <button 
                          type="button" 
                          onClick={() => setIsCategoryModalOpen(true)}
                          className="text-xs text-[#3B82F6] hover:text-[#2563EB] flex items-center gap-1 font-medium transition-colors"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          Gerenciar
                        </button>
                      </div>
                      <select
                        required
                        value={editingProc?.tipo_procedimento || ''}
                        onChange={e => setEditingProc({ ...editingProc, tipo_procedimento: e.target.value })}
                        className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                      >
                        <option value="" disabled>Selecione...</option>
                        {tiposProcedimento.map(tipo => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                {/* Seção 2: Financeiro */}
                <section>
                  <h4 className="text-sm font-bold text-text-base uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-6 h-px bg-border-default"></span>
                    Estrutura Financeira
                    <span className="flex-1 h-px bg-border-default"></span>
                  </h4>
                  
                  <div className="bg-bg-subtle border border-border-default rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-text-subtle">Valor Padrão (Custo Inicial) *</label>
                      <div className="relative">
                        <CurrencyInput
                          required
                          value={editingProc?.valor_padrao || 0}
                          onChange={val => setEditingProc({ ...editingProc, valor_padrao: val, valor_total_associado: val + (editingProc?.coparticipacao || 0) })}
                          className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-text-subtle">Co-participação (Associado)</label>
                      <div className="relative">
                        <CurrencyInput
                          value={editingProc?.coparticipacao || 0}
                          onChange={val => setEditingProc({ ...editingProc, coparticipacao: val, valor_total_associado: (editingProc?.valor_padrao || 0) + val })}
                          className="w-full px-4 py-3 bg-bg-surface border border-[#F59E0B]/30 rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B] transition-all"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border-default md:col-span-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl p-4 gap-4">
                        <div>
                          <p className="text-sm font-bold text-[#10B981] mb-1">Custo Total para Associados</p>
                          <p className="text-xs text-text-subtle max-w-sm">Soma do valor padrão com a taxa de co-participação cobrada do associado no momento do atendimento.</p>
                        </div>
                        <div className="w-full sm:w-48 shrink-0">
                          <CurrencyInput
                            disabled
                            value={editingProc?.valor_total_associado || ((editingProc?.valor_padrao || 0) + (editingProc?.coparticipacao || 0))}
                            onChange={() => {}}
                            className="w-full px-4 py-2.5 bg-transparent border-none text-right text-2xl text-[#10B981] font-bold focus:outline-none opacity-100 cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="flex items-center gap-4 pt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={editingProc?.ativo ?? true}
                      onChange={e => setEditingProc({ ...editingProc, ativo: e.target.checked })}
                    />
                    <div className="w-12 h-6 bg-bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3B82F6] border border-border-default"></div>
                  </label>
                  <div>
                    <p className="text-sm font-semibold text-text-base">Status Ativo</p>
                    <p className="text-xs text-text-subtle">Permite que este procedimento seja usado em novos atendimentos.</p>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border-default bg-bg-subtle shrink-0 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-6 py-2.5 bg-bg-surface border border-border-default text-text-muted rounded-xl font-medium hover:bg-bg-hover hover:text-text-base transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-[#3B82F6]/25"
                >
                  {editingProc?.id ? 'Atualizar Procedimento' : 'Salvar Procedimento'}
                </button>
              </div>


            </form>
          </div>
        </div>
      )}

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg-base/90 backdrop-blur-sm p-4">
          <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-sm border border-border-default flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border-default flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-text-base">
                Tipos de Procedimento
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 text-text-subtle hover:text-text-base bg-bg-surface rounded-lg border border-border-default">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  placeholder="Novo tipo..."
                  className="w-full px-3 py-2 text-sm bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:border-[#3B82F6]"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                >
                  <PlusCircle className="w-5 h-5" />
                </button>
              </div>
              
              <ul className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                {tiposProcedimento.map(cat => (
                  <li key={cat} className="flex items-center justify-between p-3 bg-bg-surface border border-border-default rounded-xl">
                    <span className="text-text-base text-sm font-medium">{cat}</span>
                    <button
                      onClick={() => handleRemoveCategory(cat)}
                      className="text-text-subtle hover:text-red-400 transition-colors p-1"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};