import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL is not defined. Please set it in your environment variables.')
}

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

export const tenantService = {
  // Register a new school/tenant
  register: async (tenantData) => {
    try {
      // Use /schools/register endpoint (public registration route)
      const response = await api.post('/schools/register', tenantData)
      return response.data
    } catch (error) {
      console.error('Registration API error:', error)
      console.error('Error response:', error.response?.data)
      console.error('Error status:', error.response?.status)
      // Re-throw with more context
      if (error.response?.data) {
        throw error // Already has response data
      }
      // Network or other errors
      throw new Error(error.message || 'Failed to connect to server')
    }
  },

  // Check availability of school code, subdomain, or email
  checkAvailability: async (params) => {
    const queryString = new URLSearchParams(params).toString()
    const response = await api.get(`/tenants/check-availability?${queryString}`)
    return response.data
  },

  // Get tenant information
  getInfo: async () => {
    const response = await api.get('/tenants/info')
    return response.data
  },

  // Update tenant information
  updateInfo: async (tenantData) => {
    const response = await api.put('/tenants/info', tenantData)
    return response.data
  },

  // Get subscription details
  getSubscription: async () => {
    const response = await api.get('/tenants/subscription')
    return response.data
  },

  // Update subscription
  updateSubscription: async (subscriptionData) => {
    const response = await api.put('/tenants/subscription', subscriptionData)
    return response.data
  }
}

export default tenantService
