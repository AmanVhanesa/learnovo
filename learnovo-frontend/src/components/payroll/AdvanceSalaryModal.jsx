import { useState, useEffect } from 'react';
import payrollService from '../../services/payrollService';
import employeesService from '../../services/employeesService';

const AdvanceSalaryModal = ({ isOpen, onClose, onSuccess, mode = 'create', advanceData = null }) => {
    const [formData, setFormData] = useState({
        employeeId: '',
        amount: '',
        reason: '',
        notes: ''
    });
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        if (isOpen && mode === 'create') {
            fetchEmployees();
        }
    }, [isOpen, mode]);

    const fetchEmployees = async () => {
        try {
            const response = await employeesService.list({ limit: 100, status: 'active' });
            setEmployees(response.data);
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (mode === 'create') {
                await payrollService.createAdvanceRequest(formData);
                onSuccess('Advance salary request created successfully');
            }
            onClose();
            resetForm();
        } catch (err) {
            console.error('Error creating advance request:', err);
            setError(err.message || 'Failed to create advance request');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        setError('');
        setLoading(true);

        try {
            await payrollService.approveAdvanceRequest(advanceData._id);
            onSuccess('Advance salary request approved successfully');
            onClose();
        } catch (err) {
            console.error('Error approving advance request:', err);
            setError(err.message || 'Failed to approve advance request');
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            setError('Please provide a rejection reason');
            return;
        }

        setError('');
        setLoading(true);

        try {
            await payrollService.rejectAdvanceRequest(advanceData._id, rejectionReason);
            onSuccess('Advance salary request rejected');
            onClose();
        } catch (err) {
            console.error('Error rejecting advance request:', err);
            setError(err.message || 'Failed to reject advance request');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            employeeId: '',
            amount: '',
            reason: '',
            notes: ''
        });
        setRejectionReason('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-800">
                        {mode === 'create' ? 'Request Advance Salary' : 'Advance Salary Request'}
                    </h2>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                            {error}
                        </div>
                    )}

                    {mode === 'create' ? (
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Employee *
                                </label>
                                <select
                                    value={formData.employeeId}
                                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map(emp => (
                                        <option key={emp._id} value={emp._id}>
                                            {emp.name} ({emp.employeeId}) - ₹{emp.salary?.toLocaleString('en-IN')}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Amount (₹) *
                                </label>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Reason *
                                </label>
                                <input
                                    type="text"
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., Medical emergency, Personal loan"
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Notes (Optional)
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Additional details..."
                                />
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => { onClose(); resetForm(); }}
                                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
                                    disabled={loading}
                                >
                                    {loading ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div>
                            {/* View/Approve/Reject Mode */}
                            <div className="space-y-3 mb-6">
                                <div>
                                    <p className="text-sm text-gray-600">Employee</p>
                                    <p className="font-semibold">{advanceData?.employeeId?.name} ({advanceData?.employeeId?.employeeId})</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Amount</p>
                                    <p className="font-semibold text-lg text-green-600">₹{advanceData?.amount?.toLocaleString('en-IN')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Reason</p>
                                    <p className="font-semibold">{advanceData?.reason}</p>
                                </div>
                                {advanceData?.notes && (
                                    <div>
                                        <p className="text-sm text-gray-600">Notes</p>
                                        <p className="text-gray-700">{advanceData.notes}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-gray-600">Request Date</p>
                                    <p className="font-semibold">{new Date(advanceData?.requestDate).toLocaleDateString('en-IN')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Status</p>
                                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${advanceData?.status === 'approved' ? 'bg-green-100 text-green-800' :
                                        advanceData?.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>
                                        {advanceData?.status?.toUpperCase()}
                                    </span>
                                </div>
                                {advanceData?.status === 'approved' && (
                                    <div>
                                        <p className="text-sm text-gray-600">Deduction Status</p>
                                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${advanceData?.deductionStatus === 'deducted' ? 'bg-green-100 text-green-800' :
                                            advanceData?.deductionStatus === 'partial' ? 'bg-blue-100 text-blue-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {advanceData?.deductionStatus?.toUpperCase()}
                                        </span>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Remaining: ₹{advanceData?.remainingAmount?.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {advanceData?.status === 'pending' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Rejection Reason (if rejecting)
                                        </label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            rows="2"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Provide reason for rejection..."
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={onClose}
                                            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition"
                                            disabled={loading}
                                        >
                                            Close
                                        </button>
                                        <button
                                            onClick={handleReject}
                                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:bg-gray-400"
                                            disabled={loading}
                                        >
                                            {loading ? 'Rejecting...' : 'Reject'}
                                        </button>
                                        <button
                                            onClick={handleApprove}
                                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:bg-gray-400"
                                            disabled={loading}
                                        >
                                            {loading ? 'Approving...' : 'Approve'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {advanceData?.status !== 'pending' && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdvanceSalaryModal;
