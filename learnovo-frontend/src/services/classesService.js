import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

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

export const classesService = {
  // Get all classes
  list: async (filters = {}) => {
    try {
      const response = await api.get('/classes', {
        params: filters
      })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Get a specific class
  get: async (id) => {
    try {
      const response = await api.get(`/classes/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Create a new class
  create: async (classData) => {
    try {
      const response = await api.post('/classes', classData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Update a class
  update: async (id, classData) => {
    try {
      const response = await api.put(`/classes/${id}`, classData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Delete a class
  delete: async (id) => {
    try {
      const response = await api.delete(`/classes/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Get students in a class
  getStudents: async (id) => {
    try {
      const response = await api.get(`/classes/${id}/students`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Enroll students in a class
  enrollStudents: async (id, studentIds) => {
    try {
      const response = await api.post(`/classes/${id}/students`, { studentIds })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Get subjects for a class
  getSubjects: async (id) => {
    try {
      const response = await api.get(`/classes/${id}/subjects`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Assign subject to class
  assignSubject: async (id, subjectData) => {
    try {
      const response = await api.post(`/classes/${id}/subjects`, subjectData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Remove subject from class
  removeSubject: async (id, subjectId) => {
    try {
      const response = await api.delete(`/classes/${id}/subjects/${subjectId}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }
}

export default classesService
