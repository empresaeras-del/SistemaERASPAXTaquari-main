import React, { useState, useEffect, useRef } from 'react';
import { 
  DownloadCloud, 
  UploadCloud, 
  Loader2, 
  Database, 
  AlertTriangle, 
  Folder, 
  Clock, 
  CheckCircle, 
  FileText, 
  RefreshCw, 
  ShieldCheck, 
  ListOrdered, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  XCircle,
  FileCheck,
  AlertCircle
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useAppContext } from '../../context/AppContext';
import { get, set } from 'idb-keyval';
import { 
  TABELAS_SISTEMA, 
  gerarBackupCompleto, 
  analisarArquivoBackup, 
  restaurarBackup, 
  AnaliseBackup 
} from '../../services/backupService';

export const SistemaBackupPanel = () => {
  const { state } = useAppContext();
  const toast = useToast();
  const { confirm } = useConfirm();

  // Estados do Backup Manual
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ tabela: string; atual: number; total: number } | null>(null);

  // Estados do Backup Programado
  const [hasFolder, setHasFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [backupTime, setBackupTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);

  // Estados da Importação / Restauração
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [analise, setAnalise] = useState<AnaliseBackup | null>(null);
  const [showTabelasDetalhes, setShowTabelasDetalhes] = useState(false);
  const [modoRestauracao, setModoRestauracao] = useState<'upsert' | 'substituir'>('upsert');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ tabela: string; atual: number; total: number; status: string } | null>(null);
  const [resultadoRestauracao, setResultadoRestauracao] = useState<{ sucesso: boolean; tabelas: number; registros: number; erros: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadConfig = async () => {
      const handle = await get('backup_folder_handle');
      if (handle) {
        setHasFolder(true);
        setFolderName(handle.name);
      }
      const time = localStorage.getItem('backup_time');
      if (time) {
        setBackupTime(time);
        setIsScheduled(true);
      }
    };
    loadConfig();
  }, []);

  // Seleção de pasta para backup automático
  const handleSelectFolder = async () => {
    try {
      if (window.self !== window.top) {
        toast.error('Para selecionar uma pasta, você precisa abrir o sistema em uma nova aba (fora do modo de visualização).', 5000);
        return;
      }
      
      if (!('showDirectoryPicker' in window)) {
        toast.error('Seu navegador não suporta a seleção de pastas (File System Access API).');
        return;
      }
      
      const directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      
      await set('backup_folder_handle', directoryHandle);
      setHasFolder(true);
      setFolderName(directoryHandle.name);
      toast.success('Pasta selecionada com sucesso!');
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Erro ao selecionar pasta:', error);
        toast.error('Erro ao selecionar pasta de backup.');
      }
    }
  };

  const handleSaveSchedule = () => {
    if (!hasFolder) {
      toast.error('Selecione uma pasta primeiro.');
      return;
    }
    if (!backupTime) {
      toast.error('Defina um horário para o backup.');
      return;
    }
    
    localStorage.setItem('backup_time', backupTime);
    setIsScheduled(true);
    toast.success('Backup programado salvo com sucesso!');
  };

  const handleDisableSchedule = () => {
    localStorage.removeItem('backup_time');
    setIsScheduled(false);
    setBackupTime('');
    toast.success('Backup programado desativado.');
  };

  // Geração de Backup Manual
  const handleBackup = async () => {
    if (!state.user || (state.user.nivel !== 'admin' && state.user.nivel !== 'super_admin')) {
      toast.error('Permissão negada. Somente usuários administradores podem gerar backups.');
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress({ tabela: 'Iniciando...', atual: 0, total: TABELAS_SISTEMA.length });

      const { jsonString, fileName, backupData } = await gerarBackupCompleto({
        isOnline: state.isOnline,
        usuarioNome: state.user?.nome || 'Administrador',
        usuarioId: state.user?.id,
        empresaId: state.empresaSelecionada || undefined,
        onProgress: (tabelaLabel, atual, total) => {
          setExportProgress({ tabela: tabelaLabel, atual, total });
        }
      });

      // Dispara o download do arquivo .json
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Backup concluído! ${backupData.resumo.registros_total} registros salvos de ${backupData.resumo.tabelas_total} tabelas.`);
    } catch (error) {
      console.error('Erro ao gerar backup:', error);
      toast.error('Ocorreu um erro ao gerar o arquivo de backup.');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  // Processamento do Arquivo de Backup para Importação
  const processarArquivoBackup = (file: File) => {
    setBackupFile(file);
    setResultadoRestauracao(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const res = analisarArquivoBackup(content);
      setAnalise(res);
      if (!res.valido) {
        toast.error(res.mensagemErro || 'Arquivo de backup inválido.');
      } else {
        toast.success(`Backup validado: ${res.registros_total} registros encontrados.`);
      }
    };
    reader.onerror = () => {
      toast.error('Erro ao ler o arquivo selecionado.');
    };
    reader.readAsText(file);
  };

  // Executar Restauração de Backup
  const handleExecutarRestauracao = () => {
    if (!analise || !analise.valido) {
      toast.error('Selecione um arquivo de backup válido primeiro.');
      return;
    }

    if (!state.user || (state.user.nivel !== 'admin' && state.user.nivel !== 'super_admin')) {
      toast.error('Permissão negada. Somente usuários administradores podem restaurar backups.');
      return;
    }

    confirm({
      title: 'Restaurar Dados do Backup?',
      message: `Atenção: Você está prestes a restaurar ${analise.registros_total} registros em ${analise.tabelas_total} tabelas. Esta ação atualizará os dados do sistema. Deseja continuar?`,
      confirmText: 'Sim, Iniciar Restauração',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        try {
          setIsRestoring(true);
          setResultadoRestauracao(null);
          setRestoreProgress({ tabela: 'Iniciando restauração...', atual: 0, total: TABELAS_SISTEMA.length, status: 'Preparando tabelas...' });

          const resultado = await restaurarBackup({
            analise,
            isOnline: state.isOnline,
            modo: modoRestauracao,
            usuarioId: state.user?.id,
            empresaId: state.empresaSelecionada || undefined,
            onProgress: (tabelaLabel, progresso, totalTabelas, status) => {
              setRestoreProgress({ tabela: tabelaLabel, atual: progresso, total: totalTabelas, status });
            }
          });

          setResultadoRestauracao({
            sucesso: resultado.sucesso,
            tabelas: resultado.tabelasRestauradas,
            registros: resultado.registrosRestaurados,
            erros: resultado.erros
          });

          if (resultado.sucesso) {
            toast.success(`Restauração concluída com sucesso! ${resultado.registrosRestaurados} registros restaurados.`);
          } else {
            toast.error(`Restauração finalizada com alguns avisos. Verifique o relatório.`);
          }
        } catch (err: any) {
          console.error('Erro na restauração:', err);
          toast.error(`Falha ao restaurar backup: ${err.message || 'Erro desconhecido'}`);
        } finally {
          setIsRestoring(false);
          setRestoreProgress(null);
        }
      }
    });
  };

  const handleLimparSelecao = () => {
    setBackupFile(null);
    setAnalise(null);
    setResultadoRestauracao(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-[#181B34] border border-[#262A45] rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full mt-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#262A45] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6]">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Sistema & Backup</h2>
            <p className="text-sm text-slate-400">Gerenciamento completo, exportação e restauração de dados de todas as tabelas.</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-[#101223] px-3 py-1.5 rounded-lg border border-[#262A45]">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>28 Tabelas Mapeadas</span>
        </div>
      </div>

      {/* Warning & Info Box */}
      <div className="bg-[#101223] border border-[#262A45] rounded-xl p-5">
        <div className="flex gap-4 items-start">
          <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-white font-semibold">Segurança e Escopo de Backups</h3>
            <p className="text-sm text-slate-400 text-justify">
              O arquivo de backup gerado contém a estrutura completa de todas as tabelas do sistema (empresas, usuários, planos, associados, dependentes, contratos, financeiro, caixas, atendimentos, requisições e documentos). Guarde o arquivo JSON em local seguro.
            </p>
            <div className="text-xs text-slate-400 bg-[#0A0B16] p-2.5 rounded-lg border border-[#262A45] flex flex-wrap gap-1.5 items-center">
              <strong className="text-white mr-1">Tabelas abrangidas ({TABELAS_SISTEMA.length}):</strong>
              {TABELAS_SISTEMA.map(t => (
                <span key={t.nome} className="bg-[#181B34] text-slate-300 px-2 py-0.5 rounded border border-[#262A45] text-[11px]">
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Backup Manual e Backup Automático */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manual Backup Card */}
        <div className="bg-[#101223] border border-[#262A45] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <DownloadCloud className="w-5 h-5 text-[#3B82F6]" />
              Backup Manual Completo
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Gera e baixa um arquivo estruturado <code className="text-[#3B82F6] font-mono">.JSON</code> com todos os registros de todas as tabelas do sistema.
            </p>
          </div>

          {exportProgress && (
            <div className="my-4 bg-[#181B34] p-4 rounded-xl border border-[#262A45] space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Exportando: <strong>{exportProgress.tabela}</strong></span>
                <span>{exportProgress.atual} de {exportProgress.total} tabelas</span>
              </div>
              <div className="w-full bg-[#101223] h-2 rounded-full overflow-hidden border border-[#262A45]">
                <div 
                  className="bg-gradient-to-r from-[#3B82F6] to-emerald-400 h-full transition-all duration-200"
                  style={{ width: `${(exportProgress.atual / exportProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          
          <button
            onClick={handleBackup}
            disabled={isExporting || isRestoring}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:opacity-90 text-white rounded-xl font-medium transition-all shadow-lg shadow-[#3B82F6]/25 disabled:opacity-50 mt-4"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <DownloadCloud className="w-5 h-5" />}
            {isExporting ? 'Compilando Todas as Tabelas...' : 'Gerar Backup Completo (.JSON)'}
          </button>
        </div>

        {/* Scheduled Backup Card */}
        <div className="bg-[#101223] border border-[#262A45] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              Backup Automático Programado
            </h3>
            
            {window.self !== window.top && (
              <div className="mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs p-3 rounded-lg flex gap-2 items-start text-justify">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Para configurar a pasta local de backup automático, abra o sistema em uma <strong>nova aba</strong> do navegador.
                </span>
              </div>
            )}
            
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">1. Pasta de Destino</label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSelectFolder}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#181B34] border border-[#262A45] text-white rounded-xl hover:bg-[#262A45] transition-colors text-sm"
                  >
                    <Folder className="w-4 h-4 text-[#3B82F6]" />
                    {hasFolder ? 'Alterar Pasta' : 'Selecionar Pasta'}
                  </button>
                  {hasFolder && (
                    <div className="flex items-center gap-1 text-emerald-400 text-xs px-2.5 py-2 bg-emerald-400/10 rounded-xl border border-emerald-400/20" title={folderName}>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="max-w-[120px] truncate">{folderName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">2. Horário Diário</label>
                <input 
                  type="time" 
                  value={backupTime}
                  onChange={(e) => setBackupTime(e.target.value)}
                  className="w-full px-4 py-2 bg-[#181B34] border border-[#262A45] rounded-xl text-white focus:outline-none focus:border-[#3B82F6] transition-colors text-sm"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#262A45]">
            <div className="flex gap-2">
              <button
                onClick={handleSaveSchedule}
                className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors text-sm shadow-md shadow-emerald-500/20"
              >
                Ativar Programação
              </button>
              {isScheduled && (
                <button
                  onClick={handleDisableSchedule}
                  className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl font-medium transition-colors text-sm"
                >
                  Desativar
                </button>
              )}
            </div>
            {isScheduled && (
              <p className="text-xs text-emerald-400 mt-2 text-center">
                Backup diário ativo às {backupTime}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO: IMPORTAÇÃO E RESTAURAÇÃO DE BACKUP */}
      <div className="bg-[#101223] border border-[#262A45] rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-[#262A45] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Importação e Restauração de Backup</h3>
              <p className="text-xs text-slate-400">Carregue um arquivo JSON gerado pelo sistema para restaurar todos os registros de todas as tabelas.</p>
            </div>
          </div>
        </div>

        {/* Dropzone de Arquivo de Backup */}
        {!backupFile ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                if (!file.name.endsWith('.json')) {
                  toast.error('Por favor, selecione um arquivo no formato .JSON.');
                  return;
                }
                processarArquivoBackup(file);
              }
            }}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all ${
              isDraggingFile 
                ? 'border-purple-500 bg-purple-500/10 scale-[1.01]' 
                : 'border-[#262A45] hover:border-purple-500/50 bg-[#181B34]/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              id="upload-backup-file"
              className="hidden"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  processarArquivoBackup(file);
                }
              }}
            />
            <label
              htmlFor="upload-backup-file"
              className="cursor-pointer flex flex-col items-center group w-full"
            >
              <div className="w-14 h-14 bg-[#101223] group-hover:bg-purple-500/10 rounded-2xl flex items-center justify-center mb-3 transition-colors">
                <UploadCloud className="w-7 h-7 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-sm font-semibold text-white mb-1 text-center">
                Clique para selecionar o arquivo de backup ou arraste o arquivo aqui
              </p>
              <p className="text-xs text-slate-400 text-center">
                Suporta backups completos no formato <code className="text-purple-400 font-mono">.JSON</code>
              </p>
            </label>
          </div>
        ) : (
          /* Card de Análise e Confirmação de Restauração */
          <div className="space-y-5">
            <div className="bg-[#181B34] border border-[#262A45] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-base">{backupFile.name}</h4>
                    <p className="text-xs text-slate-400">
                      {(backupFile.size / 1024).toFixed(1)} KB • Carregado para validação
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={handleLimparSelecao}
                  className="text-xs text-slate-400 hover:text-rose-400 transition-colors px-3 py-1.5 bg-[#101223] rounded-lg border border-[#262A45]"
                >
                  Trocar Arquivo
                </button>
              </div>

              {analise && analise.valido ? (
                <div className="space-y-4 pt-3 border-t border-[#262A45]">
                  {/* Grid de Metadados do Backup */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#101223] p-3 rounded-xl border border-[#262A45]">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Sistema / Versão</p>
                      <p className="text-sm font-bold text-white">{analise.sistema} (v{analise.versao})</p>
                    </div>
                    <div className="bg-[#101223] p-3 rounded-xl border border-[#262A45]">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Data do Backup</p>
                      <p className="text-sm font-bold text-white">
                        {analise.timestamp ? new Date(analise.timestamp).toLocaleString('pt-BR') : 'Não informada'}
                      </p>
                    </div>
                    <div className="bg-[#101223] p-3 rounded-xl border border-[#262A45]">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Tabelas Identificadas</p>
                      <p className="text-sm font-bold text-emerald-400">{analise.tabelas_total} tabelas</p>
                    </div>
                    <div className="bg-[#101223] p-3 rounded-xl border border-[#262A45]">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Total de Registros</p>
                      <p className="text-sm font-bold text-purple-400">{analise.registros_total} itens</p>
                    </div>
                  </div>

                  {/* Toggle para visualizar contagem por tabela */}
                  <div className="bg-[#101223] rounded-xl border border-[#262A45] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowTabelasDetalhes(!showTabelasDetalhes)}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <ListOrdered className="w-4 h-4 text-[#3B82F6]" />
                        Detalhamento de registros por tabela ({analise.tabelas_total} com dados)
                      </span>
                      {showTabelasDetalhes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showTabelasDetalhes && (
                      <div className="p-4 border-t border-[#262A45] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto custom-scrollbar">
                        {TABELAS_SISTEMA.map(tab => {
                          const count = analise.dadosNormalizados[tab.nome]?.length || 0;
                          return (
                            <div 
                              key={tab.nome} 
                              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                                count > 0 
                                  ? 'bg-[#181B34] border-emerald-500/30 text-slate-200' 
                                  : 'bg-[#14172B] border-[#262A45] text-slate-500 opacity-60'
                              }`}
                            >
                              <span className="truncate pr-2">{tab.label}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                count > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                              }`}>
                                {count} {count === 1 ? 'item' : 'itens'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Opção de Modo de Restauração */}
                  <div className="bg-[#101223] p-4 rounded-xl border border-[#262A45] space-y-2">
                    <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Modo de Restauração</p>
                    <label className="flex items-center gap-3 cursor-pointer text-sm text-slate-300 hover:text-white transition-colors">
                      <input 
                        type="radio" 
                        name="modoRestauracao" 
                        value="upsert" 
                        checked={modoRestauracao === 'upsert'}
                        onChange={() => setModoRestauracao('upsert')}
                        className="accent-[#3B82F6] w-4 h-4"
                      />
                      <span>
                        <strong className="text-white">Mesclar e Atualizar Registros (Recomendado):</strong> Insere novos registros e atualiza registros existentes sem apagar dados atuais não presentes no backup.
                      </span>
                    </label>
                  </div>
                </div>
              ) : analise ? (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{analise.mensagemErro}</span>
                </div>
              ) : null}
            </div>

            {/* Progresso da Restauração */}
            {restoreProgress && (
              <div className="bg-[#181B34] p-4 rounded-xl border border-purple-500/30 space-y-2 animate-in fade-in">
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                    <span>Restaurando tabela: <strong className="text-white">{restoreProgress.tabela}</strong></span>
                  </span>
                  <span className="font-mono text-purple-400">{restoreProgress.atual} de {restoreProgress.total}</span>
                </div>
                <div className="w-full bg-[#101223] h-2.5 rounded-full overflow-hidden border border-[#262A45]">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-[#3B82F6] h-full transition-all duration-300"
                    style={{ width: `${(restoreProgress.atual / restoreProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400">{restoreProgress.status}</p>
              </div>
            )}

            {/* Resultado Final da Restauração */}
            {resultadoRestauracao && (
              <div className={`p-4 rounded-xl border space-y-2 animate-in fade-in ${
                resultadoRestauracao.sucesso 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}>
                <div className="flex items-center gap-2 font-semibold text-sm">
                  {resultadoRestauracao.sucesso ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-amber-400" />}
                  <span>
                    {resultadoRestauracao.sucesso ? 'Restauração Concluída com Sucesso!' : 'Restauração Concluída com Avisos'}
                  </span>
                </div>
                <p className="text-xs">
                  Foram restaurados com sucesso <strong>{resultadoRestauracao.registros} registros</strong> em <strong>{resultadoRestauracao.tabelas} tabelas</strong> do sistema.
                </p>
                {resultadoRestauracao.erros.length > 0 && (
                  <div className="pt-2 text-xs text-rose-400 space-y-1">
                    <p className="font-semibold">Ocorrências:</p>
                    {resultadoRestauracao.erros.map((err, i) => (
                      <p key={i}>• {err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Botão de Ação: Executar Restauração */}
            {analise && analise.valido && !resultadoRestauracao && (
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={handleLimparSelecao}
                  className="px-5 py-2.5 bg-[#181B34] hover:bg-[#262A45] text-slate-300 rounded-xl text-sm font-medium transition-colors border border-[#262A45]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={handleExecutarRestauracao}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50"
                >
                  {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {isRestoring ? 'Restaurando Dados...' : 'Confirmar e Restaurar Backup'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
