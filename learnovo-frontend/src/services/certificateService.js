import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance with token
const getAxiosInstance = () => {
    const token = localStorage.getItem('token');
    return axios.create({
        baseURL: API_URL,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        }
    });
};

const certificateService = {
    // Templates
    getTemplates: async () => {
        const response = await getAxiosInstance().get('/certificates/templates');
        return response.data;
    },

    saveTemplate: async (data) => {
        const response = await getAxiosInstance().post('/certificates/templates', data);
        return response.data;
    },

    // Generation
    previewCertificate: async (studentId, type) => {
        const response = await getAxiosInstance().post('/certificates/preview', { studentId, type });
        return response.data;
    },

    generateCertificate: async (studentId, type, specificData, autoDeactivate = false) => {
        // Response type blob for file download
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_URL}/certificates/generate`,
            { studentId, type, specificData, autoDeactivate },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                responseType: 'blob'
            }
        );
        return response;
    },

    // History
    getHistory: async () => {
        const response = await getAxiosInstance().get('/certificates/history');
        return response.data;
    },

    downloadCertificate: async (id, filename) => {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/certificates/${id}/download`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
        });

        // Helper to trigger download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename || 'certificate.pdf'); // filename usually from Content-Disposition
        document.body.appendChild(link);
        link.click();
        link.remove();
        return response;
    },

    deleteCertificate: async (id) => {
        const response = await getAxiosInstance().delete(`/certificates/${id}`);
        return response.data;
    },

    updateCertificate: async (id, data) => {
        const response = await getAxiosInstance().put(`/certificates/${id}`, data);
        return response.data;
    }
};

export default certificateService;
