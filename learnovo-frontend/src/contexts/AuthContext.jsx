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
  error: null
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
        error: null
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
        error: null
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
              token
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
                token
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

  const value = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    uploadPhoto,
    changePassword,
    clearError
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
