import api from './authService';

class HomeworkService {
    /**
     * Create new homework
     */
    async createHomework(data) {
        const response = await api.post('/homework', data);
        return response.data;
    }

    /**
     * Get homework list
     */
    async getHomeworkList(filters = {}) {
        const params = new URLSearchParams();

        if (filters.subject) params.append('subject', filters.subject);
        if (filters.class) params.append('class', filters.class);
        if (filters.section) params.append('section', filters.section);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);

        const response = await api.get(`/homework?${params.toString()}`);
        return response.data;
    }

    /**
     * Get homework by ID
     */
    async getHomeworkById(id) {
        const response = await api.get(`/homework/${id}`);
        return response.data;
    }

    /**
     * Update homework
     */
    async updateHomework(id, data) {
        const response = await api.put(`/homework/${id}`, data);
        return response.data;
    }

    /**
     * Delete homework
     */
    async deleteHomework(id) {
        const response = await api.delete(`/homework/${id}`);
        return response.data;
    }

    /**
     * Submit homework (student)
     */
    async submitHomework(homeworkId, data) {
        const response = await api.post(`/homework/${homeworkId}/submit`, data);
        return response.data;
    }

    /**
     * Get submissions for homework (teacher)
     */
    async getSubmissions(homeworkId) {
        const response = await api.get(`/homework/${homeworkId}/submissions`);
        return response.data;
    }

    /**
     * Update submission feedback (teacher)
     */
    async updateSubmissionFeedback(submissionId, feedbackData) {
        const response = await api.put(`/homework/submissions/${submissionId}`, feedbackData);
        return response.data;
    }

    /**
     * Get student's submissions
     */
    async getMySubmissions(filters = {}) {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);

        const response = await api.get(`/homework/my-submissions?${params.toString()}`);
        return response.data;
    }

    /**
     * Get homework statistics
     */
    async getHomeworkStats() {
        const response = await api.get('/homework/stats');
        return response.data;
    }

    /**
     * Convert file to base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    /**
     * Process file uploads
     */
    async processFileUploads(files) {
        const attachments = [];

        for (const file of files) {
            try {
                const base64 = await this.fileToBase64(file);
                attachments.push({
                    fileName: file.name,
                    fileUrl: base64,
                    fileType: file.type,
                    fileSize: file.size
                });
            } catch (error) {
                console.error('Error processing file:', error);
                throw new Error(`Failed to process file: ${file.name}`);
            }
        }

        return attachments;
    }
}

export default new HomeworkService();
