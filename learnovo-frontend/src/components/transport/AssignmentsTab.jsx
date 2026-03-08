import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, X, Search, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import transportService from '../../services/transportService';
import api from '../../services/authService';
import axios from 'axios';

const AssignmentsTab = ({ onStatsUpdate }) => {
    const [assignments, setAssignments] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [driverFilter, setDriverFilter] = useState('');
    const [subDepartmentFilter, setSubDepartmentFilter] = useState('');
    const [drivers, setDrivers] = useState([]);
    const [subDepartments, setSubDepartments] = useState([]);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        fetchAssignments();
        fetchRoutes();
        fetchStudents();
        fetchDrivers();
        fetchSubDepartments();
    }, [searchTerm, statusFilter]);

    const fetchAssignments = async () => {
        try {
            setLoading(true);
            const params = { limit: 100 };
            if (searchTerm) params.search = searchTerm;
            if (statusFilter !== 'all') params.status = statusFilter;

            const response = await transportService.getStudentTransportAssignments(params);
            setAssignments(response.data || []);
        } catch (error) {
            console.error('Error fetching assignments:', error);
            toast.error('Failed to load student assignments');
        } finally {
            setLoading(false);
        }
    };

    const fetchRoutes = async () => {
        try {
            const response = await transportService.getRoutes({ status: 'active', limit: 100 });
            setRoutes(response.data || []);
        } catch (error) {
            console.error('Error fetching routes:', error);
        }
    };

    const fetchStudents = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/students`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { limit: 500 }
            });
            setStudents(response.data.data || []);
        } catch (error) {
            console.error('Error fetching students:', error);
        }
    };

    const fetchDrivers = async () => {
        try {
            const response = await transportService.getDrivers({ limit: 100, status: 'active' });
            setDrivers(response.data || []);
        } catch (error) {
            console.error('Error fetching drivers:', error);
        }
    };

    const fetchSubDepartments = async () => {
        try {
            const response = await api.get('/sub-departments?active=true');
            if (response.data.success) {
                setSubDepartments(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching sub-departments:', error);
        }
    };

    const handleExport = async () => {
        try {
            setExporting(true);
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (driverFilter) params.append('driver', driverFilter);
            if (subDepartmentFilter) params.append('subDepartment', subDepartmentFilter);
            if (statusFilter !== 'all') params.append('status', statusFilter);

            const response = await axios.get(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/students/export?${params.toString()}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob'
                }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'students_transport_export.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export students');
        } finally {
            setExporting(false);
        }
    };

    const handleAddAssignment = () => {
        setEditingAssignment(null);
        setShowModal(true);
    };

    const handleEditAssignment = (assignment) => {
        setEditingAssignment(assignment);
        setShowModal(true);
    };

    const handleDeleteAssignment = async (assignment) => {
        if (!window.confirm(`Are you sure you want to remove this transport assignment?`)) return;

        try {
            await transportService.deactivateStudentTransportAssignment(assignment._id, 'Removed by admin');
            toast.success('Assignment removed successfully');
            fetchAssignments();
            onStatsUpdate();
        } catch (error) {
            console.error('Error deleting assignment:', error);
            toast.error(error.response?.data?.message || 'Failed to remove assignment');
        }
    };

    const handleModalClose = (success) => {
        setShowModal(false);
        setEditingAssignment(null);
        if (success) {
            fetchAssignments();
            onStatsUpdate();
        }
    };

    return (
        <div>
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex-1 w-full sm:w-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search students..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                <select
                    value={subDepartmentFilter}
                    onChange={(e) => setSubDepartmentFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                >
                    <option value="">All Sub-Depts</option>
                    {subDepartments.map(sd => (
                        <option key={sd._id} value={sd._id}>{sd.name}</option>
                    ))}
                </select>
                <select
                    value={driverFilter}
                    onChange={(e) => setDriverFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                >
                    <option value="">All Drivers</option>
                    {drivers.map(d => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                >
                    <Download className="w-4 h-4" />
                    {exporting ? 'Exporting...' : 'Export List'}
                </button>
                <button
                    onClick={handleAddAssignment}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                    <Plus className="w-5 h-5" />
                    Assign Student
                </button>
            </div>
            {/* Assignments Table */}
            {
                loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        <p className="mt-2 text-gray-600">Loading assignments...</p>
                    </div>
                ) : assignments.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No student assignments found</h3>
                        <p className="text-gray-600 mb-4">Get started by assigning students to routes</p>
                        <button
                            onClick={handleAddAssignment}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                            <Plus className="w-5 h-5" />
                            Assign Student
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stop</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transport Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Fee</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {assignments.map((assignment) => (
                                    <tr key={assignment._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {assignment.student?.name || 'Unknown'}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {assignment.student?.admissionNumber || 'N/A'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {assignment.route?.routeName || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {assignment.stop}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {assignment.transportType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ₹{assignment.monthlyFee}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${assignment.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {assignment.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => handleEditAssignment(assignment)}
                                                className="text-primary-600 hover:text-primary-900 mr-4"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAssignment(assignment)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            }

            {/* Assignment Modal */}
            {
                showModal && (
                    <AssignmentModal
                        assignment={editingAssignment}
                        students={students}
                        routes={routes}
                        onClose={handleModalClose}
                    />
                )
            }
        </div >
    );
};

// Assignment Modal Component
const AssignmentModal = ({ assignment, students, routes, onClose }) => {
    const [formData, setFormData] = useState({
        student: assignment?.student?._id || '',
        route: assignment?.route?._id || '',
        stop: assignment?.stop || '',
        transportType: assignment?.transportType || 'Both',
        academicYear: assignment?.academicYear || new Date().getFullYear().toString(),
        monthlyFee: assignment?.monthlyFee || '',
        startDate: assignment?.startDate ? new Date(assignment.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
    const [loading, setLoading] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState(null);

    useEffect(() => {
        if (formData.route) {
            const route = routes.find(r => r._id === formData.route);
            setSelectedRoute(route);
            if (route && !formData.monthlyFee) {
                setFormData(prev => ({ ...prev, monthlyFee: route.monthlyFee }));
            }
        }
    }, [formData.route, routes]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (assignment) {
                await transportService.updateStudentTransportAssignment(assignment._id, formData);
                toast.success('Assignment updated successfully');
            } else {
                await transportService.assignStudentToRoute(formData);
                toast.success('Student assigned successfully');
            }
            onClose(true);
        } catch (error) {
            console.error('Error saving assignment:', error);
            toast.error(error.response?.data?.message || 'Failed to save assignment');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {assignment ? 'Edit Student Assignment' : 'Assign Student to Route'}
                    </h2>
                    <button onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Student *</label>
                            <select
                                name="student"
                                value={formData.student}
                                onChange={handleChange}
                                required
                                disabled={!!assignment}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
                            >
                                <option value="">Select Student</option>
                                {students.map(student => (
                                    <option key={student._id} value={student._id}>
                                        {student.name} - {student.admissionNumber} ({student.class})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Route *</label>
                            <select
                                name="route"
                                value={formData.route}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="">Select Route</option>
                                {routes.map(route => (
                                    <option key={route._id} value={route._id}>
                                        {route.routeName} - ₹{route.monthlyFee}/month
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedRoute && selectedRoute.stops && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Stop *</label>
                                <select
                                    name="stop"
                                    value={formData.stop}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                >
                                    <option value="">Select Stop</option>
                                    {selectedRoute.stops.map((stop, index) => (
                                        <option key={index} value={stop.stopName}>
                                            {stop.stopName} {stop.landmark && `(${stop.landmark})`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Transport Type *</label>
                            <select
                                name="transportType"
                                value={formData.transportType}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="Both">Both (Pickup & Drop)</option>
                                <option value="Pickup Only">Pickup Only</option>
                                <option value="Drop Only">Drop Only</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year *</label>
                            <input
                                type="text"
                                name="academicYear"
                                value={formData.academicYear}
                                onChange={handleChange}
                                required
                                placeholder="e.g., 2024"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Fee *</label>
                            <input
                                type="number"
                                name="monthlyFee"
                                value={formData.monthlyFee}
                                onChange={handleChange}
                                required
                                min="0"
                                placeholder="₹"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                            <input
                                type="date"
                                name="startDate"
                                value={formData.startDate}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => onClose(false)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : assignment ? 'Update Assignment' : 'Assign Student'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AssignmentsTab;
