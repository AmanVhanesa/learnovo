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

export const subjectsService = {
  // Get all subjects
  list: async (filters = {}) => {
    try {
      const response = await api.get('/subjects', {
        params: filters
      })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Get a specific subject
  get: async (id) => {
    try {
      const response = await api.get(`/subjects/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Create a new subject
  create: async (subjectData) => {
    try {
      const response = await api.post('/subjects', subjectData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Update a subject
  update: async (id, subjectData) => {
    try {
      const response = await api.put(`/subjects/${id}`, subjectData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Delete a subject
  delete: async (id) => {
    try {
      const response = await api.delete(`/subjects/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Toggle subject active status
  toggle: async (id) => {
    try {
      const response = await api.patch(`/subjects/${id}/toggle`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }
}

export default subjectsService
