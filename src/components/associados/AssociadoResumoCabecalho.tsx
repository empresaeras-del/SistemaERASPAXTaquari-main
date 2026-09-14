import React from 'react';
import { BadgeCheck, CalendarDays, CreditCard, Lock, RotateCcw, User } from 'lucide-react';
import { ResumoAssociado } from '../../utils/resumoAssociado';

interface Props {
  resumo: ResumoAssociado;
  /** Aviso exibido quando o cadastro está fora de circulação. */
  mensagemInativo: string;
  /**
   * Abre a reativação a partir do próprio aviso.
   *
   * O aviso diz "reative o cadastro para registrar novas operações" — sem o botão ao lado,
   * ele manda o operador procurar onde, e o caminho mais curto que ele encontra é fechar o
   * formulário e voltar para a lista. Opcional porque nem todo chamador tem como reativar.
   */
  onReativar?: () => void;
}

const Campo: React.FC<{ icone: React.ReactNode; rotulo: string; valor: string }> = ({
  icone,
  rotulo,
  valor,
}) => (
  <div className="flex items-center gap-1.5 min-w-0">
    <span className="text-text-subtle shrink-0">{icone}</span>
    <span className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle shrink-0">
      {rotulo}
    </span>
    <span className="text-sm font-medium text-text-base truncate">{valor}</span>
  </div>
);

/**
 * Identidade do associado, visível em todas as abas do formulário.
 *
 * O formulário tem oito abas; três cliques adiante, nada na tela dizia **de quem** era o
 * cadastro aberto. Cada campo só aparece quando tem valor: um cabeçalho com "CPF: —" e
 * "Plano: —" ocupa o mesmo espaço sem informar nada, e num cadastro novo seria quase tudo
 * o que se veria.
 */
export const AssociadoResumoCabecalho: React.FC<Props> = ({
  resumo,
  mensagemInativo,
  onReativar,
}) => {
  if (!resumo.nome) return null;

  return (
    <div className="px-6 py-3 border-b border-border-default bg-bg-surface/30 shrink-0">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
              resumo.inativo
                ? 'bg-text-subtle/10 text-text-subtle'
                : 'bg-[#3B82F6]/10 text-[#3B82F6]'
            }`}
          >
            <User className="w-4 h-4" />
          </span>
          <span className="text-base font-bold text-text-base truncate">{resumo.nome}</span>
          {resumo.status && (
            <span
              className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                resumo.inativo
                  ? 'bg-text-subtle/10 text-text-subtle border-text-subtle/30'
                  : resumo.status === 'inadimplente'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {resumo.status}
            </span>
          )}
        </div>

        {resumo.idade !== null && (
          <Campo
            icone={<CalendarDays className="w-3.5 h-3.5" />}
            rotulo="Idade"
            valor={`${resumo.idade} anos`}
          />
        )}
        {resumo.documento && (
          <Campo
            icone={<CreditCard className="w-3.5 h-3.5" />}
            rotulo="CPF"
            valor={resumo.documento}
          />
        )}
        {resumo.plano && (
          <Campo
            icone={<BadgeCheck className="w-3.5 h-3.5" />}
            rotulo="Plano"
            valor={resumo.plano}
          />
        )}
      </div>

      {resumo.inativo && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] leading-snug text-amber-300">
          <Lock className="w-4 h-4 shrink-0" />
          <span className="min-w-0 flex-1">{mensagemInativo}</span>
          {onReativar && (
            <button
              type="button"
              onClick={onReativar}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reativar
            </button>
          )}
        </div>
      )}
    </div>
  );
};
