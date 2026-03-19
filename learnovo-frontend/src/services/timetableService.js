import api from './authService'

export const timetableService = {
  // ── Templates ───────────────────────────────────────────────
  getTemplates: async (params = {}) => {
    try {
      const response = await api.get('/timetable/templates', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getTemplate: async (id) => {
    try {
      const response = await api.get(`/timetable/templates/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  createTemplate: async (data) => {
    try {
      const response = await api.post('/timetable/templates', data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  updateTemplate: async (id, data) => {
    try {
      const response = await api.put(`/timetable/templates/${id}`, data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  deleteTemplate: async (id) => {
    try {
      const response = await api.delete(`/timetable/templates/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  publishTemplate: async (id) => {
    try {
      const response = await api.post(`/timetable/templates/${id}/publish`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  archiveTemplate: async (id) => {
    try {
      const response = await api.post(`/timetable/templates/${id}/archive`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  duplicateTemplate: async (id, data = {}) => {
    try {
      const response = await api.post(`/timetable/templates/${id}/duplicate`, data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Timings (Bell Schedule) ─────────────────────────────────
  getTimings: async (templateId) => {
    try {
      const response = await api.get(`/timetable/templates/${templateId}/timings`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  bulkSetTimings: async (templateId, timings) => {
    try {
      const response = await api.post(`/timetable/templates/${templateId}/timings`, { timings })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  updateTiming: async (templateId, slotId, data) => {
    try {
      const response = await api.put(`/timetable/templates/${templateId}/timings/${slotId}`, data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  deleteTiming: async (templateId, slotId) => {
    try {
      const response = await api.delete(`/timetable/templates/${templateId}/timings/${slotId}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Allocations ─────────────────────────────────────────────
  getAllocations: async (templateId, params = {}) => {
    try {
      const response = await api.get(`/timetable/templates/${templateId}/allocations`, { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  createAllocation: async (templateId, data) => {
    try {
      const response = await api.post(`/timetable/templates/${templateId}/allocations`, data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  updateAllocation: async (templateId, allocId, data) => {
    try {
      const response = await api.put(`/timetable/templates/${templateId}/allocations/${allocId}`, data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  deleteAllocation: async (templateId, allocId) => {
    try {
      const response = await api.delete(`/timetable/templates/${templateId}/allocations/${allocId}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Entries ─────────────────────────────────────────────────
  getEntries: async (templateId, params = {}) => {
    try {
      const response = await api.get(`/timetable/templates/${templateId}/entries`, { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  createEntry: async (templateId, data) => {
    try {
      const response = await api.post(`/timetable/templates/${templateId}/entries`, data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  updateEntry: async (templateId, entryId, data) => {
    try {
      const response = await api.put(`/timetable/templates/${templateId}/entries/${entryId}`, data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  deleteEntry: async (templateId, entryId) => {
    try {
      const response = await api.delete(`/timetable/templates/${templateId}/entries/${entryId}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  bulkCreateEntries: async (templateId, entries) => {
    try {
      const response = await api.post(`/timetable/templates/${templateId}/entries/bulk`, { entries })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  generateTimetable: async (templateId, options = {}) => {
    try {
      const response = await api.post(`/timetable/templates/${templateId}/entries/generate`, options)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  clearEntries: async (templateId) => {
    try {
      const response = await api.delete(`/timetable/templates/${templateId}/entries/clear`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  lockEntry: async (templateId, entryId) => {
    try {
      const response = await api.post(`/timetable/templates/${templateId}/entries/${entryId}/lock`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  unlockEntry: async (templateId, entryId) => {
    try {
      const response = await api.post(`/timetable/templates/${templateId}/entries/${entryId}/unlock`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Constraints ─────────────────────────────────────────────
  getConstraints: async (templateId, params = {}) => {
    try {
      const response = await api.get(`/timetable/templates/${templateId}/constraints`, { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  createConstraint: async (templateId, data) => {
    try {
      const response = await api.post(`/timetable/templates/${templateId}/constraints`, data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  deleteConstraint: async (templateId, constraintId) => {
    try {
      const response = await api.delete(`/timetable/templates/${templateId}/constraints/${constraintId}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Rooms ───────────────────────────────────────────────────
  getRooms: async (params = {}) => {
    try {
      const response = await api.get('/timetable/rooms', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  createRoom: async (data) => {
    try {
      const response = await api.post('/timetable/rooms', data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  updateRoom: async (id, data) => {
    try {
      const response = await api.put(`/timetable/rooms/${id}`, data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  deleteRoom: async (id) => {
    try {
      const response = await api.delete(`/timetable/rooms/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Substitutions ───────────────────────────────────────────
  getSubstitutions: async (params = {}) => {
    try {
      const response = await api.get('/timetable/substitutions', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  createSubstitution: async (data) => {
    try {
      const response = await api.post('/timetable/substitutions', data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  updateSubstitution: async (id, data) => {
    try {
      const response = await api.put(`/timetable/substitutions/${id}`, data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  cancelSubstitution: async (id) => {
    try {
      const response = await api.delete(`/timetable/substitutions/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getSubstitutionSuggestions: async (entryId, params = {}) => {
    try {
      const response = await api.get(`/timetable/substitutions/suggestions/${entryId}`, { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  bulkCreateSubstitutions: async (data) => {
    try {
      const response = await api.post('/timetable/substitutions/bulk', data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Overrides ───────────────────────────────────────────────
  getOverrides: async (params = {}) => {
    try {
      const response = await api.get('/timetable/overrides', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  createOverride: async (data) => {
    try {
      const response = await api.post('/timetable/overrides', data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  updateOverride: async (id, data) => {
    try {
      const response = await api.put(`/timetable/overrides/${id}`, data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  deleteOverride: async (id) => {
    try {
      const response = await api.delete(`/timetable/overrides/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getOverrideCalendar: async (params = {}) => {
    try {
      const response = await api.get('/timetable/overrides/calendar', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Views ───────────────────────────────────────────────────
  getTodaySchedule: async (params = {}) => {
    try {
      const response = await api.get('/timetable/view/today', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getWeekSchedule: async (params = {}) => {
    try {
      const queryParams = { ...params }
      if (queryParams.weekStart) { queryParams.date = queryParams.weekStart; delete queryParams.weekStart }
      const response = await api.get('/timetable/view/week', { params: queryParams })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getClassSchedule: async (classId, params = {}) => {
    try {
      const queryParams = { ...params }
      if (queryParams.weekStart) { queryParams.date = queryParams.weekStart; delete queryParams.weekStart }
      const response = await api.get(`/timetable/view/class/${classId}`, { params: queryParams })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getTeacherSchedule: async (teacherId, params = {}) => {
    try {
      const queryParams = { ...params }
      if (queryParams.weekStart) { queryParams.date = queryParams.weekStart; delete queryParams.weekStart }
      const response = await api.get(`/timetable/view/teacher/${teacherId}`, { params: queryParams })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getRoomSchedule: async (roomId, params = {}) => {
    try {
      const queryParams = { ...params }
      if (queryParams.weekStart) { queryParams.date = queryParams.weekStart; delete queryParams.weekStart }
      const response = await api.get(`/timetable/view/room/${roomId}`, { params: queryParams })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  exportPDF: async (params = {}) => {
    try {
      const response = await api.get('/timetable/view/export/pdf', {
        params,
        responseType: 'blob'
      })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  exportExcel: async (params = {}) => {
    try {
      const response = await api.get('/timetable/view/export/excel', {
        params,
        responseType: 'blob'
      })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }
}

export default timetableService
