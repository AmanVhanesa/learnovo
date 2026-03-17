import React from 'react'

const STATUS_STYLES = {
  Paid: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  Active: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  Approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  Partial: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800',
  Pending: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800',
  Overdue: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
  Rejected: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
  Inactive: 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-gray-800/30 dark:text-[#8E8E93] dark:ring-gray-700',
  RAISED: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
  RESOLVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
}

const StatusBadge = ({ status, className = '' }) => {
  const style = STATUS_STYLES[status] || 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-gray-800/30 dark:text-[#8E8E93] dark:ring-gray-700'
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${style} ${className}`}>
      {status}
    </span>
  )
}

export default StatusBadge
