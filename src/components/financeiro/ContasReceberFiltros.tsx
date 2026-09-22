import React from 'react';
import { AdvancedFilterBar } from '../../components/layout/AdvancedFilterBar';
import { Search } from 'lucide-react';
import type { useContasReceber } from '../../hooks/useContasReceber';

type EstadoContasReceber = ReturnType<typeof useContasReceber>;

type Props = Pick<EstadoContasReceber, 'contaContabilFilter' | 'contasReceita' | 'dataFinal' | 'dataInicial' | 'formaPagamentoFilter' | 'searchTerm' | 'setContaContabilFilter' | 'setDataFinal' | 'setDataInicial' | 'setFormaPagamentoFilter' | 'setSearchTerm' | 'setShowFilters' | 'setStatusFilter' | 'showFilters' | 'statusFilter'>;

/**
 * A `AdvancedFilterBar` com os seis campos de filtro da tela.
 *
 * A lista de contas contábeis inclui as DESATIVADAS: um lançamento antigo pode apontar para
 * uma delas, e sem a opção aqui ele viraria infiltrável. Receita não tem centro de custo —
 * esse campo é só de despesa.
 */
export const ContasReceberFiltros: React.FC<Props> = ({ contaContabilFilter, contasReceita, dataFinal, dataInicial, formaPagamentoFilter, searchTerm, setContaContabilFilter, setDataFinal, setDataInicial, setFormaPagamentoFilter, setSearchTerm, setShowFilters, setStatusFilter, showFilters, statusFilter }) => {
  return (
    <>
    <div className="p-4 border-b border-border-default">
      <div className="p-4 border-b border-border-default">
      <AdvancedFilterBar
        pageKey="contas-receber"
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        currentFilters={{ searchTerm, statusFilter, formaPagamentoFilter, dataInicial, dataFinal, contaContabilFilter }}
        onApplyFilters={(filters) => {
          setSearchTerm(filters.searchTerm || '');
          setStatusFilter(filters.statusFilter || '');
          setFormaPagamentoFilter(filters.formaPagamentoFilter || '');
          setDataInicial(filters.dataInicial || '');
          setDataFinal(filters.dataFinal || '');
          setContaContabilFilter(filters.contaContabilFilter || '');
        }}
        onClearFilters={() => {
          setSearchTerm('');
          setStatusFilter('');
          setFormaPagamentoFilter('');
          setDataInicial('');
          setDataFinal('');
          setContaContabilFilter('');
        }}
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-subtle">Busca Rápida</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="Nome, documento ou descrição..."
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
            <option value="recebido">Recebido</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-text-subtle">Forma de Recebimento</label>
          <select
            value={formaPagamentoFilter}
            onChange={(e) => setFormaPagamentoFilter(e.target.value)}
            className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
          >
            <option value="">Todas</option>
            <option value="pix">PIX</option>                <option value="dinheiro">Dinheiro</option>                <option value="cartao_credito">Cartão de Crédito</option>                <option value="cartao_debito">Cartão de Débito</option>                <option value="boleto">Boleto</option>                <option value="transferencia">Transferência</option>              </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-text-subtle">Conta Contábil</label>
          <select
            value={contaContabilFilter}
            onChange={(e) => setContaContabilFilter(e.target.value)}
            className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-lg text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
          >
            <option value="">Todas as Contas</option>
            {contasReceita.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} — {c.nome}{c.ativo ? '' : ' (desativada)'}
              </option>
            ))}
          </select>
        </div>

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
