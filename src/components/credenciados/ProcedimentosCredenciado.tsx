import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { useProcedimentos } from '../../hooks/useProcedimentos';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

interface ProcedimentosCredenciadoProps {
  credenciadoId: string;
  vincularProcedimento: (data: any) => Promise<void>;
  desvincularProcedimento: (id: string) => Promise<void>;
  atualizarValorProcedimento: (id: string, data: any) => Promise<void>;
  buscarProcedimentosVinculados: (id: string) => Promise<any[]>;
}

export const ProcedimentosCredenciado: React.FC<ProcedimentosCredenciadoProps> = ({
  credenciadoId,
  vincularProcedimento,
  desvincularProcedimento,
  atualizarValorProcedimento,
  buscarProcedimentosVinculados
}) => {
  const { procedimentos, loading: loadingProcedimentos } = useProcedimentos();
  const { state: { isOnline } } = useAppContext();
  const toast = useToast();

  const [vinculados, setVinculados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isLinking, setIsLinking] = useState(false);
  const [selectedProcIds, setSelectedProcIds] = useState<Set<string>>(new Set());
  const [searchTermProc, setSearchTermProc] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number | ''>('');
  const [editCoparticipacao, setEditCoparticipacao] = useState<number | ''>('');

  const loadVinculados = async () => {
    setLoading(true);
    try {
      const data = await buscarProcedimentosVinculados(credenciadoId);
      setVinculados(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar procedimentos vinculados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVinculados();
  }, [credenciadoId]);

  const handleVincular = async () => {
    if (selectedProcIds.size === 0) {
      toast.error('Selecione pelo menos um procedimento.');
      return;
    }

    try {
      // Create links for all selected
      const procs = Array.from(selectedProcIds).map(id => procedimentos.find(p => p.id === id)).filter(Boolean);
      
      for (const proc of procs) {
        if (proc) {
          await vincularProcedimento({
            credenciado_id: credenciadoId,
            procedimento_id: proc.id,
            valor_exclusivo: proc.valor_padrao || 0,
            valor_coparticipacao: proc.coparticipacao || 0
          });
        }
      }
      
      toast.success(`${selectedProcIds.size} procedimentos vinculados com sucesso!`);
      setIsLinking(false);
      setSelectedProcIds(new Set());
      setSearchTermProc('');
      await loadVinculados();
    } catch (err) {
      toast.error('Erro ao vincular procedimentos.');
    }
  };

  const toggleProcSelection = (id: string) => {
    const newSet = new Set(selectedProcIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedProcIds(newSet);
  };
  
  const toggleAllSelection = (filteredProcs: any[]) => {
    if (selectedProcIds.size === filteredProcs.length && filteredProcs.length > 0) {
      setSelectedProcIds(new Set());
    } else {
      const newSet = new Set<string>();
      filteredProcs.forEach(p => newSet.add(p.id));
      setSelectedProcIds(newSet);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await atualizarValorProcedimento(id, {
        valor_exclusivo: editValue === '' ? 0 : editValue,
        valor_coparticipacao: editCoparticipacao === '' ? 0 : editCoparticipacao
      });
      toast.success('Valores atualizados com sucesso!');
      setEditingId(null);
      await loadVinculados();
    } catch (err) {
      toast.error('Erro ao atualizar valores.');
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Deseja realmente desvincular este procedimento?')) return;
    
    try {
      await desvincularProcedimento(id);
      toast.success('Procedimento desvinculado!');
      await loadVinculados();
    } catch (err) {
      toast.error('Erro ao desvincular.');
    }
  };

  const filteredVinculados = vinculados.filter(v => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const proc = v.procedimentos;
    const desc = (proc?.descricao || '').toLowerCase();
    const tuss = (proc?.codigo_tuss || '').toLowerCase();
    return desc.includes(term) || tuss.includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            type="text"
            placeholder="Buscar procedimentos vinculados..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base text-sm focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        {!isLinking && (
          <button
            onClick={() => setIsLinking(true)}
            
            className="inline-flex items-center gap-2 px-4 py-2 bg-bg-hover hover:bg-[#64748B] text-text-base rounded-xl font-medium transition-colors border border-[#64748B] disabled:opacity-50 text-sm"
          >
            <Plus className="w-4 h-4" />
            Vincular Procedimento
          </button>
        )}
      </div>

      {isLinking && (
        <div className="bg-bg-surface border border-border-default rounded-xl flex flex-col h-[500px] overflow-hidden">
          <div className="p-4 border-b border-border-default flex items-center justify-between shrink-0">
            <div>
              <h4 className="font-semibold text-text-base">Vincular Novos Procedimentos</h4>
              <p className="text-sm text-text-subtle mt-0.5">Selecione os procedimentos na lista abaixo</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setIsLinking(false);
                  setSelectedProcIds(new Set());
                  setSearchTermProc('');
                }}
                className="px-4 py-2 text-text-subtle hover:text-text-base hover:bg-white/5 rounded-xl transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleVincular}
                disabled={selectedProcIds.size === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 text-sm"
              >
                Salvar {selectedProcIds.size > 0 ? `(${selectedProcIds.size})` : ''}
              </button>
            </div>
          </div>
          
          <div className="p-4 border-b border-border-default bg-bg-surface shrink-0">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
              <input
                type="text"
                placeholder="Buscar código ou descrição..."
                value={searchTermProc}
                onChange={(e) => setSearchTermProc(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bg-subtle border border-border-default rounded-xl text-text-base text-sm focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-bg-subtle border-b border-border-default sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">
                    {(() => {
                      const unlinkedProcs = procedimentos.filter(p => !vinculados.some(v => v.procedimento_id === p.id));
                      const filtered = unlinkedProcs.filter(p => 
                        p.descricao.toLowerCase().includes(searchTermProc.toLowerCase()) || 
                        p.codigo_tuss.toLowerCase().includes(searchTermProc.toLowerCase())
                      );
                      const allSelected = filtered.length > 0 && filtered.every(p => selectedProcIds.has(p.id));
                      
                      return (
                        <input 
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => toggleAllSelection(filtered)}
                          className="w-4 h-4 rounded border-border-default bg-bg-surface text-[#3B82F6] focus:ring-[#3B82F6] focus:ring-offset-0 cursor-pointer"
                        />
                      );
                    })()}
                  </th>
                  <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider">Código TUSS</th>
                  <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider">Descrição</th>
                  <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider text-right">Valor Padrão</th>
                  <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider text-right">Co-participação Padrão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#475569]">
                {procedimentos
                  .filter(p => !vinculados.some(v => v.procedimento_id === p.id))
                  .filter(p => 
                    p.descricao.toLowerCase().includes(searchTermProc.toLowerCase()) || 
                    p.codigo_tuss.toLowerCase().includes(searchTermProc.toLowerCase())
                  )
                  .map((proc) => (
                  <tr 
                    key={proc.id} 
                    className={`hover:bg-bg-subtle/50 transition-colors cursor-pointer ${selectedProcIds.has(proc.id) ? 'bg-[#3B82F6]/5' : ''}`}
                    onClick={() => toggleProcSelection(proc.id)}
                  >
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={selectedProcIds.has(proc.id)}
                        onChange={() => toggleProcSelection(proc.id)}
                        className="w-4 h-4 rounded border-border-default bg-bg-surface text-[#3B82F6] focus:ring-[#3B82F6] focus:ring-offset-0 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-[#3B82F6]">{proc.codigo_tuss}</td>
                    <td className="px-4 py-3">{proc.descricao}</td>
                    <td className="px-4 py-3 text-right">
                      {proc.valor_padrao?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {proc.coparticipacao?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                ))}
                {procedimentos.filter(p => !vinculados.some(v => v.procedimento_id === p.id)).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text-subtle">
                      Todos os procedimentos já estão vinculados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden">
        {loading || loadingProcedimentos ? (
          <div className="p-8 text-center text-text-subtle">Carregando procedimentos...</div>
        ) : (
          <table className="w-full text-left text-sm text-text-muted">
            <thead className="bg-bg-subtle border-b border-border-default">
              <tr>
                <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider">Código</th>
                <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider">Procedimento</th>
                <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider text-right">Valor Exclusivo</th>
                <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider text-right">Co-part. Exclusiva</th>
                <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider w-24 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#475569]">
              {filteredVinculados.map((v) => (
                <tr key={v.id} className="hover:bg-bg-subtle/50 transition-colors">
                  <td className="px-4 py-3 font-mono">{v.procedimentos?.codigo_tuss || '-'}</td>
                  <td className="px-4 py-3">{v.procedimentos?.descricao || 'Procedimento Vinculado'}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === v.id ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value ? Number(e.target.value) : '')}
                        className="w-24 bg-bg-surface border border-border-default rounded px-2 py-1 text-text-base text-right text-sm focus:outline-none focus:border-[#3B82F6]"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium text-text-base">
                        {v.valor_exclusivo?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === v.id ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editCoparticipacao}
                        onChange={(e) => setEditCoparticipacao(e.target.value ? Number(e.target.value) : '')}
                        className="w-24 bg-bg-surface border border-border-default rounded px-2 py-1 text-text-base text-right text-sm focus:outline-none focus:border-[#3B82F6]"
                      />
                    ) : (
                      <span className="font-medium text-text-base">
                        {v.valor_coparticipacao?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {editingId === v.id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(v.id)}
                            className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 rounded transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-text-subtle hover:text-text-base hover:bg-white/10 rounded transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(v.id);
                              setEditValue(v.valor_exclusivo || v.procedimentos?.valor_padrao || 0);
                              setEditCoparticipacao(v.valor_coparticipacao || v.procedimentos?.coparticipacao || 0);
                            }}
                            className="p-1.5 text-text-subtle hover:text-text-base hover:bg-white/5 rounded-lg transition-colors"
                            title="Editar Valor"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemove(v.id)}
                            className="p-1.5 text-text-subtle hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Desvincular"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVinculados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-subtle">
                    Nenhum procedimento vinculado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
