import { useEffect, useRef } from 'react';
import { get } from 'idb-keyval';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';

export function useScheduledBackup() {
  const { state } = useAppContext();
  const lastBackupDate = useRef('');

  useEffect(() => {
    if (!state.isOnline) return;

    const interval = setInterval(async () => {
      const timeStr = localStorage.getItem('backup_time');
      if (!timeStr) return;

      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, '0');
      const currentMinute = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${currentHour}:${currentMinute}`;
      const currentDate = now.toISOString().split('T')[0];

      // Se for a hora e ainda não fizemos backup hoje
      if (currentTime === timeStr && lastBackupDate.current !== currentDate) {
        lastBackupDate.current = currentDate;
        
        try {
          const directoryHandle = await get('backup_folder_handle');
          if (!directoryHandle) {
            console.warn('Pasta de backup não encontrada. Usuário precisa reconfigurar.');
            return;
          }

          // Verificar permissão
          const options = { mode: 'readwrite' };
          // @ts-ignore
          if ((await directoryHandle.queryPermission(options)) !== 'granted') {
            // @ts-ignore
            const req = await directoryHandle.requestPermission(options);
            if (req !== 'granted') {
              console.warn('Permissão negada para acessar a pasta de backup automática.');
              return;
            }
          }

          const backupData: any = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            dados: {}
          };

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
            }
          }

          const jsonString = JSON.stringify(backupData, null, 2);
          const fileName = `eras_backup_auto_${currentDate}_${currentHour}${currentMinute}.json`;
          
          // @ts-ignore
          const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
          // @ts-ignore
          const writable = await fileHandle.createWritable();
          await writable.write(jsonString);
          await writable.close();

          console.log(`Backup automático salvo com sucesso em: ${fileName}`);
          toast.success(`Backup automático gerado: ${fileName}`);
          
          if (state.user) {
            await supabase.rpc('registrar_audit', {
              p_usuario_id: state.user.id,
              p_acao: 'BACKUP_AUTOMATICO',
              p_tabela: 'sistema',
              p_dados_novos: { file: fileName },
              p_empresa_id: state.empresaSelecionada || null
            });
          }

        } catch (error) {
          console.error('Erro ao executar backup automático:', error);
        }
      }

    }, 60000); // Verifica a cada minuto

    return () => clearInterval(interval);
  }, [state.isOnline, state.user, state.empresaSelecionada]);
}
