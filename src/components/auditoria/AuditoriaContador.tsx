import React from 'react';
import { User } from 'lucide-react';
import type { UsuarioCadastro } from '../../services/usuariosService';

interface Props {
  exibidos: number;
  total: number;
  usuarioFiltro: string;
  usuariosList: UsuarioCadastro[];
  hasActiveFilters: boolean;
}

/** A barra "mostrando X de Y". Ela é o que denuncia um filtro esquecido. */
export const AuditoriaContador: React.FC<Props> = ({
  exibidos,
  total,
  usuarioFiltro,
  usuariosList,
  hasActiveFilters,
}) => (
  <div className="px-5 py-2.5 bg-bg-surface/50 border-b border-border-default flex items-center justify-between text-xs text-text-subtle">
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-semibold text-text-base">
        Exibindo {exibidos} de {total} ocorrências
      </span>
      {usuarioFiltro !== 'todos' && (
        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-semibold flex items-center gap-1">
          <User className="w-3 h-3" />
          Operador: {usuariosList.find(u => u.id === usuarioFiltro)?.nome || (usuarioFiltro === 'sistema' ? 'Sistema' : usuarioFiltro)}
        </span>
      )}
      {hasActiveFilters && usuarioFiltro === 'todos' && (
        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-medium">
          Filtros ativos
        </span>
      )}
    </div>
    <span className="text-[11px] text-text-subtle hidden sm:inline">
      Ordenado cronologicamente (mais recentes primeiro)
    </span>
  </div>
);
