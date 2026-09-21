import React from 'react';
import { useAuditoriaState } from '../hooks/useAuditoriaState';
import { AuditoriaBannerImpressao } from '../components/auditoria/AuditoriaBannerImpressao';
import { AuditoriaCabecalho } from '../components/auditoria/AuditoriaCabecalho';
import { AuditoriaKpis } from '../components/auditoria/AuditoriaKpis';
import { AuditoriaFolhaImpressao } from '../components/auditoria/AuditoriaFolhaImpressao';
import { AuditoriaFiltros } from '../components/auditoria/AuditoriaFiltros';
import { AuditoriaContador } from '../components/auditoria/AuditoriaContador';
import { AuditoriaLinhaDoTempo } from '../components/auditoria/AuditoriaLinhaDoTempo';

/**
 * Ata de Ocorrências.
 *
 * Esta página **só monta o layout**: o estado vive em `hooks/useAuditoriaState.ts`, o
 * conteúdo do relatório em `utils/relatorioAuditoria.ts` e cada pedaço de UI no componente
 * correspondente de `components/auditoria/`. Não espere mais encontrar lógica aqui.
 *
 * A tela tem dois modos e eles são excludentes de propósito: no modo de impressão o
 * cabeçalho, os KPIs e os filtros somem, porque o que está na tela é a **folha** — e um
 * relatório com os controles da aplicação em volta não é um documento.
 */
export const AuditoriaPage: React.FC = () => {
  const a = useAuditoriaState();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 h-full flex flex-col">
      {a.isPreviewPrint && (
        <AuditoriaBannerImpressao
          onBaixarPdf={a.handleGerarRelatorioPDF}
          onVoltar={() => a.setIsPreviewPrint(false)}
        />
      )}

      {!a.isPreviewPrint && (
        <>
          <AuditoriaCabecalho
            escopo={a.escopo}
            loading={a.loading}
            onRecarregar={a.loadData}
            onExportarCsv={a.handleExportCSV}
            onExportarReaberturas={a.handleExportReaberturasPDF}
            onImprimir={a.handleEntrarModoImpressao}
          />
          <AuditoriaKpis {...a.estatisticas} />
        </>
      )}

      {a.isPreviewPrint ? (
        <AuditoriaFolhaImpressao empresa={a.empresa} rotulos={a.rotulos} linhas={a.linhas} />
      ) : (
        <div className="bg-bg-subtle rounded-2xl shadow-sm border border-border-default overflow-hidden flex-1 flex flex-col min-h-0">
          <AuditoriaFiltros
            filtros={a.filtros}
            usuariosList={a.usuariosList}
            hasActiveFilters={a.hasActiveFilters}
            setSearchTerm={a.setSearchTerm}
            setDataInicio={a.setDataInicio}
            setDataFim={a.setDataFim}
            setModuloFiltro={a.setModuloFiltro}
            setTipoAcaoFiltro={a.setTipoAcaoFiltro}
            setUsuarioFiltro={a.setUsuarioFiltro}
            handleSetQuickPeriod={a.handleSetQuickPeriod}
            clearAllFilters={a.clearAllFilters}
          />

          <AuditoriaContador
            exibidos={a.filteredLogs.length}
            total={a.logs.length}
            usuarioFiltro={a.filtros.usuarioFiltro}
            usuariosList={a.usuariosList}
            hasActiveFilters={a.hasActiveFilters}
          />

          <AuditoriaLinhaDoTempo
            loading={a.loading}
            logs={a.filteredLogs}
            empresas={a.empresas}
            empresaSelecionada={a.empresaSelecionada}
            hasActiveFilters={a.hasActiveFilters}
            clearAllFilters={a.clearAllFilters}
            onFiltrarPorOperador={a.setUsuarioFiltro}
          />
        </div>
      )}
    </div>
  );
};
