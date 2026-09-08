import React, { useState, useEffect } from 'react';
import { getRemessas } from '../../services/faturamentoService';
import { getRequisicoes } from '../../services/requisicoesService';
import { RemessaFaturamento } from '../../types/faturamento';
import { Requisicao } from '../../types/requisicoes';
import { useAppContext } from '../../context/AppContext';
import { 
  FileText, 
  ChevronDown, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Banknote,
  Stethoscope,
  Activity,
  Columns3,
  ListTree
} from 'lucide-react';
import { formatLocalDate } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/formatters';
import {
  agruparPorStatus,
  guiasDaRemessa,
  guiasFaltando,
  totaisGerais,
} from '../../utils/faturamentosKanban';

interface FaturamentosCredenciadoTabProps {
  credenciadoId: string;
}

export const FaturamentosCredenciadoTab: React.FC<FaturamentosCredenciadoTabProps> = ({ credenciadoId }) => {
  const { state } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [remessas, setRemessas] = useState<RemessaFaturamento[]>([]);
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const [expandedRemessas, setExpandedRemessas] = useState<Set<string>>(new Set());
  /** Kanban por status é a visão padrão; a árvore continua disponível. */
  const [visao, setVisao] = useState<'kanban' | 'arvore'>('kanban');
  /** Remessa aberta no kanban — só uma por vez, para o card não virar uma parede. */
  const [remessaAberta, setRemessaAberta] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (!credenciadoId) return;
      setLoading(true);
      try {
        const tenantId = state.empresaSelecionada || 'default_tenant';
        
        // Em um cenário ideal teríamos métodos específicos, mas como os existentes trazem todos, filtramos no front:
        const todasRemessas = await getRemessas(state.isOnline, tenantId);
        const todasRequisicoes = await getRequisicoes(state.isOnline, tenantId);
        
        if (!isMounted) return;

        const remessasDoCredenciado = todasRemessas.filter(r => r.credenciado_id === credenciadoId);
        const requisicoesDoCredenciado = todasRequisicoes.filter(r => r.credenciado_id === credenciadoId);
        
        // Sort by data_criacao desc
        remessasDoCredenciado.sort((a, b) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime());
        
        setRemessas(remessasDoCredenciado);
        setRequisicoes(requisicoesDoCredenciado);
        
        // Expand first remessa by default
        if (remessasDoCredenciado.length > 0) {
          setExpandedRemessas(new Set([remessasDoCredenciado[0].id]));
        }
      } catch (err) {
        console.error('Erro ao buscar faturamentos do credenciado:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [credenciadoId, state.isOnline, state.empresaSelecionada]);

  const toggleRemessa = (id: string) => {
    setExpandedRemessas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'em_aberto':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20"><Clock className="w-3 h-3" /> Em Aberto</span>;
      case 'fechada':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20"><CheckCircle2 className="w-3 h-3" /> Fechada</span>;
      case 'paga':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><DollarSign className="w-3 h-3" /> Paga</span>;
      case 'processando':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20"><Activity className="w-3 h-3" /> Processando</span>;
      case 'cancelada':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20"><AlertCircle className="w-3 h-3" /> Cancelada</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">{status.toUpperCase()}</span>;
    }
  };

  const getRequisicaoStatusBadge = (status: string) => {
    switch (status) {
      case 'emitida':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">Emitida</span>;
      case 'autorizada':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">Autorizada</span>;
      case 'realizada':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">Realizada</span>;
      case 'cancelada':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wider">Cancelada</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20 uppercase tracking-wider">{status}</span>;
    }
  };

  const colunas = agruparPorStatus(remessas);
  const totais = totaisGerais(remessas);

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-text-subtle">
        <div className="w-8 h-8 border-3 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Buscando faturamentos vinculados...</p>
      </div>
    );
  }

  if (remessas.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-bg-surface border border-border-default rounded-full flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-text-muted" />
        </div>
        <h3 className="text-base font-bold text-text-base mb-2">Nenhum Faturamento Encontrado</h3>
        <p className="text-sm text-text-subtle max-w-sm">
          Este credenciado ainda não possui remessas de faturamento registradas no sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 bg-bg-base">
      <div className="max-w-4xl mx-auto">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-text-base flex items-center gap-2">
              <Banknote className="w-5 h-5 text-[#3B82F6]" />
              Remessas de Faturamento
            </h2>
            <p className="text-xs text-text-subtle mt-1">
              {totais.qtdRemessas} remessa(s) · {totais.totalGuias} guia(s) ·{' '}
              <span className="font-semibold text-text-base">{formatCurrency(totais.totalLiquido)}</span> líquido
            </p>
          </div>

          <div className="flex items-center gap-1 bg-bg-surface p-1 rounded-xl border border-border-default">
            <button
              type="button"
              onClick={() => setVisao('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                visao === 'kanban'
                  ? 'bg-[#3B82F6] text-white'
                  : 'text-text-subtle hover:text-text-base'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              type="button"
              onClick={() => setVisao('arvore')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                visao === 'arvore'
                  ? 'bg-[#3B82F6] text-white'
                  : 'text-text-subtle hover:text-text-base'
              }`}
            >
              <ListTree className="w-3.5 h-3.5" /> Organograma
            </button>
          </div>
        </div>

        {visao === 'kanban' && (
          /* Uma coluna por etapa do ciclo da remessa. Colunas vazias ficam: a
             ausência de remessa numa etapa é informação, não buraco de layout. */
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar -mx-1 px-1">
            {colunas.map((coluna) => (
              <div key={coluna.status} className="shrink-0 w-[280px] flex flex-col">
                <div className="mb-3 px-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-base">
                      {coluna.rotulo}
                    </span>
                    <span className="text-[11px] font-bold text-text-subtle bg-bg-surface border border-border-default rounded-full px-2 py-0.5">
                      {coluna.remessas.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">
                    {coluna.totalGuias} guia(s) · {formatCurrency(coluna.totalLiquido)}
                  </p>
                  <div className="h-0.5 rounded-full bg-border-default mt-2" />
                </div>

                <div className="flex flex-col gap-2.5">
                  {coluna.remessas.length === 0 && (
                    <p className="text-[11px] text-text-muted italic px-1 py-3">Nenhuma remessa</p>
                  )}

                  {coluna.remessas.map((remessa) => {
                    const aberta = remessaAberta === remessa.id;
                    const guias = guiasDaRemessa(remessa, requisicoes);
                    const faltando = guiasFaltando(remessa, requisicoes);
                    return (
                      <div
                        key={remessa.id}
                        className={`bg-bg-surface border rounded-xl transition-all ${
                          aberta ? 'border-[#3B82F6] shadow-lg' : 'border-border-default hover:border-[#3B82F6]/40'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setRemessaAberta(aberta ? null : remessa.id)}
                          aria-expanded={aberta}
                          className="w-full text-left p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-[#3B82F6]">
                              {remessa.codigo_remessa}
                            </span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-text-subtle shrink-0 transition-transform ${aberta ? 'rotate-180' : ''}`}
                            />
                          </div>
                          <p className="text-[11px] text-text-muted mt-1.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formatLocalDate(remessa.data_criacao)}
                          </p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-default">
                            <span className="text-[11px] text-text-subtle">{remessa.qtd_guias} guia(s)</span>
                            <span className="text-xs font-bold text-text-base">
                              {formatCurrency(remessa.valor_liquido)}
                            </span>
                          </div>
                        </button>

                        {aberta && (
                          /* O ramo do organograma: as guias penduradas na remessa. */
                          <div className="px-3 pb-3">
                            <div className="pl-3 border-l border-dashed border-[#3B82F6]/40 flex flex-col gap-2">
                              {guias.length === 0 && (
                                <p className="text-[11px] text-text-muted italic">
                                  Nenhuma guia vinculada.
                                </p>
                              )}
                              {guias.map((guia) => (
                                <div key={guia.id} className="bg-bg-base border border-border-default rounded-lg p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-[11px] font-bold text-text-base truncate">
                                      {guia.codigo_requisicao}
                                    </span>
                                    {getRequisicaoStatusBadge(guia.status)}
                                  </div>
                                  <p className="text-[11px] text-text-subtle truncate mt-1 flex items-center gap-1">
                                    <Stethoscope className="w-3 h-3 shrink-0" />
                                    {guia.paciente_nome}
                                  </p>
                                  <p className="text-[11px] font-bold text-[#3B82F6] mt-1">
                                    {formatCurrency(guia.valor_total)}
                                  </p>
                                </div>
                              ))}
                              {faltando > 0 && (
                                <p className="text-[11px] text-amber-400">
                                  {faltando} guia(s) referenciada(s) não foram encontradas.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {visao === 'arvore' && (
        <>

        {/* ESTRUTURA KANBAN/ORGANOGRAMA - Lista vertical com nested items estilizados */}
        <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[21px] before:w-px before:bg-border-default before:-z-10 ml-2">
          {remessas.map((remessa) => {
            const isExpanded = expandedRemessas.has(remessa.id);
            // Pegar as requisições atreladas a esta remessa
            const guiasVinculadas = requisicoes.filter(req => remessa.requisicao_ids?.includes(req.id));
            
            return (
              <div key={remessa.id} className="relative">
                {/* Connector from main line */}
                <div className="absolute top-7 -left-[21px] w-[21px] h-px bg-border-default -z-10" />
                
                {/* Remessa Card */}
                <div 
                  className={`bg-bg-surface border ${isExpanded ? 'border-[#3B82F6]/50 shadow-md shadow-[#3B82F6]/5' : 'border-border-default hover:border-[#3B82F6]/30'} rounded-2xl p-0 overflow-hidden transition-all duration-300 ml-5 relative z-0`}
                >
                  {/* Card Header - Clickable for expand/collapse */}
                  <div 
                    onClick={() => toggleRemessa(remessa.id)}
                    className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none group"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isExpanded ? 'bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20' : 'bg-bg-subtle text-text-subtle border border-border-default group-hover:bg-[#3B82F6]/5 group-hover:text-[#3B82F6]'}`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-base font-bold text-text-base group-hover:text-[#3B82F6] transition-colors">
                            {remessa.codigo_remessa}
                          </h3>
                          {getStatusBadge(remessa.status)}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-text-muted mt-2">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatLocalDate(remessa.data_criacao)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Stethoscope className="w-3.5 h-3.5" />
                            {remessa.qtd_guias} guia(s)
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-border-default pt-3 md:pt-0 mt-3 md:mt-0">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-text-subtle uppercase tracking-wider mb-0.5">Valor Líquido</p>
                        <p className="text-lg font-black text-emerald-400">
                          {formatCurrency(remessa.valor_liquido)}
                        </p>
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${isExpanded ? 'bg-[#3B82F6]/10 text-[#3B82F6] rotate-180' : 'bg-bg-subtle text-text-subtle hover:bg-[#3B82F6]/10 hover:text-[#3B82F6]'}`}>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content - Guias/Requisicoes */}
                  <div 
                    className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className="overflow-hidden">
                      <div className="p-5 pt-0 border-t border-border-default/50 bg-bg-surface/50">
                        <h4 className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-4 mt-4 ml-2 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                          Guias vinculadas a esta remessa ({guiasVinculadas.length})
                        </h4>
                        
                        {guiasVinculadas.length === 0 ? (
                          <div className="text-center py-4 text-xs text-text-muted bg-bg-subtle rounded-xl border border-border-default border-dashed">
                            Nenhuma guia localizada para esta remessa.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-border-default before:-z-10 ml-1">
                            {guiasVinculadas.map(guia => (
                              <div key={guia.id} className="relative ml-8">
                                <div className="absolute top-1/2 -translate-y-1/2 -left-8 w-8 h-px bg-border-default -z-10" />
                                <div className="bg-bg-base border border-border-default hover:border-[#3B82F6]/40 rounded-xl p-3 shadow-sm transition-colors flex flex-col justify-between h-full">
                                  <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <span className="font-mono text-[11px] font-semibold text-text-muted">
                                        {guia.codigo_requisicao}
                                      </span>
                                      {getRequisicaoStatusBadge(guia.status)}
                                    </div>
                                    <p className="text-sm font-bold text-text-base line-clamp-1 mb-1">
                                      {guia.associado_nome || guia.paciente_nome}
                                    </p>
                                    <p className="text-[11px] text-text-subtle flex items-center gap-1.5">
                                      <Calendar className="w-3 h-3" />
                                      {formatLocalDate(guia.data_emissao)}
                                    </p>
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-border-default flex justify-between items-end">
                                    <div>
                                      <p className="text-[9px] uppercase tracking-wider font-bold text-text-muted">Qtd Procedimentos</p>
                                      <p className="text-xs font-medium text-text-base mt-0.5">{guia.itens?.length || 0} itens</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[9px] uppercase tracking-wider font-bold text-text-muted">Valor</p>
                                      <p className="text-sm font-bold text-[#3B82F6]">{formatCurrency(guia.valor_total)}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
        )}
      </div>
    </div>
  );
};
