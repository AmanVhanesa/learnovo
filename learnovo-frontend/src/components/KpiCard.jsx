import React from 'react'

const KpiCard = ({ title, value, Icon, delta, trend = 'flat', primaryLabel, onPrimary, secondaryLabel, onSecondary }) => {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
  const trendSymbol = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■'

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 focus-within:ring-2 focus-within:ring-primary-500">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {Icon && (
            <div className="p-2 sm:p-3 rounded-lg bg-gray-100 flex-shrink-0">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-xs sm:text-sm font-medium text-gray-600 truncate">{title}</h3>
            <div className="mt-1 text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 break-words">{value}</div>
          </div>
        </div>
        {delta && (
          <span className={`text-xs ${trendColor} flex-shrink-0`} aria-label={`Change ${delta}`}>
            {trendSymbol} {delta}
          </span>
        )}
      </div>
      {(onPrimary || onSecondary) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
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


