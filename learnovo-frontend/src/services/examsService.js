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
    },

    publishResults: async (examId, isPublished) => {
        const res = await api.put(`/exams/${examId}/results/publish`, { isPublished })
        return res.data
    },

    getMyResults: async () => {
        const res = await api.get('/exams/my-results')
        return res.data
    },

    getResultCard: async (studentId, filters = {}) => {
        const params = new URLSearchParams()
        if (filters.examSeries) params.append('examSeries', filters.examSeries)
        if (filters.class) params.append('class', filters.class)
        const res = await api.get(`/exams/result-card/${studentId}?${params.toString()}`)
        return res.data
    },

    downloadReportCardPDF: async (studentId, filters = {}) => {
        const params = new URLSearchParams()
        if (filters.examSeries) params.append('examSeries', filters.examSeries)
        if (filters.class) params.append('class', filters.class)
        const res = await api.get(`/exams/result-card/${studentId}/pdf?${params.toString()}`, {
            responseType: 'blob'
        })
        return res.data
    },

    // ── Blank Report Card ──
    downloadBlankReportCardPDF: async (studentId, filters = {}) => {
        const params = new URLSearchParams()
        if (filters.examSeries) params.append('examSeries', filters.examSeries)
        if (filters.class) params.append('class', filters.class)
        const res = await api.get(`/report-cards/${studentId}/blank/pdf?${params.toString()}`, {
            responseType: 'blob'
        })
        return res.data
    },

    // ── Bulk Download ──
    startBulkDownload: async (sectionId, { examSeries, className, type = 'regular' } = {}) => {
        const res = await api.post('/report-cards/bulk-download', {
            sectionId,
            examSeries,
            class: className,
            type
        })
        return res.data
    },

    getBulkDownloadStatus: async (jobId) => {
        const res = await api.get(`/report-cards/bulk-download/${jobId}/status`)
        return res.data
    },

    downloadBulkZip: async (jobId) => {
        const res = await api.get(`/report-cards/bulk-download/${jobId}/download`, {
            responseType: 'blob'
        })
        return res.data
    },

    // ── Final / Cumulative Report Card ──
    getFinalReportCard: async (studentId, sessionId) => {
        const res = await api.get(`/report-cards/final/${studentId}/${sessionId}`)
        return res.data
    },

    downloadFinalReportCardPDF: async (studentId, sessionId) => {
        const res = await api.get(`/report-cards/final/${studentId}/${sessionId}/pdf`, {
            responseType: 'blob'
        })
        return res.data
    },

    startFinalBulkDownload: async (sectionId, sessionId) => {
        const res = await api.post('/report-cards/final/bulk-download', {
            sectionId,
            sessionId
        })
        return res.data
    },

    // ── Custom / Manual Report Card ──
    generateCustomReportCardPDF: async (payload) => {
        const res = await api.post('/report-cards/custom/pdf', payload, {
            responseType: 'blob'
        })
        return res.data
    },

    // ── Custom Report Card History ──
    getCustomReportCardHistory: async (params = {}) => {
        const qs = new URLSearchParams()
        if (params.page) qs.append('page', params.page)
        if (params.limit) qs.append('limit', params.limit)
        if (params.search) qs.append('search', params.search)
        const res = await api.get(`/report-cards/custom/history?${qs.toString()}`)
        return res.data
    },

    downloadCustomReportCard: async (id) => {
        const res = await api.get(`/report-cards/custom/${id}/download`, { responseType: 'blob' })
        return res.data
    },

    getCustomReportCardPayload: async (id) => {
        const res = await api.get(`/report-cards/custom/${id}/payload`)
        return res.data
    },

    deleteCustomReportCard: async (id) => {
        const res = await api.delete(`/report-cards/custom/${id}`)
        return res.data
    }
}
