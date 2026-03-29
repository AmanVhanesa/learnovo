import api from './authService'

export const attendanceService = {
  // ── Dashboard ──────────────────────────────────────────────────────
  getDashboard: async () => {
    try {
      const response = await api.get('/attendance/dashboard')
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Student Attendance ─────────────────────────────────────────────
  getTeacherClasses: async () => {
    try {
      const response = await api.get('/teachers/my-classes')
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getAllClasses: async () => {
    try {
      const response = await api.get('/classes')
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getAttendance: async (params) => {
    try {
      const response = await api.get('/attendance', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  saveAttendance: async (attendanceData) => {
    try {
      const response = await api.post('/attendance', attendanceData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getAttendanceReport: async (filters) => {
    try {
      const response = await api.get('/attendance/report', { params: filters })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getStudentsByClass: async (classId, sectionId) => {
    try {
      const params = sectionId ? { sectionId } : {}
      const response = await api.get(`/attendance/students-list/${classId}`, { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getDailySummary: async (date) => {
    try {
      const response = await api.get('/attendance/students/daily-summary', { params: { date } })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getUnmarkedClasses: async () => {
    try {
      const response = await api.get('/attendance/students/unmarked-classes')
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getAbsentees: async (date, classId) => {
    try {
      const params = { date }
      if (classId) params.classId = classId
      const response = await api.get('/attendance/students/absentees', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getStudentAttendance: async (studentId, params) => {
    try {
      const response = await api.get(`/attendance/students/${studentId}`, { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getStudentSummary: async (studentId, params) => {
    try {
      const response = await api.get(`/attendance/students/${studentId}/summary`, { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getMonthlyReport: async (classId, month, year) => {
    try {
      const response = await api.get('/attendance/students/monthly-report', {
        params: { classId, month, year }
      })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  exportAttendance: async (classId, month, year) => {
    try {
      const response = await api.get('/attendance/students/export', {
        params: { classId, month, year },
        responseType: 'blob'
      })
      return response
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Employee Attendance ────────────────────────────────────────────
  getEmployees: async (date, department) => {
    try {
      const params = { date }
      if (department) params.department = department
      const response = await api.get('/attendance/employees', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  markEmployeeAttendance: async (data) => {
    try {
      const response = await api.post('/attendance/employees/mark', data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getEmployeeDailySummary: async (date) => {
    try {
      const response = await api.get('/attendance/employees/daily-summary', { params: { date } })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getEmployeeAttendance: async (employeeId, params) => {
    try {
      const response = await api.get(`/attendance/employees/${employeeId}`, { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  getEmployeeSummary: async (employeeId, params) => {
    try {
      const response = await api.get(`/attendance/employees/${employeeId}/summary`, { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Settings ───────────────────────────────────────────────────────
  getSettings: async () => {
    try {
      const response = await api.get('/attendance/settings')
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  updateSettings: async (data) => {
    try {
      const response = await api.put('/attendance/settings', data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Holidays ───────────────────────────────────────────────────────
  getHolidays: async (year) => {
    try {
      const params = year ? { year } : {}
      const response = await api.get('/attendance/holidays', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  addHoliday: async (data) => {
    try {
      const response = await api.post('/attendance/holidays', data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  updateHoliday: async (id, data) => {
    try {
      const response = await api.put(`/attendance/holidays/${id}`, data)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  deleteHoliday: async (id) => {
    try {
      const response = await api.delete(`/attendance/holidays/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // ── Analytics ──────────────────────────────────────────────────────
  getAnalytics: async (params) => {
    try {
      const response = await api.get('/attendance/analytics', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }
}

export default attendanceService
