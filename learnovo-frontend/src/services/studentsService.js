import api from './authService'

export const studentsService = {
  list: async (filters = {}) => {
    const { page = 1, limit = 20, search = '', class: classFilter, section, academicYear, status } = filters
    const params = new URLSearchParams()

    // Only add non-empty params to avoid validation errors
    if (page && page > 0) params.append('page', page.toString())
    if (limit && limit > 0) params.append('limit', limit.toString())
    if (search && search.trim()) params.append('search', search.trim())
    if (classFilter && classFilter.trim()) params.append('class', classFilter.trim())
    if (section && section.trim()) params.append('section', section.trim())
    if (academicYear && academicYear.trim()) params.append('academicYear', academicYear.trim())
    if (status && status.trim()) params.append('status', status.trim())

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
  },
  importBulk: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post('/students/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return res.data
  },
  // New methods
  getFilters: async () => {
    const res = await api.get('/students/filters')
    return res.data
  },
  toggleStatus: async (id, data) => {
    const res = await api.put(`/students/${id}/toggle-status`, data)
    return res.data
  },
  resetPassword: async (id, data) => {
    const res = await api.put(`/students/${id}/reset-password`, data)
    return res.data
  },
  bulkActivate: async (studentIds) => {
    const res = await api.post('/students/bulk-activate', { studentIds })
    return res.data
  },
  bulkDeactivate: async (studentIds, reason) => {
    const res = await api.post('/students/bulk-deactivate', { studentIds, reason })
    return res.data
  },
  promote: async (data) => {
    const res = await api.post('/students/promote', data)
    return res.data
  }
}

export default studentsService


