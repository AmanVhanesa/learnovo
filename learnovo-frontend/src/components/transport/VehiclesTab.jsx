import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bus, Plus, Edit, Trash2, X, Search, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import transportService from '../../services/transportService';
import { exportCSV } from '../../utils/exportHelpers';
import { formatDate } from '../../utils/formatDate';

const VehiclesTab = ({ onStatsUpdate }) => {
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        fetchVehicles();
        fetchDrivers();
    }, [debouncedSearch, statusFilter]);

    const fetchVehicles = async () => {
        try {
            setLoading(true);
            const params = { limit: 100 };
            if (debouncedSearch) params.search = debouncedSearch;
            if (statusFilter !== 'all') params.status = statusFilter;

            const response = await transportService.getVehicles(params);
            setVehicles(response.data || []);
        } catch (error) {
            toast.error('Failed to load vehicles');
        } finally {
            setLoading(false);
        }
    };

    const fetchDrivers = async () => {
        try {
            const response = await transportService.getDrivers({ status: 'active', limit: 100 });
            setDrivers(response.data || []);
        } catch (error) {
        }
    };

    const handleAddVehicle = () => {
        setEditingVehicle(null);
        setShowModal(true);
    };

    const handleEditVehicle = (vehicle) => {
        setEditingVehicle(vehicle);
        setShowModal(true);
    };

    const handleDeleteVehicle = async (vehicle) => {
        if (!window.confirm(`Are you sure you want to delete vehicle ${vehicle.vehicleNumber}?`)) return;

        try {
            await transportService.deleteVehicle(vehicle._id, 'Deleted by admin');
            toast.success('Vehicle deleted successfully');
            fetchVehicles();
            onStatsUpdate();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete vehicle');
        }
    };

    const handleModalClose = (success) => {
        setShowModal(false);
        setEditingVehicle(null);
        if (success) {
            fetchVehicles();
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
                            placeholder="Search vehicles..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <button
                        onClick={() => {
                            if (vehicles.length === 0) { toast.error('No vehicles to export'); return; }
                            const rows = [
                                ['Vehicle Number', 'Type', 'Model', 'Capacity', 'Driver', 'Insurance Expiry', 'Fitness Expiry', 'Pollution Expiry', 'Status']
                            ].concat(vehicles.map(v => [
                                v.vehicleNumber || '',
                                v.type || '',
                                v.model || '',
                                v.capacity || '',
                                v.driver?.name || 'Not Assigned',
                                v.insuranceExpiry ? formatDate(v.insuranceExpiry) : '',
                                v.fitnessExpiry ? formatDate(v.fitnessExpiry) : '',
                                v.pollutionExpiry ? formatDate(v.pollutionExpiry) : '',
                                v.isActive ? 'Active' : 'Inactive'
                            ]));
                            exportCSV('vehicles.csv', rows);
                            toast.success('Vehicles exported successfully');
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2C2C2E]"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <button
                        onClick={handleAddVehicle}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                        <Plus className="w-5 h-5" />
                        Add Vehicle
                    </button>
                </div>
            </div>

            {/* Vehicles Table */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <p className="mt-2 text-gray-600 dark:text-[#8E8E93]">Loading vehicles...</p>
                </div>
            ) : vehicles.length === 0 ? (
                <div className="text-center py-12">
                    <Bus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No vehicles found</h3>
                    <p className="text-gray-600 dark:text-[#8E8E93] mb-4">Get started by adding your first vehicle</p>
                    <button
                        onClick={handleAddVehicle}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                        <Plus className="w-5 h-5" />
                        Add Vehicle
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full min-w-[600px] divide-y divide-gray-200 dark:divide-[#38383A]">
                        <thead className="bg-gray-50 dark:bg-[#2C2C2E]">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Vehicle</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Capacity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Driver</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-[#1C1C1E] divide-y divide-gray-200 dark:divide-[#38383A]">
                            {vehicles.map((vehicle) => (
                                <tr key={vehicle._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{vehicle.vehicleNumber}</div>
                                            <div className="text-sm text-gray-500 dark:text-[#8E8E93]">{vehicle.vehicleId}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 dark:text-white">{vehicle.vehicleType}</div>
                                        {vehicle.model && <div className="text-sm text-gray-500 dark:text-[#8E8E93]">{vehicle.model}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        {vehicle.capacity} seats
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {vehicle.assignedDriver ? (
                                            <div className="text-sm text-gray-900 dark:text-white">{vehicle.assignedDriver.name}</div>
                                        ) : (
                                            <span className="text-sm text-gray-500 dark:text-[#8E8E93]">Not assigned</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${vehicle.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {vehicle.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => handleEditVehicle(vehicle)}
                                            className="text-primary-600 hover:text-primary-900 mr-4"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteVehicle(vehicle)}
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
            )}

            {/* Vehicle Modal */}
            {showModal && (
                <VehicleModal
                    vehicle={editingVehicle}
                    drivers={drivers}
                    onClose={handleModalClose}
                />
            )}
        </div>
    );
};

// Vehicle Modal Component
const VehicleModal = ({ vehicle, drivers, onClose }) => {
    const [formData, setFormData] = useState({
        vehicleNumber: vehicle?.vehicleNumber || '',
        vehicleType: vehicle?.vehicleType || 'Bus',
        model: vehicle?.model || '',
        manufacturingYear: vehicle?.manufacturingYear || '',
        color: vehicle?.color || '',
        capacity: vehicle?.capacity || '',
        fuelType: vehicle?.fuelType || 'Diesel',
        insuranceNumber: vehicle?.insuranceNumber || '',
        insuranceExpiry: vehicle?.insuranceExpiry ? new Date(vehicle.insuranceExpiry).toISOString().split('T')[0] : '',
        fitnessExpiry: vehicle?.fitnessExpiry ? new Date(vehicle.fitnessExpiry).toISOString().split('T')[0] : '',
        pollutionExpiry: vehicle?.pollutionExpiry ? new Date(vehicle.pollutionExpiry).toISOString().split('T')[0] : '',
        assignedDriver: vehicle?.assignedDriver?._id || ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (vehicle) {
                await transportService.updateVehicle(vehicle._id, formData);
                toast.success('Vehicle updated successfully');
            } else {
                await transportService.createVehicle(formData);
                toast.success('Vehicle created successfully');
            }
            onClose(true);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save vehicle');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-[#1C1C1E] border-b border-gray-200 dark:border-[#38383A] px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {vehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
                    </h2>
                    <button onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-600 dark:text-[#8E8E93]">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Vehicle Information */}
                        <div className="md:col-span-2">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Vehicle Information</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Vehicle Number *</label>
                            <input
                                type="text"
                                name="vehicleNumber"
                                value={formData.vehicleNumber}
                                onChange={handleChange}
                                required
                                placeholder="e.g., MH-12-AB-1234"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Vehicle Type *</label>
                            <select
                                name="vehicleType"
                                value={formData.vehicleType}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                            >
                                <option value="Bus">Bus</option>
                                <option value="Van">Van</option>
                                <option value="Car">Car</option>
                                <option value="Auto">Auto</option>
                                <option value="Tempo">Tempo</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Model</label>
                            <input
                                type="text"
                                name="model"
                                value={formData.model}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Manufacturing Year</label>
                            <input
                                type="number"
                                name="manufacturingYear"
                                value={formData.manufacturingYear}
                                onChange={handleChange}
                                min="1990"
                                max={new Date().getFullYear()}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Color</label>
                            <input
                                type="text"
                                name="color"
                                value={formData.color}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Seating Capacity *</label>
                            <input
                                type="number"
                                name="capacity"
                                value={formData.capacity}
                                onChange={handleChange}
                                required
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Fuel Type</label>
                            <select
                                name="fuelType"
                                value={formData.fuelType}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                            >
                                <option value="Petrol">Petrol</option>
                                <option value="Diesel">Diesel</option>
                                <option value="CNG">CNG</option>
                                <option value="Electric">Electric</option>
                                <option value="Hybrid">Hybrid</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Assigned Driver</label>
                            <select
                                name="assignedDriver"
                                value={formData.assignedDriver}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                            >
                                <option value="">No Driver Assigned</option>
                                {drivers.map(driver => (
                                    <option key={driver._id} value={driver._id}>
                                        {driver.name} ({driver.licenseNumber})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Legal Documents */}
                        <div className="md:col-span-2 mt-4">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Legal Documents</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Insurance Number</label>
                            <input
                                type="text"
                                name="insuranceNumber"
                                value={formData.insuranceNumber}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Insurance Expiry *</label>
                            <input
                                type="date"
                                name="insuranceExpiry"
                                value={formData.insuranceExpiry}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Fitness Certificate Expiry *</label>
                            <input
                                type="date"
                                name="fitnessExpiry"
                                value={formData.fitnessExpiry}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Pollution Certificate Expiry *</label>
                            <input
                                type="date"
                                name="pollutionExpiry"
                                value={formData.pollutionExpiry}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => onClose(false)}
                            className="px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                            style={{ minWidth: '120px' }}
                        >
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="31.4" strokeDashoffset="10" />
                                    </svg>
                                    Saving...
                                </span>
                            ) : (
                                vehicle ? 'Update Vehicle' : 'Add Vehicle'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default VehiclesTab;
