import api from './authService';

export const studentListService = {
    // Get all lists
    getAll: async () => {
        const res = await api.get('/student-lists');
        return res.data;
    },

    // Get a single list by ID
    getById: async (id) => {
        const res = await api.get(`/student-lists/${id}`);
        return res.data;
    },

    // Create a new list
    create: async (data) => {
        const res = await api.post('/student-lists', data);
        return res.data;
    },

    // Add students to a list
    addStudents: async (id, admissionNumbers) => {
        const res = await api.patch(`/student-lists/${id}/add-students`, { admissionNumbers });
        return res.data;
    },

    // Remove a student from a list
    removeStudent: async (listId, studentId) => {
        const res = await api.patch(`/student-lists/${listId}/remove-student/${studentId}`);
        return res.data;
    },

    // Delete a list
    delete: async (id) => {
        const res = await api.delete(`/student-lists/${id}`);
        return res.data;
    },

    // For file downloads requiring auth headers
    downloadExport: async (id, format) => {
        const res = await api.get(`/student-lists/${id}/export/${format}`, {
            responseType: 'blob'
        });
        return res; // Return full response to access headers and data
    }
};

export default studentListService;
