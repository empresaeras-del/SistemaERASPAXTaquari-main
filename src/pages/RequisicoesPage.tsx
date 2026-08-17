import { useSearchParams, useNavigate } from "react-router-dom";
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  Requisicao, 
  RequisicaoItem, 
  StatusRequisicao, 
  TipoPrestador, 
  FiltroRequisicoes 
} from '../types/requisicoes';
import { 
  getRequisicoes, 
  criarRequisicao, atualizarRequisicao, 
  atualizarStatusRequisicao, 
  gerarPDFGuiaRequisicao 
} from '../services/requisicoesService';
import { getAssociados, Associado, Dependente } from '../services/associadosService';
import { getEmpresaById } from '../services/empresasService';
import { useCredenciados } from '../hooks/useCredenciados';
import { useProcedimentos } from '../hooks/useProcedimentos';
import { 
  FileCheck2, 
  Plus, 
  Search, 
  Filter, 
  Users, 
  Building2, 
  Stethoscope, 
  Calendar, 
  Printer, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  ChevronRight, 
  Trash2, 
  X, 
  Info, 
  FileText, 
  ShieldCheck, 
  UserCheck, 
  BadgePercent,
  Pencil,
  Download,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { getRemessas } from '../services/faturamentoService';
import { salvarReceita, Receita, ParcelaReceber } from '../services/financeiroService';
import { canDelete } from '../utils/permissions';

export const RequisicoesPage: React.FC = () => {
  const { state } = useAppContext();
  const { credenciados, buscarProcedimentosVinculados } = useCredenciados();
  const { procedimentos: todosProcedimentos } = useProcedimentos();

  // Main Data States
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filtros, setFiltros] = useState<FiltroRequisicoes>({
    busca: '',
    status: '',
    tipoPrestador: '',
    associadoId: '',
    credenciadoId: ''
  });

  // Modal States
  const [modalNovaGuia, setModalNovaGuia] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState<Requisicao | null>(null);
  const [modalCancelar, setModalCancelar] = useState<Requisicao | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  // Form State for New Requisition
  const [selAssociadoId, setSelAssociadoId] = useState('');
  const [selPacienteTipo, setSelPacienteTipo] = useState<'titular' | 'dependente'>('titular');
  const [selDependenteId, setSelDependenteId] = useState('');

  const [tipoPrestador, setTipoPrestador] = useState<TipoPrestador>('credenciado');
  const [selCredenciadoId, setSelCredenciadoId] = useState('');
  const [redeExternaNome, setRedeExternaNome] = useState('');
  const [redeExternaCnpj, setRedeExternaCnpj] = useState('');

  const [medicoSolicitante, setMedicoSolicitante] = useState('');
  const [crmSolicitante, setCrmSolicitante] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Procedure Selection inside Modal
  const [procedimentosVinculados, setProcedimentosVinculados] = useState<any[]>([]);
  const [loadingProcs, setLoadingProcs] = useState(false);
  const [selProcedimentoId, setSelProcedimentoId] = useState('');
  const [qtdProc, setQtdProc] = useState(1);
  const [valorCustomProc, setValorCustomProc] = useState<number | ''>('');
  const [coparticipacaoCustomProc, setCoparticipacaoCustomProc] = useState<number | ''>('');

  // Cart of procedures in creation
  const [itensGuia, setItensGuia] = useState<RequisicaoItem[]>([]);
  const [editingRequisicao, setEditingRequisicao] = useState<any>(null);
  const [modalReabrir, setModalReabrir] = useState<{ req: any, targetStatus: 'autorizada' | 'emitida' } | null>(null);
  const [motivoReabertura, setMotivoReabertura] = useState('');

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const tenantId = state.empresaSelecionada || 'all';
      const reqs = await getRequisicoes(state.isOnline, tenantId);
      const assocs = await getAssociados(state.isOnline, tenantId);

      setRequisicoes(reqs);
      setAssociados(assocs.filter(a => a.status === 'ativo'));
    } catch (e) {
      console.error('Erro ao carregar requisições:', e);
      toast.error('Erro ao carregar dados do módulo de requisições.');
    } finally {
      setLoading(false);
    }
  };

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  // Handle URL Params for creating new requisition
  useEffect(() => {
    if (associados.length > 0) {
      const pAssociadoId = searchParams.get('associadoId');
      const pAction = searchParams.get('action');
      
      if (pAction === 'new' && pAssociadoId) {
        setSelAssociadoId(pAssociadoId);
        setModalNovaGuia(true);
        // Clear params to avoid reopening on refresh
        navigate('/requisicoes', { replace: true });
      }
    }
  }, [associados, searchParams, navigate]);

  // Selected Associado Object
  const associadoSelecionado = useMemo(() => {
    return associados.find(a => a.id === selAssociadoId) || null;
  }, [associados, selAssociadoId]);

  // When Credenciado changes, load its specific linked procedures
  useEffect(() => {
    if (tipoPrestador === 'credenciado' && selCredenciadoId) {
      setLoadingProcs(true);
      buscarProcedimentosVinculados(selCredenciadoId)
        .then(data => {
          setProcedimentosVinculados(data || []);
        })
        .finally(() => setLoadingProcs(false));
    } else {
      setProcedimentosVinculados([]);
    }
  }, [tipoPrestador, selCredenciadoId]);

  // Available Procedures list depending on Provider Type
  const listaProcedimentosDisponiveis = useMemo(() => {
    if (tipoPrestador === 'credenciado' && procedimentosVinculados.length > 0) {
      return procedimentosVinculados.map(pv => ({
        id: pv.procedimentos?.id || pv.procedimento_id,
        codigo_tuss: pv.procedimentos?.codigo_tuss || '',
        descricao: pv.procedimentos?.descricao || 'Procedimento Credenciado',
        valor: pv.valor_exclusivo !== null && pv.valor_exclusivo !== undefined 
          ? Number(pv.valor_exclusivo) 
          : Number(pv.procedimentos?.valor_padrao || 0),
        valor_coparticipacao: pv.valor_coparticipacao !== null && pv.valor_coparticipacao !== undefined
          ? Number(pv.valor_coparticipacao)
          : Number(pv.procedimentos?.coparticipacao || 0)
      }));
    }
    // General master active procedures list
    return todosProcedimentos
      .filter(p => p.ativo)
      .map(p => ({
        id: p.id,
        codigo_tuss: p.codigo_tuss,
        descricao: p.descricao,
        valor: Number(p.valor_padrao || 0),
        valor_coparticipacao: Number(p.coparticipacao || 0)
      }));
  }, [tipoPrestador, procedimentosVinculados, todosProcedimentos]);

  // Add Item to Requisition Cart

  const handleEditRequisicao = (req: any) => {
    setEditingRequisicao(req);
    setSelAssociadoId(req.associado_id);
    setSelPacienteTipo(req.paciente_tipo);
    setSelDependenteId(req.paciente_id || '');
    setTipoPrestador(req.tipo_prestador);
    setSelCredenciadoId(req.credenciado_id || '');
    setRedeExternaNome(req.tipo_prestador === 'rede_externa' ? req.credenciado_nome : '');
    setRedeExternaCnpj(req.tipo_prestador === 'rede_externa' ? (req.credenciado_cnpj_cpf || '') : '');
    setMedicoSolicitante(req.medico_solicitante || '');
    setCrmSolicitante(req.crm_solicitante || '');
    setObservacoes(req.observacoes || '');
    setItensGuia(req.itens || []);
    setModalNovaGuia(true);
  };

  const handleAdicionarItem = () => {
    if (!selProcedimentoId) {
      toast.error('Selecione um procedimento/exame.');
      return;
    }

    const procObj = listaProcedimentosDisponiveis.find(p => p.id === selProcedimentoId);
    if (!procObj) return;

    const valorUnitario = valorCustomProc !== '' ? Number(valorCustomProc) : procObj.valor;
    const valorCoparticipacao = coparticipacaoCustomProc !== '' ? Number(coparticipacaoCustomProc) : (procObj.valor_coparticipacao || 0);
    const qtd = Number(qtdProc) || 1;

    const novoItem: RequisicaoItem = {
      id: crypto.randomUUID(),
      procedimento_id: procObj.id,
      codigo_tuss: procObj.codigo_tuss,
      descricao: procObj.descricao,
      quantidade: qtd,
      valor_unitario: valorUnitario,
      valor_coparticipacao: valorCoparticipacao * qtd,
      valor_total: valorUnitario * qtd
    };

    setItensGuia([...itensGuia, novoItem]);
    setSelProcedimentoId('');
    setQtdProc(1);
    setValorCustomProc('');
    setCoparticipacaoCustomProc('');
  };

  const handleRemoverItem = (id: string) => {
    setItensGuia(itensGuia.filter(item => item.id !== id));
  };

  // Submit New Requisition
  const handleCriarGuia = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!associadoSelecionado) {
      toast.error('Selecione um Associado ativo.');
      return;
    }

    if (tipoPrestador === 'credenciado' && !selCredenciadoId) {
      toast.error('Selecione o Credenciado de atendimento.');
      return;
    }

    if (tipoPrestador === 'rede_externa' && !redeExternaNome) {
      toast.error('Informe o nome da Rede Externa / Prestador.');
      return;
    }

    if (itensGuia.length === 0) {
      toast.error('Adicione ao menos um procedimento ou exame à requisição.');
      return;
    }

    // Determine Patient details
    let pacienteNome = associadoSelecionado.nome;
    let pacienteCpf = associadoSelecionado.cpf;
    let pacienteParentesco = 'Titular';
    let pacienteId = associadoSelecionado.id;

    if (selPacienteTipo === 'dependente' && selDependenteId) {
      const dep = associadoSelecionado.dependentes.find(d => d.id === selDependenteId);
      if (dep) {
        pacienteNome = dep.nome;
        pacienteCpf = dep.cpf || associadoSelecionado.cpf;
        pacienteParentesco = dep.parentesco;
        pacienteId = dep.id;
      }
    }

    // Determine Credenciado details
    let credNome = redeExternaNome;
    let credCnpj = redeExternaCnpj;
    if (tipoPrestador === 'credenciado') {
      const credObj = credenciados.find(c => c.id === selCredenciadoId);
      if (credObj) {
        credNome = credObj.nome_fantasia || credObj.razao_social;
        credCnpj = credObj.cnpj_cpf;
      }
    }

    const valorTotal = itensGuia.reduce((acc, i) => acc + i.valor_total, 0);
    const tenantId = state.empresaSelecionada || 'default_tenant';

    try {
      const reqData: Partial<Requisicao> = {
        tenant_id: tenantId,
        associado_id: associadoSelecionado.id,
        associado_nome: associadoSelecionado.nome,
        associado_cpf: associadoSelecionado.cpf,
        associado_plano: associadoSelecionado.plano_nome,
        paciente_tipo: selPacienteTipo,
        paciente_id: pacienteId,
        paciente_nome: pacienteNome,
        paciente_cpf: pacienteCpf,
        paciente_parentesco: pacienteParentesco,
        tipo_prestador: tipoPrestador,
        credenciado_id: tipoPrestador === 'credenciado' ? selCredenciadoId : undefined,
        credenciado_nome: credNome,
        credenciado_cnpj_cpf: credCnpj,
        medico_solicitante: medicoSolicitante,
        crm_solicitante: crmSolicitante,
        itens: itensGuia,
        valor_total: valorTotal,
        observacoes
      };

      let novaReq;
      if (editingRequisicao) {
        reqData.id = editingRequisicao.id;
        novaReq = await atualizarRequisicao(state.isOnline, { ...editingRequisicao, ...reqData });
      } else {
        reqData.status = 'emitida';
        novaReq = await criarRequisicao(state.isOnline, tenantId, reqData as any);
      }
      // Gerar Conta a Receber se houver Co-participação
      const valorTotalAssociado = itensGuia.reduce((acc, i) => acc + i.valor_total + (i.valor_coparticipacao || 0), 0);
      if (valorTotalAssociado > 0) {
        const dPlus2 = new Date();
        dPlus2.setDate(dPlus2.getDate() + 2);
        const dataVencimento = dPlus2.toISOString();
        const dataEmissao = new Date().toISOString();

        const novaReceita: Receita = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          tipo_devedor: 'associado',
          associado_id: associadoSelecionado.id,
          associado_nome: associadoSelecionado.nome,
          associado_cpf: associadoSelecionado.cpf,
          descricao: `Co-participação - Guia ${novaReq.codigo_requisicao || 'Atualizada'}`,
          categoria: 'Serviço Extra',
          data_emissao: dataEmissao,
          data_inicio_cobranca: dataVencimento,
          valor_total: valorTotalAssociado,
          qtd_parcelas: 1,
          forma_pagamento_padrao: 'pix',
          status: 'ativo'
        };

        const parcelaUnica: ParcelaReceber = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          receita_id: novaReceita.id,
          numero_parcela: 1,
          valor: valorTotalAssociado,
          data_vencimento: dataVencimento,
          status: 'pendente',
          forma_pagamento: 'pix',
          tipo_devedor: 'associado',
          devedor_nome: associadoSelecionado.nome,
          devedor_cpf_cnpj: associadoSelecionado.cpf,
          descricao: `Co-participação - Guia ${novaReq.codigo_requisicao || 'Atualizada'}`
        };

        await salvarReceita(state.isOnline, novaReceita, [parcelaUnica]);
        toast.success(`Conta a Receber (Co-part.) gerada com sucesso!`);
      }

      toast.success(`Guia ${novaReq.codigo_requisicao} emitida com sucesso!`);
      setModalNovaGuia(false);
      resetForm();
      await loadData();

      // Offer printing
      const empresa = await getEmpresaById(tenantId, state.isOnline);
      await gerarPDFGuiaRequisicao(novaReq, empresa);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao emitir guia de requisição.');
    }
  };

  const resetForm = () => {
    setSelAssociadoId('');
    setSelPacienteTipo('titular');
    setSelDependenteId('');
    setTipoPrestador('credenciado');
    setSelCredenciadoId('');
    setRedeExternaNome('');
    setRedeExternaCnpj('');
    setMedicoSolicitante('');
    setCrmSolicitante('');
    setObservacoes('');
    setItensGuia([]);
    setEditingRequisicao(null);
  };

  // Change Status
  const handleAlterarStatus = async (reqId: string, novoStatus: StatusRequisicao) => {
    try {
      await atualizarStatusRequisicao(state.isOnline, reqId, novoStatus, {
        autorizado_por: state.user?.nome || 'Operador'
      });
      toast.success(`Status da requisição atualizado para ${novoStatus.toUpperCase()}.`);
      await loadData();
    } catch (err) {
      toast.error('Erro ao atualizar status.');
    }
  };


  const handleAbrirModalReabrir = async (req: any, targetStatus: 'autorizada' | 'emitida') => {
    try {
      const tenantId = state.empresaSelecionada || 'default_tenant';
      const remessas = await getRemessas(state.isOnline, tenantId);
      
      // Check if req is in any active remessa
      const remessaEncontrada = remessas.find(r => 
        r.status !== 'cancelada' && 
        r.requisicao_ids && 
        r.requisicao_ids.includes(req.id)
      );

      if (remessaEncontrada) {
        toast.error(`Não é possível reabrir a requisição pois ela já está incluída na remessa de faturamento: ${remessaEncontrada.codigo_remessa}`);
        return;
      }

      setModalReabrir({ req, targetStatus });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao verificar faturamentos.');
    }
  };

  const handleConfirmarCancelamento = async () => {
    if (!modalCancelar) return;
    if (!canDelete(state.user)) {
      toast.error('Permissão negada. Somente usuários Administradores podem cancelar ou excluir guias.');
      return;
    }
    try {
      await atualizarStatusRequisicao(state.isOnline, modalCancelar.id, 'cancelada', {
        cancelado_por: state.user?.nome || 'Operador',
        motivo_cancelamento: motivoCancelamento
      });
      toast.success('Requisição cancelada.');
      setModalCancelar(null);
      setMotivoCancelamento('');
      await loadData();
    } catch (err) {
      toast.error('Erro ao cancelar requisição.');
    }
  };

  // Filtered List
  const requisicoesFiltradas = useMemo(() => {
    return requisicoes.filter(r => {
      const matchStatus = !filtros.status || r.status === filtros.status;
      const matchTipo = !filtros.tipoPrestador || r.tipo_prestador === filtros.tipoPrestador;
      const q = (filtros.busca || '').toLowerCase();
      const matchBusca = !q || (
        r.codigo_requisicao.toLowerCase().includes(q) ||
        r.associado_nome.toLowerCase().includes(q) ||
        r.paciente_nome.toLowerCase().includes(q) ||
        r.credenciado_nome.toLowerCase().includes(q)
      );
      return matchStatus && matchTipo && matchBusca;
    });
  }, [requisicoes, filtros]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-bg-surface border border-border-default p-6 rounded-2xl shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-base">Requisições e Autorizações de Exames</h1>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                Submódulo Associados
              </span>
            </div>
            <p className="text-text-subtle text-sm mt-1">
              Emitir e gerenciar guias de atendimento para titulares e dependentes na rede credenciada ou rede externa.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            resetForm();
            setModalNovaGuia(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Guia de Requisição</span>
        </button>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-subtle border border-border-default p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-subtle text-sm font-medium">Total de Guias</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-base">{requisicoes.length}</div>
          <div className="text-xs text-text-subtle mt-1">Histórico completo</div>
        </div>

        <div className="bg-bg-subtle border border-border-default p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-subtle text-sm font-medium">Emitidas / Pendentes</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-500">
            {requisicoes.filter(r => r.status === 'emitida').length}
          </div>
          <div className="text-xs text-text-subtle mt-1">Aguardando autorização/atendimento</div>
        </div>

        <div className="bg-bg-subtle border border-border-default p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-subtle text-sm font-medium">Autorizadas / Realizadas</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-500">
            {requisicoes.filter(r => r.status === 'autorizada' || r.status === 'realizada').length}
          </div>
          <div className="text-xs text-text-subtle mt-1">Atendimentos liberados</div>
        </div>

        <div className="bg-bg-subtle border border-border-default p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-subtle text-sm font-medium">Valor Total das Guias</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <BadgePercent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-base">
            {formatCurrency(requisicoes.filter(r => r.status !== 'cancelada').reduce((acc, r) => acc + r.valor_total, 0))}
          </div>
          <div className="text-xs text-text-subtle mt-1">Acumulado das guias válidas</div>
        </div>
      </div>

      {/* REQUISITION LIST WITH FILTERS */}
      <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm flex flex-col">
        
        {/* SEARCH & FILTER BAR */}
        <div className="p-4 border-b border-border-default flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle" />
            <input
              type="text"
              placeholder="Buscar por código, associado, paciente, prestador..."
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              className="w-full bg-bg-surface border border-border-default rounded-xl pl-9 pr-4 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filtros.status}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
              className="bg-bg-surface border border-border-default text-text-base text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">Todos os Status</option>
              <option value="emitida">Emitida</option>
              <option value="autorizada">Autorizada</option>
              <option value="realizada">Realizada</option>
              <option value="cancelada">Cancelada</option>
            </select>

            <select
              value={filtros.tipoPrestador}
              onChange={(e) => setFiltros({ ...filtros, tipoPrestador: e.target.value })}
              className="bg-bg-surface border border-border-default text-text-base text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">Todas as Redes</option>
              <option value="credenciado">Rede Credenciada</option>
              <option value="rede_externa">Rede Externa</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-surface border-b border-border-default text-xs uppercase tracking-wider text-text-subtle font-semibold">
                <th className="px-6 py-3.5">Cód. / Emissão</th>
                <th className="px-6 py-3.5">Associado / Paciente</th>
                <th className="px-6 py-3.5">Prestador de Serviço</th>
                <th className="px-6 py-3.5">Qtd. Itens</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Valor Total</th>
                <th className="px-6 py-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-subtle">
                    <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Carregando requisições...
                  </td>
                </tr>
              ) : requisicoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-subtle">
                    Nenhuma requisição/guia encontrada.
                  </td>
                </tr>
              ) : (
                requisicoesFiltradas.map(req => (
                  <tr key={req.id} className="hover:bg-bg-surface/50 transition-colors">
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-text-base">{req.codigo_requisicao}</div>
                      <div className="text-xs text-text-subtle">
                        {format(new Date(req.data_emissao), 'dd/MM/yyyy HH:mm')}
                      </div>
                    </td>

                    <td className="px-6 py-3.5">
                      <div className="font-medium text-text-base">{req.paciente_nome}</div>
                      <div className="text-xs text-text-subtle flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-bg-surface border border-border-default text-[10px] uppercase font-semibold">
                          {req.paciente_tipo}
                        </span>
                        <span>Titular: {req.associado_nome}</span>
                      </div>
                    </td>

                    <td className="px-6 py-3.5">
                      <div className="font-medium text-text-base">{req.credenciado_nome}</div>
                      <div className="text-xs text-text-subtle">
                        {req.tipo_prestador === 'credenciado' ? 'Rede Credenciada' : 'Rede Externa'}
                        {req.medico_solicitante ? ` • Dr(a). ${req.medico_solicitante}` : ''}
                      </div>
                    </td>

                    <td className="px-6 py-3.5 text-text-subtle whitespace-nowrap">
                      {req.itens.length} {req.itens.length === 1 ? 'item' : 'itens'}
                    </td>

                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        req.status === 'emitida' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        req.status === 'autorizada' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                        req.status === 'realizada' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}>
                        {req.status === 'emitida' && <Clock className="w-3 h-3" />}
                        {req.status === 'autorizada' && <ShieldCheck className="w-3 h-3" />}
                        {req.status === 'realizada' && <CheckCircle2 className="w-3 h-3" />}
                        {req.status === 'cancelada' && <XCircle className="w-3 h-3" />}
                        {req.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-6 py-3.5 text-right font-bold text-text-base whitespace-nowrap">
                      {formatCurrency(req.valor_total)}
                    </td>

                    <td className="px-6 py-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setModalDetalhes(req)}
                          className="p-1.5 text-text-subtle hover:text-text-base bg-bg-surface hover:bg-bg-hover rounded-lg border border-border-default transition-colors"
                          title="Ver detalhes da guia"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {req.status === 'emitida' && (
                          <button
                            onClick={() => handleEditRequisicao(req)}
                            className="p-1.5 text-amber-500 hover:text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg border border-amber-500/20 transition-colors"
                            title="Editar Guia"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}


                        <button
                          onClick={async () => {
                            const tenantId = state.empresaSelecionada || 'default_tenant';
                            const empresa = await getEmpresaById(tenantId, state.isOnline);
                            await gerarPDFGuiaRequisicao(req, empresa);
                          }}
                          className="p-1.5 text-blue-500 hover:text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg border border-blue-500/20 transition-colors"
                          title="Imprimir Guia em PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {req.status === 'emitida' && (
                          <button
                            onClick={() => handleAlterarStatus(req.id, 'autorizada')}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-lg transition-colors"
                          >
                            Autorizar
                          </button>
                        )}

                                                {req.status === 'autorizada' && (
                          <>
                            <button
                              onClick={() => handleAlterarStatus(req.id, 'realizada')}
                              className="px-2.5 py-1 text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 rounded-lg transition-colors"
                            >
                              Realizada
                            </button>
                            <button
                              onClick={() => handleAbrirModalReabrir(req, 'emitida')}
                              className="px-2.5 py-1 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-lg transition-colors"
                              title="Reabrir para EMITIDA"
                            >
                              Reabrir
                            </button>
                          </>
                        )}

                        
                        {req.status === 'realizada' && (
                          <button
                            onClick={() => handleAbrirModalReabrir(req, 'autorizada')}
                            className="px-2.5 py-1 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-lg transition-colors"
                            title="Reabrir para AUTORIZADA"
                          >
                            Reabrir
                          </button>
                        )}

                        {req.status !== 'cancelada' && req.status !== 'realizada' && (
                          <button
                            onClick={() => setModalCancelar(req)}
                            className="p-1.5 text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/20 transition-colors"
                            title="Cancelar Guia"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: NOVA GUIA DE REQUISIÇÃO */}
      {modalNovaGuia && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-bg-surface border border-border-default rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border-default shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-text-base">{editingRequisicao ? "Editar Guia de Requisição" : "Nova Guia de Requisição / Autorização"}</h3>
                  <p className="text-xs text-text-subtle">Selecione o associado, o paciente e os exames desejados</p>
                </div>
              </div>
              <button onClick={() => setModalNovaGuia(false)} className="text-text-subtle hover:text-text-base p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCriarGuia} className="space-y-6 pt-4 overflow-y-auto pr-1 flex-1">
              
              {/* SECTION 1: ASSOCIADO & PACIENTE */}
              <div className="bg-bg-subtle p-4 rounded-xl border border-border-default space-y-4">
                <h4 className="font-semibold text-sm text-text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#3B82F6]" />
                  1. Identificação do Associado e Paciente (Beneficiário)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-subtle mb-1">Associado Ativo *</label>
                    <select
                      required
                      value={selAssociadoId}
                      onChange={(e) => {
                        setSelAssociadoId(e.target.value);
                        setSelPacienteTipo('titular');
                        setSelDependenteId('');
                      }}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                    >
                      <option value="">Selecione um associado...</option>
                      {associados.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.nome} {a.cpf ? `(CPF: ${a.cpf})` : ''} - Plano: {a.plano_nome || 'Padrão'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {associadoSelecionado && (
                    <div>
                      <label className="block text-xs font-medium text-text-subtle mb-1">Paciente da Guia *</label>
                      <div className="flex items-center gap-4 mt-2">
                        <label className="flex items-center gap-2 text-sm text-text-base cursor-pointer">
                          <input
                            type="radio"
                            name="pacienteTipo"
                            checked={selPacienteTipo === 'titular'}
                            onChange={() => setSelPacienteTipo('titular')}
                            className="text-[#3B82F6]"
                          />
                          <span>Titular ({associadoSelecionado.nome})</span>
                        </label>

                        {associadoSelecionado.dependentes && associadoSelecionado.dependentes.length > 0 && (
                          <label className="flex items-center gap-2 text-sm text-text-base cursor-pointer">
                            <input
                              type="radio"
                              name="pacienteTipo"
                              checked={selPacienteTipo === 'dependente'}
                              onChange={() => setSelPacienteTipo('dependente')}
                              className="text-[#3B82F6]"
                            />
                            <span>Dependente ({associadoSelecionado.dependentes.length})</span>
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* DEPENDENT SELECTION DROPDOWN */}
                {associadoSelecionado && selPacienteTipo === 'dependente' && (
                  <div className="pt-2">
                    <label className="block text-xs font-medium text-text-subtle mb-1">Selecione o Dependente *</label>
                    <select
                      required
                      value={selDependenteId}
                      onChange={(e) => setSelDependenteId(e.target.value)}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                    >
                      <option value="">Selecione o dependente...</option>
                      {associadoSelecionado.dependentes.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.nome} - Parentesco: {d.parentesco} {d.cpf ? `(CPF: ${d.cpf})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* SECTION 2: PRESTADOR DE SERVIÇO */}
              <div className="bg-bg-subtle p-4 rounded-xl border border-border-default space-y-4">
                <h4 className="font-semibold text-sm text-text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#3B82F6]" />
                  2. Prestador de Serviço de Saúde
                </h4>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-text-base cursor-pointer">
                    <input
                      type="radio"
                      name="tipoPrestador"
                      checked={tipoPrestador === 'credenciado'}
                      onChange={() => {
                        setTipoPrestador('credenciado');
                        setSelCredenciadoId('');
                      }}
                      className="text-[#3B82F6]"
                    />
                    <span className="font-medium">Rede Credenciada Ativa</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-text-base cursor-pointer">
                    <input
                      type="radio"
                      name="tipoPrestador"
                      checked={tipoPrestador === 'rede_externa'}
                      onChange={() => {
                        setTipoPrestador('rede_externa');
                        setSelCredenciadoId('');
                      }}
                      className="text-[#3B82F6]"
                    />
                    <span className="font-medium">Rede Externa</span>
                  </label>
                </div>

                {tipoPrestador === 'credenciado' ? (
                  <div>
                    <label className="block text-xs font-medium text-text-subtle mb-1">Selecione o Credenciado *</label>
                    <select
                      required
                      value={selCredenciadoId}
                      onChange={(e) => setSelCredenciadoId(e.target.value)}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                    >
                      <option value="">Selecione um credenciado ativo...</option>
                      {credenciados.filter(c => c.status === 'ativo').map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome_fantasia || c.razao_social} ({c.ramo_atividade})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-subtle mb-1">Nome do Prestador Externo *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Laboratório Dra. Maria / Clínica XYZ"
                        value={redeExternaNome}
                        onChange={(e) => setRedeExternaNome(e.target.value)}
                        className="w-full bg-bg-surface border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-subtle mb-1">CNPJ/CPF do Prestador</label>
                      <input
                        type="text"
                        placeholder="CNPJ ou CPF opcional"
                        value={redeExternaCnpj}
                        onChange={(e) => setRedeExternaCnpj(e.target.value)}
                        className="w-full bg-bg-surface border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border-default">
                  <div>
                    <label className="block text-xs font-medium text-text-subtle mb-1">Médico Solicitante</label>
                    <input
                      type="text"
                      placeholder="Nome do médico solicitante"
                      value={medicoSolicitante}
                      onChange={(e) => setMedicoSolicitante(e.target.value)}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-subtle mb-1">CRM / UF</label>
                    <input
                      type="text"
                      placeholder="Ex: 12345/SP"
                      value={crmSolicitante}
                      onChange={(e) => setCrmSolicitante(e.target.value)}
                      className="w-full bg-bg-surface border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: SELEÇÃO MÚLTIPLA DE PROCEDIMENTOS E EXAMES */}
              <div className="bg-bg-subtle p-4 rounded-xl border border-border-default space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-text-base flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-[#3B82F6]" />
                    3. Exames e Procedimentos Solicitados
                  </h4>
                  {tipoPrestador === 'credenciado' && selCredenciadoId && (
                    <span className="text-xs text-emerald-500 font-medium">
                      {procedimentosVinculados.length > 0 
                        ? `${procedimentosVinculados.length} exames vinculados ao credenciado` 
                        : 'Usando tabela geral de procedimentos'}
                    </span>
                  )}
                </div>

                {/* ADD PROCEDURE INPUTS */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-bg-surface p-3 rounded-xl border border-border-default">
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-medium text-text-subtle mb-1">Selecione o Exame/Procedimento</label>
                    <select
                      value={selProcedimentoId}
                      onChange={(e) => setSelProcedimentoId(e.target.value)}
                      className="w-full bg-bg-base border border-border-default rounded-xl px-3 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                    >
                      <option value="">Escolha da lista de procedimentos ativos...</option>
                      {listaProcedimentosDisponiveis.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.codigo_tuss ? `[${p.codigo_tuss}] ` : ''}{p.descricao} — {formatCurrency(p.valor)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-text-subtle mb-1">Quantidade</label>
                    <input
                      type="number"
                      min="1"
                      value={qtdProc}
                      onChange={(e) => setQtdProc(parseInt(e.target.value) || 1)}
                      className="w-full bg-bg-base border border-border-default rounded-xl px-3 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-text-subtle mb-1">Valor Custom (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Padrão"
                      value={valorCustomProc}
                      onChange={(e) => setValorCustomProc(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full bg-bg-base border border-border-default rounded-xl px-3 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-text-subtle mb-1">Co-Partic. (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Padrão"
                      value={coparticipacaoCustomProc}
                      onChange={(e) => setCoparticipacaoCustomProc(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full bg-bg-base border border-border-default rounded-xl px-3 py-2 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAdicionarItem}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>

                {/* LIST OF ADDED ITEMS */}
                <div className="overflow-x-auto border border-border-default rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-bg-surface text-text-subtle border-b border-border-default uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Cód. TUSS</th>
                        <th className="px-4 py-2.5">Descrição</th>
                        <th className="px-4 py-2.5 text-center">Qtd</th>
                        <th className="px-4 py-2.5 text-right">Val. Unit.</th>
                        <th className="px-4 py-2.5 text-right text-[#3B82F6]">Co-part.</th>
                        <th className="px-4 py-2.5 text-right">Subtotal</th>
                        <th className="px-4 py-2.5 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {itensGuia.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-text-subtle">
                            Nenhum procedimento/exame adicionado à requisição.
                          </td>
                        </tr>
                      ) : (
                        itensGuia.map(item => (
                          <tr key={item.id} className="hover:bg-bg-surface/50">
                            <td className="px-4 py-2.5 font-mono">{item.codigo_tuss || '-'}</td>
                            <td className="px-4 py-2.5 font-medium text-text-base">{item.descricao}</td>
                            <td className="px-4 py-2.5 text-center">{item.quantidade}</td>
                            <td className="px-4 py-2.5 text-right">{formatCurrency(item.valor_unitario)}</td>
                            <td className="px-4 py-2.5 text-right text-[#3B82F6]">{formatCurrency(item.valor_coparticipacao || 0)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-text-base">
                              {formatCurrency(item.valor_total)}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoverItem(item.id)}
                                className="text-rose-500 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {itensGuia.length > 0 && (
                      <tfoot className="bg-bg-surface font-bold text-sm border-t border-border-default">
                        <tr>
                          <td colSpan={4} className="px-4 py-2.5 text-right text-text-subtle">Valor Total da Guia:</td>
                          <td className="px-4 py-2.5 text-right"></td>
                          <td className="px-4 py-2.5 text-right text-text-base">
                            {formatCurrency(itensGuia.reduce((acc, i) => acc + i.valor_total, 0))}
                          </td>
                          <td></td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-4 py-2.5 text-right text-text-subtle">Valor Total Associado (Co-part):</td>
                          <td className="px-4 py-2.5 text-right text-[#3B82F6]">
                            {formatCurrency(itensGuia.reduce((acc, i) => acc + i.valor_total + (i.valor_coparticipacao || 0), 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right"></td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* SECTION 4: OBSERVAÇÕES */}
              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1">Observações Internas / Indicativo Clínico</label>
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Informações adicionais para o credenciado..."
                  className="w-full bg-bg-base border border-border-default rounded-xl p-3 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              {/* MODAL FOOTER */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border-default shrink-0">
                <button
                  type="button"
                  onClick={() => setModalNovaGuia(false)}
                  className="px-4 py-2.5 bg-bg-subtle text-text-subtle hover:text-text-base rounded-xl text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Emitir e Imprimir Guia</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VER DETALHES */}
      {modalDetalhes && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-default rounded-2xl max-w-xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div>
                <h3 className="font-bold text-lg text-text-base">Guia {modalDetalhes.codigo_requisicao}</h3>
                <p className="text-xs text-text-subtle">
                  Emitida em {format(new Date(modalDetalhes.data_emissao), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
              <button onClick={() => setModalDetalhes(null)} className="text-text-subtle hover:text-text-base">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-bg-subtle p-3 rounded-xl space-y-1">
                <div className="font-semibold text-text-base">Paciente: {modalDetalhes.paciente_nome}</div>
                <div className="text-xs text-text-subtle">
                  Titular Associado: {modalDetalhes.associado_nome} ({modalDetalhes.associado_plano || 'Padrão'})
                </div>
              </div>

              <div className="bg-bg-subtle p-3 rounded-xl space-y-1">
                <div className="font-semibold text-text-base">Prestador: {modalDetalhes.credenciado_nome}</div>
                <div className="text-xs text-text-subtle">
                  Tipo: {modalDetalhes.tipo_prestador === 'credenciado' ? 'Rede Credenciada' : 'Rede Externa'}
                  {modalDetalhes.medico_solicitante ? ` • Solic: Dr(a). ${modalDetalhes.medico_solicitante}` : ''}
                </div>
              </div>

              <div>
                <div className="font-semibold text-xs text-text-subtle mb-1 uppercase tracking-wider">Itens da Requisição:</div>
                <div className="border border-border-default rounded-xl overflow-hidden text-xs">
                  {modalDetalhes.itens.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-bg-subtle border-b border-border-default flex justify-between items-center last:border-b-0">
                      <div>
                        <span className="font-medium text-text-base">{item.descricao}</span>
                        <div className="text-text-subtle text-[10px]">Cód TUSS: {item.codigo_tuss || '-'} | Qtd: {item.quantidade}</div>
                      </div>
                      <span className="font-bold text-text-base">{formatCurrency(item.valor_total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center font-bold text-base pt-2">
                <span>Valor Total:</span>
                <span className="text-[#3B82F6]">{formatCurrency(modalDetalhes.valor_total)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border-default">
              <button
                onClick={() => setModalDetalhes(null)}
                className="px-4 py-2 bg-bg-subtle text-text-subtle hover:text-text-base rounded-xl text-xs font-medium"
              >
                Fechar
              </button>
              <button
                onClick={async () => {
                  const tenantId = state.empresaSelecionada || 'default_tenant';
                  const empresa = await getEmpresaById(tenantId, state.isOnline);
                  await gerarPDFGuiaRequisicao(modalDetalhes, empresa);
                }}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-medium flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCELAR GUIA */}
      
      {/* Modal Reabrir Guia */}
      {modalReabrir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-bg-surface w-full max-w-md rounded-2xl shadow-xl border border-border-default overflow-hidden">
            <div className="p-6 border-b border-border-default">
              <h2 className="text-xl font-bold text-text-base">Reabrir Guia</h2>
              <p className="text-sm text-text-subtle mt-1">
                A guia retornará para o status <span className="font-semibold uppercase">{modalReabrir.targetStatus}</span>.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">
                  Justificativa para reabertura <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={motivoReabertura}
                  onChange={e => setMotivoReabertura(e.target.value)}
                  className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-3 text-sm text-text-base focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all h-24 resize-none"
                  placeholder="Explique o motivo de retornar a guia..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-border-default bg-bg-subtle flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setModalReabrir(null);
                  setMotivoReabertura('');
                }}
                className="px-4 py-2 font-medium text-text-muted hover:text-text-base transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!motivoReabertura.trim()}
                onClick={async () => {
                  try {
                    const req = modalReabrir.req;
                    const justificativa = `\n[${format(new Date(), "dd/MM/yyyy HH:mm")} - ${state.user?.nome || 'Admin'}] Reabertura: ${motivoReabertura}`;
                    const novasObs = (req.observacoes || '') + justificativa;
                    
                    const reqAtualizada = { ...req, observacoes: novasObs };
                    await atualizarRequisicao(state.isOnline, reqAtualizada);
                    
                    await atualizarStatusRequisicao(state.isOnline, req.id, modalReabrir.targetStatus, {
                      autorizado_por: state.user?.nome || 'Operador'
                    });
                    
                    toast.success(`Guia reaberta com sucesso! Status: ${modalReabrir.targetStatus.toUpperCase()}`);
                    setModalReabrir(null);
                    setMotivoReabertura('');
                    loadData();
                  } catch (err) {
                    toast.error('Erro ao reabrir guia.');
                  }
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Confirmar Reabertura
              </button>
            </div>
          </div>
        </div>
      )}

      {modalCancelar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-default rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <h3 className="font-bold text-lg text-text-base flex items-center gap-2 text-rose-500">
              <AlertCircle className="w-5 h-5" />
              Cancelar Guia {modalCancelar.codigo_requisicao}
            </h3>

            <p className="text-xs text-text-subtle">
              Confirme o cancelamento desta requisição. O status será alterado para cancelado.
            </p>

            <div>
              <label className="block text-xs font-medium text-text-subtle mb-1">Motivo do Cancelamento</label>
              <textarea
                rows={2}
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                placeholder="Informe a justificativa..."
                className="w-full bg-bg-base border border-border-default rounded-xl p-3 text-sm text-text-base focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border-default">
              <button
                onClick={() => setModalCancelar(null)}
                className="px-4 py-2 bg-bg-subtle text-text-subtle hover:text-text-base rounded-xl text-xs font-medium"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmarCancelamento}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-medium transition-colors"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
