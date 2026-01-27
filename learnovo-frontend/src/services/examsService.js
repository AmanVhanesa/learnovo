import api from './authService'

export const examsService = {
    list: async (filters = {}) => {
        const params = new URLSearchParams()
        if (filters.class) params.append('class', filters.class)
        if (filters.subject) params.append('subject', filters.subject)

        const res = await api.get(`/exams?${params.toString()}`)
        return res.data
    },

    create: async (examData) => {
        const res = await api.post('/exams', examData)
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
