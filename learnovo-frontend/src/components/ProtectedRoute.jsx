import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute Component
 * Restricts access to routes based on authentication, user roles,
 * and tenant subscription status (locks out expired trials / suspended accounts).
 *
 * @param {Array} allowedRoles - Array of roles allowed to access this route
 * @param {ReactNode} children - Child components to render if authorized
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, isLoading, user, tenant } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Check if tenant subscription is locked (expired trial or suspended)
  // Skip for superadmin users
  if (user?.role !== 'superadmin' && tenant?.subscription) {
    const { status, trialEndsAt } = tenant.subscription

    const isExpiredTrial = status === 'trial' && trialEndsAt && new Date() > new Date(trialEndsAt)
    const isSuspended = status === 'suspended'
    const isCancelled = status === 'cancelled'

    if (isExpiredTrial || isSuspended || isCancelled) {
      return <Navigate to="/account-locked" replace />
    }
  }

  // Check if user's role is allowed (if allowedRoles is specified)
  if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />
  }

  return children
}

export default ProtectedRoute
