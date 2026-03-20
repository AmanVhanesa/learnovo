import React from 'react'
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react'

const TREND_CONFIG = {
  up: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', Icon: TrendingUp },
  down: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', Icon: TrendingDown },
  flat: { color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-500/10', Icon: null },
}

const KpiCard = ({ title, value, Icon, delta, trend = 'flat', primaryLabel, onPrimary, secondaryLabel, onSecondary, isRefetching, glass }) => {
  const tc = TREND_CONFIG[trend] || TREND_CONFIG.flat

  return (
    <section className={`${glass ? 'stat-card-glass' : 'stat-card'} group relative`}>
      {isRefetching && (
        <div className="absolute top-2.5 right-2.5 z-10">
          <Loader2 className="h-3.5 w-3.5 text-primary-500 dark:text-[#3EC4B1] animate-spin" />
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {Icon && (
            <div className="p-2.5 rounded-xl bg-primary-50 dark:bg-[rgba(62,196,177,0.12)] ring-1 ring-primary-100 dark:ring-[rgba(62,196,177,0.2)] flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
              <Icon className="h-5 w-5 text-primary-600 dark:text-[#3EC4B1]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">{title}</h3>
            <div className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white tracking-tight break-words">{value}</div>
          </div>
        </div>
        {delta && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${tc.color} ${tc.bg} flex-shrink-0`}>
            {tc.Icon && <tc.Icon className="h-3 w-3" />}
            {delta}
          </span>
        )}
      </div>
      {(onPrimary || onSecondary) && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#2C2C2E] flex flex-wrap items-center gap-2">
          {onPrimary && (
            <button type="button" onClick={onPrimary} className="btn btn-sm btn-primary text-xs flex-1 sm:flex-none min-w-[100px]">{primaryLabel || 'View details'}</button>
          )}
          {onSecondary && (
            <button type="button" onClick={onSecondary} className="btn btn-sm btn-outline text-xs flex-1 sm:flex-none min-w-[80px]">{secondaryLabel || 'Export'}</button>
          )}
        </div>
      )}
    </section>
  )
}

export default KpiCard
