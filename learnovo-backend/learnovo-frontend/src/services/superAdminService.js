import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Create a separate axios instance for super admin calls
const superAdminClient = axios.create({
    baseURL: `${API_BASE}/super-admin`,
    headers: {
        'Content-Type': 'application/json'
    }
})

// Request interceptor to attach superAdmin token
superAdminClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('superAdminToken')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

export const superAdminService = {
    // Auth
    login: async (credentials) => {
        const response = await superAdminClient.post('/auth/login', credentials)
        return response.data
    },

    // Dashboard
    getDashboardStats: async () => {
        const response = await superAdminClient.get('/dashboard')
        return response.data
    },

    // Tenants
    getTenants: async (params) => {
        const response = await superAdminClient.get('/tenants', { params })
        return response.data
    },
    getTenantById: async (id) => {
        const response = await superAdminClient.get(`/tenants/${id}`)
        return response.data
    },
    updateTenantPlan: async (id, data) => {
        const response = await superAdminClient.patch(`/tenants/${id}/plan`, data)
        return response.data
    },
    suspendTenant: async (id) => {
        const response = await superAdminClient.patch(`/tenants/${id}/suspend`)
        return response.data
    },
    activateTenant: async (id) => {
        const response = await superAdminClient.patch(`/tenants/${id}/activate`)
        return response.data
    },
    extendTenantTrial: async (id, days) => {
        const response = await superAdminClient.post(`/tenants/${id}/extend-trial`, { days })
        return response.data
    },
    overrideFeatures: async (id, data) => {
        const response = await superAdminClient.patch(`/tenants/${id}/override-features`, data)
        return response.data
    },
    deleteTenant: async (id) => {
        const response = await superAdminClient.delete(`/tenants/${id}`)
        return response.data
    },

    // Users
    getUsers: async (params) => {
        const response = await superAdminClient.get('/users', { params })
        return response.data
    },
    resetUserPassword: async (id) => {
        const response = await superAdminClient.patch(`/users/${id}/reset-password`)
        return response.data
    },
    deactivateUser: async (id) => {
        const response = await superAdminClient.delete(`/users/${id}`)
        return response.data
    },
    activateUser: async (id) => {
        const response = await superAdminClient.patch(`/users/${id}/activate`)
        return response.data
    },

    // Audit logs
    getAuditLogs: async (params) => {
        const response = await superAdminClient.get('/audit-logs', { params })
        return response.data
    }
}
