import api from './authService'

// Academic Sessions
export const academicSessionsService = {
    list: async () => {
        const res = await api.get('/academic-sessions')
        return res.data
    },

    getActive: async () => {
        const res = await api.get('/academic-sessions/active')
        return res.data
    },

    get: async (id) => {
        const res = await api.get(`/academic-sessions/${id}`)
        return res.data
    },

    create: async (data) => {
        const res = await api.post('/academic-sessions', data)
        return res.data
    },

    update: async (id, data) => {
        const res = await api.put(`/academic-sessions/${id}`, data)
        return res.data
    },

    activate: async (id) => {
        const res = await api.put(`/academic-sessions/${id}/activate`)
        return res.data
    },

    lock: async (id, lock) => {
        const res = await api.put(`/academic-sessions/${id}/lock`, { lock })
        return res.data
    },

    remove: async (id) => {
        const res = await api.delete(`/academic-sessions/${id}`)
        return res.data
    }
}

// Class-Subject Assignments
export const classSubjectsService = {
    list: async (filters = {}) => {
        const params = new URLSearchParams()
        if (filters.classId) params.append('classId', filters.classId)
        if (filters.subjectId) params.append('subjectId', filters.subjectId)
        if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)

        const url = `/class-subjects${params.toString() ? `?${params.toString()}` : ''}`
        const res = await api.get(url)
        return res.data
    },

    assign: async (data) => {
        const res = await api.post('/class-subjects', data)
        return res.data
    },

    bulkAssign: async (data) => {
        const res = await api.post('/class-subjects/bulk', data)
        return res.data
    },

    update: async (id, data) => {
        const res = await api.put(`/class-subjects/${id}`, data)
        return res.data
    },

    remove: async (id) => {
        const res = await api.delete(`/class-subjects/${id}`)
        return res.data
    }
}

// Teacher-Subject Assignments
export const teacherAssignmentsService = {
    list: async (filters = {}) => {
        const params = new URLSearchParams()
        if (filters.teacherId) params.append('teacherId', filters.teacherId)
        if (filters.classId) params.append('classId', filters.classId)
        if (filters.subjectId) params.append('subjectId', filters.subjectId)
        if (filters.academicSessionId) params.append('academicSessionId', filters.academicSessionId)

        const url = `/teacher-assignments${params.toString() ? `?${params.toString()}` : ''}`
        const res = await api.get(url)
        return res.data
    },

    getTeacherAssignments: async (teacherId) => {
        const res = await api.get(`/teacher-assignments/teacher/${teacherId}`)
        return res.data
    },

    assign: async (data) => {
        const res = await api.post('/teacher-assignments', data)
        return res.data
    },

    update: async (id, data) => {
        const res = await api.put(`/teacher-assignments/${id}`, data)
        return res.data
    },

    remove: async (id) => {
        const res = await api.delete(`/teacher-assignments/${id}`)
        return res.data
    }
}

// Classes
export const classesService = {
    list: async (filters = {}) => {
        const params = new URLSearchParams()
        if (filters.academicYear) params.append('academicYear', filters.academicYear)
        if (filters.grade) params.append('grade', filters.grade)

        const url = `/classes${params.toString() ? `?${params.toString()}` : ''}`
        const res = await api.get(url)
        return res.data
    },

    get: async (id) => {
        const res = await api.get(`/classes/${id}`)
        return res.data
    },

    create: async (data) => {
        const res = await api.post('/classes', data)
        return res.data
    },

    update: async (id, data) => {
        const res = await api.put(`/classes/${id}`, data)
        return res.data
    },

    remove: async (id) => {
        const res = await api.delete(`/classes/${id}`)
        return res.data
    }
}

// Subjects
export const subjectsService = {
    list: async (filters = {}) => {
        const params = new URLSearchParams()
        if (filters.isActive !== undefined) params.append('isActive', filters.isActive)

        const url = `/subjects${params.toString() ? `?${params.toString()}` : ''}`
        const res = await api.get(url)
        return res.data
    },

    get: async (id) => {
        const res = await api.get(`/subjects/${id}`)
        return res.data
    },

    create: async (data) => {
        const res = await api.post('/subjects', data)
        return res.data
    },

    update: async (id, data) => {
        const res = await api.put(`/subjects/${id}`, data)
        return res.data
    },

    remove: async (id) => {
        const res = await api.delete(`/subjects/${id}`)
        return res.data
    },

    toggle: async (id) => {
        const res = await api.patch(`/subjects/${id}/toggle`)
        return res.data
    }
}

export default {
    academicSessions: academicSessionsService,
    classSubjects: classSubjectsService,
    teacherAssignments: teacherAssignmentsService,
    classes: classesService,
    subjects: subjectsService
}
