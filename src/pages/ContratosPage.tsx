import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { getAssociados, Associado } from '../services/associadosService';
import { getEmpresas, Empresa } from '../services/empresasService';
import { getEmpresaById } from '../services/empresasService';
import { supabase } from '../lib/supabase';
import {
  Search,
  Filter,
  FileText,
  Download,
  LayoutGrid,
  List,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  CreditCard,
  Calendar,
  Eye,
  ChevronRight,
  GitFork,
  Network,
  Printer,
  Plus,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { usePlanosPax } from '../hooks/usePlanosPax';
import { formatLocalDate } from '../utils/dateUtils';
import { canEditContratos, alertPermissionRestriction } from '../utils/permissions';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

import { NovoContratoWizard } from '../components/contratos/NovoContratoWizard';
import { OrganogramaContratosCanvas } from '../components/contratos/OrganogramaContratosCanvas';
import { AssociadoDetailsModal } from '../components/associados/AssociadoDetailsModal';

export const ContratosPage: React.FC = () => {
  const { state } = useAppContext();
  const { planosAtivos: planos, calcularValor, planos: planosCompletos } = usePlanosPax();

  const [associados, setAssociados] = useState<Associado[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaData, setEmpresaData] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [planoFilter, setPlanoFilter] = useState('todos');
  const [viewMode, setViewMode] = useState<'organograma' | 'table' | 'grid'>('organograma');
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const [selectedAssociadoDetails, setSelectedAssociadoDetails] = useState<Associado | null>(null);
  const [showRelatorioContratos, setShowRelatorioContratos] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, empresasList] = await Promise.all([
        getAssociados(state.isOnline, state.empresaSelecionada),
        getEmpresas(state.isOnline),
      ]);
      setEmpresas(empresasList || []);

      // Carrega dados da empresa selecionada para o relatório
      if (state.empresaSelecionada && state.empresaSelecionada !== 'all') {
        const emp = await getEmpresaById(state.empresaSelecionada, state.isOnline);
        if (emp) setEmpresaData(emp);
      } else if (empresasList && empresasList.length > 0) {
        setEmpresaData(empresasList[0]);
      }

      // Associados vinculados a um plano
      const comContrato = data.filter((a) => a.plano_pax_id);
      setAssociados(comContrato);

      // Sincroniza em segundo plano com a tabela contratos do Supabase
      if (state.isOnline && comContrato.length > 0) {
        for (const assoc of comContrato) {
          try {
            const { data: existing } = await supabase
              .from('contratos')
              .select('id')
              .eq('associado_id', assoc.id)
              .maybeSingle();

            const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const cTenantId =
              assoc.tenant_id && assoc.tenant_id !== 'all' ? assoc.tenant_id : 'default_tenant';
            const cPlanoId =
              assoc.plano_pax_id && UUID_REGEX.test(assoc.plano_pax_id) ? assoc.plano_pax_id : null;
            const cDataInicio =
              assoc.data_adesao && String(assoc.data_adesao).trim() !== ''
                ? String(assoc.data_adesao).split('T')[0]
                : new Date().toISOString().split('T')[0];

            const contratoData = {
              tenant_id: cTenantId,
              empresa_id: (assoc as any).empresa_id || cTenantId,
              associado_id: assoc.id,
              plano_pax_id: cPlanoId,
              numero_contrato:
                assoc.numero_contrato || `CTR-${assoc.id.substring(0, 8).toUpperCase()}`,
              data_inicio: cDataInicio,
              valor_mensalidade: Number(assoc.valor_plano) || 0,
              status: assoc.status || 'ativo',
              observacoes: (assoc as any).observacoes || null,
            };

            if (!existing) {
              await supabase.from('contratos').insert({ id: crypto.randomUUID(), ...contratoData });
            } else {
              await supabase.from('contratos').update(contratoData).eq('id', existing.id);
            }
          } catch (syncErr) {
            console.warn('Erro ao sincronizar contrato existente:', syncErr);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  const filtered = useMemo(() => {
    return associados.filter((a) => {
      const matchesSearch =
        a.nome.toLowerCase().includes(searchTerm.toLowerCase()) || a.cpf.includes(searchTerm);
      const matchesStatus = statusFilter !== 'todos' ? a.status === statusFilter : true;
      const matchesPlano = planoFilter !== 'todos' ? a.plano_pax_id === planoFilter : true;

      return matchesSearch && matchesStatus && matchesPlano;
    });
  }, [associados, searchTerm, statusFilter, planoFilter]);

  const stats = useMemo(() => {
    return {
      total: associados.length,
      ativos: associados.filter((a) => a.status === 'ativo').length,
      inadimplentes: associados.filter((a) => a.status === 'inadimplente').length,
      inativos: associados.filter((a) => a.status === 'inativo').length,
    };
  }, [associados]);

  const exportarCSV = () => {
    if (filtered.length === 0) return;

    const headers = [
      'Contrato',
      'Nome',
      'CPF',
      'Plano',
      'Vidas',
      'Status',
      'Data Adesão',
      'Valor (R$)',
    ];
    const rows = filtered.map((a) => {
      const planoNome = planos.find((p) => p.id === a.plano_pax_id)?.nome || 'Desconhecido';
      const valor = a.valor_plano ? a.valor_plano.toFixed(2).replace('.', ',') : '0,00';
      return [
        a.numero_contrato || '' || a.id.substring(0, 8),
        a.nome,
        a.cpf,
        planoNome,
        a.n_vidas?.toString() || '1',
        a.status,
        a.data_adesao ? formatLocalDate(a.data_adesao) : '',
        valor,
      ].join(';');
    });

    const csvContent = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `contratos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ativo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Ativo
          </span>
        );
      case 'inadimplente':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" /> Inadimplente
          </span>
        );
      case 'inativo':
      case 'encerrado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <XCircle className="w-3 h-3" /> Encerrado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-bg-subtle text-text-subtle border border-border-default">
            {status}
          </span>
        );
    }
  };

  const formatDateSafe = (dateStr: string | undefined) => {
    return formatLocalDate(dateStr, 'dd/MM/yyyy', 'Não informada');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-subtle mb-1">
            <span>Administração</span>
            <span>/</span>
            <span className="text-[#3B82F6] font-semibold">Contratos</span>
          </div>
          <h1 className="text-2xl font-bold text-text-base tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-[#3B82F6]" />
            <span>Gestão de Contratos</span>
          </h1>
          <p className="text-xs text-text-subtle mt-1">
            Consulta, acompanhamento e gestão de contratos ativos, inativos e inadimplentes
          </p>
        </div>

        {/* PRIMARY ACTIONS */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowRelatorioContratos(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-bg-surface text-text-base border border-border-default rounded-xl text-xs font-semibold hover:bg-bg-hover transition-colors shadow-sm"
            title="Gerar Relatório de Contratos em PDF"
          >
            <FileText className="w-4 h-4 text-text-subtle" />
            <span>Gerar Relatório</span>
          </button>
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-bg-surface text-text-base border border-border-default rounded-xl text-xs font-semibold hover:bg-bg-hover transition-colors shadow-sm"
            title="Exportar contratos filtrados em CSV"
          >
            <Download className="w-4 h-4 text-text-subtle" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={() => {
              if (!canEditContratos(state.user, state.isOnline)) {
                alertPermissionRestriction('Contratos', 'criar ou emitir novos contratos PAX');
                return;
              }
              setShowNovoContrato(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Contrato</span>
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Total de Contratos</p>
            <p className="text-xl font-extrabold text-text-base mt-0.5">{stats.total}</p>
          </div>
        </div>
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Contratos Ativos</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{stats.ativos}</p>
          </div>
        </div>
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Inadimplentes</p>
            <p className="text-xl font-extrabold text-rose-400 mt-0.5">{stats.inadimplentes}</p>
          </div>
        </div>
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-500/10 text-slate-400 rounded-2xl border border-slate-500/20 shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Encerrados</p>
            <p className="text-xl font-extrabold text-slate-400 mt-0.5">{stats.inativos}</p>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* SEARCH BAR */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            type="text"
            placeholder="Buscar por nome ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-bg-subtle border border-border-default rounded-xl pl-10 pr-4 py-2 text-xs text-text-base focus:outline-none focus:border-[#3B82F6]"
          />
        </div>

        {/* DROPDOWN FILTERS */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1 text-text-subtle mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold">Filtros:</span>
          </div>

          <select
            value={planoFilter}
            onChange={(e) => setPlanoFilter(e.target.value)}
            className="bg-bg-subtle border border-border-default rounded-xl px-3 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]"
          >
            <option value="todos">Todos os Planos</option>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-bg-subtle border border-border-default rounded-xl px-3 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Ativos</option>
            <option value="inadimplente">Inadimplentes</option>
            <option value="inativo">Encerrados</option>
          </select>

          {/* VIEW SWITCHER */}
          <div className="flex items-center bg-bg-subtle border border-border-default p-1 rounded-xl ml-auto md:ml-0 gap-1">
            <button
              onClick={() => setViewMode('organograma')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'organograma'
                  ? 'bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white shadow-md shadow-blue-500/25'
                  : 'text-text-subtle hover:text-text-base hover:bg-bg-hover'
              }`}
              title="Visualização em Organograma Interativo tipo Canvas"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Organograma</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-[#3B82F6] text-white' : 'text-text-subtle hover:text-text-base hover:bg-bg-hover'}`}
              title="Visualização em Tabela"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#3B82F6] text-white' : 'text-text-subtle hover:text-text-base hover:bg-bg-hover'}`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT: ORGANOGRAMA CANVAS, GRID OU TABELA */}
      {loading ? (
        <div className="py-20 text-center text-text-subtle flex flex-col items-center">
          <div className="w-8 h-8 border-3 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-medium">Carregando lista de contratos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-bg-surface border border-border-default rounded-3xl p-8 space-y-3">
          <FileText className="w-12 h-12 text-text-subtle mx-auto opacity-50" />
          <h3 className="text-base font-bold text-text-base">Nenhum contrato encontrado</h3>
          <p className="text-xs text-text-subtle max-w-md mx-auto">
            Não encontramos nenhum contrato com os filtros aplicados.
          </p>
        </div>
      ) : viewMode === 'organograma' ? (
        /* ORGANOGRAMA CANVAS VIEW */
        <OrganogramaContratosCanvas
          associados={filtered}
          planos={planosCompletos?.length ? planosCompletos : (planos as any)}
          empresaNome={
            state.empresaSelecionada === 'all'
              ? 'Todas as Unidades (Visão Global)'
              : empresas.find((e) => e.id === state.empresaSelecionada)?.nome_fantasia ||
                empresas.find((e) => e.id === state.empresaSelecionada)?.razao_social ||
                'PAX & Funerária Taquari'
          }
          statusFilter={statusFilter}
          planoFilter={planoFilter}
          onSelectAssociado={(assoc) => setSelectedAssociadoDetails(assoc)}
        />
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="bg-bg-surface border border-border-default rounded-2xl p-5 hover:border-[#3B82F6]/50 transition-all shadow-sm hover:shadow-md flex flex-col justify-between group"
            >
              <div>
                {/* CARD HEADER */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-mono text-[11px] font-bold text-text-subtle bg-bg-subtle px-2 py-0.5 rounded-md border border-border-default">
                        {a.numero_contrato || '' || 'S/C'}
                      </span>
                      {getStatusBadge(a.status)}
                    </div>
                    <h3
                      className="text-base font-bold text-text-base group-hover:text-[#3B82F6] transition-colors line-clamp-1"
                      title={a.nome}
                    >
                      {a.nome}
                    </h3>
                  </div>
                </div>

                {/* BADGES */}
                <div className="flex items-center gap-2 my-3 flex-wrap text-xs">
                  <span
                    className="px-2.5 py-1 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] font-semibold border border-[#3B82F6]/20 truncate max-w-[150px]"
                    title={planos.find((p) => p.id === a.plano_pax_id)?.nome || 'Desconhecido'}
                  >
                    {planos.find((p) => p.id === a.plano_pax_id)?.nome || 'Desconhecido'}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-bg-subtle text-text-subtle font-medium border border-border-default flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {a.n_vidas || 1} Vidas
                  </span>
                </div>

                {/* DETAILS LIST */}
                <div className="space-y-2 text-xs text-text-muted my-3 border-t border-border-default/50 pt-3">
                  <p className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                      <strong className="text-text-subtle">CPF:</strong>
                    </span>
                    <span className="font-mono text-text-base">{a.cpf}</span>
                  </p>

                  <p className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                      <strong className="text-text-subtle">Adesão:</strong>
                    </span>
                    <span className="text-text-base">{formatDateSafe(a.data_adesao)}</span>
                  </p>

                  <p className="flex items-center justify-between bg-bg-subtle p-2 rounded-lg mt-2">
                    <strong className="text-text-subtle font-semibold">Mensalidade:</strong>
                    <span className="font-bold text-[#3B82F6]">
                      R$ {a.valor_plano ? a.valor_plano.toFixed(2).replace('.', ',') : '0,00'}
                    </span>
                  </p>
                </div>
              </div>

              {/* CARD FOOTER ACTIONS */}
              <div className="flex items-center justify-end pt-3 border-t border-border-default/60 mt-2">
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20 transition-colors text-xs font-semibold"
                  onClick={() => setSelectedAssociadoDetails(a)}
                  title="Ver Ficha Completa do Associado"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ver Detalhes
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-bg-surface border border-border-default rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-subtle border-b border-border-default text-[11px] uppercase tracking-wider text-text-subtle font-bold">
                  <th className="px-5 py-4 min-w-[250px]">Associado</th>
                  <th className="px-5 py-4">Plano PAX</th>
                  <th className="px-5 py-4 text-center">Vidas</th>
                  <th className="px-5 py-4">Adesão</th>
                  <th className="px-5 py-4 text-right">Valor</th>
                  <th className="px-5 py-4 text-center">Status</th>
                  <th className="px-5 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default/50">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-bg-subtle/50 transition-colors group">
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-text-base group-hover:text-[#3B82F6] transition-colors">
                          {a.nome}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-text-muted font-mono bg-bg-subtle px-1.5 py-0.5 rounded border border-border-default">
                            {a.numero_contrato || '' || 'S/C'}
                          </span>
                          <span className="text-xs text-text-subtle">{a.cpf}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 truncate max-w-[150px]">
                        {planos.find((p) => p.id === a.plano_pax_id)?.nome || 'Desconhecido'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-full bg-bg-subtle border border-border-default text-xs font-bold text-text-base">
                        {a.n_vidas || 1}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-text-base">
                        <Calendar className="w-3.5 h-3.5 text-text-subtle" />
                        {formatDateSafe(a.data_adesao)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-semibold text-[#3B82F6]">
                        R$ {a.valor_plano ? a.valor_plano.toFixed(2).replace('.', ',') : '0,00'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-center">{getStatusBadge(a.status)}</div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => setSelectedAssociadoDetails(a)}
                        className="p-1.5 rounded-lg text-text-subtle hover:text-[#3B82F6] hover:bg-bg-hover transition-colors"
                        title="Ver Detalhes do Associado"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETALHES DO ASSOCIADO */}
      {selectedAssociadoDetails && (
        <AssociadoDetailsModal
          associado={selectedAssociadoDetails}
          onClose={() => setSelectedAssociadoDetails(null)}
        />
      )}

      {showNovoContrato && (
        <NovoContratoWizard
          onClose={() => setShowNovoContrato(false)}
          onSuccess={() => {
            setShowNovoContrato(false);
            loadData();
          }}
        />
      )}

      {/* MODAL RELATÓRIO PROFISSIONAL DE CONTRATOS */}
      {showRelatorioContratos && (
        <RelatorioContratosModal
          isOpen={showRelatorioContratos}
          onClose={() => setShowRelatorioContratos(false)}
          associados={filtered}
          planos={planos}
          empresaData={empresaData}
          userName={state.user?.nome || state.user?.email || 'Operador do Sistema'}
          currentFilters={{ searchTerm, statusFilter, planoFilter }}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE: RelatorioContratosModal
// ─────────────────────────────────────────────────────────────────────────────
interface RelatorioContratosModalProps {
  isOpen: boolean;
  onClose: () => void;
  associados: Associado[];
  planos: Array<{ id: string; nome: string }>;
  empresaData: Empresa | null;
  userName?: string;
  currentFilters?: { searchTerm?: string; statusFilter?: string; planoFilter?: string };
}

const RelatorioContratosModal: React.FC<RelatorioContratosModalProps> = ({
  isOpen,
  onClose,
  associados,
  planos,
  empresaData,
  userName = 'Operador do Sistema',
  currentFilters = {},
}) => {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [zoom, setZoom] = useState(100);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  if (!isOpen) return null;

  const formatCurrency = (val?: number) =>
    val != null
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
      : 'R$ 0,00';

  const stats = {
    total: associados.length,
    ativos: associados.filter((a) => a.status === 'ativo').length,
    inadimplentes: associados.filter((a) => a.status === 'inadimplente').length,
    encerrados: associados.filter((a) => a.status === 'inativo' || a.status === 'encerrado').length,
    totalMensalidades: associados.reduce((acc, a) => acc + (a.valor_plano || 0), 0),
  };

  const dataHoraEmissao = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss");
  const companyName = empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX';

  const getPlanoNome = (planoId?: string) =>
    planos.find((p) => p.id === planoId)?.nome || 'Desconhecido';

  const getStatusStyle = (status: string) => {
    if (status === 'ativo') return 'background:#dcfce7;color:#166534;border:1px solid #bbf7d0;';
    if (status === 'inadimplente')
      return 'background:#ffe4e6;color:#9f1239;border:1px solid #fecdd3;';
    return 'background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;';
  };

  const handleImprimir = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('O navegador bloqueou a janela de impressão. Permita pop-ups.');
      return;
    }

    const logoHtml = empresaData?.logo_url
      ? `<img src="${empresaData.logo_url}" alt="Logo" style="max-height:55px;max-width:220px;object-fit:contain;"/>`
      : `<h1 style="margin:0;font-size:18px;font-weight:800;text-transform:uppercase;color:#0f172a;">${companyName}</h1>`;

    const tableRows = associados
      .map(
        (a, idx) => `
      <tr>
        <td style="text-align:center;font-weight:600;color:#475569;">${idx + 1}</td>
        <td>
          <div style="font-weight:700;color:#0f172a;font-size:10.5px;">${a.nome}</div>
          <div style="color:#64748b;font-size:9px;margin-top:1px;">
            <span><strong>Contrato:</strong> ${a.numero_contrato || 'S/N'}</span>
          </div>
        </td>
        <td style="font-size:9.5px;color:#047857;font-weight:600;">${getPlanoNome(a.plano_pax_id)}</td>
        <td style="text-align:center;font-size:9.5px;">${a.n_vidas || 1}</td>
        <td style="text-align:center;font-size:9.5px;">${a.data_adesao ? formatLocalDate(a.data_adesao) : '-'}</td>
        <td style="text-align:right;font-size:9.5px;font-weight:700;color:#2563eb;">${formatCurrency(a.valor_plano)}</td>
        <td style="text-align:center;">
          <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:8.5px;font-weight:700;text-transform:uppercase;${getStatusStyle(a.status)}">
            ${a.status}
          </span>
        </td>
      </tr>
    `,
      )
      .join('');

    const printHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8"/>
          <title>Relatório de Contratos - ${companyName}</title>
          <style>
            @page { ${orientation === 'landscape' ? 'size: A4 landscape;' : 'size: A4 portrait;'} margin: 8mm 10mm; }
            *, *::before, *::after { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color:#0f172a; margin:0; padding:0; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; font-size:10px; }
            .header-table { width:100%; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:10px; }
            .title-main { font-size:16px; font-weight:900; text-transform:uppercase; color:#0f172a; margin:0 0 2px 0; }
            .kpi-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:12px; }
            .kpi-card { border:1px solid #cbd5e1; border-radius:6px; padding:6px 8px; background:#f8fafc; }
            .kpi-label { font-size:8.5px; text-transform:uppercase; font-weight:700; color:#64748b; }
            .kpi-val { font-size:13px; font-weight:900; color:#0f172a; margin-top:2px; }
            .filters-bar { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px; margin-bottom:10px; display:flex; justify-content:space-between; font-size:9.5px; color:#475569; }
            table.data-table { width:100%; border-collapse:collapse; margin-bottom:12px; }
            table.data-table th { background-color:#0f172a!important; color:#fff!important; font-weight:800; font-size:9.5px; text-transform:uppercase; padding:6px 7px; border:1px solid #0f172a; text-align:left; }
            table.data-table td { border:1px solid #cbd5e1; padding:5px 6px; vertical-align:top; }
            table.data-table tr:nth-child(even) { background-color:#f8fafc; }
            .footer-info { border-top:1px solid #cbd5e1; padding-top:8px; margin-top:14px; display:flex; justify-content:space-between; font-size:8.5px; color:#64748b; }
            .lgpd-notice { background:#fefce8; border:1px solid #fde68a; border-radius:4px; padding:4px 8px; margin-bottom:10px; font-size:8px; color:#92400e; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="vertical-align:top;width:50%;">${logoHtml}
                <div style="font-size:9.5px;color:#475569;margin-top:3px;line-height:1.3;">
                  ${empresaData?.cnpj ? `<strong>CNPJ:</strong> ${empresaData.cnpj}` : ''}
                  ${empresaData?.telefone ? ` | <strong>Tel:</strong> ${empresaData.telefone}` : ''}
                  ${empresaData?.endereco ? `<br/>${empresaData.endereco}` : ''}
                </div>
              </td>
              <td style="vertical-align:top;width:50%;text-align:right;">
                <div class="title-main">Relatório de Contratos</div>
                <div style="font-size:10px;font-weight:600;color:#2563eb;">Gestão de Contratos PAX</div>
                <div style="font-size:9px;color:#64748b;margin-top:4px;"><strong>Emissão:</strong> ${dataHoraEmissao}<br/><strong>Emitido por:</strong> ${userName}</div>
              </td>
            </tr>
          </table>

          <div class="lgpd-notice">⚠️ Documento protegido — dados pessoais omitidos conforme LGPD (Lei 13.709/2018). Uso restrito à instituição emissora.</div>

          <div class="filters-bar">
            <div><strong>Status:</strong> ${(currentFilters.statusFilter || 'TODOS').toUpperCase()}</div>
            <div><strong>Busca:</strong> ${currentFilters.searchTerm ? `"${currentFilters.searchTerm}"` : 'Nenhum'}</div>
            <div><strong>Total de Registros:</strong> ${associados.length}</div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card" style="border-left:3px solid #3b82f6;"><div class="kpi-label">Total Contratos</div><div class="kpi-val" style="color:#2563eb;">${stats.total}</div></div>
            <div class="kpi-card" style="border-left:3px solid #16a34a;"><div class="kpi-label">Ativos</div><div class="kpi-val" style="color:#16a34a;">${stats.ativos}</div></div>
            <div class="kpi-card" style="border-left:3px solid #e11d48;"><div class="kpi-label">Inadimplentes</div><div class="kpi-val" style="color:#e11d48;">${stats.inadimplentes}</div></div>
            <div class="kpi-card" style="border-left:3px solid #64748b;"><div class="kpi-label">Encerrados</div><div class="kpi-val" style="color:#64748b;">${stats.encerrados}</div></div>
            <div class="kpi-card" style="border-left:3px solid #7c3aed;"><div class="kpi-label">Total Mensalidades</div><div class="kpi-val" style="color:#7c3aed;font-size:10px;">${formatCurrency(stats.totalMensalidades)}</div></div>
          </div>

          <table class="data-table">
            <thead><tr>
              <th style="width:3%;text-align:center;">#</th>
              <th style="width:30%;">Associado / Contrato</th>
              <th style="width:20%;">Plano PAX</th>
              <th style="width:6%;text-align:center;">Vidas</th>
              <th style="width:10%;text-align:center;">Adesão</th>
              <th style="width:13%;text-align:right;">Mensalidade</th>
              <th style="width:10%;text-align:center;">Status</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
              <tr style="background:#f1f5f9;font-weight:800;">
                <td colspan="5" style="text-align:right;padding:6px 8px;text-transform:uppercase;font-size:10px;">Total de Contratos:</td>
                <td style="text-align:right;padding:6px 8px;font-size:10px;color:#2563eb;">${formatCurrency(stats.totalMensalidades)}/mês</td>
                <td style="text-align:center;padding:6px 8px;font-size:10px;">${associados.length} registros</td>
              </tr>
            </tfoot>
          </table>

          <div class="footer-info">
            <div>Sistema ERAS PAX Taquari — Gestão de Contratos e Planos</div>
            <div>Documento emitido eletronicamente em ${dataHoraEmissao}</div>
            <div>Página 1 de 1</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      toast.loading('Gerando PDF...', { id: 'export-contratos-pdf' });

      const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName.toUpperCase(), 14, 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('RELATÓRIO DE CONTRATOS', 14, 16);
      doc.setFontSize(8);
      doc.text(`Emissão: ${dataHoraEmissao} | Operador: ${userName}`, pageW - 14, 10, {
        align: 'right',
      });
      doc.text(
        `Total: ${associados.length} contratos | ${formatCurrency(stats.totalMensalidades)}/mês`,
        pageW - 14,
        16,
        { align: 'right' },
      );

      autoTable(doc, {
        startY: 28,
        head: [
          ['#', 'Associado / Contrato', 'Plano PAX', 'Vidas', 'Adesão', 'Mensalidade', 'Status'],
        ],
        body: associados.map((a, idx) => [
          (idx + 1).toString(),
          `${a.nome}\nContrato: ${a.numero_contrato || 'S/N'}`,
          getPlanoNome(a.plano_pax_id),
          (a.n_vidas || 1).toString(),
          a.data_adesao ? formatLocalDate(a.data_adesao) : '-',
          formatCurrency(a.valor_plano),
          a.status.toUpperCase(),
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
        },
        bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42], cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: orientation === 'landscape' ? 70 : 50 },
          2: { cellWidth: orientation === 'landscape' ? 50 : 35 },
          3: { cellWidth: 14, halign: 'center' },
          4: { cellWidth: 20, halign: 'center' },
          5: { cellWidth: 28, halign: 'right' },
          6: { cellWidth: 22, halign: 'center' },
        },
        foot: [
          [
            {
              content: `TOTAL: ${associados.length} contratos | Mensalidades: ${formatCurrency(stats.totalMensalidades)}/mês`,
              colSpan: 7,
              styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] },
            },
          ],
        ],
        margin: { left: 14, right: 14 },
      });

      doc.save(`Relatorio_Contratos_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      toast.success('Relatório exportado com sucesso!', { id: 'export-contratos-pdf' });
    } catch (err) {
      console.error('Erro ao gerar PDF de contratos:', err);
      toast.error('Erro ao gerar PDF.', { id: 'export-contratos-pdf' });
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1e232a] text-slate-100 overflow-hidden">
      {/* TOOLBAR */}
      <header className="h-16 bg-[#13171f] border-b border-[#2d3544] px-6 flex items-center justify-between shadow-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Relatório de Contratos
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {associados.length} contratos
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Documento profissional — Gestão de Contratos PAX
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 bg-[#1c222e] p-1.5 rounded-xl border border-[#2d3544]">
          <div className="flex items-center bg-[#13171f] rounded-lg p-1 mr-2 border border-[#2d3544]">
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                orientation === 'landscape'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Paisagem"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Paisagem</span>
            </button>
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                orientation === 'portrait'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Retrato"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Retrato</span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom((z) => Math.max(z - 10, 40))}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544]"
              title="Reduzir Zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(100)}
              className="px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-[#2d3544] rounded-lg min-w-[54px] text-center"
            >
              {zoom}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(z + 10, 200))}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544]"
              title="Ampliar Zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            <span>Salvar PDF</span>
          </button>
          <button
            onClick={handleImprimir}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-blue-600/20"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
          <div className="h-6 w-px bg-[#2d3544]" />
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#2d3544]"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* CANVAS */}
      <main className="flex-1 overflow-auto p-8 flex justify-center items-start bg-[#1a1e27] custom-scrollbar">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="mb-12 shadow-2xl"
        >
          <div
            style={{
              width: orientation === 'landscape' ? '297mm' : '210mm',
              minHeight: orientation === 'landscape' ? '210mm' : '297mm',
              padding: '14mm 16mm',
            }}
            className="bg-white text-slate-900 rounded-sm shadow-2xl relative font-sans leading-normal box-border"
          >
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start gap-4">
              <div className="flex-1">
                {empresaData?.logo_url ? (
                  <img
                    src={empresaData.logo_url}
                    alt="Logo"
                    className="max-h-14 max-w-[240px] object-contain mb-2"
                  />
                ) : (
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase mb-1">
                    {companyName}
                  </h1>
                )}
                <div className="text-xs text-slate-600 leading-tight space-y-0.5">
                  {empresaData?.cnpj && (
                    <p>
                      <span className="font-semibold text-slate-800">CNPJ:</span> {empresaData.cnpj}
                      {empresaData.telefone ? ` | Tel: ${empresaData.telefone}` : ''}
                    </p>
                  )}
                  {empresaData?.endereco && (
                    <p className="text-slate-500">{empresaData.endereco}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] font-extrabold uppercase tracking-wide text-slate-800 mb-1">
                  Relatório Cadastral
                </div>
                <h2 className="text-base font-black uppercase text-slate-900 tracking-wide">
                  Contratos PAX
                </h2>
                <div className="text-[11px] text-slate-500 mt-1">
                  Emissão:{' '}
                  <strong className="text-slate-800">
                    {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
                  </strong>
                </div>
                <div className="text-[10px] text-slate-500">
                  Emitido por: <span className="font-medium text-slate-700">{userName}</span>
                </div>
              </div>
            </div>

            {/* Aviso LGPD */}
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[9px] text-amber-800 font-medium">
              ⚠️ Documento protegido — dados pessoais omitidos conforme LGPD (Lei 13.709/2018). Uso
              restrito à instituição emissora.
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-2.5 mb-4">
              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50">
                <div className="text-[10px] font-bold text-blue-800 uppercase">Total Contratos</div>
                <div className="text-sm font-black text-blue-700 mt-1">{stats.total}</div>
                <div className="text-[9px] text-blue-600 mt-0.5">Registros</div>
              </div>
              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">Ativos</div>
                <div className="text-sm font-black text-emerald-700 mt-1">{stats.ativos}</div>
                <div className="text-[9px] text-emerald-600 mt-0.5">Planos vigentes</div>
              </div>
              <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50">
                <div className="text-[10px] font-bold text-rose-800 uppercase">Inadimplentes</div>
                <div className="text-sm font-black text-rose-700 mt-1">{stats.inadimplentes}</div>
                <div className="text-[9px] text-rose-600 mt-0.5">Em atraso</div>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="text-[10px] font-bold text-slate-600 uppercase">Encerrados</div>
                <div className="text-sm font-black text-slate-600 mt-1">{stats.encerrados}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">Inativos</div>
              </div>
              <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50">
                <div className="text-[10px] font-bold text-purple-800 uppercase">Mensalidades</div>
                <div className="text-xs font-black text-purple-700 mt-1">
                  {formatCurrency(stats.totalMensalidades)}
                </div>
                <div className="text-[9px] text-purple-600 mt-0.5">Total/mês</div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2 px-2 text-center w-[3%] border-r border-slate-700">#</th>
                    <th className="py-2 px-3 w-[30%] border-r border-slate-700">
                      Associado / Contrato
                    </th>
                    <th className="py-2 px-3 w-[20%] border-r border-slate-700">Plano PAX</th>
                    <th className="py-2 px-2 text-center w-[6%] border-r border-slate-700">
                      Vidas
                    </th>
                    <th className="py-2 px-2 text-center w-[11%] border-r border-slate-700">
                      Adesão
                    </th>
                    <th className="py-2 px-3 text-right w-[14%] border-r border-slate-700">
                      Mensalidade
                    </th>
                    <th className="py-2 px-2 text-center w-[10%]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {associados.map((a, idx) => {
                    const statusColor =
                      a.status === 'ativo'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : a.status === 'inadimplente'
                          ? 'text-rose-700 bg-rose-50 border-rose-200'
                          : 'text-slate-600 bg-slate-100 border-slate-300';
                    return (
                      <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-2 text-center font-bold text-slate-500 border-r border-slate-200 text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200">
                          <div className="font-bold text-slate-900 text-xs">{a.nome}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            <span className="font-mono bg-slate-100 px-1 rounded">
                              {a.numero_contrato || 'S/N'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200">
                          <span className="font-semibold text-emerald-800 text-[11px]">
                            {getPlanoNome(a.plano_pax_id)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-purple-700 border-r border-slate-200 text-[11px]">
                          {a.n_vidas || 1}
                        </td>
                        <td className="py-2 px-2 text-center font-medium text-slate-900 border-r border-slate-200 text-[11px]">
                          {a.data_adesao ? formatLocalDate(a.data_adesao) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-blue-700 border-r border-slate-200 text-[11px]">
                          {formatCurrency(a.valor_plano)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${statusColor}`}
                          >
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-400">
                    <td
                      colSpan={5}
                      className="py-2.5 px-3 text-right text-xs uppercase tracking-wide"
                    >
                      Total de Contratos: {associados.length} registros
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs font-black text-blue-700">
                      {formatCurrency(stats.totalMensalidades)}/mês
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-center text-[10px] text-slate-500">
              <div>
                <strong>Sistema ERAS PAX Taquari</strong> — Gestão de Contratos e Planos
              </div>
              <div>
                Documento emitido eletronicamente em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
              </div>
              <div>Página 1 de 1</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
