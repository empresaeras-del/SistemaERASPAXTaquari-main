import { useEffect, useRef } from 'react';
import { get } from 'idb-keyval';
import { toast } from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { gerarBackupCompleto } from '../services/backupService';

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

          const { jsonString, fileName } = await gerarBackupCompleto({
            isOnline: state.isOnline,
            usuarioNome: state.user?.nome || 'Sistema (Backup Automático)',
            usuarioId: state.user?.id,
            empresaId: state.empresaSelecionada || undefined
          });
          
          const scheduledFileName = `eras_backup_auto_${currentDate}_${currentHour}${currentMinute}.json`;
          
          // @ts-ignore
          const fileHandle = await directoryHandle.getFileHandle(scheduledFileName, { create: true });
          // @ts-ignore
          const writable = await fileHandle.createWritable();
          await writable.write(jsonString);
          await writable.close();

          console.log(`Backup automático salvo com sucesso em: ${scheduledFileName}`);
          toast.success(`Backup automático gerado: ${scheduledFileName}`);
        } catch (error) {
          console.error('Erro ao executar backup automático:', error);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [state.isOnline, state.user, state.empresaSelecionada]);
}
