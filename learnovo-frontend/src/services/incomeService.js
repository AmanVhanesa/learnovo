import api from './authService'

// Income CRUD
export const incomeService = {
  list: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.page) params.append('page', filters.page)
    if (filters.limit) params.append('limit', filters.limit)
    if (filters.category) params.append('category', filters.category)
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.search) params.append('search', filters.search)
    if (filters.sortBy) params.append('sortBy', filters.sortBy)
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)
    if (filters.source) params.append('source', filters.source)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)

    const url = `/income${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  get: async (id) => {
    const res = await api.get(`/income/${id}`)
    return res.data
  },

  create: async (data) => {
    const res = await api.post('/income', data)
    return res.data
  },

  update: async (id, data) => {
    const res = await api.put(`/income/${id}`, data)
    return res.data
  },

  delete: async (id) => {
    const res = await api.delete(`/income/${id}`)
    return res.data
  },

  bulkDelete: async (ids) => {
    const res = await api.delete('/income/bulk/delete', { data: { ids } })
    return res.data
  }
}

// Dashboard & Reports
export const incomeReportsService = {
  getDashboard: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    const url = `/income/summary/dashboard${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getMonthly: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicYear) params.append('academicYear', filters.academicYear)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    const url = `/income/summary/monthly${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getByCategory: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    const url = `/income/summary/category${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  exportCsv: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.category) params.append('category', filters.category)
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)

    const token = localStorage.getItem('token')
    const url = `/income/export${params.toString() ? `?${params.toString()}` : ''}&token=${token}`
    const res = await api.get(url, { responseType: 'blob' })
    return res.data
  }
}

// Categories
export const incomeCategoriesService = {
  list: async (activeOnly = false) => {
    const url = `/income/categories/list${activeOnly ? '?activeOnly=true' : ''}`
    const res = await api.get(url)
    return res.data
  },

  create: async (data) => {
    const res = await api.post('/income/categories', data)
    return res.data
  },

  update: async (id, data) => {
    const res = await api.put(`/income/categories/${id}`, data)
    return res.data
  },

  delete: async (id) => {
    const res = await api.delete(`/income/categories/${id}`)
    return res.data
  },

  seed: async () => {
    const res = await api.post('/income/categories/seed')
    return res.data
  }
}

export default {
  income: incomeService,
  reports: incomeReportsService,
  categories: incomeCategoriesService
}
