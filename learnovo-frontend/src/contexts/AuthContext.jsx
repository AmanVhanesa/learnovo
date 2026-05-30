import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { authService } from '../services/authService'
import toast from 'react-hot-toast'

const AuthContext = createContext()

const initialState = {
  user: null,
  tenant: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isLoading: true,
  error: null,
  isImpersonating: !!localStorage.getItem('impersonation'),
}

function authReducer(state, action) {
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
        user: action.payload.user,
        tenant: action.payload.tenant,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        isImpersonating: action.payload.isImpersonating || false,
      }
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload
      }
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        tenant: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        isImpersonating: false,
      }
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload }
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

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Check if user is logged in on app start
  useEffect(() => {
    const checkAuth = async () => {
      // Check for auth token passed via URL (cross-subdomain login handoff)
      // When a user logs in on the root domain and is redirected to a tenant
      // subdomain, localStorage isn't shared, so the token is passed via URL.
      const urlParams = new URLSearchParams(window.location.search)

      // Cross-origin logout signal: a user who logged out of the demo subdomain
      // is redirected here with ?signedout=1. The root origin may still hold the
      // session it created during the original login handoff, which would
      // silently re-authenticate and bounce them back to the demo. Clear it and
      // stay logged out so the root login (with its Quick Demo buttons) shows.
      if (urlParams.get('signedout') === '1') {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('tenant')
        localStorage.removeItem('selectedChildId')
        urlParams.delete('signedout')
        const cleanUrl = urlParams.toString()
          ? `${window.location.pathname}?${urlParams.toString()}`
          : window.location.pathname
        window.history.replaceState({}, '', cleanUrl)
        dispatch({ type: 'AUTH_FAILURE', payload: null })
        return
      }

      const urlToken = urlParams.get('authToken')
      if (urlToken) {
        localStorage.setItem('token', urlToken)
        // Clean the token from URL without reloading the page
        urlParams.delete('authToken')
        const cleanUrl = urlParams.toString()
          ? `${window.location.pathname}?${urlParams.toString()}`
          : window.location.pathname
        window.history.replaceState({}, '', cleanUrl)
      }

      const token = localStorage.getItem('token')
      const user = localStorage.getItem('user')
      const tenant = localStorage.getItem('tenant')

      if (token) {
        try {
          // Fetch fresh user data from server (also returns tenant for cross-subdomain handoff)
          const response = await authService.getCurrentUser()
          const cachedUser = user ? JSON.parse(user) : {}
          // Merge: prefer fresh server data but fall back to cached for missing fields
          const mergedUser = {
            ...cachedUser,      // base: cached (includes avatar from login)
            ...response.user,  // override with fresh server data
            // Preserve cached avatar/photo if server doesn't return one
            avatar: response.user?.avatar || cachedUser?.avatar || null,
            photo: response.user?.photo || cachedUser?.photo || null,
          }
          // Use tenant from server response if available (cross-subdomain handoff),
          // otherwise fall back to cached tenant
          const resolvedTenant = response.tenant || (tenant ? JSON.parse(tenant) : null)
          // Keep localStorage in sync
          localStorage.setItem('user', JSON.stringify(mergedUser))
          if (resolvedTenant) localStorage.setItem('tenant', JSON.stringify(resolvedTenant))
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: mergedUser,
              tenant: resolvedTenant,
              token,
              isImpersonating: !!localStorage.getItem('impersonation'),
            }
          })
        } catch (error) {
          if (user) {
            // API failed but we have cached data — use it
            dispatch({
              type: 'AUTH_SUCCESS',
              payload: {
                user: JSON.parse(user),
                tenant: tenant ? JSON.parse(tenant) : null,
                token,
                isImpersonating: !!localStorage.getItem('impersonation'),
              }
            })
          } else {
            // Token is invalid or expired and no cached data — force re-login
            localStorage.removeItem('token')
            dispatch({ type: 'AUTH_FAILURE', payload: null })
          }
        }
      } else {
        dispatch({ type: 'AUTH_FAILURE', payload: null })
      }
    }

    checkAuth()
  }, [])

  const login = async (loginData) => {
    try {
      dispatch({ type: 'AUTH_START' })

      const response = await authService.login(loginData)

      // Handle both response formats (direct response.data or nested)
      const token = response.token || response.data?.token
      const user = response.user || response.data?.user
      const tenant = response.tenant || response.data?.tenant

      if (!token) {
        throw new Error('No token received from server')
      }

      // Store in localStorage
      localStorage.setItem('token', token)
      if (user) localStorage.setItem('user', JSON.stringify(user))
      if (tenant) localStorage.setItem('tenant', JSON.stringify(tenant))

      // Update auth state
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, tenant, token }
      })

      toast.success('Login successful!')
      return { success: true, user, tenant, token }
    } catch (error) {

      let message = 'Login failed'

      if (error.response?.data?.message) {
        message = error.response.data.message
      } else if (error.response?.status === 401) {
        message = 'Invalid email or password'
      } else if (error.response?.status === 404) {
        message = 'Server not found. Please check if the backend is running.'
      } else if (error.response?.status >= 500) {
        message = 'Server error. Please try again later.'
      } else if (error.message === 'Network Error' || error.code === 'ECONNREFUSED') {
        message = 'Cannot connect to server. Please try again later or contact support.'
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

  const register = async (userData) => {
    try {
      dispatch({ type: 'AUTH_START' })

      const response = await authService.register(userData)
      const { token, user } = response

      localStorage.setItem('token', token)

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token }
      })

      toast.success('Registration successful!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed'
      dispatch({
        type: 'AUTH_FAILURE',
        payload: message
      })
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('tenant')
    localStorage.removeItem('selectedChildId')
    dispatch({ type: 'LOGOUT' })
    toast.success('Logged out successfully!')

    // The demo tenant is a shared playground reached via the "Quick Demo" buttons
    // on the root domain. On the demo subdomain the login is tenant-branded, which
    // hides those role buttons — so a user who logged out of demo admin would be
    // trapped and unable to try the teacher/student demo. Send them back to the
    // root login where the demo buttons live. Real tenants (e.g. spis) are left
    // alone and stay on their own subdomain login.
    try {
      const host = window.location.hostname.toLowerCase()
      const baseDomain = import.meta.env.VITE_APP_DOMAIN || 'learnovoportal.com'
      if (host === `demo.${baseDomain}`) {
        // signedout=1 tells the root-domain AuthContext to clear its own stale
        // session (the demo user first logged in on the root origin, whose
        // localStorage we cannot clear from this subdomain origin). Without it
        // the root would silently re-authenticate and bounce back to the demo.
        window.location.href = `${window.location.protocol}//${baseDomain}/login?signedout=1`
      }
    } catch (e) {
      // Non-fatal — fall back to the caller's own post-logout navigation
    }
  }

  const updateProfile = async (profileData) => {
    try {
      const response = await authService.updateProfile(profileData)
      const updatedUser = { ...state.user, ...response.user }
      dispatch({
        type: 'UPDATE_USER',
        payload: response.user
      })
      // Persist to localStorage so photo survives refresh
      localStorage.setItem('user', JSON.stringify(updatedUser))
      toast.success('Profile updated successfully!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const uploadPhoto = async (file) => {
    try {
      const response = await authService.uploadPhoto(file)
      const updatedUser = { ...state.user, avatar: response.avatar, photo: response.photo }
      dispatch({
        type: 'UPDATE_USER',
        payload: { avatar: response.avatar, photo: response.photo }
      })
      // Persist to localStorage so photo survives refresh
      localStorage.setItem('user', JSON.stringify(updatedUser))
      toast.success('Profile photo updated!')
      return { success: true, avatar: response.avatar }
    } catch (error) {
      const message = error.response?.data?.message || 'Photo upload failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const changePassword = async (passwordData) => {
    try {
      await authService.changePassword(passwordData)
      toast.success('Password changed successfully!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Password change failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' })
  }

  // Super admin impersonation: login as a tenant's admin
  const loginAsImpersonation = ({ token: impToken, user: impUser, tenant: impTenant }) => {
    // Save current super admin session so we can restore it later
    const backup = {
      token: localStorage.getItem('superAdminToken'),
      superAdmin: localStorage.getItem('superAdmin'),
      returnPath: window.location.pathname,
    }
    localStorage.setItem('impersonation', JSON.stringify(backup))

    // Set the impersonation token as the active auth session
    localStorage.setItem('token', impToken)
    localStorage.setItem('user', JSON.stringify(impUser))
    localStorage.setItem('tenant', JSON.stringify(impTenant))

    dispatch({
      type: 'AUTH_SUCCESS',
      payload: {
        user: impUser,
        tenant: impTenant,
        token: impToken,
        isImpersonating: true,
      }
    })
  }

  // Exit impersonation and return to super admin panel
  const exitImpersonation = () => {
    const backup = JSON.parse(localStorage.getItem('impersonation') || '{}')

    // Clear impersonation session
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('tenant')
    localStorage.removeItem('impersonation')

    // Restore super admin session
    if (backup.token) {
      localStorage.setItem('superAdminToken', backup.token)
    }
    if (backup.superAdmin) {
      localStorage.setItem('superAdmin', backup.superAdmin)
    }

    dispatch({ type: 'LOGOUT' })

    // Navigate back to super admin panel
    window.location.href = backup.returnPath || '/super-admin/schools'
  }

  const value = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    uploadPhoto,
    changePassword,
    clearError,
    loginAsImpersonation,
    exitImpersonation,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
