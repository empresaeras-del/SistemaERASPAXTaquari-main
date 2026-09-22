import React from 'react';


import { isDateBeforeToday } from '../utils/dateUtils';

import { RelatorioContasPagarModal } from '../components/financeiro/RelatorioContasPagarModal';
import { VisualizadorReciboModal } from '../components/financeiro/VisualizadorReciboModal';
import { IndicadoresContasPagar } from '../components/financeiro/IndicadoresContasPagar';
import { useContasPagar } from '../hooks/useContasPagar';
import { ContasPagarCabecalho } from '../components/financeiro/ContasPagarCabecalho';
import { ContasPagarFiltros } from '../components/financeiro/ContasPagarFiltros';
import { ContasPagarTabela } from '../components/financeiro/ContasPagarTabela';
import { ContasPagarBaixaModal } from '../components/financeiro/ContasPagarBaixaModal';
import { ContasPagarDetalhesModal } from '../components/financeiro/ContasPagarDetalhesModal';

/**
 * Contas a Pagar — só a moldura: o estado vem de `useContasPagar` e cada pedaço de UI é um
 * componente em `components/financeiro/`.
 *
 * `getStatusBadge` fica aqui, e não no hook, porque é o único trecho daquele corpo que devolve
 * JSX; as duas fatias que o usam (tabela e detalhes) o recebem por prop, para não virarem duas
 * cópias da mesma regra de cor.
 */
export const ContasPagarPage: React.FC = () => {
  const {
    navigate,
    state,
    parcelas,
    despesas,
    loading,
    showRelatorioModal,
    setShowRelatorioModal,
    showReciboModal,
    setShowReciboModal,
    reciboModalData,
    searchTerm,
    setSearchTerm,
    contaContabilFilter,
    setContaContabilFilter,
    centroCustoFilter,
    setCentroCustoFilter,
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
    dataPagamento,
    setDataPagamento,
    valorPago,
    setValorPago,
    formaPagamentoEfetiva,
    setFormaPagamentoEfetiva,
    observacaoPagamento,
    setObservacaoPagamento,
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
    despesaPai,
    empresaData,
    centrosCusto,
    contasDespesa,
    filteredParcelas,
    sortedParcelas,
    openBaixaModal,
    handleBaixa,
    handleEfetivarPagamento,
    openDetalhes,
    handleExcluirParcela,
    handleExcluirDespesaCompleta,
    handleImprimirComprovante,
  } = useContasPagar();

  const getStatusBadge = (status: string, vencimento: string) => {
    if (status === 'pago') return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">Pago</span>;
    if (status === 'cancelado') return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-text-subtle">Cancelado</span>;

    if (isDateBeforeToday(vencimento)) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500">Vencido</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">Pendente</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-full overflow-hidden">
      <ContasPagarCabecalho
        despesas={despesas}
        navigate={navigate}
        setShowRelatorioModal={setShowRelatorioModal}
        state={state}
      />

      {/* PAINEL DE INDICADORES FINANCEIROS PROFISSIONAIS */}
      <IndicadoresContasPagar 
        parcelas={parcelas}
        despesas={despesas}
        activeStatusFilter={statusFilter}
        onSelectStatusFilter={(st) => setStatusFilter(st)}
      />

      <div className="bg-bg-subtle border border-border-default rounded-2xl flex-1 flex flex-col overflow-hidden print:hidden">
        <ContasPagarFiltros
          centroCustoFilter={centroCustoFilter}
          centrosCusto={centrosCusto}
          contaContabilFilter={contaContabilFilter}
          contasDespesa={contasDespesa}
          dataFinal={dataFinal}
          dataInicial={dataInicial}
          formaPagamentoFilter={formaPagamentoFilter}
          searchTerm={searchTerm}
          setCentroCustoFilter={setCentroCustoFilter}
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

        <ContasPagarTabela
          despesas={despesas}
          getStatusBadge={getStatusBadge}
          handleExcluirParcela={handleExcluirParcela}
          isVisible={isVisible}
          loading={loading}
          navigate={navigate}
          openBaixaModal={openBaixaModal}
          openDetalhes={openDetalhes}
          parcelas={parcelas}
          setSortDirection={setSortDirection}
          setSortField={setSortField}
          sortDirection={sortDirection}
          sortField={sortField}
          sortedParcelas={sortedParcelas}
          state={state}
        />
      </div>

      {/* MODAL DE BAIXA / PAGAMENTO */}
      <ContasPagarBaixaModal
        checkingLote={checkingLote}
        contaBancariaId={contaBancariaId}
        contasBancarias={contasBancarias}
        dataPagamento={dataPagamento}
        formaPagamentoEfetiva={formaPagamentoEfetiva}
        handleBaixa={handleBaixa}
        handleEfetivarPagamento={handleEfetivarPagamento}
        loteAberto={loteAberto}
        modalStage={modalStage}
        navigate={navigate}
        observacaoPagamento={observacaoPagamento}
        parcelaSelecionada={parcelaSelecionada}
        setContaBancariaId={setContaBancariaId}
        setDataPagamento={setDataPagamento}
        setFormaPagamentoEfetiva={setFormaPagamentoEfetiva}
        setModalStage={setModalStage}
        setObservacaoPagamento={setObservacaoPagamento}
        setShowBaixaModal={setShowBaixaModal}
        setValorPago={setValorPago}
        showBaixaModal={showBaixaModal}
        submittingBaixa={submittingBaixa}
        valorPago={valorPago}
      />

      {/* MODAL DE DETALHES DO REGISTRO */}
      <ContasPagarDetalhesModal
        despesaPai={despesaPai}
        despesas={despesas}
        getStatusBadge={getStatusBadge}
        handleExcluirDespesaCompleta={handleExcluirDespesaCompleta}
        handleExcluirParcela={handleExcluirParcela}
        handleImprimirComprovante={handleImprimirComprovante}
        navigate={navigate}
        openBaixaModal={openBaixaModal}
        parcelaDetalhes={parcelaDetalhes}
        parcelas={parcelas}
        setShowDetalhesModal={setShowDetalhesModal}
        showDetalhesModal={showDetalhesModal}
        state={state}
      />

      {/* Relatório Interativo Modal */}
      <RelatorioContasPagarModal
        isOpen={showRelatorioModal}
        onClose={() => setShowRelatorioModal(false)}
        parcelas={filteredParcelas}
        despesas={despesas}
        empresaData={empresaData}
        currentFilters={{
          searchTerm,
          statusFilter,
          formaPagamentoFilter,
          dataInicial,
          dataFinal
        }}
        userName={state.user?.nome || 'Operador'}
      />

      {/* Visualizador de Comprovante / Recibo Modal */}
      {showReciboModal && reciboModalData && (
        <VisualizadorReciboModal
          isOpen={showReciboModal}
          onClose={() => setShowReciboModal(false)}
          dados={reciboModalData}
          empresaData={empresaData}
        />
      )}
    </div>
  );
};

