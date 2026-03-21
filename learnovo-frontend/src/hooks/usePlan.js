import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/authService'

/**
 * Hook to access the current tenant's subscription plan, limits, and features.
 * Fetches from GET /api/subscription/status and caches for 5 minutes.
 */
let cachedData = null
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const usePlan = () => {
  const { isAuthenticated } = useAuth()
  const [subscription, setSubscription] = useState(cachedData)
  const [loading, setLoading] = useState(!cachedData)

  const fetchStatus = useCallback(async () => {
    try {
      const now = Date.now()
      if (cachedData && now - cacheTimestamp < CACHE_TTL) {
        setSubscription(cachedData)
        setLoading(false)
        return
      }

      const res = await api.get('/subscription/status')
      if (res.data?.success) {
        cachedData = res.data.data
        cacheTimestamp = Date.now()
        setSubscription(cachedData)
      }
    } catch (err) {
      // If fetching fails (e.g. no subscription endpoint), default to free
      console.warn('Failed to fetch subscription status:', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus()
    }
  }, [isAuthenticated, fetchStatus])

  const hasFeature = useCallback((featureName) => {
    return subscription?.features?.[featureName] === true
  }, [subscription])

  const isAtLimit = useCallback((limitName) => {
    const limit = subscription?.limits?.[limitName]
    if (!limit || limit.max === -1) return false // -1 = unlimited
    return limit.current >= limit.max
  }, [subscription])

  const getUsagePercentage = useCallback((limitName) => {
    const limit = subscription?.limits?.[limitName]
    if (!limit || limit.max === -1) return 0
    return limit.percentage || 0
  }, [subscription])

  const invalidateCache = useCallback(() => {
    cachedData = null
    cacheTimestamp = 0
    fetchStatus()
  }, [fetchStatus])

  return {
    subscription,
    loading,
    plan: subscription?.plan || 'free',
    planName: subscription?.planName || 'Free Trial',
    status: subscription?.status || 'trial',
    hasFeature,
    isAtLimit,
    getUsagePercentage,
    trialDaysRemaining: subscription?.trialDaysRemaining ?? null,
    nextPlan: subscription?.nextPlan || null,
    invalidateCache,
  }
}
