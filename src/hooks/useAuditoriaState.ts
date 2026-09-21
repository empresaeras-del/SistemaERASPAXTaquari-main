import { useState, useEffect, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { usePrintPreview } from './usePrintPreview';
import { getLogsAuditoria, LogAuditoria } from '../services/auditoriaService';
import { escopoDaAuditoria, tenantDoEscopo } from '../utils/escopoAuditoria';
import { getEmpresaById, getEmpresas, Empresa } from '../services/empresasService';
import { getUsuarios, UsuarioCadastro } from '../services/usuariosService';
import {
  filtrarLogsAuditoria,
  calcularEstatisticasAuditoria,
  type FiltrosAuditoria,
} from '../utils/auditoriaHelpers';
import {
  rotulosDeFiltro,
  linhasDoRelatorio,
  montarCsvDeAuditoria,
  SEM_FILTRO,
} from '../utils/relatorioAuditoria';
import {
  gerarPdfDaAtaDeOcorrencias,
  gerarPdfDeReaberturasDeCaixa,
} from '../utils/relatorioAuditoriaPdf';

/**
 * Todo o estado da Ata de Ocorrências: carga, escopo, filtros e as três exportações.
 *
 * Mesma divisão de `useAssociadosState`: a página monta o layout, este hook guarda o estado e
 * as funções puras decidem o conteúdo. O que **não** mora aqui é tão importante quanto o que
 * mora — o filtro é `filtrarLogsAuditoria`, os rótulos e as linhas são
 * `utils/relatorioAuditoria.ts`, e o PDF é `utils/relatorioAuditoriaPdf.ts`.
 */
export const useAuditoriaState = () => {
  const { state } = useAppContext();

  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuariosList, setUsuariosList] = useState<UsuarioCadastro[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [usuarioFiltro, setUsuarioFiltro] = useState<string>(SEM_FILTRO);
  const [isPreviewPrint, setIsPreviewPrint] = useState(false);
  usePrintPreview(isPreviewPrint);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [moduloFiltro, setModuloFiltro] = useState(SEM_FILTRO);
  const [tipoAcaoFiltro, setTipoAcaoFiltro] = useState<FiltrosAuditoria['tipoAcaoFiltro']>(SEM_FILTRO);

  // Quem vê o quê não sai do seletor de empresa do topo: sai do nível do usuário.
  // super_admin sem empresa escolhida => tudo, de todas as empresas e de todos os
  // usuários. Os demais => a própria empresa inteira, e o seletor não os alarga.
  const escopo = useMemo(
    () => escopoDaAuditoria(state.user, state.empresaSelecionada),
    [state.user, state.empresaSelecionada],
  );
  const tenantDaConsulta = tenantDoEscopo(escopo);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tenantDaConsulta === null) {
        // Sem empresa resolvida, listar com `'all'` daria visão global a quem não tem
        // direito a ela — o erro exatamente oposto ao pretendido. Recusa-se a listagem.
        setLogs([]);
        toast.error(escopo.tipo === 'indefinido' ? escopo.motivo : 'Escopo de auditoria indefinido.');
        return;
      }

      const [logsData, empData, empsList, usersData] = await Promise.all([
        getLogsAuditoria(state.isOnline, tenantDaConsulta),
        state.empresaSelecionada && state.empresaSelecionada !== 'all'
          ? getEmpresaById(state.empresaSelecionada, state.isOnline)
          : Promise.resolve(null),
        getEmpresas(state.isOnline),
        getUsuarios(state.isOnline, tenantDaConsulta),
      ]);

      setEmpresa(empData);
      setEmpresas(empsList);
      setUsuariosList(usersData);
      setLogs(logsData);
    } catch (error: any) {
      console.error('Erro ao carregar auditoria:', error);
      // A mensagem do servidor vai para a tela: um "não foi possível carregar" genérico
      // não diz se o problema é permissão, rede ou volume — e foi o silêncio desse
      // caminho que deixou a tela mostrar o cache local como se fosse o banco.
      setLogs([]);
      toast.error(error?.message || 'Não foi possível carregar o histórico de auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada, state.user?.nivel, state.user?.tenant_id]);

  // O objeto é memoizado, não remontado a cada render: ele é dependência de três `useMemo`
  // abaixo, e um literal novo por render os invalidaria todos sempre.
  const filtros: FiltrosAuditoria = useMemo(
    () => ({ searchTerm, dataInicio, dataFim, moduloFiltro, tipoAcaoFiltro, usuarioFiltro }),
    [searchTerm, dataInicio, dataFim, moduloFiltro, tipoAcaoFiltro, usuarioFiltro],
  );

  const filteredLogs = useMemo(() => filtrarLogsAuditoria(logs, filtros), [logs, filtros]);

  /** Os rótulos e as linhas que as TRÊS saídas leem — folha, CSV e PDF. */
  const rotulos = useMemo(() => rotulosDeFiltro(filtros, usuariosList), [filtros, usuariosList]);
  const linhas = useMemo(() => linhasDoRelatorio(filteredLogs, empresas), [filteredLogs, empresas]);

  const handleSetQuickPeriod = (days: number | 'hoje' | 'limpar') => {
    if (days === 'limpar') {
      setDataInicio('');
      setDataFim('');
      return;
    }
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    if (days === 'hoje') {
      setDataInicio(todayStr);
      setDataFim(todayStr);
    } else {
      setDataInicio(format(subDays(today, days), 'yyyy-MM-dd'));
      setDataFim(todayStr);
    }
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('Nenhum registro para exportar.');
      return;
    }

    try {
      const blob = new Blob([montarCsvDeAuditoria(filteredLogs, empresas)], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `auditoria_logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Arquivo CSV exportado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar CSV.');
    }
  };

  const handleGerarRelatorioPDF = async () => {
    if (filteredLogs.length === 0) {
      toast.error('Nenhum registro encontrado para gerar relatório.');
      return;
    }

    const toastId = toast.loading('Gerando relatório em PDF...');
    try {
      await gerarPdfDaAtaDeOcorrencias({ empresa, rotulos, linhas });
      toast.success('Relatório em PDF gerado com sucesso!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar relatório em PDF.', { id: toastId });
    }
  };

  const handleExportReaberturasPDF = async () => {
    try {
      const quantas = await gerarPdfDeReaberturasDeCaixa(logs);
      if (quantas === 0) {
        toast.error('Nenhum registro de reabertura de caixa encontrado para exportar.');
        return;
      }
      toast.success('Relatório de reaberturas exportado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar relatório em PDF.');
    }
  };

  const estatisticas = calcularEstatisticasAuditoria(logs);

  const hasActiveFilters = Boolean(
    searchTerm ||
      dataInicio ||
      dataFim ||
      moduloFiltro !== SEM_FILTRO ||
      tipoAcaoFiltro !== SEM_FILTRO ||
      usuarioFiltro !== SEM_FILTRO,
  );

  const clearAllFilters = () => {
    setSearchTerm('');
    setDataInicio('');
    setDataFim('');
    setModuloFiltro(SEM_FILTRO);
    setTipoAcaoFiltro(SEM_FILTRO);
    setUsuarioFiltro(SEM_FILTRO);
  };

  const handleEntrarModoImpressao = () => {
    setIsPreviewPrint(true);
    handleGerarRelatorioPDF();
  };

  return {
    // dados
    logs,
    filteredLogs,
    loading,
    empresa,
    empresas,
    usuariosList,
    escopo,
    estatisticas,
    empresaSelecionada: state.empresaSelecionada,
    // o conteúdo do relatório, compartilhado pelas três saídas
    rotulos,
    linhas,
    // filtros
    filtros,
    hasActiveFilters,
    setSearchTerm,
    setDataInicio,
    setDataFim,
    setModuloFiltro,
    setTipoAcaoFiltro,
    setUsuarioFiltro,
    handleSetQuickPeriod,
    clearAllFilters,
    // modo impressão e exportações
    isPreviewPrint,
    setIsPreviewPrint,
    loadData,
    handleExportCSV,
    handleGerarRelatorioPDF,
    handleExportReaberturasPDF,
    handleEntrarModoImpressao,
  };
};
