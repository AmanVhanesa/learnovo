import api from './authService'

export const admissionsService = {
  list: async ({ page = 1, limit = 20, status = '' } = {}) => {
    const params = new URLSearchParams()
    if (page) params.append('page', page)
    if (limit) params.append('limit', limit)
    if (status) params.append('status', status)
    const res = await api.get(`/admissions?${params.toString()}`)
    return res.data
  },
  create: async (payload) => {
    const res = await api.post('/admissions', payload)
    return res.data
  },
  approve: async (id, payload = {}) => {
    const res = await api.put(`/admissions/${id}/approve`, payload)
    return res.data
  },
  reject: async (id, payload) => {
    const res = await api.put(`/admissions/${id}/reject`, payload)
    return res.data
  }
}

export default admissionsService


