import React from 'react'
import { usePlan } from '../hooks/usePlan'

const FEATURE_PLAN_MAP = {
  basicReports: 'Basic',
  grades: 'Basic',
  exams: 'Basic',
  feesFinance: 'Basic',
  feeReceipts: 'Basic',
  csvImport: 'Basic',
  parentPortal: 'Basic',
  paymentGateway: 'Pro',
  advancedAnalytics: 'Pro',
  customReports: 'Pro',
  smsWhatsappAlerts: 'Pro',
  apiAccess: 'Pro',
  customIntegrations: 'Enterprise',
  whiteLabel: 'Enterprise',
  onPremise: 'Enterprise',
}

/**
 * Wraps content that requires a specific plan feature.
 * If the feature is not available, shows an upgrade prompt (or custom fallback).
 *
 * Usage:
 *   <PlanGate feature="feesFinance">
 *     <FeesPage />
 *   </PlanGate>
 */
export const PlanGate = ({ feature, children, fallback }) => {
  const { hasFeature, loading } = usePlan()

  if (loading) return null

  if (hasFeature(feature)) {
    return children
  }

  if (fallback) return fallback

  const requiredPlan = FEATURE_PLAN_MAP[feature] || 'Pro'

  return (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 dark:bg-gray-900 dark:border-gray-700 min-h-[300px]">
      <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
        {requiredPlan} Plan Required
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 max-w-md">
        This feature is not available on your current plan.
        Upgrade to {requiredPlan} to unlock it.
      </p>
      <a
        href="/pricing"
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Upgrade to {requiredPlan}
      </a>
    </div>
  )
}

export default PlanGate
