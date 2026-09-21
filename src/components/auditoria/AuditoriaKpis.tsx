import React from 'react';
import { FileText, Clock, Calendar, Users } from 'lucide-react';
import type { EstatisticasAuditoria } from '../../utils/auditoriaHelpers';

/**
 * Os quatro cartões do topo.
 *
 * `Operadores no Período` não é enfeite: quando o total despenca junto com esse número, o
 * CLAUDE.md manda **suspeitar do cache antes de suspeitar da permissão** — um cache local só
 * tem as ações daquele navegador.
 */
export const AuditoriaKpis: React.FC<EstatisticasAuditoria> = ({
  totalLogs,
  logsHoje,
  logsUltimos7Dias,
  usuariosUnicos,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
    <div className="bg-bg-subtle rounded-3xl shadow-sm border border-border-default p-5 flex flex-col justify-between hover:border-blue-500/50 transition-all relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 w-28 h-28 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 group-hover:opacity-40 transition-opacity" />
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
          <FileText className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
          Histórico
        </span>
      </div>
      <div className="relative z-10">
        <h3 className="text-3xl font-bold text-text-base tracking-tight">{totalLogs}</h3>
        <p className="text-xs font-medium text-text-subtle mt-1">Total de Registros Gravados</p>
      </div>
    </div>

    <div className="bg-bg-subtle rounded-3xl shadow-sm border border-border-default p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-all relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 w-28 h-28 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 group-hover:opacity-40 transition-opacity" />
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md">
          <Clock className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          Hoje
        </span>
      </div>
      <div className="relative z-10">
        <h3 className="text-3xl font-bold text-text-base tracking-tight">{logsHoje}</h3>
        <p className="text-xs font-medium text-text-subtle mt-1">Ações Realizadas Hoje</p>
      </div>
    </div>

    <div className="bg-bg-subtle rounded-3xl shadow-sm border border-border-default p-5 flex flex-col justify-between hover:border-amber-500/50 transition-all relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 w-28 h-28 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 group-hover:opacity-40 transition-opacity" />
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md">
          <Calendar className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
          7 Dias
        </span>
      </div>
      <div className="relative z-10">
        <h3 className="text-3xl font-bold text-text-base tracking-tight">{logsUltimos7Dias}</h3>
        <p className="text-xs font-medium text-text-subtle mt-1">Atividade nos Últimos 7 Dias</p>
      </div>
    </div>

    <div className="bg-bg-subtle rounded-3xl shadow-sm border border-border-default p-5 flex flex-col justify-between hover:border-purple-500/50 transition-all relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 w-28 h-28 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 group-hover:opacity-40 transition-opacity" />
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-md">
          <Users className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
          Equipe
        </span>
      </div>
      <div className="relative z-10">
        <h3 className="text-3xl font-bold text-text-base tracking-tight">{usuariosUnicos}</h3>
        <p className="text-xs font-medium text-text-subtle mt-1">Operadores no Período</p>
      </div>
    </div>
  </div>
);
