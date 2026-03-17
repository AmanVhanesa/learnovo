import React from 'react'
import { cn } from '../utils/cn'
import { TrendingUp, TrendingDown } from 'lucide-react'
import Button from './Button'

const SummaryCard = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
  trendValue,
  className = '',
  onViewDetails,
  onExport,
  loading = false
}) => {
  return (
    <div className={cn('stat-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2.5 bg-primary-50 dark:bg-primary-500/10 rounded-xl ring-1 ring-primary-100 dark:ring-primary-500/20">
              <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-[#8E8E93]">{title}</h3>
            {description && (
              <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {trend && (
          <div className={cn(
            'inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg',
            trend === 'up'
              ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10'
              : trend === 'down'
                ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10'
                : 'text-gray-500 bg-gray-50 dark:text-[#8E8E93] dark:bg-gray-500/10'
          )}>
            {trend === 'up' && <TrendingUp className="h-3 w-3" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3" />}
            {trendValue}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mb-4">
        {loading ? (
          <div className="h-9 w-24 skeleton" />
        ) : (
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight break-words">{value}</div>
        )}
      </div>

      {/* Actions */}
      {(onViewDetails || onExport) && (
        <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-[#2C2C2E]">
          {onViewDetails && (
            <Button variant="primary" size="sm" onClick={onViewDetails} className="flex-1">
              View Details
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} className="flex-1">
              Export
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default SummaryCard
