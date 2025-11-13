import api from './authService'

export const studentsService = {
  list: async (filters = {}) => {
    const { page = 1, limit = 20, search = '', className = '', classId, className: classNameFilter } = filters
    const params = new URLSearchParams()
    
    // Only add non-empty params to avoid validation errors
    if (page && page > 0) params.append('page', page.toString())
    if (limit && limit > 0) params.append('limit', limit.toString())
    if (search && search.trim()) params.append('search', search.trim())
    if ((className || classNameFilter) && (className || classNameFilter).trim()) {
      params.append('class', (className || classNameFilter).trim())
    }
    if (classId && classId.toString().trim()) {
      params.append('classId', classId.toString().trim())
    }
    
    const url = `/students${params.toString() ? `?${params.toString()}` : ''}`
        
    try {
      const res = await api.get(url)
      return res.data
    } catch (error) {
      console.error('🌐 studentsService.list() error:', error)
      console.error('🌐 Error response:', error.response?.data)
      throw error
    }
  },
  get: async (id) => {
    const res = await api.get(`/students/${id}`)
    return res.data
  },
  create: async (payload) => {
    const res = await api.post('/students', payload)
    return res.data
  },
  update: async (id, payload) => {
    const res = await api.put(`/students/${id}`, payload)
    return res.data
  },
  remove: async (id) => {
    const res = await api.delete(`/students/${id}`)
    return res.data
  }
}

export default studentsService


