import React from 'react';
import { ShieldAlert, RefreshCw, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { rotuloDoEscopo, type EscopoAuditoria } from '../../utils/escopoAuditoria';

interface Props {
  escopo: EscopoAuditoria;
  loading: boolean;
  onRecarregar: () => void;
  onExportarCsv: () => void;
  onExportarReaberturas: () => void;
  onImprimir: () => void;
}

/**
 * Título, selo de escopo e as quatro ações.
 *
 * **O selo diz o escopo REAL da listagem, não o nível de quem olha.** Um super_admin que
 * escolheu uma empresa no topo está vendo aquela empresa, e continuar anunciando "Visão
 * Global" ali afirmaria que a lista é completa quando não é.
 */
export const AuditoriaCabecalho: React.FC<Props> = ({
  escopo,
  loading,
  onRecarregar,
  onExportarCsv,
  onExportarReaberturas,
  onImprimir,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-text-base">Ata de Ocorrências</h2>
            {/* O selo diz o escopo REAL da listagem, não o nível de quem olha:
                um super_admin que escolheu uma empresa no topo está vendo aquela
                empresa, e continuar anunciando "Visão Global" ali seria afirmar
                que a lista é completa quando ela não é. */}
            <span
              className={
                'px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border ' +
                (escopo.tipo === 'global'
                  ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400'
                  : escopo.tipo === 'empresa'
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400')
              }
              title={
                escopo.tipo === 'global'
                  ? 'Todos os logs, de todas as empresas e de todos os usuários.'
                  : escopo.tipo === 'empresa'
                    ? 'Todos os logs de todos os usuários desta empresa.'
                    : escopo.motivo
              }
            >
              {rotuloDoEscopo(escopo)}
            </span>
          </div>
          <p className="text-text-subtle text-xs sm:text-sm mt-0.5">
            Logs de auditoria e rastreabilidade detalhada de eventos e ações de usuários.
          </p>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onRecarregar}
        disabled={loading}
        className="flex items-center gap-2 px-3.5 py-2 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl font-medium text-xs sm:text-sm transition-colors shadow-sm"
        title="Recarregar logs"
      >
        <RefreshCw className={`w-4 h-4 text-text-muted ${loading ? 'animate-spin' : ''}`} />
        <span className="hidden md:inline">Atualizar</span>
      </button>

      <button
        type="button"
        onClick={onExportarCsv}
        className="flex items-center gap-2 px-3.5 py-2 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl font-medium text-xs sm:text-sm transition-colors shadow-sm"
        title="Exportar logs filtrados em formato CSV"
      >
        <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
        <span>Exportar CSV</span>
      </button>

      <button 
        type="button"
        onClick={onExportarReaberturas}
        className="flex items-center gap-2 px-3.5 py-2 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl font-medium text-xs sm:text-sm transition-colors shadow-sm no-print"
        title="Gerar PDF de Reaberturas de Caixas"
      >
        <FileText className="w-4 h-4 text-blue-500" />
        <span className="hidden md:inline">Reaberturas</span>
      </button>

      <button
        type="button"
        onClick={onImprimir}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg"
        title="Gerar Relatório em PDF e Visualizar Impressão"
      >
        <Printer className="w-4 h-4" />
        <span>Imprimir / Gerar PDF</span>
      </button>
    </div>
  </div>
);
