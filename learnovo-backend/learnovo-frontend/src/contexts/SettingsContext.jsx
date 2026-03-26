import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { settingsService } from '../services/settingsService'
import { useAuth } from './AuthContext'

const SettingsContext = createContext()

const initialState = {
  settings: null,
  isLoading: true,
  error: null
}

function settingsReducer(state, action) {
  switch (action.type) {
    case 'SETTINGS_LOADING':
      return {
        ...state,
        isLoading: true,
        error: null
      }
    case 'SETTINGS_SUCCESS':
      return {
        ...state,
        settings: action.payload,
        isLoading: false,
        error: null
      }
    case 'SETTINGS_ERROR':
      return {
        ...state,
        settings: null,
        isLoading: false,
        error: action.payload
      }
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload }
      }
    default:
      return state
  }
}

export function SettingsProvider({ children }) {
  const [state, dispatch] = useReducer(settingsReducer, initialState)
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  useEffect(() => {
    // Only attempt to load settings when the user is authenticated
    // Avoids 401 loops that can cause repeated redirects
    if (!authLoading && isAuthenticated) {
      fetchSettings()
    } else if (!authLoading && !isAuthenticated) {
      // If not authenticated, ensure loading state is not stuck
      dispatch({ type: 'SETTINGS_ERROR', payload: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading])

  const fetchSettings = async () => {
    try {
      dispatch({ type: 'SETTINGS_LOADING' })
      const response = await settingsService.getSettings()
      dispatch({
        type: 'SETTINGS_SUCCESS',
        payload: response.data
      })
    } catch (error) {
      dispatch({
        type: 'SETTINGS_ERROR',
        payload: error.response?.data?.message || 'Failed to load settings'
      })
    }
  }

  const updateSettings = async (settingsData) => {
    try {
      const response = await settingsService.updateSettings(settingsData)
      dispatch({
        type: 'UPDATE_SETTINGS',
        payload: response.data
      })
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to update settings' 
      }
    }
  }

  const formatCurrency = (amount, currency = null) => {
    if (!state.settings) return `₹${amount}`
    
    const currencySettings = state.settings.currency
    const currencyCode = currency || currencySettings.default
    const symbol = currencySettings.symbol
    const position = currencySettings.position
    
    const formattedAmount = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: currencySettings.decimalPlaces,
      maximumFractionDigits: currencySettings.decimalPlaces
    }).format(amount)
    
    return position === 'before' 
      ? `${symbol}${formattedAmount}`
      : `${formattedAmount} ${symbol}`
  }

  const value = {
    ...state,
    fetchSettings,
    updateSettings,
    formatCurrency
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
