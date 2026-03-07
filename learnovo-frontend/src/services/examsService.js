import api from './authService'

export const examsService = {
    list: async (filters = {}) => {
        const params = new URLSearchParams()
        if (filters.class) params.append('class', filters.class)
        if (filters.subject) params.append('subject', filters.subject)
        if (filters.section) params.append('section', filters.section)
        if (filters.status) params.append('status', filters.status)

        const res = await api.get(`/exams?${params.toString()}`)
        return res.data
    },

    getById: async (id) => {
        const res = await api.get(`/exams/${id}`)
        return res.data
    },

    create: async (examData) => {
        const res = await api.post('/exams', examData)
        return res.data
    },

    update: async (id, examData) => {
        const res = await api.patch(`/exams/${id}`, examData)
        return res.data
    },

    delete: async (id) => {
        const res = await api.delete(`/exams/${id}`)
        return res.data
    },

    getResults: async (id) => {
        const res = await api.get(`/exams/${id}/results`)
        return res.data
    },

    saveResults: async (id, results) => {
        const res = await api.post(`/exams/${id}/results`, { results })
        return res.data
    }
}
