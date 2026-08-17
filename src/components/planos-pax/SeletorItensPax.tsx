import React, { useState, useMemo } from 'react';
import { Search, Info, Check, X } from 'lucide-react';
import { useItensFunerarios } from '../../hooks/useItensFunerarios';
import { CategoriaItemFunerario, ItemFunerarioCheckbox } from '../../types/itensFunerarios';

interface Props {
  itensCobertos: string[];
  itensExcluidos: string[];
  observacoes: Record<string, string>;
  onChange: (cobertos: string[], excluidos: string[], obs: Record<string, string>) => void;
  readOnly?: boolean;
}

const CATEGORIAS_NOME: Record<CategoriaItemFunerario, string> = {
  translado: 'Translado',
  preparacao: 'Preparação',
  urna: 'Urna',
  velorio: 'Velório',
  cortejo: 'Cortejo',
  sepultamento: 'Sepultamento',
  documentacao: 'Documentação',
  flores: 'Flores',
  apoio_familia: 'Apoio à Família',
  outros: 'Outros'
};

export const SeletorItensPax: React.FC<Props> = ({ 
  itensCobertos, 
  itensExcluidos, 
  observacoes, 
  onChange, 
  readOnly = false 
}) => {
  const { itensSelecionaveis } = useItensFunerarios();
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaItemFunerario | ''>('');
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const itensFiltrados = useMemo(() => {
    return itensSelecionaveis.filter(item => {
      if (categoriaFiltro && item.categoria !== categoriaFiltro) return false;
      if (busca && !item.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [itensSelecionaveis, busca, categoriaFiltro]);

  const itensPorCategoria = useMemo(() => {
    const agrupado: Partial<Record<CategoriaItemFunerario, ItemFunerarioCheckbox[]>> = {};
    
    itensFiltrados.forEach(item => {
      if (!agrupado[item.categoria]) {
        agrupado[item.categoria] = [];
      }
      agrupado[item.categoria]!.push(item);
    });
    
    return agrupado;
  }, [itensFiltrados]);

  const toggleCoberto = (itemId: string) => {
    if (readOnly) return;
    
    const novosCobertos = itensCobertos.includes(itemId) 
      ? itensCobertos.filter(id => id !== itemId)
      : [...itensCobertos, itemId];
      
    const novosExcluidos = itensExcluidos.includes(itemId) && !itensCobertos.includes(itemId)
      ? itensExcluidos.filter(id => id !== itemId)
      : itensExcluidos;
      
    onChange(novosCobertos, novosExcluidos, observacoes);
  };

  const toggleExcluido = (itemId: string) => {
    if (readOnly) return;
    
    const novosExcluidos = itensExcluidos.includes(itemId) 
      ? itensExcluidos.filter(id => id !== itemId)
      : [...itensExcluidos, itemId];
      
    const novosCobertos = itensCobertos.includes(itemId) && !itensExcluidos.includes(itemId)
      ? itensCobertos.filter(id => id !== itemId)
      : itensCobertos;
      
    onChange(novosCobertos, novosExcluidos, observacoes);
  };

  const updateObservacao = (itemId: string, texto: string) => {
    if (readOnly) return;
    const novasObs = { ...observacoes };
    if (texto.trim() === '') {
      delete novasObs[itemId];
    } else {
      novasObs[itemId] = texto;
    }
    onChange(itensCobertos, itensExcluidos, novasObs);
  };

  return (
    <div className="flex flex-col h-full bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border-default bg-bg-surface/50">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
          <div className="relative w-full md:w-1/2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="Buscar itens..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-bg-surface border border-border-default rounded-xl pl-9 pr-4 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
          <div className="text-sm font-medium text-text-subtle flex gap-4">
            <span className="text-emerald-500">{itensCobertos.length} cobertos</span>
            <span className="text-red-500">{itensExcluidos.length} excluídos</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoriaFiltro('')}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              categoriaFiltro === '' 
                ? 'bg-[#3B82F6] text-text-base border-[#3B82F6]' 
                : 'bg-bg-hover text-text-muted border-[#64748B] hover:bg-[#64748B]/30'
            }`}
          >
            Todas
          </button>
          {(Object.keys(CATEGORIAS_NOME) as CategoriaItemFunerario[]).map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoriaFiltro(cat)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                categoriaFiltro === cat 
                  ? 'bg-[#3B82F6] text-text-base border-[#3B82F6]' 
                  : 'bg-bg-hover text-text-muted border-[#64748B] hover:bg-[#64748B]/30'
              }`}
            >
              {CATEGORIAS_NOME[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {Object.entries(itensPorCategoria).map(([categoria, items]) => (
          <div key={categoria} className="space-y-3">
            <h4 className="font-semibold text-text-base pb-2 border-b border-border-default flex justify-between items-center">
              <span>{CATEGORIAS_NOME[categoria as CategoriaItemFunerario]}</span>
              <span className="text-xs font-normal text-text-subtle bg-slate-100 dark:bg-bg-hover px-2 py-0.5 rounded-full">
                {(items as ItemFunerarioCheckbox[]).length} {(items as ItemFunerarioCheckbox[]).length === 1 ? 'item' : 'itens'}
              </span>
            </h4>
            
            <div className="space-y-2">
              {(items as ItemFunerarioCheckbox[]).map(item => {
                const isCoberto = itensCobertos.includes(item.id);
                const isExcluido = itensExcluidos.includes(item.id);
                const hasObs = !!observacoes[item.id];
                const isExpanded = expandido[item.id];

                return (
                  <div key={item.id} className={`p-3 rounded-xl border transition-colors ${
                    isCoberto ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20' :
                    isExcluido ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20' :
                    'bg-bg-surface/50 border-border-default hover:border-[#3B82F6]/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-text-muted">
                          {item.nome}
                        </span>
                        {hasObs && (
                          <button 
                            type="button"
                            onClick={() => setExpandido(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                            className="text-amber-500 p-1 rounded-full hover:bg-amber-500/10"
                            title="Ver observação"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        )}
                        {!hasObs && !readOnly && (isCoberto || isExcluido) && (
                          <button 
                            type="button"
                            onClick={() => setExpandido(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                            className="text-text-subtle p-1 rounded-full hover:bg-slate-200 dark:hover:bg-bg-surface"
                            title="Adicionar observação"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => toggleCoberto(item.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                            isCoberto 
                              ? 'bg-emerald-500 text-text-base border-emerald-600' 
                              : 'bg-bg-subtle text-text-muted border-[#64748B] hover:border-emerald-400 hover:text-emerald-500'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Coberto
                        </button>
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => toggleExcluido(item.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                            isExcluido 
                              ? 'bg-red-500 text-text-base border-red-600' 
                              : 'bg-bg-subtle text-text-muted border-[#64748B] hover:border-red-400 hover:text-red-500'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          Excluído
                        </button>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-border-default/50">
                        {readOnly ? (
                          <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-lg border border-amber-200/50 dark:border-amber-500/20">
                            <strong>Obs:</strong> {observacoes[item.id]}
                          </p>
                        ) : (
                          <div>
                            <label className="block text-xs font-medium text-text-subtle mb-1">Observação para este item neste plano</label>
                            <input
                              type="text"
                              value={observacoes[item.id] || ''}
                              onChange={(e) => updateObservacao(item.id, e.target.value)}
                              placeholder="Ex: Apenas modelo padrão"
                              className="w-full bg-bg-surface border border-border-default rounded-xl px-3 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {itensFiltrados.length === 0 && (
          <div className="text-center text-text-subtle py-8">
            Nenhum item encontrado com os filtros atuais.
          </div>
        )}
      </div>
    </div>
  );
};
