import api from './authService';

/**
 * Announcements Service
 * API client for announcement-related operations
 */

const announcementsService = {
    /**
     * Get all announcements
     */
    getAnnouncements: async (params = {}) => {
        const response = await api.get('/announcements', { params });
        return response.data;
    },

    /**
     * Get single announcement
     */
    getAnnouncement: async (id) => {
        const response = await api.get(`/announcements/${id}`);
        return response.data;
    },

    /**
     * Create new announcement
     */
    createAnnouncement: async (announcementData) => {
        const response = await api.post('/announcements', announcementData);
        return response.data;
    },

    /**
     * Update announcement
     */
    updateAnnouncement: async (id, updates) => {
        const response = await api.put(`/announcements/${id}`, updates);
        return response.data;
    },

    /**
     * Delete announcement
     */
    deleteAnnouncement: async (id) => {
        const response = await api.delete(`/announcements/${id}`);
        return response.data;
    }
};

export default announcementsService;
