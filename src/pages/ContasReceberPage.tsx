import React from 'react';

import { RelatorioContasReceberModal } from '../components/financeiro/RelatorioContasReceberModal';
import { RelatorioMapaCalorModal } from '../components/financeiro/RelatorioMapaCalorModal';
import { VisualizadorReciboModal } from '../components/financeiro/VisualizadorReciboModal';

import { IndicadoresContasReceber } from '../components/financeiro/IndicadoresContasReceber';

import { isDateBeforeToday } from '../utils/dateUtils';


import { useContasReceber } from '../hooks/useContasReceber';
import { ContasReceberCabecalho } from '../components/financeiro/ContasReceberCabecalho';
import { ContasReceberFiltros } from '../components/financeiro/ContasReceberFiltros';
import { ContasReceberTabela } from '../components/financeiro/ContasReceberTabela';
import { ContasReceberBaixaModal } from '../components/financeiro/ContasReceberBaixaModal';
import { ContasReceberDetalhesModal } from '../components/financeiro/ContasReceberDetalhesModal';

/**
 * Contas a Receber — só a moldura: o estado vem de `useContasReceber` e cada pedaço de UI é
 * um componente em `components/financeiro/`.
 *
 * `getStatusBadge` fica aqui, e não no hook, porque é o único trecho daquele corpo que
 * devolve JSX; as duas fatias que o usam (tabela e detalhes) o recebem por prop, para não
 * virarem duas cópias da mesma regra de cor.
 */
export const ContasReceberPage: React.FC = () => {
  const {
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
  } = useContasReceber();

  const getStatusBadge = (status: string, vencimento: string) => {
    if (status === 'recebido' || status === 'pago') return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">Recebido</span>;
    if (status === 'cancelado') return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-text-subtle">Cancelado</span>;

    if (isDateBeforeToday(vencimento)) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500">Vencido</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">Pendente</span>;
  };

  return (
    <>
    <div className={`p-6 max-w-7xl mx-auto flex flex-col h-full overflow-hidden`}>
      <ContasReceberCabecalho
        navigate={navigate}
        setShowEscolhaRelatorio={setShowEscolhaRelatorio}
        setShowMapaCalorModal={setShowMapaCalorModal}
        setShowRelatorioModal={setShowRelatorioModal}
        showEscolhaRelatorio={showEscolhaRelatorio}
        state={state}
      />

      {/* PAINEL DE INDICADORES FINANCEIROS PROFISSIONAIS */}
      <IndicadoresContasReceber 
        parcelas={parcelas}
        receitas={receitas}
        associados={associados}
        activeStatusFilter={statusFilter}
        onSelectStatusFilter={(st) => setStatusFilter(st)}
      />

      <div className="bg-bg-subtle border border-border-default rounded-2xl flex-1 flex flex-col overflow-hidden print:hidden">
        <ContasReceberFiltros
          contaContabilFilter={contaContabilFilter}
          contasReceita={contasReceita}
          dataFinal={dataFinal}
          dataInicial={dataInicial}
          formaPagamentoFilter={formaPagamentoFilter}
          searchTerm={searchTerm}
          setContaContabilFilter={setContaContabilFilter}
          setDataFinal={setDataFinal}
          setDataInicial={setDataInicial}
          setFormaPagamentoFilter={setFormaPagamentoFilter}
          setSearchTerm={setSearchTerm}
          setShowFilters={setShowFilters}
          setStatusFilter={setStatusFilter}
          showFilters={showFilters}
          statusFilter={statusFilter}
        />

        <ContasReceberTabela
          getDevedorContato={getDevedorContato}
          getStatusBadge={getStatusBadge}
          handleExcluirParcela={handleExcluirParcela}
          handleWhatsAppCobrança={handleWhatsAppCobrança}
          isVisible={isVisible}
          loading={loading}
          navigate={navigate}
          openBaixaModal={openBaixaModal}
          openDetalhes={openDetalhes}
          setSortDirection={setSortDirection}
          setSortField={setSortField}
          sortDirection={sortDirection}
          sortField={sortField}
          sortedParcelas={sortedParcelas}
          state={state}
        />
      </div>
    </div>

      {/* MODAL DE BAIXA / RECEBIMENTO */}
      <ContasReceberBaixaModal
        checkingLote={checkingLote}
        contaBancariaId={contaBancariaId}
        contasBancarias={contasBancarias}
        dataRecebimento={dataRecebimento}
        formaPagamentoEfetiva={formaPagamentoEfetiva}
        handleBaixa={handleBaixa}
        handleEfetivarRecebimento={handleEfetivarRecebimento}
        loteAberto={loteAberto}
        modalStage={modalStage}
        navigate={navigate}
        observacaoRecebimento={observacaoRecebimento}
        parcelaSelecionada={parcelaSelecionada}
        setContaBancariaId={setContaBancariaId}
        setDataRecebimento={setDataRecebimento}
        setFormaPagamentoEfetiva={setFormaPagamentoEfetiva}
        setModalStage={setModalStage}
        setObservacaoRecebimento={setObservacaoRecebimento}
        setShowBaixaModal={setShowBaixaModal}
        setValorRecebido={setValorRecebido}
        showBaixaModal={showBaixaModal}
        submittingBaixa={submittingBaixa}
        valorRecebido={valorRecebido}
      />

      {/* MODAL DE DETALHES DO REGISTRO */}
      <ContasReceberDetalhesModal
        getDevedorContato={getDevedorContato}
        getStatusBadge={getStatusBadge}
        handleExcluirParcela={handleExcluirParcela}
        handleExcluirReceitaCompleta={handleExcluirReceitaCompleta}
        handleImprimirRecibo={handleImprimirRecibo}
        handleWhatsAppCobrança={handleWhatsAppCobrança}
        navigate={navigate}
        openBaixaModal={openBaixaModal}
        parcelaDetalhes={parcelaDetalhes}
        receitaPai={receitaPai}
        setShowDetalhesModal={setShowDetalhesModal}
        showDetalhesModal={showDetalhesModal}
        state={state}
      />

      {/* MODAL DE RELATÓRIO PROFISSIONAL (PREVIEW / VISUALIZADOR) */}
      <RelatorioMapaCalorModal
        isOpen={showMapaCalorModal}
        onClose={() => setShowMapaCalorModal(false)}
        parcelas={sortedParcelas}
        empresaData={empresaData}
        associados={associados}
        receitas={receitas}
        currentFilters={{
          searchTerm,
          statusFilter,
          formaPagamentoFilter,
          dataInicial,
          dataFinal
        }}
        userName={state.user?.nome || 'Administrador'}
      />

      <RelatorioContasReceberModal
        isOpen={showRelatorioModal}
        onClose={() => setShowRelatorioModal(false)}
        parcelas={sortedParcelas}
        empresaData={empresaData}
        associados={associados}
        currentFilters={{
          searchTerm,
          statusFilter,
          formaPagamentoFilter,
          dataInicial,
          dataFinal
        }}
        userName={state.user?.nome || 'Administrador'}
      />

      {/* MODAL DE RECIBO PROFISSIONAL (PREVIEW / VISUALIZADOR) */}
      {showReciboModal && reciboModalData && (
        <VisualizadorReciboModal
          isOpen={showReciboModal}
          onClose={() => setShowReciboModal(false)}
          dados={reciboModalData}
          empresaData={empresaData}
        />
      )}
    </>
  );
};
