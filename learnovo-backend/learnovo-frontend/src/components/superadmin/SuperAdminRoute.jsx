import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSuperAdminAuth } from '../../contexts/SuperAdminContext'

// A wrapper for super admin routes that redirects to the super admin login
// if not authenticated as a super admin.
const SuperAdminRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useSuperAdminAuth()
    const location = useLocation()

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (!isAuthenticated) {
        // Redirect to super admin login page, saving the requested location
        return <Navigate to="/super-admin-login" state={{ from: location }} replace />
    }

    return children
}

export default SuperAdminRoute
