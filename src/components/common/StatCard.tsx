import React from 'react';

export type StatCardTone = 'blue' | 'rose' | 'emerald' | 'violet';

const TONE_STYLES: Record<StatCardTone, { chip: string; chipShadow: string; orb: string; hoverBorder: string; hoverShadow: string }> = {
  blue: {
    chip: 'from-[#3B82F6] to-[#60A5FA]',
    chipShadow: 'shadow-blue-500/30',
    orb: 'from-[#3B82F6] to-[#60A5FA]',
    hoverBorder: 'hover:border-blue-500/30',
    hoverShadow: 'hover:shadow-blue-500/10',
  },
  rose: {
    chip: 'from-[#F43F5E] to-[#F97316]',
    chipShadow: 'shadow-rose-500/30',
    orb: 'from-[#F43F5E] to-[#F97316]',
    hoverBorder: 'hover:border-rose-500/30',
    hoverShadow: 'hover:shadow-rose-500/10',
  },
  emerald: {
    chip: 'from-[#10B981] to-[#3B82F6]',
    chipShadow: 'shadow-emerald-500/30',
    orb: 'from-[#10B981] to-[#3B82F6]',
    hoverBorder: 'hover:border-emerald-500/30',
    hoverShadow: 'hover:shadow-emerald-500/10',
  },
  violet: {
    chip: 'from-[#8B5CF6] to-[#D946EF]',
    chipShadow: 'shadow-purple-500/30',
    orb: 'from-[#8B5CF6] to-[#D946EF]',
    hoverBorder: 'hover:border-purple-500/30',
    hoverShadow: 'hover:shadow-purple-500/10',
  },
};

interface StatCardProps {
  icon: React.ReactNode;
  tone: StatCardTone;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: React.ReactNode;
  size?: 'md' | 'lg';
  extra?: React.ReactNode;
  className?: string;
}

/** Card de KPI reutilizável — chip de ícone com gradiente, número grande (mono/tabular), orb decorativo e glow de hover. */
export const StatCard: React.FC<StatCardProps> = ({
  icon,
  tone,
  label,
  value,
  sub,
  delta,
  size = 'md',
  extra,
  className = '',
}) => {
  const t = TONE_STYLES[tone];

  return (
    <div
      className={`relative bg-bg-surface rounded-2xl border border-border-default p-5 flex flex-col justify-between overflow-hidden group shadow-sm hover:shadow-lg ${t.hoverShadow} ${t.hoverBorder} transition-all duration-300 ${className}`}
    >
      <div
        className={`absolute -right-6 -top-6 ${size === 'lg' ? 'w-40 h-40' : 'w-28 h-28'} opacity-10 blur-2xl rounded-full bg-gradient-to-tr ${t.orb} group-hover:opacity-25 transition-opacity duration-500`}
      />
      <div className="flex items-start justify-between relative z-10">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${t.chip} text-white shadow-lg ${t.chipShadow}`}>
          {icon}
        </div>
        {delta}
      </div>
      <div className="relative z-10 mt-5">
        <h3
          className={`font-mono font-extrabold text-text-base tracking-tight tabular-nums ${
            size === 'lg' ? 'text-4xl' : 'text-3xl'
          }`}
        >
          {value}
        </h3>
        <p className="text-sm font-semibold text-text-subtle mt-1.5">{label}</p>
        {sub && <p className="text-[11px] font-medium text-text-muted mt-0.5 opacity-75">{sub}</p>}
      </div>
      {extra && <div className="relative z-10 mt-4">{extra}</div>}
    </div>
  );
};
