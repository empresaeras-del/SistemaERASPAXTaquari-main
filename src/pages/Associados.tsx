import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import React, { useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { useSeletorPlanoPax } from "../hooks/useSeletorPlanoPax";
import { format, addMonths } from "date-fns";
import { sendWhatsAppMessage, generateBoasVindasTemplate, generateRenovacaoTemplate } from '../utils/whatsapp';
import { formatPhone } from "../utils/formatters";
import { isValidCPFOrCNPJ, maskCPFOrCNPJ } from "../utils/validators";
import { v4 as uuidv4 } from "uuid";
import { salvarReceita, ParcelaReceber, getParcelasReceber, excluirParcelaReceber } from "../services/financeiroService";
import {
  getAssociados,
  saveAssociado,
  softDeleteAssociado,
  Associado,
} from "../services/associadosService";
import { usePlanosPax } from "../hooks/usePlanosPax";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import { ColumnVisibilityToggle } from "../components/ColumnVisibilityToggle";
import { useFornecedores } from "../hooks/useFornecedores";
import { registrarAuditoria } from "../lib/supabase";
import { canDelete } from "../utils/permissions";
import { MessageCircle, Phone, ClipboardList, Activity, MapPin, User, FileText, CreditCard, FolderOpen, Folder, File, Plus, Search, Filter, Edit2, Trash2, X, Users, Heart, AlertCircle, ShieldCheck, CheckCircle, Clock, XCircle, DollarSign, Calendar, LayoutGrid, List , Printer } from "lucide-react";
import { PlanoPaxSelect } from "../components/planos-pax/PlanoPaxSelect";
import { AssociadoRequisicoesTab } from "../components/associados/AssociadoRequisicoesTab";
import { AssociadoResumoFinanceiroTab } from "../components/associados/AssociadoResumoFinanceiroTab";
import { AssociadoAtendimentosTab } from "../components/associados/AssociadoAtendimentosTab";
import { NovoContratoWizard } from "../components/contratos/NovoContratoWizard";
import { ContratoDocumentosGenerator } from '../components/associados/ContratoDocumentosGenerator';
import { AssociadoDetailsModal } from "../components/associados/AssociadoDetailsModal";
import { AdvancedFilterBar } from "../components/layout/AdvancedFilterBar";
import { RegrasCalculoInfo } from "../components/associados/RegrasCalculoInfo";
import { contratoSchema } from "../schemas/contratoSchema";


const formatDateSafe = (dateStr: string | undefined) => {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return new Date(dateStr).toLocaleDateString("pt-BR");
};

const MensalidadesGeracaoTab = ({ associado, onSuccess, onCancel, defaultDataInicio }: { associado: any, onSuccess: () => void, onCancel: () => void, defaultDataInicio?: string }) => {
  const toast = useToast();
  const { state } = useAppContext();
  const { selecionarPlano, planoSelecionado } = useSeletorPlanoPax();
  const [dataInicio, setDataInicio] = React.useState<string>(defaultDataInicio || format(new Date(), 'yyyy-MM-dd'));
  const [qtdParcelas, setQtdParcelas] = React.useState<number>(12);
  const [diaVencimento, setDiaVencimento] = React.useState<number>(10);
  const [loading, setLoading] = React.useState(false);
  const [parcelas, setParcelas] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (associado.plano_pax_id) {
      selecionarPlano(associado.plano_pax_id);
    }
  }, [associado.plano_pax_id, selecionarPlano]);

  const [valorExtra, setValorExtra] = React.useState<number>(0);
  const vidasCadastradas = associado.n_vidas || 1;

  const ultrapassouLimiteColetivo = React.useMemo(() => {
    if (!planoSelecionado) return false;
    if (planoSelecionado.tipo_plano === 'coletivo') {
      const limite = planoSelecionado.limite_vidas || 999;
      return vidasCadastradas > limite;
    }
    return false;
  }, [planoSelecionado, vidasCadastradas]);

  const valorMensalidadeBase = React.useMemo(() => {
    if (!planoSelecionado) return 0;
    
    if (planoSelecionado.tipo_plano === 'individual') {
      const minVidas = planoSelecionado.minimo_vidas_calculo || 1;
      const vidasParaCalculo = vidasCadastradas <= minVidas ? minVidas : vidasCadastradas;
      return planoSelecionado.valor_mensalidade * vidasParaCalculo;
    }
    
    return planoSelecionado.valor_mensalidade + (Number(valorExtra) || 0);
  }, [planoSelecionado, vidasCadastradas, valorExtra]);

  const descricaoCalculo = React.useMemo(() => {
    if (!planoSelecionado) return '';
    if (planoSelecionado.tipo_plano === 'individual') {
      const minVidas = planoSelecionado.minimo_vidas_calculo || 1;
      if (vidasCadastradas <= minVidas) {
        return `Valor Base x ${minVidas} (Mínimo de vidas exigido)`;
      }
      return `Valor Base x ${vidasCadastradas} vidas`;
    }
    return 'Valor Base Coletivo' + (Number(valorExtra) > 0 ? ' + Valor Extra' : '');
  }, [planoSelecionado, vidasCadastradas, valorExtra]);

  const gerarProjecao = React.useCallback(() => {
    if (!planoSelecionado) return;

    let dt = new Date(dataInicio + "T12:00:00");
    const arr = [];
    
    const adesao = planoSelecionado.taxa_adesao || 0;

    for (let i = 1; i <= qtdParcelas; i++) {
      const vencimento = new Date(dt.getFullYear(), dt.getMonth() + (i-1), diaVencimento);
      
      const valorParcela = i === 1 ? (valorMensalidadeBase + adesao) : valorMensalidadeBase;
      const descAdesao = i === 1 && adesao > 0 ? " (Inc. Adesão)" : "";

      arr.push({
        numero_parcela: i,
        descricao: `Mensalidade ${i}/${qtdParcelas} - ${planoSelecionado.nome}${descAdesao}`,
        data_vencimento: format(vencimento, 'yyyy-MM-dd'),
        valor: valorParcela
      });
    }
    setParcelas(arr);
  }, [planoSelecionado, dataInicio, qtdParcelas, diaVencimento, valorMensalidadeBase]);

  React.useEffect(() => {
    gerarProjecao();
  }, [gerarProjecao]);

  const confirmarGeracao = async () => {
    if (parcelas.length === 0) return;
    setLoading(true);
    try {
      const mestreId = uuidv4();
      const totalReceita = parcelas.reduce((acc, p) => acc + p.valor, 0);
      
      const receitaMestre = {
        id: mestreId,
        tenant_id: state.empresaSelecionada,
        tipo_devedor: 'associado',
        associado_id: associado.id,
        associado_nome: associado.nome,
        associado_cpf: associado.cpf,
        associado_plano: planoSelecionado?.nome,
        descricao: `Contrato de Plano: ${planoSelecionado?.nome}`,
        categoria: 'Mensalidades',
        data_emissao: format(new Date(), 'yyyy-MM-dd'),
        data_inicio_cobranca: parcelas[0].data_vencimento,
        valor_total: totalReceita,
        qtd_parcelas: qtdParcelas,
        forma_pagamento_padrao: 'boleto',
        status: 'ativo',
        criado_por: state.user?.nome || 'Sistema'
      };

      const parcelasGeradas = parcelas.map(p => ({
        id: uuidv4(),
        tenant_id: state.empresaSelecionada,
        receita_id: mestreId,
        numero_parcela: p.numero_parcela,
        total_parcelas: qtdParcelas,
        tipo_devedor: 'associado',
        devedor_nome: associado.nome,
        devedor_cpf_cnpj: associado.cpf || '',
        descricao: p.descricao,
        data_vencimento: p.data_vencimento,
        valor: p.valor,
        forma_pagamento: 'boleto',
        status: 'pendente'
      }));

      await salvarReceita(state.isOnline, receitaMestre as any, parcelasGeradas as any);
      
      await registrarAuditoria('MENSALIDADES_GERADAS', {
         receita_mestre_id: mestreId,
         associado_id: associado.id,
         qtd_parcelas: parcelasGeradas.length,
         valor_total: totalReceita,
         online: state.isOnline
      });

      toast.success("Mensalidades geradas com sucesso no Financeiro!");
      onSuccess();
    } catch (e: any) {
      console.error(e);
      await registrarAuditoria('FALHA_GERACAO_MENSALIDADES', {
         associado_id: associado.id,
         plano_id: planoSelecionado?.id,
         erro: e.message || String(e),
         online: state.isOnline
      });
      toast.error("Erro ao gerar mensalidades no financeiro");
    } finally {
      setLoading(false);
    }
  };

  if (!associado.plano_pax_id) {
    return (
      <div className="p-8 text-center text-text-subtle bg-bg-surface rounded-xl border border-dashed border-border-default">
        Selecione um plano na aba "Contrato" antes de gerar mensalidades.
      </div>
    );
  }

  if (!planoSelecionado) {
    return (
      <div className="flex justify-center items-center h-20 bg-bg-subtle rounded-xl border border-border-default">
        <span className="animate-pulse text-text-subtle font-medium">Carregando dados do contrato...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border-default pb-4">
        <h4 className="text-text-base font-medium">Geração de Mensalidades</h4>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <div className="flex-1 space-y-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-bg-surface p-4 rounded-xl border border-border-default">
        <div>
          <p className="text-xs text-text-subtle mb-1">Plano Selecionado</p>
          <p className="text-sm text-text-base font-medium">{planoSelecionado.nome}</p>
        </div>
        <div>
          <p className="text-xs text-text-subtle mb-1">Taxa de Adesão</p>
          <p className="text-sm text-text-base font-medium">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(planoSelecionado.taxa_adesao || 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-subtle mb-1">Total de Vidas</p>
          <p className="text-sm text-text-base font-medium">{associado.n_vidas}</p>
        </div>
        <div>
          <p className="text-xs text-text-subtle mb-1">Valor Calculado p/ Mensalidade</p>
          <p className="text-sm text-emerald-400 font-bold">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorMensalidadeBase)}
          </p>
          <p className="text-xs text-text-subtle mt-1">
            {descricaoCalculo}
          </p>
        </div>
      </div>
      
      {ultrapassouLimiteColetivo && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-amber-500 font-medium">
            <AlertCircle className="w-5 h-5" />
            <span>Atenção: Limite de Vidas Excedido</span>
          </div>
          <p className="text-sm text-text-subtle">
            A quantidade de vidas cadastradas ({vidasCadastradas}) é superior ao máximo permitido ({planoSelecionado?.limite_vidas}) para este plano coletivo. Você não poderá prosseguir sem adicionar um valor extra para as vidas adicionais.
          </p>
          <div>
            <label className="block text-xs font-medium text-text-subtle mb-1">Valor Extra a Cobrar (R$)</label>
            <input 
              type="number" 
              min="0" step="0.01"
              value={valorExtra || ''}
              onChange={e => setValorExtra(parseFloat(e.target.value) || 0)}
              className="w-full max-w-[200px] bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:border-[#3B82F6] transition-all"
              placeholder="0.00"
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-subtle mb-1">Data Base / Adesão</label>
          <input 
            required
                              type="date" 
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-subtle mb-1">Dia de Vencimento</label>
          <input 
            type="number" min="1" max="31"
            value={diaVencimento}
            onChange={e => setDiaVencimento(parseInt(e.target.value) || 1)}
            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-subtle mb-1">Qtd Parcelas (Meses)</label>
          <input 
            type="number" min="1" max="120"
            value={qtdParcelas}
            onChange={e => setQtdParcelas(parseInt(e.target.value) || 1)}
            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base"
          />
        </div>
      </div>

      {parcelas.length > 0 && (
        <div className="space-y-4">
          <h5 className="text-sm font-bold text-text-base border-b border-border-default pb-2">Prévia dos Valores Calculados</h5>
          <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
            {parcelas.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-bg-surface border border-border-default rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-bg-subtle flex items-center justify-center text-xs font-bold text-text-subtle">
                    {p.numero_parcela}
                  </div>
                  <div>
                    <p className="text-sm text-text-base font-medium">{p.descricao}</p>
                    <p className="text-xs text-text-subtle">Vence em: {format(new Date(p.data_vencimento + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
                <div className="text-emerald-400 font-bold flex items-center gap-1">
                  R$ <input 
                      type="number" 
                      min="0" step="0.01" 
                      className="w-24 bg-bg-subtle border border-border-default rounded px-2 py-1 text-right focus:border-[#3B82F6] transition-all text-text-base font-normal" 
                      value={p.valor || ''}
                      onChange={(e) => {
                        const newVal = parseFloat(e.target.value) || 0;
                        const newParcelas = [...parcelas];
                        newParcelas[idx].valor = newVal;
                        setParcelas(newParcelas);
                      }}
                     />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-border-default">
             <div className="text-sm text-text-subtle hidden sm:block">
               Total a gerar: <span className="font-bold text-text-base">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcelas.reduce((acc, p) => acc + p.valor, 0))}</span>
             </div>
             <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
               <div className="text-sm text-text-subtle sm:hidden">
                 Total: <span className="font-bold text-text-base">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcelas.reduce((acc, p) => acc + p.valor, 0))}</span>
               </div>
               <div className="flex items-center gap-3">
                 <button 
                   type="button"
                   onClick={onCancel}
                   disabled={loading}
                   className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base hover:bg-bg-hover font-medium rounded-xl transition-colors disabled:opacity-50"
                 >
                   Cancelar
                 </button>
                 <button 
                   type="button"
                   onClick={confirmarGeracao}
                   disabled={loading || (ultrapassouLimiteColetivo && (!valorExtra || valorExtra <= 0))}
                   className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/25"
                 >
                   {loading ? 'Gerando...' : 'Confirmar e Lançar'}
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}
        </div>
        
        <div className="w-full xl:w-[350px] shrink-0">
          <RegrasCalculoInfo />
        </div>
      </div>
    </div>
  );
};

const MensalidadesTab = ({ associado, onSuccess }: { associado: any, onSuccess: () => void }) => {
  const { state } = useAppContext();
  const confirm = useConfirm();
  const toast = useToast();
  const [loading, setLoading] = React.useState(false);
  const [parcelas, setParcelas] = React.useState<any[]>([]);
  const [showGeracao, setShowGeracao] = React.useState(false);
  const [initialDataInicio, setInitialDataInicio] = React.useState<string | undefined>();
  const [filtroStatus, setFiltroStatus] = React.useState('all');
  const [filtroPeriodoInicio, setFiltroPeriodoInicio] = React.useState('');
  const [filtroPeriodoFim, setFiltroPeriodoFim] = React.useState('');
  const [selectedParcelas, setSelectedParcelas] = React.useState<string[]>([]);
  const [showJustificativa, setShowJustificativa] = React.useState(false);
  const [justificativa, setJustificativa] = React.useState('');

  
  const handleMassDelete = async () => {
    if (!justificativa.trim()) {
      toast.error('Informe a justificativa');
      return;
    }
    
    setLoading(true);
    try {
      for (const id of selectedParcelas) {
        await excluirParcelaReceber(state.isOnline, id);
      }
      await registrarAuditoria('EXCLUSAO_MASSA_MENSALIDADES', {
        associado_id: associado.id,
        parcelas_ids: selectedParcelas,
        justificativa,
        online: state.isOnline
      });
      toast.success('Parcelas excluídas com sucesso');
      setSelectedParcelas([]);
      setShowJustificativa(false);
      setJustificativa('');
      carregarMensalidades();
    } catch(e) {
      toast.error('Erro ao excluir parcelas');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

const carregarMensalidades = React.useCallback(async () => {
    setLoading(true);
    try {
      const allParcelas = await getParcelasReceber(state.isOnline, state.empresaSelecionada || 'all');
      const filtradas = allParcelas.filter(p => {
        const cpfValido = associado.cpf && associado.cpf.trim() !== '';
        if (cpfValido && p.devedor_cpf_cnpj && p.devedor_cpf_cnpj.trim() !== '') {
          return p.devedor_cpf_cnpj === associado.cpf;
        }
        return p.devedor_nome === associado.nome;
      });
      filtradas.sort((a, b) => new Date(b.data_vencimento).getTime() - new Date(a.data_vencimento).getTime());
      setParcelas(filtradas);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [state.isOnline, state.empresaSelecionada, associado.cpf, associado.nome]);

  React.useEffect(() => {
    carregarMensalidades();
  }, [carregarMensalidades]);

  if (showGeracao) {
    return <MensalidadesGeracaoTab associado={associado} defaultDataInicio={initialDataInicio} onSuccess={() => {
      setShowGeracao(false);
      carregarMensalidades();
    }} onCancel={() => setShowGeracao(false)} />;
  }

  const pagas = parcelas.filter(p => p.status === 'recebido');
  const emAberto = parcelas.filter(p => p.status === 'pendente');
  const atrasadas = parcelas.filter(p => p.status === 'vencido');
  const canceladas = parcelas.filter(p => p.status === 'cancelado');

  const valorPagas = pagas.reduce((acc, p) => acc + (p.valor_recebido || p.valor), 0);
  const valorAberto = emAberto.reduce((acc, p) => acc + p.valor, 0);
  const valorAtrasadas = atrasadas.reduce((acc, p) => acc + p.valor, 0);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const filtradas = parcelas.filter(p => {
    let matchStatus = filtroStatus === 'all' || p.status === filtroStatus;
    let matchPeriodo = true;
    if (filtroPeriodoInicio) {
      matchPeriodo = matchPeriodo && new Date(p.data_vencimento) >= new Date(filtroPeriodoInicio);
    }
    if (filtroPeriodoFim) {
      matchPeriodo = matchPeriodo && new Date(p.data_vencimento) <= new Date(filtroPeriodoFim);
    }
    return matchStatus && matchPeriodo;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-default pb-4">
        <div>
          <h4 className="text-text-base font-medium">Mensalidades do Associado</h4>
          <p className="text-sm text-text-subtle mt-1">Acompanhe as mensalidades e histórico de pagamentos</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedParcelas.length > 0 && (
            <button
              type="button"
              onClick={() => setShowJustificativa(true)}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Excluir ({selectedParcelas.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => {
            let proximaData = format(new Date(), 'yyyy-MM-dd');
            const pendentes = parcelas.filter(p => p.status === 'pendente' || p.status === 'vencido');
            
            if (pendentes.length > 0) {
              confirm.confirm({
                title: "Existem Mensalidades Pendentes",
                message: "Este associado já possui mensalidades em aberto ou atrasadas. Deseja continuar com a geração de novas parcelas?",
                confirmText: "Prosseguir",
                cancelText: "Cancelar",
                onConfirm: () => {
                  const sorted = [...pendentes].sort((a, b) => new Date(b.data_vencimento).getTime() - new Date(a.data_vencimento).getTime());
                  const ultima = new Date(sorted[0].data_vencimento + "T12:00:00");
                  const proximoMes = addMonths(ultima, 1);
                  setInitialDataInicio(format(proximoMes, 'yyyy-MM-dd'));
                  setShowGeracao(true);
                }
              });
              return;
            }
            
            setInitialDataInicio(proximaData);
            setShowGeracao(true);
          }}
          className="px-4 py-2 bg-[#3B82F6] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Gerar Mensalidades
        </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-bg-subtle p-4 rounded-2xl border border-border-default flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <CheckCircle className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-text-subtle">Pagas</p>
          </div>
          <div>
            <h4 className="text-xl font-bold text-text-base">{pagas.length} <span className="text-sm font-normal text-text-muted">parcelas</span></h4>
            <p className="text-sm text-emerald-500 font-medium">{formatCurrency(valorPagas)}</p>
          </div>
        </div>

        <div className="bg-bg-subtle p-4 rounded-2xl border border-border-default flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-text-subtle">Em Aberto</p>
          </div>
          <div>
            <h4 className="text-xl font-bold text-text-base">{emAberto.length} <span className="text-sm font-normal text-text-muted">parcelas</span></h4>
            <p className="text-sm text-amber-500 font-medium">{formatCurrency(valorAberto)}</p>
          </div>
        </div>

        <div className="bg-bg-subtle p-4 rounded-2xl border border-border-default flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-text-subtle">Atrasadas</p>
          </div>
          <div>
            <h4 className="text-xl font-bold text-text-base">{atrasadas.length} <span className="text-sm font-normal text-text-muted">parcelas</span></h4>
            <p className="text-sm text-rose-500 font-medium">{formatCurrency(valorAtrasadas)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-end bg-bg-surface p-4 rounded-xl border border-border-default">
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-text-subtle mb-1">Situação</label>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="w-full bg-bg-subtle border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-base focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all"
          >
            <option value="all">Todas</option>
            <option value="pendente">Pendentes</option>
            <option value="recebido">Pagas</option>
            <option value="vencido">Vencidas</option>
            <option value="cancelado">Canceladas</option>
          </select>
        </div>
        
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-text-subtle mb-1">Período de Vencimento</label>
          <div className="flex items-center gap-2">
            <input 
              required
                              type="date"
              value={filtroPeriodoInicio}
              onChange={(e) => setFiltroPeriodoInicio(e.target.value)}
              className="bg-bg-subtle border border-border-default rounded-xl px-3 py-2 text-sm text-text-base focus:border-[#3B82F6] outline-none transition-all"
            />
            <span className="text-text-subtle text-sm">até</span>
            <input 
              required
                              type="date"
              value={filtroPeriodoFim}
              onChange={(e) => setFiltroPeriodoFim(e.target.value)}
              className="bg-bg-subtle border border-border-default rounded-xl px-3 py-2 text-sm text-text-base focus:border-[#3B82F6] outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 flex justify-end">
          <button 
            type="button"
            onClick={() => { setFiltroStatus('all'); setFiltroPeriodoInicio(''); setFiltroPeriodoFim(''); }}
            className="text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] px-2 py-2"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      <div className="border border-border-default rounded-2xl overflow-hidden bg-bg-surface">
        <table className="w-full text-left text-sm text-text-subtle">
          <thead className="bg-bg-subtle border-b border-border-default text-xs uppercase font-semibold text-text-muted">
            <tr>
              <th className="px-4 py-3 w-10">
                <input 
                  type="checkbox"
                  className="rounded border-border-default text-[#3B82F6] focus:ring-[#3B82F6]"
                  checked={filtradas.length > 0 && selectedParcelas.length === filtradas.filter(p => ['pendente', 'vencido'].includes(p.status)).length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const selectable = filtradas.filter(p => ['pendente', 'vencido'].includes(p.status)).map(p => p.id);
                      setSelectedParcelas(selectable);
                    } else {
                      setSelectedParcelas([]);
                    }
                  }}
                />
              </th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center">Carregando...</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">Nenhuma mensalidade encontrada.</td></tr>
            ) : (
              filtradas.map(p => {
                const isSelectable = ['pendente', 'vencido'].includes(p.status);
                return (
                <tr key={p.id} className="hover:bg-bg-subtle/50 transition-colors">
                  <td className="px-4 py-3">
                    {isSelectable && (
                      <input 
                        type="checkbox"
                        className="rounded border-border-default text-[#3B82F6] focus:ring-[#3B82F6]"
                        checked={selectedParcelas.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedParcelas([...selectedParcelas, p.id]);
                          } else {
                            setSelectedParcelas(selectedParcelas.filter(id => id !== p.id));
                          }
                        }}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-base font-medium">{p.descricao}</td>
                  <td className="px-4 py-3">{format(new Date(p.data_vencimento + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-3 font-medium text-text-base">{formatCurrency(p.valor)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                      p.status === 'recebido' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      p.status === 'pendente' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      p.status === 'vencido' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                      'bg-slate-500/10 text-slate-500 border-slate-500/20'
                    }`}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>
      
      {showJustificativa && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-bg-base/80 backdrop-blur-md">
          <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-md flex flex-col border border-border-default overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-text-base mb-2">Exclusão em Massa</h3>
              <p className="text-sm text-text-subtle mb-4">Você está prestes a excluir {selectedParcelas.length} mensalidade(s). Por favor, informe o motivo desta exclusão:</p>
              
              <textarea
                value={justificativa}
                onChange={e => setJustificativa(e.target.value)}
                className="w-full bg-bg-surface border border-border-default rounded-xl p-3 text-text-base focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none min-h-[100px] resize-none"
                placeholder="Motivo da exclusão..."
              />
            </div>
            
            <div className="px-6 py-4 bg-bg-surface/50 border-t border-border-default flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowJustificativa(false)}
                className="px-4 py-2 border border-border-default text-text-base hover:bg-bg-hover font-medium rounded-xl transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleMassDelete}
                disabled={loading || !justificativa.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export const AssociadosPage: React.FC = () => {
  const { state } = useAppContext();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { planosAtivos: planos, planos: planosCompletos, calcularValor } = usePlanosPax();
  const { fornecedores } = useFornecedores();

  const [associados, setAssociados] = useState<Associado[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewAssociado, setPreviewAssociado] = useState<Associado | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const { visibleColumns, isVisible, setVisibleColumns } = useColumnVisibility(['nome', 'cpf', 'plano', 'status', 'adesao', 'acoes']);
  const columns = [
    { id: 'nome', label: 'Nome' },
    { id: 'cpf', label: 'CPF' },
    { id: 'plano', label: 'Plano' },
    { id: 'status', label: 'Status' },
    { id: 'adesao', label: 'Adesão' },
    { id: 'acoes', label: 'Ações' }
  ];
  const [statusFilter, setStatusFilter] = useState("");
  const [planoFilter, setPlanoFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = associados.filter((a) => {
    const matchesSearch =
      a.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.cpf.includes(searchTerm);
    const matchesStatus = statusFilter ? a.status === statusFilter : true;
    const matchesPlano = planoFilter ? a.plano_pax_id === planoFilter : true;
    return matchesSearch && matchesStatus && matchesPlano;
  });

  const [activeTab, setActiveTab] = useState<
    "resumo" | "principal" | "dependentes" | "contratos" | "mensalidades" | "documentos" | "requisicoes" | "atendimentos"
  >("principal");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssociado, setEditingAssociado] =
    useState<Associado | null>(null);
  const [selectedDependenteId, setSelectedDependenteId] = useState<string | null>(null);
  const [selectedContratoId, setSelectedContratoId] = useState<string | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(false);

  const handleWhatsAppMenu = async (associado: Associado) => {
    const opcao = window.prompt(
      `Enviar WhatsApp para ${associado.nome}\n\nDigite o número da opção:\n1 - Boas Vindas\n2 - Lembrete de Renovação\n3 - Mensagem Livre`,
      "1"
    );
    
    if (!opcao) return;
    
    let msg = "";
    if (opcao === "1") {
      msg = await generateBoasVindasTemplate(associado.nome);
    } else if (opcao === "2") {
      msg = await generateRenovacaoTemplate(associado.nome, (associado as any).plano || "");
    }
    
    const phone = associado.telefone || window.prompt(`WhatsApp de ${associado.nome} (com DDD):`, "");
    if (phone) {
        const success = sendWhatsAppMessage(phone, msg);
        if (!success) toast.error("Número de telefone inválido.");
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<"basicas" | "filiacao" | "contato" | "endereco" | "sistema">("basicas");
  const [showDependentesModal, setShowDependentesModal] = useState(false);
  const [buscaDependenteInterno, setBuscaDependenteInterno] = useState("");
  const [buscaDependentes, setBuscaDependentes] = useState("");
  const [showModificarPlanoModal, setShowModificarPlanoModal] = useState(false);
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const [modificarPlanoStep, setModificarPlanoStep] = useState<"confirmar" | "justificativa" | "selecionar">("confirmar");

  const [justificativaModificacao, setJustificativaModificacao] = useState("");
  const [novoPlanoSelecionado, setNovoPlanoSelecionado] = useState("");
  const [parcelasAbertasMap, setParcelasAbertasMap] = useState<Record<string, number>>({});



  const valorPlanoAtivo = React.useMemo(() => {
    if (!editingAssociado?.plano_pax_id) return editingAssociado?.valor_plano || 0;
    
    // Check if we should calculate
    const planoCompleto = planosCompletos.find(p => p.id === editingAssociado.plano_pax_id);
    if (!planoCompleto) return editingAssociado?.valor_plano || 0;
    
    const nVidas = 1 + (editingAssociado.dependentes?.length || 0);
    const dependentesIds = (editingAssociado.dependentes || []).map(d => {
      if (d.data_nascimento) {
        const bdate = new Date(d.data_nascimento);
        return new Date().getFullYear() - bdate.getFullYear();
      }
      return 0;
    });
    
    const result = calcularValor(planoCompleto, nVidas, dependentesIds);
    return result.total;
  }, [editingAssociado, planosCompletos, calcularValor]);

  const todosDependentes = React.useMemo(() => {
    const list: any[] = [];
    associados.forEach(a => {
      if (a.dependentes) {
        a.dependentes.forEach(d => {
          list.push({ ...d, titular_nome: a.nome, titular_cpf: a.cpf });
        });
      }
    });
    return list;
  }, [associados]);

  const dependentesFiltrados = todosDependentes.filter(d => 
    d.nome.toLowerCase().includes(buscaDependentes.toLowerCase()) || 
    (d.titular_nome && d.titular_nome.toLowerCase().includes(buscaDependentes.toLowerCase()))
  );
  
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAssociados(
        state.isOnline,
        state.empresaSelecionada,
      );
      setAssociados(data);

      const allParcelas = await getParcelasReceber(state.isOnline, state.empresaSelecionada || 'all');
      const pMap: Record<string, number> = {};
      data.forEach(a => {
        pMap[a.id] = 0;
      });

      allParcelas.forEach(p => {
        if (p.status === 'pendente' || p.status === 'vencido' || p.status === 'atrasado') {
          const assoc = data.find(a => 
            (a.cpf && p.devedor_cpf_cnpj && a.cpf === p.devedor_cpf_cnpj) || 
            (p.devedor_nome === a.nome)
          );
          if (assoc) {
            pMap[assoc.id] = (pMap[assoc.id] || 0) + 1;
          }
        }
      });
      setParcelasAbertasMap(pMap);
    } catch (e) {

      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  const handleOpenModal = (associado?: Associado) => {
    if (associado) {
      setEditingAssociado({ ...associado });
      setIsEditingMode(true);
    } else {
      setEditingAssociado({
        id: uuidv4(),
        tenant_id: state.empresaSelecionada || "",
        nome: "",
        cpf: "",
        status: "ativo",
        data_adesao: format(new Date(), "yyyy-MM-dd"),
        dependentes: [],
      });
      setIsEditingMode(false);
    }
    setActiveTab("principal");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAssociado(null);
    setSelectedDependenteId(null);
    setSelectedContratoId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssociado || !editingAssociado.id) return;
    try {
      if (!state.empresaSelecionada) {
        toast.error("Selecione uma empresa antes de salvar.");
        return;
      }
      
      if (editingAssociado.cpf) {
        if (!isValidCPFOrCNPJ(editingAssociado.cpf, false)) {
          toast.error("CPF do titular inválido.");
          return;
        }
        const cpfLimpo = editingAssociado.cpf.replace(/\D/g, '');
        if (cpfLimpo.length > 0) {
          const duplicateUser = associados.find(a => 
            a.status === 'ativo' && 
            a.cpf?.replace(/\D/g, '') === cpfLimpo && 
            a.id !== editingAssociado.id
          );
          if (duplicateUser) {
            toast.error(`Não é possível registrar. Este CPF já está sendo usado pelo associado ativo: ${duplicateUser.nome}`);
            return;
          }
        }
      }
      
      if (editingAssociado.dependentes && editingAssociado.dependentes.length > 0) {
        for (const dep of editingAssociado.dependentes) {
          if (dep.cpf && !isValidCPFOrCNPJ(dep.cpf, false)) {
             toast.error(`CPF do dependente ${dep.nome || ''} é inválido.`);
             return;
          }
        }
      }
      
      const nVidasCalculadas = 1 + (editingAssociado.dependentes?.length || 0);
      
      // Validação do contrato se o plano foi selecionado
      if (editingAssociado.plano_pax_id) {
        const contratoResult = contratoSchema.safeParse({
          plano_pax_id: editingAssociado.plano_pax_id,
          tipo_plano: planos.find(p => p.id === editingAssociado.plano_pax_id)?.tipo_plano,
          n_vidas: nVidasCalculadas
        });
        
        if (!contratoResult.success) {
          toast.error(contratoResult.error.issues[0].message);
          return;
        }
      }
      const novoAssociado = {
        ...editingAssociado,
        n_vidas: nVidasCalculadas,
        tenant_id: state.empresaSelecionada,
      } as Associado;

      if (novoAssociado.plano_pax_id) {
        const plano = planos.find(p => p.id === novoAssociado.plano_pax_id);
        if (plano) {
          novoAssociado.plano_nome = plano.nome;
        }
        
        const planoCompleto = planosCompletos.find(p => p.id === novoAssociado.plano_pax_id);
        if (planoCompleto) {
          const dependentesIds = (novoAssociado.dependentes || []).map(d => {
            if (d.data_nascimento) {
              const bdate = new Date(d.data_nascimento);
              const age = new Date().getFullYear() - bdate.getFullYear();
              return age;
            }
            return 0;
          });
          const resultado = calcularValor(planoCompleto, nVidasCalculadas, dependentesIds);
          novoAssociado.valor_plano = resultado.total;
        }
      }
      
      if ((novoAssociado as any).justificativa_modificacao_plano) {
        const original = associados.find(a => a.id === novoAssociado.id);
        
        if (original && original.plano_pax_id && original.plano_pax_id !== novoAssociado.plano_pax_id) {
            const hist = novoAssociado.historico_contratos ? [...novoAssociado.historico_contratos] : [];
            hist.push({
                id: uuidv4(),
                plano: original.plano_nome || "Anterior",
                valor: original.valor_plano || 0,
                data_inicio: original.data_adesao,
                data_fim: format(new Date(), "yyyy-MM-dd")
            });
            novoAssociado.historico_contratos = hist;
            novoAssociado.data_adesao = format(new Date(), "yyyy-MM-dd");
        }

        const originalPlano = original?.plano_nome || "Nenhum";
        
        await registrarAuditoria('Atualizar Plano', {
          modulo: 'Associados',
          descricao: `Plano do associado ${novoAssociado.nome} modificado de ${originalPlano} para ${novoAssociado.plano_nome}. Justificativa: ${(novoAssociado as any).justificativa_modificacao_plano}`,
          usuario_id: state.user?.id || 'sistema',
          tenant_id: state.empresaSelecionada || 'emp-001',
          dados_novos: { 
            plano_anterior: originalPlano,
            novo_plano: novoAssociado.plano_nome,
            justificativa: (novoAssociado as any).justificativa_modificacao_plano 
          }
        });
      }
      
      await saveAssociado(novoAssociado, state.isOnline);
      await loadData();
      handleCloseModal();
      toast.success("Associado salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar associado", error);
      toast.error("Erro ao salvar associado. Verifique se você está online.");
    }
  };

  const handleDelete = (id: string) => {
    if (!canDelete(state.user)) {
      toast.error("Permissão negada. Somente usuários Administradores podem excluir registros no sistema.");
      return;
    }

    confirm({
      title: "Excluir Associado",
      message:
        "Tem certeza que deseja excluir este associado? Esta ação moverá o registro para a lixeira.",
      danger: true,
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await softDeleteAssociado(id, state.isOnline);
          setAssociados((current) => current.filter((a) => a.id !== id));
          toast.success("Associado excluído com sucesso!");
        } catch (error) {
          console.error("Erro ao excluir", error);
          toast.error(
            "Erro ao excluir associado. Verifique se você está online.",
          );
        }
      },
    });
  };

  const totalTitulares = associados.length;
  const totalDependentes = associados.reduce((acc, a) => acc + (a.dependentes?.length || 0), 0);
  const vidasProtegidas = totalTitulares + totalDependentes;
  const inadimplentes = associados.filter((a) => a.status === "inadimplente").length;

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-subtle mb-1">
            <span>Administração</span>
            <span className="w-1 h-1 rounded-full bg-border-default"></span>
            <span>Associados</span>
          </div>
          <h1 className="text-2xl font-bold text-text-base flex items-center gap-2">
            <Users className="w-6 h-6 text-[#3B82F6]" />
            Gestão de Associados
          </h1>
          <p className="text-sm text-text-subtle mt-1">
            Gerenciamento de titulares e dependentes.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-bg-surface border border-border-default text-text-subtle text-sm font-semibold rounded-xl hover:text-text-base hover:bg-bg-hover transition-colors"
            title="Exportar listagem para PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
          <button
            disabled={
              !state.isOnline ||
              !state.empresaSelecionada ||
              state.empresaSelecionada === "all"
            }
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(59,130,246,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Novo Associado
          </button>
        </div>
      </div>

      {true && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
            <div className="p-3 bg-[#3B82F6]/10 text-[#3B82F6] rounded-2xl border border-[#3B82F6]/20 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-subtle">Titulares</p>
              <p className="text-xl font-extrabold text-text-base mt-0.5">{totalTitulares}</p>
            </div>
          </div>
          
          <div 
            onClick={() => setShowDependentesModal(true)}
            className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4 cursor-pointer hover:border-[#8B5CF6]/50 transition-colors"
          >
            <div className="p-3 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-2xl border border-[#8B5CF6]/20 shrink-0">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-subtle">Dependentes</p>
              <p className="text-xl font-extrabold text-[#8B5CF6] mt-0.5">{totalDependentes}</p>
            </div>
          </div>

          <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-subtle">Vidas Protegidas</p>
              <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{vidasProtegidas}</p>
            </div>
          </div>

          <div className="bg-bg-surface p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-subtle">Inadimplentes</p>
              <p className="text-xl font-extrabold text-rose-400 mt-0.5">{inadimplentes}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6 flex-1 min-h-0">
      <div className={`bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col ${'flex'}`}>
        
        <div className="p-4 border-b border-border-default bg-bg-surface/50 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1 w-full min-w-0">
          <AdvancedFilterBar
            pageKey="associados"
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            currentFilters={{ searchTerm, statusFilter, planoFilter }}
            onApplyFilters={(filters) => {
              setSearchTerm(filters.searchTerm || '');
              setStatusFilter(filters.statusFilter || '');
              setPlanoFilter(filters.planoFilter || '');
            }}
            onClearFilters={() => {
              setSearchTerm('');
              setStatusFilter('');
              setPlanoFilter('');
            }}
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-subtle">Busca Rápida</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                <input
                  type="text"
                  placeholder="Nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-subtle">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              >
                <option value="">Todos os Status</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Encerrados</option>
                <option value="inadimplente">Inadimplentes</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-subtle">Plano</label>
              <PlanoPaxSelect
                value={planoFilter}
                onChange={setPlanoFilter}
              />
            </div>
          </AdvancedFilterBar>
          </div>
          <div className="flex items-center bg-bg-subtle border border-border-default p-1 rounded-xl shrink-0">
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
                <div className="overflow-x-auto flex-1 p-4">
          {loading ? (
            <div className="py-20 text-center text-text-subtle flex flex-col items-center">
              <div className="w-8 h-8 border-3 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium">Carregando associados...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center bg-bg-surface border border-border-default rounded-3xl p-8 space-y-3">
              <Users className="w-12 h-12 text-text-subtle mx-auto opacity-50" />
              <h3 className="text-base font-bold text-text-base">Nenhum associado encontrado</h3>
              <p className="text-xs text-text-subtle max-w-md mx-auto">
                Não encontramos nenhum associado com os filtros aplicados.
              </p>
            </div>
          ) : viewMode === 'table' ? (
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-bg-surface/30 border-b border-border-default">
                <tr>
                  {isVisible('nome') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Nome</th>}
                  {isVisible('cpf') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">CPF</th>}
                  {isVisible('plano') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Plano</th>}
                  {isVisible('status') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Status</th>}
                  {isVisible('adesao') && <th className="px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider">Adesão</th>}
                  {isVisible('acoes') && <th className="px-6 py-3 text-right text-xs font-semibold text-text-subtle uppercase tracking-wider">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#475569]">
                {filtered.map((associado) => (
                  <tr
                    key={associado.id}
                    className="hover:bg-bg-surface/30 transition-colors cursor-pointer"
                    onClick={() => setPreviewAssociado(associado)}
                  >
                    {isVisible('nome') && <td className="px-6 py-4 font-medium text-text-base">
                      {associado.nome}
                    </td>}
                    {isVisible('cpf') && <td className="px-6 py-4">{associado.cpf}</td>}
                    {isVisible('plano') && <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="capitalize">{associado.plano_pax_id ? planos.find(p => p.id === associado.plano_pax_id)?.nome || associado.plano_nome : associado.plano_nome || "Sem Plano"}</span>
                        {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] === 0 && (
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20" title="Contrato ativo, mas sem parcelas geradas">
                            SEM MENSALIDADES
                          </span>
                        )}
                        {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] > 0 && parcelasAbertasMap[associado.id] <= 2 && (
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Restam apenas 1 ou 2 mensalidades em aberto">
                            RESTAM {parcelasAbertasMap[associado.id]} MENSALIDADE{parcelasAbertasMap[associado.id] > 1 ? 'S' : ''}
                          </span>
                        )}
                      </div>
                    </td>}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                          associado.status === "ativo"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : associado.status === "inadimplente"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        }`}
                      >
                        {associado.status === 'inativo' ? 'encerrado' : associado.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {new Date(associado.data_adesao).toLocaleDateString(
                        "pt-BR",
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleWhatsAppMenu(associado); }}
                          className="p-1 text-emerald-500/70 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="WhatsApp Automático"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenModal(associado); }}
                          className="p-1 text-text-subtle hover:text-text-base hover:bg-white/5 rounded-lg transition-colors"
                          title="Editar Associado"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          disabled={!state.isOnline}
                          onClick={(e) => { e.stopPropagation(); handleDelete(associado.id); }}
                          className="p-1 text-text-subtle hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Excluir Associado"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 ${"xl:grid-cols-3 2xl:grid-cols-4"} gap-4`}>
              {filtered.map((associado) => (
                <div 
                  key={associado.id} 
                  className="bg-bg-surface border border-border-default rounded-2xl p-5 hover:border-[#3B82F6]/50 transition-all flex flex-col h-full shadow-sm cursor-pointer"
                  onClick={() => setPreviewAssociado(associado)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-text-base line-clamp-1">{associado.nome}</h3>
                      <p className="text-xs text-text-subtle mt-0.5">CPF: {associado.cpf}</p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
                        associado.status === "ativo"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : associado.status === "inadimplente"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      }`}
                    >
                      {associado.status === 'inativo' ? 'encerrado' : associado.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] === 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20" title="Contrato ativo, mas sem parcelas geradas">
                        SEM MENSALIDADES
                      </span>
                    )}
                    {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] > 0 && parcelasAbertasMap[associado.id] <= 2 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Restam apenas 1 ou 2 mensalidades em aberto">
                        RESTAM {parcelasAbertasMap[associado.id]} MENSALIDADE{parcelasAbertasMap[associado.id] > 1 ? 'S' : ''}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 mb-4 flex-1">
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="truncate">
                        {associado.plano_pax_id ? planos.find(p => p.id === associado.plano_pax_id)?.nome || associado.plano_nome : associado.plano_nome || "Sem Plano"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <Calendar className="w-4 h-4 text-[#3B82F6]" />
                      <span>Adesão: {formatDateSafe(associado.data_adesao)}</span>
                    </div>
                    {associado.dependentes && associado.dependentes.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <Users className="w-4 h-4 text-[#8B5CF6]" />
                        <span>{associado.dependentes.length} {associado.dependentes.length === 1 ? 'dependente' : 'dependentes'}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t border-border-default flex items-center justify-between mt-auto">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewAssociado(associado); }}
                      className="text-xs font-medium text-[#3B82F6] hover:text-[#60A5FA] flex items-center gap-1 transition-colors"
                    >
                      Ver Detalhes
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleWhatsAppMenu(associado); }}
                        className="p-1.5 text-emerald-500/70 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="WhatsApp Automático"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(associado); }}
                        className="p-1.5 text-text-subtle hover:text-text-base hover:bg-white/5 rounded-lg transition-colors"
                        title="Editar Associado"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        disabled={!state.isOnline}
                        onClick={(e) => { e.stopPropagation(); handleDelete(associado.id); }}
                        className="p-1.5 text-text-subtle hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Excluir Associado"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      </div>

      {previewAssociado && (
        <AssociadoDetailsModal
          associado={previewAssociado}
          onClose={() => setPreviewAssociado(null)}
          onEdit={(associado) => {
            setPreviewAssociado(null);
            handleOpenModal(associado);
          }}
        />
      )}

      {isModalOpen && editingAssociado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4">
          <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-6xl 2xl:max-w-[1400px] max-h-[90vh] flex flex-col border border-border-default overflow-hidden">
            <div className="px-6 py-4 border-b border-border-default flex items-center justify-between shrink-0 bg-bg-surface/50">
              <h3 className="text-xl font-bold text-text-base tracking-tight">
                {editingAssociado.nome ? "Editar Associado" : "Novo Associado"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-text-subtle hover:text-text-base transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div
              className={`flex flex-1 overflow-hidden ${isEditingMode ? "flex-row" : "flex-col"}`}
            >
              {isEditingMode ? (
                <div className="w-64 border-r border-border-default bg-bg-surface/30 flex flex-col py-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const form = document.getElementById("associado-form") as HTMLFormElement;
                      if (form && !form.checkValidity()) {
                        form.reportValidity();
                        toast.error("Preencha todos os campos obrigatórios (*) antes de mudar de aba.");
                        return;
                      }
                      setActiveTab("resumo");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "resumo"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    Resumo Financeiro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const form = document.getElementById("associado-form") as HTMLFormElement;
                      if (form && !form.checkValidity()) {
                        form.reportValidity();
                        toast.error("Preencha todos os campos obrigatórios (*) antes de mudar de aba.");
                        return;
                      }
                      setActiveTab("principal");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "principal"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Dados Principais
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const form = document.getElementById("associado-form") as HTMLFormElement;
                      if (form && !form.checkValidity()) {
                        form.reportValidity();
                        toast.error("Preencha todos os campos obrigatórios (*) antes de mudar de aba.");
                        return;
                      }
                      setActiveTab("dependentes");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "dependentes"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Dependentes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const form = document.getElementById("associado-form") as HTMLFormElement;
                      if (form && !form.checkValidity()) {
                        form.reportValidity();
                        toast.error("Preencha todos os campos obrigatórios (*) antes de mudar de aba.");
                        return;
                      }
                      setActiveTab("contratos");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "contratos"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Contratos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const form = document.getElementById("associado-form") as HTMLFormElement;
                      if (form && !form.checkValidity()) {
                        form.reportValidity();
                        toast.error("Preencha todos os campos obrigatórios (*) antes de mudar de aba.");
                        return;
                      }
                      setActiveTab("mensalidades");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "mensalidades"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    Mensalidades
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const form = document.getElementById("associado-form") as HTMLFormElement;
                      if (form && !form.checkValidity()) {
                        form.reportValidity();
                        toast.error("Preencha todos os campos obrigatórios (*) antes de mudar de aba.");
                        return;
                      }
                      setActiveTab("documentos");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "documentos"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    Documentos
                  </button>
                  {isEditingMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const form = document.getElementById("associado-form") as HTMLFormElement;
                          if (form && !form.checkValidity()) {
                            form.reportValidity();
                            toast.error("Preencha todos os campos obrigatórios (*) antes de mudar de aba.");
                            return;
                          }
                          setActiveTab("requisicoes");
                        }}
                        className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                          activeTab === "requisicoes"
                            ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                            : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                        }`}
                      >
                        <ClipboardList className="w-4 h-4" />
                        Requisições
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const form = document.getElementById("associado-form") as HTMLFormElement;
                          if (form && !form.checkValidity()) {
                            form.reportValidity();
                            toast.error("Preencha todos os campos obrigatórios (*) antes de mudar de aba.");
                            return;
                          }
                          setActiveTab("atendimentos");
                        }}
                        className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                          activeTab === "atendimentos"
                            ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                            : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                        }`}
                      >
                        <Activity className="w-4 h-4" />
                        Atendimentos
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="px-8 py-5 border-b border-border-default bg-bg-surface/30">
                  <div className="flex items-center justify-between max-w-2xl mx-auto">
                    {/* Step 1 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "principal" || activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "principal" || activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        1
                      </div>
                      <span className="text-xs font-medium">Dados Básicos</span>
                    </div>

                    <div
                      className={`w-16 h-0.5 mx-2 ${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
                    ></div>

                    {/* Step 2 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "dependentes" || activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        2
                      </div>
                      <span className="text-xs font-medium">Dependentes</span>
                    </div>

                    <div
                      className={`w-16 h-0.5 mx-2 ${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
                    ></div>

                    {/* Step 3 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "contratos" || activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        3
                      </div>
                      <span className="text-xs font-medium">Contrato</span>
                    </div>

                    <div
                      className={`w-16 h-0.5 mx-2 ${activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
                    ></div>

                    {/* Step 4 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "mensalidades" || activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "mensalidades" || activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        4
                      </div>
                      <span className="text-xs font-medium">Mensalidades</span>
                    </div>

                    <div
                      className={`w-16 h-0.5 mx-2 ${activeTab === "documentos" ? "bg-[#3B82F6]" : "bg-bg-hover"}`}
                    ></div>

                    {/* Step 5 */}
                    <div
                      className={`flex flex-col items-center flex-1 ${activeTab === "documentos" ? "text-[#3B82F6]" : "text-text-subtle"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${activeTab === "documentos" ? "bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-bg-hover text-text-subtle"}`}
                      >
                        5
                      </div>
                      <span className="text-xs font-medium">Documentos</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Content */}
              <form
                id="associado-form"
                onSubmit={handleSave}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  {activeTab === "resumo" ? (
                    <AssociadoResumoFinanceiroTab associado={editingAssociado} />
                  ) : activeTab === "principal" ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-full">
                      {/* Sub-tabs para Dados Principais (Fichários) */}
                      <div className="flex overflow-x-auto gap-2 pb-4 mb-4 border-b border-border-default/50 custom-scrollbar shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("basicas")}
                          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors ${activeSubTab === "basicas" ? "bg-[#3B82F6]/10 text-[#3B82F6]" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                        >
                          Informações Básicas
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("filiacao")}
                          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors ${activeSubTab === "filiacao" ? "bg-indigo-500/10 text-indigo-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                        >
                          Filiação
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("contato")}
                          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors ${activeSubTab === "contato" ? "bg-emerald-500/10 text-emerald-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                        >
                          Contato
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("endereco")}
                          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors ${activeSubTab === "endereco" ? "bg-amber-500/10 text-amber-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                        >
                          Endereço
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("sistema")}
                          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors ${activeSubTab === "sistema" ? "bg-purple-500/10 text-purple-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                        >
                          Informações do Sistema
                        </button>
                      </div>

                      <div className="space-y-8">
                      {/* Section: Informações Básicas */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "basicas" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-[#3B82F6]/10 rounded-xl text-[#3B82F6]">
                            <User className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Informações Básicas
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Nome Completo *
                            </label>
                            <input
                              required
                              type="text"
                              value={editingAssociado.nome || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  nome: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              CPF *
                            </label>
                            <input
                              required
                              type="text"
                              maxLength={14}
                              value={editingAssociado.cpf || ""}
                              onChange={(e) => {
                                const formatted = maskCPFOrCNPJ(e.target.value, false);
                                setEditingAssociado({
                                  ...editingAssociado,
                                  cpf: formatted,
                                });
                                // Verificação em tempo real
                                const cpfLimpo = formatted.replace(/\D/g, '');
                                if (cpfLimpo.length === 11) {
                                  const duplicateUser = associados.find(a => a.status === 'ativo' && a.cpf?.replace(/\D/g, '') === cpfLimpo && a.id !== editingAssociado.id);
                                  if (duplicateUser) {
                                    toast.error(`ATENÇÃO: CPF já cadastrado no associado ativo: ${duplicateUser.nome}`);
                                  }
                                }
                              }}
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              RG
                            </label>
                            <input
                              type="text"
                              value={editingAssociado.rg || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  rg: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Data de Nascimento *
                            </label>
                            <input
                              required
                              type="date"
                              value={editingAssociado.data_nascimento || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  data_nascimento: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Sexo *
                            </label>
                            <select
                              required
                              value={editingAssociado.sexo || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  sexo: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            >
                              <option value="">Selecione</option>
                              <option value="M">Masculino</option>
                              <option value="F">Feminino</option>
                              <option value="O">Outro</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Section: Filiação */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "filiacao" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                            <Users className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Filiação
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Nome da Mãe
                            </label>
                            <input
                              type="text"
                              value={editingAssociado.nome_mae || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  nome_mae: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Nome do Pai
                            </label>
                            <input
                              type="text"
                              value={editingAssociado.nome_pai || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  nome_pai: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Contato */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "contato" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                            <Phone className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Contato
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Telefone *
                            </label>
                            <input
                              required
                              type="tel"
                              maxLength={15}
                              value={editingAssociado.telefone || ""}
                              onChange={(e) => {
                                const formatted = formatPhone(e.target.value);
                                setEditingAssociado({
                                  ...editingAssociado,
                                  telefone: formatted,
                                })
                              }}
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              E-mail
                            </label>
                            <input
                              type="email"
                              value={editingAssociado.email || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  email: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Endereço */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "endereco" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Endereço
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                          <div className="space-y-1 md:col-span-3">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              CEP *
                            </label>
                            <input
                              type="text"
                              required
                              value={editingAssociado.endereco_cep || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  endereco_cep: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                          <div className="space-y-1 md:col-span-7">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Logradouro *
                            </label>
                            <input
                              type="text"
                              required
                              value={editingAssociado.endereco_logradouro || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  endereco_logradouro: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Número *
                            </label>
                            <input
                              type="text"
                              required
                              value={editingAssociado.endereco_numero || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  endereco_numero: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                          <div className="space-y-1 md:col-span-6">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Bairro *
                            </label>
                            <input
                              type="text"
                              required
                              value={editingAssociado.endereco_bairro || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  endereco_bairro: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                          <div className="space-y-1 md:col-span-6">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Cidade / UF *
                            </label>
                            <input
                              type="text"
                              required
                              value={editingAssociado.endereco_cidade || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  endereco_cidade: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Sistema */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "sistema" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
                        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
                          <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-bold text-text-base tracking-tight">
                            Informações do Sistema
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Data de Adesão *
                            </label>
                            <input
                              required
                              type="date"
                              value={editingAssociado.data_adesao || ""}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  data_adesao: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
                              Status *
                            </label>
                            <select
                              required
                              value={editingAssociado.status || "ativo"}
                              onChange={(e) =>
                                setEditingAssociado({
                                  ...editingAssociado,
                                  status: e.target.value as Associado["status"],
                                })
                              }
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
                            >
                              <option value="ativo">Ativo</option>
                              <option value="inadimplente">Inadimplente</option>
                              <option value="inativo">Inativo</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      </div>
                    </div>
                  ) : activeTab === "dependentes" ? (
                    <div className="space-y-6 flex flex-col h-full">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <h4 className="text-xl font-bold text-text-base flex items-center gap-2">
                            <Users className="w-6 h-6 text-[#3B82F6]" />
                            Dependentes
                          </h4>
                          {!selectedDependenteId && (
                            <span className="px-3 py-1 bg-[#3B82F6]/10 text-[#3B82F6] rounded-full text-sm font-bold border border-[#3B82F6]/20">
                              {editingAssociado.dependentes?.length || 0} cadastrados
                            </span>
                          )}
                        </div>

                        {!selectedDependenteId && (
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                              type="text"
                              placeholder="Buscar dependente..."
                              value={buscaDependenteInterno}
                              onChange={(e) => setBuscaDependenteInterno(e.target.value)}
                              className="w-full sm:w-64 bg-bg-subtle border border-border-default rounded-xl pl-9 pr-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6] text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newId = uuidv4();
                              setEditingAssociado({
                                ...editingAssociado,
                                dependentes: [
                                  ...(editingAssociado.dependentes || []),
                                  {
                                    id: newId,
                                    nome: "",
                                    cpf: "",
                                    data_nascimento: "",
                                    parentesco: "",
                                  },
                                ],
                              });
                              setSelectedDependenteId(newId);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                          >
                            <Plus className="w-4 h-4" />
                            Novo Dependente
                          </button>
                        </div>
                        )}
                      </div>

                      {!selectedDependenteId ? (
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                          {!editingAssociado.dependentes ||
                          editingAssociado.dependentes.length === 0 ? (
                            <div className="text-center py-20 bg-bg-subtle border border-dashed border-border-default rounded-2xl">
                              <Users className="w-12 h-12 mx-auto text-text-subtle mb-3 opacity-50" />
                              <p className="text-text-base font-semibold mb-1">Nenhum dependente</p>
                              <p className="text-text-subtle text-sm">
                                Este associado ainda não possui dependentes cadastrados.
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {editingAssociado.dependentes
                                .filter(dep => !buscaDependenteInterno || dep.nome.toLowerCase().includes(buscaDependenteInterno.toLowerCase()))
                                .map((dep, index) => (
                                <div
                                  key={dep.id}
                                  onClick={() => setSelectedDependenteId(dep.id)}
                                  className="p-4 bg-bg-surface border border-border-default rounded-xl relative group cursor-pointer hover:border-[#3B82F6]/50 transition-colors"
                                >
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="text-text-base font-medium truncate">{dep.nome || 'Novo Dependente'}</p>
                                      <p className="text-sm text-text-subtle">{dep.parentesco || 'Não informado'}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const novosDeps = [
                                            ...editingAssociado.dependentes!,
                                          ];
                                          novosDeps.splice(index, 1);
                                          setEditingAssociado({
                                            ...editingAssociado,
                                            dependentes: novosDeps,
                                          });
                                        }}
                                        className="p-1.5 text-text-subtle hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity bg-bg-subtle rounded-md border border-border-default"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-4 flex gap-4 text-xs text-text-subtle">
                                    {dep.cpf && <span>CPF: {dep.cpf}</span>}
                                    {dep.data_nascimento && <span>Nasc: {formatDateSafe(dep.data_nascimento)}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center mb-4">
                             <button
                                type="button"
                                onClick={() => {
                                  // Find current index
                                  const idx = editingAssociado.dependentes?.findIndex(d => d.id === selectedDependenteId);
                                  if (idx !== undefined && idx !== -1) {
                                      const dep = editingAssociado.dependentes![idx];
                                      // If user clicks Voltar and the record is virtually empty, auto-remove it to clean up
                                      if (!dep.nome && !dep.cpf && !dep.data_nascimento && !dep.parentesco) {
                                          const novosDeps = [...editingAssociado.dependentes!];
                                          novosDeps.splice(idx, 1);
                                          setEditingAssociado({ ...editingAssociado, dependentes: novosDeps });
                                      }
                                  }
                                  setSelectedDependenteId(null)
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-subtle border border-border-default text-text-muted rounded-lg text-sm font-medium hover:bg-bg-hover transition-colors"
                             >
                                Voltar e Cancelar
                             </button>
                             
                             <button
                                type="button"
                                onClick={() => {
                                  const idx = editingAssociado.dependentes?.findIndex(d => d.id === selectedDependenteId);
                                  if (idx !== undefined && idx !== -1) {
                                      const dep = editingAssociado.dependentes![idx];
                                      if (!dep.nome || !dep.cpf || !dep.data_nascimento || !dep.parentesco) {
                                          toast.error("Preencha todos os campos do dependente antes de confirmar.");
                                          return;
                                      }
                                      
                                      // Se tudo OK, abre modal/confirmação
                                      confirm({
                                          title: "Atenção - Inclusão de Dependente",
                                          message: "A inclusão de novos dependentes deve ser validada entre o gestor e o respectivo associado através de Termo Aditivo, pois podem incorrer em reajuste Contratual.\n\nAo confirmar, você poderá gerar o aditivo posteriormente na aba Documentos.",
                                          confirmText: "Estou ciente, confirmar",
                                          cancelText: "Cancelar",
                                          onConfirm: () => {
                                              toast.success("Dependente confirmado. Você pode gerar o Termo Aditivo na aba Documentos.");
                                              setSelectedDependenteId(null);
                                          }
                                      });
                                  } else {
                                      setSelectedDependenteId(null);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-sm font-bold hover:bg-emerald-500/20 transition-colors"
                             >
                                <CheckCircle className="w-4 h-4" />
                                Confirmar Dependente
                             </button>
                          </div>
                          {(() => {
                            const index = editingAssociado.dependentes?.findIndex(d => d.id === selectedDependenteId) ?? -1;
                            if (index === -1) return null;
                            const dep = editingAssociado.dependentes![index];
                            return (
                              <div
                                key={dep.id}
                                className="p-5 bg-bg-surface border border-border-default rounded-xl relative group"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1 md:col-span-2">
                                    <label className="block text-xs font-semibold text-text-subtle">
                                      Nome Completo
                                    </label>
                                    <input
                                      required
                                      type="text"
                                      value={dep.nome}
                                      onChange={(e) => {
                                        const novosDeps = [
                                          ...editingAssociado.dependentes!,
                                        ];
                                        novosDeps[index] = {
                                          ...dep,
                                          nome: e.target.value,
                                        };
                                        setEditingAssociado({
                                          ...editingAssociado,
                                          dependentes: novosDeps,
                                        });
                                      }}
                                      className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-text-base text-sm focus:outline-none focus:border-[#3B82F6]"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-text-subtle">
                                      CPF
                                    </label>
                                    <input
                                      type="text"
                                      maxLength={14}
                                      value={dep.cpf || ""}
                                      onChange={(e) => {
                                        const formatted = maskCPFOrCNPJ(e.target.value, false);
                                        const novosDeps = [
                                          ...editingAssociado.dependentes!,
                                        ];
                                        novosDeps[index] = {
                                          ...dep,
                                          cpf: formatted,
                                        };
                                        setEditingAssociado({
                                          ...editingAssociado,
                                          dependentes: novosDeps,
                                        });
                                      }}
                                      className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-text-base text-sm focus:outline-none focus:border-[#3B82F6]"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-text-subtle">
                                      Data Nasc.
                                    </label>
                                    <input
                                      required
                              type="date"
                                      value={dep.data_nascimento || ""}
                                      onChange={(e) => {
                                        const novosDeps = [
                                          ...editingAssociado.dependentes!,
                                        ];
                                        novosDeps[index] = {
                                          ...dep,
                                          data_nascimento: e.target.value,
                                        };
                                        setEditingAssociado({
                                          ...editingAssociado,
                                          dependentes: novosDeps,
                                        });
                                      }}
                                      className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-text-base text-sm focus:outline-none focus:border-[#3B82F6]"
                                    />
                                  </div>
                                  <div className="space-y-1 md:col-span-2">
                                    <label className="block text-xs font-semibold text-text-subtle">
                                      Parentesco
                                    </label>
                                    <input
                                      required
                                      type="text"
                                      value={dep.parentesco}
                                      onChange={(e) => {
                                        const novosDeps = [
                                          ...editingAssociado.dependentes!,
                                        ];
                                        novosDeps[index] = {
                                          ...dep,
                                          parentesco: e.target.value,
                                        };
                                        setEditingAssociado({
                                          ...editingAssociado,
                                          dependentes: novosDeps,
                                        });
                                      }}
                                      className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-text-base text-sm focus:outline-none focus:border-[#3B82F6]"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ) : activeTab === "contratos" ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-border-default pb-4">
                        <h4 className="text-text-base font-medium">
                          Contratos do Associado
                        </h4>
                      </div>
                      
                      
                      <div className="bg-bg-surface p-5 rounded-xl border border-border-default space-y-4 mb-4">
                        <h5 className="text-sm font-semibold text-text-subtle">
                          Tipo de Contrato / Pessoa
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-text-subtle mb-1">Tipo de Pessoa *</label>
                            <select 
                              value={editingAssociado.tipo_pessoa || 'PF'}
                              onChange={(e) => setEditingAssociado({ ...editingAssociado, tipo_pessoa: e.target.value as 'PF' | 'PJ' })}
                              className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-base focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none transition-all"
                            >
                              <option value="PF">Pessoa Física (PF)</option>
                              <option value="PJ">Pessoa Jurídica (PJ)</option>
                            </select>
                          </div>
                          {editingAssociado.tipo_pessoa === 'PJ' && (
                            <div>
                              <label className="block text-xs font-medium text-text-subtle mb-1">Empresa / Convenio (Fornecedor) *</label>
                              <select 
                                value={editingAssociado.fornecedor_id || ''}
                                onChange={(e) => setEditingAssociado({ ...editingAssociado, fornecedor_id: e.target.value })}
                                required
                                className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-base focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none transition-all"
                              >
                                <option value="">Selecione a empresa conveniada</option>
                                {fornecedores.filter(f => f.categoria === 'Convenios Associados' && f.status === 'ativo').map(f => (
                                  <option key={f.id} value={f.id}>{f.razao_social || f.nome_fantasia}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>

                      {!selectedContratoId ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Active Contract Widget */}
                          <div 
                            onClick={() => setSelectedContratoId('active')}
                            className="p-5 bg-bg-surface border border-[#3B82F6]/50 rounded-xl cursor-pointer hover:bg-bg-subtle transition-colors relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 px-3 py-1 bg-[#3B82F6]/10 text-[#3B82F6] text-xs font-semibold rounded-bl-lg">
                              ATIVO
                            </div>
                            <h5 className="text-lg font-bold text-text-base mb-1">
                              {editingAssociado.plano_nome || "Nenhum Plano Selecionado"}
                            </h5>
                            <p className="text-sm text-text-subtle mb-4">
                              Valor: R$ {valorPlanoAtivo.toFixed(2).replace(".", ",")}
                            </p>
                            <div className="flex justify-between items-center text-xs text-text-subtle">
                              <span>Desde {editingAssociado.data_adesao ? formatDateSafe(editingAssociado.data_adesao) : "N/A"}</span>
                              <span className="flex items-center gap-1 text-[#3B82F6]">Editar <Search className="w-3 h-3" /></span>
                            </div>
                          </div>
                          
                          {/* Inactive Contracts Widgets */}
                          {editingAssociado.historico_contratos?.map(hist => (
                            <div 
                              key={hist.id}
                              onClick={() => setSelectedContratoId(hist.id)}
                              className="p-5 bg-bg-surface border border-border-default rounded-xl cursor-pointer hover:bg-bg-subtle transition-colors relative overflow-hidden opacity-75"
                            >
                              <div className="absolute top-0 right-0 px-3 py-1 bg-slate-500/10 text-text-subtle text-xs font-semibold rounded-bl-lg">
                                INATIVO
                              </div>
                              <h5 className="text-lg font-bold text-text-base mb-1">
                                Plano {hist.plano}
                              </h5>
                              <p className="text-sm text-text-subtle mb-4">
                                Valor: R$ {hist.valor.toFixed(2).replace('.', ',')}
                              </p>
                              <div className="flex justify-between items-center text-xs text-text-subtle">
                                <span>{formatDateSafe(hist.data_inicio)} - {hist.data_fim ? formatDateSafe(hist.data_fim) : "N/A"}</span>
                                <span className="flex items-center gap-1">Ver <Search className="w-3 h-3" /></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() => setSelectedContratoId(null)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-subtle border border-border-default text-text-muted rounded-lg text-sm font-medium hover:bg-[#64748B] transition-colors"
                            >
                              Voltar
                            </button>
                          </div>
                          
                          {selectedContratoId === 'active' ? (
                            
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <div className="space-y-4 xl:col-span-7">
                          <h5 className="text-sm font-semibold text-text-subtle">
                            Dados do Contrato
                          </h5>
                          <div className="space-y-4">
                            <div className="p-5 bg-bg-surface border border-border-default rounded-xl">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <p className="text-sm font-medium text-text-subtle mb-1">Plano Atual</p>
                                  <h4 className="text-lg font-bold text-text-base capitalize">
                                    {editingAssociado.plano_pax_id ? planos.find(p => p.id === editingAssociado.plano_pax_id)?.nome || editingAssociado.plano_nome : editingAssociado.plano_nome || "Nenhum Plano Selecionado"}
                                  </h4>
                                </div>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Ativo
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                                <div>
                                  <p className="text-text-subtle">Valor Mensal</p>
                                  <p className="font-semibold text-text-base">R$ {valorPlanoAtivo.toFixed(2).replace(".", ",")}</p>
                                </div>
                                <div>
                                  <p className="text-text-subtle">Data de Adesão</p>
                                  <p className="font-semibold text-text-base">
                                    {editingAssociado.data_adesao ? formatDateSafe(editingAssociado.data_adesao) : "N/A"}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            {!editingAssociado.plano_pax_id ? (
                              <button
                                type="button"
                                onClick={() => setShowNovoContrato(true)}
                                className="w-full px-4 py-3 bg-[#3B82F6] text-white hover:bg-[#3B82F6]/90 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#3B82F6]/20"
                              >
                                <Plus className="w-4 h-4" />
                                Cadastrar Novo Contrato
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowModificarPlanoModal(true);
                                  setModificarPlanoStep("confirmar");
                                  setJustificativaModificacao("");
                                  setNovoPlanoSelecionado("");
                                }}
                                className="w-full px-4 py-3 bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Modificar Plano
                              </button>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="block text-sm font-semibold text-text-subtle mb-1">
                              Número de Vidas
                            </label>
                            <input
                              type="number"
                              min="1"
                              readOnly
                              value={1 + (editingAssociado.dependentes?.length || 0)}
                              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-subtle cursor-not-allowed focus:outline-none transition-all"
                            />
                            <p className="text-xs text-text-subtle mt-1">Calculado automaticamente (Titular + Dependentes)</p>
                          </div>
                          
                          <div className="p-4 bg-bg-surface border border-border-default rounded-xl mt-4">
                            <p className="text-sm text-text-subtle">
                              Quantidade de Dependentes Vinculados
                            </p>
                            <p className="text-2xl font-bold text-text-base mt-1">
                              {editingAssociado.dependentes?.length || 0}
                            </p>
                          </div>
                          
                        </div>
                        <div className="space-y-4 xl:col-span-5">
                          <h5 className="text-sm font-semibold text-text-subtle">
                            Histórico de Alterações
                          </h5>
                          <div className="bg-bg-surface border border-border-default rounded-xl p-4 overflow-y-auto max-h-[300px]">
                            <div className="space-y-4">
                              <div className="flex gap-4">
                                <div className="mt-1">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                  <div className="w-0.5 h-full bg-bg-hover mx-auto mt-1"></div>
                                </div>
                                <div className="pb-4">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 mb-1 border border-emerald-500/20">
                                    Contrato Ativo
                                  </span>
                                  <p className="text-sm text-text-base font-medium capitalize">
                                    Plano{" "}
                                    {editingAssociado.plano_nome || "Nenhum"}
                                  </p>
                                  <p className="text-xs text-text-muted mt-0.5">
                                    Valor: R$ {valorPlanoAtivo.toFixed(2).replace(".", ",")}
                                  </p>
                                  <p className="text-xs text-text-subtle mt-1">
                                    Desde{" "}
                                    {editingAssociado.data_adesao
                                      ? formatDateSafe(editingAssociado.data_adesao)
                                      : "Data não definida"}
                                  </p>
                                </div>
                              </div>
                              {editingAssociado.historico_contratos &&
                                editingAssociado.historico_contratos.map(
                                  (hist) => (
                                    <div className="flex gap-4" key={hist.id}>
                                      <div className="mt-1">
                                        <div className="w-2 h-2 rounded-full bg-[#60A5FA]"></div>
                                        <div className="w-0.5 h-full bg-bg-hover mx-auto mt-1"></div>
                                      </div>
                                      <div className="pb-4">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#60A5FA]/10 text-[#60A5FA] mb-1 border border-[#60A5FA]/20">
                                          Anterior
                                        </span>
                                        <p className="text-sm text-text-base font-medium capitalize">
                                          Plano {hist.plano}
                                        </p>
                                        <p className="text-xs text-text-muted mt-0.5">
                                          Valor: R 
                                          {hist.valor
                                            .toFixed(2)
                                            .replace(".", ",")}
                                        </p>
                                        <p className="text-xs text-text-subtle mt-1">
                                          {formatDateSafe(hist.data_inicio)}{" "}
                                          {hist.data_fim
                                            ? `até ${formatDateSafe(hist.data_fim)}`
                                            : ""}
                                        </p>
                                      </div>
                                    </div>
                                  ),
                                )}
                              <div className="flex gap-4">
                                <div className="mt-1">
                                  <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                                </div>
                                <div>
                                  <p className="text-sm text-text-subtle font-medium">
                                    Adesão Inicial
                                  </p>
                                  <p className="text-xs text-text-subtle mt-0.5">
                                    {editingAssociado.data_adesao
                                      ? formatDateSafe(editingAssociado.data_adesao)
                                      : "Data não definida"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                          ) : (
                            <div className="p-6 bg-bg-surface border border-border-default rounded-xl max-w-2xl">
                               {(() => {
                                 const hist = editingAssociado.historico_contratos?.find(h => h.id === selectedContratoId);
                                 if (!hist) return <p className="text-text-subtle">Contrato não encontrado.</p>;
                                 return (
                                   <div className="space-y-6">
                                     <h5 className="text-xl font-bold text-text-base">Plano {hist.plano}</h5>
                                     <div className="grid grid-cols-2 gap-6">
                                       <div className="bg-bg-subtle p-4 rounded-lg border border-border-default">
                                         <span className="text-xs font-semibold uppercase text-text-subtle block mb-1">Valor do Plano</span>
                                         <span className="text-lg font-medium text-text-base">R$ {hist.valor.toFixed(2).replace('.', ',')}</span>
                                       </div>
                                       <div className="bg-bg-subtle p-4 rounded-lg border border-border-default">
                                         <span className="text-xs font-semibold uppercase text-text-subtle block mb-1">Período</span>
                                         <span className="text-sm text-text-base">{formatDateSafe(hist.data_inicio)} a {hist.data_fim ? formatDateSafe(hist.data_fim) : "-"}</span>
                                       </div>
                                     </div>
                                   </div>
                                 );
                               })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : activeTab === "mensalidades" ? (
                    <MensalidadesTab associado={editingAssociado} onSuccess={() => setActiveTab("documentos")} />
                  ) : activeTab === "requisicoes" ? (
                    <AssociadoRequisicoesTab associado={editingAssociado} />
                  ) : activeTab === "atendimentos" ? (
                    <AssociadoAtendimentosTab associado={editingAssociado} />
                  ) : activeTab === "documentos" ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-border-default pb-4">
                        <h4 className="text-text-base font-medium">
                          Documentos do Associado
                        </h4>
                      </div>
                      
                      <div className="bg-bg-subtle p-6 rounded-2xl border border-border-default/50 mb-6">
                        <ContratoDocumentosGenerator associado={editingAssociado} valorMensalidade={valorPlanoAtivo} />
                      </div>

                      <div className="space-y-4">
                        <div className="border-2 border-dashed border-border-default rounded-xl p-8 flex flex-col items-center justify-center bg-bg-surface/50">
                          <input
                            type="file"
                            id="upload-doc"
                            className="hidden"
                            accept=".pdf,image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Simulate an upload by just adding to local list
                                const novoDoc = {
                                  id: uuidv4(),
                                  nome: file.name,
                                  url: URL.createObjectURL(file), // Temp URL for preview
                                  tipo: file.type,
                                  tamanho: file.size,
                                  data_upload: new Date().toISOString(),
                                };
                                setEditingAssociado({
                                  ...editingAssociado,
                                  documentos: [
                                    ...(editingAssociado.documentos || []),
                                    novoDoc,
                                  ],
                                });
                              }
                            }}
                          />
                          <label
                            htmlFor="upload-doc"
                            className="cursor-pointer flex flex-col items-center"
                          >
                            <div className="w-12 h-12 bg-bg-hover rounded-full flex items-center justify-center mb-3">
                              <Plus className="w-6 h-6 text-[#3B82F6]" />
                            </div>
                            <p className="text-sm font-medium text-text-base mb-1">
                              Clique para enviar um documento
                            </p>
                            <p className="text-xs text-text-subtle">
                              PDF, JPG, PNG (máx. 5MB)
                            </p>
                          </label>
                        </div>

                        {editingAssociado.documentos &&
                          editingAssociado.documentos.length > 0 && (
                            <div className="space-y-3 mt-6">
                              <h5 className="text-sm font-semibold text-text-subtle">
                                Arquivos Salvos
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {editingAssociado.documentos.map((doc, idx) => (
                                  <div
                                    key={doc.id}
                                    className="flex items-center justify-between p-3 bg-bg-surface border border-border-default rounded-lg group"
                                  >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                      <div className="w-10 h-10 bg-bg-subtle rounded flex items-center justify-center shrink-0">
                                        <span className="text-xs font-bold text-text-subtle uppercase">
                                          {doc.nome.split(".").pop()}
                                        </span>
                                      </div>
                                      <div className="overflow-hidden">
                                        <p className="text-sm text-text-base font-medium truncate">
                                          {doc.nome}
                                        </p>
                                        <p className="text-xs text-text-subtle">
                                          {(doc.tamanho / 1024).toFixed(1)} KB •{" "}
                                          {new Date(
                                            doc.data_upload,
                                          ).toLocaleDateString("pt-BR")}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <a
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 text-text-subtle hover:text-blue-400 transition-colors"
                                      >
                                        <Search className="w-4 h-4" />
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const novosDocs = [
                                            ...editingAssociado.documentos!,
                                          ];
                                          novosDocs.splice(idx, 1);
                                          setEditingAssociado({
                                            ...editingAssociado,
                                            documentos: novosDocs,
                                          });
                                        }}
                                        className="p-1.5 text-text-subtle hover:text-rose-500 transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-border-default bg-bg-surface/50 flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
                  >
                    Cancelar
                  </button>
                  <div className="flex gap-3">
                    {isEditingMode ? (
                      <button
                        type="submit"
                        disabled={!state.isOnline}
                        className="px-4 py-2 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25 disabled:opacity-50"
                      >
                        Salvar Alterações
                      </button>
                    ) : (
                      <>
                        {activeTab !== "principal" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (activeTab === "atendimentos")
                                setActiveTab("requisicoes");
                              else if (activeTab === "requisicoes")
                                setActiveTab("documentos");
                              else if (activeTab === "documentos")
                                setActiveTab("mensalidades");
                              else if (activeTab === "mensalidades")
                                setActiveTab("contratos");
                              else if (activeTab === "contratos")
                                setActiveTab("dependentes");
                              else if (activeTab === "dependentes")
                                setActiveTab("principal");
                            }}
                            className="px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
                          >
                            Voltar
                          </button>
                        )}

                        {(isEditingMode ? activeTab !== "atendimentos" : activeTab !== "documentos") ? (
                          <button
                            key="btn-next"
                            type="button"
                            onClick={() => {
                              const form = document.getElementById(
                                "associado-form",
                              ) as HTMLFormElement;
                              if (form && !form.checkValidity()) {
                                form.reportValidity();
                                toast.error("Preencha todos os campos obrigatórios (*) antes de prosseguir.");
                                return;
                              }
                              if (activeTab === "principal")
                                setActiveTab("dependentes");
                              else if (activeTab === "dependentes")
                                setActiveTab("contratos");
                              else if (activeTab === "contratos")
                                setActiveTab("mensalidades");
                              else if (activeTab === "mensalidades")
                                setActiveTab("documentos");
                              else if (activeTab === "documentos")
                                setActiveTab("requisicoes");
                              else if (activeTab === "requisicoes")
                                setActiveTab("atendimentos");
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25"
                          >
                            Próximo
                          </button>
                        ) : (
                          <button
                            key="btn-submit"
                            type="submit"
                            disabled={!state.isOnline}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                          >
                            {isEditingMode ? 'Salvar Alterações' : 'Finalizar Cadastro'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDependentesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface w-full max-w-3xl rounded-3xl shadow-2xl border border-border-default overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-border-default flex items-center justify-between sticky top-0 bg-bg-surface/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl">
                  <Heart className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-text-base">Lista de Dependentes</h3>
              </div>
              <button
                onClick={() => setShowDependentesModal(false)}
                className="p-2 text-text-subtle hover:bg-bg-subtle rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 border-b border-border-default">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Buscar por nome do dependente ou titular..."
                  value={buscaDependentes}
                  onChange={(e) => setBuscaDependentes(e.target.value)}
                  className="w-full bg-bg-subtle border border-border-default rounded-xl pl-10 pr-4 py-2.5 text-text-base focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all"
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-bg-subtle border border-border-default rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-text-subtle">
                    <thead className="bg-bg-surface border-b border-border-default text-xs uppercase font-semibold text-text-muted">
                      <tr>
                        <th className="px-6 py-4">Nome do Dependente</th>
                        <th className="px-6 py-4">Parentesco</th>
                        <th className="px-6 py-4">Titular</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {dependentesFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-text-muted">
                            Nenhum dependente encontrado.
                          </td>
                        </tr>
                      ) : (
                        dependentesFiltrados.map((d, index) => (
                          <tr key={index} className="hover:bg-bg-surface/50 transition-colors">
                            <td className="px-6 py-4 text-text-base font-medium">{d.nome}</td>
                            <td className="px-6 py-4 capitalize">{d.parentesco || 'Não informado'}</td>
                            <td className="px-6 py-4 text-text-base">{d.titular_nome}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-border-default flex justify-end bg-bg-subtle/50">
              <button
                onClick={() => setShowDependentesModal(false)}
                className="px-6 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showModificarPlanoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface w-full max-w-lg rounded-3xl shadow-2xl border border-border-default overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border-default flex items-center justify-between bg-bg-surface/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#3B82F6]/10 rounded-xl">
                  <Edit2 className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <h3 className="text-lg font-bold text-text-base">Modificar Plano</h3>
              </div>
              <button
                onClick={() => setShowModificarPlanoModal(false)}
                className="p-2 text-text-subtle hover:bg-bg-subtle rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {modificarPlanoStep === "confirmar" && (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-rose-500" />
                  </div>
                  <h4 className="text-xl font-bold text-text-base">Atenção!</h4>
                  <p className="text-text-subtle leading-relaxed">
                    Você está prestes a iniciar o processo de modificação do plano atual do associado. 
                    Esta ação afetará o contrato vigente. Deseja continuar?
                  </p>
                  
                  <div className="flex justify-center gap-4 pt-4">
                    <button
                      onClick={() => setShowModificarPlanoModal(false)}
                      className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base rounded-xl font-medium hover:bg-bg-hover transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => setModificarPlanoStep("justificativa")}
                      className="px-6 py-2.5 bg-[#3B82F6] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}
              
              {modificarPlanoStep === "justificativa" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-bold text-text-base mb-2">Justificativa</h4>
                    <p className="text-sm text-text-subtle">
                      Por favor, informe o motivo para a alteração de plano deste associado.
                    </p>
                  </div>
                  
                  <textarea
                    value={justificativaModificacao}
                    onChange={(e) => setJustificativaModificacao(e.target.value)}
                    rows={4}
                    placeholder="Ex: Upgrade de plano solicitado pelo cliente, ajuste de valores..."
                    className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-base focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all resize-none"
                  ></textarea>
                  
                  <div className="flex justify-end gap-4 pt-4">
                    <button
                      onClick={() => setModificarPlanoStep("confirmar")}
                      className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base rounded-xl font-medium hover:bg-bg-hover transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      disabled={!justificativaModificacao.trim()}
                      onClick={() => setModificarPlanoStep("selecionar")}
                      className="px-6 py-2.5 bg-[#3B82F6] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#3B82F6]/25 disabled:opacity-50"
                    >
                      Avançar
                    </button>
                  </div>
                </div>
              )}
              
              {modificarPlanoStep === "selecionar" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-bold text-text-base mb-2">Novo Plano</h4>
                    <p className="text-sm text-text-subtle">
                      Selecione o novo plano para o associado. A alteração será efetivada ao salvar o cadastro.
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <PlanoPaxSelect
                      value={novoPlanoSelecionado}
                      onChange={(id) => {
                        setNovoPlanoSelecionado(id);
                      }}
                      nVidas={1 + (editingAssociado?.dependentes?.length || 0)}
                      idadesDependentes={editingAssociado?.dependentes?.filter(d => d.data_nascimento).map(d => {
                        const ageDifMs = Date.now() - new Date(d.data_nascimento).getTime();
                        const ageDate = new Date(ageDifMs);
                        return Math.abs(ageDate.getUTCFullYear() - 1970);
                      }) || []}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-border-default">
                    <button
                      onClick={() => setModificarPlanoStep("justificativa")}
                      className="px-6 py-2.5 bg-bg-subtle border border-border-default text-text-base rounded-xl font-medium hover:bg-bg-hover transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      disabled={!novoPlanoSelecionado}
                      onClick={() => {
                        if (editingAssociado) {
                          setEditingAssociado({
                            ...editingAssociado,
                            plano_pax_id: novoPlanoSelecionado,
                            justificativa_modificacao_plano: justificativaModificacao
                          } as any);
                        }
                        setShowModificarPlanoModal(false);
                      }}
                      className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                    >
                      Confirmar Modificação
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showNovoContrato && editingAssociado && (
        <NovoContratoWizard 
          associadoInicial={editingAssociado}
          onClose={() => setShowNovoContrato(false)}
          onSuccess={() => {
            setShowNovoContrato(false);
            loadData();
            handleCloseModal();
          }}
        />
      )}
    </div>
  );
};
