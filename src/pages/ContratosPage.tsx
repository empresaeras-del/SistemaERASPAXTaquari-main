import React, { useState, useEffect, useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { getAssociados, Associado } from "../services/associadosService";
import { getEmpresas, Empresa } from "../services/empresasService";
import { supabase } from "../lib/supabase";
import { 
  Search, Filter, FileText, Download, LayoutGrid, List,
  Users, CheckCircle2, AlertCircle, XCircle, CreditCard,
  Calendar, Eye, ChevronRight, GitFork, Network,
  Printer, Plus 
} from "lucide-react";
import { usePlanosPax } from "../hooks/usePlanosPax";
import { formatLocalDate } from "../utils/dateUtils";
import { canEditContratos, alertPermissionRestriction } from "../utils/permissions";

import { NovoContratoWizard } from "../components/contratos/NovoContratoWizard";
import { OrganogramaContratosCanvas } from "../components/contratos/OrganogramaContratosCanvas";
import { AssociadoDetailsModal } from "../components/associados/AssociadoDetailsModal";

export const ContratosPage: React.FC = () => {
  const { state } = useAppContext();
  const { planosAtivos: planos, calcularValor, planos: planosCompletos } = usePlanosPax();
  
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [planoFilter, setPlanoFilter] = useState("todos");
  const [viewMode, setViewMode] = useState<"organograma" | "table" | "grid">("organograma");
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const [selectedAssociadoDetails, setSelectedAssociadoDetails] = useState<Associado | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, empresasList] = await Promise.all([
        getAssociados(state.isOnline, state.empresaSelecionada),
        getEmpresas(state.isOnline)
      ]);
      setEmpresas(empresasList || []);
      // Associados vinculados a um plano
      const comContrato = data.filter(a => a.plano_pax_id);
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
            const cTenantId = (assoc.tenant_id && assoc.tenant_id !== 'all') ? assoc.tenant_id : 'default_tenant';
            const cPlanoId = assoc.plano_pax_id && UUID_REGEX.test(assoc.plano_pax_id) ? assoc.plano_pax_id : null;
            const cDataInicio = (assoc.data_adesao && String(assoc.data_adesao).trim() !== '') 
              ? String(assoc.data_adesao).split('T')[0] 
              : new Date().toISOString().split('T')[0];

            const contratoData = {
              tenant_id: cTenantId,
              empresa_id: (assoc as any).empresa_id || cTenantId,
              associado_id: assoc.id,
              plano_pax_id: cPlanoId,
              numero_contrato: assoc.numero_contrato || `CTR-${assoc.id.substring(0, 8).toUpperCase()}`,
              data_inicio: cDataInicio,
              valor_mensalidade: Number(assoc.valor_plano) || 0,
              status: assoc.status || 'ativo',
              observacoes: (assoc as any).observacoes || null
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
        a.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.cpf.includes(searchTerm);
      const matchesStatus = statusFilter !== 'todos' ? a.status === statusFilter : true;
      const matchesPlano = planoFilter !== 'todos' ? a.plano_pax_id === planoFilter : true;
      
      return matchesSearch && matchesStatus && matchesPlano;
    });
  }, [associados, searchTerm, statusFilter, planoFilter]);

  const stats = useMemo(() => {
    return {
      total: associados.length,
      ativos: associados.filter(a => a.status === 'ativo').length,
      inadimplentes: associados.filter(a => a.status === 'inadimplente').length,
      inativos: associados.filter(a => a.status === 'inativo').length,
    };
  }, [associados]);

  const exportarCSV = () => {
    if (filtered.length === 0) return;
    
    const headers = ["Contrato", "Nome", "CPF", "Plano", "Vidas", "Status", "Data Adesão", "Valor (R$)"];
    const rows = filtered.map(a => {
      const planoNome = planos.find(p => p.id === a.plano_pax_id)?.nome || "Desconhecido";
      const valor = a.valor_plano ? a.valor_plano.toFixed(2).replace(".", ",") : "0,00";
      return [
        a.numero_contrato || '' || a.id.substring(0, 8),
        a.nome,
        a.cpf,
        planoNome,
        a.n_vidas?.toString() || "1",
        a.status,
        a.data_adesao ? formatLocalDate(a.data_adesao) : "",
        valor
      ].join(";");
    });
    
    const csvContent = [headers.join(";"), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `contratos_${new Date().toISOString().split('T')[0]}.csv`);
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
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-bg-surface text-text-base border border-border-default rounded-xl text-xs font-semibold hover:bg-bg-hover transition-colors shadow-sm"
            title="Exportar listagem para PDF"
          >
            <Printer className="w-4 h-4 text-text-subtle" />
            <span>Exportar PDF</span>
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
              : empresas.find(e => e.id === state.empresaSelecionada)?.nome_fantasia ||
                empresas.find(e => e.id === state.empresaSelecionada)?.razao_social ||
                'PAX & Funerária Taquari'
          }
          statusFilter={statusFilter}
          planoFilter={planoFilter}
          onSelectAssociado={(assoc) => setSelectedAssociadoDetails(assoc)}
        />
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(a => (
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
                    <h3 className="text-base font-bold text-text-base group-hover:text-[#3B82F6] transition-colors line-clamp-1" title={a.nome}>
                      {a.nome}
                    </h3>
                  </div>
                </div>

                {/* BADGES */}
                <div className="flex items-center gap-2 my-3 flex-wrap text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] font-semibold border border-[#3B82F6]/20 truncate max-w-[150px]" title={planos.find(p => p.id === a.plano_pax_id)?.nome || "Desconhecido"}>
                    {planos.find(p => p.id === a.plano_pax_id)?.nome || "Desconhecido"}
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
                      R$ {a.valor_plano ? a.valor_plano.toFixed(2).replace('.', ',') : "0,00"}
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
                {filtered.map(a => (
                  <tr
                    key={a.id}
                    className="hover:bg-bg-subtle/50 transition-colors group"
                  >
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-text-base group-hover:text-[#3B82F6] transition-colors">{a.nome}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-text-muted font-mono bg-bg-subtle px-1.5 py-0.5 rounded border border-border-default">{a.numero_contrato || '' || 'S/C'}</span>
                          <span className="text-xs text-text-subtle">{a.cpf}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 truncate max-w-[150px]">
                        {planos.find(p => p.id === a.plano_pax_id)?.nome || "Desconhecido"}
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
                        R$ {a.valor_plano ? a.valor_plano.toFixed(2).replace('.', ',') : "0,00"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-center">
                        {getStatusBadge(a.status)}
                      </div>
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
    </div>
  );
};
