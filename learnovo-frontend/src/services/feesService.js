import api from './authService'

export const feesService = {
  list: async ({ page = 1, limit = 50, status = '', className = '' } = {}) => {
    const params = new URLSearchParams()
    if (page) params.append('page', page)
    if (limit) params.append('limit', limit)
    if (status) params.append('status', status)
    if (className) params.append('class', className)
    const res = await api.get(`/fees?${params.toString()}`)
    return res.data
  },
  create: async (payload) => {
    const res = await api.post('/fees', payload)
    return res.data
  },
  update: async (id, payload) => {
    const res = await api.put(`/fees/${id}`, payload)
    return res.data
  },
  pay: async (id, payload) => {
    const res = await api.put(`/fees/${id}/pay`, payload)
    return res.data
  },
  remove: async (id) => {
    const res = await api.delete(`/fees/${id}`)
    return res.data
  }
}

export default feesService


