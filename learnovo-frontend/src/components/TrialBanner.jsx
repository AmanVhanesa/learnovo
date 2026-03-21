import React from 'react'
import { usePlan } from '../hooks/usePlan'

/**
 * Shows a trial expiry banner at the top of the page.
 * - Red when expired
 * - Orange when 3 or fewer days remain
 * - Yellow when 7 or fewer days remain
 * - Hidden otherwise
 */
export const TrialBanner = () => {
  const { trialDaysRemaining, plan, loading } = usePlan()

  if (loading || plan !== 'free' || trialDaysRemaining === null) return null

  if (trialDaysRemaining <= 0) {
    return (
      <div className="bg-red-600 text-white px-4 py-2.5 text-center text-sm flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span>
          Your free trial has expired.
          <a href="/pricing" className="underline ml-1 font-bold hover:opacity-90">
            Upgrade now to continue using Learnovo
          </a>
        </span>
      </div>
    )
  }

  if (trialDaysRemaining <= 3) {
    return (
      <div className="bg-orange-500 text-white px-4 py-2.5 text-center text-sm flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Your free trial expires in {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''}.
          <a href="/pricing" className="underline ml-1 font-bold hover:opacity-90">
            Upgrade now
          </a>
        </span>
      </div>
    )
  }

  if (trialDaysRemaining <= 7) {
    return (
      <div className="bg-yellow-500 text-white px-4 py-2.5 text-center text-sm flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>
          {trialDaysRemaining} days left in your free trial.
          <a href="/pricing" className="underline ml-1 font-bold hover:opacity-90">
            View plans
          </a>
        </span>
      </div>
    )
  }

  return null
}

export default TrialBanner
