import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { usePrintPreview } from '../hooks/usePrintPreview';
import { getLogsAuditoria, LogAuditoria } from '../services/auditoriaService';
import { ShieldAlert, Search, Filter, Clock, User, Activity, Calendar, ArrowRight, ShieldCheck, FileText, Users, Printer } from 'lucide-react';
import { format, isToday, isWithinInterval, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';


// Diff Component
const DiffViewer: React.FC<{ oldData: any, newData: any }> = ({ oldData, newData }) => {
  if (!oldData && !newData) return null;
  
  const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]));
  
  const changes = allKeys.map(key => {
    const oldVal = oldData?.[key];
    const newVal = newData?.[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      return { key, oldVal, newVal };
    }
    return null;
  }).filter(Boolean);

  if (changes.length === 0) return <div className="text-sm text-text-subtle">Nenhuma alteração detectada nos campos.</div>;

  return (
    <div className="space-y-2 mt-2">
      <h5 className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-2 border-b border-border-default pb-1">Histórico de Alterações</h5>
      {changes.map((change, i) => (
        <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm bg-bg-surface p-2 rounded border border-border-default">
          <span className="font-mono text-[#3B82F6] font-bold min-w-[120px]">{change?.key}:</span>
          <div className="flex items-center gap-2 flex-1 overflow-hidden">
            <span className="text-rose-400 line-through truncate flex-1" title={JSON.stringify(change?.oldVal)}>
              {change?.oldVal !== undefined && change?.oldVal !== null ? JSON.stringify(change.oldVal) : 'N/A'}
            </span>
            <ArrowRight className="w-4 h-4 text-text-subtle shrink-0" />
            <span className="text-emerald-400 truncate flex-1" title={JSON.stringify(change?.newVal)}>
              {change?.newVal !== undefined && change?.newVal !== null ? JSON.stringify(change.newVal) : 'N/A'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export const AuditoriaPage: React.FC = () => {
  const { state } = useAppContext();
  
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [isPreviewPrint, setIsPreviewPrint] = useState(false);
  usePrintPreview(isPreviewPrint);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [moduloFiltro, setModuloFiltro] = useState('todos'); // could be mapped to 'acao' prefixes

  const loadData = async () => {
    setLoading(true);
    try {
      if (state.empresaSelecionada) {
        const logsData = await getLogsAuditoria(state.isOnline, state.empresaSelecionada);
        // add mock logs if empty to demonstrate functionality in dev mode
        if (logsData.length === 0) {
          setLogs([
            { id: '1', tenant_id: state.empresaSelecionada, usuario_id: '1', acao: 'Salvar Plano', detalhes: { id: 'pln-1', nome: 'Básico' }, created_at: new Date().toISOString(), usuarios: { nome: 'Super Admin', email: 'superadmin@eras.com' } },
            { id: '2', tenant_id: state.empresaSelecionada, usuario_id: '1', acao: 'Excluir Associado (Soft Delete)', detalhes: { id: 'assoc-1' }, created_at: new Date(Date.now() - 86400000).toISOString(), usuarios: { nome: 'Super Admin', email: 'superadmin@eras.com' } },
            { id: '3', tenant_id: state.empresaSelecionada, usuario_id: '1', acao: 'Salvar Empresa', detalhes: { id: state.empresaSelecionada, nome_fantasia: 'Empresa Teste' }, created_at: new Date(Date.now() - 172800000).toISOString(), usuarios: { nome: 'Super Admin', email: 'superadmin@eras.com' } },
          ]);
        } else {
          setLogs(logsData);
        }
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    const matchSearch = 
      log.acao.toLowerCase().includes(term) || 
      (log.usuarios?.nome && log.usuarios.nome.toLowerCase().includes(term)) ||
      (log.detalhes && JSON.stringify(log.detalhes).toLowerCase().includes(term));
      
    let matchDate = true;
    if (dataInicio && dataFim) {
      const logDate = new Date(log.created_at).getTime();
      matchDate = logDate >= new Date(dataInicio).getTime() && logDate <= new Date(dataFim + 'T23:59:59').getTime();
    }
    
    let matchModulo = true;
    if (moduloFiltro !== 'todos') {
      const acaoLower = log.acao.toLowerCase();
      if (moduloFiltro === 'financeiro') {
        matchModulo = acaoLower.includes('receita') || acaoLower.includes('despesa') || acaoLower.includes('parcela') || acaoLower.includes('pagamento') || acaoLower.includes('recebimento');
      } else if (moduloFiltro === 'contrato') {
        matchModulo = acaoLower.includes('contrato') || acaoLower.includes('associado');
      } else if (moduloFiltro === 'caixa') {
        matchModulo = acaoLower.includes('caixa') || acaoLower.includes('lote');
      } else {
        matchModulo = acaoLower.includes(moduloFiltro.toLowerCase());
      }
    }

    return matchSearch && matchDate && matchModulo;
  });

  
  const handleExportReaberturasPDF = () => {
    try {
      const reaberturas = logs.filter(log => log.acao === 'Reabertura Lote Caixa');
      if (reaberturas.length === 0) {
        toast.error('Nenhum registro de reabertura de caixa encontrado para exportar.');
        return;
      }

      const doc = new jsPDF('landscape');
      
      doc.setFontSize(16);
      doc.text('Relatório de Reaberturas de Caixas', 14, 20);
      
      doc.setFontSize(10);
      doc.text(`Data da Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
      
      const tableData = reaberturas.map(log => {
        const dataStr = format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
        const codigoLote = log.detalhes?.codigo || log.detalhes?.id || 'N/A';
        const usuarioAutorizador = log.usuarios?.nome || log.detalhes?.usuario || 'N/A';
        const justificativa = log.detalhes?.justificativa || 'N/A';
        
        return [
          dataStr,
          codigoLote,
          usuarioAutorizador,
          justificativa
        ];
      });

      autoTable(doc, {
        startY: 35,
        head: [['Data / Hora', 'Lote / Sessão', 'Autorizado Por', 'Justificativa']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 40 },
          2: { cellWidth: 45 },
          3: { cellWidth: 'auto' }
        }
      });

      doc.save(`Relatorio_Reaberturas_Caixa_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar relatório em PDF.');
    }
  };

  const totalLogs = logs.length;
  const logsHoje = logs.filter(log => isToday(new Date(log.created_at))).length;
  const logsUltimos7Dias = logs.filter(log => 
    isWithinInterval(new Date(log.created_at), { start: subDays(new Date(), 7), end: new Date() })
  ).length;
  const usuariosUnicos = new Set(logs.map(log => log.usuario_id)).size;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-base">Ata de Ocorrências (Logs do Sistema)</h2>
          <p className="text-text-subtle mt-1">Rastreabilidade completa de ações e alterações no sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPreviewPrint(!isPreviewPrint)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors shadow-sm preview-toggle ${isPreviewPrint ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default'}`}
            title={isPreviewPrint ? 'Sair da Visualização' : 'Visualizar Impressão'}
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{isPreviewPrint ? 'Sair Visualização' : 'Ver Impressão'}</span>
          </button>
          
          <button 
            onClick={handleExportReaberturasPDF}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl font-medium text-sm transition-colors shadow-sm no-print"
          >
            <Printer className="w-4 h-4" />
            Exportar Reaberturas
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 flex flex-col justify-between hover:border-[#3B82F6]/50 transition-colors relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#60A5FA] group-hover:opacity-40 transition-opacity" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#3B82F6] to-[#60A5FA] text-white shadow-lg">
              <FileText className="w-6 h-6" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-bold text-text-base tracking-tight">{totalLogs}</h3>
            <p className="text-sm font-medium text-text-subtle mt-1">Total de Registros</p>
          </div>
        </div>
        
        <div className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 flex flex-col justify-between hover:border-[#10B981]/50 transition-colors relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-[#10B981] to-[#34D399] group-hover:opacity-40 transition-opacity" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#10B981] to-[#34D399] text-white shadow-lg">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-bold text-text-base tracking-tight">{logsHoje}</h3>
            <p className="text-sm font-medium text-text-subtle mt-1">Ações Hoje</p>
          </div>
        </div>

        <div className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 flex flex-col justify-between hover:border-[#F59E0B]/50 transition-colors relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-[#F59E0B] to-[#FCD34D] group-hover:opacity-40 transition-opacity" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#F59E0B] to-[#FCD34D] text-white shadow-lg">
              <Calendar className="w-6 h-6" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-bold text-text-base tracking-tight">{logsUltimos7Dias}</h3>
            <p className="text-sm font-medium text-text-subtle mt-1">Últimos 7 Dias</p>
          </div>
        </div>

        <div className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 flex flex-col justify-between hover:border-[#8B5CF6]/50 transition-colors relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-[#8B5CF6] to-[#A78BFA] group-hover:opacity-40 transition-opacity" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] to-[#A78BFA] text-white shadow-lg">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-bold text-text-base tracking-tight">{usuariosUnicos}</h3>
            <p className="text-sm font-medium text-text-subtle mt-1">Usuários Ativos (Total)</p>
          </div>
        </div>
      </div>

      <div className="bg-bg-subtle rounded-xl shadow-sm border border-border-default overflow-hidden flex-1 flex flex-col min-h-0">
        {/* Filtros */}
        <div className="p-4 border-b border-border-default bg-bg-surface space-y-4 shrink-0">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-text-subtle mb-1 uppercase tracking-wider">Busca Livre</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                <input 
                  type="text" 
                  placeholder="Buscar por usuário, ação, detalhes..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-border-default rounded-lg focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] bg-bg-surface text-text-base"
                />
              </div>
            </div>
            
            <div className="w-full md:w-48">
              <label className="block text-xs font-medium text-text-subtle mb-1 uppercase tracking-wider">Módulo/Ação</label>
              <select
                value={moduloFiltro}
                onChange={(e) => setModuloFiltro(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border-default rounded-lg focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] bg-bg-surface text-text-base"
              >
                <option value="todos">Todos</option>
                <option value="contrato">Contratos / Associados</option>
                <option value="financeiro">Financeiro / Contas</option>
                <option value="caixa">Caixas / Lotes</option>
                <option value="remessa">Faturamento / Remessas</option>
                <option value="plano">Planos Pax</option>
                <option value="empresa">Empresas</option>
                <option value="usuario">Usuários</option>
                <option value="atendimento">Atendimentos</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1 uppercase tracking-wider">Data Início</label>
                <input 
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border-default rounded-lg focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] bg-bg-surface text-text-base"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-subtle mb-1 uppercase tracking-wider">Data Fim</label>
                <input 
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border-default rounded-lg focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] bg-bg-surface text-text-base"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Linha do Tempo */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="text-center py-12 text-text-subtle flex flex-col items-center">
              <ShieldAlert className="w-8 h-8 mb-3 text-text-muted animate-pulse" />
              Carregando logs de auditoria...
            </div>
          ) : !state.empresaSelecionada ? (
             <div className="text-center py-12 text-text-subtle">
               Nenhuma empresa selecionada.
             </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-text-subtle">
              Nenhum registro encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="relative border-l-2 border-border-default ml-4 space-y-8 pb-4">
              {filteredLogs.map((log, index) => (
                <div key={log.id} className="relative pl-6">
                  {/* Ponto na linha do tempo */}
                  <span className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-bg-subtle border-2 border-[#3B82F6] ring-4 ring-[#1E293B]"></span>
                  
                  <div className="bg-bg-surface border border-border-default rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-[#3B82F6]" />
                        <h4 className="font-bold text-text-base text-base">{log.acao}</h4>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium text-text-subtle bg-bg-subtle px-3 py-1.5 rounded-full w-fit border border-border-default">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(log.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {format(new Date(log.created_at), "HH:mm:ss")}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 text-sm text-text-muted mb-4 bg-bg-subtle p-3 rounded-lg border border-border-default">
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-8 h-8 rounded-full bg-bg-hover flex items-center justify-center">
                          <User className="w-4 h-4 text-text-muted" />
                        </div>
                        <div>
                          <p className="font-semibold text-text-base">{log.usuarios?.nome || 'Usuário Desconhecido'}</p>
                          <p className="text-xs text-text-subtle">{log.usuarios?.email || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                    
                    {log.detalhes && (
                      <div className="bg-bg-base rounded-lg p-3 overflow-x-auto mt-4">
                        {log.detalhes.dados_anteriores || log.detalhes.dados_novos ? (
                          <DiffViewer oldData={log.detalhes.dados_anteriores} newData={log.detalhes.dados_novos} />
                        ) : (
                          <pre className="text-xs text-green-400 font-mono">
                            {JSON.stringify(log.detalhes, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
