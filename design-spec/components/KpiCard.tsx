import React from 'react';

export type KpiTrend = 'up' | 'down' | 'flat';

export interface KpiCardProps {
  title: string;
  value: string | number;
  delta?: string;
  trend?: KpiTrend;
  ariaDescription?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  delta,
  trend = 'flat',
  ariaDescription,
  onPrimaryAction,
  onSecondaryAction,
  primaryLabel = 'View details',
  secondaryLabel = 'Export'
}) => {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-slate-500';
  const trendSymbol = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■';

  return (
    <section
      className="rounded-lg bg-white shadow-card p-4 focus-within:ring-2 focus-within:ring-brand"
      role="group"
      aria-label={title}
      aria-description={ariaDescription}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-600">{title}</h3>
        {delta && (
          <span className={`text-xs ${trendColor}`} aria-label={`Change ${delta}`}>
            {trendSymbol} {delta}
          </span>
        )}
      </div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      <div className="mt-3 flex items-center gap-2">
        {onPrimaryAction && (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="inline-flex items-center rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {primaryLabel}
          </button>
        )}
        {onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </section>
  );
};

export default KpiCard;


