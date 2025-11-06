import React from 'react'

const KpiCard = ({ title, value, Icon, delta, trend = 'flat', primaryLabel, onPrimary, secondaryLabel, onSecondary }) => {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
  const trendSymbol = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■'

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 focus-within:ring-2 focus-within:ring-primary-500">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-3 rounded-lg bg-gray-100">
              <Icon className="h-6 w-6 text-gray-600" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-600">{title}</h3>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
          </div>
        </div>
        {delta && (
          <span className={`text-xs ${trendColor}`} aria-label={`Change ${delta}`}>
            {trendSymbol} {delta}
          </span>
        )}
      </div>
      {(onPrimary || onSecondary) && (
        <div className="mt-3 flex items-center gap-2">
          {onPrimary && (
            <button type="button" onClick={onPrimary} className="btn btn-sm btn-primary">{primaryLabel || 'View details'}</button>
          )}
          {onSecondary && (
            <button type="button" onClick={onSecondary} className="btn btn-sm btn-outline">{secondaryLabel || 'Export'}</button>
          )}
        </div>
      )}
    </section>
  )
}

export default KpiCard


