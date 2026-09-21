import React from 'react';
import { Search, Building2, User, ShieldAlert, Calendar, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getActionConfig, getUserRoleBadge } from '../../utils/auditoriaHelpers';
import type { LogAuditoria } from '../../services/auditoriaService';
import type { Empresa } from '../../services/empresasService';
import { LogDetailsViewer } from './LogDetalhesViewer';

interface Props {
  loading: boolean;
  logs: LogAuditoria[];
  empresas: Empresa[];
  empresaSelecionada: string | null;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  onFiltrarPorOperador: (usuarioId: string) => void;
}

/**
 * A lista em linha do tempo, com os três estados: carregando, vazio e os cartões.
 *
 * O nome da empresa só aparece quando o seletor do topo está em `'all'` — é a única
 * situação em que a lista mistura empresas, e identificá-la ali é o que evita ler um log
 * de outra empresa como se fosse desta.
 */
export const AuditoriaLinhaDoTempo: React.FC<Props> = ({
  loading,
  logs: filteredLogs,
  empresas,
  empresaSelecionada,
  hasActiveFilters,
  clearAllFilters,
  onFiltrarPorOperador,
}) => (
  <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
    {loading ? (
      <div className="text-center py-16 text-text-subtle flex flex-col items-center justify-center space-y-3">
        <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-500 animate-pulse">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <p className="font-medium text-sm text-text-base">Carregando logs de auditoria...</p>
        <p className="text-xs text-text-subtle">Consultando registros e histórico de operações.</p>
      </div>
    ) : filteredLogs.length === 0 ? (
      <div className="text-center py-16 text-text-subtle flex flex-col items-center justify-center space-y-3">
        <div className="p-4 rounded-2xl bg-bg-surface border border-border-default text-text-subtle">
          <Search className="w-8 h-8 opacity-40" />
        </div>
        <p className="font-semibold text-text-base">Nenhum registro encontrado</p>
        <p className="text-xs text-text-subtle max-w-sm">
          Não encontramos ocorrências para os filtros informados. Tente ajustar os termos de busca, o operador ou o período selecionado.
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="mt-2 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            Limpar todos os filtros
          </button>
        )}
      </div>
    ) : (
      <div className="relative border-l-2 border-border-default/80 ml-4 sm:ml-6 space-y-6 pb-6">
        {filteredLogs.map((log) => {
          const config = getActionConfig(log.acao);
          const IconComponent = config.icon;
          const dateObj = new Date(log.created_at);
          const timeAgo = formatDistanceToNow(dateObj, { addSuffix: true, locale: ptBR });
          const roleBadge = getUserRoleBadge(log.usuarios?.nivel);
          const empName = empresas.find(e => e.id === log.tenant_id)?.nome_fantasia;

          return (
            <div key={log.id} className="relative pl-6 sm:pl-8 group">
              {/* Timeline Node Dot */}
              <div 
                className={`absolute -left-[11px] top-4 w-5 h-5 rounded-full bg-bg-surface border-2 ${config.dotColor} ring-4 transition-all group-hover:scale-110 flex items-center justify-center`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-current" />
              </div>

              {/* Card */}
              <div className="bg-bg-surface border border-border-default rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-border-subtle transition-all">
                {/* Top Row: Action Title, Badges, Time */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${config.iconBg} ${config.iconColor} shrink-0`}>
                      <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-text-base text-sm sm:text-base tracking-tight">
                          {log.acao}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}>
                          {config.badgeLabel}
                        </span>
                      </div>
                      <span className="text-[11px] text-text-subtle font-medium">
                        Módulo: {config.categoryLabel}
                      </span>
                    </div>
                  </div>

                  {/* Date & Time Badge */}
                  <div className="flex items-center gap-3 text-xs font-medium text-text-subtle bg-bg-subtle/80 px-3 py-1.5 rounded-xl w-fit border border-border-default/60 shrink-0">
                    <span className="flex items-center gap-1.5" title={format(dateObj, "dd/MM/yyyy HH:mm:ss")}>
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      {format(dateObj, "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border-default" />
                    <span className="flex items-center gap-1.5 font-mono">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      {format(dateObj, "HH:mm:ss")}
                    </span>
                    <span className="hidden md:inline text-[11px] text-text-subtle italic">
                      ({timeAgo})
                    </span>
                  </div>
                </div>

                {/* User Info Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-text-muted bg-bg-subtle/50 p-2.5 sm:p-3 rounded-xl border border-border-default/70 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                      {log.usuarios?.nome ? log.usuarios.nome.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onFiltrarPorOperador(log.usuario_id || log.usuarios?.email || 'todos')}
                          className="font-semibold text-text-base hover:text-blue-500 transition-colors text-left flex items-center gap-1.5 group/user"
                          title="Clique para filtrar apenas as ações deste operador"
                        >
                          <span>{log.usuarios?.nome || log.usuario_nome || 'Operador / Sistema'}</span>
                          <span className="text-[10px] text-blue-500 opacity-0 group-hover/user:opacity-100 transition-opacity font-normal underline">
                            (filtrar)
                          </span>
                        </button>
                        <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleBadge.bg}`}>
                          {roleBadge.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-subtle">
                        {log.usuarios?.email || 'Ação registrada no sistema'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {empresaSelecionada === 'all' && empName && (
                      <span className="text-[10px] font-medium text-text-subtle bg-bg-surface px-2 py-0.5 rounded border border-border-default flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-blue-500" />
                        {empName}
                      </span>
                    )}
                    <div className="text-[11px] text-text-subtle font-mono px-2 py-0.5 rounded bg-bg-surface border border-border-default/60">
                      ID: {log.id.slice(0, 8)}
                    </div>
                  </div>
                </div>

                {/* Details Box */}
                {log.detalhes && (
                  <LogDetailsViewer detalhes={log.detalhes} acao={log.acao} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
