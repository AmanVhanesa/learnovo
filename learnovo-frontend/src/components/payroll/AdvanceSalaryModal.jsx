import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, DollarSign, User, FileText, StickyNote } from 'lucide-react';
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
            setError('Failed to fetch employees');
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

    return createPortal(
        <div className="modal-overlay" onClick={() => { onClose(); resetForm(); }}>
            <div
                className="bg-white dark:bg-[#1C1C1E] rounded-none sm:rounded-2xl shadow-glass-lg ring-1 ring-white dark:ring-[#1C1C1E] max-w-lg w-full sm:mx-4 md:mx-auto h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#2C2C2E] px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                            {mode === 'create' ? 'Request Advance Salary' : 'Advance Salary Request'}
                        </h3>
                    </div>
                    <button
                        onClick={() => { onClose(); resetForm(); }}
                        className="btn-close flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {mode === 'create' ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Employee */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                                    Employee <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                    </div>
                                    <select
                                        value={formData.employeeId}
                                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-[#38383A] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-[#2C2C2E] dark:text-white text-sm transition-colors"
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
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                                    Amount (₹) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-gray-400 dark:text-[#636366] text-sm font-medium">₹</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        min="0"
                                        step="0.01"
                                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-[#38383A] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-[#2C2C2E] dark:text-white dark:placeholder-[#636366] text-sm transition-colors"
                                        placeholder="Enter amount"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FileText className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                    </div>
                                    <input
                                        type="text"
                                        value={formData.reason}
                                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-[#38383A] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-[#2C2C2E] dark:text-white dark:placeholder-[#636366] text-sm transition-colors"
                                        placeholder="e.g., Medical emergency, Personal loan"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                                    Notes <span className="text-gray-400 dark:text-[#636366] font-normal">(Optional)</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute top-2.5 left-0 pl-3 flex items-start pointer-events-none">
                                        <StickyNote className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                    </div>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows="3"
                                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-[#38383A] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-[#2C2C2E] dark:text-white dark:placeholder-[#636366] text-sm transition-colors resize-none"
                                        placeholder="Additional details..."
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-[#2C2C2E]">
                                <button
                                    type="button"
                                    onClick={() => { onClose(); resetForm(); }}
                                    className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-[#8E8E93] bg-gray-100 dark:bg-[#2C2C2E] rounded-lg hover:bg-gray-200 dark:hover:bg-[#38383A] transition-colors active:scale-95"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
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
                                <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-[#636366] uppercase tracking-wider">Employee</p>
                                            <p className="font-semibold text-gray-900 dark:text-white mt-0.5">{advanceData?.employeeId?.name} ({advanceData?.employeeId?.employeeId})</p>
                                        </div>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${advanceData?.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                            advanceData?.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                                                'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                            }`}>
                                            {advanceData?.status?.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="border-t border-gray-200 dark:border-[#38383A] pt-3">
                                        <p className="text-xs text-gray-500 dark:text-[#636366] uppercase tracking-wider">Amount</p>
                                        <p className="font-bold text-xl text-primary-600 dark:text-primary-400 mt-0.5">₹{advanceData?.amount?.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-[#636366] uppercase tracking-wider">Reason</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{advanceData?.reason}</p>
                                    </div>
                                    {advanceData?.notes && (
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-[#636366] uppercase tracking-wider">Notes</p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{advanceData.notes}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-[#636366] uppercase tracking-wider">Request Date</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{new Date(advanceData?.requestDate).toLocaleDateString('en-IN')}</p>
                                    </div>
                                    {advanceData?.status === 'approved' && (
                                        <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-3">
                                            <p className="text-xs text-gray-500 dark:text-[#636366] uppercase tracking-wider">Deduction Status</p>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${advanceData?.deductionStatus === 'deducted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                                    advanceData?.deductionStatus === 'partial' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                                                        'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                                    }`}>
                                                    {advanceData?.deductionStatus?.toUpperCase()}
                                                </span>
                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Remaining: <span className="text-primary-600 dark:text-primary-400 font-semibold">₹{advanceData?.remainingAmount?.toLocaleString('en-IN')}</span>
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {advanceData?.status === 'pending' && (
                                <div className="space-y-4 border-t border-gray-100 dark:border-[#2C2C2E] pt-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1.5">
                                            Rejection Reason <span className="text-gray-400 dark:text-[#636366] font-normal">(if rejecting)</span>
                                        </label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            rows="2"
                                            className="w-full px-3 py-2.5 border border-gray-300 dark:border-[#38383A] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-[#2C2C2E] dark:text-white dark:placeholder-[#636366] text-sm transition-colors resize-none"
                                            placeholder="Provide reason for rejection..."
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={onClose}
                                            className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-[#8E8E93] bg-gray-100 dark:bg-[#2C2C2E] rounded-lg hover:bg-gray-200 dark:hover:bg-[#38383A] transition-colors active:scale-95"
                                            disabled={loading}
                                        >
                                            Close
                                        </button>
                                        <button
                                            onClick={handleReject}
                                            className="px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                            disabled={loading}
                                        >
                                            {loading ? 'Rejecting...' : 'Reject'}
                                        </button>
                                        <button
                                            onClick={handleApprove}
                                            className="px-4 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                            disabled={loading}
                                        >
                                            {loading ? 'Approving...' : 'Approve'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {advanceData?.status !== 'pending' && (
                                <div className="flex justify-end border-t border-gray-100 dark:border-[#2C2C2E] pt-4">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-[#8E8E93] bg-gray-100 dark:bg-[#2C2C2E] rounded-lg hover:bg-gray-200 dark:hover:bg-[#38383A] transition-colors active:scale-95"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AdvanceSalaryModal;
