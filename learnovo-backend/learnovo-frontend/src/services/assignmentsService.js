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

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const assignmentsService = {
  // Get all assignments
  list: async (filters = {}) => {
    try {
      const response = await api.get('/assignments', {
        params: filters
      })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Get a specific assignment
  get: async (id) => {
    try {
      const response = await api.get(`/assignments/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Create a new assignment
  create: async (assignmentData) => {
    try {
      const response = await api.post('/assignments', assignmentData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Update an assignment
  update: async (id, assignmentData) => {
    try {
      const response = await api.put(`/assignments/${id}`, assignmentData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Delete an assignment
  delete: async (id) => {
    try {
      const response = await api.delete(`/assignments/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Get assignment statistics
  getStats: async () => {
    try {
      const response = await api.get('/assignments/stats/overview')
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Get upcoming assignments
  getUpcoming: async () => {
    try {
      const response = await api.get('/assignments/upcoming/list')
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }
}

export default assignmentsService
