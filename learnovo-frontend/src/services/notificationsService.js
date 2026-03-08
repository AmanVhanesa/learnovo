import api from './authService';

/**
 * Notifications Service
 * API client for notification operations
 */

const notificationsService = {
    /**
     * Get notifications with filtering and pagination
     */
    async getNotifications({ page = 1, limit = 20, isRead = 'all', category = null, startDate = null, endDate = null } = {}) {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString()
            });

            if (isRead !== 'all') {
                params.append('isRead', isRead.toString());
            }

            if (category) {
                params.append('category', category);
            }

            if (startDate) {
                params.append('startDate', startDate);
            }

            if (endDate) {
                params.append('endDate', endDate);
            }

            const response = await api.get(`/notifications?${params.toString()}`);
            return response.data;
        } catch (error) {
            console.error('Get notifications error:', error);
            throw error;
        }
    },

    /**
     * Get unread notification count
     */
    async getUnreadCount() {
        try {
            const response = await api.get('/notifications/unread-count');
            return response.data;
        } catch (error) {
            console.error('Get unread count error:', error);
            throw error;
        }
    },

    /**
     * Get single notification by ID
     */
    async getNotification(notificationId) {
        try {
            const response = await api.get(`/notifications/${notificationId}`);
            return response.data;
        } catch (error) {
            console.error('Get notification error:', error);
            throw error;
        }
    },

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId) {
        try {
            const response = await api.patch(`/notifications/${notificationId}/read`);
            return response.data;
        } catch (error) {
            console.error('Mark as read error:', error);
            throw error;
        }
    },

    /**
     * Mark notification as unread
     */
    async markAsUnread(notificationId) {
        try {
            const response = await api.patch(`/notifications/${notificationId}/unread`);
            return response.data;
        } catch (error) {
            console.error('Mark as unread error:', error);
            throw error;
        }
    },

    /**
     * Mark all notifications as read
     */
    async markAllAsRead() {
        try {
            const response = await api.patch('/notifications/mark-all-read');
            return response.data;
        } catch (error) {
            console.error('Mark all as read error:', error);
            throw error;
        }
    },

    /**
     * Delete notification (soft delete)
     */
    async deleteNotification(notificationId) {
        try {
            const response = await api.delete(`/notifications/${notificationId}`);
            return response.data;
        } catch (error) {
            console.error('Delete notification error:', error);
            throw error;
        }
    },

    /**
     * Bulk delete notifications
     */
    async bulkDelete(notificationIds) {
        try {
            const response = await api.delete('/notifications/bulk', {
                data: { notificationIds }
            });
            return response.data;
        } catch (error) {
            console.error('Bulk delete error:', error);
            throw error;
        }
    },

    /**
     * Get user notification preferences
     */
    async getPreferences() {
        try {
            const response = await api.get('/notifications/preferences');
            return response.data;
        } catch (error) {
            console.error('Get preferences error:', error);
            throw error;
        }
    },

    /**
     * Update user notification preferences
     */
    async updatePreferences(preferences) {
        try {
            const response = await api.put('/notifications/preferences', { preferences });
            return response.data;
        } catch (error) {
            console.error('Update preferences error:', error);
            throw error;
        }
    }
};

export default notificationsService;
