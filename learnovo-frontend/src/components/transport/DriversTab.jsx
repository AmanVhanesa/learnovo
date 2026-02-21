import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Edit, Trash2, X, Search, Camera, Upload, User } from 'lucide-react';
import toast from 'react-hot-toast';
import transportService from '../../services/transportService';

const DriversTab = ({ onStatsUpdate }) => {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingDriver, setEditingDriver] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchDrivers();
    }, [searchTerm, statusFilter]);

    const fetchDrivers = async () => {
        try {
            setLoading(true);
            const params = { limit: 100 };
            if (searchTerm) params.search = searchTerm;
            if (statusFilter !== 'all') params.status = statusFilter;

            const response = await transportService.getDrivers(params);
            setDrivers(response.data || []);
        } catch (error) {
            console.error('Error fetching drivers:', error);
            toast.error('Failed to load drivers');
        } finally {
            setLoading(false);
        }
    };

    const handleAddDriver = () => {
        setEditingDriver(null);
        setShowModal(true);
    };

    const handleEditDriver = (driver) => {
        setEditingDriver(driver);
        setShowModal(true);
    };

    const handleDeleteDriver = async (driver) => {
        if (!window.confirm(`Are you sure you want to delete driver ${driver.name}?`)) return;

        try {
            await transportService.deleteDriver(driver._id, 'Deleted by admin');
            toast.success('Driver deleted successfully');
            fetchDrivers();
            onStatsUpdate();
        } catch (error) {
            console.error('Error deleting driver:', error);
            toast.error(error.response?.data?.message || 'Failed to delete driver');
        }
    };

    const handleModalClose = (success) => {
        setShowModal(false);
        setEditingDriver(null);
        if (success) {
            fetchDrivers();
            onStatsUpdate();
        }
    };

    // Driver avatar component — shows photo or initials fallback
    const DriverAvatar = ({ driver, size = 'sm' }) => {
        const sizeClasses = size === 'sm' ? 'w-10 h-10 text-sm' : 'w-20 h-20 text-2xl';
        const initials = driver.name
            ? driver.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            : 'DR';

        if (driver.photo) {
            return (
                <img
                    src={driver.photo}
                    alt={driver.name}
                    className={`${sizeClasses} rounded-full object-cover border-2 border-gray-200 flex-shrink-0`}
                />
            );
        }

        return (
            <div className={`${sizeClasses} rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
                {initials}
            </div>
        );
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
                            placeholder="Search drivers..."
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
                        onClick={handleAddDriver}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                        <Plus className="w-5 h-5" />
                        Add Driver
                    </button>
                </div>
            </div>

            {/* Drivers Table */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <p className="mt-2 text-gray-600">Loading drivers...</p>
                </div>
            ) : drivers.length === 0 ? (
                <div className="text-center py-12">
                    <UserCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No drivers found</h3>
                    <p className="text-gray-600 mb-4">Get started by adding your first driver</p>
                    <button
                        onClick={handleAddDriver}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                        <Plus className="w-5 h-5" />
                        Add Driver
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">License</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {drivers.map((driver) => (
                                <tr key={driver._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <DriverAvatar driver={driver} size="sm" />
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{driver.name}</div>
                                                <div className="text-sm text-gray-500">{driver.driverId}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{driver.phone}</div>
                                        {driver.email && <div className="text-sm text-gray-500">{driver.email}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{driver.licenseNumber}</div>
                                        <div className="text-sm text-gray-500">
                                            Expires: {new Date(driver.licenseExpiry).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${driver.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {driver.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => handleEditDriver(driver)}
                                            className="text-primary-600 hover:text-primary-900 mr-4"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteDriver(driver)}
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

            {/* Driver Modal */}
            {showModal && (
                <DriverModal
                    driver={editingDriver}
                    onClose={handleModalClose}
                />
            )}
        </div>
    );
};

// Driver Modal Component
const DriverModal = ({ driver, onClose }) => {
    const [formData, setFormData] = useState({
        name: driver?.name || '',
        phone: driver?.phone || '',
        email: driver?.email || '',
        licenseNumber: driver?.licenseNumber || '',
        licenseExpiry: driver?.licenseExpiry ? new Date(driver.licenseExpiry).toISOString().split('T')[0] : '',
        licenseType: driver?.licenseType || 'LMV',
        dateOfBirth: driver?.dateOfBirth ? new Date(driver.dateOfBirth).toISOString().split('T')[0] : '',
        gender: driver?.gender || 'male',
        bloodGroup: driver?.bloodGroup || '',
        address: driver?.address || '',
        nationalId: driver?.nationalId || '',
        dateOfJoining: driver?.dateOfJoining ? new Date(driver.dateOfJoining).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        salary: driver?.salary || '',
        experience: driver?.experience || '',
        emergencyContact: {
            name: driver?.emergencyContact?.name || '',
            phone: driver?.emergencyContact?.phone || '',
            relation: driver?.emergencyContact?.relation || ''
        },
        photo: driver?.photo || ''
    });
    const [loading, setLoading] = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [photoPreview, setPhotoPreview] = useState(driver?.photo || '');

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('emergency.')) {
            const field = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                emergencyContact: {
                    ...prev.emergencyContact,
                    [field]: value
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show local preview immediately
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result);
        reader.readAsDataURL(file);

        // If editing an existing driver, upload to Cloudinary right away
        if (driver?._id) {
            try {
                setPhotoUploading(true);
                const result = await transportService.uploadDriverPhoto(driver._id, file);
                setFormData(prev => ({ ...prev, photo: result.data.url }));
                setPhotoPreview(result.data.url);
                toast.success('Photo uploaded successfully');
            } catch (error) {
                console.error('Photo upload error:', error);
                toast.error(error.response?.data?.message || 'Failed to upload photo');
                // Keep base64 preview even if upload fails; photo won't be saved to Cloudinary
            } finally {
                setPhotoUploading(false);
            }
        } else {
            // For new drivers: store file object for later upload after driver is created
            setFormData(prev => ({ ...prev, _pendingPhotoFile: file }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Exclude internal _pendingPhotoFile from payload
            const { _pendingPhotoFile, ...payload } = formData;

            let savedDriver;
            if (driver) {
                const result = await transportService.updateDriver(driver._id, payload);
                savedDriver = result.data;
                toast.success('Driver updated successfully');
            } else {
                const result = await transportService.createDriver(payload);
                savedDriver = result.data;
                toast.success('Driver created successfully');

                // Upload pending photo for newly created driver
                if (_pendingPhotoFile && savedDriver?._id) {
                    try {
                        setPhotoUploading(true);
                        await transportService.uploadDriverPhoto(savedDriver._id, _pendingPhotoFile);
                    } catch (photoErr) {
                        console.error('Pending photo upload failed:', photoErr);
                        toast.error('Driver saved but photo upload failed. You can re-upload by editing the driver.');
                    } finally {
                        setPhotoUploading(false);
                    }
                }
            }
            onClose(true);
        } catch (error) {
            console.error('Error saving driver:', error);
            toast.error(error.response?.data?.message || 'Failed to save driver');
        } finally {
            setLoading(false);
        }
    };

    const initials = formData.name
        ? formData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : 'DR';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {driver ? 'Edit Driver' : 'Add New Driver'}
                    </h2>
                    <button onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {/* Photo Upload Section */}
                    <div className="flex items-center gap-6 mb-6 pb-6 border-b border-gray-100">
                        <div className="relative flex-shrink-0">
                            {photoPreview ? (
                                <img
                                    src={photoPreview}
                                    alt="Driver"
                                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-2xl font-semibold">
                                    {initials}
                                </div>
                            )}
                            {photoUploading && (
                                <div className="absolute inset-0 rounded-full bg-black bg-opacity-40 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 mb-1">Driver Photo</p>
                            <p className="text-xs text-gray-500 mb-3">Upload a clear photo (JPG, PNG)</p>
                            <div className="flex flex-wrap gap-2">
                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium cursor-pointer hover:bg-primary-700 active:scale-95 transition-all">
                                    <Upload className="h-3.5 w-3.5" />
                                    Gallery
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handlePhotoUpload}
                                        disabled={photoUploading}
                                    />
                                </label>
                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 text-white text-xs font-medium cursor-pointer hover:bg-gray-800 active:scale-95 transition-all">
                                    <Camera className="h-3.5 w-3.5" />
                                    Camera
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={handlePhotoUpload}
                                        disabled={photoUploading}
                                    />
                                </label>
                            </div>
                            {photoUploading && (
                                <p className="text-xs text-blue-600 mt-2">Uploading photo...</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Personal Information */}
                        <div className="md:col-span-2">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                            <input
                                type="date"
                                name="dateOfBirth"
                                value={formData.dateOfBirth}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group</label>
                            <select
                                name="bloodGroup"
                                value={formData.bloodGroup}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="">Select Blood Group</option>
                                <option value="A+">A+</option>
                                <option value="A-">A-</option>
                                <option value="B+">B+</option>
                                <option value="B-">B-</option>
                                <option value="AB+">AB+</option>
                                <option value="AB-">AB-</option>
                                <option value="O+">O+</option>
                                <option value="O-">O-</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows="2"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">National ID</label>
                            <input
                                type="text"
                                name="nationalId"
                                value={formData.nationalId}
                                onChange={handleChange}
                                placeholder="Aadhaar / Passport / National ID"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        {/* License Information */}
                        <div className="md:col-span-2 mt-4">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">License Information</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">License Number *</label>
                            <input
                                type="text"
                                name="licenseNumber"
                                value={formData.licenseNumber}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">License Type</label>
                            <select
                                name="licenseType"
                                value={formData.licenseType}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="LMV">LMV (Light Motor Vehicle)</option>
                                <option value="HMV">HMV (Heavy Motor Vehicle)</option>
                                <option value="MCWG">MCWG (Motorcycle with Gear)</option>
                                <option value="MCWOG">MCWOG (Motorcycle without Gear)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">License Expiry *</label>
                            <input
                                type="date"
                                name="licenseExpiry"
                                value={formData.licenseExpiry}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        {/* Employment Information */}
                        <div className="md:col-span-2 mt-4">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Employment Information</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Date of Joining</label>
                            <input
                                type="date"
                                name="dateOfJoining"
                                value={formData.dateOfJoining}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Salary</label>
                            <input
                                type="number"
                                name="salary"
                                value={formData.salary}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Experience (years)</label>
                            <input
                                type="number"
                                name="experience"
                                value={formData.experience}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        {/* Emergency Contact */}
                        <div className="md:col-span-2 mt-4">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name</label>
                            <input
                                type="text"
                                name="emergency.name"
                                value={formData.emergencyContact.name}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
                            <input
                                type="tel"
                                name="emergency.phone"
                                value={formData.emergencyContact.phone}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Relation</label>
                            <input
                                type="text"
                                name="emergency.relation"
                                value={formData.emergencyContact.relation}
                                onChange={handleChange}
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
                            disabled={loading || photoUploading}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : driver ? 'Update Driver' : 'Add Driver'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DriversTab;
