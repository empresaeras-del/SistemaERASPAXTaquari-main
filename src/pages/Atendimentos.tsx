import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { Plus, AlertTriangle, Search, Filter, CheckCircle, Clock, XCircle, Edit2, X, Download, FileText, AlertOctagon, Building2, CheckCircle2, Archive, Ban, LayoutGrid, List, Kanban } from 'lucide-react';
import { AdvancedFilterBar } from '../components/layout/AdvancedFilterBar';
import { exportToPDF } from "../lib/pdfExport";
import { getEmpresaById } from "../services/empresasService";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatLocalDate, formatLocalDateTime } from '../utils/dateUtils';
import { Atendimento } from '../types/atendimentos';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { registrarAuditoria } from '../lib/supabase';
import { getAtendimentos, saveAtendimento } from '../services/atendimentosService';
import { cancelarReceitasPorAtendimento } from '../services/financeiroService';
import { AtendimentoDetailsModal } from '../components/atendimentos/AtendimentoDetailsModal';
import { NovoAtendimentoWizard } from '../components/atendimentos/NovoAtendimentoWizard';
import { AtendimentosKanban } from '../components/AtendimentosKanban';

export const AtendimentosPage: React.FC = () => {
  const { state } = useAppContext();
  const toast = useToast();
  const { confirm } = useConfirm();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [viewAtendimento, setViewAtendimento] = useState<Atendimento | null>(null);

  const [statusChangeModal, setStatusChangeModal] = useState<{ isOpen: boolean, atendimento: Atendimento | null, newStatus: Atendimento['status'] | null, justificativa: string }>({ isOpen: false, atendimento: null, newStatus: null, justificativa: '' });

  const handleStatusChangeRequest = (atendimento: Atendimento, newStatus: Atendimento['status']) => {
    setStatusChangeModal({ isOpen: true, atendimento, newStatus, justificativa: '' });
  };

  const confirmStatusChange = async () => {
    const { atendimento, newStatus, justificativa } = statusChangeModal;
    if (!atendimento || !newStatus) return;
    if (justificativa.trim().length < 5) {
      toast.error('Informe uma justificativa válida.');
      return;
    }

    try {
      const updated = { ...atendimento, status: newStatus };
      await saveAtendimento(updated, state.isOnline);
      
      // Add explicit audit log for the CRM status change
      await registrarAuditoria('CRM Status Change', {
        atendimento_id: atendimento.id,
        falecido: atendimento.falecido_nome,
        old_status: atendimento.status,
        new_status: newStatus,
        justificativa: justificativa,
        data: new Date().toISOString()
      });

      
      if (newStatus === 'cancelado') {
        await cancelarReceitasPorAtendimento(atendimento.id, state.isOnline);
      }
      
      setAtendimentos(prev => prev.map(a => a.id === atendimento.id ? updated : a));

      toast.success('Status atualizado com sucesso!');
      setStatusChangeModal({ isOpen: false, atendimento: null, newStatus: null, justificativa: '' });
    } catch (error) {
      toast.error('Erro ao atualizar status.');
    }
  };



  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAtendimentos(state.isOnline, state.empresaSelecionada);
      setAtendimentos(data);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar atendimentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Acesso: Modulos permitidos e nivel
    // Opcionalmente checar state.user
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  
  const chartData = useMemo(() => {
    const months: Record<string, { name: string, associado: number, externo: number }> = {};
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = format(d, 'yyyy-MM');
        months[key] = { name: format(d, 'MMM', { locale: ptBR }), associado: 0, externo: 0 };
    }

    atendimentos.forEach(a => {
        if (a.status === 'cancelado') return;
        const date = a.data_obito || a.created_at || a.data_velorio;
        if (!date) return;
        
        try {
            const d = typeof date === 'string' ? parseISO(date) : new Date(date);
            const key = format(d, 'yyyy-MM');
            if (months[key]) {
                if (a.tipo_cliente === 'associado') {
                    months[key].associado += 1;
                } else {
                    months[key].externo += 1;
                }
            }
        } catch (e) {}
    });

    return Object.values(months);
  }, [atendimentos]);

  const filtered = useMemo(() => {
    return atendimentos.filter(a => {
      const matchesSearch = a.falecido_nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || statusFilter === 'todos' || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [atendimentos, searchTerm, statusFilter]);

  
  const totalAtendimentos = atendimentos.length;
  const totalAbertos = atendimentos.filter(a => a.status === 'aberto' || a.status === 'em_andamento').length;
  const totalConcluidos = atendimentos.filter(a => a.status === 'concluido').length;
  const totalCancelados = atendimentos.filter(a => a.status === 'cancelado').length;


  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId as 'aberto' | 'em_andamento' | 'concluido' | 'cancelado';
    
    // Optimistic update
    const prevAtendimentos = [...atendimentos];
    setAtendimentos(atendimentos.map(a => 
      a.id === draggableId ? { ...a, status: newStatus } : a
    ));

    try {
      const atendimentoToUpdate = atendimentos.find(a => a.id === draggableId);
      if (atendimentoToUpdate) {
        await saveAtendimento({ ...atendimentoToUpdate, status: newStatus }, state.isOnline);
        toast.success(`Status atualizado para ${newStatus.replace('_', ' ')}`);
      }
    } catch (error) {
      toast.error('Erro ao atualizar status');
      setAtendimentos(prevAtendimentos);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'aberto': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'em_andamento': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'concluido': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'cancelado': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const kanbanColumns = [
    { id: 'aberto', title: 'Aberto' },
    { id: 'em_andamento', title: 'Em Andamento' },
    { id: 'concluido', title: 'Concluído' },
    { id: 'cancelado', title: 'Cancelado' }
  ];

  const renderCard = (a: Atendimento, index: number, isKanban: boolean = false) => (
    isKanban ? (
      <Draggable key={a.id} draggableId={a.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => setViewAtendimento(a)}
            className={`bg-bg-surface border border-border-default rounded-xl overflow-hidden hover:border-primary/30 transition-colors shadow-sm group flex flex-col cursor-pointer mb-3 ${snapshot.isDragging ? 'opacity-80 scale-105 shadow-xl border-primary' : ''}`}
            style={provided.draggableProps.style}
          >
            <div className="p-4 flex-1">
              <div className="flex justify-between items-start mb-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                  a.tipo_cliente === 'associado' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                }`}>
                  {a.tipo_cliente === 'associado' ? (
                    <><Building2 className="w-3 h-3 mr-1" />Associado</>
                  ) : (
                    <><AlertOctagon className="w-3 h-3 mr-1" />Particular</>
                  )}
                </span>
                <span className="text-text-subtle text-xs">
                  {format(parseISO(a.created_at || new Date().toISOString()), "dd/MM 'às' HH:mm")}
                </span>
              </div>
              <h4 className="font-bold text-text-base text-sm truncate mb-1" title={a.falecido_nome}>
                {a.falecido_nome}
              </h4>
              <p className="text-text-subtle text-xs truncate">
                {a.local_velorio || 'Local não informado'}
              </p>
            </div>
            <div className="bg-bg-subtle/50 px-4 py-2 border-t border-border-default flex justify-between items-center text-xs">
              <span className="font-semibold text-text-base">
                R$ {(a.valor_total || 0).toFixed(2)}
              </span>
              <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-semibold">
                Detalhes
              </div>
            </div>
          </div>
        )}
      </Draggable>
    ) : (
      <div key={a.id} onClick={() => setViewAtendimento(a)} className="bg-bg-surface border border-border-default rounded-2xl overflow-hidden hover:border-primary/30 transition-colors shadow-sm group flex flex-col cursor-pointer">
        <div className="p-5 flex-1">
          <div className="flex justify-between items-start mb-4">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border ${
              a.tipo_cliente === 'associado' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            }`}>
              {a.tipo_cliente === 'associado' ? (
                <><Building2 className="w-3.5 h-3.5 mr-1" />Associado</>
              ) : (
                <><AlertOctagon className="w-3.5 h-3.5 mr-1" />Particular/Externo</>
              )}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border ${getStatusColor(a.status)}`}>
              {a.status === 'concluido' && <CheckCircle2 className="w-3 h-3 mr-1" />}
              {a.status === 'aberto' && <Clock className="w-3 h-3 mr-1" />}
              {a.status === 'cancelado' && <Ban className="w-3 h-3 mr-1" />}
              {a.status.replace('_', ' ')}
            </span>
          </div>
          <h4 className="font-bold text-text-base text-lg truncate mb-1" title={a.falecido_nome}>
            {a.falecido_nome}
          </h4>
          <p className="text-text-subtle text-sm truncate mb-4">
            CPF: {a.falecido_cpf || 'Não informado'}
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center text-text-subtle">
              <Building2 className="w-4 h-4 mr-2 opacity-50" />
              <span className="truncate">{a.local_velorio || 'Local de velório não informado'}</span>
            </div>
            <div className="flex items-center text-text-subtle">
              <Archive className="w-4 h-4 mr-2 opacity-50" />
              <span className="truncate">{a.local_sepultamento || 'Local de sepultamento não informado'}</span>
            </div>
          </div>
        </div>
        <div className="bg-bg-subtle/50 p-4 border-t border-border-default flex justify-between items-center">
          <div>
            <span className="text-xs text-text-subtle block mb-0.5">Valor Total</span>
            <span className="font-bold text-text-base text-lg">
              R$ {(a.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-semibold text-sm bg-primary/10 px-3 py-1.5 rounded-lg">
            Ver Detalhes <LayoutGrid className="w-4 h-4" />
          </div>
        </div>
      </div>
    )
  );


  const [viewMode, setViewMode] = useState<'grid'|'list'|'kanban'>('kanban');
  const handleExportPDF = async () => {
    const tenantId = state.empresaSelecionada || 'default_tenant';
    const empresa = await getEmpresaById(tenantId, state.isOnline);
    const columns = ["Data", "Falecido", "Tipo", "Status", "Valor Extra"];
    const data = filtered.map(a => [
      formatLocalDate(a.created_at || new Date()),
      a.falecido_nome,
      a.tipo_cliente.toUpperCase(),
      a.status.toUpperCase(),
      `R$ ${a.valor_total.toFixed(2)}`
    ]);
    
    await exportToPDF("Relatório de Atendimentos Funerários", columns, data, "atendimentos_export", empresa?.logo_url);
    toast.success('PDF exportado com sucesso!');
  };

  return (
    <div className="space-y-6">
      {/* HEADER PAGE TITLE & BREADCRUMB */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-subtle mb-1">
            <span>Administração</span>
            <span>/</span>
            <span className="text-[#3B82F6] font-semibold">Atendimentos</span>
          </div>
          <h1 className="text-2xl font-bold text-text-base tracking-tight flex items-center gap-2.5">
            <Archive className="w-7 h-7 text-[#3B82F6]" />
            <span>Gestão de Atendimentos</span>
          </h1>
          <p className="text-xs text-text-subtle mt-1">
            Gerencie os serviços e assistências funerárias.
          </p>
        </div>

        {/* PRIMARY ACTIONS */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-bg-surface text-text-base border border-border-default rounded-xl text-xs font-semibold hover:bg-bg-hover transition-colors shadow-sm"
            title="Exportar"
          >
            <Download className="w-4 h-4 text-text-subtle" />
            <span>Exportar PDF</span>
          </button>

          <button
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-blue-400 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Atendimento</span>
          </button>
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20 shrink-0">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Total de Atendimentos</p>
            <p className="text-xl font-extrabold text-text-base mt-0.5">{totalAtendimentos}</p>
          </div>
        </div>
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Em Andamento</p>
            <p className="text-xl font-extrabold text-blue-400 mt-0.5">{totalAbertos}</p>
          </div>
        </div>
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Concluídos</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{totalConcluidos}</p>
          </div>
        </div>
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20 shrink-0">
            <Ban className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Cancelados</p>
            <p className="text-xl font-extrabold text-rose-400 mt-0.5">{totalCancelados}</p>
          </div>
        </div>
      </div>


      {/* CHART */}
      <div className="bg-bg-surface rounded-2xl shadow-sm border border-border-default p-5">
        <h3 className="text-sm font-bold text-text-base mb-4">Distribuição de Atendimentos Mensais (6 Meses)</h3>
        <div className="w-full h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8B95A5', fontSize: 12 }} dy={10} style={{ textTransform: 'capitalize' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8B95A5', fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: '#334155', opacity: 0.4 }}
                contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: '1px solid #475569', color: '#fff' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="associado" name="Associados" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="externo" name="Particular/Externo" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* SEARCH BAR */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            type="text"
            placeholder="Buscar por nome do falecido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-bg-subtle border border-border-default rounded-xl pl-10 pr-4 py-2 text-xs text-text-base focus:outline-none focus:border-[#3B82F6]"
          />
        </div>

        {/* COMPACT FILTERS & TOGGLES */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors shrink-0 ${showFilters ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-bg-subtle border-border-default text-text-muted hover:text-text-base hover:bg-bg-hover'}`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros Avançados</span>
          </button>

          <div className="w-px h-6 bg-border-default mx-1 shrink-0"></div>

          <div className="flex items-center bg-bg-subtle border border-border-default rounded-xl p-0.5 shrink-0">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-bg-surface text-text-base shadow-sm' : 'text-text-subtle hover:text-text-base'}`}
              title="Visualização em Kanban"
            >
              <Kanban className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-bg-surface text-text-base shadow-sm' : 'text-text-subtle hover:text-text-base'}`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-bg-surface text-text-base shadow-sm' : 'text-text-subtle hover:text-text-base'}`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <AdvancedFilterBar
        pageKey="atendimentos"
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        currentFilters={{ statusFilter }}
        onApplyFilters={(filters) => {
          setStatusFilter(filters.statusFilter || '');
        }}
        onClearFilters={() => {
          setStatusFilter('');
        }}
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-subtle">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-bg-surface border border-border-default rounded-lg text-sm text-text-base focus:ring-2 focus:ring-primary/50"
          >
            <option value="todos">Todos os Status</option>
            <option value="aberto">Aberto</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </AdvancedFilterBar>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
          <p className="text-text-subtle font-medium">Carregando atendimentos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-bg-surface border border-border-default rounded-2xl">
           <AlertOctagon className="w-12 h-12 text-text-muted mb-4" />
           <h3 className="text-lg font-bold text-text-base mb-1">Nenhum atendimento encontrado</h3>
           <p className="text-sm text-text-subtle text-center">Tente ajustar seus filtros ou cadastre um novo atendimento.</p>
        </div>
      ) : viewMode === 'kanban' ? (
          <AtendimentosKanban atendimentos={filtered} onStatusChangeRequest={handleStatusChangeRequest} onViewAtendimento={setViewAtendimento} />
        ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "flex flex-col gap-3"}>
          {filtered.map(a => (
            <div key={a.id} onClick={() => setViewAtendimento(a)} className="bg-bg-surface border border-border-default rounded-2xl overflow-hidden hover:border-primary/30 transition-colors shadow-sm group flex flex-col cursor-pointer">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border
                    ${a.status === 'concluido' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                      a.status === 'cancelado' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                      'bg-blue-500/10 text-blue-500 border-blue-500/20'}
                  `}>
                    {a.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-semibold text-text-subtle">{formatLocalDate(a.created_at || '')}</span>
                </div>
                
                <h3 className="text-lg font-bold text-text-base mb-1 line-clamp-1">{a.falecido_nome}</h3>
                <p className="text-sm text-text-subtle mb-4">Tipo: <span className="font-semibold text-text-base capitalize">{a.tipo_cliente}</span></p>

                <div className="space-y-2 mb-4 bg-bg-subtle p-3 rounded-xl border border-border-default/50">
                   <div className="flex justify-between text-xs">
                     <span className="text-text-subtle font-medium">Local Velório</span>
                     <span className="text-text-base font-semibold truncate max-w-[120px]">{a.local_velorio || '-'}</span>
                   </div>
                   <div className="flex justify-between text-xs">
                     <span className="text-text-subtle font-medium">Data Óbito</span>
                     <span className="text-text-base font-semibold truncate max-w-[120px]">{formatLocalDate(a.data_obito)}</span>
                   </div>
                </div>
                
                <div className="pt-4 border-t border-border-default flex justify-between items-end">
                   <div>
                     <p className="text-[10px] uppercase font-bold text-text-subtle tracking-wider mb-0.5">Valor Extras</p>
                     <p className="text-lg font-black text-text-base">R$ {a.valor_total.toFixed(2)}</p>
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}


      
      {viewAtendimento && (
        <AtendimentoDetailsModal 
          atendimento={viewAtendimento}
          onClose={() => setViewAtendimento(null)}
          onSaved={() => {
            setViewAtendimento(null);
            loadData();
          }}
        />
      )}

      
      {statusChangeModal.isOpen && statusChangeModal.atendimento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-bg-base border border-border-default rounded-2xl p-6 w-full max-w-md shadow-2xl">
            
            <h3 className="text-xl font-bold text-text-base mb-2">Confirmar Alteração de Status</h3>
            {statusChangeModal.newStatus === 'cancelado' && (
              <div className="bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl p-3 mb-4 text-sm font-medium flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p><strong>Atenção:</strong> Ao cancelar este atendimento, todas as parcelas financeiras pendentes (contas a receber) vinculadas a ele serão <strong>automaticamente canceladas</strong>.</p>
              </div>
            )}
            <p className="text-sm text-text-subtle mb-4">

              Você está movendo o atendimento de <strong>{statusChangeModal.atendimento.falecido_nome}</strong> para o status <strong>{statusChangeModal.newStatus?.replace('_', ' ').toUpperCase()}</strong>.
            </p>
            <div className="space-y-3 mb-6">
              <label className="block text-sm font-medium text-text-subtle">Justificativa / Motivo da Mudança</label>
              <textarea
                value={statusChangeModal.justificativa}
                onChange={e => setStatusChangeModal(prev => ({ ...prev, justificativa: e.target.value }))}
                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-3 text-text-base focus:border-blue-500 outline-none resize-none h-24"
                placeholder="Ex: Documentação entregue, aguardando cemitério..."
                autoFocus
              ></textarea>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setStatusChangeModal({ isOpen: false, atendimento: null, newStatus: null, justificativa: '' })}
                className="px-4 py-2 rounded-xl text-text-subtle font-medium hover:bg-bg-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={statusChangeModal.justificativa.trim().length < 5}
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50"
              >
                Confirmar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {isWizardOpen && (
        <NovoAtendimentoWizard 
          onClose={() => setIsWizardOpen(false)}
          onSuccess={() => {
            setIsWizardOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};
