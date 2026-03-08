import React from 'react'
import { cn } from '../utils/cn'
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
    <div className={cn(
      'bg-white rounded-lg shadow-sm border border-gray-200 p-6',
      className
    )}>
      {/* Header with Icon and Title */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {Icon && (
            <div className="p-2 bg-primary-50 rounded-lg">
              <Icon className="h-6 w-6 text-primary-600" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-600">{title}</h3>
            {description && (
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            )}
          </div>
        </div>
        {trend && (
          <div className={cn(
            'flex items-center text-sm font-medium',
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
          )}>
            {trend === 'up' && (
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
              </svg>
            )}
            {trend === 'down' && (
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10h10" />
              </svg>
            )}
            {trendValue}
          </div>
        )}
      </div>

      {/* Main Value */}
      <div className="mb-4">
        {loading ? (
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        ) : (
          <div className="text-3xl font-bold text-gray-900">{value}</div>
        )}
      </div>

      {/* Action Buttons */}
      {(onViewDetails || onExport) && (
        <div className="flex space-x-2">
          {onViewDetails && (
            <Button
              variant="primary"
              size="sm"
              onClick={onViewDetails}
              className="flex-1"
            >
              View Details
            </Button>
          )}
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="flex-1"
            >
              Export
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default SummaryCard
