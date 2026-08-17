import React, { useEffect, useState } from 'react';
import { useSeletorPlanoPax } from '../../hooks/useSeletorPlanoPax';
import { TipoPlano } from '../../types/planosPax';
import { PlanoPaxSummaryCard } from './PlanoPaxSummaryCard';

interface Props {
  value: string | null;
  onChange: (id: string) => void;
  tipoFiltro?: TipoPlano | null;
  nVidas?: number;
  idadesDependentes?: number[];
  label?: string;
  error?: string;
}

export const PlanoPaxSelect: React.FC<Props> = ({ 
  value, 
  onChange, 
  tipoFiltro,
  nVidas,
  idadesDependentes,
  label = "Plano PAX",
  error
}) => {
  const { planosDisponiveis, planoSelecionado, selecionarPlano, loading } = useSeletorPlanoPax();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (planosDisponiveis.length > 0) {
      setIsReady(true);
      if (value) {
        selecionarPlano(value);
      } else {
        selecionarPlano('');
      }
    }
  }, [planosDisponiveis, value, selecionarPlano]);

  const planosFiltrados = planosDisponiveis.filter(p => !tipoFiltro || p.tipo_plano === tipoFiltro);

  if (!isReady || loading && !planoSelecionado) {
    return <div className="animate-pulse h-12 bg-bg-subtle rounded-xl border border-border-default"></div>;
  }

  if (planoSelecionado && value === planoSelecionado.id) {
    return (
      <div className="space-y-4">
        <label className="block text-sm font-medium text-text-muted">{label}</label>
        <PlanoPaxSummaryCard 
          plano={planoSelecionado} 
          nVidas={nVidas} 
          idadesDependentes={idadesDependentes}
          onTrocarPlano={() => onChange('')} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-text-muted">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-bg-subtle border ${error ? 'border-red-500' : 'border-border-default'} rounded-xl px-4 py-3 text-text-base focus:outline-none focus:border-[#3B82F6] appearance-none`}
      >
        <option value="">Selecione um plano...</option>
        {planosFiltrados.map(plano => (
          <option key={plano.id} value={plano.id}>
            {plano.codigo} - {plano.nome} ({Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plano.valor_mensalidade)})
          </option>
        ))}
      </select>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
};
