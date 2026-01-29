import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Get auth token
const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// ============================================================================
// DRIVERS
// ============================================================================

export const getDrivers = async (params = {}) => {
    const response = await axios.get(`${API_URL}/drivers`, {
        headers: getAuthHeader(),
        params
    });
    return response.data;
};

export const getDriver = async (id) => {
    const response = await axios.get(`${API_URL}/drivers/${id}`, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const createDriver = async (driverData) => {
    const response = await axios.post(`${API_URL}/drivers`, driverData, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const updateDriver = async (id, driverData) => {
    const response = await axios.put(`${API_URL}/drivers/${id}`, driverData, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const deleteDriver = async (id, reason) => {
    const response = await axios.delete(`${API_URL}/drivers/${id}`, {
        headers: getAuthHeader(),
        data: { reason }
    });
    return response.data;
};

export const toggleDriverStatus = async (id, reason) => {
    const response = await axios.put(`${API_URL}/drivers/${id}/toggle-status`,
        { reason },
        { headers: getAuthHeader() }
    );
    return response.data;
};

export const getExpiringLicenses = async (days = 30) => {
    const response = await axios.get(`${API_URL}/drivers/expiring/licenses`, {
        headers: getAuthHeader(),
        params: { days }
    });
    return response.data;
};

export const exportDrivers = async (params = {}) => {
    const response = await axios.get(`${API_URL}/drivers/export`, {
        headers: getAuthHeader(),
        params,
        responseType: 'blob'
    });
    return response.data;
};

// ============================================================================
// VEHICLES
// ============================================================================

export const getVehicles = async (params = {}) => {
    const response = await axios.get(`${API_URL}/vehicles`, {
        headers: getAuthHeader(),
        params
    });
    return response.data;
};

export const getVehicle = async (id) => {
    const response = await axios.get(`${API_URL}/vehicles/${id}`, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const createVehicle = async (vehicleData) => {
    const response = await axios.post(`${API_URL}/vehicles`, vehicleData, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const updateVehicle = async (id, vehicleData) => {
    const response = await axios.put(`${API_URL}/vehicles/${id}`, vehicleData, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const assignDriverToVehicle = async (vehicleId, driverId) => {
    const response = await axios.put(
        `${API_URL}/vehicles/${vehicleId}/assign-driver`,
        { driverId },
        { headers: getAuthHeader() }
    );
    return response.data;
};

export const deleteVehicle = async (id, reason) => {
    const response = await axios.delete(`${API_URL}/vehicles/${id}`, {
        headers: getAuthHeader(),
        data: { reason }
    });
    return response.data;
};

export const exportVehicles = async (params = {}) => {
    const response = await axios.get(`${API_URL}/vehicles/export`, {
        headers: getAuthHeader(),
        params,
        responseType: 'blob'
    });
    return response.data;
};

// ============================================================================
// ROUTES
// ============================================================================

export const getRoutes = async (params = {}) => {
    const response = await axios.get(`${API_URL}/transport/routes`, {
        headers: getAuthHeader(),
        params
    });
    return response.data;
};

export const getRoute = async (id) => {
    const response = await axios.get(`${API_URL}/transport/routes/${id}`, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const createRoute = async (routeData) => {
    const response = await axios.post(`${API_URL}/transport/routes`, routeData, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const updateRoute = async (id, routeData) => {
    const response = await axios.put(`${API_URL}/transport/routes/${id}`, routeData, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const assignVehicleToRoute = async (routeId, vehicleId) => {
    const response = await axios.put(
        `${API_URL}/transport/routes/${routeId}/assign-vehicle`,
        { vehicleId },
        { headers: getAuthHeader() }
    );
    return response.data;
};

export const assignDriverToRoute = async (routeId, driverId) => {
    const response = await axios.put(
        `${API_URL}/transport/routes/${routeId}/assign-driver`,
        { driverId },
        { headers: getAuthHeader() }
    );
    return response.data;
};

export const getRouteStudents = async (routeId) => {
    const response = await axios.get(`${API_URL}/transport/routes/${routeId}/students`, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const deleteRoute = async (id, reason) => {
    const response = await axios.delete(`${API_URL}/transport/routes/${id}`, {
        headers: getAuthHeader(),
        data: { reason }
    });
    return response.data;
};

export const exportRoutes = async (params = {}) => {
    const response = await axios.get(`${API_URL}/transport/routes/export`, {
        headers: getAuthHeader(),
        params,
        responseType: 'blob'
    });
    return response.data;
};

// ============================================================================
// STUDENT TRANSPORT ASSIGNMENTS
// ============================================================================

export const getStudentTransportAssignments = async (params = {}) => {
    const response = await axios.get(`${API_URL}/student-transport`, {
        headers: getAuthHeader(),
        params
    });
    return response.data;
};

export const getStudentTransport = async (studentId) => {
    const response = await axios.get(`${API_URL}/student-transport/student/${studentId}`, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const getRouteAssignments = async (routeId) => {
    const response = await axios.get(`${API_URL}/student-transport/route/${routeId}`, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const assignStudentToRoute = async (assignmentData) => {
    const response = await axios.post(`${API_URL}/student-transport`, assignmentData, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const updateStudentTransportAssignment = async (id, assignmentData) => {
    const response = await axios.put(`${API_URL}/student-transport/${id}`, assignmentData, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const deactivateStudentTransportAssignment = async (id, reason) => {
    const response = await axios.delete(`${API_URL}/student-transport/${id}`, {
        headers: getAuthHeader(),
        data: { reason }
    });
    return response.data;
};

export const bulkAssignStudents = async (assignmentData) => {
    const response = await axios.post(`${API_URL}/student-transport/bulk-assign`, assignmentData, {
        headers: getAuthHeader()
    });
    return response.data;
};

export const exportStudentTransportAssignments = async (params = {}) => {
    const response = await axios.get(`${API_URL}/student-transport/export`, {
        headers: getAuthHeader(),
        params,
        responseType: 'blob'
    });
    return response.data;
};

export default {
    // Drivers
    getDrivers,
    getDriver,
    createDriver,
    updateDriver,
    deleteDriver,
    toggleDriverStatus,
    getExpiringLicenses,
    exportDrivers,

    // Vehicles
    getVehicles,
    getVehicle,
    createVehicle,
    updateVehicle,
    assignDriverToVehicle,
    deleteVehicle,
    exportVehicles,

    // Routes
    getRoutes,
    getRoute,
    createRoute,
    updateRoute,
    assignVehicleToRoute,
    assignDriverToRoute,
    getRouteStudents,
    deleteRoute,
    exportRoutes,

    // Student Transport
    getStudentTransportAssignments,
    getStudentTransport,
    getRouteAssignments,
    assignStudentToRoute,
    updateStudentTransportAssignment,
    deactivateStudentTransportAssignment,
    bulkAssignStudents,
    exportStudentTransportAssignments
};
