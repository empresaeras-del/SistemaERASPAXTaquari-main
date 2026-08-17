import React, { useState, useEffect } from 'react';
import { Users, 
  Plus, Search, Building2, MapPin, MoreVertical, 
  ShieldCheck, FileText, Banknote, Link, Download, Printer, 
  Filter, LayoutGrid, List, CheckCircle2, XCircle, 
  AlertOctagon, RefreshCw, Eye, Pencil, Trash2,
  Phone, Mail, User, Stethoscope, HeartPulse, X
} from 'lucide-react';
import { AdvancedFilterBar } from '../components/layout/AdvancedFilterBar';
import { useCredenciados } from '../hooks/useCredenciados';
import { CredenciadoInsert, CredenciadoUpdate, CredenciadoStatus } from '../types/credenciados';
import { usePlanosPax } from '../hooks/usePlanosPax';
import { useProcedimentos } from '../hooks/useProcedimentos';
import { ProcedimentosCredenciado } from '../components/credenciados/ProcedimentosCredenciado';
import { exportToPDF, exportFichasToPDF } from "../lib/pdfExport";
import { isValidCPFOrCNPJ, maskCPFOrCNPJ } from "../utils/validators";
import { getEmpresaById } from "../services/empresasService";
import { useAppContext } from "../context/AppContext";
import { useConfirm } from '../context/ConfirmContext';
import toast from 'react-hot-toast';

