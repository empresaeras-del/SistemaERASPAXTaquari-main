import React from 'react';
import { AdvancedFilterBar } from '../../components/layout/AdvancedFilterBar';
import { Search } from 'lucide-react';
import type { useContasPagar } from '../../hooks/useContasPagar';

type EstadoContasPagar = ReturnType<typeof useContasPagar>;

type Props = Pick<EstadoContasPagar, 'centroCustoFilter' | 'centrosCusto' | 'contaContabilFilter' | 'contasDespesa' | 'dataFinal' | 'dataInicial' | 'formaPagamentoFilter' | 'searchTerm' | 'setCentroCustoFilter' | 'setContaContabilFilter' | 'setDataFinal' | 'setDataInicial' | 'setFormaPagamentoFilter' | 'setSearchTerm' | 'setShowFilters' | 'setStatusFilter' | 'showFilters' | 'statusFilter'>;

/**
 * A `AdvancedFilterBar` com os sete campos de filtro da tela.
 *
 * São sete, e não seis como no lado das receitas, porque despesa tem **centro de custo** —
 * campo que receita não tem. Conta contábil e centro incluem os DESATIVADOS de propósito: um
 * lançamento antigo pode apontar para um deles, e sem a opção aqui ele viraria infiltrável.
 */
export const ContasPagarFiltros: React.FC<Props> = ({ centroCustoFilter, centrosCusto, contaContabilFilter, contasDespesa, dataFinal, dataInicial, formaPagamentoFilter, searchTerm, setCentroCustoFilter, setContaContabilFilter, setDataFinal, setDataInicial, setFormaPagamentoFilter, setSearchTerm, setShowFilters, setStatusFilter, showFilters, statusFilter }) => {
  return (
    <>
    <div className="p-4 border-b border-border-default">
      <div className="p-4 border-b border-border-default">
      <AdvancedFilterBar
        pageKey="contas-pagar"
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        currentFilters={{ searchTerm, statusFilter, formaPagamentoFilter, dataInicial, dataFinal, contaContabilFilter, centroCustoFilter }}
        onApplyFilters={(filters) => {
          setSearchTerm(filters.searchTerm || '');
          setStatusFilter(filters.statusFilter || '');
          setFormaPagamentoFilter(filters.formaPagamentoFilter || '');
          setDataInicial(filters.dataInicial || '');
          setDataFinal(filters.dataFinal || '');
          setContaContabilFilter(filters.contaContabilFilter || '');
          setCentroCustoFilter(filters.centroCustoFilter || '');
        }}
        onClearFilters={() => {
          setSearchTerm('');
          setStatusFilter('');
          setFormaPagamentoFilter('');
          setDataInicial('');
          setDataFinal('');
          setContaContabilFilter('');
          setCentroCustoFilter('');
        }}
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-subtle">Busca Rápida</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="Credor, documento ou descrição..."
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
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-text-subtle">Forma de Pagamento</label>
          <select
            value={formaPagamentoFilter}
            onChange={(e) => setFormaPagamentoFilter(e.target.value)}
            className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
          >
            <option value="">Todas</option>
            <option value="pix">PIX</option>                <option value="dinheiro">Dinheiro</option>                <option value="cartao_credito">Cartão de Crédito</option>                <option value="cartao_debito">Cartão de Débito</option>                <option value="boleto">Boleto</option>                <option value="transferencia">Transferência</option>              </select>
        </div>

        {contasDespesa.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-subtle">Conta Contábil</label>
            <select
              value={contaContabilFilter}
              onChange={(e) => setContaContabilFilter(e.target.value)}
              className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
            >
              <option value="">Todas as Contas</option>
              {contasDespesa.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} — {c.nome}{c.ativo ? '' : ' (desativada)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {centrosCusto.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-subtle">Centro de Custo</label>
            <select
              value={centroCustoFilter}
              onChange={(e) => setCentroCustoFilter(e.target.value)}
              className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
            >
              <option value="">Todos os Centros</option>
              {centrosCusto.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} — {c.nome}{c.ativo ? '' : ' (desativado)'}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-medium text-text-subtle">Período Vencimento (Inicial)</label>
          <input
            type="date"
            value={dataInicial}
            onChange={(e) => setDataInicial(e.target.value)}
            className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-text-subtle">Período Vencimento (Final)</label>
          <input
            type="date"
            value={dataFinal}
            onChange={(e) => setDataFinal(e.target.value)}
            className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
          />
        </div>
      </AdvancedFilterBar>
    </div>
    </div>
    </>
  );
};
