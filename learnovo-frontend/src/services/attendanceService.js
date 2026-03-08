import api from './authService'

export const attendanceService = {
  // Get teacher's assigned classes
  getTeacherClasses: async () => {
    try {
      const response = await api.get('/teachers/my-classes')
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Get attendance for a specific date and class
  getAttendance: async (params) => {
    try {
      const response = await api.get('/attendance', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Save attendance
  saveAttendance: async (attendanceData) => {
    try {
      const response = await api.post('/attendance', attendanceData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Get attendance report
  getAttendanceReport: async (filters) => {
    try {
      const response = await api.get('/attendance/report', {
        params: filters
      })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  },

  // Get students for a class by class ID
  getStudentsByClass: async (classId) => {
    try {
      const response = await api.get(`/attendance/students/${classId}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }
}

export default attendanceService