export const CredenciadosPage: React.FC = () => {
  const { state } = useAppContext();
  const { 
    credenciados, 
    loading, 
    criar, 
    editar, 
    vincularPlano, 
    buscarPlanosVinculados, 
    vincularProcedimento, 
    desvincularProcedimento, 
    atualizarValorProcedimento, 
    buscarProcedimentosVinculados 
  } = useCredenciados();
  
  const { planos } = usePlanosPax();
  const { confirm } = useConfirm();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ramoFilter, setRamoFilter] = useState('todos');
  
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  const [activeTab, setActiveTab] = useState<'dados' | 'procedimentos'>('dados');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCredenciado, setSelectedCredenciado] = useState<any>(null);
  
  const [planosVinculados, setPlanosVinculados] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState<Partial<CredenciadoInsert>>({
    razao_social: '',
    nome_fantasia: '',
    cnpj_cpf: '',
    ramo_atividade: 'clinica_medica',
    status: 'ativo'
  });

  const [linkData, setLinkData] = useState({
    plano_pax_id: '',
    percentual_desconto: 0,
    valor_coparticipacao: 0,
    carencia_dias: 0
  });

  // Filters
  const filtered = credenciados.filter(c => {
    const matchesSearch = c.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.cnpj_cpf.includes(searchTerm) ||
                          (c.nome_fantasia || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? c.status === statusFilter : true;
    const matchesRamo = ramoFilter !== 'todos' ? c.ramo_atividade === ramoFilter : true;
    return matchesSearch && matchesStatus && matchesRamo;
  });

  // KPI calculations
  const totalCredenciados = credenciados.length;
  const totalAtivos = credenciados.filter(c => c.status === 'ativo').length;
  const totalClinicas = credenciados.filter(c => c.ramo_atividade.includes('clinica') || c.ramo_atividade.includes('hospital')).length;
  const totalProfissionais = credenciados.filter(c => c.ramo_atividade.includes('medico') || c.ramo_atividade.includes('dentista') || c.ramo_atividade.includes('psicologo')).length;

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({ razao_social: '', cnpj_cpf: '', ramo_atividade: 'clinica_medica', status: 'ativo' });
    setIsFormOpen(true);
    setActiveTab('dados');
  };

  const handleEdit = (cred: any) => {
    setFormData(cred);
    setEditingId(cred.id);
    setIsFormOpen(true);
    setActiveTab('dados');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCPFOrCNPJ(formData.cnpj_cpf || '')) {
      toast.error('CPF ou CNPJ inválido.');
      return;
    }
    try {
      const { id, created_at, updated_at, empresa_id, ...dataToSave } = formData as any;
      if (editingId) {
        await editar(editingId, dataToSave as CredenciadoUpdate);
        toast.success('Credenciado atualizado com sucesso!');
      } else {
        await criar(dataToSave as CredenciadoInsert);
        toast.success('Credenciado criado com sucesso!');
      }
      setIsFormOpen(false);
      setFormData({
        razao_social: '',
        nome_fantasia: '',
        cnpj_cpf: '',
        ramo_atividade: 'clinica_medica',
        status: 'ativo'
      });
      setEditingId(null);
    } catch (err) {
      console.error(err); toast.error(err instanceof Error ? err.message : "Erro ao salvar credenciado");
    }
  };

  const handleOpenLinkModal = async (cred: any) => {
    setSelectedCredenciado(cred);
    setLinkData({
      plano_pax_id: planos[0]?.id || '',
      percentual_desconto: 0,
      valor_coparticipacao: 0,
      carencia_dias: 0
    });
    setIsLinkOpen(true);
    const vinculados = await buscarPlanosVinculados(cred.id);
    setPlanosVinculados(vinculados);
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await vincularPlano({
        credenciado_id: selectedCredenciado.id,
        plano_pax_id: linkData.plano_pax_id,
        percentual_desconto: linkData.percentual_desconto,
        valor_coparticipacao: linkData.valor_coparticipacao,
        carencia_dias: linkData.carencia_dias
      });
      toast.success('Plano vinculado com sucesso!');
      const vinculados = await buscarPlanosVinculados(selectedCredenciado.id);
      setPlanosVinculados(vinculados);
    } catch (err) {
      toast.error("Erro ao vincular plano (pode já estar vinculado)");
    }
  };

  const handleExportPDF = async () => {
    const tenantId = state.empresaSelecionada || 'default_tenant';
    const empresa = await getEmpresaById(tenantId, state.isOnline);
    const columns = ["Razão Social", "Documento", "Ramo", "Status"];
    const data = filtered.map(c => [
      c.razao_social,
      c.cnpj_cpf,
      c.ramo_atividade.replace('_', ' ').toUpperCase(),
      c.status.toUpperCase()
    ]);
    await exportToPDF("Relatório de Rede Credenciada", columns, data, "credenciados_export", empresa?.logo_url);
    toast.success('PDF exportado com sucesso!');
  };

  const handlePrintFichas = async () => {
    const tenantId = state.empresaSelecionada || 'default_tenant';
    const empresa = await getEmpresaById(tenantId, state.isOnline);
    
    if (filtered.length === 0) {
      toast.error('Nenhum credenciado para exportar');
      return;
    }
    
    toast.success(`Gerando fichas de ${filtered.length} credenciado(s)...`);
    await exportFichasToPDF("Fichas de Credenciados", filtered, "fichas_credenciados", empresa?.logo_url);
  };


  const getStatusBadge = (status: CredenciadoStatus) => {
    switch (status) {
      case 'ativo':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Ativo
          </span>
        );
      case 'descredenciado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <XCircle className="w-3 h-3" />
            Descredenciado
          </span>
        );
      case 'bloqueado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertOctagon className="w-3 h-3" />
            Bloqueado
          </span>
        );
      default:
        return null;
    }
  };

  const getRamoList = () => {
    const ramos = credenciados.map(c => c.ramo_atividade);
    return [...new Set(ramos)].filter(Boolean);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      
      {/* HEADER PAGE TITLE & BREADCRUMB */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-subtle mb-1">
            <span>Administração</span>
            <span>/</span>
            <span className="text-[#3B82F6] font-semibold">Rede Credenciada</span>
          </div>
          <h1 className="text-2xl font-bold text-text-base tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-[#3B82F6]" />
            <span>Gestão de Rede Credenciada</span>
          </h1>
          <p className="text-xs text-text-subtle mt-1">
            Cadastre e gerencie os parceiros e profissionais de saúde.
          </p>
        </div>
        
        {/* PRIMARY ACTIONS */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePrintFichas}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-bg-surface text-text-base border border-border-default rounded-xl text-xs font-semibold hover:bg-bg-hover transition-colors shadow-sm"
            title="Imprimir Fichas Cadastrais (PDF)"
          >
            <Printer className="w-4 h-4 text-text-subtle" />
            <span>Imprimir Fichas</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-bg-surface text-text-base border border-border-default rounded-xl text-xs font-semibold hover:bg-bg-hover transition-colors shadow-sm"
            title="Exportar credenciados em PDF"
          >
            <Download className="w-4 h-4 text-text-subtle" />
            <span>Exportar PDF</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-blue-400 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Credenciado</span>
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Total de Cadastros</p>
            <p className="text-xl font-extrabold text-text-base mt-0.5">{totalCredenciados}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Credenciados Ativos</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{totalAtivos}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 shrink-0">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Clínicas/Hospitais</p>
            <p className="text-xl font-extrabold text-blue-400 mt-0.5">{totalClinicas}</p>
          </div>
        </div>

        <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20 shrink-0">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-subtle">Profissionais Saúde</p>
            <p className="text-xl font-extrabold text-purple-400 mt-0.5">{totalProfissionais}</p>
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
            placeholder="Buscar por razão social, nome fantasia, CNPJ/CPF..."
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
            value={ramoFilter}
            onChange={(e) => setRamoFilter(e.target.value)}
            className="bg-bg-subtle border border-border-default rounded-xl px-3 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]"
          >
            <option value="todos">Todos os Ramos</option>
            {getRamoList().map(ramo => (
              <option key={ramo} value={ramo}>{ramo.replace(/_/g, ' ').toUpperCase()}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-bg-subtle border border-border-default rounded-xl px-3 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]"
          >
            <option value="">Todos os Status</option>
            <option value="ativo">Ativos</option>
            <option value="bloqueado">Bloqueados</option>
            <option value="descredenciado">Descredenciados</option>
          </select>
        </div>

        {/* VIEW MODE TOGGLES */}
        <div className="flex items-center gap-2 border-l border-border-default pl-4">
          <div className="flex items-center bg-bg-subtle border border-border-default rounded-xl p-1">
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
        </div>
      </div>

      {/* CONTENT: GRID OR TABLE */}
      {loading ? (
        <div className="py-20 text-center text-text-subtle flex flex-col items-center">
          <div className="w-8 h-8 border-3 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-medium">Carregando lista de credenciados...</p>
        </div>
      ) : credenciados.length === 0 ? (
        <div className="py-20 text-center bg-bg-surface border border-border-default rounded-3xl p-8 space-y-3">
          <Building2 className="w-12 h-12 text-text-subtle mx-auto opacity-50" />
          <h3 className="text-base font-bold text-text-base">Nenhum credenciado encontrado</h3>
          <p className="text-xs text-text-subtle max-w-md mx-auto">
            Não encontramos nenhum credenciado ou prestador cadastrado com os filtros aplicados.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#3B82F6] text-white rounded-xl text-xs font-semibold hover:bg-[#3B82F6]/90 transition-colors mt-2"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Credenciado
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(cred => (
            <div
              key={cred.id}
              className="bg-bg-surface border border-border-default rounded-2xl p-5 hover:border-[#3B82F6]/50 transition-all shadow-sm hover:shadow-md flex flex-col justify-between group"
            >
              <div>
                {/* CARD HEADER */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {getStatusBadge(cred.status)}
                    </div>
                    <h3 className="text-base font-bold text-text-base mt-1.5 group-hover:text-[#3B82F6] transition-colors line-clamp-1">
                      {cred.nome_fantasia || cred.razao_social}
                    </h3>
                    {cred.nome_fantasia && (
                      <p className="text-xs text-text-subtle line-clamp-1">{cred.razao_social}</p>
                    )}
                  </div>

                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-bg-subtle text-text-subtle border border-border-default shrink-0">
                    {cred.ramo_atividade.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {/* DETAILS LIST */}
                <div className="space-y-1.5 text-xs text-text-muted my-3 border-t border-border-default/50 pt-3">
                  <p className="flex items-center gap-2">
                    <strong className="text-text-subtle min-w-[70px]">CNPJ/CPF:</strong>
                    <span className="font-mono text-text-base">{cred.cnpj_cpf}</span>
                  </p>
                  
                  {cred.telefone && (
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                      <span>{cred.telefone}</span>
                    </p>
                  )}
                  {cred.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                      <span className="truncate">{cred.email}</span>
                    </p>
                  )}
                  {(cred.cidade || cred.estado) && (
                    <p className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                      <span>{cred.cidade} {cred.estado ? `/ ${cred.estado}` : ''}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* CARD FOOTER ACTIONS */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-default">
                <button
                  onClick={() => handleOpenLinkModal(cred)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-bg-subtle hover:bg-[#3B82F6]/10 hover:text-[#3B82F6] text-text-base rounded-xl text-xs font-semibold border border-border-default transition-colors"
                >
                  <Link className="w-3.5 h-3.5" />
                  Planos
                </button>
                <button
                  onClick={() => handleEdit(cred)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-bg-subtle hover:bg-emerald-500/10 hover:text-emerald-500 text-text-base rounded-xl text-xs font-semibold border border-border-default transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
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
                <tr className="bg-bg-subtle border-b border-border-default">
                  <th className="px-5 py-3.5 text-xs font-semibold text-text-subtle uppercase tracking-wider">Razão Social / Nome</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-text-subtle uppercase tracking-wider">Documento</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-text-subtle uppercase tracking-wider">Ramo</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-text-subtle uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-text-subtle uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {filtered.map((cred) => (
                  <tr key={cred.id} className="hover:bg-bg-subtle/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-bg-subtle flex items-center justify-center border border-border-default group-hover:border-[#3B82F6]/30 group-hover:bg-[#3B82F6]/10 transition-colors">
                          <Building2 className="w-4 h-4 text-text-subtle group-hover:text-[#3B82F6]" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-text-base group-hover:text-[#3B82F6] transition-colors line-clamp-1">
                            {cred.nome_fantasia || cred.razao_social}
                          </div>
                          {cred.nome_fantasia && (
                            <div className="text-xs text-text-subtle line-clamp-1">{cred.razao_social}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-text-muted">{cred.cnpj_cpf}</td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-bg-subtle text-text-subtle font-medium border border-border-default text-xs whitespace-nowrap">
                        {cred.ramo_atividade.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {getStatusBadge(cred.status)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenLinkModal(cred)}
                          className="p-2 text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors"
                          title="Vincular Planos"
                        >
                          <Link className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(cred)}
                          className="p-2 text-text-subtle hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Editar/Ver Procedimentos"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FORM MODAL (Dados / Procedimentos) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4 sm:p-6">
          <div className="bg-bg-base rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-border-default overflow-hidden">
            <div className="bg-bg-subtle p-6 border-b border-border-default flex flex-col md:flex-row md:items-center justify-between shrink-0 relative overflow-hidden gap-4">
              <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/5 to-transparent" />
              <div className="flex items-center gap-3 z-10">
                <div className="w-10 h-10 bg-bg-surface border border-border-default rounded-xl flex items-center justify-center shadow-sm">
                  <Building2 className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-base">
                    {editingId ? 'Editar Credenciado' : 'Novo Credenciado'}
                  </h3>
                  {editingId && (
                    <p className="text-xs text-text-muted mt-0.5">ID: <span className="font-mono">{editingId.split('-')[0]}</span></p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between md:justify-end gap-3 z-10 w-full md:w-auto">
                {editingId && (
                  <div className="flex bg-bg-surface rounded-xl p-1 border border-border-default w-full md:w-auto overflow-x-auto custom-scrollbar">
                    <button
                      onClick={() => setActiveTab('dados')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-1 md:flex-none ${activeTab === 'dados' ? 'bg-bg-hover text-text-base shadow-sm border border-border-default' : 'text-text-subtle hover:text-text-base'}`}
                    >
                      Dados Básicos
                    </button>
                    <button
                      onClick={() => setActiveTab('procedimentos')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-1 md:flex-none ${activeTab === 'procedimentos' ? 'bg-bg-hover text-[#3B82F6] shadow-sm border border-[#3B82F6]/20' : 'text-text-subtle hover:text-[#3B82F6]'}`}
                    >
                      Tabela de Valores
                    </button>
                  </div>
                )}
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 text-text-subtle hover:text-rose-400 bg-bg-surface rounded-xl border border-border-default hover:border-rose-500/30 transition-colors shrink-0 hidden md:block"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-bg-base relative">
              {activeTab === 'dados' ? (
                <div className="p-6 md:p-8">
                  <form id="credenciadoForm" onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-10">
                    
                    {/* Identificação Principal */}
                    <section>
                      <h4 className="text-sm font-bold text-text-base uppercase tracking-wider mb-5 flex items-center gap-2">
                        <span className="w-6 h-px bg-border-default"></span>
                        Identificação Principal
                        <span className="flex-1 h-px bg-border-default"></span>
                      <span className="flex-1 h-px bg-border-default"></span></h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="block text-sm font-semibold text-text-subtle">Razão Social *</label>
                          <input 
                            required 
                            value={formData.razao_social || ''}
                            onChange={e => setFormData({...formData, razao_social: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                            placeholder="Nome legal da empresa"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-sm font-semibold text-text-subtle">Nome Fantasia</label>
                          <input 
                            value={formData.nome_fantasia || ''}
                            onChange={e => setFormData({...formData, nome_fantasia: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                            placeholder="Como é conhecido no mercado"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-sm font-semibold text-text-subtle">CNPJ / CPF *</label>
                                                    <input 
                            required 
                            value={formData.cnpj_cpf || ''}
                            onChange={e => setFormData({...formData, cnpj_cpf: maskCPFOrCNPJ(e.target.value)})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all font-mono placeholder:font-sans" 
                            placeholder="00.000.000/0000-00"
                          />
                        </div>
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-semibold text-text-subtle mb-1.5">E-mail</label>
                                <input 
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-text-subtle mb-1.5">Telefone Principal</label>
                                <input 
                                    value={formData.telefone || ''}
                                    onChange={e => setFormData({...formData, telefone: e.target.value})}
                                    className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                                />
                            </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">Ramo de Atividade *</label>
                          <select 
                            required 
                            value={formData.ramo_atividade || 'clinica_medica'}
                            onChange={e => setFormData({...formData, ramo_atividade: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                          >
                            <option value="clinica_medica">Clínica Médica</option>
                            <option value="laboratorio">Laboratório</option>
                            <option value="hospital">Hospital</option>
                            <option value="farmacia">Farmácia</option>
                            <option value="odontologia">Odontologia</option>
                            <option value="fisioterapia">Fisioterapia</option>
                            <option value="psicologia">Psicologia</option>
                            <option value="medico_independente">Médico(a) Independente</option>
                            <option value="outros">Outros</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">Status</label>
                          <select 
                            value={formData.status || 'ativo'}
                            onChange={e => setFormData({...formData, status: e.target.value as any})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                          >
                            <option value="ativo">Ativo</option>
                            <option value="bloqueado">Bloqueado</option>
                            <option value="descredenciado">Descredenciado</option>
                          </select>
                        </div>
                      </div>
                    </section>


                    {/* Responsável e Contato */}
                    <section>
                      <h4 className="text-sm font-bold text-text-base uppercase tracking-wider mb-5 flex items-center gap-2"><span className="w-6 h-px bg-border-default"></span>
                        <Users className="w-4 h-4" /> Responsável
                      <span className="flex-1 h-px bg-border-default"></span></h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">Nome do Responsável</label>
                          <input 
                            value={formData.responsavel_nome || ''}
                            onChange={e => setFormData({...formData, responsavel_nome: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">Telefone do Responsável</label>
                          <input 
                            value={formData.responsavel_telefone || ''}
                            onChange={e => setFormData({...formData, responsavel_telefone: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                          />
                        </div>
                      </div>
                    </section>

                    {/* Endereço */}
                    <section>
                      <h4 className="text-sm font-bold text-text-base uppercase tracking-wider mb-5 flex items-center gap-2"><span className="w-6 h-px bg-border-default"></span>
                        <MapPin className="w-4 h-4" /> Endereço Completo
                      <span className="flex-1 h-px bg-border-default"></span></h4>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                        <div className="md:col-span-3">
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">CEP</label>
                          <input 
                            value={formData.cep || ''}
                            onChange={e => setFormData({...formData, cep: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                          />
                        </div>
                        <div className="md:col-span-7">
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">Endereço</label>
                          <input 
                            value={formData.endereco || ''}
                            onChange={e => setFormData({...formData, endereco: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">Número</label>
                          <input 
                            value={formData.numero || ''}
                            onChange={e => setFormData({...formData, numero: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">Complemento</label>
                          <input 
                            value={formData.complemento || ''}
                            onChange={e => setFormData({...formData, complemento: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">Bairro</label>
                          <input 
                            value={formData.bairro || ''}
                            onChange={e => setFormData({...formData, bairro: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">Cidade</label>
                          <input 
                            value={formData.cidade || ''}
                            onChange={e => setFormData({...formData, cidade: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                          />
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">UF</label>
                          <input 
                            value={formData.estado || ''}
                            onChange={e => setFormData({...formData, estado: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                            maxLength={2}
                          />
                        </div>
                      </div>
                    </section>

                    {/* Dados Bancários */}
                    <section>
                      <h4 className="text-sm font-bold text-text-base uppercase tracking-wider mb-5 flex items-center gap-2"><span className="w-6 h-px bg-border-default"></span>
                        <Banknote className="w-4 h-4" /> Dados Bancários
                      <span className="flex-1 h-px bg-border-default"></span></h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">Banco</label>
                          <input 
                            value={formData.banco || ''}
                            onChange={e => setFormData({...formData, banco: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-text-subtle mb-1.5">Chave PIX</label>
                          <input 
                            value={formData.chave_pix || ''}
                            onChange={e => setFormData({...formData, chave_pix: e.target.value})}
                            className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all" 
                          />
                        </div>
                      </div>
                    </section>
                  </form>
                </div>
              ) : (
                <ProcedimentosCredenciado 
                  credenciadoId={editingId!}
                  vincularProcedimento={vincularProcedimento}
                  desvincularProcedimento={desvincularProcedimento}
                  atualizarValorProcedimento={atualizarValorProcedimento}
                  buscarProcedimentosVinculados={buscarProcedimentosVinculados}
                />
              )}
            </div>
            
            {activeTab === 'dados' && (
              <div className="p-6 border-t border-border-default bg-bg-surface/50 flex justify-end gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-text-muted hover:text-text-base hover:bg-white/5 transition-colors font-medium text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  form="credenciadoForm"
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors shadow-lg shadow-[#3B82F6]/20 text-sm flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Salvar Credenciado
                </button>
              </div>
            )}
            
          </div>
        </div>
      )}
      
      {/* LINK MODAL */}
      {isLinkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4">
          <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-border-default overflow-hidden">
            <div className="p-6 border-b border-border-default flex items-center justify-between">
              <h3 className="text-xl font-bold text-text-base flex items-center gap-2">
                <Link className="w-5 h-5 text-[#3B82F6]" />
                Vincular Planos - {selectedCredenciado?.nome_fantasia || selectedCredenciado?.razao_social}
              </h3>
              <button 
                onClick={() => setIsLinkOpen(false)}
                className="p-2 text-text-subtle hover:text-text-base bg-bg-surface rounded-lg border border-border-default transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              {/* Form to link new plan */}
              <form id="linkForm" onSubmit={handleLinkSubmit} className="space-y-4">
                <h4 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Adicionar Novo Vínculo<span className="flex-1 h-px bg-border-default"></span></h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-text-subtle mb-1.5">Selecione o Plano Pax</label>
                    <select
                      required
                      value={linkData.plano_pax_id}
                      onChange={e => setLinkData({...linkData, plano_pax_id: e.target.value})}
                      className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                    >
                      <option value="" disabled>Selecione um plano...</option>
                      {planos.map(p => (
                        <option key={p.id} value={p.id}>{p.nome} ({p.codigo})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-subtle mb-1.5">% de Desconto</label>
                    <input
                      type="number"
                      step="0.01"
                      value={linkData.percentual_desconto}
                      onChange={e => setLinkData({...linkData, percentual_desconto: Number(e.target.value)})}
                      className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-subtle mb-1.5">Coparticipação (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={linkData.valor_coparticipacao}
                      onChange={e => setLinkData({...linkData, valor_coparticipacao: Number(e.target.value)})}
                      className="w-full px-4 py-3 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button 
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white font-medium transition-colors shadow-lg shadow-[#3B82F6]/20 text-sm flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Vincular Plano
                  </button>
                </div>
              </form>

              {/* List of currently linked plans */}
              <div>
                <h4 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4 border-b border-border-default pb-2">Planos Já Vinculados<span className="flex-1 h-px bg-border-default"></span></h4>
                {planosVinculados.length === 0 ? (
                  <div className="text-center py-6 bg-bg-surface rounded-xl border border-border-default">
                    <p className="text-text-subtle text-sm">Nenhum plano vinculado a este credenciado.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {planosVinculados.map((vinculo) => (
                      <div key={vinculo.id} className="bg-bg-surface border border-border-default rounded-xl p-4 flex justify-between items-center shadow-sm">
                        <div>
                          <div className="font-bold text-text-base">{vinculo?.planos_pax?.nome || 'Plano'}</div>
                          <div className="text-xs text-text-subtle mt-1.5 flex gap-4">
                            <span className="bg-bg-subtle px-2 py-0.5 rounded border border-border-default">Desconto: <strong className="text-emerald-400">{vinculo.percentual_desconto}%</strong></span>
                            <span className="bg-bg-subtle px-2 py-0.5 rounded border border-border-default">Coparticipação: <strong className="text-[#3B82F6]">R$ {vinculo.valor_coparticipacao}</strong></span>
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
      )}
    </div>
  );
};
