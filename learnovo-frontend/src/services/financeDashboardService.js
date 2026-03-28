import api from './authService'

export const financeDashboardService = {
  getDashboard: async () => {
    const res = await api.get('/finance/dashboard')
    return res.data
  },

  getMonthlyComparison: async (months = 6) => {
    const res = await api.get(`/finance/monthly-comparison?months=${months}`)
    return res.data
  },

  getExpenseBreakdown: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    const url = `/finance/expense-breakdown${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getIncomeBreakdown: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    const url = `/finance/income-breakdown${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url)
    return res.data
  },

  getFeeCollectionRate: async () => {
    const res = await api.get('/finance/fee-collection-rate')
    return res.data
  },

  getReport: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.format) params.append('format', filters.format)
    const url = `/finance/report${params.toString() ? `?${params.toString()}` : ''}`
    const res = await api.get(url, filters.format === 'csv' ? { responseType: 'blob' } : {})
    return res.data
  }
}

export default financeDashboardService
