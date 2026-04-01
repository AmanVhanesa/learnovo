import api from './authService'

export const transitionsService = {
  // Class hierarchy
  getClassHierarchy: async () => {
    const { data } = await api.get('/transitions/class-hierarchy')
    return data
  },

  updateClassHierarchy: async (classHierarchy) => {
    const { data } = await api.put('/transitions/class-hierarchy', { classHierarchy })
    return data
  },

  // Single student promotion
  promoteStudent: async (studentId, payload) => {
    const { data } = await api.post(`/transitions/promote/${studentId}`, payload)
    return data
  },

  // Single student demotion
  demoteStudent: async (studentId, payload) => {
    const { data } = await api.post(`/transitions/demote/${studentId}`, payload)
    return data
  },

  // Bulk promotion
  bulkPromote: async (payload) => {
    const { data } = await api.post('/transitions/promote/bulk', payload)
    return data
  },

  // Section shift (single)
  shiftSection: async (studentId, payload) => {
    const { data } = await api.post(`/transitions/shift-section/${studentId}`, payload)
    return data
  },

  // Bulk section shift
  bulkShiftSection: async (payload) => {
    const { data } = await api.post('/transitions/shift-section/bulk', payload)
    return data
  },

  // Section merge
  mergeSections: async (payload) => {
    const { data } = await api.post('/transitions/sections/merge', payload)
    return data
  },

  // Section split
  splitSection: async (payload) => {
    const { data } = await api.post('/transitions/sections/split', payload)
    return data
  },

  // Year-end rollover
  yearRollover: async (payload) => {
    const { data } = await api.post('/transitions/year-rollover', payload, { timeout: 120000 })
    return data
  },

  // Transition history
  getHistory: async (params = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') query.append(key, val)
    })
    const { data } = await api.get(`/transitions/history?${query.toString()}`)
    return data
  },

  // Undo transition
  undoTransition: async (logId) => {
    const { data } = await api.post(`/transitions/undo/${logId}`)
    return data
  },

  // Recalculate section strengths
  recalculateStrengths: async () => {
    const { data } = await api.post('/transitions/recalculate-strengths')
    return data
  }
}

export default transitionsService
