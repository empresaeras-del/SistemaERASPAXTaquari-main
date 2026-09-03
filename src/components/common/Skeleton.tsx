import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-bg-subtle ${className}`} />
);

type SkeletonWidgetVariant = 'kpi-lg' | 'kpi' | 'progress' | 'chart' | 'list';

interface SkeletonWidgetProps {
  variant: SkeletonWidgetVariant;
  className?: string;
}

/** Placeholder com o mesmo formato/proporção de um widget real do Dashboard, para o grid não "pular" quando os dados chegam. */
export const SkeletonWidget: React.FC<SkeletonWidgetProps> = ({ variant, className = '' }) => {
  return (
    <div className={`bg-bg-surface rounded-2xl border border-border-default p-5 flex flex-col ${className}`}>
      <Skeleton className="w-10 h-10 rounded-xl" />
      {variant === 'kpi-lg' && (
        <>
          <Skeleton className="w-24 h-3 mt-5" />
          <Skeleton className="w-32 h-10 mt-3" />
          <Skeleton className="w-full h-14 mt-4 rounded-xl" />
        </>
      )}
      {variant === 'kpi' && (
        <>
          <Skeleton className="w-20 h-3 mt-5" />
          <Skeleton className="w-16 h-7 mt-2" />
        </>
      )}
      {variant === 'progress' && (
        <>
          <Skeleton className="w-28 h-3 mt-5" />
          <div className="flex gap-4 mt-4">
            <Skeleton className="w-20 h-6" />
            <Skeleton className="w-20 h-6" />
          </div>
          <Skeleton className="w-full h-2 mt-5 rounded-full" />
        </>
      )}
      {variant === 'chart' && (
        <>
          <Skeleton className="w-32 h-3 mt-5" />
          <div className="animate-pulse rounded-xl bg-bg-subtle flex-1 w-full mt-4" style={{ minHeight: 180 }} />
        </>
      )}
      {variant === 'list' && (
        <>
          <Skeleton className="w-28 h-3 mt-5" />
          <div className="flex flex-col gap-2.5 mt-4">
            <Skeleton className="w-full h-9 rounded-xl" />
            <Skeleton className="w-full h-9 rounded-xl" />
            <Skeleton className="w-full h-9 rounded-xl" />
          </div>
        </>
      )}
    </div>
  );
};
