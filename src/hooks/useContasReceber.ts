import { useColumnVisibility } from '../hooks/useColumnVisibility';
import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { useAppContext } from '../context/AppContext';
import { getContasBancariasAtivas } from '../services/contasBancariasService';
import { ContaBancaria } from '../types/contasBancarias';
import { useConfirm } from '../context/ConfirmContext';
import { getParcelasReceber, getReceitas, ParcelaReceber, registrarRecebimento, excluirParcelaReceber, excluirReceita, getReceitaById, Receita } from '../services/financeiroService';
import { getLoteAbertoAtivo, registrarMovimentacao } from '../services/caixasService';
import { usePlanoContabil } from '../hooks/usePlanoContabil';
import { indicePorLancamento, parcelaCasaClassificacao } from '../utils/filtrosClassificacao';
import { getEmpresaById, Empresa } from '../services/empresasService';
import { getAssociados, Associado } from '../services/associadosService';

import { ReciboDados } from '../components/financeiro/VisualizadorReciboModal';
import { avisoLiquidacaoSemCaixa } from '../utils/avisoLiquidacaoSemCaixa';
import { montarReciboDeRecebimento } from '../utils/reciboRecebimento';
import { MENSAGEM_TENANT_INDEFINIDO, tenantDeEscrita } from '../utils/tenant';

import { LoteCaixa } from '../types/caixas';
import { canDelete } from '../utils/permissions';

import { format } from 'date-fns';
import { parseLocalDate, formatLocalDate, isDateBeforeToday, isDateToday } from '../utils/dateUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { sendWhatsAppMessage, generateCobrançaTemplate } from '../utils/whatsapp';

/**
 * O estado e os dados da tela de Contas a Receber, extraídos VERBATIM do corpo de
 * `pages/ContasReceberPage.tsx` (1574 linhas) — carga, filtros, ordenação, os dois modais e os
 * handlers de baixa, exclusão e recibo.
 *
 * A fronteira é "não devolve JSX": `getStatusBadge` ficou no componente, e não por
 * conveniência — é a única função daquele corpo que vira pixel, e um `.ts` sequer compila com
 * ela dentro.
 *
 * As fatias de UI tipam as próprias props com `Pick<ReturnType<typeof useContasReceber>, …>`,
 * então acrescentar ou renomear um campo do retorno é cobrado pelo `tsc` em cada uma delas.
 */
