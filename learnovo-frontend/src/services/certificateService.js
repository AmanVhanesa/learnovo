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

    generateCertificate: async (studentId, type, specificData, autoDeactivate = false, categoryOverride, classOverride, penOverride, feesSkipped, cancelInvoices = false) => {
        // Response type blob for file download
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_URL}/certificates/generate`,
            { studentId, type, specificData, autoDeactivate, categoryOverride, classOverride, penOverride, feesSkipped, cancelInvoices },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                responseType: 'blob',
                // Treat 409 (duplicate cert) as a resolved response so we can parse the JSON body
                validateStatus: (status) => (status >= 200 && status < 300) || status === 409
            }
        );

        // If server returned 409 (certificate already exists), parse the JSON blob and throw
        if (response.status === 409) {
            let message = 'Certificate has already been generated for this student.';
            try {
                const text = await response.data.text();
                const parsed = JSON.parse(text);
                message = parsed.message || message;
            } catch { /* use default */ }
            const err = new Error(message);
            err.response = { status: 409, data: { message } };
            throw err;
        }

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

        const blob = response.data;

        // Guard: if the server returned a JSON error wrapped as blob, throw it
        if (blob.type && blob.type.includes('application/json')) {
            const text = await blob.text();
            const err = JSON.parse(text);
            throw new Error(err.message || 'Download failed');
        }

        // Trigger file download
        const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename || 'certificate.pdf');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
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
