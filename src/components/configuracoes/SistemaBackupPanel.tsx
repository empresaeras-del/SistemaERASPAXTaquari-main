import React, { useState, useEffect } from 'react';
import { DownloadCloud, Loader2, Database, AlertTriangle, Folder, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { get, set } from 'idb-keyval';



export const SistemaBackupPanel = () => {
  const { state } = useAppContext();
  const toast = useToast();
  const [isExporting, setIsExporting] = useState(false);
  
  const [hasFolder, setHasFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [backupTime, setBackupTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);

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

  const handleBackup = async () => {
    if (!state.user || (state.user.nivel !== 'admin' && state.user.nivel !== 'super_admin')) {
      toast.error('Sem permissão para realizar backup.');
      return;
    }

    try {
      setIsExporting(true);
      toast.info('Iniciando coleta de dados para backup...', 3000);

      const backupData: any = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        dados: {}
      };

      if (state.isOnline) {
        const tables = [
          'empresas',
          'usuarios',
          'planos',
          'associados',
          'dependentes',
          'contas_bancarias',
          'caixas',
          'titulos',
          'movimentacoes_caixa',
          'documentos_padroes'
        ];

        for (const table of tables) {
          const { data, error } = await supabase.from(table).select('*');
          if (!error && data) {
            backupData.dados[table] = data;
          } else {
            console.warn(`Erro ao buscar ${table}:`, error);
          }
        }
      } else {
        toast.error('Backup manual só pode ser realizado quando online.');
        setIsExporting(false);
        return;
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `eras_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Backup gerado e baixado com sucesso!');
      
      if (state.user) {
        await supabase.rpc('registrar_audit', {
          p_usuario_id: state.user.id,
          p_acao: 'BACKUP_MANUAL',
          p_tabela: 'sistema',
          p_dados_novos: { file: a.download },
          p_empresa_id: state.empresaSelecionada || null
        });
      }

    } catch (error) {
      console.error('Erro ao gerar backup:', error);
      toast.error('Ocorreu um erro ao gerar o arquivo de backup.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-[#181B34] border border-[#262A45] rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full mt-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#262A45] pb-4">
        <Database className="w-6 h-6 text-[#7E4CF3]" />
        <div>
          <h2 className="text-xl font-bold text-white">Sistema & Backup</h2>
          <p className="text-sm text-slate-400">Gerenciamento de dados críticos do sistema.</p>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-[#101223] border border-[#262A45] rounded-xl p-5">
        <div className="flex gap-4 items-start">
          <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1">Atenção sobre Backups</h3>
            <p className="text-sm text-slate-400 mb-3 text-justify">
              O arquivo de backup conterá dados sensíveis, incluindo informações financeiras e dados pessoais de associados e dependentes. 
              Armazene o arquivo gerado em um local seguro. Esta ação ficará registrada em log de auditoria do sistema.
            </p>
            <div className="text-xs text-slate-500 bg-[#0A0B16] px-3 py-2 rounded border border-[#262A45]">
              <strong>Tabelas incluídas:</strong> Empresas, Usuários, Planos, Associados, Dependentes, Contas, Caixas, Títulos, Movimentações e Documentos.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scheduled Backup */}
        <div className="bg-[#101223] border border-[#262A45] rounded-xl p-6 flex flex-col">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            Backup Automático Programado
          </h3>
          
          {window.self !== window.top && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs p-3 rounded-lg flex gap-2 items-start text-justify">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Atenção:</strong> Como você está acessando através do modo de visualização embutido, a seleção de pastas locais por segurança está bloqueada pelo navegador. Para configurar o backup automático, abra o aplicativo em uma <strong>nova aba</strong>.
              </span>
            </div>
          )}
          
          <div className="space-y-4 flex-1">
            <div className="space-y-2">
              <label className="text-sm text-slate-400 block">1. Pasta de Destino</label>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleSelectFolder}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#181B34] border border-[#262A45] text-white rounded-lg hover:bg-[#262A45] transition-colors text-sm"
                >
                  <Folder className="w-4 h-4" />
                  {hasFolder ? 'Mudar Pasta' : 'Selecionar Pasta'}
                </button>
                {hasFolder && (
                  <div className="flex items-center gap-1 text-emerald-400 text-xs px-2 py-1 bg-emerald-400/10 rounded border border-emerald-400/20" title={folderName}>
                    <CheckCircle className="w-3 h-3" />
                    <span className="max-w-[100px] truncate">{folderName}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-400 block">2. Horário Diário</label>
              <input 
                type="time" 
                value={backupTime}
                onChange={(e) => setBackupTime(e.target.value)}
                className="w-full px-4 py-2 bg-[#181B34] border border-[#262A45] rounded-lg text-white focus:outline-none focus:border-[#7E4CF3] transition-colors"
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#262A45] flex gap-2">
            <button
              onClick={handleSaveSchedule}
              className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors text-sm"
            >
              Ativar Programação
            </button>
            {isScheduled && (
              <button
                onClick={handleDisableSchedule}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg font-medium transition-colors text-sm"
              >
                Desativar
              </button>
            )}
          </div>
          {isScheduled && (
            <p className="text-xs text-emerald-400 mt-3 text-center">
              Backup programado para as {backupTime} todos os dias. (A guia do navegador deve estar aberta)
            </p>
          )}
        </div>

        {/* Manual Backup */}
        <div className="bg-[#101223] border border-[#262A45] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <DownloadCloud className="w-5 h-5 text-[#4A88E9]" />
              Backup Manual
            </h3>
            <p className="text-sm text-slate-400">
              Gere um backup completo do sistema imediatamente. O download iniciará logo após a compilação dos dados.
            </p>
          </div>
          
          <button
            onClick={handleBackup}
            disabled={isExporting || !state.isOnline}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#7E4CF3] to-[#4A88E9] hover:opacity-90 text-white rounded-xl font-medium transition-all shadow-lg shadow-[#7E4CF3]/20 disabled:opacity-50 mt-6"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <DownloadCloud className="w-5 h-5" />}
            {isExporting ? 'Processando...' : 'Gerar Backup Agora'}
          </button>
        </div>
      </div>
    </div>
  );
};
