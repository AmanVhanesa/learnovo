import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { superAdminService } from '../services/superAdminService'
import toast from 'react-hot-toast'

const SuperAdminContext = createContext()

const tokenFromStorage = localStorage.getItem('superAdminToken')
const adminFromStorage = localStorage.getItem('superAdmin')

const initialState = {
    superAdmin: adminFromStorage ? JSON.parse(adminFromStorage) : null,
    token: tokenFromStorage,
    isAuthenticated: !!tokenFromStorage && !!adminFromStorage,
    isLoading: false, // Set to false immediately since we check synchrously
    error: null
}

function superAdminReducer(state, action) {
    switch (action.type) {
        case 'AUTH_START':
            return {
                ...state,
                isLoading: true,
                error: null
            }
        case 'AUTH_SUCCESS':
            return {
                ...state,
                superAdmin: action.payload.superAdmin,
                token: action.payload.token,
                isAuthenticated: true,
                isLoading: false,
                error: null
            }
        case 'AUTH_FAILURE':
            return {
                ...state,
                superAdmin: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
                error: action.payload
            }
        case 'LOGOUT':
            return {
                ...state,
                superAdmin: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
                error: null
            }
        case 'CLEAR_ERROR':
            return {
                ...state,
                error: null
            }
        default:
            return state
    }
}

export function SuperAdminProvider({ children }) {
    const [state, dispatch] = useReducer(superAdminReducer, initialState)

    // Check if super admin is logged in on app start
    useEffect(() => {
        // Since we now initialize synchronously from localStorage, 
        // we just leave this block empty or handle token validation here if an endpoint existed.
        const token = localStorage.getItem('superAdminToken')
        if (!token && state.isAuthenticated) {
            dispatch({ type: 'AUTH_FAILURE', payload: null })
        }
    }, [state.isAuthenticated])

    const login = async (loginData) => {
        try {
            dispatch({ type: 'AUTH_START' })

            const response = await superAdminService.login(loginData)

            const token = response.token || response.data?.token
            // The backend returns the user object directly inside response.data
            const superAdmin = response.data?.id ? response.data : response.data?.superadmin || response.data?.user || response.superadmin || response.user

            if (!token) {
                throw new Error('No token received from server')
            }

            // Store in localStorage with superAdmin prefixes so it doesn't conflict with normal users
            localStorage.setItem('superAdminToken', token)
            if (superAdmin) localStorage.setItem('superAdmin', JSON.stringify(superAdmin))

            dispatch({
                type: 'AUTH_SUCCESS',
                payload: { superAdmin, token }
            })

            toast.success('Super Admin Login successful!')
            return { success: true, superAdmin, token }
        } catch (error) {
            let message = 'Login failed'

            if (error.response?.data?.message) {
                message = error.response.data.message
            } else if (error.response?.status === 401) {
                message = 'Invalid email or password'
            } else if (error.message) {
                message = error.message
            }

            dispatch({
                type: 'AUTH_FAILURE',
                payload: message
            })
            toast.error(message)
            return { success: false, error: message }
        }
    }

    const logout = () => {
        localStorage.removeItem('superAdminToken')
        localStorage.removeItem('superAdmin')
        dispatch({ type: 'LOGOUT' })
        toast.success('Super Admin logged out successfully!')
    }

    const clearError = () => {
        dispatch({ type: 'CLEAR_ERROR' })
    }

    const value = {
        ...state,
        login,
        logout,
        clearError
    }

    return (
        <SuperAdminContext.Provider value={value}>
            {children}
        </SuperAdminContext.Provider>
    )
}

export const useSuperAdminAuth = () => {
    const context = useContext(SuperAdminContext)
    if (!context) {
        throw new Error('useSuperAdminAuth must be used within a SuperAdminProvider')
    }
    return context
}
