import React from 'react'

export const CardSkeleton = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
          <div>
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const ChartSkeleton = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
      <div className="h-64 bg-gray-100 rounded"></div>
    </div>
  )
}

export const TableSkeleton = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
      <div className="p-4 border-b border-gray-200">
        <div className="h-6 bg-gray-200 rounded w-32"></div>
      </div>
      <div className="divide-y divide-gray-200">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default { CardSkeleton, ChartSkeleton, TableSkeleton }

