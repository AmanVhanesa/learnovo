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

  getRecentActivities: async (limit = 10) => {
    const { data } = await api.get(`/reports/activities?limit=${limit}`);
    return data;
  },

  getDailyFeeDetails: async (date, filters = {}) => {
    const params = { date, ...filters };
    const { data } = await api.get('/fees/daily', { params });
    return data;
  }
}

export default reportsService


