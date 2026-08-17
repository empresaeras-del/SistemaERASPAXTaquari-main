import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { getNotificacoes, markAsRead, markAllAsRead, deleteNotificacao, Notificacao, createNotificacao } from '../services/notificacoesService';
import { getRequisicoes, atualizarStatusRequisicao } from '../services/requisicoesService';
import { getRemessas } from '../services/faturamentoService';
import { Requisicao } from '../types/requisicoes';
import { RemessaFaturamento } from '../types/faturamento';
import toast from 'react-hot-toast';

export const useNotifications = () => {
  const { state } = useAppContext();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [pendingRequisicoes, setPendingRequisicoes] = useState<Requisicao[]>([]);
  const [pendingRemessas, setPendingRemessas] = useState<RemessaFaturamento[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotificacoes = useCallback(async () => {
    if (!state.user?.id) return;
    setLoading(true);
    const tenantId = state.empresaSelecionada || 'all';

    try {
      const [notifsData, reqsData, remsData] = await Promise.all([
        getNotificacoes(state.isOnline, state.user.id, tenantId),
        getRequisicoes(state.isOnline, tenantId),
        getRemessas(state.isOnline, tenantId)
      ]);

      // Filter pending requisitions needing authorization ('emitida')
      const pendReqs = reqsData.filter(r => r.status === 'emitida');
      setPendingRequisicoes(pendReqs);

      // Filter pending remittances needing closure/approval ('em_aberto')
      const pendRems = remsData.filter(r => r.status === 'em_aberto');
      setPendingRemessas(pendRems);

      // Seed initial mock notifications if empty
      if (notifsData.length === 0) {
        const mockNotifs: Omit<Notificacao, 'id' | 'created_at'>[] = [
          {
            usuario_id: state.user.id,
            tenant_id: tenantId,
            titulo: 'Bem-vindo ao Sistema',
            mensagem: 'Seu acesso foi configurado com sucesso.',
            tipo: 'info',
            lida: false
          },
          {
            usuario_id: state.user.id,
            tenant_id: tenantId,
            titulo: 'Aviso de Auditoria',
            mensagem: 'Verifique as novas requisições e remessas pendentes de aprovação.',
            tipo: 'alerta',
            lida: false,
            link: '/requisicoes'
          }
        ];
        for (const n of mockNotifs) {
          await createNotificacao(n, state.isOnline);
        }
        const updatedNotifs = await getNotificacoes(state.isOnline, state.user.id, tenantId);
        setNotificacoes(updatedNotifs);
      } else {
        setNotificacoes(notifsData);
      }
    } catch (e) {
      console.warn('Erro ao carregar dados na central de notificações:', e);
    } finally {
      setLoading(false);
    }
  }, [state.isOnline, state.user?.id, state.empresaSelecionada]);

  useEffect(() => {
    fetchNotificacoes();
    
    // Auto refresh every 20s
    const interval = setInterval(() => {
      fetchNotificacoes();
    }, 20000);
    
    return () => clearInterval(interval);
  }, [fetchNotificacoes]);

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id, state.isOnline);
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    if (!state.user?.id) return;
    await markAllAsRead(state.user.id, state.isOnline);
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  };
  
  const handleDelete = async (id: string) => {
    await deleteNotificacao(id, state.isOnline);
    setNotificacoes(prev => prev.filter(n => n.id !== id));
  };

  // Quick action: Autorizar Requisição diretamente da Central de Notificações
  const handleAutorizarRequisicaoRapida = async (reqId: string) => {
    try {
      await atualizarStatusRequisicao(state.isOnline, reqId, 'autorizada', {
        autorizado_por: state.user?.nome || 'Operador'
      });
      toast.success('Requisição/Guia autorizada com sucesso!');
      await fetchNotificacoes();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao autorizar requisição.');
    }
  };

  const unreadCount = notificacoes.filter(n => !n.lida).length;
  const pendingReqCount = pendingRequisicoes.length;
  const pendingRemCount = pendingRemessas.length;
  const totalAlertsCount = unreadCount + pendingReqCount + pendingRemCount;

  return {
    notificacoes,
    pendingRequisicoes,
    pendingRemessas,
    unreadCount,
    pendingReqCount,
    pendingRemCount,
    totalAlertsCount,
    loading,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleDelete,
    handleAutorizarRequisicaoRapida,
    refresh: fetchNotificacoes
  };
};
