import api from './authService'

// Expenses CRUD
export const expensesService = {
  list: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.page) params.append('page', filters.page)
    if (filters.limit) params.append('limit', filters.limit)
    if (filters.status) params.append('status', filters.status)
    if (filters.category) params.append('category', filters.category)
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.search) params.append('search', filters.search)
    if (filters.sortBy) params.append('sortBy', filters.sortBy)
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)
    if (filters.source) params.append('source', filters.source)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)

    const url = `/expenses${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  get: async (id) => {
    const res = await api.get(`/expenses/${id}`)
    return res.data
  },

  create: async (data) => {
    const res = await api.post('/expenses', data)
    return res.data
  },

  update: async (id, data) => {
    const res = await api.put(`/expenses/${id}`, data)
    return res.data
  },

  delete: async (id) => {
    const res = await api.delete(`/expenses/${id}`)
    return res.data
  },

  approve: async (id) => {
    const res = await api.patch(`/expenses/${id}/approve`)
    return res.data
  },

  reject: async (id, reason) => {
    const res = await api.patch(`/expenses/${id}/reject`, { reason })
    return res.data
  },

  bulkApprove: async (ids) => {
    const res = await api.patch('/expenses/bulk/approve', { ids })
    return res.data
  },

  bulkDelete: async (ids) => {
    const res = await api.delete('/expenses/bulk/delete', { data: { ids } })
    return res.data
  }
}

// Dashboard & Reports
export const expenseReportsService = {
  getDashboard: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    const url = `/expenses/summary/dashboard${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getMonthly: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicYear) params.append('academicYear', filters.academicYear)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    const url = `/expenses/summary/monthly${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getByCategory: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    const url = `/expenses/summary/category${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  exportCsv: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.category) params.append('category', filters.category)
    if (filters.status) params.append('status', filters.status)
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)

    const token = localStorage.getItem('token')
    const url = `/expenses/export${params.toString() ? `?${params.toString()}` : ''}&token=${token}`
    const res = await api.get(url, { responseType: 'blob' })
    return res.data
  }
}

// Categories
export const expenseCategoriesService = {
  list: async (activeOnly = false) => {
    const url = `/expenses/categories/list${activeOnly ? '?activeOnly=true' : ''}`
    const res = await api.get(url)
    return res.data
  },

  create: async (data) => {
    const res = await api.post('/expenses/categories', data)
    return res.data
  },

  update: async (id, data) => {
    const res = await api.put(`/expenses/categories/${id}`, data)
    return res.data
  },

  delete: async (id) => {
    const res = await api.delete(`/expenses/categories/${id}`)
    return res.data
  },

  seed: async () => {
    const res = await api.post('/expenses/categories/seed')
    return res.data
  }
}

// Budgets
export const expenseBudgetService = {
  list: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.month) params.append('month', filters.month)
    if (filters.year) params.append('year', filters.year)

    const url = `/expenses/budget${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  save: async (data) => {
    const res = await api.post('/expenses/budget', data)
    return res.data
  }
}

export default {
  expenses: expensesService,
  reports: expenseReportsService,
  categories: expenseCategoriesService,
  budget: expenseBudgetService
}
