import api from './authService'

export const financeDashboardService = {
  getDashboard: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    const url = `/finance/dashboard${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getMonthlyComparison: async (months = 6, filters = {}) => {
    const params = new URLSearchParams()
    params.append('months', months)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    const res = await api.get(`/finance/monthly-comparison?${params.toString()}`)
    return res.data
  },

  getExpenseBreakdown: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    const url = `/finance/expense-breakdown${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getIncomeBreakdown: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    const url = `/finance/income-breakdown${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getFeeCollectionRate: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    const url = `/finance/fee-collection-rate${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getReport: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.format) params.append('format', filters.format)
    if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)
    const url = `/finance/report${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url, filters.format === 'csv' ? { responseType: 'blob' } : {})
    return res.data
  }
}

export default financeDashboardService
