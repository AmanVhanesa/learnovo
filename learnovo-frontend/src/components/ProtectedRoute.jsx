import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute Component
 * Restricts access to routes based on authentication and user roles
 * 
 * @param {Array} allowedRoles - Array of roles allowed to access this route (e.g., ['admin', 'teacher'])
 * @param {ReactNode} children - Child components to render if authorized
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, isLoading, user } = useAuth()

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

  // Check if user's role is allowed (if allowedRoles is specified)
  if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    // Redirect to unauthorized page or dashboard
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute
