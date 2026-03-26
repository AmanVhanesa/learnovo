import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL is not defined. Please set it in your environment variables.')
}

const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const reportsService = {
  getDashboardStats: async () => {
    const { data } = await api.get('/reports/dashboard')
    return data
  },

  getRecentActivities: async (filters = {}) => {
    const params = new URLSearchParams()

    // Add filters as query params
    if (filters.limit) params.append('limit', filters.limit)
    if (filters.search) params.append('search', filters.search)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.type && filters.type !== 'all') params.append('type', filters.type)
    if (filters.page) params.append('page', filters.page)

    const queryString = params.toString()
    const url = `/reports/activities${queryString ? `?${queryString}` : ''}`

    const { data } = await api.get(url)
    return data
  },

  getDailyFeeDetails: async (date, filters = {}) => {
    const params = { date, ...filters };
    const { data } = await api.get('/fees/daily', { params });
    return data;
  }
}

export default reportsService


