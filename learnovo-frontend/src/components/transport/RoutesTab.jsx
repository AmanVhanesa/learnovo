import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit, Trash2, X, Search, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import transportService from '../../services/transportService';

const RoutesTab = ({ onStatsUpdate }) => {
    const [routes, setRoutes] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingRoute, setEditingRoute] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchRoutes();
        fetchVehicles();
        fetchDrivers();
    }, [searchTerm, statusFilter]);

    const fetchRoutes = async () => {
        try {
            setLoading(true);
            const params = { limit: 100 };
            if (searchTerm) params.search = searchTerm;
            if (statusFilter !== 'all') params.status = statusFilter;

            const response = await transportService.getRoutes(params);
            setRoutes(response.data || []);
        } catch (error) {
            console.error('Error fetching routes:', error);
            toast.error('Failed to load routes');
        } finally {
            setLoading(false);
        }
    };

    const fetchVehicles = async () => {
        try {
            const response = await transportService.getVehicles({ status: 'active', limit: 100 });
            setVehicles(response.data || []);
        } catch (error) {
            console.error('Error fetching vehicles:', error);
        }
    };

    const fetchDrivers = async () => {
        try {
            const response = await transportService.getDrivers({ status: 'active', limit: 100 });
            setDrivers(response.data || []);
        } catch (error) {
            console.error('Error fetching drivers:', error);
        }
    };

    const handleAddRoute = () => {
        setEditingRoute(null);
        setShowModal(true);
    };

    const handleEditRoute = (route) => {
        setEditingRoute(route);
        setShowModal(true);
    };

    const handleDeleteRoute = async (route) => {
        if (!window.confirm(`Are you sure you want to delete route ${route.routeName}?`)) return;

        try {
            await transportService.deleteRoute(route._id, 'Deleted by admin');
            toast.success('Route deleted successfully');
            fetchRoutes();
            onStatsUpdate();
        } catch (error) {
            console.error('Error deleting route:', error);
            toast.error(error.response?.data?.message || 'Failed to delete route');
        }
    };

    const handleModalClose = (success) => {
        setShowModal(false);
        setEditingRoute(null);
        if (success) {
            fetchRoutes();
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
                            placeholder="Search routes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <button
                        onClick={handleAddRoute}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                        <Plus className="w-5 h-5" />
                        Add Route
                    </button>
                </div>
            </div>

            {/* Routes Table */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <p className="mt-2 text-gray-600">Loading routes...</p>
                </div>
            ) : routes.length === 0 ? (
                <div className="text-center py-12">
                    <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No routes found</h3>
                    <p className="text-gray-600 mb-4">Get started by adding your first route</p>
                    <button
                        onClick={handleAddRoute}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                        <Plus className="w-5 h-5" />
                        Add Route
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stops</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {routes.map((route) => (
                                <tr key={route._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{route.routeName}</div>
                                            <div className="text-sm text-gray-500">{route.routeId}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {route.stops?.length || 0} stops
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {route.assignedVehicle ? (
                                            <div className="text-sm text-gray-900">{route.assignedVehicle.vehicleNumber}</div>
                                        ) : (
                                            <span className="text-sm text-gray-500">Not assigned</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {route.assignedDriver ? (
                                            <div className="text-sm text-gray-900">{route.assignedDriver.name}</div>
                                        ) : (
                                            <span className="text-sm text-gray-500">Not assigned</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        ₹{route.monthlyFee}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${route.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {route.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => handleEditRoute(route)}
                                            className="text-primary-600 hover:text-primary-900 mr-4"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRoute(route)}
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

            {/* Route Modal */}
            {showModal && (
                <RouteModal
                    route={editingRoute}
                    vehicles={vehicles}
                    drivers={drivers}
                    onClose={handleModalClose}
                />
            )}
        </div>
    );
};

// Route Modal Component
const RouteModal = ({ route, vehicles, drivers, onClose }) => {
    const [formData, setFormData] = useState({
        routeName: route?.routeName || '',
        stops: route?.stops || [{ stopName: '', stopOrder: 1, pickupTime: '', dropTime: '', landmark: '' }],
        assignedVehicle: route?.assignedVehicle?._id || '',
        assignedDriver: route?.assignedDriver?._id || '',
        distance: route?.distance || '',
        estimatedDuration: route?.estimatedDuration || '',
        monthlyFee: route?.monthlyFee || ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleStopChange = (index, field, value) => {
        const newStops = [...formData.stops];
        newStops[index][field] = value;
        setFormData(prev => ({ ...prev, stops: newStops }));
    };

    const addStop = () => {
        setFormData(prev => ({
            ...prev,
            stops: [...prev.stops, { stopName: '', stopOrder: prev.stops.length + 1, pickupTime: '', dropTime: '', landmark: '' }]
        }));
    };

    const removeStop = (index) => {
        if (formData.stops.length <= 2) {
            toast.error('A route must have at least 2 stops');
            return;
        }
        const newStops = formData.stops.filter((_, i) => i !== index);
        // Reorder stops
        newStops.forEach((stop, i) => {
            stop.stopOrder = i + 1;
        });
        setFormData(prev => ({ ...prev, stops: newStops }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.stops.length < 2) {
            toast.error('A route must have at least 2 stops');
            return;
        }

        setLoading(true);

        try {
            if (route) {
                await transportService.updateRoute(route._id, formData);
                toast.success('Route updated successfully');
            } else {
                await transportService.createRoute(formData);
                toast.success('Route created successfully');
            }
            onClose(true);
        } catch (error) {
            console.error('Error saving route:', error);
            toast.error(error.response?.data?.message || 'Failed to save route');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {route ? 'Edit Route' : 'Add New Route'}
                    </h2>
                    <button onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Route Information */}
                        <div className="md:col-span-2">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Route Information</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Route Name *</label>
                            <input
                                type="text"
                                name="routeName"
                                value={formData.routeName}
                                onChange={handleChange}
                                required
                                placeholder="e.g., Route A - City Center"
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">Distance (km)</label>
                            <input
                                type="number"
                                name="distance"
                                value={formData.distance}
                                onChange={handleChange}
                                min="0"
                                step="0.1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Duration (minutes)</label>
                            <input
                                type="number"
                                name="estimatedDuration"
                                value={formData.estimatedDuration}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Vehicle</label>
                            <select
                                name="assignedVehicle"
                                value={formData.assignedVehicle}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="">No Vehicle Assigned</option>
                                {vehicles.map(vehicle => (
                                    <option key={vehicle._id} value={vehicle._id}>
                                        {vehicle.vehicleNumber} - {vehicle.vehicleType}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Driver</label>
                            <select
                                name="assignedDriver"
                                value={formData.assignedDriver}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="">No Driver Assigned</option>
                                {drivers.map(driver => (
                                    <option key={driver._id} value={driver._id}>
                                        {driver.name} ({driver.licenseNumber})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Stops */}
                        <div className="md:col-span-2 mt-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-gray-900">Route Stops (minimum 2)</h3>
                                <button
                                    type="button"
                                    onClick={addStop}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Stop
                                </button>
                            </div>
                        </div>

                        {formData.stops.map((stop, index) => (
                            <div key={index} className="md:col-span-2 border border-gray-200 rounded-lg p-4 relative">
                                <div className="absolute top-2 right-2">
                                    {formData.stops.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => removeStop(index)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <Minus className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Stop {index + 1} Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={stop.stopName}
                                            onChange={(e) => handleStopChange(index, 'stopName', e.target.value)}
                                            required
                                            placeholder="e.g., Main Square"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Landmark</label>
                                        <input
                                            type="text"
                                            value={stop.landmark}
                                            onChange={(e) => handleStopChange(index, 'landmark', e.target.value)}
                                            placeholder="e.g., Near City Mall"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Time</label>
                                        <input
                                            type="time"
                                            value={stop.pickupTime}
                                            onChange={(e) => handleStopChange(index, 'pickupTime', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Drop Time</label>
                                        <input
                                            type="time"
                                            value={stop.dropTime}
                                            onChange={(e) => handleStopChange(index, 'dropTime', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
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
                            {loading ? 'Saving...' : route ? 'Update Route' : 'Add Route'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoutesTab;