export const useContasReceber = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useAppContext();
  const { confirm } = useConfirm();

  const [parcelas, setParcelas] = useState<ParcelaReceber[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [empresaData, setEmpresaData] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReciboModal, setShowReciboModal] = useState(false);
  const [reciboModalData, setReciboModalData] = useState<ReciboDados | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [contaContabilFilter, setContaContabilFilter] = useState('');

  // Identifica o devedor/associado e recupera seu telefone de contato cadastrado
  const getDevedorContato = useCallback((parcela: ParcelaReceber) => {
    const recPai = receitas.find(r => r.id === parcela.receita_id);

    let assoc: Associado | undefined;

    // 1. Pelo associado_id na receita pai
    if (recPai?.associado_id) {
      assoc = associados.find(a => a.id === recPai.associado_id);
    }

    // 2. Pelo associado_id direto na parcela se existir
    if (!assoc && (parcela as any)?.associado_id) {
      assoc = associados.find(a => a.id === (parcela as any).associado_id);
    }

    // 3. Pelo CPF do devedor / associado
    if (!assoc) {
      const rawCpf = (parcela.devedor_cpf_cnpj || recPai?.associado_cpf || recPai?.cliente_cpf_cnpj || '').replace(/\D/g, '');
      if (rawCpf && rawCpf.length === 11) {
        assoc = associados.find(a => (a.cpf || '').replace(/\D/g, '') === rawCpf);
      }
    }

    // 4. Pelo Nome exato ou aproximado do devedor / associado
    if (!assoc) {
      const rawNome = (parcela.devedor_nome || recPai?.associado_nome || recPai?.cliente_nome || '').trim().toLowerCase();
      if (rawNome) {
        assoc = associados.find(a => (a.nome || '').trim().toLowerCase() === rawNome);
      }
    }

    const telefone = assoc?.telefone || 
                     (assoc as any)?.celular_whatsapp || 
                     (assoc as any)?.celular || 
                     (assoc as any)?.whatsapp || 
                     recPai?.cliente_telefone || 
                     '';

    const nome = assoc?.nome || 
                 recPai?.associado_nome || 
                 recPai?.cliente_nome || 
                 parcela.devedor_nome || 
                 'Cliente';

    return {
      associado: assoc,
      telefone: telefone ? String(telefone).trim() : '',
      nome,
      receitaPai: recPai
    };
  }, [receitas, associados]);

  // Envia mensagem de cobrança personalizada utilizando o telefone do cadastro
  const handleWhatsAppCobrança = async (parcela: ParcelaReceber) => {
    const { telefone: telefoneCadastrado, nome: nomeCliente } = getDevedorContato(parcela);
    
    const msg = await generateCobrançaTemplate(
      nomeCliente, 
      parcela.valor, 
      formatLocalDate(parcela.data_vencimento),
      {
        empresa: empresaData?.nome_fantasia || 'ERAS PAX',
        descricao: parcela.descricao
      }
    );

    let phone = telefoneCadastrado;

    // Se não tiver telefone no cadastro, solicita confirmação/digitação como fallback
    if (!phone) {
      const promptPhone = window.prompt(
        `O associado/devedor "${nomeCliente}" não possui telefone cadastrado.\n\nDigite o número de WhatsApp com DDD para enviar a cobrança:`, 
        ""
      );
      if (!promptPhone) return;
      phone = promptPhone;
    }

    const success = sendWhatsAppMessage(phone, msg);
    if (!success) {
      const phoneCorrection = window.prompt(
        `O número "${phone}" parece inválido.\nPor favor, confirme ou digite o número correto de WhatsApp com DDD:`,
        phone
      );
      if (phoneCorrection) {
        const retrySuccess = sendWhatsAppMessage(phoneCorrection, msg);
        if (!retrySuccess) {
          toast.error("Número de telefone inválido.");
        } else {
          toast.success(`WhatsApp aberto com mensagem de cobrança para ${nomeCliente}!`);
        }
      }
    } else {
      toast.success(`WhatsApp aberto com mensagem de cobrança para ${nomeCliente}!`);
    }
  };

  useEffect(() => {
    if (parcelas.length > 0 && location.state?.openDetails) {
      const p = parcelas.find((x: any) => x.id === location.state.openDetails);
      if (p) {
        setParcelaDetalhes(p);
        setShowDetalhesModal(true);
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [parcelas, location.state, navigate, location.pathname]);

  const { visibleColumns, isVisible, setVisibleColumns } = useColumnVisibility(['devedor', 'descricao', 'vencimento', 'valor', 'status', 'acoes']);
  const columns = [
    { id: 'devedor', label: 'Devedor' },
    { id: 'descricao', label: 'Descrição' },
    { id: 'vencimento', label: 'Vencimento' },
    { id: 'valor', label: 'Valor' },
    { id: 'status', label: 'Status' },
    { id: 'acoes', label: 'Ações' }
  ];
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [formaPagamentoFilter, setFormaPagamentoFilter] = useState('');
  const [sortField, setSortField] = useState<'devedor' | 'vencimento' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal de Baixa/Recebimento
  const [showBaixaModal, setShowBaixaModal] = useState(false);
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaReceber | null>(null);
  const [dataRecebimento, setDataRecebimento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [valorRecebido, setValorRecebido] = useState<number>(0);
  const [formaPagamentoEfetiva, setFormaPagamentoEfetiva] = useState<string>('pix');
  const [observacaoRecebimento, setObservacaoRecebimento] = useState<string>('');
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [contaBancariaId, setContaBancariaId] = useState<string>('');

  // Verificação e fluxo do Lote de Caixa
  const [modalStage, setModalStage] = useState<'form' | 'confirmacao' | 'bloqueio'>('form');
  const [loteAberto, setLoteAberto] = useState<LoteCaixa | null>(null);
  const [checkingLote, setCheckingLote] = useState(false);
  const [submittingBaixa, setSubmittingBaixa] = useState(false);

  // Modal de Detalhes
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [parcelaDetalhes, setParcelaDetalhes] = useState<ParcelaReceber | null>(null);
  const [receitaPai, setReceitaPai] = useState<Receita | null>(null);
  const [showRelatorioModal, setShowRelatorioModal] = useState(false);
  const [showMapaCalorModal, setShowMapaCalorModal] = useState(false);
  /**
   * Qual relatório gerar — a escolha é do operador, e por isso é uma pergunta explícita.
   *
   * Os dois respondem a perguntas diferentes sobre os MESMOS filtros: o tradicional lista
   * as parcelas em ordem de vencimento (o que o financeiro confere), o mapa de zonas diz
   * onde está concentrado o valor a receber (o que o cobrador usa para montar a rota).
   * Trocar um pelo outro tiraria de alguém o relatório que ele já usa.
   */
  const [showEscolhaRelatorio, setShowEscolhaRelatorio] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (state.empresaSelecionada) {
        const [contas, emp, assocs] = await Promise.all([
          getContasBancariasAtivas(state.empresaSelecionada, state.isOnline),
          getEmpresaById(state.empresaSelecionada, state.isOnline),
          getAssociados(state.isOnline, state.empresaSelecionada)
        ]);
        setContasBancarias(contas);
        if (emp) setEmpresaData(emp);
        if (assocs) setAssociados(assocs);
      } else {
        // Sem empresa selecionada, 'all' desligava o filtro de tenant e trazia
        // associados de todas as empresas. Mesmo tratamento das demais telas
        // (ver ContasReceberFormPage): cai no tenant padrão, não em tudo.
        const assocs = await getAssociados(state.isOnline, 'empresa_padrao');
        if (assocs) setAssociados(assocs);
      }
      const [dataParcelas, dataReceitas] = await Promise.all([
        getParcelasReceber(state.isOnline, state.empresaSelecionada || 'all'),
        getReceitas(state.isOnline, state.empresaSelecionada || 'all')
      ]);
      setParcelas(dataParcelas);
      setReceitas(dataReceitas);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar parcelas a receber');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  // Conta desativada continua na lista de propósito: um lançamento antigo pode apontar para
  // ela, e sem a opção no filtro ele viraria infiltrável. Receita não tem centro de custo —
  // esse campo é só de despesa.
  const { contas: contasContabeis } = usePlanoContabil();
  const contasReceita = useMemo(
    () => contasContabeis.filter((c) => c.tipo === 'analitica' && c.natureza === 'receita'),
    [contasContabeis],
  );

  // A parcela não carrega a classificação — quem carrega é a receita.
  const indiceReceitas = useMemo(() => indicePorLancamento(receitas), [receitas]);

  const filteredParcelas = useMemo(() => {
    return parcelas.filter(p => {
      const matchesSearch = (p.devedor_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (p.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (p.devedor_cpf_cnpj || '').includes(searchTerm);
      
      let matchesStatus = true;
      if (statusFilter === 'pendente') {
        matchesStatus = p.status === 'pendente';
      } else if (statusFilter === 'vencido') {
        matchesStatus = p.status === 'pendente' && isDateBeforeToday(p.data_vencimento);
      } else if (statusFilter === 'vence_hoje') {
        matchesStatus = p.status === 'pendente' && isDateToday(p.data_vencimento);
      } else if (statusFilter === 'a_vencer') {
        matchesStatus = p.status === 'pendente' && !isDateBeforeToday(p.data_vencimento) && !isDateToday(p.data_vencimento);
      } else if (statusFilter === 'recebido' || statusFilter === 'pago') {
        matchesStatus = p.status === 'recebido' || p.status === 'pago';
      } else if (statusFilter === 'cancelado') {
        matchesStatus = p.status === 'cancelado';
      } else if (statusFilter) {
        matchesStatus = p.status === statusFilter;
      }

      const matchesForma = formaPagamentoFilter ? p.forma_pagamento === formaPagamentoFilter : true;
      
      let matchesData = true;
      if (dataInicial || dataFinal) {
        const pDate = parseLocalDate(p.data_vencimento);
        if (pDate) {
          pDate.setHours(0, 0, 0, 0);
          if (dataInicial) {
            const dInit = parseLocalDate(dataInicial);
            if (dInit) {
              dInit.setHours(0, 0, 0, 0);
              if (dInit > pDate) matchesData = false;
            }
          }
          if (dataFinal) {
            const dEnd = parseLocalDate(dataFinal);
            if (dEnd) {
              dEnd.setHours(23, 59, 59, 999);
              if (dEnd < pDate) matchesData = false;
            }
          }
        }
      }
      
      const matchesClassificacao = parcelaCasaClassificacao(p.receita_id, indiceReceitas, {
        contaContabilId: contaContabilFilter,
      });

      return matchesSearch && matchesStatus && matchesForma && matchesData && matchesClassificacao;
    });
  }, [parcelas, searchTerm, statusFilter, formaPagamentoFilter, dataInicial, dataFinal,
      indiceReceitas, contaContabilFilter]);

  const sortedParcelas = useMemo(() => {
    if (!sortField) return filteredParcelas;
    return [...filteredParcelas].sort((a, b) => {
      if (sortField === 'devedor') {
        const nameA = a.devedor_nome || '';
        const nameB = b.devedor_nome || '';
        return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (sortField === 'vencimento') {
        const dateA = parseLocalDate(a.data_vencimento)?.getTime() || 0;
        const dateB = parseLocalDate(b.data_vencimento)?.getTime() || 0;
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      return 0;
    });
  }, [filteredParcelas, sortField, sortDirection]);

  const openBaixaModal = (parcela: ParcelaReceber) => {
    setParcelaSelecionada(parcela);
    setDataRecebimento(format(new Date(), 'yyyy-MM-dd'));
    setValorRecebido(parcela.valor);
    setFormaPagamentoEfetiva(parcela.forma_pagamento || 'pix');
    setContaBancariaId(parcela.conta_bancaria_id || (contasBancarias.length > 0 ? contasBancarias[0].id : ''));
    setObservacaoRecebimento('');
    setLoteAberto(null);
    setModalStage('form');
    setShowBaixaModal(true);
  };

  const handleBaixa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcelaSelecionada) return;

    // `getLotesCaixa` não filtra quando recebe `'all'`: sem empresa resolvida, o
    // super_admin receberia o lote aberto de **outra** empresa e a movimentação cairia no
    // caixa dela. E `'tenant-default'` carimbaria um tenant que não existe.
    const tenantId = tenantDeEscrita(state.empresaSelecionada, state.user?.tenant_id);
    if (!tenantId) {
      toast.error(MENSAGEM_TENANT_INDEFINIDO);
      return;
    }

    setCheckingLote(true);
    try {
      const activeLote = await getLoteAbertoAtivo(state.isOnline, tenantId);
      if (!activeLote) {
        setLoteAberto(null);
        setModalStage('bloqueio');
      } else {
        setLoteAberto(activeLote);
        setModalStage('confirmacao');
      }
    } catch (err) {
      console.error('Erro ao verificar lote de caixa:', err);
      toast.error('Erro ao verificar status do Lote de Caixa');
    } finally {
      setCheckingLote(false);
    }
  };

  const handleEfetivarRecebimento = async () => {
    if (!state.isOnline) {
      toast.error('Baixa de recebimento bloqueada no Modo de Visualização (Offline).');
      return;
    }
    if (!parcelaSelecionada || !loteAberto) return;

    const tenantId = tenantDeEscrita(state.empresaSelecionada, state.user?.tenant_id);
    if (!tenantId) {
      toast.error(MENSAGEM_TENANT_INDEFINIDO);
      return;
    }
    // Uma data só para a baixa, a movimentação e o recibo — recalcular em cada ponto daria
    // instantes diferentes perto da meia-noite.
    const liquidacaoISO = dataRecebimento
      ? new Date(dataRecebimento + 'T12:00:00').toISOString()
      : new Date().toISOString();
    const valorEfetivo = Number(valorRecebido) || parcelaSelecionada.valor;

    setSubmittingBaixa(true);
    try {
      await registrarRecebimento(state.isOnline, parcelaSelecionada.id, {
        data_recebimento: liquidacaoISO,
        valor_recebido: valorEfetivo,
        forma_pagamento_efetivo: formaPagamentoEfetiva,
        conta_bancaria_id: formaPagamentoEfetiva !== 'dinheiro' ? contaBancariaId : null,
        recebido_por: state.user?.nome || 'Sistema',
        observacao: observacaoRecebimento
      });

      // Registra a movimentação financeira diretamente no Lote de Caixa Aberto.
      // A baixa acima já valeu: uma recusa aqui não a desfaz, e o aviso diz o que faltou.
      let caixaLancado = true;
      try {
        await registrarMovimentacao(state.isOnline, {
          tenant_id: tenantId,
          lote_id: loteAberto.id,
          tipo: 'entrada',
          origem: 'contas_receber',
          categoria: 'Receita / Mensalidade',
          descricao: `Recebimento: ${parcelaSelecionada.devedor_nome} - ${parcelaSelecionada.descricao}`,
          valor: valorEfetivo,
          forma_pagamento: formaPagamentoEfetiva as any,
          data_movimentacao: liquidacaoISO,
          referencia_id: parcelaSelecionada.id,
          documento_ref: `Parc. ${parcelaSelecionada.numero_parcela}/${parcelaSelecionada.total_parcelas || 1}`,
          operador_nome: state.user?.nome || loteAberto.operador_nome || 'Sistema',
          observacao: observacaoRecebimento
        });
      } catch (errCaixa: any) {
        caixaLancado = false;
        console.error('Movimentação de caixa recusada após a baixa da parcela:', errCaixa);
        toast.error(avisoLiquidacaoSemCaixa('recebimento', errCaixa?.message), { duration: 12000 });
      }

      if (caixaLancado) {
        toast.success(`Recebimento registrado com sucesso no Lote ${loteAberto.codigo_lote}!`);
      }
      // O comprovante abre sozinho: quem acabou de receber precisa entregá-lo na hora, e
      // depender de o operador achar a linha e clicar em "Imprimir Recibo" é como um
      // recebimento termina sem documento nenhum.
      const receitaPaiDaParcela = receitas.find((r) => r.id === parcelaSelecionada.receita_id);
      setReciboModalData(
        montarReciboDeRecebimento(
          parcelaSelecionada,
          {
            dataLiquidacaoISO: liquidacaoISO,
            valorRecebido: valorEfetivo,
            formaPagamento: formaPagamentoEfetiva,
            operadorNome: state.user?.nome,
            observacao: observacaoRecebimento,
          },
          {
            nomeFallback: receitaPaiDaParcela?.associado_nome || receitaPaiDaParcela?.cliente_nome,
            documentoFallback: receitaPaiDaParcela?.associado_cpf || receitaPaiDaParcela?.cliente_cpf_cnpj,
            categoriaFallback: receitaPaiDaParcela?.categoria,
            planoFallback: receitaPaiDaParcela?.associado_plano,
          },
        ),
      );
      setShowReciboModal(true);
      setShowBaixaModal(false);
      loadData();
    } catch (err: any) {
      console.error('Erro ao efetivar recebimento:', err);
      toast.error(err?.message || 'Erro ao efetivar recebimento');
    } finally {
      setSubmittingBaixa(false);
    }
  };

  const openDetalhes = async (parcela: ParcelaReceber) => {
    setParcelaDetalhes(parcela);
    setShowDetalhesModal(true);
    if (parcela.receita_id) {
      const parent = await getReceitaById(state.isOnline, parcela.receita_id);
      setReceitaPai(parent);
    } else {
      setReceitaPai(null);
    }
  };

  const handleExcluirParcela = (parcela: ParcelaReceber) => {
    if (!canDelete(state.user, state.isOnline)) {
      toast.error(
        !state.isOnline
          ? 'Exclusão bloqueada no Modo de Visualização (Offline).'
          : 'Permissão negada. Somente usuários Administradores podem excluir registros no sistema.'
      );
      return;
    }

    confirm({
      title: 'Excluir Parcela',
      message: `Deseja realmente excluir a parcela ${parcela.numero_parcela}/${parcela.total_parcelas} de R$ ${parcela.valor.toFixed(2)} (${parcela.devedor_nome})?`,
      confirmText: 'Excluir Parcela',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        try {
          await excluirParcelaReceber(state.isOnline, parcela.id);
          setParcelas(prev => prev.filter(p => p.id !== parcela.id));
          toast.success('Parcela excluída com sucesso!');
          loadData();
        } catch (e) {
          const detalhe = e instanceof Error ? e.message : '';
          toast.error(detalhe || 'Erro ao excluir parcela');
        }
      }
    });
  };

  const handleExcluirReceitaCompleta = (receitaId: string, descricao: string) => {
    if (!canDelete(state.user, state.isOnline)) {
      toast.error(
        !state.isOnline
          ? 'Exclusão bloqueada no Modo de Visualização (Offline).'
          : 'Permissão negada. Somente usuários Administradores podem excluir registros no sistema.'
      );
      return;
    }

    confirm({
      title: 'Excluir Receita Inteira',
      message: `Atenção: Esta ação excluirá permanentemente a receita "${descricao}" e TODAS as suas parcelas vinculadas. Deseja continuar?`,
      confirmText: 'Excluir Tudo',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        try {
          await excluirReceita(state.isOnline, receitaId);
          setParcelas(prev => prev.filter(p => p.receita_id !== receitaId));
          toast.success('Receita e parcelas excluídas com sucesso!');
          if (showDetalhesModal) setShowDetalhesModal(false);
          loadData();
        } catch (e) {
          toast.error('Erro ao excluir receita');
        }
      }
    });
  };

  // Reimpressão do comprovante de uma parcela já recebida. Mesma função pura da baixa —
  // as duas telas montavam este objeto à mão, com fallbacks diferentes entre si.
  const handleImprimirRecibo = (parcela: ParcelaReceber) => {
    const receitaPai = receitas.find(r => r.id === parcela.receita_id);
    setReciboModalData(
      montarReciboDeRecebimento(
        parcela,
        {},
        {
          nomeFallback: receitaPai?.associado_nome || receitaPai?.cliente_nome,
          documentoFallback: receitaPai?.associado_cpf || receitaPai?.cliente_cpf_cnpj,
          categoriaFallback: receitaPai?.categoria,
          planoFallback: receitaPai?.associado_plano,
          operadorFallback: state.user?.nome,
        },
      ),
    );
    setShowReciboModal(true);
  };

  return {
    navigate,
    state,
    parcelas,
    receitas,
    associados,
    empresaData,
    loading,
    showReciboModal,
    setShowReciboModal,
    reciboModalData,
    searchTerm,
    setSearchTerm,
    contaContabilFilter,
    setContaContabilFilter,
    getDevedorContato,
    handleWhatsAppCobrança,
    isVisible,
    statusFilter,
    setStatusFilter,
    showFilters,
    setShowFilters,
    dataInicial,
    setDataInicial,
    dataFinal,
    setDataFinal,
    formaPagamentoFilter,
    setFormaPagamentoFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    showBaixaModal,
    setShowBaixaModal,
    parcelaSelecionada,
    dataRecebimento,
    setDataRecebimento,
    valorRecebido,
    setValorRecebido,
    formaPagamentoEfetiva,
    setFormaPagamentoEfetiva,
    observacaoRecebimento,
    setObservacaoRecebimento,
    contasBancarias,
    contaBancariaId,
    setContaBancariaId,
    modalStage,
    setModalStage,
    loteAberto,
    checkingLote,
    submittingBaixa,
    showDetalhesModal,
    setShowDetalhesModal,
    parcelaDetalhes,
    receitaPai,
    showRelatorioModal,
    setShowRelatorioModal,
    showMapaCalorModal,
    setShowMapaCalorModal,
    showEscolhaRelatorio,
    setShowEscolhaRelatorio,
    contasReceita,
    sortedParcelas,
    openBaixaModal,
    handleBaixa,
    handleEfetivarRecebimento,
    openDetalhes,
    handleExcluirParcela,
    handleExcluirReceitaCompleta,
    handleImprimirRecibo,
  };
};
