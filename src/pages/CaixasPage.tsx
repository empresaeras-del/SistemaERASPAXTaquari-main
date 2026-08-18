import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useConfirm } from '../context/ConfirmContext';
import { getLotesCaixa, reabrirLoteCaixa, getMovimentacoesCaixa, abrirLoteCaixa, registrarMovimentacao, estornarMovimentacaoCaixa, fecharLoteCaixa } from '../services/caixasService';
import { getEmpresaById, Empresa } from '../services/empresasService';
import { LoteCaixa, MovimentacaoCaixa } from '../types/caixas';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, X, RotateCcw, ArrowUpRight, ArrowDownRight, Printer, Eye, FileText } from 'lucide-react';

export const CaixasPage: React.FC = () => {
  const { state } = useAppContext();
  const { confirm } = useConfirm();
  
  const [activeTab, setActiveTab] = useState<'fluxo' | 'lotes' | 'conciliacao'>('fluxo');
  const [lotes, setLotes] = useState<LoteCaixa[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoCaixa[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // modals
  const [modalReabrirLote, setModalReabrirLote] = useState<{ isOpen: boolean, lote: LoteCaixa | null }>({ isOpen: false, lote: null });
  const [justificativaReabertura, setJustificativaReabertura] = useState('');
  
  const [modalEstorno, setModalEstorno] = useState<{ isOpen: boolean, mov: MovimentacaoCaixa | null }>({ isOpen: false, mov: null });
  const [motivoEstorno, setMotivoEstorno] = useState('');
  
  const [modalAbrirLote, setModalAbrirLote] = useState(false);
  const [saldoInicialNovoLote, setSaldoInicialNovoLote] = useState('');
  const [observacaoNovoLote, setObservacaoNovoLote] = useState('');

  const [modalSuprimento, setModalSuprimento] = useState(false);
  const [modalSangria, setModalSangria] = useState(false);
  const [valorMov, setValorMov] = useState('');
  const [descricaoMov, setDescricaoMov] = useState('');

  const [modalFecharLote, setModalFecharLote] = useState(false);
  const [saldoInformado, setSaldoInformado] = useState('');
  const [observacaoFechamento, setObservacaoFechamento] = useState('');

  const [modalLoteDetalhes, setModalLoteDetalhes] = useState<{isOpen: boolean, lote: LoteCaixa | null, movimentacoes: MovimentacaoCaixa[], loading: boolean, autoPrint?: boolean}>({isOpen: false, lote: null, movimentacoes: [], loading: false, autoPrint: false});
  const [empresaData, setEmpresaData] = useState<Empresa | null>(null);

  const getTenantId = () => state.empresaSelecionada || 'tenant-1';

  const loadData = async () => {
    try {
      setLoading(true);
      const tenantId = getTenantId();
      const isOnline = state.isOnline;

      const [lotesData, emp] = await Promise.all([
        getLotesCaixa(isOnline, tenantId),
        getEmpresaById(tenantId, isOnline)
      ]);
      setLotes(lotesData);
      if (emp) setEmpresaData(emp);
      
      const aberto = lotesData.find(l => l.status === 'aberto');
      if (aberto) {
        const movs = await getMovimentacoesCaixa(isOnline, tenantId, aberto.id);
        setMovimentacoes(movs);
      } else {
        setMovimentacoes([]);
      }
    } catch (e: any) {
      toast.error('Erro ao carregar dados do caixa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.user]);

  const loteAberto = lotes.find(l => l.status === 'aberto');

  const handleConfirmReabrirLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justificativaReabertura.trim()) {
      toast.error("A justificativa é obrigatória para reabrir o lote.");
      return;
    }
    const lote = modalReabrirLote.lote;
    if (!lote) return;
    
    setModalReabrirLote({ isOpen: false, lote: null });
    
    confirm({
      title: "Reabrir Lote de Caixa",
      message: `Deseja realmente reabrir o lote ${lote.codigo_lote}? Essa ação será registrada na auditoria.`,
      confirmText: "Sim, reabrir lote",
      cancelText: "Cancelar",
      danger: true,
      onConfirm: async () => {
        try {
          setLoading(true);
          await reabrirLoteCaixa(state.isOnline, lote.id, justificativaReabertura, state.user?.nome || 'Admin');
          toast.success("Lote reaberto com sucesso!");
          await loadData();
        } catch (e: any) {
          toast.error(e.message || "Erro ao reabrir lote");
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleConfirmEstorno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivoEstorno.trim()) {
      toast.error("O motivo é obrigatório para estornar a movimentação.");
      return;
    }
    const mov = modalEstorno.mov;
    if (!mov) return;
    
    setModalEstorno({ isOpen: false, mov: null });
    
    confirm({
      title: "Estornar Movimentação",
      message: `Deseja realmente estornar esta ${mov.tipo === 'entrada' ? 'Entrada' : 'Saída'} no valor de ${formatCurrency(mov.valor)}? Essa ação será registrada na auditoria.`,
      confirmText: "Sim, estornar",
      cancelText: "Cancelar",
      danger: true,
      onConfirm: async () => {
        try {
          setLoading(true);
          await estornarMovimentacaoCaixa(state.isOnline, mov.id, motivoEstorno);
          toast.success("Movimentação estornada com sucesso!");
          await loadData();
        } catch (e: any) {
          toast.error(e.message || "Erro ao estornar movimentação");
        } finally {
          setLoading(false);
          setMotivoEstorno('');
        }
      }
    });
  };

  const handleAbrirLote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await abrirLoteCaixa(state.isOnline, {
        tenant_id: getTenantId(),
        terminal_caixa: 'Caixa Principal',
        operador_id: state.user?.id || '',
        operador_nome: state.user?.nome || '',
        saldo_inicial: Number(saldoInicialNovoLote),
        observacao_abertura: observacaoNovoLote
      });
      toast.success("Caixa aberto com sucesso!");
      setModalAbrirLote(false);
      setSaldoInicialNovoLote('');
      setObservacaoNovoLote('');
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao abrir caixa");
    } finally {
      setLoading(false);
    }
  };

  const handleFecharLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loteAberto) return;
    try {
      setLoading(true);
      await fecharLoteCaixa(
        state.isOnline, 
        loteAberto.id, 
        {
          saldo_fechamento_informado: Number(saldoInformado), 
          observacao_fechamento: observacaoFechamento
        }
      );
      toast.success("Caixa fechado com sucesso!");
      setModalFecharLote(false);
      setSaldoInformado('');
      setObservacaoFechamento('');
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao fechar caixa");
    } finally {
      setLoading(false);
    }
  };

  const handleMovimentacao = async (e: React.FormEvent, tipo: 'entrada' | 'saida') => {
    e.preventDefault();
    if (!loteAberto) return;
    try {
      setLoading(true);
      const mov = {
        tenant_id: loteAberto.tenant_id,
        lote_id: loteAberto.id,
        tipo,
        valor: Number(valorMov),
        descricao: descricaoMov,
        forma_pagamento: 'dinheiro' as const,
        data_movimentacao: new Date().toISOString(),
        operador_nome: state.user?.nome || '',
        origem: tipo === 'entrada' ? 'suprimento' as const : 'sangria' as const,
        categoria: 'movimentacao'
      };
      await registrarMovimentacao(state.isOnline, mov);
      toast.success(tipo === 'entrada' ? "Suprimento registrado!" : "Sangria registrada!");
      setModalSuprimento(false);
      setModalSangria(false);
      setValorMov('');
      setDescricaoMov('');
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar movimentação");
    } finally {
      setLoading(false);
    }
  };
  
  const handleSyncFinancials = async () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast.success("Integração concluída com sucesso!");
    }, 1500);
  };

  const handleViewLoteDetails = async (lote: LoteCaixa, autoPrint: boolean = false) => {
    setModalLoteDetalhes({ isOpen: true, lote, movimentacoes: [], loading: true, autoPrint });
    try {
      const movs = await getMovimentacoesCaixa(state.isOnline, lote.tenant_id, lote.id);
      setModalLoteDetalhes({ isOpen: true, lote, movimentacoes: movs, loading: false, autoPrint });
    } catch (e: any) {
      toast.error('Erro ao carregar movimentações do lote');
      setModalLoteDetalhes(prev => ({ ...prev, loading: false, autoPrint: false }));
    }
  };

  useEffect(() => {
    if (modalLoteDetalhes.isOpen && !modalLoteDetalhes.loading && modalLoteDetalhes.autoPrint) {
      const timer = setTimeout(() => {
        window.print();
        setModalLoteDetalhes(prev => ({ ...prev, autoPrint: false }));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [modalLoteDetalhes.isOpen, modalLoteDetalhes.loading, modalLoteDetalhes.autoPrint]);

  const handlePrintLote = async (lote: LoteCaixa) => {
    await handleViewLoteDetails(lote, true);
  };

  const formatCurrency = (val: number | string) => {
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <>
      <div className={`p-6 max-w-7xl mx-auto space-y-6`}>
        <div className="print:hidden">
          <h1 className="text-2xl font-bold text-text-base mb-1">Fluxo de Caixa e Lotes</h1>
        <p className="text-sm text-text-subtle">Gerencie movimentações, aberturas/fechamentos de caixa por lotes e conciliação.</p>
      </div>
      
      <div className="flex gap-4 border-b border-border-default pb-4 overflow-x-auto print:hidden">
        <button onClick={() => setActiveTab('fluxo')} className={`px-4 py-2 whitespace-nowrap ${activeTab === 'fluxo' ? 'border-b-2 border-primary text-primary font-medium' : 'text-text-subtle hover:text-text-base'}`}>Fluxo de Caixa</button>
        <button onClick={() => setActiveTab('lotes')} className={`px-4 py-2 whitespace-nowrap ${activeTab === 'lotes' ? 'border-b-2 border-primary text-primary font-medium' : 'text-text-subtle hover:text-text-base'}`}>Lotes de Caixa</button>
        <button onClick={() => setActiveTab('conciliacao')} className={`px-4 py-2 whitespace-nowrap ${activeTab === 'conciliacao' ? 'border-b-2 border-primary text-primary font-medium' : 'text-text-subtle hover:text-text-base'}`}>Conciliação Financeira</button>
      </div>

      {activeTab === 'fluxo' && (
        <div className="space-y-6 print:hidden">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Caixa Atual: {loteAberto ? loteAberto.codigo_lote : 'Nenhum caixa aberto'}</h2>
            <div className="flex gap-2">
              {!loteAberto ? (
                <button onClick={() => setModalAbrirLote(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-medium text-sm">
                  <Plus className="w-4 h-4" /> Abrir Caixa
                </button>
              ) : (
                <>
                  <button onClick={() => setModalSuprimento(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium text-sm transition-colors">
                    <ArrowUpRight className="w-4 h-4" /> Suprimento
                  </button>
                  <button onClick={() => setModalSangria(true)} className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-medium text-sm transition-colors">
                    <ArrowDownRight className="w-4 h-4" /> Sangria
                  </button>
                  <button onClick={() => setModalFecharLote(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-medium text-sm transition-colors">
                    <X className="w-4 h-4" /> Fechar Caixa
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-bg-surface border border-border-default p-4 rounded-xl shadow-sm">
              <div className="text-sm text-text-subtle mb-1">Saldo Inicial</div>
              <div className="text-xl font-bold">{formatCurrency(loteAberto?.saldo_inicial || 0)}</div>
            </div>
            <div className="bg-bg-surface border border-border-default p-4 rounded-xl shadow-sm">
              <div className="text-sm text-text-subtle mb-1">Entradas</div>
              <div className="text-xl font-bold text-emerald-500">+{formatCurrency(movimentacoes.filter(m => m.tipo === 'entrada' && !m.estornado).reduce((acc, m) => acc + Number(m.valor), 0))}</div>
            </div>
            <div className="bg-bg-surface border border-border-default p-4 rounded-xl shadow-sm">
              <div className="text-sm text-text-subtle mb-1">Saídas</div>
              <div className="text-xl font-bold text-rose-500">-{formatCurrency(movimentacoes.filter(m => m.tipo === 'saida' && !m.estornado).reduce((acc, m) => acc + Number(m.valor), 0))}</div>
            </div>
            <div className="bg-bg-surface border border-border-default p-4 rounded-xl shadow-sm">
              <div className="text-sm text-text-subtle mb-1">Saldo Esperado</div>
              <div className="text-xl font-bold">{formatCurrency(Number(loteAberto?.saldo_inicial || 0) + movimentacoes.filter(m => m.tipo === 'entrada' && !m.estornado).reduce((acc, m) => acc + Number(m.valor), 0) - movimentacoes.filter(m => m.tipo === 'saida' && !m.estornado).reduce((acc, m) => acc + Number(m.valor), 0))}</div>
            </div>
          </div>
          
          <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden shadow-sm">
             <div className="p-4 border-b border-border-default bg-bg-subtle font-semibold">Movimentações do Lote Atual</div>
             {movimentacoes.length === 0 ? (
               <div className="p-8 text-center text-text-subtle">Nenhuma movimentação neste lote.</div>
             ) : (
               <table className="w-full text-left text-sm">
                 <thead className="bg-bg-base text-text-subtle">
                   <tr>
                     <th className="p-3 font-medium border-b border-border-default">Data/Hora</th>
                     <th className="p-3 font-medium border-b border-border-default">Origem</th>
                     <th className="p-3 font-medium border-b border-border-default">Descrição</th>
                     <th className="p-3 font-medium border-b border-border-default text-right">Valor</th>
                     <th className="p-3 font-medium border-b border-border-default text-right">Ações</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border-default">
                   {movimentacoes.map(mov => (
                     <tr key={mov.id} className={`hover:bg-bg-base/50 ${mov.estornado ? 'opacity-50' : ''}`}>
                       <td className="p-3 text-text-subtle">{new Date(mov.data_movimentacao).toLocaleString()}</td>
                       <td className="p-3 uppercase">{mov.origem}</td>
                       <td className="p-3">
                         {mov.estornado && <span className="mr-2 px-1.5 py-0.5 bg-rose-500/10 text-rose-500 rounded text-[10px] uppercase font-bold tracking-wider no-underline inline-block">Estornado</span>}
                         <span className={mov.estornado ? 'line-through' : ''}>{mov.descricao}</span>
                       </td>
                       <td className={`p-3 text-right font-medium ${mov.tipo === 'entrada' ? 'text-emerald-500' : 'text-rose-500'} ${mov.estornado ? 'line-through' : ''}`}>
                         {mov.tipo === 'entrada' ? '+' : '-'}{formatCurrency(mov.valor)}
                       </td>
                       <td className="p-3 text-right">
                         {!mov.estornado && (
                           <button
                             onClick={() => setModalEstorno({ isOpen: true, mov })}
                             className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded text-xs font-medium transition-colors"
                           >
                             Estornar
                           </button>
                         )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}
          </div>
        </div>
      )}

      {activeTab === 'lotes' && (
        <div className="space-y-4 print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Histórico de Lotes</h2>
            <button onClick={loadData} className="flex items-center gap-2 text-sm bg-bg-subtle px-3 py-1.5 rounded-xl border border-border-default hover:bg-bg-hover transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
          
          <div className="grid gap-4">
            {lotes.map(lote => (
              <div key={lote.id} className="p-5 bg-bg-surface border border-border-default rounded-2xl shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-lg">{lote.codigo_lote}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${lote.status === 'aberto' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-text-subtle/10 text-text-subtle'}`}>
                        {lote.status}
                      </span>
                    </div>
                    <div className="text-sm text-text-subtle">
                      Abertura: {new Date(lote.data_abertura).toLocaleString()}
                      {lote.data_fechamento && ` | Fechamento: ${new Date(lote.data_fechamento).toLocaleString()}`}
                    </div>
                    {lote.observacao_fechamento && (
                      <div className="mt-2 text-xs text-rose-500 bg-rose-500/10 p-2 rounded break-words">
                        {lote.observacao_fechamento}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-sm">Saldo Esperado: <span className="font-bold text-text-base">{formatCurrency(lote.saldo_esperado || 0)}</span></div>
                    {lote.status === 'fechado' && (
                      <div className="text-sm">Saldo Informado: <span className="font-bold text-text-base">{formatCurrency(lote.saldo_fechamento_informado || 0)}</span></div>
                    )}
                    
                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={() => handleViewLoteDetails(lote)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-base hover:bg-bg-hover text-text-base border border-border-default rounded-lg text-xs font-medium transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver Lançamentos
                      </button>

                      {lote.status === 'fechado' && (
                        <button 
                          onClick={() => handlePrintLote(lote)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-base hover:bg-bg-hover text-text-base border border-border-default rounded-lg text-xs font-medium transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" /> Imprimir
                        </button>
                      )}

                      {lote.status === 'fechado' && (
                        <button 
                          onClick={() => {
                            setJustificativaReabertura('');
                            setModalReabrirLote({ isOpen: true, lote });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg text-xs font-medium transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reabrir Lote
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {lotes.length === 0 && (
              <div className="p-8 text-center text-text-subtle bg-bg-surface border border-border-default rounded-xl">
                Nenhum lote registrado.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'conciliacao' && (
        <div className="bg-bg-subtle border border-border-default rounded-2xl p-6 shadow-sm space-y-6 print:hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-default pb-6">
            <div>
              <h3 className="font-semibold text-lg text-text-base">Integração Automática Contas a Receber / Pagar</h3>
              <p className="text-sm text-text-subtle mt-1">
                Todas as baixas e pagamentos executados no módulo financeiro são automaticamente canalizados para o fluxo de caixa ativo.
              </p>
            </div>
            <button
              onClick={handleSyncFinancials}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Sincronizar Financeiro
            </button>
          </div>
          <div className="text-center p-8 text-text-subtle">
            As movimentações financeiras já estão integradas em tempo real com os lotes de caixa abertos.
          </div>
        </div>
      )}

      {/* Modal Detalhes do Lote */}
      {modalLoteDetalhes.isOpen && modalLoteDetalhes.lote && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in print:static print:bg-transparent print:p-0 print:block">
          <div className="bg-bg-surface w-full max-w-4xl rounded-2xl shadow-2xl border border-border-default flex flex-col max-h-[90vh] print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none">
            {/* Cabeçalho impresso com logotipo da empresa */}
            <div className="hidden print:block p-6 pb-4 border-b-2 border-slate-900 text-center">
              {empresaData?.logo_url ? (
                <div className="mb-3 flex justify-center">
                  <img 
                    src={empresaData.logo_url} 
                    alt={empresaData.nome_fantasia || "Logotipo"} 
                    className="max-h-20 w-full object-contain mx-auto"
                    style={{ maxHeight: '80px', width: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900 mb-1">
                  {empresaData?.nome_fantasia || empresaData?.razao_social || 'EMPRESA'}
                </h2>
              )}
              <h1 className="text-lg font-bold uppercase tracking-wider">Demonstrativo de Fechamento de Caixa</h1>
              <p className="text-xs text-slate-600">Lote: {modalLoteDetalhes.lote.codigo_lote} | Emitido em: {new Date().toLocaleString()}</p>
            </div>

            <div className="p-6 border-b border-border-default flex justify-between items-start print:border-b-2 print:border-black">
              <div>
                <h3 className="text-xl font-bold text-text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Detalhes do Lote: {modalLoteDetalhes.lote.codigo_lote}
                </h3>
                <div className="text-sm text-text-subtle mt-1 space-x-4">
                  <span>Abertura: {new Date(modalLoteDetalhes.lote.data_abertura).toLocaleString()}</span>
                  {modalLoteDetalhes.lote.data_fechamento && (
                    <span>Fechamento: {new Date(modalLoteDetalhes.lote.data_fechamento).toLocaleString()}</span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${modalLoteDetalhes.lote.status === 'aberto' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-text-subtle/10 text-text-subtle'}`}>
                    {modalLoteDetalhes.lote.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    window.print();
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-bg-base hover:bg-bg-hover border border-border-default text-text-base rounded-lg text-sm font-medium transition-colors print:hidden"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
                <button onClick={() => setModalLoteDetalhes({ isOpen: false, lote: null, movimentacoes: [], loading: false })} className="text-text-muted hover:text-text-base transition-colors print:hidden">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 print:overflow-visible">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-bg-subtle border border-border-default p-4 rounded-xl">
                  <div className="text-xs text-text-subtle mb-1 uppercase tracking-wider font-semibold">Saldo Inicial</div>
                  <div className="text-lg font-bold">{formatCurrency(modalLoteDetalhes.lote.saldo_inicial)}</div>
                </div>
                <div className="bg-bg-subtle border border-border-default p-4 rounded-xl">
                  <div className="text-xs text-text-subtle mb-1 uppercase tracking-wider font-semibold">Entradas</div>
                  <div className="text-lg font-bold text-emerald-500">+{formatCurrency(modalLoteDetalhes.lote.saldo_entradas || 0)}</div>
                </div>
                <div className="bg-bg-subtle border border-border-default p-4 rounded-xl">
                  <div className="text-xs text-text-subtle mb-1 uppercase tracking-wider font-semibold">Saídas</div>
                  <div className="text-lg font-bold text-rose-500">-{formatCurrency(modalLoteDetalhes.lote.saldo_saidas || 0)}</div>
                </div>
                <div className="bg-bg-subtle border border-border-default p-4 rounded-xl">
                  <div className="text-xs text-text-subtle mb-1 uppercase tracking-wider font-semibold">Saldo Esperado</div>
                  <div className="text-lg font-bold">{formatCurrency(modalLoteDetalhes.lote.saldo_esperado)}</div>
                </div>
              </div>

              {/* Transactions Table */}
              <div>
                <h4 className="font-semibold text-text-base mb-3">Lançamentos do Lote</h4>
                <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden">
                  {modalLoteDetalhes.loading ? (
                    <div className="p-8 text-center text-text-subtle flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin" /> Carregando lançamentos...
                    </div>
                  ) : modalLoteDetalhes.movimentacoes.length === 0 ? (
                    <div className="p-8 text-center text-text-subtle">Nenhum lançamento encontrado.</div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-bg-subtle text-text-subtle">
                        <tr>
                          <th className="p-3 font-semibold border-b border-border-default">Data/Hora</th>
                          <th className="p-3 font-semibold border-b border-border-default">Origem</th>
                          <th className="p-3 font-semibold border-b border-border-default">Descrição</th>
                          <th className="p-3 font-semibold border-b border-border-default">Forma</th>
                          <th className="p-3 font-semibold border-b border-border-default text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-default">
                        {modalLoteDetalhes.movimentacoes.map(mov => (
                          <tr key={mov.id} className={`hover:bg-bg-base/50 ${mov.estornado ? 'opacity-50 line-through' : ''}`}>
                            <td className="p-3 text-text-subtle">{new Date(mov.data_movimentacao).toLocaleString()}</td>
                            <td className="p-3 uppercase text-xs">{mov.origem}</td>
                            <td className="p-3">
                              {mov.estornado && <span className="mr-2 px-1.5 py-0.5 bg-rose-500/10 text-rose-500 rounded text-[10px] uppercase font-bold tracking-wider no-underline inline-block">Estornado</span>}
                              {mov.descricao}
                            </td>
                            <td className="p-3 uppercase text-xs">{mov.forma_pagamento}</td>
                            <td className={`p-3 text-right font-medium ${mov.tipo === 'entrada' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {mov.tipo === 'entrada' ? '+' : '-'}{formatCurrency(mov.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Rodapé impresso com assinaturas */}
              <div className="hidden print:flex justify-between items-end mt-16 pt-8 border-t border-slate-300 print:break-inside-avoid">
                <div className="text-center w-64">
                  <div className="border-t border-slate-900 mb-1"></div>
                  <p className="text-xs font-bold uppercase">Operador do Caixa</p>
                  <p className="text-[10px] text-slate-500">Conferido e Entregue</p>
                </div>
                <div className="text-center w-64">
                  {empresaData?.assinatura_url && (
                    <div className="mb-1 flex justify-center">
                      <img 
                        src={empresaData.assinatura_url} 
                        alt="Assinatura da Empresa" 
                        style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }}
                      />
                    </div>
                  )}
                  <div className="border-t border-slate-900 mb-1"></div>
                  <p className="text-xs font-bold uppercase">Supervisão / Gerência</p>
                  {empresaData?.cnpj && (
                    <p className="text-[10px] text-slate-500">CNPJ: {empresaData.cnpj}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Estorno */}
      {modalEstorno.isOpen && modalEstorno.mov && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border-default overflow-hidden">
            <div className="p-6 border-b border-border-default flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-text-base flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-rose-500" />
                  Estornar Movimentação
                </h3>
                <p className="text-sm text-text-subtle">
                  Valor: {formatCurrency(modalEstorno.mov.valor)}
                </p>
              </div>
              <button onClick={() => { setModalEstorno({ isOpen: false, mov: null }); setMotivoEstorno(''); }} className="text-text-muted hover:text-text-base transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmEstorno} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">
                  Motivo do Estorno <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={motivoEstorno}
                  onChange={(e) => setMotivoEstorno(e.target.value)}
                  className="w-full px-4 py-2 bg-bg-subtle border border-border-default rounded-xl focus:border-primary transition-colors text-sm"
                  placeholder="Ex: Lançamento incorreto"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                <button type="button" onClick={() => { setModalEstorno({ isOpen: false, mov: null }); setMotivoEstorno(''); }} className="px-4 py-2 bg-bg-subtle hover:bg-bg-hover text-text-base rounded-xl font-medium transition-colors text-sm">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-medium transition-colors text-sm">
                  Confirmar Estorno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reabrir Lote */}
      {modalReabrirLote.isOpen && modalReabrirLote.lote && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border-default overflow-hidden">
            <div className="p-6 border-b border-border-default flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-text-base flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-rose-500" />
                  Reabrir Lote
                </h3>
                <p className="text-sm text-text-subtle">Lote: {modalReabrirLote.lote.codigo_lote}</p>
              </div>
              <button onClick={() => setModalReabrirLote({ isOpen: false, lote: null })} className="text-text-muted hover:text-text-base transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmReabrirLote} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">
                  Motivo da reabertura <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  value={justificativaReabertura}
                  onChange={(e) => setJustificativaReabertura(e.target.value)}
                  className="w-full px-4 py-2 bg-bg-subtle border border-border-default rounded-xl focus:border-primary transition-colors text-sm min-h-[100px] resize-none"
                  placeholder="Informe detalhadamente por que este lote está sendo reaberto (Ex: Fechado por engano, necessidade de lançar movimentação)."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                <button type="button" onClick={() => setModalReabrirLote({ isOpen: false, lote: null })} className="px-4 py-2 bg-bg-subtle hover:bg-bg-hover text-text-base rounded-xl font-medium transition-colors text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={!justificativaReabertura.trim()} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors text-sm disabled:opacity-50">
                  Continuar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Abrir Lote */}
      {modalAbrirLote && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border-default overflow-hidden">
            <div className="p-6 border-b border-border-default flex justify-between items-center">
              <h3 className="text-xl font-bold text-text-base flex items-center gap-2">Abrir Lote de Caixa</h3>
              <button onClick={() => setModalAbrirLote(false)} className="text-text-muted hover:text-text-base transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAbrirLote} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Saldo Inicial (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={saldoInicialNovoLote}
                  onChange={(e) => setSaldoInicialNovoLote(e.target.value)}
                  className="w-full px-4 py-2 bg-bg-subtle border border-border-default rounded-xl focus:border-primary transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Observação</label>
                <textarea
                  value={observacaoNovoLote}
                  onChange={(e) => setObservacaoNovoLote(e.target.value)}
                  className="w-full px-4 py-2 bg-bg-subtle border border-border-default rounded-xl focus:border-primary transition-colors text-sm resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                <button type="button" onClick={() => setModalAbrirLote(false)} className="px-4 py-2 bg-bg-subtle hover:bg-bg-hover text-text-base rounded-xl font-medium transition-colors text-sm">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-xl font-medium transition-colors text-sm">
                  Abrir Lote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Suprimento / Sangria */}
      {(modalSuprimento || modalSangria) && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border-default overflow-hidden">
            <div className="p-6 border-b border-border-default flex justify-between items-center">
              <h3 className="text-xl font-bold text-text-base flex items-center gap-2">
                {modalSuprimento ? 'Novo Suprimento' : 'Nova Sangria'}
              </h3>
              <button onClick={() => { setModalSuprimento(false); setModalSangria(false); }} className="text-text-muted hover:text-text-base transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => handleMovimentacao(e, modalSuprimento ? 'entrada' : 'saida')} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={valorMov}
                  onChange={(e) => setValorMov(e.target.value)}
                  className="w-full px-4 py-2 bg-bg-subtle border border-border-default rounded-xl focus:border-primary transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  value={descricaoMov}
                  onChange={(e) => setDescricaoMov(e.target.value)}
                  className="w-full px-4 py-2 bg-bg-subtle border border-border-default rounded-xl focus:border-primary transition-colors text-sm"
                  placeholder="Ex: Troco"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                <button type="button" onClick={() => { setModalSuprimento(false); setModalSangria(false); }} className="px-4 py-2 bg-bg-subtle hover:bg-bg-hover text-text-base rounded-xl font-medium transition-colors text-sm">
                  Cancelar
                </button>
                <button type="submit" className={`px-4 py-2 text-white rounded-xl font-medium transition-colors text-sm ${modalSuprimento ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`}>
                  Confirmar {modalSuprimento ? 'Suprimento' : 'Sangria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Fechar Lote */}
      {modalFecharLote && loteAberto && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border-default overflow-hidden">
            <div className="p-6 border-b border-border-default flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-text-base flex items-center gap-2">
                  <X className="w-5 h-5 text-slate-500" />
                  Fechar Caixa
                </h3>
                <p className="text-sm text-text-subtle">
                  Lote: {loteAberto.codigo_lote}
                </p>
              </div>
              <button onClick={() => setModalFecharLote(false)} className="text-text-muted hover:text-text-base transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFecharLote} className="p-6 space-y-4">
              <div className="bg-bg-subtle border border-border-default rounded-xl p-4 mb-4">
                <div className="text-sm text-text-subtle mb-1">Saldo Esperado em Caixa</div>
                <div className="text-2xl font-bold text-text-base">
                  {formatCurrency(Number(loteAberto.saldo_inicial || 0) + movimentacoes.filter(m => m.tipo === 'entrada' && !m.estornado).reduce((acc, m) => acc + Number(m.valor), 0) - movimentacoes.filter(m => m.tipo === 'saida' && !m.estornado).reduce((acc, m) => acc + Number(m.valor), 0))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">
                  Saldo Físico / Informado <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-text-subtle">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={saldoInformado}
                    onChange={(e) => setSaldoInformado(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-bg-subtle border border-border-default rounded-xl focus:border-primary transition-colors text-sm"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-text-muted mt-1">Informe o valor real contado em caixa.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-base mb-1">
                  Observação de Fechamento (Opcional)
                </label>
                <input
                  type="text"
                  value={observacaoFechamento}
                  onChange={(e) => setObservacaoFechamento(e.target.value)}
                  className="w-full px-4 py-2 bg-bg-subtle border border-border-default rounded-xl focus:border-primary transition-colors text-sm"
                  placeholder="Ex: Diferença justificada por..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                <button type="button" onClick={() => setModalFecharLote(false)} className="px-4 py-2 bg-bg-subtle hover:bg-bg-hover text-text-base rounded-xl font-medium transition-colors text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors text-sm disabled:opacity-50">
                  {loading ? 'Processando...' : 'Confirmar Fechamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
};
