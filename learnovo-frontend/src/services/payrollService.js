import api from './authService';

const payrollService = {
    /**
     * Get all payroll records with filters
     */
    getPayrollRecords: async (filters = {}) => {
        try {
            const params = new URLSearchParams();
            if (filters.page) params.append('page', filters.page);
            if (filters.limit) params.append('limit', filters.limit);
            if (filters.month) params.append('month', filters.month);
            if (filters.year) params.append('year', filters.year);
            if (filters.employeeId) params.append('employeeId', filters.employeeId);
            if (filters.status) params.append('status', filters.status);

            const response = await api.get(`/payroll?${params.toString()}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Get single payroll record
     */
    getPayrollRecord: async (id) => {
        try {
            const response = await api.get(`/payroll/${id}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Generate monthly payroll
     */
    generateMonthlyPayroll: async (data) => {
        try {
            const response = await api.post(`/payroll/generate`, data);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Update payroll record
     */
    updatePayrollRecord: async (id, data) => {
        try {
            const response = await api.put(`/payroll/${id}`, data);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Delete payroll record
     */
    deletePayrollRecord: async (id) => {
        try {
            const response = await api.delete(`/payroll/${id}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Get employee payroll history
     */
    getEmployeePayrollHistory: async (employeeId, year = null) => {
        try {
            const params = year ? `?year=${year}` : '';
            const response = await api.get(`/payroll/employee/${employeeId}${params}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Get salary summary for a period
     */
    getSalarySummary: async (year, month) => {
        try {
            const response = await api.get(`/payroll/summary/${year}/${month}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Download salary slip PDF
     */
    downloadSalarySlip: async (id) => {
        try {
            const response = await api.get(`/payroll/pdf/slip/${id}`, {
                responseType: 'blob'
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Download monthly report PDF
     */
    downloadMonthlyReport: async (year, month) => {
        try {
            const response = await api.get(`/payroll/pdf/monthly/${year}/${month}`, {
                responseType: 'blob'
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Download yearly report PDF
     */
    downloadYearlyReport: async (employeeId, year) => {
        try {
            const response = await api.get(`/payroll/pdf/yearly/${employeeId}/${year}`, {
                responseType: 'blob'
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    // ============================================================================
    // ADVANCE SALARY METHODS
    // ============================================================================

    /**
     * Get all advance salary requests
     */
    getAdvanceRequests: async (filters = {}) => {
        try {
            const params = new URLSearchParams();
            if (filters.page) params.append('page', filters.page);
            if (filters.limit) params.append('limit', filters.limit);
            if (filters.status) params.append('status', filters.status);
            if (filters.deductionStatus) params.append('deductionStatus', filters.deductionStatus);
            if (filters.employeeId) params.append('employeeId', filters.employeeId);

            const response = await api.get(`/advance-salary?${params.toString()}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Get single advance request
     */
    getAdvanceRequest: async (id) => {
        try {
            const response = await api.get(`/advance-salary/${id}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Create advance salary request
     */
    createAdvanceRequest: async (data) => {
        try {
            const response = await api.post(`/advance-salary`, data);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Approve advance request
     */
    approveAdvanceRequest: async (id) => {
        try {
            const response = await api.put(`/advance-salary/${id}/approve`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Reject advance request
     */
    rejectAdvanceRequest: async (id, rejectionReason) => {
        try {
            const response = await api.put(`/advance-salary/${id}/reject`, {
                rejectionReason
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Get employee advance history
     */
    getEmployeeAdvanceHistory: async (employeeId) => {
        try {
            const response = await api.get(`/advance-salary/employee/${employeeId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    /**
     * Get advance salary statistics
     */
    getAdvanceStats: async () => {
        try {
            const response = await api.get(`/advance-salary/stats/summary`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    }
};

export default payrollService;
