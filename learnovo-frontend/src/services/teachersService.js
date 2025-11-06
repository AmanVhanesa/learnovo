import api from './authService'

export const teachersService = {
  list: async ({ page = 1, limit = 20, search = '' } = {}) => {
    const params = new URLSearchParams()
    if (page) params.append('page', page)
    if (limit) params.append('limit', limit)
    if (search && search.trim()) params.append('search', search.trim())
    const res = await api.get(`/teachers?${params.toString()}`)
    return res.data
  },
  create: async (payload) => {
    const res = await api.post('/teachers', payload)
    return res.data
  },
  update: async (id, payload) => {
    const res = await api.put(`/teachers/${id}`, payload)
    return res.data
  },
  remove: async (id) => {
    const res = await api.delete(`/teachers/${id}`)
    return res.data
  }
}

export default teachersService


