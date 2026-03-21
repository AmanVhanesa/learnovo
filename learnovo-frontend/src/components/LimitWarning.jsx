import React from 'react'
import { usePlan } from '../hooks/usePlan'

/**
 * Shows a warning banner when usage is at 80%+ of a plan limit.
 * Shows a red alert when the limit is fully reached.
 *
 * Usage:
 *   <LimitWarning limitName="students" label="student" />
 */
export const LimitWarning = ({ limitName, label }) => {
  const { getUsagePercentage, subscription } = usePlan()
  const percentage = getUsagePercentage(limitName)
  const limit = subscription?.limits?.[limitName]

  if (!limit || limit.max === -1 || percentage < 80) return null

  const isAtMax = limit.current >= limit.max

  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm mb-4 ${
      isAtMax
        ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
        : 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
    }`}>
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <span>
        {isAtMax
          ? `You've reached the ${label} limit (${limit.current}/${limit.max}).`
          : `You're at ${Math.round(percentage)}% of your ${label} limit (${limit.current}/${limit.max}).`
        }
        {' '}
        <a href="/pricing" className="underline font-medium hover:opacity-80">Upgrade your plan</a>
      </span>
    </div>
  )
}

export default LimitWarning
