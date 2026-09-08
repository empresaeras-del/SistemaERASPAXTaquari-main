import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { getNotificacoes, markAsRead, markAllAsRead, deleteNotificacao, Notificacao, createNotificacao, usuarioJaTeveNotificacao } from '../services/notificacoesService';
import { getRequisicoes, atualizarStatusRequisicao } from '../services/requisicoesService';
import { getRemessas } from '../services/faturamentoService';
import { Requisicao } from '../types/requisicoes';
import { RemessaFaturamento } from '../types/faturamento';
import toast from 'react-hot-toast';
import { tenantDeEscrita } from '../utils/tenant';

/**
 * Usuários para os quais o seeding de boas-vindas já foi tentado nesta sessão do app.
 *
 * Mora no módulo, não num `useRef`, porque o hook é montado **duas vezes** ao mesmo tempo
 * — `Topbar` e `NotificationCenter` ambos o chamam. Com um ref por montagem, cada uma
 * semeava por conta própria e o resultado era o par de notificações duplicado no mesmo
 * segundo, visível no banco em quase toda rodada de seeding.
 */
const seedingTentadoPara = new Set<string>();

export const useNotifications = () => {
  const { state } = useAppContext();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [pendingRequisicoes, setPendingRequisicoes] = useState<Requisicao[]>([]);
  const [pendingRemessas, setPendingRemessas] = useState<RemessaFaturamento[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotificacoes = useCallback(async () => {
    if (!state.user?.id) return;
    setLoading(true);
    const tenantId = (state.user?.nivel !== 'super_admin' ? state.user?.tenant_id : (state.empresaSelecionada || state.user?.tenant_id)) || 'all';

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

      // Notificações de boas-vindas: só para quem nunca teve nenhuma.
      //
      // Três condições, e cada uma existe por um motivo aprendido no dado real:
      //  1. a caixa está vazia agora;
      //  2. o usuário nunca teve notificação alguma — nem as que ele já apagou. Sem isso,
      //     apagar todas fazia o usuário parecer novo e as boas-vindas voltavam a cada
      //     carregamento (24 acumuladas para um único usuário, 22 delas já excluídas);
      //  3. dá para determinar a empresa — senão a notificação nasceria sem dono.
      // O `Set` de módulo cobre as duas montagens simultâneas do hook (Topbar e
      // NotificationCenter), que antes semeavam em paralelo.
      const mockTenantId = tenantDeEscrita(tenantId, state.user?.tenant_id);
      const podeSemear =
        notifsData.length === 0 &&
        !!mockTenantId &&
        !seedingTentadoPara.has(state.user.id) &&
        !(await usuarioJaTeveNotificacao(state.isOnline, state.user.id));

      if (podeSemear) {
        seedingTentadoPara.add(state.user.id);
        const mockNotifs: Omit<Notificacao, 'id' | 'created_at'>[] = [
          {
            usuario_id: state.user.id,
            tenant_id: mockTenantId,
            titulo: 'Bem-vindo ao Sistema',
            mensagem: 'Seu acesso foi configurado com sucesso.',
            tipo: 'info',
            lida: false
          },
          {
            usuario_id: state.user.id,
            tenant_id: mockTenantId,
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
  }, [state.isOnline, state.user?.id, state.user?.tenant_id, state.user?.nivel, state.empresaSelecionada]);

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
