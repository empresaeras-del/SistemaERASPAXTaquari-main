import React, { useRef, useEffect, useState } from 'react';
import { 
  Bell, 
  Check, 
  Trash2, 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  FileText, 
  FileCheck2, 
  Receipt, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  User, 
  Building2, 
  X,
  ExternalLink
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { 
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
    handleAutorizarRequisicaoRapida
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<'geral' | 'requisicoes' | 'remessas'>('geral');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'info': return <Info className="w-4 h-4 text-blue-400" />;
      case 'alerta': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'sucesso': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'erro': return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'acao': return <FileText className="w-4 h-4 text-purple-400" />;
      default: return <Bell className="w-4 h-4 text-text-subtle" />;
    }
  };

  const getBgColor = (tipo: string, lida: boolean) => {
    if (lida) return 'bg-transparent';
    switch (tipo) {
      case 'info': return 'bg-blue-400/5';
      case 'alerta': return 'bg-amber-400/5';
      case 'sucesso': return 'bg-emerald-400/5';
      case 'erro': return 'bg-rose-400/5';
      case 'acao': return 'bg-purple-400/5';
      default: return 'bg-slate-400/5';
    }
  };

  return (
    <div 
      ref={menuRef} 
      className="absolute top-14 right-2 sm:right-6 w-[92vw] sm:w-[460px] bg-bg-surface border border-border-default shadow-2xl rounded-2xl overflow-hidden flex flex-col z-50 max-h-[85vh] animate-in fade-in zoom-in-95"
    >
      {/* HEADER */}
      <div className="p-4 border-b border-border-default bg-bg-subtle flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-base flex items-center gap-2">
              Central de Notificações
              {totalAlertsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3B82F6] text-white">
                  {totalAlertsCount}
                </span>
              )}
            </h3>
            <p className="text-xs text-text-subtle">Alertas de aprovação e sistema</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="text-text-subtle hover:text-text-base p-1.5 rounded-lg hover:bg-bg-hover transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center border-b border-border-default bg-bg-subtle/50 px-2 pt-2 gap-1 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('geral')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'geral'
              ? 'border-[#3B82F6] text-[#3B82F6] bg-bg-surface'
              : 'border-transparent text-text-subtle hover:text-text-base'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Geral</span>
          {unreadCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('requisicoes')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'requisicoes'
              ? 'border-[#3B82F6] text-[#3B82F6] bg-bg-surface'
              : 'border-transparent text-text-subtle hover:text-text-base'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>Requisições Pendentes</span>
          {pendingReqCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">
              {pendingReqCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('remessas')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'remessas'
              ? 'border-[#3B82F6] text-[#3B82F6] bg-bg-surface'
              : 'border-transparent text-text-subtle hover:text-text-base'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Remessas Faturamento</span>
          {pendingRemCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/10 text-purple-500 border border-purple-500/20 font-bold">
              {pendingRemCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB CONTENT CONTAINER */}
      <div className="overflow-y-auto flex-1 p-3 space-y-2 custom-scrollbar min-h-[280px]">
        {loading && (
          <div className="py-12 text-center text-text-subtle flex flex-col items-center">
            <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-sm">Atualizando central de alertas...</p>
          </div>
        )}

        {/* TAB 1: GERAL (SISTEMA) */}
        {!loading && activeTab === 'geral' && (
          <>
            <div className="flex items-center justify-between pb-2 px-1 border-b border-border-default/50 text-xs">
              <span className="text-text-subtle font-medium">Notificações gerais do sistema</span>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllAsRead}
                  className="text-xs font-medium text-[#3B82F6] hover:underline flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Marcar todas como lidas
                </button>
              )}
            </div>

            {notificacoes.length === 0 ? (
              <div className="py-12 text-center text-text-subtle flex flex-col items-center">
                <Bell className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium text-text-base">Nenhuma notificação cadastrada</p>
                <p className="text-xs mt-1 text-text-subtle">Você não possui avisos do sistema pendentes.</p>
              </div>
            ) : (
              notificacoes.map(notif => (
                <div 
                  key={notif.id}
                  className={`p-3 rounded-xl border border-border-default hover:bg-bg-subtle transition-colors relative group flex gap-3 ${getBgColor(notif.tipo, notif.lida)}`}
                >
                  <div className="shrink-0 mt-0.5">
                    {getIcon(notif.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <h4 className={`text-xs font-bold truncate ${notif.lida ? 'text-text-subtle' : 'text-text-base'}`}>
                        {notif.titulo}
                      </h4>
                      <span className="text-[10px] font-medium text-text-subtle whitespace-nowrap shrink-0">
                        {new Date(notif.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <p className={`text-xs ${notif.lida ? 'text-text-subtle' : 'text-text-base'} line-clamp-2`}>
                      {notif.mensagem}
                    </p>
                    
                    {notif.link && (
                      <Link 
                        to={notif.link}
                        onClick={() => {
                          if (!notif.lida) handleMarkAsRead(notif.id);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[#3B82F6] hover:underline"
                      >
                        <span>Acessar</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>

                  {/* Actions on hover */}
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-bg-surface p-1 rounded-lg shadow-md border border-border-default">
                    {!notif.lida && (
                      <button 
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="p-1 text-text-subtle hover:text-emerald-500 rounded transition-colors"
                        title="Marcar como lida"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(notif.id)}
                      className="p-1 text-text-subtle hover:text-rose-500 rounded transition-colors"
                      title="Excluir notificação"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!notif.lida && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#3B82F6] rounded-r-full" />
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* TAB 2: REQUIÇÕES PENDENTES DE AUTORIZAÇÃO */}
        {!loading && activeTab === 'requisicoes' && (
          <>
            <div className="pb-2 px-1 border-b border-border-default/50 text-xs text-text-subtle flex items-center justify-between">
              <span>Guias/Requisições aguardando autorização ({pendingReqCount})</span>
              <Link
                to="/requisicoes"
                onClick={onClose}
                className="text-[#3B82F6] hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Ver todas</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {pendingRequisicoes.length === 0 ? (
              <div className="py-12 text-center text-text-subtle flex flex-col items-center">
                <CheckCircle className="w-10 h-10 mb-3 text-emerald-500/40" />
                <p className="text-sm font-medium text-text-base">Todas as requisições estão autorizadas!</p>
                <p className="text-xs mt-1 text-text-subtle">Nenhuma guia pendente de aprovação no momento.</p>
              </div>
            ) : (
              pendingRequisicoes.map(req => (
                <div 
                  key={req.id}
                  className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors space-y-2.5 relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text-base">{req.codigo_requisicao}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          EMITIDA / PENDENTE
                        </span>
                      </div>
                      <div className="text-xs text-text-subtle mt-0.5 flex items-center gap-2">
                        <span>Emissão: {format(new Date(req.data_emissao), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-text-base">{formatBRL(req.valor_total)}</span>
                  </div>

                  <div className="text-xs space-y-1 bg-bg-surface/80 p-2.5 rounded-lg border border-border-default">
                    <div className="flex items-center gap-1.5 text-text-base font-medium">
                      <User className="w-3.5 h-3.5 text-[#3B82F6]" />
                      <span>Paciente: {req.paciente_nome}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-text-subtle">
                      <Building2 className="w-3.5 h-3.5 text-text-subtle" />
                      <span>Prestador: {req.credenciado_nome}</span>
                    </div>
                    <div className="text-text-subtle text-[11px] pt-1 border-t border-border-default/50">
                      Itens: {req.itens.map(i => `${i.descricao} (${i.quantidade}x)`).join(', ')}
                    </div>
                  </div>

                  {/* QUICK ACTIONS */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Link
                      to="/requisicoes"
                      onClick={onClose}
                      className="px-3 py-1.5 rounded-lg border border-border-default text-xs font-semibold text-text-subtle hover:text-text-base hover:bg-bg-surface transition-colors"
                    >
                      Ver Detalhes
                    </Link>

                    <button
                      onClick={() => handleAutorizarRequisicaoRapida(req.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Autorizar Guia</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* TAB 3: REMESSAS DE FATURAMENTO ABERTAS */}
        {!loading && activeTab === 'remessas' && (
          <>
            <div className="pb-2 px-1 border-b border-border-default/50 text-xs text-text-subtle flex items-center justify-between">
              <span>Lotes de faturamento em aberto ({pendingRemCount})</span>
              <Link
                to="/faturamentos"
                onClick={onClose}
                className="text-[#3B82F6] hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Ver todas</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {pendingRemessas.length === 0 ? (
              <div className="py-12 text-center text-text-subtle flex flex-col items-center">
                <Receipt className="w-10 h-10 mb-3 text-purple-500/40" />
                <p className="text-sm font-medium text-text-base">Nenhuma remessa em aberto</p>
                <p className="text-xs mt-1 text-text-subtle">Todas as remessas foram processadas e fechadas.</p>
              </div>
            ) : (
              pendingRemessas.map(rem => (
                <div 
                  key={rem.id}
                  className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition-colors space-y-2.5 relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text-base">{rem.codigo_remessa}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                          EM ABERTO
                        </span>
                      </div>
                      <div className="text-xs text-text-subtle mt-0.5">
                        Criação: {format(new Date(rem.data_criacao), 'dd/MM/yyyy HH:mm')}
                      </div>
                    </div>
                    <span className="font-bold text-sm text-emerald-500">{formatBRL(rem.valor_liquido)}</span>
                  </div>

                  <div className="text-xs space-y-1 bg-bg-surface/80 p-2.5 rounded-lg border border-border-default">
                    <div className="flex items-center gap-1.5 text-text-base font-medium">
                      <Building2 className="w-3.5 h-3.5 text-[#3B82F6]" />
                      <span>Prestador: {rem.credenciado_nome}</span>
                    </div>
                    <div className="flex items-center justify-between text-text-subtle pt-1 border-t border-border-default/50">
                      <span>{rem.qtd_guias} guias inclusas</span>
                      {rem.valor_desconto_glosa > 0 && (
                        <span className="text-rose-500 font-medium">Glosa: - {formatBRL(rem.valor_desconto_glosa)}</span>
                      )}
                    </div>
                  </div>

                  {/* QUICK ACTIONS */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Link
                      to="/faturamentos"
                      onClick={onClose}
                      className="px-3 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Conferir & Fechar Remessa</span>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* FOOTER STRIP */}
      <div className="p-3 border-t border-border-default bg-bg-subtle flex items-center justify-between text-xs">
        <span className="text-text-subtle font-medium">Sincronização em tempo real</span>
        <button
          onClick={handleMarkAllAsRead}
          className="text-[#3B82F6] hover:underline font-semibold"
        >
          Limpar Alertas
        </button>
      </div>
    </div>
  );
};

