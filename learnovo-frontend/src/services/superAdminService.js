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

// Response interceptor to handle token expiration (401)
superAdminClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('superAdminToken')
            localStorage.removeItem('superAdminUser')
            if (window.location.pathname !== '/super-admin-login') {
                window.location.href = '/super-admin-login'
            }
        }
        return Promise.reject(error)
    }
)

export const superAdminService = {
    // ─── Auth ────────────────────────────────────────────────────────────────
    login: async (credentials) => {
        const response = await superAdminClient.post('/auth/login', credentials)
        return response.data
    },

    // ─── Dashboard ───────────────────────────────────────────────────────────
    getDashboardStats: async () => {
        const response = await superAdminClient.get('/dashboard')
        return response.data
    },

    // ─── Tenants ─────────────────────────────────────────────────────────────
    getTenants: async (params) => {
        const response = await superAdminClient.get('/tenants', { params })
        return response.data
    },
    getTenantById: async (id) => {
        const response = await superAdminClient.get(`/tenants/${id}`)
        return response.data
    },
    createTenant: async (data) => {
        const response = await superAdminClient.post('/tenants', data)
        return response.data
    },
    updateTenant: async (id, data) => {
        const response = await superAdminClient.patch(`/tenants/${id}`, data)
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
    bulkAction: async (data) => {
        const response = await superAdminClient.post('/tenants/bulk-action', data)
        return response.data
    },
    impersonateTenant: async (id) => {
        const response = await superAdminClient.post(`/tenants/${id}/impersonate`)
        return response.data
    },

    // ─── Users ───────────────────────────────────────────────────────────────
    getUsers: async (params) => {
        const response = await superAdminClient.get('/users', { params })
        return response.data
    },
    getUserById: async (id) => {
        const response = await superAdminClient.get(`/users/${id}`)
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
    getRoleDistribution: async () => {
        const response = await superAdminClient.get('/users/role-distribution')
        return response.data
    },

    // ─── Plans ───────────────────────────────────────────────────────────────
    getPlans: async () => {
        const response = await superAdminClient.get('/plans')
        return response.data
    },
    createPlan: async (data) => {
        const response = await superAdminClient.post('/plans', data)
        return response.data
    },
    updatePlan: async (id, data) => {
        const response = await superAdminClient.patch(`/plans/${id}`, data)
        return response.data
    },
    deletePlan: async (id) => {
        const response = await superAdminClient.delete(`/plans/${id}`)
        return response.data
    },

    // ─── Coupons ─────────────────────────────────────────────────────────────
    getCoupons: async () => {
        const response = await superAdminClient.get('/coupons')
        return response.data
    },
    createCoupon: async (data) => {
        const response = await superAdminClient.post('/coupons', data)
        return response.data
    },
    updateCoupon: async (id, data) => {
        const response = await superAdminClient.patch(`/coupons/${id}`, data)
        return response.data
    },
    deleteCoupon: async (id) => {
        const response = await superAdminClient.delete(`/coupons/${id}`)
        return response.data
    },

    // ─── Billing & Invoices ──────────────────────────────────────────────────
    getBillingDashboard: async () => {
        const response = await superAdminClient.get('/billing/dashboard')
        return response.data
    },
    getInvoices: async (params) => {
        const response = await superAdminClient.get('/invoices', { params })
        return response.data
    },
    createInvoice: async (data) => {
        const response = await superAdminClient.post('/invoices', data)
        return response.data
    },
    updateInvoice: async (id, data) => {
        const response = await superAdminClient.patch(`/invoices/${id}`, data)
        return response.data
    },

    // ─── Communication ───────────────────────────────────────────────────────
    getAnnouncements: async (params) => {
        const response = await superAdminClient.get('/announcements', { params })
        return response.data
    },
    createAnnouncement: async (data) => {
        const response = await superAdminClient.post('/announcements', data)
        return response.data
    },
    updateAnnouncement: async (id, data) => {
        const response = await superAdminClient.patch(`/announcements/${id}`, data)
        return response.data
    },
    deleteAnnouncement: async (id) => {
        const response = await superAdminClient.delete(`/announcements/${id}`)
        return response.data
    },

    // ─── Email Templates ─────────────────────────────────────────────────────
    getEmailTemplates: async () => {
        const response = await superAdminClient.get('/email-templates')
        return response.data
    },
    createEmailTemplate: async (data) => {
        const response = await superAdminClient.post('/email-templates', data)
        return response.data
    },
    updateEmailTemplate: async (id, data) => {
        const response = await superAdminClient.patch(`/email-templates/${id}`, data)
        return response.data
    },
    deleteEmailTemplate: async (id) => {
        const response = await superAdminClient.delete(`/email-templates/${id}`)
        return response.data
    },

    // ─── Support Tickets ─────────────────────────────────────────────────────
    getSupportTickets: async (params) => {
        const response = await superAdminClient.get('/support-tickets', { params })
        return response.data
    },
    getSupportTicketById: async (id) => {
        const response = await superAdminClient.get(`/support-tickets/${id}`)
        return response.data
    },
    createSupportTicket: async (data) => {
        const response = await superAdminClient.post('/support-tickets', data)
        return response.data
    },
    updateSupportTicket: async (id, data) => {
        const response = await superAdminClient.patch(`/support-tickets/${id}`, data)
        return response.data
    },
    replySupportTicket: async (id, data) => {
        const response = await superAdminClient.post(`/support-tickets/${id}/reply`, data)
        return response.data
    },
    getSupportStats: async () => {
        const response = await superAdminClient.get('/support-tickets/stats/summary')
        return response.data
    },

    // ─── Knowledge Base ──────────────────────────────────────────────────────
    getKnowledgeBase: async (params) => {
        const response = await superAdminClient.get('/knowledge-base', { params })
        return response.data
    },
    createKBArticle: async (data) => {
        const response = await superAdminClient.post('/knowledge-base', data)
        return response.data
    },
    updateKBArticle: async (id, data) => {
        const response = await superAdminClient.patch(`/knowledge-base/${id}`, data)
        return response.data
    },
    deleteKBArticle: async (id) => {
        const response = await superAdminClient.delete(`/knowledge-base/${id}`)
        return response.data
    },

    // ─── Platform Settings ───────────────────────────────────────────────────
    getSettings: async () => {
        const response = await superAdminClient.get('/settings')
        return response.data
    },
    updateSettings: async (data) => {
        const response = await superAdminClient.patch('/settings', data)
        return response.data
    },

    // ─── Modules ─────────────────────────────────────────────────────────────
    getModules: async () => {
        const response = await superAdminClient.get('/modules')
        return response.data
    },

    // ─── Reports ─────────────────────────────────────────────────────────────
    getReportsOverview: async () => {
        const response = await superAdminClient.get('/reports/overview')
        return response.data
    },

    // ─── System Health ───────────────────────────────────────────────────────
    getSystemHealth: async () => {
        const response = await superAdminClient.get('/system/health')
        return response.data
    },

    // ─── Audit Logs ──────────────────────────────────────────────────────────
    getAuditLogs: async (params) => {
        const response = await superAdminClient.get('/audit-logs', { params })
        return response.data
    }
}
