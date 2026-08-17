import React from 'react';
import { PlanoPaxCompleto } from '../../types/planosPax';
import { useSeletorPlanoPax } from '../../hooks/useSeletorPlanoPax';
import { Check, X, Info, CalendarClock, ShieldAlert, ArrowRightLeft, Users } from 'lucide-react';

interface Props {
  plano: PlanoPaxCompleto;
  nVidas?: number;
  idadesDependentes?: number[];
  onTrocarPlano?: () => void;
}

export const PlanoPaxSummaryCard: React.FC<Props> = ({ plano, nVidas, idadesDependentes, onTrocarPlano }) => {
  const { calcularValorContrato } = useSeletorPlanoPax();
  
  // Use local calculate if hook is not ready with context, but we need the function
  const simulacao = calcularValorContrato(nVidas, idadesDependentes) || {
    base: plano.valor_mensalidade,
    por_vida: plano.valor_mensalidade,
    total: plano.valor_mensalidade,
    descricao: ''
  };

  const cobertos = plano.coberturas.filter(c => c.tipo_cobertura === 'coberto').slice(0, 5);
  const excluidos = plano.coberturas.filter(c => c.tipo_cobertura === 'excluido').slice(0, 3);
  const outOfRange = false; // Age restrictions are now life-count based

  return (
    <div className="bg-bg-subtle border border-border-default rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-6 border-b border-border-default gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-text-base">{plano.nome}</h3>
            <span className="px-2.5 py-1 bg-[#3B82F6]/10 text-[#3B82F6] text-xs font-medium rounded-lg uppercase tracking-wider">
              {plano.codigo}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-text-subtle">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              {plano.tipo_plano === 'individual' ? 'Individual' : `Coletivo (Até ${plano.limite_vidas} vidas)`}
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              Carência: {plano.carencia_geral_dias} dias
            </span>
            {plano.km_translado_coberto !== null && (
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4" />
                Translado: {plano.km_translado_coberto === 0 ? 'Local' : `${plano.km_translado_coberto} km`}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-xs text-text-subtle mb-1">{simulacao.descricao || 'Mensalidade'}</p>
            <div className="text-2xl font-bold text-emerald-500">
              {Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(simulacao.total)}
            </div>
            {plano.taxa_adesao > 0 && (
              <p className="text-xs text-text-subtle mt-1">
                + {Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plano.taxa_adesao)} adesão
              </p>
            )}
          </div>
          {onTrocarPlano && (
            <button
              type="button"
              onClick={onTrocarPlano}
              className="px-4 py-2 bg-slate-100 dark:bg-bg-hover text-text-muted rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-[#64748B] transition-colors"
            >
              Trocar
            </button>
          )}
        </div>
      </div>

      

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            Principais Coberturas
          </h4>
          <ul className="space-y-2">
            {cobertos.map(cob => (
              <li key={cob.id} className="text-sm text-text-muted flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>
                  {cob.item?.nome}
                  {cob.observacao && <span className="text-xs block text-text-subtle opacity-80">{cob.observacao}</span>}
                </span>
              </li>
            ))}
            {plano.coberturas.filter(c => c.tipo_cobertura === 'coberto').length > 5 && (
              <li className="text-sm text-[#3B82F6] italic pl-3.5">
                + {plano.coberturas.filter(c => c.tipo_cobertura === 'coberto').length - 5} itens cobertos...
              </li>
            )}
            {cobertos.length === 0 && <li className="text-sm text-text-subtle italic">Nenhum item coberto cadastrado.</li>}
          </ul>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
            <X className="w-4 h-4 text-red-500" />
            Não Cobertos
          </h4>
          <ul className="space-y-2">
            {excluidos.map(exc => (
              <li key={exc.id} className="text-sm text-text-muted flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                <span>
                  {exc.item?.nome}
                  {exc.observacao && <span className="text-xs block text-text-subtle opacity-80">{exc.observacao}</span>}
                </span>
              </li>
            ))}
            {excluidos.length === 0 && <li className="text-sm text-text-subtle italic">Nenhum item excluído cadastrado.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};
