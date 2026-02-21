import api from './authService'

export const employeesService = {
    list: async (filters = {}) => {
        const { page = 1, limit = 20, search = '', role, department, status } = filters
        const params = new URLSearchParams()

        if (page && page > 0) params.append('page', page.toString())
        if (limit && limit > 0) params.append('limit', limit.toString())
        if (search && search.trim()) params.append('search', search.trim())
        if (role && role.trim()) params.append('role', role.trim())
        if (department && department.trim()) params.append('department', department.trim())
        if (status && status.trim()) params.append('status', status.trim())

        const url = `/employees${params.toString() ? `?${params.toString()}` : ''}`
        const res = await api.get(url)
        return res.data
    },

    getFilters: async () => {
        const res = await api.get('/employees/filters')
        return res.data
    },

    get: async (id) => {
        const res = await api.get(`/employees/${id}`)
        return res.data
    },

    create: async (payload) => {
        const res = await api.post('/employees', payload)
        return res.data
    },

    update: async (id, payload) => {
        const res = await api.put(`/employees/${id}`, payload)
        return res.data
    },

    remove: async (id) => {
        const res = await api.delete(`/employees/${id}`)
        return res.data
    },

    toggleStatus: async (id, data) => {
        const res = await api.put(`/employees/${id}/toggle-status`, data)
        return res.data
    },

    resetPassword: async (id, data) => {
        const res = await api.put(`/employees/${id}/reset-password`, data)
        return res.data
    },

    createLogin: async (id, data) => {
        const res = await api.post(`/employees/${id}/create-login`, data)
        return res.data
    },

    disableLogin: async (id) => {
        const res = await api.put(`/employees/${id}/disable-login`)
        return res.data
    },

    uploadPhoto: async (id, file) => {
        const formData = new FormData()
        formData.append('photo', file)
        const res = await api.post(`/employees/${id}/upload-photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        return res.data
    }
}

export default employeesService
