import api from './authService'

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v))
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const activityProgramsService = {
  // ── Programs ─────────────────────────────────────────────────────────
  list: async (filters = {}) => {
    const res = await api.get(`/activity-programs${buildQuery(filters)}`)
    return res.data
  },
  get: async (id) => {
    const res = await api.get(`/activity-programs/${id}`)
    return res.data
  },
  create: async (payload) => {
    const res = await api.post('/activity-programs', payload)
    return res.data
  },
  update: async (id, payload) => {
    const res = await api.put(`/activity-programs/${id}`, payload)
    return res.data
  },
  toggle: async (id) => {
    const res = await api.patch(`/activity-programs/${id}/toggle`)
    return res.data
  },
  remove: async (id) => {
    const res = await api.delete(`/activity-programs/${id}`)
    return res.data
  },
  uploadPhoto: async (id, file) => {
    const formData = new FormData()
    formData.append('photo', file)
    const res = await api.post(`/activity-programs/${id}/photo`, formData)
    return res.data
  },

  // ── Enrollments scoped to a program ──────────────────────────────────
  listEnrollments: async (programId, filters = {}) => {
    const res = await api.get(`/activity-programs/${programId}/enrollments${buildQuery(filters)}`)
    return res.data
  },
  enrollStudents: async (programId, payload) => {
    const res = await api.post(`/activity-programs/${programId}/enrollments`, payload)
    return res.data
  }
}

export const activityEnrollmentsService = {
  list: async (filters = {}) => {
    const res = await api.get(`/activity-enrollments${buildQuery(filters)}`)
    return res.data
  },
  mine: async (filters = {}) => {
    const res = await api.get(`/activity-enrollments/me${buildQuery(filters)}`)
    return res.data
  },
  get: async (id) => {
    const res = await api.get(`/activity-enrollments/${id}`)
    return res.data
  },
  update: async (id, payload) => {
    const res = await api.put(`/activity-enrollments/${id}`, payload)
    return res.data
  },
  pause: async (id, payload = {}) => {
    const res = await api.put(`/activity-enrollments/${id}/pause`, payload)
    return res.data
  },
  resume: async (id) => {
    const res = await api.put(`/activity-enrollments/${id}/resume`)
    return res.data
  },
  withdraw: async (id, payload) => {
    const res = await api.post(`/activity-enrollments/${id}/withdraw`, payload)
    return res.data
  },
  outstanding: async (id) => {
    const res = await api.get(`/activity-enrollments/${id}/outstanding`)
    return res.data
  }
}

export const activityInvoicesService = {
  preview: async (payload) => {
    const res = await api.post('/activity-invoices/preview', payload)
    return res.data
  },
  generate: async (payload) => {
    const res = await api.post('/activity-invoices/generate', payload)
    return res.data
  }
}

export default activityProgramsService
